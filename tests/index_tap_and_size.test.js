'use strict';

/**
 * tests/index_tap_and_size.test.js — トップ（index.html）の CSS で、押す所の高さと読む文字の大きさの床を守る
 * （I-26e・U-75・U-76）
 *
 * 事故: デザインシステムは「操作要素（ボタン・リンク・チップ）は 44px 以上」「読む文字は 13px 以上」とするのに、
 * トップの CSS は押す所を 32〜40px、文字を 12px 以下で上書きしていた（実ブラウザで、44px 未満の押す所が
 * 31 種類、13px 未満の文字が 12 種類）。div に委譲クリックを付けた部品（.tg・.ft・.pt）は、button や a だけを
 * 数える検査では見つからなかった。
 *
 * 動的な確かめは docs/qa/uiux-2026-10/tap_targets.js（実ブラウザで 8 つの状態×390px/1280px を数える）。
 * ここでは静的に次の 3 つを見る。
 *   1. 13px 未満の font-size を指定する規則が無い（var(--fs-2xs) = 12px も含む。写真クレジットなどで 12px が要る
 *      ときは、中身を確かめて ALLOWED_SMALL_FONT へ理由つきで足す）
 *   2. 押す所の規則は、height / min-height が 44px（var(--tap-min)）以上で、44px 未満に下げる規則が無い
 *      （@media の中の上書きも見る）。新しい押す所の部品を足したら REQUIRED_TAP へ足す
 *   3. 見た目を変えない丸ボタンとロゴとヘッダーのナビは、::after / ::before で当たり判定だけを 44px に広げている
 * 読むのは手で保守している CSS（index.html の <style> と assets/css/nb.css）だけで、日次で作り直す
 * LOCAL_STORES・stores/・journal/ などは見ない。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const NB_CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'nb.css'), 'utf8');

const FONT_FLOOR_PX = 13;
const TAP_MIN_PX = 44;

/** <style> の中身を連結し、コメントを除く */
function styleText(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** CSS の規則を [{ selectors: [..], decls: [[prop, value], ..] }] に分ける（@media の入れ子の中も拾う） */
function rulesOf(cssText) {
  const css = String(cssText).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const head = m[1].trim();
    if (/^@/.test(head)) continue;
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return i < 0 ? null : [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).replace(/!important/i, '').trim()];
    }).filter(Boolean);
    out.push({ selectors: head.split(',').map((s) => s.replace(/\s+/g, ' ').trim()), decls });
  }
  return out;
}

/** nb.css の :root からトークンの px 値を読む（clamp() は下限） */
function tokenTable(css) {
  const t = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    const px = valueToPx(m[2].trim(), t);
    if (px !== null && !(m[1] in t)) t[m[1]] = px;
  }
  return t;
}

/** 値を px にする。var(--x)・px・rem だけ読み、em・%・calc・キーワードは null（判断しない） */
function valueToPx(value, tokens) {
  const v = String(value).trim();
  let m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/i);
  if (m) return m[1] in tokens ? tokens[m[1]] : (m[2] ? valueToPx(m[2], tokens) : null);
  m = v.match(/^clamp\(\s*([^,]+),/i);
  if (m) return valueToPx(m[1], tokens);
  m = v.match(/^(-?[\d.]+)(px|rem)$/i);
  if (m) return Number(m[1]) * (m[2].toLowerCase() === 'rem' ? 16 : 1);
  return null;
}

const TOKENS = tokenTable(NB_CSS);
const RULES = rulesOf(styleText(INDEX));
const NB_RULES = rulesOf(styleText(`<style>${NB_CSS}</style>`));

/** 13px 未満の読む文字の指定（セレクター → 値） */
function smallFonts(rules, tokens) {
  const out = [];
  for (const r of rules) {
    for (const [prop, value] of r.decls) {
      if (prop !== 'font-size') continue;
      const px = valueToPx(value, tokens);
      if (px !== null && px < FONT_FLOOR_PX - 0.01) out.push(`${r.selectors.join(', ')} { font-size:${value} }`);
    }
  }
  return out;
}

