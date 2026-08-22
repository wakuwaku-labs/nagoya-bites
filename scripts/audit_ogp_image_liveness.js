#!/usr/bin/env node
// features/*.html・journal/*.html の og:image が実際にHTTP到達可能か（生死）を検査する。
//
// scripts/normalize_og_images.js --check は og:image の「構造」（絶対URLか・SVGでないか・
// width/heightが付いているか）は検査するが、そのURLが実際に配信されているかは見ていない。
// HotPepperの画像CDN（imgfp.hotp.jp）は個別の写真URLが将来的に無効化されうるため、構造的には
// 正しいog:imageでも実配信が止まっているケースを見逃す（ISSUE-114で実際に3件の404を発見）。
// この不具合はサイトの見た目には異常が出ず、オーナーが実際にSNSで共有するまで誰も気づかない
// （CLAUDE.md 無人自動化の監視原則3）。audit_sitemap_health.js と同じ「実HTTPレスポンスで
// 判定する（検証できる事実だけを使う・制約10）」方針を、og:imageに絞って適用する。
//
// 使い方: node scripts/audit_ogp_image_liveness.js [--check] [--concurrency N]
// --check: 404等の異常があれば exit 1（CI向け）。無指定でも検出結果は表示するが exit 0。

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['features', 'journal'];
const args = process.argv.slice(2);
const CHECK_MODE = args.includes('--check');
const concurrencyArgIdx = args.indexOf('--concurrency');
const CONCURRENCY = concurrencyArgIdx >= 0 ? parseInt(args[concurrencyArgIdx + 1], 10) : 10;
const TIMEOUT_MS = 15000;

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.html') && f !== '_template.html')
    .map((f) => path.join(dir, f));
}

function extractOgImage(rel) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const m = html.match(/<meta property="og:image" content="([^"]+)"/);
  return m ? m[1] : null;
}

function headRequestOnce(url) {
  return new Promise((resolve) => {
    let settled = false;
    let req;
    try {
      req = https.request(url, { method: 'HEAD', timeout: TIMEOUT_MS }, (res) => {
        settled = true;
        res.resume();
        resolve({ url, status: res.statusCode });
      });
    } catch (err) {
      resolve({ url, status: 0, error: err.message });
      return;
    }
    req.on('timeout', () => {
      if (!settled) { settled = true; req.destroy(); resolve({ url, status: 0, error: 'timeout' }); }
    });
    req.on('error', (err) => {
      if (!settled) { settled = true; resolve({ url, status: 0, error: err.message }); }
    });
    req.end();
  });
}

// デプロイ直後の伝播遅延・CDNの一過性5xxで false positive を出さないため最大2回再試行する。
async function headRequest(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await headRequestOnce(url);
    const transient = last.status === 0 || (last.status >= 500 && last.status < 600);
    if (!transient) return last;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
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
  const files = TARGET_DIRS.flatMap(listHtml);
  const rows = [];
  for (const rel of files) {
    const url = extractOgImage(rel);
    if (!url) continue;
    if (!url.startsWith('http')) {
      rows.push({ file: rel, url, status: 0, error: 'relative-url' });
      continue;
    }
    rows.push({ file: rel, url });
  }

  const toCheck = rows.filter((r) => !r.error);
  console.log(`og:image ${toCheck.length}件（relative-url ${rows.length - toCheck.length}件は対象外）を検査します（並列数: ${CONCURRENCY}）...`);

  const results = await runPool(toCheck, (r) => headRequest(r.url), CONCURRENCY);
  toCheck.forEach((r, i) => { r.status = results[i].status; r.error = results[i].error; });

  const broken = [...rows.filter((r) => r.error === 'relative-url'), ...toCheck.filter((r) => r.status !== 200)];

  console.log('');
  console.log(`✅ 200 OK: ${rows.length - broken.length} / ❌ 異常: ${broken.length}`);

  if (broken.length) {
    console.log('\n❌ og:image が実配信されていない（SNS共有でサムネイルが出ない）:');
    for (const r of broken.slice(0, 50)) {
      console.log(`  ${r.file}: ${r.url} (status=${r.status}${r.error ? ` ${r.error}` : ''})`);
    }
    if (broken.length > 50) console.log(`  ... (+${broken.length - 50} more)`);
  } else {
    console.log('\n✅ 全 og:image が正常に配信されています');
  }

  if (CHECK_MODE && broken.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
