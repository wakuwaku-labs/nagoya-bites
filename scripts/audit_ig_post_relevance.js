'use strict';

/**
 * scripts/audit_ig_post_relevance.js
 *
 * 「サイトに出ている Instagram 埋め込みが、店の料理・内装・外観を写した投稿か」の監査。
 *
 * 判定そのものは scripts/lib/ig_post_policy.js（基準は data/ig_post_policy.json）。
 * ここはその判定を全件に当てて、退行を CI で止めるための器。
 *
 * ── 不変条件（--check が守るもの）──────────────────────────────
 *   サイトに出ている埋め込み（stores.json の Instagram投稿URL）は
 *   すべて ig_post_policy の PASS でなければならない。
 *   証跡が無い（＝検証できない）ものが出ているのも違反として扱う。
 *   取り繕って出すより、出さない方を選ぶ（CLAUDE.md 制約10）。
 *
 * 使い方:
 *   node scripts/audit_ig_post_relevance.js              内訳レポート
 *   node scripts/audit_ig_post_relevance.js --check      CI用（違反で exit 1）
 *   node scripts/audit_ig_post_relevance.js --list REJECT_NOTICE   判定別の一覧
 *   node scripts/audit_ig_post_relevance.js --store 焼肉やっちゃん  店名で引く
 */

const fs   = require('fs');
const path = require('path');
const { judgeUrl } = require('./lib/ig_post_policy.js');

const ROOT      = path.resolve(__dirname, '..');
const POSTS     = path.join(ROOT, 'data', 'instagram_posts.json');
const RESOLVED  = path.join(ROOT, 'data', 'instagram_resolved.json');

const argv   = process.argv.slice(2);
const CHECK  = argv.includes('--check');
const LIST   = argv.includes('--list')  ? argv[argv.indexOf('--list') + 1]  : null;
const STOREQ = argv.includes('--store') ? argv[argv.indexOf('--store') + 1] : null;

function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }

/** サイトに実際に出ている埋め込み（store側の Instagram投稿URL）を集める */
function loadShipped() {
  try {
    const { loadStores } = require('./lib/load_stores.js');
    const stores = loadStores();
    const out = new Map();  // postUrl -> 店名
    for (const s of stores) {
      const u = (s['Instagram投稿URL'] || '').trim();
      if (u) out.set(u.replace(/\?.*$/, ''), s['店名'] || '');
    }
    return out;
  } catch (e) {
    return null;   // stores.json 未生成の環境では skip
  }
}

function main() {
  const posts    = readJson(POSTS, {});
  const resolved = readJson(RESOLVED, {});
  const shipped  = loadShipped();

  // 判定対象は「キャッシュに載っている投稿」＋「出荷済みだがキャッシュに無い投稿」
  // （後者は Sheets 由来。同じ基準で見ないと片方だけ素通りしてしまう）
  const rows = [];
  const seen = new Set();
  for (const [id, rec] of Object.entries(posts)) {
    if (!rec || !rec.postUrl) continue;
    const url = rec.postUrl.replace(/\?.*$/, '');
    const storeName = (resolved[id] || {}).store || '';
    rows.push({ id, storeName, url, ...judgeUrl(url, { storeName }) });
    seen.add(url);
  }
  if (shipped) {
    for (const [url, storeName] of shipped) {
      if (seen.has(url)) continue;
      rows.push({ id: '(sheets)', storeName, url, ...judgeUrl(url, { storeName }) });
      seen.add(url);
    }
  }

  if (STOREQ) {
    const hit = rows.filter(r => r.storeName.includes(STOREQ));
    if (!hit.length) { console.log(`「${STOREQ}」に一致する店の埋め込みはありません`); return; }
    for (const r of hit) {
      console.log(`\n${r.storeName}  [${r.id}]`);
      console.log(`  ${r.url}`);
      console.log(`  判定: ${r.verdict} — ${r.reason}`);
      if (r.body) console.log(`  本文: ${r.body.slice(0, 160)}`);
    }
    return;
  }

  if (LIST) {
    const hit = rows.filter(r => r.verdict === LIST);
    console.log(`${LIST}: ${hit.length}件`);
    for (const r of hit.slice(0, 60)) {
      console.log(`  ${(r.storeName || '(店名不明)').slice(0, 22).padEnd(24)} ${r.reason.slice(0, 60)}`);
      console.log(`    ${r.url}`);
    }
    if (hit.length > 60) console.log(`  … 他 ${hit.length - 60}件`);
    return;
  }

  // ── 内訳 ──
  const tally = {};
  for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  const pass = rows.filter(r => r.ok).length;

  console.log('=== Instagram 埋め込みの内容関連性 監査 ===');
  console.log(`対象（postUrl を持つ店）: ${rows.length}件`);
  console.log(`掲載可（PASS）           : ${pass}件 (${(pass / (rows.length || 1) * 100).toFixed(1)}%)`);
  console.log('');
  for (const [v, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.padEnd(28)} ${String(n).padStart(5)}`);
  }

  if (!shipped) {
    console.log('\n（stores.json が無いため、出荷済み埋め込みとの突合はスキップ）');
    return;
  }

  // ── 不変条件: 出荷済みの埋め込みは全て PASS でなければならない ──
  const byUrl = new Map(rows.map(r => [r.url.replace(/\?.*$/, ''), r]));
  const violations = [];
  for (const [url, storeName] of shipped) {
    const r = byUrl.get(url);
    if (!r) { violations.push({ storeName, url, verdict: 'UNKNOWN', reason: 'キャッシュに証跡が無い' }); continue; }
    if (!r.ok) violations.push({ storeName, url, verdict: r.verdict, reason: r.reason });
  }

  console.log(`\n出荷済みの埋め込み: ${shipped.size}件 / 基準違反: ${violations.length}件`);
  if (violations.length) {
    for (const v of violations.slice(0, 30)) {
      console.log(`  ✗ ${(v.storeName || '?').slice(0, 20).padEnd(22)} ${v.verdict} — ${v.reason.slice(0, 50)}`);
      console.log(`      ${v.url}`);
    }
    if (violations.length > 30) console.log(`  … 他 ${violations.length - 30}件`);
  }

  if (CHECK) {
    if (violations.length) {
      console.error(`\n✗ 基準を満たさない埋め込みが ${violations.length}件 出荷されています。`);
      console.error('  node build.js を実行して掲載対象を作り直してください。');
      process.exit(1);
    }
    console.log('\n✓ 出荷済みの埋め込みはすべて基準を満たしています');
  }
}

if (require.main === module) main();
module.exports = { };