/** セレクターごとの height / min-height の指定（px）。44px 未満があれば bad、44px 以上があれば ok */
function heightsFor(rules, selector, tokens) {
  const found = { ok: [], bad: [], rules: 0 };
  for (const r of rules) {
    if (!r.selectors.includes(selector)) continue;
    found.rules++;
    for (const [prop, value] of r.decls) {
      if (prop !== 'height' && prop !== 'min-height') continue;
      const px = valueToPx(value, tokens);
      if (px === null) continue;
      (px >= TAP_MIN_PX - 0.01 ? found.ok : found.bad).push(`${prop}:${value}`);
    }
  }
  return found;
}

// 12px 未満・13px 未満でよい所（中身を確かめた理由つき）。トップには今は無い
const ALLOWED_SMALL_FONT = new Map();

// 押す所の規則（height / min-height が 44px 以上でなければならないセレクター）
const REQUIRED_TAP = [
  '.search-clear-btn', '.sticky-search input', '.sticky-search-btn', '.mobile-cta-bar .cta-search', '.mobile-cta-bar .cta-filter',
  '.view-toggle button', '.cap-input', '.pg-btn', '.fold-toggle', '.tag-reset', '.share-btn', '.clear-all-btn',
  '.geo-btn', '.filter-panel-cta-reset', '.results-summary-reset', '.store-index-area>summary', '.scene-chip', '.scene-index-list a',
  '.hpc a', '.ft', '.pt', '.at', '.tg', '.ml', '.tb-filter', '.sort-select',
];

test('トークンを nb.css から読めている（読めなければこのテストが空振りする）', () => {
  assert.equal(TOKENS['--tap-min'], TAP_MIN_PX);
  assert.equal(TOKENS['--fs-2xs'], 12);
  assert.equal(TOKENS['--fs-xs'], 13);
  assert.equal(TOKENS['--fs-sm'], 14);
  assert.ok(RULES.length > 500, `index.html の規則が ${RULES.length} 件しか読めなかった`);
});

test('トップの CSS に、13px 未満の font-size は無い（var(--fs-2xs) の 12px も含む）', () => {
  const bad = smallFonts(RULES, TOKENS).filter((s) => ![...ALLOWED_SMALL_FONT.keys()].some((k) => s.startsWith(k)));
  assert.deepEqual(bad, [], `読む文字は 13px 以上（var(--fs-xs) 以上）にする: ${bad.join(' / ')}`);
});

test('押す所の規則は、height / min-height が 44px（var(--tap-min)）以上で、下げる規則が無い', () => {
  const problems = [];
  for (const sel of REQUIRED_TAP) {
    const h = heightsFor(RULES, sel, TOKENS);
    if (!h.rules) problems.push(`${sel}: 規則が見つからない（セレクターを変えたなら REQUIRED_TAP も直す）`);
    else if (!h.ok.length) problems.push(`${sel}: height / min-height で 44px 以上を指定していない`);
    if (h.bad.length) problems.push(`${sel}: 44px 未満の指定がある（${h.bad.join(', ')}）`);
  }
  assert.deepEqual(problems, []);
});

