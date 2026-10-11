'use strict';
/**
 * scripts/lib/store_count.js — サイト全体の掲載店数の表記の唯一の情報源（I-06 / P-272）
 *
 * 背景: 掲載店数がページごとに別の値で書かれていた（2026-10-12 の調査）。トップ 5,000軒／4,500軒以上、
 * stores/index.html 4,584店、特集 4,559店舗・4,910店・4,664店、faq.html 1,000軒以上、ジャーナル冒頭の
 * 紹介文 1,100店超、構造化データの numberOfItems 4559／4584。店数は書いた時点から古くなるため、
 * 手で直すたびに別の値が残る。過去の特集の「全4,559店舗を検索する」は、生成側の雛形が数字を外した後も
 * 既存のページに残っていた。
 *
 * 決めたこと（判断の記録: docs/decisions/0021-store-count-notation.md）:
 *   - 数えるのは「営業中の店」（閉店・休業を除く。llms.txt とエリア×ジャンルのハブと同じ定義＝openStores）
 *   - 文章に書く数は 500 件単位に丸めて「約5,000」と書く。毎日 ±数件動いても書き換えが起きない
 *   - 正確な数は、一覧・内訳・統計（llms.txt のエリア別内訳・ハブの掲載軒数など）にだけ出す
 *   - 過去の記事が「当時の数」を言っている文と、ジャンル・エリアごとの件数は触らない
 *
 * このファイルは、値の算出（siteStoreCount）と、静的な文面の数字をそろえる純粋な関数
 * （syncStoreCountText）を持つ。生成器（gen_llms_txt.js・add_journal_site_intro.js）と
 * scripts/sync_store_count.js と tests/store_count.test.js が共有する。ネットワーク不要・決定的。
 */

const { loadStores } = require('./load_stores');
const { openStores } = require('./area_genre_pages');

/** 丸めの単位（件）。見直す条件は docs/decisions/0021 */
const ROUND_UNIT = 500;

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

/** 件数を ROUND_UNIT 件単位の最も近い値に丸める（4,750〜5,249 → 5,000。ちょうど真ん中は上へ） */
function roundStoreCount(n, unit = ROUND_UNIT) {
  if (!Number.isFinite(n) || n < 0) throw new Error(`roundStoreCount: 件数が不正です: ${n}`);
  return Math.round(n / unit) * unit;
}

/**
 * サイト全体の掲載店数。
 * @param {Array<object>} [stores] data/stores.json 相当。省略時は loadStores()
 * @returns {{exact:number, rounded:number, number:string, label:string}}
 *   exact: 営業中の店の正確な数 / rounded: 丸めた数 / number: "5,000" / label: "約5,000"
 */
function siteStoreCount(stores) {
  const exact = openStores(stores || loadStores()).length;
  const rounded = roundStoreCount(exact);
  return { exact, rounded, number: formatNumber(rounded), label: `約${formatNumber(rounded)}` };
}

// ================================================================
// 静的な文面の数字をそろえる
//   書き換えるのは「店数の表記」の数字の部分だけ（文の言い回しは変えない）。対象は次の3つに限る。
//   (1) 過去にサイト全体の掲載数として書かれた値（scope.legacy）に、店・店舗・軒が続くもの
//   (2) このスクリプト自身が入れた「約N」（N は 500 の倍数）。丸めた値が変わった日に追随するため
//   (3) 構造化データの "numberOfItems"（scope.itemCount が真のファイルだけ・1,000 以上のとき）
//   (4) トップの権威性バー <span id="auth-total"> の静的な数字（scope.authTotal が真のファイルだけ。実行時は JS が上書きする）
//   触らないもの: 「2026年5月時点で4,584店」のような日付つきの数（当時の事実）、ジャンル・エリアごとの件数、
//   記事が実測した母数（「掲載4,768店の営業時間を実測」）、legacy に無い値。
// ================================================================

const COUNTER = '(?:店舗|店|軒)';
// 数字（桁区切りあり・なし）。直前が数字・桁区切り・小数点でないもの
const NUM = '(?<![\\d,.])(\\d{1,3}(?:,\\d{3})+|\\d{4,5})';
// 約 + 数字 + 空白（半角1つまで）+ 単位 + 以上/超
const TOKEN_SOURCE = `(約)?${NUM}(\\s?)(${COUNTER})(以上|超)?`;
const ITEM_COUNT_RE = /("numberOfItems"\s*:\s*)(\d{4,5})(?=\s*(?:[,}]|$))/g;
// トップの権威性バーの数字（<span id="auth-total">4,559</span>店）。表示のときは index.html の loadStores() が
// 実データの件数で上書きするので、ここに書かれているのは JS を実行しないクローラ・初回描画が見る値。
// 丸めた数字（約なし）にそろえる。表示される桁数が変わらないので、上書きされても幅は動かない
const AUTH_TOTAL_RE = /((?<![\w-])id="auth-total"[^>]*>)(\d{1,3}(?:,\d{3})+|\d{4,5})(?=<)/g;

// トップページへの導線の文。生成側の雛形（scripts/add_related_features.js）は数字を持たない言い方に直してあるので、
// 既存のページもそれにそろえる（数字を外せば、店数が変わっても直す必要が無い）
const ALIGN_RULES = [
  { id: 'back-to-top-cta', re: /トップページで全(?:約)?[\d,]+店舗を検索する/g, to: 'トップページで全店舗を検索する' },
];

/** 数字の直前がこれで終わるものは、日付つきの数（当時の事実）として触らない */
const DATED_BEFORE = /(?:時点で|現在で|現在、)$/;

