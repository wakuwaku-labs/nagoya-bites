#!/usr/bin/env node
/**
 * apply_feature_conclusions.js
 *
 * 特集の冒頭に「先に結論」ブロックを冪等に置く（SEO-122 / SEO-134）。
 *
 * 特集は結論（どの店を選べばいいか）が本文の中ほどにあり、検索から来た読者も、AI の概要も、
 * 先頭だけでは答えを拾えなかった。冒頭に「誰に・どの店・なぜ」を数行で示す。
 *
 * 店は記事の ItemList JSON-LD（一覧の順）から取り、data/feature_conclusions.json の行ごとの
 * 価格帯の条件に合う最初の店を選ぶ。月次の掲載店の入れ替え（refresh_feature_rosters.js）の
 * 後に毎日実行するので、結論は常にその日の一覧と一致する（手書きにすると一覧が入れ替わった
 * 日に、載っていない店を勧める結論が残る）。
 *
 * 書くのは data/stores.json の事実（エリア・ジャンル・価格帯・個室）だけ。推測の数値は書かない。
 * 条件に合う店が無い行は出さず、2行に満たなければ区画ごと外す（取り繕わない）。
 * 店舗ページが無い店・閉店リストにある店は選ばない（架空店ブロック・add_feature_top_cta.js と同じ条件）。
 *
 * 使い方:
 *   node scripts/apply_feature_conclusions.js           # 設定のある特集すべてに書く
 *   node scripts/apply_feature_conclusions.js --check   # 書かずに、要更新の特集があれば exit 1
 *   node scripts/apply_feature_conclusions.js --only date
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { parsePriceBand, normalizeArea, loadPolicy } = require('./lib/area_genre_pages');
const { loadStores } = require('./lib/load_stores');
const { featureStoreOnclick } = require('./lib/feature_tracking');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'data', 'feature_conclusions.json');
const MANIFEST = path.join(ROOT, 'data', 'area_genre_pages_manifest.json');
const CLOSED = path.join(ROOT, 'data', 'closed_stores.json');
const START = '<!-- NB_CONCLUSION:START -->';
const END = '<!-- NB_CONCLUSION:END -->';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** ItemList JSON-LD の掲載店（一覧の順）。形式は refresh_feature_rosters.js の replaceItemList と同じ */
function storesFromItemList(html) {
  const out = [];
  const re = /"@type":\s*"ListItem",\s*"position":\s*(\d+),\s*"name":\s*"((?:[^"\\]|\\.)*)",\s*"url":\s*"[^"]*\/stores\/(J\d+)\.html"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push({ position: Number(m[1]), name: JSON.parse(`"${m[2]}"`), jcode: m[3] });
  return out.sort((a, b) => a.position - b.position);
}

function inRange(band, line) {
  const b = parsePriceBand(band);
  if (!b) return false;
  if (line.priceMin != null && !(b.lo != null && b.lo >= line.priceMin)) return false;
  if (line.priceMax != null && !(b.hi != null && b.hi <= line.priceMax)) return false;
  return true;
}

function rangeText(line) {
  const yen = n => n.toLocaleString('en-US');
  if (line.priceMin != null && line.priceMax != null) return `${yen(line.priceMin)}〜${yen(line.priceMax)}円`;
  if (line.priceMax != null) return `〜${yen(line.priceMax)}円`;
  if (line.priceMin != null) return `${yen(line.priceMin)}円〜`;
  return '';
}

/**
 * 行ごとに店を選ぶ（純関数・テスト対象）。
 * entries: [{ jcode, store }]（一覧の順）。戻り値: [{ line, entry, areaLabel }]
 */
function pickLines(entries, cfg, policy) {
  const used = new Set();
  const usedAreas = new Set();
  const out = [];
  for (const line of cfg.lines || []) {
    const cands = entries.filter(e => !used.has(e.jcode) && inRange(e.store['価格帯'], line));
    if (!cands.length) continue;
    const areaOf = e => { const a = normalizeArea(e.store['エリア'], policy); return a ? a.label : ''; };
    const pick = (cfg.distinctArea && cands.find(e => !usedAreas.has(areaOf(e)))) || cands[0];
    used.add(pick.jcode);
    usedAreas.add(areaOf(pick));
    out.push({ line, entry: pick, areaLabel: areaOf(pick) });
  }
  return out;
}

/** ハブのリンク文（エリア×ジャンル×条件の名前は data/area_genre_pages_policy.json から組む） */
function hubLabel(hubPath, policy) {
  const m = hubPath.match(/^stores\/area\/([^/]+)\/([^/]+)\.html$/);
  if (!m) return null;
  const area = policy.areas.find(a => a.slug === m[1]);
  if (!area) return null;
  if (m[2] === 'index') return `${area.label}で探す`;
  const genre = [...policy.genres].sort((a, b) => b.slug.length - a.slug.length).find(g => m[2] === g.slug || m[2].startsWith(`${g.slug}-`));
  if (!genre) return null;
  if (m[2] === genre.slug) return `${area.label}の${genre.label}`;
  const cond = policy.conditions.find(c => m[2] === `${genre.slug}-${c.slug}`);
  return cond ? `${area.label}の${genre.label}（${cond.label}）` : null;
}

