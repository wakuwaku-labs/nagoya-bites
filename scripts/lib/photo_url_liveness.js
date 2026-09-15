#!/usr/bin/env node
/**
 * 写真URLの生死判定 — 唯一の判定器
 *
 * 【背景】
 * data/stores.json にキャッシュされた HotPepper 写真URL（imgfp.hotp.jp）の一部が、
 * CDN側で配信終了（404）していることが2026-09に判明した（DSN-006 作業中の実地確認）。
 * サンプル21件中4件（約19%）が404で、同じキャッシュURLは stores/*.html（店舗個別ページ）
 * や index.html のカードからも参照されるため、壊れた画像として既に露出している可能性が高い。
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力: 実際にURLへ発行したHTTPリクエストのステータスコードだけ。
 *   使わない入力: 「たぶん切れていそう」等、後から第三者が検算できない自己申告値。
 *
 * 【誤検知（オオカミ少年化）を避ける設計（ISSUE-084 原則6）】
 *   404/410 は「そのパスに何も無い」ことを示す確定的なステータスなので dead とみなす。
 *   403/5xx/タイムアウト/DNS失敗は「一時障害」「ホットリンク保護」等でも起こり得て、
 *   死んでいる証拠にならないため unknown とし、違反として報告しない。
 *   404/410 を観測しても、間隔を置いてもう一度確認できて初めて dead と確定する
 *   （単発の応答だけで店の写真を落とす判断はしない）。
 */
'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
// 確定的に「無い」と言えるステータスだけを dead 扱いにする。
const DEAD_STATUSES = new Set([404, 410]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requestOnce(url, method, timeoutMs) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { resolve({ error: 'invalid-url' }); return; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') { resolve({ error: 'unsupported-protocol' }); return; }
    const lib = u.protocol === 'http:' ? http : https;
    let settled = false;
    const req = lib.request(
      u,
      { method, timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NagoyaBitesPhotoAudit/1.0)' } },
      (res) => {
        res.resume(); // ボディは不要（生死判定はステータスのみで行う）
        if (settled) return;
        settled = true;
        resolve({ status: res.statusCode, location: res.headers.location || '' });
      }
    );
    req.on('timeout', () => { if (settled) return; settled = true; req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', (e) => { if (settled) return; settled = true; resolve({ error: e.code || e.message || 'error' }); });
    req.end();
  });
}

/**
 * リダイレクトを追ってHEAD（不可ならGET）で1回だけ確認する。
 * @returns {{status?:number, error?:string}}
 */
async function checkUrl(url, opts = {}) {
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let r = await requestOnce(current, 'HEAD', timeoutMs);
    // 一部CDNはHEADを許可しない（405/501）→ GETで取り直す
    if (r.status === 405 || r.status === 501 || r.error) {
      r = await requestOnce(current, 'GET', timeoutMs);
    }
    if (r.status && r.status >= 300 && r.status < 400 && r.location) {
      try { current = new URL(r.location, current).toString(); continue; } catch { return { error: 'bad-redirect' }; }
    }
    return r;
  }
  return { error: 'too-many-redirects' };
}

/**
 * 404/410を2回連続で観測できたときだけ dead と確定する。
 * 単発のタイムアウト・5xx・403は unknown とし、違反扱いにしない。
 * @returns {Promise<{verdict:'ok'|'dead'|'unknown', status?:number, error?:string}>}
 */
async function judgeLiveness(url, opts = {}) {
  if (!url) return { verdict: 'unknown', error: 'empty-url' };
  const r1 = await checkUrl(url, opts);
  if (r1.status && DEAD_STATUSES.has(r1.status)) {
    await sleep(opts.retryDelayMs != null ? opts.retryDelayMs : 1500);
    const r2 = await checkUrl(url, opts);
    if (r2.status && DEAD_STATUSES.has(r2.status)) return { verdict: 'dead', status: r2.status };
    if (r2.status) return { verdict: 'ok', status: r2.status };
    return { verdict: 'unknown', error: r2.error };
  }
  if (r1.status) return { verdict: 'ok', status: r1.status };
  return { verdict: 'unknown', error: r1.error };
}

/** 固定並列数で items を処理する（結果は入力順） */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

/** 写真URLのホストから出所を分類する（レポートの内訳・原因切り分け用） */
function classifyHost(url) {
  const u = String(url || '');
  if (/imgfp\.hotp\.jp/.test(u)) return 'hotpepper';
  if (/googleusercontent\.com/.test(u)) return 'places';
  if (!u) return 'empty';
  return 'other';
}

module.exports = { checkUrl, judgeLiveness, mapWithConcurrency, classifyHost, DEAD_STATUSES };
