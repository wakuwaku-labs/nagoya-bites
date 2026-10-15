#!/usr/bin/env node
'use strict';
/**
 * 特集の店カードの Google の評価（<span class="score">★ 4.7</span>）を、データに評価が無い店から外す（MEO-003・冪等）。
 *
 * 店カードの★は、掲載店の入れ替え（scripts/refresh_feature_rosters.js・月 1 回）のときに data/stores.json の
 * Google評価から書かれ、次の入れ替えまで残る。build.js は、紐付けた Google の店舗情報が別の店かもしれない店の
 * 評価を消す（scripts/lib/place_binding.js の applyRatingGate・オーナーの判断 3=A・判断の記録 0046）ので、
 * 消した評価が特集にだけ最大 1 か月残る。ここでは、店カードのリンク先の店（stores/<ホットペッパーID>.html）が
 * data/stores.json にあって Google評価を持たないときだけ、その★を外す（検算できる事実だけで決める・制約10）。
 * データに無い店・ID で引けない店・評価がある店の★は触らない（数字の書き換えもしない。入れ替えの責務）。
 *
 *   node scripts/sync_feature_scores.js            # 書き込む
 *   node scripts/sync_feature_scores.js --dry-run  # 外す★を表示するだけ
 *   node scripts/sync_feature_scores.js --check    # 外す★があれば exit 1
 *
 * build.yml が refresh_feature_rosters.js の直後に日次で回す。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES = path.join(ROOT, 'features');

// 店カードの長さの上限。これより長いカードは閉じタグの対応を信用せず、触らない
const MAX_CARD_SPAN = 6000;
// ★だけが 1 行にある手書きのカードでは、行ごと消す（空の行を残さない）
const SCORE_RE = /(\n[ \t]*)?<span class="score">[^<]*<\/span>/g;

/**
 * offset を含む店カード（<div class="store-card">…</div>・手書きの特集の <div class="store">…</div>）の範囲。
 * <div> の入れ子を数えて閉じタグを決める。
 * 店カードの中でないとき・長すぎるときは null
 */
function cardRange(html, offset) {
  const cls = Math.max(html.lastIndexOf('class="store-card"', offset), html.lastIndexOf('class="store"', offset));
  if (cls < 0) return null;
  const start = html.lastIndexOf('<div', cls);
  if (start < 0 || html.slice(start, cls).includes('>')) return null;
  const re = /<\/?div\b/g;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0] === '<div' ? 1 : -1;
    if (depth === 0) break;
    if (m.index - start > MAX_CARD_SPAN) return null;
  }
  if (!m || depth !== 0) return null;
  const end = m.index;
  return (offset > start && offset < end) ? { start, end } : null;
}

/** ホットペッパーID → Google評価を持つか */
function ratedIndex(stores) {
  const m = new Map();
  for (const s of stores || []) {
    const id = s && s['ホットペッパーID'];
    if (id) m.set(String(id), !!s['Google評価']);
  }
  return m;
}

/**
 * 1 ページの★のうち、データに評価が無い店のものを外す。
 * @returns {{html:string, removed:string[]}}  removed は外した★の店の ID
 */
function stripScores(html, rated) {
  const removed = [];
  const out = html.replace(SCORE_RE, (m, lead, offset) => {
    const card = cardRange(html, offset + (lead ? lead.length : 0));
    if (!card) return m;
    // カードの中の店舗ページへのリンクが 1 つの店を指すときだけ、その店の★と決める
    const ids = new Set(Array.from(html.slice(card.start, card.end).matchAll(/stores\/([A-Za-z0-9_-]+)\.html/g), (x) => x[1]));
    if (ids.size !== 1) return m;
    const id = [...ids][0];
    if (rated.get(id) !== false) return m;
    removed.push(id);
    return '';
  });
  return { html: out, removed };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const check = args.includes('--check');
  const { loadStores } = require('./lib/load_stores');
  const rated = ratedIndex(loadStores());
  let total = 0;
  for (const f of fs.readdirSync(FEATURES).filter((x) => x.endsWith('.html')).sort()) {
    const p = path.join(FEATURES, f);
    const html = fs.readFileSync(p, 'utf8');
    const r = stripScores(html, rated);
    if (!r.removed.length) continue;
    total += r.removed.length;
    console.log(`${f}: ★を外す ${r.removed.length}店（${r.removed.join('・')}）`);
    if (!dryRun && !check) fs.writeFileSync(p, r.html);
  }
  console.log(`特集の★（MEO-003）: データに評価が無い店の★ ${total}件${dryRun || check ? '（書き込みなし）' : 'を外した'}`);
  if (check && total) process.exit(1);
}

if (require.main === module) main();

module.exports = { ratedIndex, stripScores, cardRange, MAX_CARD_SPAN };