/**
 * @typedef {object} Scope
 * @property {string} id
 * @property {Set<number>} legacy  過去にサイト全体の掲載数として書かれた値
 * @property {boolean} [itemCount]  構造化データの numberOfItems もそろえる
 * @property {boolean} [authTotal]  権威性バー（id="auth-total"）の静的な数字もそろえる
 * @property {boolean} [align]      ALIGN_RULES も適用する
 * @property {RegExp} [region]      この範囲の中だけを対象にする（g フラグ）。省略時はファイル全体
 */

/** @type {Record<string, Scope & {files:string[]|{dir:string, ext:string}}>} */
const SCOPES = {
  index: { id: 'index', files: ['index.html'], legacy: new Set([4500, 4559, 4584, 5000]), itemCount: true, authTotal: true },
  'stores-index': { id: 'stores-index', files: ['stores/index.html'], legacy: new Set([4500, 4559, 4584, 5000]), itemCount: true },
  faq: { id: 'faq', files: ['faq.html'], legacy: new Set([1000]) },
  features: { id: 'features', files: { dir: 'features', ext: '.html' }, legacy: new Set([4500, 4559, 4584, 4664, 4910, 5000]), align: true },
  // ジャーナルは記事の冒頭の紹介文（scripts/add_journal_site_intro.js）だけ。本文の数（実測した母数）は触らない
  journal: { id: 'journal', files: { dir: 'journal', ext: '.html' }, legacy: new Set([1100]), region: /<p class="nb-site-intro">[\s\S]*?<\/p>/g },
};

/** 1行がこれより長いものは対象にしない（index.html の var LOCAL_STORES = [...] など、データを埋めた行） */
const MAX_LINE_LENGTH = 20000;

function isManagedValue(value, hasYaku, scope) {
  if (scope.legacy.has(value)) return true;
  // このスクリプトが入れた「約N」（N は丸めの単位の倍数）
  return hasYaku && value >= 1000 && value % ROUND_UNIT === 0;
}

function applyTokens(chunk, scope, count, log) {
  const re = new RegExp(TOKEN_SOURCE, 'g');
  return chunk.replace(re, (m, yaku, numStr, sp, counter, qual, offset, whole) => {
    const value = parseInt(numStr.replace(/,/g, ''), 10);
    if (!isManagedValue(value, !!yaku, scope)) return m;
    if (DATED_BEFORE.test(whole.slice(Math.max(0, offset - 4), offset))) return m;
    const next = `${count.label}${sp}${counter}`;
    if (next !== m) log.push({ kind: 'token', from: m, to: next });
    return next;
  });
}

function applyLines(text, fn) {
  return text.split('\n').map((line) => (line.length > MAX_LINE_LENGTH ? line : fn(line))).join('\n');
}

/**
 * 1つのファイルの本文の、店数の表記をそろえる。
 * @param {string} text
 * @param {Scope} scope
 * @param {{rounded:number, label:string}} count  siteStoreCount() の戻り値
 * @returns {{text:string, changes:Array<{kind:string, from:string, to:string}>}}
 */
function syncStoreCountText(text, scope, count) {
  const changes = [];
  let out = text;
  // 数字を外す書き換えを先に行う（先に数字をそろえると、外す前の「全約5,000店舗」を経由してしまう）
  if (scope.align) {
    for (const rule of ALIGN_RULES) {
      out = out.replace(rule.re, (m) => {
        if (m !== rule.to) changes.push({ kind: 'align', from: m, to: rule.to });
        return rule.to;
      });
    }
  }
  const fixTokens = (chunk) => applyLines(chunk, (line) => applyTokens(line, scope, count, changes));
  out = scope.region ? out.replace(scope.region, (m) => fixTokens(m)) : fixTokens(out);
  if (scope.itemCount) {
    out = applyLines(out, (line) => line.replace(ITEM_COUNT_RE, (m, head, num) => {
      if (String(count.rounded) !== num) changes.push({ kind: 'itemCount', from: `numberOfItems ${num}`, to: `numberOfItems ${count.rounded}` });
      return `${head}${count.rounded}`;
    }));
  }
  if (scope.authTotal) {
    out = applyLines(out, (line) => line.replace(AUTH_TOTAL_RE, (m, head, num) => {
      if (count.number !== num) changes.push({ kind: 'authTotal', from: `auth-total ${num}`, to: `auth-total ${count.number}` });
      return `${head}${count.number}`;
    }));
  }
  return { text: out, changes };
}

/**
 * 「N店/N軒/N店舗」と書かれた 1,000 以上の数のうち、同期の対象でも例外でもないもの（人が見て判断する）。
 * 戻り値は { token, dated, context }。dated が真のものは日付つきの数（当時の事実）で、触らずに残している。
 */
function findUnmanagedTokens(text, scope) {
  const out = [];
  const re = new RegExp(TOKEN_SOURCE, 'g');
  const scan = scope.region ? (text.match(scope.region) || []).join('\n') : text;
  for (const line of scan.split('\n')) {
    if (line.length > MAX_LINE_LENGTH) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const value = parseInt(m[2].replace(/,/g, ''), 10);
      if (value < 1000) continue;
      const dated = DATED_BEFORE.test(line.slice(Math.max(0, m.index - 4), m.index));
      if (!dated && isManagedValue(value, !!m[1], scope)) continue;
      out.push({ token: m[0], dated, context: line.slice(Math.max(0, m.index - 18), m.index + m[0].length + 14).trim() });
    }
  }
  return out;
}

module.exports = {
  ROUND_UNIT,
  SCOPES,
  ALIGN_RULES,
  formatNumber,
  roundStoreCount,
  siteStoreCount,
  syncStoreCountText,
  findUnmanagedTokens,
};
