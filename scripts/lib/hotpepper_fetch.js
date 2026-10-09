'use strict';
/**
 * HotPepper グルメサーチ API から、中エリアの店を取りこぼさずに取る（ISSUE-143）。
 *
 * 日次ビルドのたびに HotPepper 由来の店が出入りしていた（2026-09-24〜10-05 に43件が消え94件が増えた）。
 * 原因は取得処理の2つの取りこぼし:
 *  1. 1つの中エリアは 1,000件（start=901 の100件）までしか取っていなかった。
 *     名古屋（名古屋駅/西区/中村区）Y200 は毎回ちょうど1,000件で止まっていた（2026-10-09 の CI ログ）。
 *     並びは既定の「おススメ順」で、HotPepper が定期的に並べ替えるため（API リファレンス）、
 *     1,000件の境目にいる店が日ごとに入れ替わる。
 *     → 件数（results_available）が上限を超える中エリアは、小エリアごとに取り直して足す
 *  2. API はエラーでも HTTP 200 を返し、本文の results.error で知らせる（API リファレンス）。
 *     旧実装はこれを「0件」として読み、そのエリアの残りのページを黙って打ち切っていた。
 *     → エラーとして扱って数回やり直し、それでも取れなければ記録に残す（取れた分は使う）
 *
 * 判定に使うのは API が返す件数（results_available）と取れた店の ID だけ（制約10）。
 * fetchJson と sleep を差し替えられるので、API キーの無い手元でもテストできる。
 */

const CAP = 1000;          // 1つの検索で取りに行く上限（start=901 の100件まで）
const PAGE = 100;          // count の最大
const RETRIES = 2;         // 失敗した呼び出しのやり直し回数
const WAITS_MS = [1000, 3000];
const MAX_SMALL_AREAS = 60; // 小エリアの一覧がこれより多ければ絞り込みが効いていないとみなして使わない
const STOP_AFTER_FAILED_PAGES = 2; // 続けてこのページ数だけ取れなければ、その検索をやめる

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redact(message, apiKey) {
  let s = String(message == null ? '' : message);
  if (apiKey) s = s.split(apiKey).join('***');
  return s.replace(/key=[^&\s]+/g, 'key=***');
}

function options(deps = {}) {
  return {
    fetchJson: deps.fetchJson,
    base: deps.base || 'https://webservice.recruit.co.jp/hotpepper',
    apiKey: deps.apiKey || '',
    sleep: deps.sleep || defaultSleep,
    retries: deps.retries == null ? RETRIES : deps.retries,
    waits: deps.waits || WAITS_MS,
  };
}

/** API の応答から results を取り出す。results.error はエラーとして投げる */
function resultsOf(data) {
  const r = data && data.results;
  if (!r) throw new Error('results の無い応答');
  if (r.error) {
    const e = Array.isArray(r.error) ? r.error[0] : r.error;
    throw new Error(`API エラー ${e && e.code}: ${e && e.message}`);
  }
  return r;
}

async function withRetry(fn, o) {
  let last;
  for (let i = 0; i <= o.retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < o.retries) await o.sleep(o.waits[Math.min(i, o.waits.length - 1)]);
    }
  }
  throw last;
}

