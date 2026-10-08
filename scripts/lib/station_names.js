'use strict';
/**
 * scripts/lib/station_names.js
 *
 * 店のアクセス文に出てくる「〜駅」が愛知県内の駅かを判定する（SEO-120）。
 * 「駅」の直前の語（区切り記号までの連続部分）を取り出し、その末尾が一致する最も長い駅名で決める。
 *   aichi   … 愛知県内の駅名（旧駅名・通称を含む）に当たった
 *   outside … 愛知県外にしか無い駅名に当たった（＝県外の店の疑い。人が一次情報で確かめる）
 *   unknown … どの駅名にも当たらない（バス停・誤記・「最寄駅」など。判定には使わない）
 * 「東京第一ホテル錦」のように駅を伴わない地名は見ない。判定に使うのは data/station_names.json
 * （出典つきの駅名リスト）と下の別名だけで、推測で県外と決めない（制約10）。
 */

const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', '..', 'data', 'station_names.json');

// 愛知県内の旧駅名・通称（駅名リストに無いため別に持つ）。値は根拠。
const AICHI_ALIASES = {
  '市役所': '名古屋城駅の旧名（2023年1月改称）',
  '中村区役所': '太閤通駅の旧名（2023年1月改称）',
  '伝馬町': '熱田神宮伝馬町駅の旧名（2023年1月改称）',
  '神宮西': '熱田神宮西駅の旧名（2023年1月改称）',
  '名古屋競馬場前': 'あおなみ線 港北駅の旧名（2023年改称）',
  '金山総合': '金山総合駅＝金山駅の通称',
  '新栄': '新栄町駅の通称',
  '名': '「名駅」＝名古屋駅の略称・地名（名古屋市中村区名駅）',
  '地下鉄東山': '「地下鉄東山駅」＝地下鉄東山線の駅の書き損じ（京都の東山駅と取り違えない）',
};

function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/嶋/g, '島')
    .replace(/曾/g, '曽')
    // 星ヶ丘・星ケ丘・星が丘、藤が丘・藤ヶ丘 などの表記ゆれを1つにする（漢字に挟まれたときだけ）
    .replace(/(?<=[一-鿿])[ケヶがガ](?=[一-鿿])/g, 'ヶ');
}

let cache = null;
function loadSets(file = DATA) {
  if (cache && cache.file === file) return cache;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const aichi = new Set();
  for (const n of j.aichi || []) {
    aichi.add(normalize(n));
    // 「大森・金城学院前」のような併記駅名は、区切った4文字以上の部分も県内とする
    if (n.includes('・')) for (const part of n.split('・')) if (part.length >= 4) aichi.add(normalize(part));
  }
  for (const a of Object.keys(AICHI_ALIASES)) aichi.add(normalize(a));
  const outside = new Set();
  for (const n of j.outsideAichiOnly || []) {
    const k = normalize(n);
    if (!aichi.has(k)) outside.add(k);
  }
  cache = { file, aichi, outside, source: j.source, fetchedAt: j.fetchedAt };
  return cache;
}

// 「駅」の直前の語。区切り記号（空白・句読点・矢印・中黒など）を越えない最短の連続部分
const TOKEN_RE = /([^\s、。,，:：;；/／・→⇒~～〜!！?？※*＊#＃■◆●◎○♪★☆|｜]+?)駅/g;

// 愛知県内にしか無い路線名。語にこれが入っていれば、駅名が県外の駅と同じ綴りでも県内とみなす
// （例: 「あおなみ線競馬場前」「名古屋ガイドウェイバス下島」）
const AICHI_LINE_MARKERS = [
  'あおなみ線', 'ガイドウェイバス', 'ゆとりーとライン', '名城線', '東山線', '鶴舞線', '桜通線', '名港線',
  '上飯田線', '名古屋市営', 'リニモ', '愛知環状鉄道', '城北線', '豊橋鉄道', '名鉄',
];

function extractStationTokens(access) {
  const text = normalize(access);
  const out = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    // 「神田(東京)」「黒川(愛知)」の括弧書きを外し、閉じていない括弧類は区切りとして扱う。
    // 「駅」の直前の区切りまでを語とする（「地下鉄「栄」駅」→ 栄、「…3丁目)(名駅」→ 名）
    const parts = m[1].replace(/\([^()]*\)/g, '').split(/[()「」『』〔〕《》≪≫<>【】\[\]"'`]/).filter(Boolean);
    const tok = parts.length ? parts[parts.length - 1] : '';
    if (tok) out.push({ raw: m[0], token: tok, context: m[1] });
  }
  return out;
}

function classifyToken(token, sets = loadSets(), context = token) {
  if (AICHI_LINE_MARKERS.some((l) => context.includes(l))) {
    return { kind: 'aichi', station: null, line: AICHI_LINE_MARKERS.find((l) => context.includes(l)) };
  }
  for (let i = 0; i < token.length; i++) {
    const suffix = token.slice(i);
    if (sets.aichi.has(suffix)) return { kind: 'aichi', station: suffix };
    if (sets.outside.has(suffix)) return { kind: 'outside', station: suffix };
  }
  return { kind: 'unknown', station: null };
}

// 表示用の駅名（旧駅名・通称・略称を今の駅名にそろえる。根拠は上の AICHI_ALIASES と同じ事実）。
// 「地下鉄東山」はどの駅かを決められないため null（数えない・推測で当てはめない）
const CANONICAL_STATION = {
  '市役所': '名古屋城', '中村区役所': '太閤通', '伝馬町': '熱田神宮伝馬町', '神宮西': '熱田神宮西',
  '名古屋競馬場前': '港北', '金山総合': '金山', '新栄': '新栄町', '名': '名古屋',
};
function canonicalStation(name) {
  if (name === '地下鉄東山') return null;
  return CANONICAL_STATION[name] || name;
}

/**
 * アクセス文に最初に出てくる愛知県内の駅名（駅名リストに載っている駅だけ・表示用の名前）。
 * 県外の駅名・バス停・書き損じは飛ばし、県内の駅が1つも無ければ null（SEO-124 のハブの表と最寄り駅）
 */
function firstAichiStation(access, sets = loadSets()) {
  for (const t of extractStationTokens(access)) {
    for (let i = 0; i < t.token.length; i++) {
      const suffix = t.token.slice(i);
      if (sets.aichi.has(suffix)) {
        const name = canonicalStation(suffix);
        if (name) return name;
        break;
      }
      if (sets.outside.has(suffix)) break;
    }
  }
  return null;
}

/** 1店のアクセス文を判定する。outside が1つでもあれば県外の疑い */
function auditAccess(access, sets = loadSets()) {
  const tokens = extractStationTokens(access).map((t) => ({ ...t, ...classifyToken(t.token, sets, t.context) }));
  return {
    tokens,
    outside: tokens.filter((t) => t.kind === 'outside'),
    unknown: tokens.filter((t) => t.kind === 'unknown'),
  };
}

module.exports = { AICHI_ALIASES, AICHI_LINE_MARKERS, normalize, loadSets, extractStationTokens, classifyToken, auditAccess, canonicalStation, firstAichiStation };
