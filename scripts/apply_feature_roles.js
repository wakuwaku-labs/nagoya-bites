#!/usr/bin/env node
/**
 * 同じ主題の特集の「役割の違い」を示す相互リンクを、既存の「関連する特集」区画に当てる（診断項目18・冪等）。
 * 正本は data/feature_roles.json（主＝検索で受ける本命・従＝切り口の違う派生・張るリンクと一言の文言）。
 *
 *   node scripts/apply_feature_roles.js            # 書き込む
 *   node scripts/apply_feature_roles.js --check    # 当て漏れ・文言の違いがあれば exit 1
 *   node scripts/apply_feature_roles.js --dry-run  # 変わるファイルを表示するだけ
 *
 * - 新しい部品・CSS は作らない。各ページの最初の class="related" 区画の related-links に、そのページに
 *   既にあるチップと同じ形（class・onclick の計測つき）で足す。同じ行き先のチップが既にあれば文言だけ書き換える。
 * - 区画に nagoya-gourmet-guide のチップ（金色のハブ）があればその次、無ければ先頭に入れる。
 * - 変わったページは JSON-LD の dateModified を touchDate まで進める（画面の更新日は apply_feature_byline.js が
 *   JSON-LD から作る）。dateModified の無いページ（相談窓口）は日付に触れない。
 * - URL・title・h1・meta description・canonical・パンくずは触らない。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'features');
const HUB = 'nagoya-gourmet-guide';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_roles.json'), 'utf8'));

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** 1ページに1本のリンクを当てる。{ html, state: 'same' | 'relabel' | 'insert' } */
function applyEdge(html, edge) {
  const start = html.indexOf('<div class="related">');
  if (start === -1) throw new Error(`related 区画が無い: ${edge.from}`);
  const open = html.indexOf('<div class="related-links">', start);
  const close = html.indexOf('</div>', open);
  if (open === -1 || close === -1) throw new Error(`related-links が無い: ${edge.from}`);
  const bodyStart = open + '<div class="related-links">'.length;
  const body = html.slice(bodyStart, close);
  const lines = body.split('\n');

  const chipRe = (slug) => new RegExp(`<a [^>]*href="(?:/features/)?${esc(slug)}\\.html"[^>]*>([^<]*)</a>`);
  const hit = lines.findIndex((l) => chipRe(edge.to).test(l));
  if (hit >= 0) {
    const m = chipRe(edge.to).exec(lines[hit]);
    if (m[1] === edge.label) return { html, state: 'same' };
    lines[hit] = lines[hit].replace(m[0], m[0].replace(`>${m[1]}</a>`, `>${edge.label}</a>`));
    return { html: html.slice(0, bodyStart) + lines.join('\n') + html.slice(close), state: 'relabel' };
  }

  // 雛形: 区画のチップのうち、ハブでも枠付きでもない最初の1本
  const chipLines = lines.filter((l) => /<a [^>]*href="[^"]*\.html[^"]*"/.test(l));
  const tpl = chipLines.find((l) => !l.includes(`${HUB}.html`) && !l.includes('style=') && !/href="\.\.\//.test(l)) ||
    chipLines.find((l) => !l.includes('style='));
  if (!tpl) throw new Error(`雛形のチップが無い: ${edge.from}`);
  const tm = /href="((?:\/features\/)?)([a-z0-9-]+)\.html"/.exec(tpl);
  const fresh = tpl
    .split(`${tm[2]}.html`).join(`${edge.to}.html`)
    .replace(/>[^<]*<\/a>/, `>${edge.label}</a>`);
  const hubAt = lines.findIndex((l) => l.includes(`href="${HUB}.html"`));
  const at = hubAt >= 0 ? hubAt + 1 : lines.findIndex((l) => /<a /.test(l));
  lines.splice(at, 0, fresh);
  return { html: html.slice(0, bodyStart) + lines.join('\n') + html.slice(close), state: 'insert' };
}

function bumpDateModified(html, date) {
  let touched = false;
  const next = html.replace(/("dateModified"\s*:\s*")(\d{4}-\d{2}-\d{2})/g, (all, pre, d) => {
    if (d >= date) return all;
    touched = true;
    return pre + date;
  });
  return { html: next, touched };
}

const byPage = new Map();
for (const g of spec.groups) for (const e of g.edges) {
  if (!byPage.has(e.from)) byPage.set(e.from, []);
  byPage.get(e.from).push(e);
}

const tally = { insert: 0, relabel: 0, same: 0 };
const changed = [];
for (const [slug, edges] of byPage) {
  const file = path.join(DIR, `${slug}.html`);
  const before = fs.readFileSync(file, 'utf8');
  let html = before;
  // 先頭付近へ1本ずつ差し込むので、逆順に処理すると data の並びのまま画面に出る
  for (const e of [...edges].reverse()) {
    if (!fs.existsSync(path.join(DIR, `${e.to}.html`))) throw new Error(`行き先が無い: ${e.to}`);
    const r = applyEdge(html, e);
    html = r.html;
    tally[r.state]++;
  }
  if (html !== before) {
    html = bumpDateModified(html, spec.touchDate).html;
    changed.push(slug);
    if (!dryRun && !check) fs.writeFileSync(file, html);
  }
}

console.log(`特集の役割リンク: 足した ${tally.insert} 本 / 文言を書き換えた ${tally.relabel} 本 / 変更なし ${tally.same} 本 / 変わったページ ${changed.length} 本`);
for (const s of changed) console.log(`  ${s}`);
if (check && changed.length) process.exit(1);