function renderBlock(cfg, picks, hubs, slug) {
  const items = picks.map(({ line, entry, areaLabel }) => {
    const s = entry.store;
    const facts = [areaLabel, s['ジャンル'], s['価格帯'], /^あり/.test(s['個室'] || '') ? '個室あり' : ''].filter(Boolean).map(esc).join(' / ');
    return `    <li><span class="nb-conclusion-label">${esc(line.label)}（${esc(rangeText(line))}）</span><a href="../stores/${entry.jcode}.html" onclick="${featureStoreOnclick(entry.jcode, slug)}">${esc(s['店名'])}</a><span class="nb-conclusion-facts">${facts}</span></li>`;
  }).join('\n');
  const hubHtml = hubs.length
    ? `\n  <p class="nb-conclusion-hubs"><span class="nb-conclusion-hubs-title">${esc(cfg.hubsTitle || 'エリアとジャンルで探す')}</span>${hubs.map(h => `<a href="../${h.path}">${esc(h.label)}</a>`).join('')}</p>`
    : '';
  return `${START}
<section class="nb-conclusion" aria-label="先に結論">
  <p class="nb-conclusion-title">${esc(cfg.title)}</p>
  <ul class="nb-conclusion-list">
${items}
  </ul>
  <p class="nb-conclusion-note">${esc(cfg.note)}</p>${hubHtml}
</section>
${END}`;
}

/** 区画を置き換える／外す／入れる（.art-body の先頭）。置けなければ null */
function placeBlock(html, block) {
  const re = new RegExp(`\\n?[ \\t]*${START}[\\s\\S]*?${END}`);
  if (re.test(html)) return html.replace(re, block ? `\n${block}` : '');
  if (!block) return html;
  const open = html.match(/<div class="art-body">/);
  if (!open) return null;
  const i = open.index + open[0].length;
  return html.slice(0, i) + `\n${block}` + html.slice(i);
}

function buildFor(slug, cfg, ctx) {
  const file = path.join(ROOT, 'features', `${slug}.html`);
  if (!fs.existsSync(file)) return { slug, error: 'ファイルが無い' };
  const html = fs.readFileSync(file, 'utf8');
  const entries = storesFromItemList(html)
    .filter(e => fs.existsSync(path.join(ROOT, 'stores', `${e.jcode}.html`)) && !ctx.closedRaw.includes(e.jcode))
    .map(e => ({ jcode: e.jcode, store: ctx.byId.get(e.jcode) }))
    .filter(e => e.store);
  const picks = pickLines(entries, cfg, ctx.policy);
  const hubs = (cfg.hubs || [])
    .filter(p => ctx.activeHubs.has(p) && fs.existsSync(path.join(ROOT, p)))
    .map(p => ({ path: p, label: hubLabel(p, ctx.policy) }))
    .filter(h => h.label);
  const block = picks.length >= 2 ? renderBlock(cfg, picks, hubs, slug) : '';
  const next = placeBlock(html, block);
  if (next == null) return { slug, error: '.art-body が無い' };
  return { slug, file, changed: next !== html, next, lines: picks.length };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? args[oi + 1] : null;
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const ctx = {
    policy: loadPolicy(),
    byId: new Map(loadStores().map(s => [String(s['ホットペッパーID'] || ''), s]).filter(([k]) => k)),
    activeHubs: new Set(manifest.pages.filter(p => p.status === 'active').map(p => p.path)),
    closedRaw: fs.existsSync(CLOSED) ? fs.readFileSync(CLOSED, 'utf8') : '',
  };
  let stale = 0, errors = 0;
  for (const [slug, cfg] of Object.entries(config.features || {})) {
    if (only && slug !== only) continue;
    const r = buildFor(slug, cfg, ctx);
    if (r.error) { errors++; console.error(`  ✗ ${slug}: ${r.error}`); continue; }
    if (r.changed) {
      stale++;
      if (!check) fs.writeFileSync(r.file, r.next);
    }
    console.log(`  ${r.changed ? (check ? '要更新' : '更新') : 'そのまま'} ${slug}（結論 ${r.lines} 行${r.lines < 2 ? '・2行未満のため出さない' : ''}）`);
  }
  console.log(`特集の冒頭の結論: ${check ? '要更新' : '更新'} ${stale} 本 / 失敗 ${errors} 本`);
  if (check && (stale || errors)) process.exit(1);
}

if (require.main === module) main();
module.exports = { storesFromItemList, inRange, rangeText, pickLines, hubLabel, renderBlock, placeBlock, START, END };
