#!/usr/bin/env node
// sitemap.xml に載っている全URLへ実際に HEAD リクエストを送り、
// 「200以外（404等）」「3xxリダイレクト」を検知する。
//
// 2026-08-19/08-08 に Search Console から「サイトマップ内のページがインデックスに
// 登録されない（要因: リダイレクト / 404）」の通知メールが届いたが、メール本文には
// 対象URLが載っておらず、GSC 側の履歴を人が画面で確認するまで検知できない状態だった。
// これは「気づけるはず」止まりで検知ではない（CLAUDE.md 無人監視の原則3）。
// 本スクリプトは自己申告ではなく実際のHTTPレスポンス（誰でも同じURLで検算できる事実）
// で判定し、CI（build.yml）に組み込むことで退行を毎日自動検知する（同原則1・2・5）。
//
// 使い方: node scripts/audit_sitemap_health.js [--check] [--concurrency N]
// --check: 異常があれば exit 1（CI向け）。無指定でも検出結果は表示するが exit 0。

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const SITEMAP = path.join(__dirname, '..', 'sitemap.xml');
const args = process.argv.slice(2);
const CHECK_MODE = args.includes('--check');
const concurrencyArgIdx = args.indexOf('--concurrency');
const CONCURRENCY = concurrencyArgIdx >= 0 ? parseInt(args[concurrencyArgIdx + 1], 10) : 20;
const TIMEOUT_MS = 15000;

function extractUrls(xml) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) urls.push(m[1].trim());
  return urls;
}

function headRequestOnce(url) {
  return new Promise((resolve) => {
    let settled = false;
    const req = https.request(url, { method: 'HEAD', timeout: TIMEOUT_MS }, (res) => {
      settled = true;
      const status = res.statusCode;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        resolve({ url, finalUrl: next, status, redirect: true });
        return;
      }
      res.resume();
      resolve({ url, finalUrl: url, status, redirect: false });
    });
    req.on('timeout', () => {
      if (!settled) { settled = true; req.destroy(); resolve({ url, status: 0, error: 'timeout' }); }
    });
    req.on('error', (err) => {
      if (!settled) { settled = true; resolve({ url, status: 0, error: err.message }); }
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// デプロイ直後の伝播遅延やCDNの一過性5xx/タイムアウトで false positive を出さないため、
// 200でも3xxでも「意図した4xx」でもない結果は最大2回まで再試行してから確定させる。
async function headRequest(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await headRequestOnce(url);
    const transient = last.status === 0 || (last.status >= 500 && last.status < 600);
    if (!transient) return last;
    if (attempt < 2) await sleep(1000 * (attempt + 1));
  }
  return last;
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function main() {
  if (!fs.existsSync(SITEMAP)) {
    console.error(`sitemap.xml が見つかりません: ${SITEMAP}`);
    process.exit(1);
  }
  const xml = fs.readFileSync(SITEMAP, 'utf8');
  const urls = extractUrls(xml);
  console.log(`sitemap.xml: ${urls.length} URL を検査します（並列数: ${CONCURRENCY}）...`);

  const results = await runPool(urls, headRequest, CONCURRENCY);

  const notFound = results.filter(r => r.status === 404);
  const otherError = results.filter(r => r.status !== 200 && r.status !== 404 && !r.redirect && r.status !== 0);
  const redirects = results.filter(r => r.redirect);
  const networkErrors = results.filter(r => r.status === 0);

  console.log('');
  console.log(`✅ 200 OK: ${results.length - notFound.length - otherError.length - redirects.length - networkErrors.length}`);

  if (redirects.length) {
    console.log(`\n⚠️  リダイレクト検出 (${redirects.length}件・GSCの「ページにリダイレクトがあります」原因候補):`);
    redirects.slice(0, 50).forEach(r => console.log(`  ${r.status} ${r.url} → ${r.finalUrl}`));
    if (redirects.length > 50) console.log(`  ... (+${redirects.length - 50} more)`);
  }
  if (notFound.length) {
    console.log(`\n❌ 404 検出 (${notFound.length}件・GSCの「見つかりませんでした（404）」原因候補):`);
    notFound.slice(0, 50).forEach(r => console.log(`  ${r.url}`));
    if (notFound.length > 50) console.log(`  ... (+${notFound.length - 50} more)`);
  }
  if (otherError.length) {
    console.log(`\n❌ その他異常ステータス (${otherError.length}件):`);
    otherError.slice(0, 50).forEach(r => console.log(`  ${r.status} ${r.url}`));
  }
  if (networkErrors.length) {
    console.log(`\n⚠️  ネットワークエラー/タイムアウト (${networkErrors.length}件・一過性の可能性あり):`);
    networkErrors.slice(0, 20).forEach(r => console.log(`  ${r.url} (${r.error})`));
  }

  const hardFailures = notFound.length + otherError.length + redirects.length;
  if (hardFailures === 0) {
    console.log('\n✅ sitemap.xml 全URL 正常（200・リダイレクトなし・404なし）');
  }

  if (CHECK_MODE && hardFailures > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
