#!/usr/bin/env node
'use strict';
/**
 * scripts/build_top_picks.js — index.html の「今日の話題店」と「よく見られている店」を生成して差し込む（I-24・P-399）
 *
 * 区画（index.html の中の目印。手で編集しない）:
 *   <!-- TREND_PICKS_START --> … <!-- TREND_PICKS_END -->      今日の話題店（最初の画面）
 *   <!-- VIEW_RANKING_START --> … <!-- VIEW_RANKING_END -->    よく見られている店（閲覧数の下限を満たす日だけ）
 *
 * 材料（どれも data/ の実ファイル。自己申告の値は使わない・CLAUDE.md 制約10）:
 *   data/daily_trending5.json      今日の選定（pick_daily_trending5.js が毎朝書く・選び方はここでは触れない）
 *   data/stores.json               店舗の実データ（写真・エリア・ジャンル・閲覧数）
 *   data/trending_stores.json / data/manual_stores.json   出典URL（注目の理由の「N サイトで紹介」）
 *   data/view_counts.json          GA4 の modal_open の集計（よく見られている店）
 *   data/ranking_display_policy.json   閲覧数の下限（閾値の変更はこの JSON で行う）
 *   stores/*.html                  店舗ページの実在（リンク先の確認）
 *
 * 呼び出し: build.js が build_journal_index.js と同じ所で呼ぶ（build.yml と daily-trending5.yml の両方で効く）。
 * 冪等。決められない店（店名が重なる等）は出さずに警告へ出す（黙って落とさない）。
 *
 * 使い方:
 *   node scripts/build_top_picks.js            index.html を更新する
 *   node scripts/build_top_picks.js --dry-run  書かずに結果を出す
 *   node scripts/build_top_picks.js --check    今の index.html が生成結果と違えば exit 1
 */

const fs = require('fs');
const path = require('path');
const TP = require('./lib/top_picks');

const ROOT = path.join(__dirname, '..');
const MARKS = {
  trend: ['<!-- TREND_PICKS_START -->', '<!-- TREND_PICKS_END -->'],
  ranking: ['<!-- VIEW_RANKING_START -->', '<!-- VIEW_RANKING_END -->'],
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

// 目印の間を差し替える。目印が無ければ null（呼び出し側が警告に出す）。
function patchRegion(html, [start, end], body) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a) return null;
  const inner = body ? `\n${body}\n` : '\n';
  return html.slice(0, a + start.length) + inner + html.slice(b);
}

function makePageHref(root, toSlug) {
  const cache = new Map();
  const readPage = (slug) => {
    if (cache.has(slug)) return cache.get(slug);
    let html = null;
    try { html = fs.readFileSync(path.join(root, 'stores', `${slug}.html`), 'utf8'); } catch (_) { /* 無い */ }
    cache.set(slug, html);
    return html;
  };
  return (store) => TP.resolvePageHref(store, { toSlug, readPage });
}

/**
 * @param {{root?:string, write?:boolean, log?:(m:string)=>void, warn?:(m:string)=>void, toSlug?:Function}} [opts]
 * @returns {{changed:boolean, html:string, trend:object, ranking:object, missing:string[]}}
 */
function main(opts = {}) {
  const root = opts.root || ROOT;
  const write = opts.write !== false;
  const log = opts.log || ((m) => console.log(m));
  const warn = opts.warn || ((m) => console.warn(m));
  const toSlug = opts.toSlug || require(path.join(root, 'gen-store-pages.js')).toSlug;

  const htmlPath = path.join(root, 'index.html');
  const before = fs.readFileSync(htmlPath, 'utf8');

  const daily = readJson(path.join(root, 'data', 'daily_trending5.json'), { date: '', stores: [] });
  const stores = readJson(path.join(root, 'data', 'stores.json'), []);
  const trending = readJson(path.join(root, 'data', 'trending_stores.json'), { stores: [] });
  const manual = readJson(path.join(root, 'data', 'manual_stores.json'), { stores: [] });
  const views = readJson(path.join(root, 'data', 'view_counts.json'), {});
  const policy = readJson(path.join(root, 'data', 'ranking_display_policy.json'), {});
  const pageHref = makePageHref(root, toSlug);

  const trend = TP.buildTrendPicks({
    date: daily.date || '',
    picks: (daily.stores || []).slice().sort((a, b) => (parseInt(a['順位'], 10) || 99) - (parseInt(b['順位'], 10) || 99)),
    stores,
    records: [trending.stores || [], manual.stores || []],
    pageHref,
  });
  const ranking = TP.buildViewRanking({ stores, policy, lookbackDays: views.lookbackDays, pageHref });

  for (const s of trend.skipped) warn(`⚠️ 今日の話題店: 「${s.name}」は行に出せません（${s.why}）`);

  let html = before;
  const missing = [];
  for (const [key, body] of [['trend', trend.html], ['ranking', ranking.html]]) {
    const next = patchRegion(html, MARKS[key], body);
    if (next == null) missing.push(MARKS[key][0]);
    else html = next;
  }
  for (const m of missing) warn(`⚠️ index.html に ${m} がありません（区画を作り直さない）`);

  const changed = html !== before;
  if (write && changed) fs.writeFileSync(htmlPath, html, 'utf8');
  log(`✅ 今日の話題店 ${trend.cards.length}件${trend.skipped.length ? `（出せなかった ${trend.skipped.length}件）` : ''} / よく見られている店 ${ranking.cards.length ? ranking.cards.length + '件' : '下限に届かず出さない'}${changed ? '' : '（変更なし）'}`);
  return { changed, html, trend, ranking, missing };
}

module.exports = { main, patchRegion, MARKS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const check = args.includes('--check');
  const r = main({ write: !dry && !check });
  if (check && (r.changed || r.missing.length)) {
    console.error('index.html の話題店・よく見られている店の区画が、生成結果と違います（node scripts/build_top_picks.js で更新してください）');
    process.exit(1);
  }
}
