#!/usr/bin/env node
'use strict';
/**
 * 今日の記事の X 用の画像カードを作る（Mac 側・run_journal_local.sh の記事と同じコミットに入れる段）。
 *   node scripts/make_x_image_card.js [--date YYYY-MM-DD] [--force] [--json]
 * 付ける日・付けない日の決め方は scripts/lib/x_image_card.js の decideImage（policy の imageCard）。
 * 付けない日は PNG を作らず、記録（data/x_post_cards/<date>.json）だけ残す。失敗しても終了コードは 0（公開を止めない）。
 */
const fs = require('fs');
const path = require('path');
const X = require('./lib/x_post');
const C = require('./lib/x_image_card');
const { findEntry, todayJst } = require('./post_journal_to_x');
const { loadPlan } = require('./write_x_draft');

function parseArgs(argv) {
  const a = { date: null, force: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--date') a.date = argv[++i];
    else if (k === '--force') a.force = true;
    else if (k === '--json') a.json = true;
    else throw new Error(`知らない引数: ${k}`);
  }
  if (a.date && !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('--date は YYYY-MM-DD');
  return a;
}

function run(args, { root = X.ROOT, now = new Date(), rasterizer } = {}) {
  const policy = X.loadPolicy(root);
  const date = args.date || todayJst(now);
  const entry = findEntry(date, root);
  if (!entry) return { date, result: 'no_journal' };
  const articlePath = path.join(root, 'journal', `${entry.slug}.html`);
  if (!fs.existsSync(articlePath)) return { date, slug: entry.slug, result: 'article_html_missing' };
  const { plan } = loadPlan(date, policy, now);
  const r = C.makeCard({ date, entry, policy, plan, html: fs.readFileSync(articlePath, 'utf8'), root, rasterizer, force: args.force });
  return { date, slug: entry.slug, result: r.variant === 'image' ? 'card_made' : 'no_card', ...r };
}

if (require.main === module) {
  try {
    const r = run(parseArgs(process.argv.slice(2)));
    console.log(args_json() ? JSON.stringify(r, null, 2) : `X 画像カード ${r.date}: ${r.result}${r.reason ? `（${r.reason}）` : ''}${r.png ? ` ${r.png}` : ''}${r.error ? ` 失敗: ${r.error}` : ''}`);
  } catch (e) { console.error(e.stack || String(e)); }
}
function args_json() { return process.argv.includes('--json'); }

module.exports = { run, parseArgs };
