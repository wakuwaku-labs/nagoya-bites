'use strict';
/**
 * scripts/lib/store_conditions.js — 「来店前に確かめたいこと」（追加料金・利用条件）の保存と表示（S2-2・基本方針の段階2）
 *
 * 背景: ホットペッパー グルメ API は料金備考（例「お通し代300円」）・備考・その他設備・貸切・お子様連れ・23時以降営業を
 * 返しているのに、build.js は捨てていた。お通し・席料・サービス料・貸切の条件は、来店前に知れないと
 * 「思っていた金額と違った」失敗になる。
 *
 * 決めたこと（根拠は docs/decisions/0070）:
 *   1. 文章は加工しない（リクルートWEBサービス利用規約「編集、加工、翻案その他の変更」の禁止）。空白の整理と前後の空白除去だけ。
 *      途中で切らない（切ると意味が変わる）。長すぎる文は保存も表示もしない（上限 MAX_LEN）。
 *   2. 分類しない・料金の数字を抜き出さない。原文のまま出所（ホットペッパー グルメ）と取得日を添える。
 *   3. 否定（なし・不可）は出さない。「お子様連れ：歓迎」のように「できる」と読める値だけ出す（store_facts と同じ方針）。
 *   4. 取得日は取得した日（JST）。24時間以内の更新が規約の既定なので、build が毎日取り直す。
 * 通信しない。
 */

const MAX_LEN = 400;

// 保存先の欄名 → API の項目名。文章の欄（text）と「できる」だけ出す欄（flag）
const FIELDS = [
  { key: '料金備考', api: 'budget_memo', kind: 'text', label: '料金の備考' },
  { key: '店舗備考', api: 'shop_detail_memo', kind: 'text', label: '店からの備考' },
  { key: 'その他設備', api: 'other_memo', kind: 'text', label: 'その他の設備' },
  { key: '貸切', api: 'charter', kind: 'flag', label: '貸切' },
  { key: 'お子様連れ', api: 'child', kind: 'flag', label: 'お子様連れ' },
  { key: '深夜営業', api: 'midnight', kind: 'flag', label: '23時以降の営業' },
];
const DATE_KEY = '条件取得日';

const tidy = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

function textValue(v) {
  const s = tidy(v);
  if (!s || s.length > MAX_LEN) return '';
  if (/^(なし|無し|無|-|－|ー)$/.test(s)) return '';
  return s;
}

// 「あり」「可」「歓迎」「営業している」のように「できる」と読める値だけ
function flagValue(v) {
  const s = tidy(v);
  if (!s || s.length > 60) return '';
  if (/^(なし|無し|無$)|不可|NG|ＮＧ|禁止|お断り|営業していない|できない/.test(s)) return '';
  return s;
}

/** API の店1件から、保存する欄を取り出す（空の欄は含めない） */
function conditionsFromShop(shop) {
  const out = {};
  for (const f of FIELDS) {
    const v = f.kind === 'text' ? textValue(shop && shop[f.api]) : flagValue(shop && shop[f.api]);
    if (v) out[f.key] = v;
  }
  return out;
}

/** 取得日（JST・YYYY-MM-DD） */
function todayJst(now) {
  const d = new Date((now ? now.getTime() : Date.now()) + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * 既存の店の行（Google Sheets 由来など）に、API から取れた欄を足す。ホットペッパーID で照合。
 * 取れなかった店（API に無い・全欄が空）は触らない＝元の値を残す。取れた店は欄を取り直す（店が消した条件を残さない）。
 * 戻り値: { matched, withAny, stats: { 欄名: 件数 } }
 */
function enrichConditions(stores, hpShops, date) {
  const byId = new Map();
  for (const sh of hpShops || []) if (sh && sh.id) byId.set(sh.id, sh);
  const stats = {};
  for (const f of FIELDS) stats[f.key] = 0;
  let matched = 0;
  let withAny = 0;
  for (const s of stores || []) {
    const id = s && s['ホットペッパーID'];
    const sh = id && byId.get(id);
    if (!sh) continue;
    matched++;
    for (const f of FIELDS) delete s[f.key];
    delete s[DATE_KEY];
    const c = conditionsFromShop(sh);
    const keys = Object.keys(c);
    if (!keys.length) continue;
    withAny++;
    Object.assign(s, c);
    s[DATE_KEY] = date;
    for (const k of keys) stats[k]++;
  }
  return { matched, withAny, stats };
}

/** 店舗ページに出す行。[{label, value}]。原文のまま */
function conditionRows(store) {
  const s = store || {};
  const rows = [];
  for (const f of FIELDS) {
    const v = f.kind === 'text' ? textValue(s[f.key]) : flagValue(s[f.key]);
    if (v) rows.push({ label: f.label, value: f.kind === 'flag' ? v : v });
  }
  return rows;
}

/** 「2026年11月16日取得」。形式が違えば '' */
function acquiredText(store) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String((store && store[DATE_KEY]) || ''));
  return m ? `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日取得` : '';
}

module.exports = { FIELDS, DATE_KEY, MAX_LEN, conditionsFromShop, enrichConditions, conditionRows, acquiredText, todayJst };
