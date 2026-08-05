#!/usr/bin/env node
/**
 * Hot Pepper 写真の「原寸マスター」実在調査（ISSUE: 店舗カード画像の解像度）
 *
 * 背景:
 *   data/stores.json の写真URLは 97% が imgfp.hotp.jp の _480.jpg（480px マスター）。
 *   モーダルは wsrv.nl に w=1600 を要求するが、wsrv.nl は元画像より大きくしないため
 *   実際には 480px しか返らず、ブラウザ側が 4倍前後に引き伸ばして表示していた（＝ボケの原因）。
 *
 *   サフィックスを外した URL（..._480.jpg → ....jpg）は「投稿時の原寸」を返す。
 *   ただし
 *     - 約25%は 404（原寸が公開されていない）
 *     - 一部は原寸のほうが小さい（150px 等のケースが実在する）
 *   ため、**盲目的な URL 書き換えは画質を下げる**。CLAUDE.md 制約10（検証できる事実だけで判定）
 *   に従い、ここで1件ずつ実測し、実際に大きいものだけを昇格対象として記録する。
 *
 * 出力: data/hotpepper_master_probe.json
 *   { probedAt, stats, results: { "<_480 URL>": {status, w, h, bytes} } }
 *
 * 使い方:
 *   node scripts/probe_hotpepper_master.js            # 未調査分のみ追記（冪等・再開可能）
 *   node scripts/probe_hotpepper_master.js --refresh  # 全件やり直し
 *   node scripts/probe_hotpepper_master.js --limit 200
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const STORES = path.join(ROOT, 'data', 'stores.json');
const OUT = path.join(ROOT, 'data', 'hotpepper_master_probe.json');

const argv = process.argv.slice(2);
const REFRESH = argv.includes('--refresh');
const LIMIT = (() => {
  const i = argv.indexOf('--limit');
  return i >= 0 ? parseInt(argv[i + 1], 10) : Infinity;
})();
const CONCURRENCY = 24;

/** _480.jpg 等のサフィックスを外した「原寸」URL を返す。対象外なら null。 */
function masterUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/^(https:\/\/imgfp\.hotp\.jp\/.+?)_(\d+)\.jpg$/);
  return m ? m[1] + '.jpg' : null;
}

/** JPEG の SOFn マーカーから寸法を読む（先頭数十KBだけで判定できる）。 */
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0..SOF15（DHT=C4 / JPG=C8 / DAC=CC は除く）
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function probe(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { headers: { Range: 'bytes=0-65535', 'User-Agent': 'nagoya-bites-image-audit/1.0' }, timeout: 20000 },
      (res) => {
        const status = res.statusCode;
        const total = (() => {
          const cr = res.headers['content-range'];
          if (cr) { const m = cr.match(/\/(\d+)$/); if (m) return parseInt(m[1], 10); }
          const cl = res.headers['content-length'];
          return cl ? parseInt(cl, 10) : null;
        })();
        if (status !== 200 && status !== 206) {
          res.resume();
          return resolve({ status });
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const dim = jpegSize(Buffer.concat(chunks));
          resolve({ status, w: dim ? dim.w : null, h: dim ? dim.h : null, bytes: total });
        });
        res.on('error', () => resolve({ status: 0, error: 'stream' }));
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, error: e.code || 'err' }));
  });
}

async function pool(items, worker, n) {
  let idx = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      await worker(items[my]);
      if (++done % 200 === 0) process.stderr.write(`  ...${done}/${items.length}\n`);
    }
  });
  await Promise.all(runners);
}

/** 実測キャッシュを読む（無ければ空）。 */
function loadCache() {
  if (!fs.existsSync(OUT)) return {};
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')).results || {}; } catch (e) { return {}; }
}

