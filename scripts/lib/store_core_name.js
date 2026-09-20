#!/usr/bin/env node
/**
 * 店名の正規化 — 「検索に投げる名前」を作る唯一の情報源
 *
 * 店名には媒体ごとに装飾が付く（「完全個室居酒屋 哉月」「割烹 季節料理 花わさび」）。
 * 外部サイトの検索に丸ごと投げるとヒットしないことがあるため、
 *   cleanStoreName() … 読みがな・【】・装飾を落とす
 *   coreStoreName()  … さらに業態語（居酒屋/焼肉/割烹…）と支店サフィックスを落として
 *                      固有名詞だけにする
 * の2段で用意する。
 *
 * 元は scripts/resolve_tabelog.js の中に閉じていたが、
 * scripts/resolve_manual_tabelog_links.js でも同じ正規化が必要になったため切り出した
 * （同じ目的の名前正規化を2本持つと、片方だけ直して食い違う事故になる）。
 */
'use strict';

// ─── 店名クリーンアップ ────────────────────────────────────────────────
function cleanStoreName(name) {
  if (!name) return '';
  let s = String(name);
  s = s.replace(/[（(]\s*[\u3040-\u309F\u30A0-\u30FFー]+\s*[）)]/g, ' ');
  s = s.replace(/[\-－‐‑–—]\s*[\u3040-\u309F\u30A0-\u30FFー]+\s*[\-－‐‑–—]/g, ' ');
  s = s.replace(/【[^】]*】/g, ' ');
  let tokens = s.split(/[\s\u3000]+/).filter(Boolean);
  const isHira = (t) => /^[\u3040-\u309Fー]+$/.test(t);
  const isKanji = (t) => /^[\u4E00-\u9FFF々]+$/.test(t);
  while (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const prev = tokens[tokens.length - 2];
    if (
      isHira(last) && isKanji(prev) &&
      prev.length >= 1 && prev.length <= 5 &&
      last.length >= prev.length * 1.5
    ) {
      tokens.pop();
    } else break;
  }
  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}

const GENERIC_PREFIXES = new Set([
  '居酒屋','個室居酒屋','完全個室居酒屋','完全個室','個室','全室個室','全席個室','全席完全個室',
  '海鮮居酒屋','やきとん居酒屋','焼肉ホルモン','焼肉','焼鳥','焼き鳥','やきとり','炭火焼','炭火焼鳥',
  '串焼','串焼き','鉄板焼','鉄板焼き','お好み焼','もんじゃ','和食','新和食','割烹','寿司','鮨','すし',
  '魚介','海鮮','海鮮料理','肉','肉バル','バル','バー','カフェ','レストラン','ビストロ','ダイニング','ダイニングバー',
  '韓国料理','韓国','中華','中華料理','イタリアン','イタリア料理','フレンチ','フランス料理','スペイン料理',
  'タイ料理','ベトナム料理','エスニック','もつ鍋','しゃぶしゃぶ','すきやき','鍋','水炊き','餃子','ラーメン','つけ麺',
  'そば','うどん','定食','食堂','ステーキ','ハンバーグ','ピザ','パスタ','チーズ','ワイン','ワインバー','日本酒',
  '焼酎','クラフトビール','ビアバー','貸切','水槽個室','全室水槽個室','プライベート個室','完全分煙','個室完備',
  '新規開店','完全予約制','飲み放題','食べ飲み放題','食べ放題','飲食店',
]);

function isLocationSuffix(t) {
  if (/店$/.test(t) && t.length >= 2) return true;
  if (/号店$/.test(t) || /号館$/.test(t)) return true;
  if (/^(本店|総本店|別館|新館|分店|別邸)$/.test(t)) return true;
  return false;
}

function coreStoreName(name) {
  const s = cleanStoreName(name);
  if (!s) return '';
  const tokens = s.split(/[\s\u3000]+/).filter(Boolean);
  const filtered = tokens.filter(t => !GENERIC_PREFIXES.has(t) && !isLocationSuffix(t));
  if (filtered.length === 0) return s;
  return filtered.join(' ').trim();
}

module.exports = { cleanStoreName, coreStoreName, isLocationSuffix, GENERIC_PREFIXES };
