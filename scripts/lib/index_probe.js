'use strict';
/**
 * scripts/lib/index_probe.js — 「検索エンジンに登録されているか」の日次観測の純関数部（P-437）
 *
 * Search Console の URL 検査 API は 1 URL ずつしか引けない（一括でインデックス登録数は出ない）。
 * そこで「見たい面を代表する URL の見本」を決め打ちし、毎日同じ見本を引いて、
 * 面ごと（グループごと）の「登録されている割合」と「最近クロールされた割合」を履歴に残す。
 * 判定は API が返した事実（verdict・coverageState・lastCrawlTime）だけで行う（制約10）。
 * 認証・通信は scripts/probe_index_status.js 側に置き、ここは通信なしで検算できる部分だけを持つ。
 */
const crypto = require('crypto');

const HISTORY_DAYS = 120;
const CRAWL_RECENT_DAYS = 7;

/** URL の並びを、日付や実行順に依らず決まる順（sha1 の昇順）にする */
function stableOrder(urls) {
  return urls.slice().sort((a, b) => {
    const ha = crypto.createHash('sha1').update(a).digest('hex');
    const hb = crypto.createHash('sha1').update(b).digest('hex');
    return ha < hb ? -1 : ha > hb ? 1 : a < b ? -1 : 1;
  });
}

/** 重複を除き、stableOrder で先頭から n 件。exclude に入る URL は選ばない */
function pickSample(urls, n, exclude) {
  const ex = new Set(exclude || []);
  const seen = new Set();
  const uniq = [];
  for (const u of urls || []) {
    if (!u || ex.has(u) || seen.has(u)) continue;
    seen.add(u);
    uniq.push(u);
  }
  return stableOrder(uniq).slice(0, Math.max(0, n));
}

/** URL 検査 API の応答（data）から、残す事実だけを取り出す。読めなければ null */
function summarizeInspection(data) {
  const r = data && data.inspectionResult && data.inspectionResult.indexStatusResult;
  if (!r || typeof r !== 'object') return null;
  return {
    verdict: String(r.verdict || 'VERDICT_UNSPECIFIED'),
    coverageState: String(r.coverageState || ''),
    lastCrawlTime: r.lastCrawlTime || null,
    pageFetchState: r.pageFetchState || null,
    googleCanonical: r.googleCanonical || null,
  };
}

/** 登録されている（検索結果に出せる）＝ verdict が PASS */
function isIndexed(row) { return !!row && row.verdict === 'PASS'; }

function isCrawledRecently(row, nowMs) {
  if (!row || !row.lastCrawlTime) return false;
  const t = Date.parse(row.lastCrawlTime);
  return Number.isFinite(t) && nowMs - t <= CRAWL_RECENT_DAYS * 86400000;
}

/**
 * 面（group）ごとの集計。引けなかった URL（error）は分母から外して別に数える
 * （引けなかったことを「登録されていない」と数えない）。
 * @param {Object} urls { url: { group, verdict, coverageState, lastCrawlTime, error? } }
 */
function summarizeGroups(urls, nowMs) {
  const out = {};
  for (const row of Object.values(urls || {})) {
    const g = out[row.group] || (out[row.group] = { inspected: 0, errors: 0, indexed: 0, crawledRecently: 0, byState: {} });
    if (row.error) { g.errors += 1; continue; }
    g.inspected += 1;
    if (isIndexed(row)) g.indexed += 1;
    if (isCrawledRecently(row, nowMs)) g.crawledRecently += 1;
    const s = row.coverageState || '(不明)';
    g.byState[s] = (g.byState[s] || 0) + 1;
  }
  return out;
}

/** 履歴に今日の行を入れる（同じ日は置き換え）。古いものは HISTORY_DAYS で切る */
function updateHistory(history, date, groups) {
  const h = (history || []).filter((x) => x && x.date !== date);
  h.push({ date, groups });
  h.sort((a, b) => (a.date < b.date ? -1 : 1));
  const cutoff = new Date(Date.parse(date) - HISTORY_DAYS * 86400000).toISOString().slice(0, 10);
  return h.filter((x) => x.date >= cutoff);
}

/** 履歴の 1 日分で、引けた（取得失敗でない）URL の数 */
function totalInspected(groups) {
  return Object.values(groups || {}).reduce((n, g) => n + ((g && g.inspected) || 0), 0);
}

/**
 * その日の観測が済んでいるか。見本の数（expected）の COMPLETE_RATIO 以上を引けていれば済み。
 * 日次ビルドはマージのたびにも走る。毎回引き直すと URL 検査 API の 1 日の上限（2,000 件）を使い切り、
 * 上限に当たった回の少ない結果が、同じ日の全件の結果を置き換えていた（2026-10-14 の行は 251 件中 15 件）
 */
const COMPLETE_RATIO = 0.9;
function isDayComplete(history, date, expected) {
  const row = (history || []).find((x) => x && x.date === date);
  if (!row || !(expected > 0)) return false;
  return totalInspected(row.groups) >= Math.ceil(expected * COMPLETE_RATIO);
}

/** 同じ日の行を置き換えてよいか。前より多く引けたときだけ（上限に当たった回が全件の行を消さない） */
function shouldReplaceDay(history, date, groups) {
  const row = (history || []).find((x) => x && x.date === date);
  if (!row) return true;
  return totalInspected(groups) > totalInspected(row.groups);
}

/**
 * 面（group）を順番に 1 件ずつ回す順にする。時間切れで途中までしか引けなくても、
 * 全部の面から同じ割合で引けているようにする（先頭の面だけが引かれて他が空になるのを防ぐ）。
 * @param {Object} groups { group: [url...] }
 * @returns {Array} [{ group, url }]
 */
function interleave(groups) {
  const names = Object.keys(groups || {});
  const out = [];
  const max = Math.max(0, ...names.map((g) => (groups[g] || []).length));
  for (let i = 0; i < max; i++) {
    for (const g of names) if (groups[g] && i < groups[g].length) out.push({ group: g, url: groups[g][i] });
  }
  return out;
}

module.exports = { interleave, HISTORY_DAYS, CRAWL_RECENT_DAYS, stableOrder, pickSample, summarizeInspection, isIndexed, isCrawledRecently, summarizeGroups, updateHistory, totalInspected, isDayComplete, shouldReplaceDay, COMPLETE_RATIO };
