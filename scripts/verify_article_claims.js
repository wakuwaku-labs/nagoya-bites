#!/usr/bin/env node
'use strict';
/**
 * 記事の事実台帳と、出典との機械照合（S4-1・記録だけ）。
 *
 * 記事の出典欄の URL を機械が取り直し、本文の数字・日付・価格が出典にあるかを照らして
 * data/journal_claims/<日付>.json に記録する。公開は止めない（shadow）。失敗しても終了コードは 0。
 *
 *   node scripts/verify_article_claims.js --date 2026-11-16
 *   node scripts/verify_article_claims.js --file journal/<slug>.html [--out path] [--no-fetch]
 *
 * 書き手が台帳を出したときは data/journal_claims/<日付>.ledger.json（{claims:[{text,kind}]}）を読む。
 * 無ければ記事から機械が取り出す（今はこちらが標準）。
 * 設定: data/journal_gate_policy.json の claims_gate。data/editorial_standard.json（S3-1）があれば任意で読む。
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/claims');

const ROOT = C.ROOT;

function readJson(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return dflt; }
}

function loadGate(root = ROOT) {
  const p = readJson(path.join(root, 'data', 'journal_gate_policy.json'), {});
  const g = p.claims_gate || {};
  return {
    mode: g.mode || 'shadow',
    fetchTimeoutSec: g.fetch_timeout_sec || 15,
    maxSources: g.max_sources || 10,
    review: { enabled: true, model: null, timeout_sec: 240, prompt_version: 'review-2026-11-17', max_excerpt_chars: 1500, ...(g.independent_review || {}) },
    raw: g,
  };
}

/** 記事HTMLを照合して台帳（オブジェクト）を返す。fetcher を差し替えれば取得なしで試せる。 */
async function buildLedger(html, { date, slug, root = ROOT, fetcher = null, noFetch = false, gate = loadGate(root), ledger = null, cache = true, storesMap = null }) {
  const sources = C.extractSources(html).slice(0, gate.maxSources);
  const fetchImpl = fetcher || ((u) => C.fetchSourceLive(u, { timeoutMs: gate.fetchTimeoutSec * 1000 }));
  const pool = [];
  const dir = C.cacheDir(root);
  for (const s of sources) {
    const rec = { ...s, ok: false, text: '', fetched_at: null, fetch: { ok: false } };
    if (!noFetch) {
      const r = await fetchImpl(s.url);
      rec.fetched_at = new Date().toISOString();
      rec.ok = !!r.ok;
      rec.text = r.ok ? r.text : '';
      rec.fetch = { ok: !!r.ok, status: r.status || 0, ...(r.ok ? { chars: r.text.length, sha256: C.sha256(r.text) } : { reason: r.reason || 'unknown' }) };
      if (r.ok && cache) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${C.sha256(s.url).slice(0, 16)}.txt`), r.text);
        } catch (_) { /* 全文の保存に失敗しても記録は続ける */ }
      }
    } else rec.fetch = { ok: false, reason: 'skipped' };
    pool.push(rec);
  }
  const v = C.verifyArticle(html, { date, pool, root, ledger, storesMap });
  return {
    date,
    slug: slug || null,
    mode: gate.mode,
    generated_at: new Date().toISOString(),
    ledger_by: ledger && Array.isArray(ledger.claims) && ledger.claims.length ? 'writer' : 'machine',
    sources: pool.map((p) => ({ url: p.url, label: p.label, type: p.type, date: p.date, fetched_at: p.fetched_at, fetch: p.fetch })),
    fetch_summary: {
      sources: pool.length,
      ok: pool.filter((p) => p.fetch.ok).length,
      failed: pool.filter((p) => !p.fetch.ok).map((p) => ({ url: p.url, reason: p.fetch.reason || 'unknown' })),
    },
    claims: v.claims,
    issues: v.issues,
    summary: v.summary,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const date = arg('--date');
  let file = arg('--file');
  let slug = null;
  if (!file && date) {
    const pub = readJson(path.join(ROOT, 'data', 'journal_published.json'), { entries: [] });
    const e = (pub.entries || []).find((x) => x.date === date);
    if (!e || !e.slug) { console.error(`published.json に ${date} のエントリがありません`); process.exit(2); }
    slug = e.slug;
    file = path.join(ROOT, 'journal', `${e.slug}.html`);
  }
  if (!file || !fs.existsSync(file)) { console.error('使い方: --date YYYY-MM-DD か --file <記事HTML>'); process.exit(2); }
  const d = date || (path.basename(file).match(/^(\d{4}-\d{2}-\d{2})/) || [])[1] || new Date().toISOString().slice(0, 10);
  const gate = loadGate();
  if (gate.mode === 'off') { console.log('claims_gate=off のため照合しません'); return; }
  const html = fs.readFileSync(file, 'utf8');
  const ledger = readJson(path.join(ROOT, 'data', 'journal_claims', `${d}.ledger.json`), null);
  const out = await buildLedger(html, { date: d, slug: slug || path.basename(file, '.html'), noFetch: argv.includes('--no-fetch'), ledger, gate });
  const outPath = arg('--out') || path.join(ROOT, 'data', 'journal_claims', `${d}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  const s = out.summary;
  console.log(`事実台帳: ${s.claims}件（照合 ${s.verified}・照合不能 ${s.unverifiable}・食い違い ${s.mismatch}・言い切り化 ${s.hedge_dropped}）／出典の取得 ${out.fetch_summary.ok}/${out.fetch_summary.sources} → ${path.relative(ROOT, outPath)}`);
  for (const i of out.issues) console.log(`  [記録] ${i.type}: ${i.detail}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(`verify_article_claims 失敗（公開は止めません）: ${e.message}`); process.exit(0); });
}

module.exports = { buildLedger, loadGate };