function gourmetUrl(o, query, start) {
  const q = Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${o.base}/gourmet/v1/?key=${o.apiKey}&${q}&format=json&count=${PAGE}&start=${start}`;
}

/**
 * 1つの検索（中エリアか小エリア）を start=1 から上限まで順に取る。
 * 戻り値: { shops, available, errors, pages }
 */
async function pageThrough(query, label, deps) {
  const o = options(deps);
  const shops = [];
  const errors = [];
  let available = null;
  let pages = 0;
  let failedInRow = 0;
  for (let start = 1; start <= CAP - PAGE + 1; start += PAGE) {
    if (available != null && start > available) break;
    let r;
    try {
      r = await withRetry(async () => resultsOf(await o.fetchJson(gourmetUrl(o, query, start))), o);
    } catch (e) {
      errors.push(`${label} start=${start}: ${redact(e.message, o.apiKey)}`);
      if (++failedInRow >= STOP_AFTER_FAILED_PAGES) break;
      continue;
    }
    failedInRow = 0;
    pages++;
    const n = Number(r.results_available);
    if (Number.isFinite(n)) available = n;
    const arr = Array.isArray(r.shop) ? r.shop : [];
    shops.push(...arr);
    if (arr.length < PAGE) break;
  }
  return { shops, available, errors, pages };
}

/** 中エリアに属する小エリアの一覧（小エリアマスタ API は middle_area で絞り込める） */
async function fetchSmallAreas(middleCode, deps) {
  const o = options(deps);
  const url = `${o.base}/small_area/v1/?key=${o.apiKey}&middle_area=${encodeURIComponent(middleCode)}&format=json`;
  const r = await withRetry(async () => resultsOf(await o.fetchJson(url)), o);
  const list = Array.isArray(r.small_area) ? r.small_area : [];
  return list
    .filter((sa) => sa && sa.code && (!sa.middle_area || sa.middle_area.code === middleCode))
    .map((sa) => ({ code: sa.code, name: sa.name || sa.code }));
}

/**
 * 中エリアの店をすべて取る。件数が上限を超えるときは小エリアごとに取り直して足す
 * （中エリアで取れた1,000件は先頭に残し、並びを変えない）。
 * 戻り値: { shops, record }。record はその回の取得の事実（件数・取れた数・足りない数・エラー）
 */
async function fetchMiddleArea(area, deps) {
  const o = options(deps);
  const mid = await pageThrough({ middle_area: area.code }, area.name, deps);
  const byId = new Map();
  const add = (list) => { for (const s of list) if (s && s.id && !byId.has(s.id)) byId.set(s.id, s); };
  add(mid.shops);
  const record = {
    code: area.code,
    name: area.name,
    available: mid.available,
    viaMiddleArea: byId.size,
    smallAreas: 0,
    errors: [...mid.errors],
  };
  if (mid.available != null && mid.available > CAP) {
    let smalls = [];
    try {
      smalls = await fetchSmallAreas(area.code, deps);
    } catch (e) {
      record.errors.push(`${area.name} 小エリアの一覧: ${redact(e.message, o.apiKey)}`);
    }
    if (smalls.length > MAX_SMALL_AREAS) {
      record.errors.push(`${area.name} 小エリアが ${smalls.length} 件あり絞り込みが効いていないため使わない`);
      smalls = [];
    }
    record.smallAreas = smalls.length;
    for (const sa of smalls) {
      const r = await pageThrough({ small_area: sa.code }, `${area.name}/${sa.name}`, deps);
      add(r.shops);
      record.errors.push(...r.errors);
      if (r.available != null && r.available > CAP) record.errors.push(`${area.name}/${sa.name} も ${r.available} 件で上限を超える`);
    }
  }
  record.fetched = byId.size;
  record.missing = record.available == null ? null : Math.max(0, record.available - byId.size);
  return { shops: [...byId.values()], record };
}

/** 取得の記録（data/hotpepper_fetch_log.json）に1回分を足す。古い回は keep 件を残して捨てる */
function appendRun(log, run, keep = 30) {
  const runs = Array.isArray(log && log.runs) ? log.runs.slice() : [];
  runs.push(run);
  return { ...(log || {}), runs: runs.slice(-keep) };
}

/**
 * 最新の回の取りこぼしを数える（純関数）。
 * tolerance: 件数（results_available）との差をどこまで許すか（並び替え・取得中の増減の分）
 */
function shortfalls(run, { tolerance = 0.02 } = {}) {
  const out = [];
  for (const a of (run && run.areas) || []) {
    const reasons = [];
    if (a.errors && a.errors.length) reasons.push(`エラー ${a.errors.length} 件`);
    if (a.available != null && a.fetched < a.available * (1 - tolerance)) reasons.push(`件数 ${a.available} に対し ${a.fetched} 件`);
    if (reasons.length) out.push({ code: a.code, name: a.name, reasons });
  }
  return out;
}

module.exports = {
  CAP, PAGE, RETRIES, MAX_SMALL_AREAS, STOP_AFTER_FAILED_PAGES,
  redact, resultsOf, pageThrough, fetchSmallAreas, fetchMiddleArea, appendRun, shortfalls,
};
