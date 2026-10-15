'use strict';

/**
 * 動きの段階 3b（判断の記録 0050・Linear P-500）の試験。
 *   C-1・C-2 閉じる動き: 絞り込みシートとクイックビューは下へ戻ってから消える（nbLeave / nbLeaveFinish・.is-closing）
 *   C-4 着いた場所の光: 飛んだ先を色だけで 1 回光らせる（nbLand・.nb-landed）
 *   B-3 一覧の形の変化: グリッド⇄リストを同じページの View Transitions で切り替える（setViewMode）
 * index.html の実物の関数を取り出し、偽の DOM・偽のタイマーの上で動かす。CSS は文字列で確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NB = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'design_system.json'), 'utf8'));
const motion = require(path.join(ROOT, 'scripts', 'lib', 'motion_audit.js'));

function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `function ${name} は 1 つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}
function lineOf(prefix) {
  const a = INDEX.indexOf('\n' + prefix);
  assert.ok(a >= 0, prefix + ' が見つからない');
  return INDEX.slice(a + 1, INDEX.indexOf('\n', a + 1));
}
const plain = (x) => JSON.parse(JSON.stringify(x));

// ── 偽のタイマー（時刻を進めた分だけ実行する） ──
function makeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { at: now + (ms || 0), fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

// ── 偽の要素（クラス・属性・イベント） ──
function makeEl(opts) {
  opts = opts || {};
  const cls = new Set(opts.cls || []);
  const attrs = new Map(Object.entries(opts.attrs || {}));
  const listeners = {};
  const style = {};
  const el = {
    id: opts.id || '',
    innerHTML: opts.innerHTML || '',
    offsetWidth: 100,
    style: Object.assign(style, {
      setProperty(k, v) { style[k] = v; },
      removeProperty(k) { delete style[k]; },
    }),
    classList: {
      add: (c) => { cls.add(c); },
      remove: (c) => { cls.delete(c); },
      contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); return cls.has(c); },
    },
    hasAttribute: (k) => attrs.has(k),
    setAttribute: (k, v) => { attrs.set(k, String(v)); },
    removeAttribute: (k) => { attrs.delete(k); },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    fire: (t, ev) => { (listeners[t] || []).slice().forEach((f) => f(Object.assign({ type: t }, ev || {}))); },
    listenerCount: (t) => (listeners[t] || []).length,
    getBoundingClientRect: () => opts.rect || { top: 0, bottom: 100 },
    querySelector: (sel) => (opts.children && opts.children[sel]) || null,
    querySelectorAll: (sel) => (opts.all && opts.all[sel]) || [],
    get className() { return [...cls].join(' '); },
  };
  return el;
}

// ── C-1・C-2 閉じる動き ────────────────────────────────────────────────
function leaveEnv(opts) {
  opts = opts || {};
  const clock = makeClock();
  const window = {};
  if (opts.matchMedia !== false) {
    window.matchMedia = (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' && !!opts.reduce });
  }
  const ctx = { window, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(['nbMotionOk', 'nbLeave', 'nbLeaveFinish'].map(fnSource).join('\n'), ctx);
  return { ctx, clock };
}

test('C-1: 動かせる端末では .is-closing と inert を付けて待ち、閉じる動き（〜Out）が終わったら外して後片付けを 1 回だけする', () => {
  const { ctx, clock } = leaveEnv();
  const el = makeEl();
  let done = 0;
  ctx.nbLeave(el, () => { done++; });
  assert.ok(el.classList.contains('is-closing'));
  assert.ok(el.hasAttribute('inert'), '閉じる途中の面には焦点が入らない');
  assert.equal(done, 0, '動きが終わるまで片付けない');
  el.fire('animationend', { animationName: 'nbSheetIn' });   // 出る動きの終わりでは終えない
  assert.equal(done, 0);
  el.fire('animationend', { animationName: 'nbSheetOut' });
  assert.equal(done, 1);
  assert.ok(!el.classList.contains('is-closing'));
  assert.ok(!el.hasAttribute('inert'));
  assert.equal(el.listenerCount('animationend'), 0, '聞き手を外す');
  el.fire('animationend', { animationName: 'nbFadeOut' });
  clock.advance(1000);
  assert.equal(done, 1, '2 回目は無い（保険のタイマーも止まる）');
});

test('C-1: animationend が来なくても 400ms で必ず終える', () => {
  const { ctx, clock } = leaveEnv();
  const el = makeEl();
  let done = 0;
  ctx.nbLeave(el, () => { done++; });
  clock.advance(399);
  assert.equal(done, 0);
  clock.advance(1);
  assert.equal(done, 1);
  assert.ok(!el.classList.contains('is-closing'));
});

test('C-1: 動きを減らす設定・matchMedia の無い環境では待たずに片付け、クラスもタイマーも付けない', () => {
  for (const env of [leaveEnv({ reduce: true }), leaveEnv({ matchMedia: false })]) {
    const el = makeEl();
    let done = 0;
    env.ctx.nbLeave(el, () => { done++; });
    assert.equal(done, 1);
    assert.ok(!el.classList.contains('is-closing'));
    assert.ok(!el.hasAttribute('inert'));
    assert.equal(env.clock.pending(), 0);
  }
  // 要素が無くても後片付けはする
  const { ctx } = leaveEnv();
  let done = 0;
  ctx.nbLeave(null, () => { done++; });
  assert.equal(done, 1);
});

test('C-1: 閉じる途中に開き直す（nbLeaveFinish）と、その場で片付けて終える。もともと inert だった面の印は外さない', () => {
  const { ctx, clock } = leaveEnv();
  const el = makeEl();
  let done = 0;
  ctx.nbLeave(el, () => { done++; });
  clock.advance(100);
  ctx.nbLeaveFinish(el);
  assert.equal(done, 1);
  assert.ok(!el.classList.contains('is-closing'));
  clock.advance(1000);
  assert.equal(done, 1);
  ctx.nbLeaveFinish(el);   // 何も起きない
  assert.equal(done, 1);

  const pre = makeEl({ attrs: { inert: '' } });
  ctx.nbLeave(pre, () => {});
  clock.advance(400);
  assert.ok(pre.hasAttribute('inert'), '自分が付けていない inert は残す');

  // 閉じる動きの間にもう一度閉じても、前の後片付けを先に済ませて数え直す
  const twice = makeEl();
  const log = [];
  ctx.nbLeave(twice, () => log.push('a'));
  ctx.nbLeave(twice, () => log.push('b'));
  assert.deepEqual(log, ['a']);
  clock.advance(400);
  assert.deepEqual(log, ['a', 'b']);
});

// closeM を、本物の nbLeave と偽の DOM で動かす
function closeEnv(opts) {
  opts = opts || {};
  const clock = makeClock();
  const ov = makeEl({ id: 'ov', cls: opts.open === false ? [] : ['open'] });
  const els = {
    ov,
    'mobile-cta-bar': makeEl(),
    'mig-container': makeEl({ innerHTML: '<iframe>' }),
    'mig-wrap': makeEl(),
    'm-sticky-cta': makeEl({ innerHTML: '<a>予約</a>' }),
  };
  const calls = { history: 0, release: [] };
  const ctx = {
    window: { matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' && !!opts.reduce }) },
    document: { body: { style: {} }, getElementById: (id) => els[id] || null },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, Date,
    NB_SWAP: 0, NB_OPEN_STORE_ID: 'x',
    nbModalHistoryClose: () => { calls.history++; },
    nbQvRelease: (swap, wasOpen) => { calls.release.push([swap, wasOpen]); },
  };
  vm.createContext(ctx);
  vm.runInContext(['nbMotionOk', 'nbLeave', 'nbLeaveFinish', 'closeM'].map(fnSource).join('\n'), ctx);
  return { ctx, clock, els, calls };
}

test('C-1: closeM は .open を先に外し、Instagram と行動バーは閉じる動きが終わってから片付ける。履歴と焦点はすぐ戻す', () => {
  const e = closeEnv();
  e.ctx.closeM();
  assert.ok(!e.els.ov.classList.contains('open'), '開いているかの判定はすぐ偽になる');
  assert.ok(e.els.ov.classList.contains('is-closing'));
  assert.equal(e.els['m-sticky-cta'].innerHTML, '<a>予約</a>', '下へ戻る間は中身を残す');
  assert.equal(e.calls.history, 1);
  assert.deepEqual(plain(e.calls.release), [[false, true]]);
  e.els.ov.fire('animationend', { animationName: 'nbSheetOut' });
  assert.equal(e.els['m-sticky-cta'].innerHTML, '');
  assert.equal(e.els['mig-container'].innerHTML, '');
  assert.equal(e.els['mig-wrap'].style.display, 'none');
});

test('C-1: 似たお店への切り替え（swap）・もともと閉じていた・動きを減らす設定は、待たずに片付ける', () => {
  for (const [label, e, opts] of [
    ['swap', closeEnv(), { swap: true }],
    ['閉じ済み', closeEnv({ open: false }), undefined],
    ['動きを減らす', closeEnv({ reduce: true }), undefined],
  ]) {
    e.ctx.closeM(opts);
    assert.ok(!e.els.ov.classList.contains('is-closing'), label);
    assert.equal(e.els['m-sticky-cta'].innerHTML, '', label);
    assert.equal(e.clock.pending(), 0, label);
  }
});

test('C-1: シートとクイックビューは開く前に閉じる動きを終える。シートを閉じるときは nbLeave を通す', () => {
  const open = fnSource('nbOpenFilterSheet');
  assert.ok(open.indexOf('nbLeaveFinish(wrap);') > open.indexOf('NB_SHEET.leaving) return;'));
  assert.ok(open.indexOf('nbLeaveFinish(wrap);') < open.indexOf("wrap.classList.add('open');"));
  assert.match(fnSource('nbCloseFilterSheet'), /wrap\.classList\.remove\('open'\); nbLeave\(wrap\);/);
  const om = fnSource('openM');
  assert.ok(om.indexOf("nbLeaveFinish(document.getElementById('ov'))") > 0 && om.indexOf("nbLeaveFinish(document.getElementById('ov'))") < om.indexOf('nbQvRememberOpener();'),
    'openM は最初に、閉じる途中のクイックビューを片付ける');
});

test('C-1・C-2 の CSS: 閉じる途中も表示して下の画面を押せる。出入りは動きを減らさない設定の中だけで、時間とカーブはトークン', () => {
  assert.match(INDEX, /\n\.filter-sheet-wrap\.open,\.filter-sheet-wrap\.is-closing\{display:flex;/);
  assert.match(INDEX, /\n\.filter-sheet-wrap\.is-closing,\.filter-sheet-wrap\.is-closing \*\{pointer-events:none;\}/);
  assert.match(INDEX, /\n\.ov\.open,\.ov\.is-closing\{display:flex;\}/);
  assert.match(INDEX, /\n\.ov\.is-closing,\.ov\.is-closing \*\{pointer-events:none;\}/);
  assert.match(INDEX, /@media\(min-width:769px\)\{\.filter-sheet-wrap\.open,\.filter-sheet-wrap\.is-closing\{align-items:center;\}/);
  // スマホ（下から出て下へ戻る）と、広い画面（その場で小さく出る）
  const blocks = INDEX.match(/@media \(prefers-reduced-motion:no-preference\)(?: and \(min-width:769px\))?\{[^@]*?\n\}/g) || [];
  const all = blocks.join('\n');
  for (const want of [
    '.filter-sheet-wrap.open .filter-sheet{animation:nbSheetIn var(--dur-sheet) var(--ease-emph-out);}',
    '.filter-sheet-wrap.is-closing .filter-sheet{animation:nbSheetOut var(--dur-base) var(--ease-emph-in) forwards;}',
    '.filter-sheet-wrap.is-closing .fs-backdrop{animation:nbFadeOut var(--dur-base) var(--ease-in) forwards;}',
    '.filter-sheet-wrap.open .filter-sheet{animation:nbPanelIn var(--dur-slow) var(--ease-emph-out);}',
    '.ov.open{animation:nbScrimIn var(--dur-sheet) var(--ease-out);}',
    '.ov.is-closing{animation:nbScrimOut var(--dur-base) var(--ease-in) forwards;}',
    '.ov.open .modal{animation:nbSheetIn var(--dur-sheet) var(--ease-emph-out);}',
    '.ov.is-closing .modal{animation:nbSheetOut var(--dur-base) var(--ease-emph-in) forwards;}',
    '.ov.is-closing .modal{animation:nbPanelOut var(--dur-base) var(--ease-emph-in) forwards;}',
  ]) assert.ok(all.includes(want), '無い: ' + want);
  // 動かすのは transform・opacity と暗幕の色だけ
  const kf = motion.keyframesMap(motion.parseDeclarations((INDEX.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n')));
  for (const name of ['nbSheetIn', 'nbSheetOut', 'nbPanelIn', 'nbPanelOut', 'nbFadeIn', 'nbFadeOut']) {
    assert.ok(kf[name], name + ' が無い');
    for (const p of kf[name]) assert.ok(['transform', 'opacity'].includes(p), name + ' が ' + p + ' を動かす');
  }
  for (const name of ['nbScrimIn', 'nbScrimOut']) assert.deepEqual([...kf[name]], ['background-color']);
  assert.ok(!/@keyframes (up|min)\{/.test(INDEX), '置き換えた古い keyframes は残さない');
  assert.ok(!/\n\.modal\{[^}]*animation:/.test(INDEX), '.modal の土台に動きを置かない（動きを減らす設定で出入りしない）');
});

test('トークン: 段階 3b の 4 つ（--dur-sheet・--ease-emph-out・--ease-emph-in・--dur-landed）が coreTokens と nb.css にあり、--dur-sheet は上限以内', () => {
  for (const t of ['--dur-sheet', '--ease-emph-out', '--ease-emph-in', '--dur-landed']) {
    assert.ok(DS.coreTokens.includes(t), t);
    assert.ok(new RegExp(t + '\\s*:').test(NB), t);
  }
  assert.match(NB, /--dur-sheet:300ms;/);
  assert.match(NB, /--ease-emph-out:cubic-bezier\(\.05,\.7,\.1,1\);/);
  assert.match(NB, /--ease-emph-in:cubic-bezier\(\.3,0,\.8,\.15\);/);
  assert.match(NB, /--dur-landed:700ms;/);
});

// ── C-4 着いた場所の光 ─────────────────────────────────────────────────
function landEnv(opts) {
  opts = opts || {};
  const clock = makeClock();
  const listeners = {};
  const window = {
    pageYOffset: opts.y || 0,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
  };
  const ctx = {
    window, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    nbScrollBehavior: () => (opts.reduce ? 'auto' : 'smooth'),
  };
  vm.createContext(ctx);
  vm.runInContext(lineOf('var NB_LAND = ') + '\n' + ['nbLandStop', 'nbLand'].map(fnSource).join('\n'), ctx);
  const fire = (t) => (listeners[t] || []).slice().forEach((f) => f({ type: t }));
  const count = (t) => (listeners[t] || []).length;
  return { ctx, clock, fire, count };
}

test('C-4: スクロールが止まってから光らせ（scrollend か、最後の scroll から 120ms）、1 秒で外す', () => {
  const e = landEnv({ y: 0 });
  const el = makeEl();
  e.ctx.nbLand(el, 900);
  e.clock.advance(100); e.fire('scroll');
  e.clock.advance(100); e.fire('scroll');
  e.clock.advance(100);
  assert.ok(!el.classList.contains('nb-landed'), '動いている間は光らせない');
  e.fire('scroll'); e.clock.advance(119);
  assert.ok(!el.classList.contains('nb-landed'));
  e.clock.advance(1);
  assert.ok(el.classList.contains('nb-landed'));
  assert.equal(e.count('scroll'), 0, '聞き手を外す');
  assert.equal(e.count('scrollend'), 0);
  e.clock.advance(999);
  assert.ok(el.classList.contains('nb-landed'));
  e.clock.advance(1);
  assert.ok(!el.classList.contains('nb-landed'), '1 回だけ光って消える');

  const f = landEnv({ y: 0 });
  const el2 = makeEl();
  f.ctx.nbLand(el2, 900);
  f.clock.advance(50); f.fire('scroll'); f.fire('scrollend');
  assert.ok(el2.classList.contains('nb-landed'), 'scrollend が来たらすぐ');
});

test('C-4: スクロールが始まらなければ 250ms、終わらなければ 1.5 秒で光らせる。動きを減らす設定は待たない', () => {
  const e = landEnv();
  const el = makeEl();
  e.ctx.nbLand(el, 600);
  e.clock.advance(250);
  assert.ok(el.classList.contains('nb-landed'));

  const f = landEnv();
  const el2 = makeEl();
  f.ctx.nbLand(el2, 600);
  for (let t = 0; t < 1400; t += 100) { f.clock.advance(100); f.fire('scroll'); }   // 1.4 秒まで動き続ける
  assert.ok(!el2.classList.contains('nb-landed'));
  f.clock.advance(100);
  assert.ok(el2.classList.contains('nb-landed'), '1.5 秒で打ち切って光らせる');

  const g = landEnv({ reduce: true });
  const el3 = makeEl();
  g.ctx.nbLand(el3, 600);
  assert.equal(g.count('scroll'), 0);
  g.clock.advance(0);
  assert.ok(el3.classList.contains('nb-landed'));
});

test('C-4: ほとんど動かない（48px 未満）ときは光らせない。続けて呼べば前の予約を取り消す', () => {
  const e = landEnv({ y: 500 });
  const el = makeEl();
  e.ctx.nbLand(el, 530);
  e.clock.advance(2000);
  assert.ok(!el.classList.contains('nb-landed'));
  assert.equal(e.clock.pending(), 0);

  const f = landEnv({ y: 0 });
  const a = makeEl(), b = makeEl();
  f.ctx.nbLand(a, 800);
  f.ctx.nbLand(b, 900);
  f.clock.advance(2000);
  assert.ok(!a.classList.contains('nb-landed'));
  assert.equal(f.count('scroll'), 0);
});

test('C-4: 光るのは結果の先頭・条件の札の行・特集の帯・新しいページの先頭の店。scrollTo の前に呼ぶ', () => {
  for (const name of ['scrollToResults', 'scrollToActiveConditions', 'scrollToMagazine', 'goToPage']) {
    const src = fnSource(name);
    const land = src.indexOf('nbLand(');
    assert.ok(land > 0, name + ' が nbLand を呼ばない');
    assert.ok(land < src.indexOf('window.scrollTo({ top: top'), name + ' は動く前の位置で測る');
    assert.match(src, /typeof nbLand === 'function'/);
  }
  assert.match(fnSource('scrollToMagazine'), /classList\.contains\('feature-strip'\)\) nbLand/, 'main 全体は光らせない');
  assert.match(fnSource('goToPage'), /querySelector\('\.card'\)/);
});

test('C-4 の CSS: 色だけ（背景色と輪郭の色）を 1 回。時間は --dur-landed。動きを減らす設定では動かさず輪郭だけ', () => {
  assert.match(NB, /\n\.nb-landed\{outline:2px solid transparent;outline-offset:-2px;animation:nbLanded var\(--dur-landed\) var\(--ease-in\) 1;\}/);
  const kf = motion.keyframesMap(motion.parseDeclarations(NB));
  assert.deepEqual([...kf.nbLanded].sort(), ['background-color', 'outline-color']);
  assert.match(NB, /@media\(prefers-reduced-motion:reduce\)\{\s*\.nb-landed\{animation:none;outline-color:[^}]*\}/);
  // --dur-landed は色だけの動きにしか使わない
  const uses = NB.split('var(--dur-landed)').length - 1 + INDEX.split('var(--dur-landed)').length - 1;
  assert.equal(uses, 1, '--dur-landed を使うのは .nb-landed だけ');
});

// ── B-3 一覧の形の変化 ────────────────────────────────────────────────
function viewEnv(opts) {
  opts = opts || {};
  const cards = [];
  for (let i = 0; i < (opts.cards || 24); i++) {
    const top = -300 + i * 120;   // 先頭の 2 枚は画面の上、その後ろが画面の中、さらに後ろは画面の下
    const ci = makeEl(), fav = makeEl();
    cards.push(makeEl({ rect: { top, bottom: top + 110 }, children: { '.ci': ci, '.fav-btn': fav } }));
  }
  const grid = makeEl({ cls: opts.list ? ['grid', 'list-mode'] : ['grid'], all: { '.card': cards, '.card .ci img': [] } });
  const calls = { vt: 0, applied: [], stored: [], namedDuring: null };
  let finish;
  const document = {
    getElementById: (id) => (id === 'grid' ? grid : null),
  };
  if (!opts.noVT) {
    document.startViewTransition = (cb) => {
      calls.vt++;
      calls.namedDuring = cards.filter((c) => c.style['view-transition-name']).length;
      cb();
      return { finished: new Promise((res) => { finish = res; }) };
    };
  }
  const ctx = {
    document,
    window: { innerHeight: 823, matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' && !!opts.reduce }) },
    localStorage: { setItem: (k, v) => calls.stored.push([k, v]) },
    calls,
  };
  vm.createContext(ctx);
  // applyViewMode は記録だけの偽物にして、setViewMode の流れを見る
  vm.runInContext('function applyViewMode(mode) { calls.applied.push(mode); document.getElementById("grid").classList.toggle("list-mode", mode === "list"); }\n'
    + ['nbMotionOk', 'setViewMode'].map(fnSource).join('\n'), ctx);
  return { ctx, calls, cards, finish: () => finish && finish() };
}

test('B-3: 画面に見えているカード（最大 16 枚）とその写真・♡ にだけ名前を付けて View Transitions で切り替え、終わったら外す', async () => {
  const e = viewEnv({ cards: 30 });
  e.ctx.setViewMode('list');
  assert.equal(e.calls.vt, 1);
  assert.deepEqual(plain(e.calls.applied), ['list']);
  const named = e.cards.filter((c) => c.style['view-transition-name']);
  assert.equal(e.calls.namedDuring, named.length);
  assert.ok(named.length > 0 && named.length <= 16);
  assert.ok(!e.cards[0].style['view-transition-name'] && !e.cards[1].style['view-transition-name'], '画面の上のカードには付けない');
  assert.equal(named[0].style['view-transition-name'], 'nb-vt-c0');
  assert.equal(named[0].style['view-transition-class'], 'nb-vt-card');
  assert.equal(named[0].querySelector('.ci').style['view-transition-name'], 'nb-vt-p0');
  assert.equal(named[0].querySelector('.ci').style['view-transition-class'], 'nb-vt-photo');
  assert.equal(named[0].querySelector('.fav-btn').style['view-transition-name'], 'nb-vt-f0');
  const names = named.map((c) => c.style['view-transition-name']);
  assert.equal(new Set(names).size, names.length, '名前は重ならない');
  e.finish();
  await new Promise((r) => setImmediate(r));
  assert.equal(e.cards.filter((c) => c.style['view-transition-name'] || c.querySelector('.ci').style['view-transition-name']).length, 0);
  assert.deepEqual(plain(e.calls.stored), [['nb_view', 'list']]);

  const many = viewEnv({ cards: 60 });
  // 画面を高くして、見えているカードが 16 枚を超える場合
  many.ctx.window.innerHeight = 5000;
  many.ctx.setViewMode('list');
  assert.equal(many.cards.filter((c) => c.style['view-transition-name']).length, 16);
});

test('B-3: 対応していない端末・動きを減らす設定・同じ表示への切り替えは、今のまま一瞬で替える', () => {
  for (const [label, e, mode] of [
    ['未対応', viewEnv({ noVT: true }), 'list'],
    ['動きを減らす', viewEnv({ reduce: true }), 'list'],
    ['同じ表示', viewEnv({ list: true }), 'list'],
  ]) {
    e.ctx.setViewMode(mode);
    assert.equal(e.calls.vt, 0, label);
    assert.deepEqual(plain(e.calls.applied), [mode], label);
    assert.equal(e.cards.filter((c) => c.style['view-transition-name']).length, 0, label);
    assert.deepEqual(plain(e.calls.stored), [['nb_view', mode]], label);
  }
});

test('B-3 の CSS: 群の時間はトークン。カードは伸び縮みさせず、写真は枠に合わせる。動きを減らす設定では ::view-transition-* も止める', () => {
  assert.match(INDEX, /\n::view-transition-group\(\*\)\{animation-duration:var\(--dur-slow\);animation-timing-function:var\(--ease-out\);\}/);
  assert.match(INDEX, /\n::view-transition-old\(\*\),::view-transition-new\(\*\)\{height:100%;object-fit:none;object-position:left top;\}/);
  assert.match(INDEX, /\n::view-transition-old\(\*\.nb-vt-photo\),::view-transition-new\(\*\.nb-vt-photo\)\{object-fit:cover;/);
  assert.match(NB, /@media\(prefers-reduced-motion:reduce\)\{[^@]*::view-transition-group\(\*\),::view-transition-old\(\*\),::view-transition-new\(\*\)\{animation:none!important;\}/);
});
