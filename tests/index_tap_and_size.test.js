'use strict';

/**
 * tests/index_tap_and_size.test.js — トップ（index.html）の CSS で、押す所の高さと読む文字の大きさの床を守る
 * （I-26e・U-75・U-76）
 *
 * 事故: デザインシステムは「操作要素（ボタン・リンク・チップ）は 44px 以上」「読む文字は 13px 以上」とするのに、
 * トップの CSS は押す所を 32〜40px、文字を 12px 以下で上書きしていた（実ブラウザで、44px 未満の押す所が
 * 31 種類、13px 未満の文字が 12 種類）。div に委譲クリックを付けた部品（旧絞り込みパネルの .tg・.ft・.pt）は、
 * button や a だけを数える検査では見つからなかった。I-20 で絞り込みが絞り込みシート（.fs-chip・.fs-go など）に
 * 変わったので、押す所の一覧も新しい部品に置き換えた（旧パネルの部品の CSS は無くなった）。
 *
 * 動的な確かめは docs/qa/uiux-2026-10/tap_targets.js（実ブラウザで 8 つの状態×390px/1280px を数える）。
 * ここでは静的に次の 4 つを見る。
 *   1. 13px 未満の font-size を指定する規則が無い（var(--fs-2xs) = 12px も含む。写真クレジットなどで 12px が要る
 *      ときは、中身を確かめて ALLOWED_SMALL_FONT へ理由つきで足す）
 *   2. 押す所の規則は、height / min-height が 44px（var(--tap-min)）以上で、44px 未満に下げる規則が無い
 *      （@media の中の上書きも見る）。正方形のボタン（×・表示の切り替え・ページ送り）は幅も同じ。
 *      新しい押す所の部品を足したら REQUIRED_TAP へ足す
 *   3. 一覧に書いた押す所のクラスが、HTML か JS の中で実際に使われている（JS が作る絞り込みシートのボタンのクラス名を
 *      変えて、CSS の規則だけが残る、を防ぐ）
 *   4. 見た目を変えない丸ボタンとロゴとヘッダーのナビは、::after / ::before で当たり判定だけを 44px に広げている
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

const HEIGHT_PROPS = ['height', 'min-height'];
const WIDTH_PROPS = ['width', 'min-width'];
/** セレクターごとの height / min-height（props を渡せば width / min-width）の指定（px）。44px 未満があれば bad、44px 以上があれば ok */
function heightsFor(rules, selector, tokens, props) {
  const found = { ok: [], bad: [], rules: 0 };
  for (const r of rules) {
    if (!r.selectors.includes(selector)) continue;
    found.rules++;
    for (const [prop, value] of r.decls) {
      if (!(props || HEIGHT_PROPS).includes(prop)) continue;
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
  '.view-toggle button', '.pg-btn', '.fold-toggle', '.share-btn', '.clear-all-btn',
  '.geo-btn', '.results-summary-reset', '.store-index-area>summary', '.scene-chip', '.scene-index-list a',
  '.hpc a', '.ml', '.tb-filter', '.sort-select',
  // 絞り込みシート（I-20）と、検索欄の下の「絞り込み」ボタン
  '.filter-toggle-btn', '.fs-chip', '.fs-close', '.fs-reset', '.fs-go', '.fs-suggest-btn',
];
// 正方形のボタンは、幅も 44px 以上（高さだけでは、細いボタンが通ってしまう）
const REQUIRED_TAP_WIDTH = ['.fs-close', '.view-toggle button', '.pg-btn'];
// HTML にも JS にも出てこないクラス（理由つき）。部品が戻ったときに押す所の床が効くよう、REQUIRED_TAP には残す
const UNUSED_CLASS_OK = new Map([
  ['results-summary-reset', '規則（index.html の <style>）だけが残っていて、マークアップも JS も使っていない。I-20 より前から'],
]);

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

test('正方形のボタン（シートの ×・表示の切り替え・ページ送り）は、幅（width / min-width）も 44px 以上で、下げる規則が無い', () => {
  const problems = [];
  for (const sel of REQUIRED_TAP_WIDTH) {
    const w = heightsFor(RULES, sel, TOKENS, WIDTH_PROPS);
    if (!w.rules) problems.push(`${sel}: 規則が見つからない`);
    else if (!w.ok.length) problems.push(`${sel}: width / min-width で 44px 以上を指定していない`);
    if (w.bad.length) problems.push(`${sel}: 44px 未満の指定がある（${w.bad.join(', ')}）`);
  }
  assert.deepEqual(problems, []);
});

/** クラスが、マークアップの class="…"（JS が作る文字列の中も）か、JS の classList.add / toggle・className = で付けられているか */
function classIsApplied(body, cls) {
  const w = '(?<![A-Za-z0-9_-])' + cls + '(?![A-Za-z0-9_-])';
  return new RegExp('class=\\\\?["\'][^"\']*' + w).test(body)
    || new RegExp('classList\\.(?:add|toggle)\\(\\s*["\']' + w).test(body)
    || new RegExp('className\\s*=\\s*["\'][^"\']*' + w).test(body);
}
// <style> の外（マークアップと、絞り込みシートのボタンを作る JS の文字列）
const BODY_WITHOUT_STYLE = INDEX.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

test('押す所の一覧に書いたクラスは、マークアップか JS が実際に付けている（CSS の規則だけが残って、部品の名前が変わった、を防ぐ）', () => {
  const unused = [];
  for (const sel of REQUIRED_TAP) {
    for (const m of sel.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) {
      if (UNUSED_CLASS_OK.has(m[1])) continue;
      if (!classIsApplied(BODY_WITHOUT_STYLE, m[1])) unused.push(`${sel}（${m[1]}）`);
    }
  }
  assert.deepEqual(unused, [], '付けられていないクラス（部品の名前を変えたなら、REQUIRED_TAP と CSS も直す）');
});

test('読み取りの確かめ（クラス）: class="…"・JS が作る文字列の class="…"・classList.add・className = は見つけ、名前の一部だけ一致するものは見逃す', () => {
  const body = `<a class="x sort-select-wrap"></a> '<b class="fs-chip' + extra` + " el.classList.add('only-js'); el.className = 'p q-r';";
  assert.equal(classIsApplied(body, 'fs-chip'), true);
  assert.equal(classIsApplied(body, 'x'), true);
  assert.equal(classIsApplied(body, 'only-js'), true);
  assert.equal(classIsApplied(body, 'q-r'), true);
  assert.equal(classIsApplied(body, 'sort-select'), false, 'sort-select-wrap だけがある');
  assert.equal(classIsApplied(body, 'fs'), false);
  assert.equal(classIsApplied("document.querySelector('.fs-chip')", 'fs-chip'), false, 'セレクターで呼んでいるだけでは、付けているとは言えない');
});

test('使われていないクラスの例外（UNUSED_CLASS_OK）は、今も付けられていない／押す所の一覧にある（付けられ始めたら例外から外す）', () => {
  for (const cls of UNUSED_CLASS_OK.keys()) {
    assert.ok(!classIsApplied(BODY_WITHOUT_STYLE, cls), `${cls} が付けられ始めている。UNUSED_CLASS_OK から外す`);
    assert.ok(REQUIRED_TAP.some((sel) => sel.includes('.' + cls)), `${cls} が REQUIRED_TAP に無い`);
  }
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

test('読み取りの確かめ（幅）: 32px の width は見つけ、min-width のトークン・44px は通す。高さの指定は幅として読まない', () => {
  const rules = rulesOf(`
    .a{width:32px;height:44px}
    .b{min-width:var(--tap-min);height:20px}
    @media(max-width:640px){.c{width:40px}.c{min-width:44px!important}}
  `);
  assert.deepEqual(heightsFor(rules, '.a', TOKENS, WIDTH_PROPS), { ok: [], bad: ['width:32px'], rules: 1 });
  assert.deepEqual(heightsFor(rules, '.b', TOKENS, WIDTH_PROPS), { ok: ['min-width:var(--tap-min)'], bad: [], rules: 1 });
  assert.deepEqual(heightsFor(rules, '.c', TOKENS, WIDTH_PROPS), { ok: ['min-width:44px'], bad: ['width:40px'], rules: 2 });
  assert.deepEqual(heightsFor(rules, '.a', TOKENS), { ok: ['height:44px'], bad: [], rules: 1 }, '既定は高さ');
});