/** 未調査の _480 URL だけを実測してキャッシュに追記し、最新のキャッシュを返す。 */
async function ensureProbed(urls, cache) {
  const todo = [];
  const seen = new Set();
  for (const u of urls) {
    if (!masterUrl(u) || seen.has(u) || cache[u]) continue;
    seen.add(u);
    todo.push(u);
  }
  if (todo.length) {
    console.error(`  未調査 ${todo.length} 件を実測中...`);
    await pool(todo, async (u) => { cache[u] = await probe(masterUrl(u)); }, CONCURRENCY);
  }
  return cache;
}

/** キャッシュを data/hotpepper_master_probe.json に保存（統計も再計算）。 */
function saveCache(results) {
  const st = { total: 0, ok: 0, missing: 0, error: 0, bigger: 0, same: 0, smaller: 0, bytesSum: 0 };
  const widthBuckets = {};
  for (const u of Object.keys(results)) {
    const r = results[u];
    st.total++;
    if (r.status === 404) { st.missing++; continue; }
    if (r.status !== 200 && r.status !== 206) { st.error++; continue; }
    st.ok++;
    const base = parseInt((u.match(/_(\d+)\.jpg$/) || [])[1], 10) || 480;
    if (!r.w) { st.error++; continue; }
    if (r.w > base) st.bigger++; else if (r.w === base) st.same++; else st.smaller++;
    if (r.bytes) st.bytesSum += r.bytes;
    const b = r.w >= 1200 ? '1200+' : r.w >= 960 ? '960-1199' : r.w >= 720 ? '720-959' : r.w >= 481 ? '481-719' : '<=480';
    widthBuckets[b] = (widthBuckets[b] || 0) + 1;
  }
  fs.writeFileSync(OUT, JSON.stringify({ probedAt: new Date().toISOString().slice(0, 10), stats: st, widthBuckets, results }, null, 0));
  return { stats: st, widthBuckets };
}

module.exports = { masterUrl, probe, jpegSize, loadCache, ensureProbed, saveCache, OUT };

if (require.main !== module) return;

(async () => {
  const stores = JSON.parse(fs.readFileSync(STORES, 'utf8'));
  const prev = !REFRESH && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).results || {} : {};

  // 重複URLは1回だけ叩く
  const targets = [];
  const seen = new Set();
  for (const s of stores) {
    const u = s['写真URL'];
    if (!masterUrl(u) || seen.has(u)) continue;
    seen.add(u);
    if (prev[u]) continue;
    targets.push(u);
    if (targets.length >= LIMIT) break;
  }

  console.error(`Hot Pepper 写真: ユニーク ${seen.size} 件 / 未調査 ${targets.length} 件を実測します`);
  const results = Object.assign({}, prev);

  await pool(targets, async (u) => {
    results[u] = await probe(masterUrl(u));
  }, CONCURRENCY);

  // 統計（すべて実測値のみ。自己申告値は使わない）
  const st = { total: 0, ok: 0, missing: 0, error: 0, bigger: 0, same: 0, smaller: 0, bytesSum: 0 };
  const widthBuckets = {};
  for (const u of Object.keys(results)) {
    const r = results[u];
    st.total++;
    if (r.status === 404) { st.missing++; continue; }
    if (r.status !== 200 && r.status !== 206) { st.error++; continue; }
    st.ok++;
    const base = parseInt((u.match(/_(\d+)\.jpg$/) || [])[1], 10) || 480;
    if (!r.w) { st.error++; continue; }
    if (r.w > base) st.bigger++;
    else if (r.w === base) st.same++;
    else st.smaller++;
    if (r.bytes) st.bytesSum += r.bytes;
    const b = r.w >= 1200 ? '1200+' : r.w >= 960 ? '960-1199' : r.w >= 720 ? '720-959' : r.w >= 481 ? '481-719' : '<=480';
    widthBuckets[b] = (widthBuckets[b] || 0) + 1;
  }

  fs.writeFileSync(OUT, JSON.stringify({ probedAt: new Date().toISOString().slice(0, 10), stats: st, widthBuckets, results }, null, 0));
  console.error('\n=== 実測結果 ===');
  console.error(st);
  console.error('原寸の幅分布:', widthBuckets);
  console.error(`\n-> ${path.relative(ROOT, OUT)} に保存`);
})();
