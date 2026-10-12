'use strict';

/**
 * tests/breadcrumb_oneline.test.js — パンくずを折り返さず 1 行にする（I-37・U-53・U-85）
 *
 * 事故（計測は docs/qa/uiux-2026-10/cls_diag.js・cls_stores.js）: パンくずが幅に応じて 2〜3 行に折り返し、Web フォントが
 * 届くたびに文字の幅が変わって折り返しが変わり、下の部分が 20〜50px 動いた（CLS）。ハブで 0.65（10 周のうち 3 回）、
 * 店舗ページ（エリア名が長い店）で 0.126〜0.128。
 * 直し方: 1 行に収める（white-space:nowrap・flex-wrap:nowrap）。入りきらないときは折り返さず横にスクロールする（overflow-x:auto）。
 * 右端は薄く消して（mask-image）続きがあることを示し、フォーカスの移動で端の薄い所に隠れないよう scroll-padding を持つ。
 *
 * ここでは静的に次を見る（動的な確かめは cls_diag.js・cls_stores.js）。
 *   1. assets/css/nb.css の `.breadcrumb` が上の 5 つを持つ
 *   2. 店舗ページの生成器（gen-store-pages.js）のページ内 CSS の `.breadcrumb` が flex-wrap:nowrap（wrap に戻さない）
 *   3. 手で保守している他のテンプレート・生成器が、`.breadcrumb` に折り返し（flex-wrap:wrap・white-space:normal など）を戻す規則を持たない
 * 読むのは手で保守している CSS とテンプレートだけで、日次で作り直す stores/・journal/ の記事は見ない
 * （build.yml は npm test を再生成より前に回すので、生成物を読むテストは前の日の生成物を見てしまう）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * `.breadcrumb` ちょうどを選択子にする規則の宣言を、[[prop, value], ..] の配列にして全部返す。
 * css:true のときだけ /* … *\/ のコメントを除く（JS の中の `stores/*.html` のような文字列を、コメントの始まりと取り違えない）
 */
function breadcrumbRules(text, { css = false } = {}) {
  const src = css ? String(text).replace(/\/\*[\s\S]*?\*\//g, '') : String(text);
  const out = [];
  for (const m of src.matchAll(/(^|[{};,\s>+~])\.breadcrumb\s*\{([^{}]*)\}/g)) {
    out.push(m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).replace(/!important/i, '').replace(/\s+/g, ' ').trim()];
    }).filter(Boolean));
  }
  return out;
}

const valueOf = (decls, prop) => { const hit = decls.filter(([p]) => p === prop); return hit.length ? hit[hit.length - 1][1] : null; };

test('nb.css: .breadcrumb は 1 行にして、入りきらなければ横にスクロールする', () => {
  const rules = breadcrumbRules(read('assets/css/nb.css'), { css: true });
  assert.equal(rules.length, 1, 'nb.css の .breadcrumb の規則は 1 つにまとめる（分けると片方だけ消えても気づけない）');
  const d = rules[0];
  assert.equal(valueOf(d, 'white-space'), 'nowrap', 'white-space:nowrap');
  assert.equal(valueOf(d, 'overflow-x'), 'auto', 'overflow-x:auto');
  assert.equal(valueOf(d, 'scrollbar-width'), 'none', 'スクロールバーは出さない（指でなぞる。フォーカスの移動でも動く）');
});

test('nb.css: 右端を薄く消して続きがあることを示し、フォーカスの移動で端に隠れない', () => {
  const d = breadcrumbRules(read('assets/css/nb.css'), { css: true })[0];
  const mask = valueOf(d, 'mask-image') || '';
  assert.match(mask, /linear-gradient\(\s*to right\s*,\s*#000 calc\(100% - [\d.]+rem\)\s*,\s*transparent\s*\)/, '右端だけを薄く消す mask-image');
  assert.equal(valueOf(d, '-webkit-mask-image'), mask, 'Safari 向けの -webkit-mask-image も同じ値');
  const fade = Number(((mask.match(/calc\(100% - ([\d.]+)rem\)/) || [])[1]));
  const pad = String(valueOf(d, 'scroll-padding-inline') || '');
  assert.ok(Number.isFinite(fade) && fade > 0, 'フェードの幅が読める');
  assert.equal(pad, `${fade}rem`, `scroll-padding-inline はフェードの幅（${fade}rem）と同じ`);
  assert.ok(/\.breadcrumb::-webkit-scrollbar\s*\{\s*display\s*:\s*none/.test(read('assets/css/nb.css')), 'WebKit 系のスクロールバーも出さない');
});

test('gen-store-pages.js: 店舗ページのページ内 CSS の .breadcrumb は折り返さない（flex-wrap:nowrap）', () => {
  const rules = breadcrumbRules(read('gen-store-pages.js'));
  assert.equal(rules.length, 1, '店舗ページのテンプレートの .breadcrumb の規則は 1 つ');
  assert.equal(valueOf(rules[0], 'display'), 'flex');
  assert.equal(valueOf(rules[0], 'flex-wrap'), 'nowrap', 'flex-wrap:nowrap（wrap だと 2〜3 行に折り返して、フォントが届くたびに動く）');
});

test('手で保守しているテンプレート・生成器は、.breadcrumb に折り返しを戻さない', () => {
  const sources = ['journal/_template.html', 'scripts/gen_area_genre_pages.js', 'scripts/gen_industry_features.js', 'scripts/lib/site_chrome.js', 'gen-store-pages.js', 'assets/css/nb.css'];
  const bad = [];
  for (const rel of sources) {
    for (const d of breadcrumbRules(read(rel), { css: rel.endsWith('.css') })) {
      const wrap = valueOf(d, 'flex-wrap');
      const ws = valueOf(d, 'white-space');
      if (wrap && wrap !== 'nowrap') bad.push(`${rel}: flex-wrap:${wrap}`);
      if (ws && ws !== 'nowrap') bad.push(`${rel}: white-space:${ws}`);
    }
  }
  assert.deepEqual(bad, [], `折り返しを戻す規則: ${bad.join(' / ')}`);
});

test('パーサの自己検査: .breadcrumb ちょうどの規則だけを拾い、別の選択子やコメントは拾わない', () => {
  const css = '/* .breadcrumb{flex-wrap:wrap} */ .breadcrumb a{display:block}\n.container > .breadcrumb,.x{padding:0}\n.breadcrumb{white-space:nowrap;overflow-x:auto}\n.breadcrumb span{margin:0}\n.nb-breadcrumb{flex-wrap:wrap}';
  const rules = breadcrumbRules(css, { css: true });
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0], [['white-space', 'nowrap'], ['overflow-x', 'auto']]);
  assert.deepEqual(breadcrumbRules('x{}.breadcrumb { flex-wrap : wrap !important }').map((d) => valueOf(d, 'flex-wrap')), ['wrap']);
});