test('見た目を変えない丸ボタン（.fav-btn）は、::after で当たり判定だけを 44px にしている（リスト表示でも）', () => {
  const sizeOf = (r, p) => valueToPx((r.decls.find((d) => d[0] === p) || [])[1] || '', TOKENS);
  const insetOf = (r) => { const d = r.decls.find((x) => x[0] === 'inset'); return d ? valueToPx(d[1], TOKENS) : null; };
  // 通常（カード右上）: .fav-btn が 34px で、::after は position:absolute・inset 負の値
  const base = RULES.find((r) => r.selectors.includes('.fav-btn'));
  const after = RULES.find((r) => r.selectors.includes('.fav-btn::after'));
  assert.ok(base && after, '.fav-btn と .fav-btn::after の規則が見つからない');
  assert.ok(after.decls.some((d) => d[0] === 'position' && d[1] === 'absolute'), '.fav-btn::after に position:absolute が無い');
  assert.ok(after.decls.some((d) => d[0] === 'content'), '.fav-btn::after に content が無い');
  const w = sizeOf(base, 'width'), h = sizeOf(base, 'height'), ins = insetOf(after);
  assert.ok(w !== null && h !== null && ins !== null && ins < 0, '.fav-btn の大きさか ::after の inset が読めない');
  assert.ok(Math.min(w, h) + 2 * -ins >= TAP_MIN_PX, `.fav-btn の当たり判定が ${Math.min(w, h) + 2 * -ins}px しかない`);
  // リスト表示（.grid.list-mode）: 位置と色だけを変える規則で、ボタンの大きさは通常のまま（I-19・0036）。
  // 当たり判定は通常の規則（34px ＋ ::after の inset）がそのまま効く。大きさや ::after を上書きするなら、44px 以上を保つこと
  const listBase = RULES.find((r) => r.selectors.includes('.grid.list-mode .fav-btn'));
  const listAfter = RULES.find((r) => r.selectors.includes('.grid.list-mode .fav-btn::after'));
  assert.ok(listBase, 'リスト表示の .fav-btn の規則が見つからない');
  const own = (r, p) => (r ? sizeOf(r, p) : null);
  const lw = own(listBase, 'width') ?? w, lh = own(listBase, 'height') ?? h;
  const lins = listAfter && insetOf(listAfter) !== null ? insetOf(listAfter) : ins;
  assert.ok(lins < 0, 'リスト表示の ::after の inset が負の値ではない');
  assert.ok(Math.min(lw, lh) + 2 * -lins >= TAP_MIN_PX, `リスト表示の .fav-btn の当たり判定が ${Math.min(lw, lh) + 2 * -lins}px しかない`);
  // ::after（position:absolute）の基準は、ボタン自身が位置を持つこと（absolute か relative）
  const pos = (listBase.decls.find((d) => d[0] === 'position') || base.decls.find((d) => d[0] === 'position') || [])[1];
  assert.ok(pos === 'absolute' || pos === 'relative', `リスト表示の .fav-btn が position を持たない（${pos}）。::after の基準にならない`);
});

test('ロゴとヘッダーのナビは、::after / ::before で当たり判定だけを 44px に広げている（共通 CSS・見た目は変えない）', () => {
  const logo = NB_RULES.find((r) => r.selectors.includes('.logo::after'));
  assert.ok(logo, 'nb.css に .logo::after が無い');
  assert.deepEqual((logo.decls.find((d) => d[0] === 'height') || [])[1], 'var(--tap-min)');
  assert.ok(NB_RULES.some((r) => r.selectors.includes('.logo') && r.decls.some((d) => d[0] === 'position' && d[1] === 'relative')), '.logo に position:relative が無い');
  const nav = NB_RULES.find((r) => r.selectors.includes('#main-nav a::before'));
  assert.ok(nav, 'nb.css に #main-nav a::before が無い');
  assert.deepEqual((nav.decls.find((d) => d[0] === 'height') || [])[1], 'var(--tap-min)');
  // .logo を inline-flex にすると「Nagoya」と「Bites」の間の空白が消える
  const logoBox = NB_RULES.filter((r) => r.selectors.includes('.logo')).flatMap((r) => r.decls);
  assert.ok(!logoBox.some((d) => d[0] === 'display' && /flex/.test(d[1])), '.logo を flex にすると、ロゴの語の間の空白が消える');
});

test('読み取りの確かめ: 12px・.78rem・36px の指定は見つけ、トークン・44px は通す（入れ子の @media・複数セレクター・コメントも）', () => {
  const css = `
    /* .commented{font-size:11px;min-height:20px} */
    .a,.b .c{font-size:var(--fs-2xs);min-height:36px}
    @media(max-width:640px){.d{font-size:.78rem;height:40px}.e{font-size:var(--fs-xs);min-height:var(--tap-min)}}
    .f{font-size:1.1em;line-height:1}
    .g{font-size:14px !important;height:44px!important}
  `;
  const rules = rulesOf(css);
  assert.deepEqual(smallFonts(rules, TOKENS), ['.a, .b .c { font-size:var(--fs-2xs) }', '.d { font-size:.78rem }']);
  assert.deepEqual(heightsFor(rules, '.a', TOKENS), { ok: [], bad: ['min-height:36px'], rules: 1 });
  assert.deepEqual(heightsFor(rules, '.d', TOKENS), { ok: [], bad: ['height:40px'], rules: 1 });
  assert.deepEqual(heightsFor(rules, '.e', TOKENS), { ok: ['min-height:var(--tap-min)'], bad: [], rules: 1 });
  assert.deepEqual(heightsFor(rules, '.g', TOKENS), { ok: ['height:44px'], bad: [], rules: 1 });
  assert.deepEqual(heightsFor(rules, '.none', TOKENS), { ok: [], bad: [], rules: 0 });
});
