#!/usr/bin/env node
/**
 * search_ctr_rewrite.js
 *
 * 検索のクリック率を上げるために、記事の title と説明文（description）を書き直す作業の台帳を
 * 反映・確認・比較・取り消しする。台帳の正本は data/search_ctr_rewrites.json（batches[]）。
 * 書き換えるのは head の文字だけ（<title>・meta description・og:title・og:description・
 * twitter:title・twitter:description）。h1・本文・JSON-LD・data/journal_published.json は変えない
 * （SEO-137 の data/journal_title_experiment.json と同じ範囲）。
 *
 * 台帳の各ページは fields[] に { tag, before, after } を持つ。反映は「今の値が before と完全に一致する
 * ときだけ」書き換え、1か所でも合わなければ何も書かずに止まる（取り消しは after → before で同じ）。
 *
 * 使い方:
 *   node scripts/search_ctr_rewrite.js --check                 # 台帳の状態（applied なら after・reverted なら before）と今のページが一致するか
 *   node scripts/search_ctr_rewrite.js --apply  <batch id>     # before → after に書き換える（済みの所は飛ばす）
 *   node scripts/search_ctr_rewrite.js --revert <batch id>     # after → before に戻す（止める条件に当たったとき）
 *   node scripts/search_ctr_rewrite.js --report [batch id]     # 基線と今の data/gsc_metrics.json を並べ、止める条件を判定する
 *   （--dry-run を付けると書き込まない）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEDGER = path.join(ROOT, 'data', 'search_ctr_rewrites.json');
const GSC = path.join(ROOT, 'data', 'gsc_metrics.json');

// tag → head の中の場所。値は属性値か <title> の中身（HTML の実体参照は使わない値だけを扱う）
const TAGS = {
  'title': /(<title>)([^<]*)(<\/title>)/,
  'meta:description': /(<meta name="description" content=")([^"]*)(")/,
  'og:title': /(<meta property="og:title" content=")([^"]*)(")/,
  'og:description': /(<meta property="og:description" content=")([^"]*)(")/,
  'twitter:title': /(<meta name="twitter:title" content=")([^"]*)(")/,
  'twitter:description': /(<meta name="twitter:description" content=")([^"]*)(")/,
};

const pathOf = (url) => String(url || '').replace(/^https?:\/\/[^/]+\//, '');

function readTag(html, tag) {
  const re = TAGS[tag];
  if (!re) throw new Error(`知らない tag: ${tag}`);
  const m = html.match(re);
  return m ? m[2] : null;
}

function writeTag(html, tag, value) {
  if (/["<>&]/.test(value)) throw new Error(`${tag}: 値に " < > & は使えない（${value}）`);
  return html.replace(TAGS[tag], (_, a, __, c) => a + value + c);
}

/** 1ページ分を書き換える（純関数）。from/to は 'before' | 'after' */
function rewritePage(html, page, from, to) {
  const problems = [];
  let out = html;
  let changed = 0;
  for (const f of page.fields) {
    const now = readTag(out, f.tag);
    if (now === null) { problems.push(`${page.path}: ${f.tag} が無い`); continue; }
    if (now === f[to]) continue; // 済み
    if (now !== f[from]) { problems.push(`${page.path}: ${f.tag} が台帳の ${from} と違う（今「${now}」）`); continue; }
    out = writeTag(out, f.tag, f[to]);
    changed++;
  }
  return { html: out, changed, problems };
}

/** バッチ全体を書き換える。1か所でも合わなければ何も書かない */
function rewriteBatch(batch, direction, { root = ROOT, dryRun = false } = {}) {
  const [from, to] = direction === 'revert' ? ['after', 'before'] : ['before', 'after'];
  const results = batch.pages.map(page => {
    const file = path.join(root, page.path);
    if (!fs.existsSync(file)) return { page, problems: [`${page.path}: ファイルが無い`] };
    return { page, file, ...rewritePage(fs.readFileSync(file, 'utf8'), page, from, to) };
  });
  const problems = results.flatMap(r => r.problems);
  if (problems.length || dryRun) return { problems, changed: results.reduce((a, r) => a + (r.changed || 0), 0), written: 0 };
  let written = 0;
  for (const r of results) if (r.changed) { fs.writeFileSync(r.file, r.html); written++; }
  return { problems, changed: results.reduce((a, r) => a + r.changed, 0), written };
}

/** 台帳の状態と今のページが一致するか（applied → after・reverted → before） */
function checkBatch(batch, root = ROOT) {
  const want = batch.status === 'reverted' ? 'before' : 'after';
  const problems = [];
  for (const page of batch.pages) {
    const file = path.join(root, page.path);
    if (!fs.existsSync(file)) { problems.push(`${page.path}: ファイルが無い`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    for (const f of page.fields) {
      const now = readTag(html, f.tag);
      if (now !== f[want]) problems.push(`${page.path}: ${f.tag} が台帳（${want}）と違う（今「${now}」）`);
    }
  }
  return problems;
}

/** 基線と今の比較・止める条件の判定（純関数・テスト対象） */
function report(batch, gsc) {
  const now = new Map((gsc.pages || []).map(p => [pathOf(p.page), p]));
  const rows = batch.pages.map(page => {
    const cur = now.get(page.path) || null;
    const before = page.baseline || null;
    const ctrNow = cur && cur.impressions ? +(cur.clicks / cur.impressions).toFixed(4) : null;
    const ctrBefore = before && before.impressions ? +(before.clicks / before.impressions).toFixed(4) : null;
    return {
      path: page.path,
      before,
      now: cur ? { impressions: cur.impressions, clicks: cur.clicks, ctr: ctrNow, position: +(+cur.position).toFixed(1) } : null,
      ctrDown: ctrNow != null && ctrBefore != null && ctrNow < ctrBefore,
    };
  });
  const sum = (list, k) => list.reduce((a, r) => a + ((r && r[k]) || 0), 0);
  const withNow = rows.filter(r => r.now && r.before);
  const pagesBefore = { impressions: sum(withNow.map(r => r.before), 'impressions'), clicks: sum(withNow.map(r => r.before), 'clicks') };
  const pagesNow = { impressions: sum(withNow.map(r => r.now), 'impressions'), clicks: sum(withNow.map(r => r.now), 'clicks') };
  const ctr = (o) => (o.impressions ? +(o.clicks / o.impressions).toFixed(4) : null);
  const siteClicks = ((gsc.totals || {}).clicks) ?? null;
  const stop = batch.stop || {};
  const reasons = [];
  if (ctr(pagesNow) != null && ctr(pagesBefore) != null && ctr(pagesNow) < ctr(pagesBefore)) {
    reasons.push(`書き直した記事のクリック率が下がった（${ctr(pagesBefore)} → ${ctr(pagesNow)}）`);
  }
  if (siteClicks != null && stop.siteClicksBelow != null && siteClicks < stop.siteClicksBelow) {
    reasons.push(`全体の検索クリックが ${stop.siteClicksBelow} を下回った（${siteClicks}）`);
  }
  return {
    id: batch.id,
    baselineRange: batch.baselineRange,
    currentRange: gsc.dateRange,
    compareOn: batch.compareOn,
    pages: rows,
    missing: rows.filter(r => !r.now).map(r => r.path),
    rewrittenPages: { before: { ...pagesBefore, ctr: ctr(pagesBefore) }, now: { ...pagesNow, ctr: ctr(pagesNow) } },
    siteClicks: { before: (batch.baselineSite || {}).clicks ?? null, now: siteClicks },
    stop: { hit: reasons.length > 0, reasons },
  };
}

function loadLedger() { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); }

function findBatch(ledger, id) {
  const b = id ? ledger.batches.find(x => x.id === id) : ledger.batches[ledger.batches.length - 1];
  if (!b) throw new Error(`台帳にバッチが無い: ${id || '(最新)'}`);
  return b;
}

function main(argv = process.argv.slice(2)) {
  const ledger = loadLedger();
  const dryRun = argv.includes('--dry-run');
  const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '') : null; };

  if (argv.includes('--check')) {
    let bad = 0;
    for (const b of ledger.batches) {
      const problems = checkBatch(b);
      problems.forEach(p => console.log(`  ${p}`));
      console.log(`${b.id}（${b.status}）: ${problems.length ? `不一致 ${problems.length} か所` : '一致'}`);
      bad += problems.length;
    }
    process.exit(bad ? 1 : 0);
  }
  for (const dir of ['apply', 'revert']) {
    const id = arg(`--${dir}`);
    if (id === null) continue;
    if (!id) { console.error(`--${dir} にはバッチの id を付ける`); process.exit(2); }
    const r = rewriteBatch(findBatch(ledger, id), dir, { dryRun });
    r.problems.forEach(p => console.log(`  ${p}`));
    if (r.problems.length) { console.log('台帳と合わない所があるので、何も書き換えていない'); process.exit(1); }
    console.log(`${dir === 'apply' ? '反映' : '取り消し'}: ${r.changed} か所${dryRun ? '（dry-run・書き込みなし）' : `・${r.written} ファイル`}。台帳の status を ${dir === 'apply' ? 'applied' : 'reverted'} にすること`);
    process.exit(0);
  }
  const id = arg('--report');
  console.log(JSON.stringify(report(findBatch(ledger, id || null), JSON.parse(fs.readFileSync(GSC, 'utf8'))), null, 2));
}

if (require.main === module) main();

module.exports = { TAGS, readTag, writeTag, rewritePage, rewriteBatch, checkBatch, report, findBatch };
