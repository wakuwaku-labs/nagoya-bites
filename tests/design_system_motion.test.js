'use strict';

/**
 * 動き（モーション）の判定器 scripts/lib/motion_audit.js と、audit_design_system.js への組み込みの試験
 * （動きの計画 5.3 節・段階 0）。5 つの検査それぞれの当たり・外れと、enforce の切り替えを固定する。
 * 段階 1（F1〜F8）の後の実物（index.html・nb.css・店舗ページの雛形）が決まりを守っていることも確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AUDIT = path.join(ROOT, 'scripts', 'audit_design_system.js');
const m = require(path.join(ROOT, 'scripts', 'lib', 'motion_audit.js'));
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'design_system.json'), 'utf8'));
const P = DS.motion;

const rules = (css) => m.auditCss(css, P, { file: 't.css' }).map((v) => v.rule);

test('policy: 動きのトークン 6 つが coreTokens と nb.css にあり、motion の節が決めた形', () => {
  const tokens = ['--dur-press', '--dur-fast', '--dur-base', '--dur-slow', '--ease-out', '--ease-in'];
  const nb = fs.readFileSync(path.join(ROOT, DS.cssPath), 'utf8');
  for (const t of tokens) {
    assert.ok(DS.coreTokens.includes(t), t + ' が coreTokens に無い');
    assert.ok(new RegExp(t + '\\s*:').test(nb), t + ' が nb.css に無い');
  }
  assert.equal(P.maxDurationMs, 300);
  assert.equal(P.enforce, true);   // 段階 1 で nb.css と index.html の違反を 0 にしてから上げた
  assert.deepEqual(P.enforceScopes, ['assets/css/nb.css', 'index.html']);
  assert.equal(P.scrollBehaviorFunction, 'nbScrollBehavior');
});

test('transition-all: 当たりと外れ', () => {
  assert.deepEqual(rules('.a{transition:all .2s}'), ['transition-all']);
  assert.deepEqual(rules('.a{transition-property:all}'), ['transition-all']);
  assert.deepEqual(rules('.a{-webkit-transition:opacity .2s,all .1s}'), ['transition-all']);
  assert.deepEqual(rules('.a{transition:opacity var(--dur-fast) var(--ease-out),transform var(--dur-base)}'), []);
  assert.deepEqual(rules('.a{transition:none}'), []);
});

test('motion-duration: s と ms を読む。上限ちょうどは可・超えると当たり・var(--dur-*) は可', () => {
  assert.deepEqual(rules('.a{transition:opacity .35s}'), ['motion-duration']);
  assert.deepEqual(rules('.a{transition:opacity 350ms}'), ['motion-duration']);
  assert.deepEqual(rules('.a{transition:opacity .3s}'), []);
  assert.deepEqual(rules('.a{transition:opacity 300ms}'), []);
  assert.deepEqual(rules('.a{animation:up .8s .2s forwards}'), ['motion-duration']);
  assert.deepEqual(rules('.a{transition-duration:.5s}'), ['motion-duration']);
  assert.deepEqual(rules('.a{animation-duration:400ms}'), ['motion-duration']);
  // 2 つめの時間は delay なので長くても数えない
  assert.deepEqual(rules('.a{transition:opacity .2s ease .5s}'), []);
  assert.deepEqual(rules('.a{transition:opacity var(--dur-slow) var(--ease-out)}'), []);
  // 例外のセレクタ
  assert.deepEqual(rules('.skel{animation:pulse 1.6s ease}'), []);
  assert.deepEqual(rules('.skeleton{animation:pulse 1.6s ease}'), ['motion-duration']);
});

test('色だけの例外（判断の記録 0050）: 色だけを変える動きは 1000ms まで。物を動かすもの・確かめられないものは当たり', () => {
  assert.deepEqual(P.colorOnlyException.maxDurationMs, 1000);
  assert.deepEqual(P.colorOnlyException.properties, ['color', 'background-color', 'border-color', 'outline-color']);
  assert.deepEqual(P.colorOnlyException.tokens, ['--dur-landed']);
  // animation: 同じ CSS の @keyframes の中身が色だけなら可
  assert.deepEqual(rules('.a{animation:x var(--dur-landed) ease 1}@keyframes x{from{background-color:red;outline-color:red}}'), []);
  assert.deepEqual(rules('.a{animation:x 700ms ease 1}@keyframes x{from{color:red}}'), []);
  assert.deepEqual(rules('.a{animation:x var(--dur-landed) ease 1}@keyframes x{from{transform:scale(1.1)}}'), ['motion-duration']);
  assert.deepEqual(rules('.a{animation:x 700ms ease 1}@keyframes x{from{color:red;opacity:0}}'), ['motion-duration']);
  assert.deepEqual(rules('.a{animation:x 1200ms ease 1}@keyframes x{from{color:red}}'), ['motion-duration'], '例外の上限を超える');
  assert.deepEqual(rules('.a{animation:nokf var(--dur-landed) ease 1}'), ['motion-duration'], 'keyframes が無いと確かめられない');
  // transition: 動かすプロパティが色だけなら可
  assert.deepEqual(rules('.a{transition:background-color 700ms ease}'), []);
  assert.deepEqual(rules('.a{transition:opacity var(--dur-landed) ease}'), ['motion-duration']);
  assert.deepEqual(rules('.a{transition:color var(--dur-landed) ease,opacity var(--dur-fast)}'), []);
  assert.deepEqual(rules('.a{transition:opacity 700ms ease}'), ['motion-duration']);
  // 長い形は何を動かすか読めないので許さない
  assert.deepEqual(rules('.a{animation-duration:var(--dur-landed)}'), ['motion-duration']);
  assert.deepEqual(rules('.a{transition-duration:700ms}'), ['motion-duration']);
  // トークンの定義: --dur-* は上限まで、例外のトークンは例外の上限まで
  assert.deepEqual(rules(':root{--dur-landed:700ms;--dur-sheet:300ms}'), []);
  assert.deepEqual(rules(':root{--dur-x:400ms}'), ['motion-duration']);
  assert.deepEqual(rules(':root{--dur-landed:1.2s}'), ['motion-duration']);
  // HTML では、別の <style> の keyframes も見る
  const html = '<style>@keyframes g{from{background-color:red}}</style><style>.a{animation:g var(--dur-landed) 1}</style>';
  assert.deepEqual(m.auditHtml(html, P, { file: 't.html' }).map((v) => v.rule), []);
  // 例外が無い設定では今までどおり
  const noEx = Object.assign({}, P, { colorOnlyException: undefined });
  assert.deepEqual(m.auditCss('.a{transition:background-color 700ms ease}', noEx, { file: 't.css' }).map((v) => v.rule), ['motion-duration']);
});

test('motion-infinite: 当たりと外れ（例外 .skel）', () => {
  assert.deepEqual(rules('.a{animation:spin .2s linear infinite}'), ['motion-infinite']);
  assert.deepEqual(rules('.a{animation-iteration-count:infinite}'), ['motion-infinite']);
  assert.deepEqual(rules('.skel{animation:pulse 1.6s ease infinite}'), []);
  assert.deepEqual(rules('.a{animation:spin .2s linear 3}'), []);
});

test('motion-layout-prop: transition のプロパティ名と keyframes の中身', () => {
  assert.deepEqual(rules('.a{transition:width .2s}'), ['motion-layout-prop']);
  assert.deepEqual(rules('.a{transition:opacity .2s,margin-right .2s}'), ['motion-layout-prop']);
  assert.deepEqual(rules('.a{transition-property:max-height,opacity}'), ['motion-layout-prop']);
  assert.deepEqual(rules('.a{transition:filter .1s}'), ['motion-layout-prop']);
  assert.deepEqual(rules('.a{transition:transform .2s,opacity .2s,box-shadow .15s,color .1s}'), []);
  assert.deepEqual(rules('@keyframes k{from{height:0}to{height:10px;opacity:1}}'), ['motion-layout-prop', 'motion-layout-prop']);
  assert.deepEqual(rules('@keyframes k{from{transform:none;opacity:0}to{transform:scale(1);opacity:1}}'), []);
  // 禁止プロパティが animation の名前に混ざっていても数えない
  assert.deepEqual(rules('.a{animation:width-ish .2s}'), []);
});

test('reduced-motion の中の規則は数えない。外の同じ規則は数える', () => {
  const inside = '@media (prefers-reduced-motion: reduce){*{transition:all 0s!important;animation:x 1s infinite}}';
  assert.deepEqual(rules(inside), []);
  assert.deepEqual(rules('@media (max-width:600px){.a{transition:all .2s}}'), ['transition-all']);
  assert.deepEqual(rules('.a{transition:opacity .2s}' + inside + '.b{transition:all .2s}'), ['transition-all']);
});

test('CSS の読み取り: コメント・url(data:;)・行番号', () => {
  const css = '/* transition:all .2s */\n.a{background:url(data:image/png;base64,AA);\n  transition:all .2s}';
  const v = m.auditCss(css, P, { file: 'x.css', lineOffset: 10 });
  assert.equal(v.length, 1);
  assert.equal(v[0].line, 13);
  assert.equal(v[0].selector, '.a');
  assert.equal(v[0].file, 'x.css');
  assert.ok(v[0].excerpt.includes('transition'));
});

test('smooth-scroll-js: 当たりと外れ（nbScrollBehavior を通したもの）', () => {
  const js = (s) => m.auditJs(s, P, { file: 'a.js' }).map((v) => v.rule);
  assert.deepEqual(js("window.scrollTo({top:0,behavior:'smooth'})"), ['smooth-scroll-js']);
  assert.deepEqual(js('el.scrollIntoView({ behavior: "smooth", block: "start" })'), ['smooth-scroll-js']);
  assert.deepEqual(js("window.scrollTo({top:0,behavior:nbScrollBehavior('smooth')})"), []);
  assert.deepEqual(js("el.scrollIntoView({behavior: nbScrollBehavior(), block:'start'})"), []);
  assert.deepEqual(js("window.scrollTo({top:0,behavior:'auto'})"), []);
});

test('auditHtml: <style>・インライン <script>・on*= 属性。src 付きと JSON-LD は見ない', () => {
  const html = [
    '<style>', '.a{transition:all .2s}', '</style>',
    '<button onclick="window.scrollTo({top:0,behavior:\'smooth\'})">x</button>',
    '<script src="x.js">behavior:\'smooth\'</script>',
    '<script type="application/ld+json">{"behavior":"smooth"}</script>',
    '<script>', "window.scrollTo({top:0,behavior:'smooth'});", '</script>',
  ].join('\n');
  const v = m.auditHtml(html, P, { file: 'p.html' });
  assert.deepEqual(v.map((x) => x.rule + ':' + x.line), ['transition-all:2', 'smooth-scroll-js:4', 'smooth-scroll-js:8']);
});

test('実物: 落とす対象（nb.css・index.html）の動きの違反は 0 件', () => {
  for (const f of P.enforceScopes) {
    const v = m.auditText(fs.readFileSync(path.join(ROOT, f), 'utf8'), P, f);
    assert.deepEqual(v.map((x) => x.rule + ' ' + f + ':' + x.line), [], f);
  }
});

const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('段階 1 F8: トップの見出し・説明・検索欄・シーンの導線は最初から見える（opacity:0 から始めない）', () => {
  const decls = m.parseDeclarations(INDEX.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)[1]);
  for (const sel of ['.hero .eyebrow', '.hero h1', '.hero-sub', '.search-wrap', '.scene-nav']) {
    const own = decls.filter((d) => d.selector === sel && !d.reduced);
    assert.ok(own.length > 0, sel + ' の規則が見つからない');
    assert.ok(!own.some((d) => d.prop === 'animation' || (d.prop === 'opacity' && d.value.trim() === '0')), sel + ' が入場の動きを持つ');
  }
});

test('段階 1 F5: ホバーで写真を大きくしない。カードのホバーは @media(hover:hover) の中だけ', () => {
  for (const sel of ['.card:hover .ci img', '.feature-card:hover .feature-card-thumb', '.tp-card:hover .tp-img']) {
    assert.ok(!INDEX.includes(sel + '{'), sel + ' が残っている');
  }
  for (const sel of ['.card:hover{', '.feature-card:hover{', '.latest-journal-card:hover{']) {
    const i = INDEX.indexOf(sel);
    assert.ok(i > 0, sel + ' が見つからない');
    assert.ok(INDEX.slice(i - 20, i).endsWith('@media(hover:hover){'), sel + ' が @media(hover:hover) の外にある');
    const body = INDEX.slice(i, INDEX.indexOf('}', i));
    assert.ok(!/transform/.test(body), sel + ' が動く（枠と影だけにする）');
  }
});

test('段階 1 F2: nbScrollBehavior は「動きを減らす」設定なら auto、それ以外と例外は smooth', () => {
  const vm = require('vm');
  const a = INDEX.indexOf('\nfunction nbScrollBehavior(');
  assert.ok(a > 0 && INDEX.indexOf('\nfunction nbScrollBehavior(', a + 1) < 0, 'nbScrollBehavior は 1 つだけ');
  // 頭の <script> で決める（onclick の属性から、本体の大きな <script> が届く前に呼ばれても動く）
  assert.ok(a < INDEX.indexOf('var LOCAL_STORES = ['), 'nbScrollBehavior が本体の <script> より後にある');
  const src = INDEX.slice(a + 1, INDEX.indexOf('\n}\n', a) + 2);
  const run = (window) => { const ctx = vm.createContext({ window }); vm.runInContext(src, ctx); return ctx.nbScrollBehavior(); };
  assert.equal(run({ matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) }), 'auto');
  assert.equal(run({ matchMedia: () => ({ matches: false }) }), 'smooth');
  assert.equal(run({}), 'smooth');
  assert.equal(run({ matchMedia: () => { throw new Error('x'); } }), 'smooth');
});

test('段階 1: 店舗ページの雛形（gen-store-pages.js）は transition:all と、nbScrollBehavior を通らない smooth を書き出さない', () => {
  const gen = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.ok(!/transition\s*:\s*all\b/.test(gen), 'transition:all が残っている');
  assert.deepEqual(m.auditJs(gen, P, { file: 'gen-store-pages.js' }).map((v) => v.line), []);
  assert.ok(/function nbScrollBehavior\(\)/.test(gen), '雛形が nbScrollBehavior を持たない');
});

test('enforcedViolations: enforce:false は空・true は enforceScopes のファイルだけ', () => {
  const vs = [
    { rule: 'transition-all', file: 'index.html' },
    { rule: 'transition-all', file: 'features/a.html' },
    { rule: 'motion-duration', file: 'assets/css/nb.css' },
  ];
  assert.deepEqual(m.enforcedViolations(vs, { ...P, enforce: false }), []);
  const on = m.enforcedViolations(vs, { ...P, enforce: true });
  assert.deepEqual(on.map((v) => v.file), ['index.html', 'assets/css/nb.css']);
});

// ── audit_design_system.js を小さな fixture で回す ───────────────────────────
function makeFixture(enforce) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-motion-'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.mkdirSync(path.join(dir, 'assets', 'css'), { recursive: true });
  const ds = JSON.parse(JSON.stringify(DS));
  ds.motion.enforce = enforce;
  fs.writeFileSync(path.join(dir, 'data', 'design_system.json'), JSON.stringify(ds));
  fs.writeFileSync(path.join(dir, 'assets', 'css', 'nb.css'), ':root{--bg:#000}\n.a{transition:all .2s}\n');
  fs.writeFileSync(path.join(dir, 'features-note.txt'), '');
  return dir;
}
function runAudit(dir, mode) {
  const r = spawnSync('node', [AUDIT, mode, '--root', dir], { encoding: 'utf8' });
  return { status: r.status, json: JSON.parse(r.stdout) };
}

test('audit_design_system: enforce:false は数えるだけで --check は通る。report に motion が出る', () => {
  const dir = makeFixture(false);
  const c = runAudit(dir, '--check');
  assert.equal(c.status, 0);
  assert.equal(c.json.ok, true);
  assert.equal(c.json.motion.enforce, false);
  assert.equal(c.json.motion.byRule['transition-all'], 1);
  assert.equal(c.json.motion.byFile['assets/css/nb.css']['transition-all'], 1);
  assert.equal(c.json.motion.violations[0].line, 2);
});

test('audit_design_system: enforce:true は enforceScopes の違反で --check が落ちる（--report は落ちない）', () => {
  const dir = makeFixture(true);
  const c = runAudit(dir, '--check');
  assert.equal(c.status, 1);
  assert.equal(c.json.ok, false);
  assert.ok(c.json.violations.some((v) => v.rule === 'transition-all' && v.file === 'assets/css/nb.css'));
  assert.equal(runAudit(dir, '--report').status, 0);
});

// ---------------------------------------------------------------- 段階 2（P-490・動きの計画 2 章 A1〜A7）

const NB2 = fs.readFileSync(path.join(ROOT, DS.cssPath), 'utf8');
const INDEX_CSS = (INDEX.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
const outsideReduced = (css) => css.replace(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

test('段階 2: index.html と nb.css の transition・animation の時間はトークンだけ（例外は待ちの表示 .skel・.nb-wait-long）', () => {
  const left = [];
  for (const [name, css] of [['index.html', INDEX_CSS], ['nb.css', NB2]]) {
    const re = /([^{}]*)\{([^{}]*)\}/g;
    let r;
    const body = outsideReduced(css);
    while ((r = re.exec(body))) {
      const sel = r[1].trim();
      for (const d of r[2].split(';')) {
        const mm = d.match(/^\s*(transition|animation)(-duration)?\s*:(.*)$/);
        if (!mm || !/\d(ms|s)\b/.test(mm[3])) continue;
        if (/(^|[\s,])\.(skel|nb-wait-long)(?![\w-])/.test(sel)) continue;
        left.push(`${name}: ${sel.slice(-60)} { ${d.trim()} }`);
      }
    }
  }
  assert.deepEqual(left, [], '時間の直書きが残っている');
});

test('段階 2 A1: 押す相手のボタンは押した瞬間に沈み（scale .98）色が濃くなる。ホバーは @media(hover:hover) の中だけ', () => {
  const pressIndex = ['.search-wrap button', '.sticky-search-btn', '.fs-go', '.modal-cta-btn', '.card-cta a', '.pg-btn', '.m-pg-btn', '.empty-state-reset', '.filter-toggle-btn', '.scene-tile', '.scene-chip'];
  const pressNb = ['.nb-btn', '.store-link', '.link-btn', '.nb-bar-btn'];
  const activeRule = (css) => {
    const r = css.match(/([^{}]*:active[^{}]*)\{[^{}]*transform:scale\(\.98\);box-shadow:inset 0 0 0 100vmax rgba\(0,0,0,\.12\);transition-duration:var\(--dur-press\);\}/);
    return r ? r[1] : '';
  };
  const ai = activeRule(INDEX_CSS);
  for (const s of pressIndex) assert.ok(ai.includes(s + ':active'), `index.html: ${s} の押した瞬間が無い`);
  const an = activeRule(NB2);
  for (const s of pressNb) assert.ok(an.includes(s + ':active'), `nb.css: ${s} の押した瞬間が無い`);
  // 押す相手と ♡・絞り込みのチップのホバーは、触った後に残らないよう @media(hover:hover) の中だけ
  const hoverOutside = [];
  for (const [name, css] of [['index.html', INDEX_CSS], ['nb.css', NB2]]) {
    const flat = outsideReduced(css).replace(/@media\s*\(\s*hover\s*:\s*hover\s*\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const s of [...pressIndex, ...pressNb, '.fs-chip', '.m-fav', '.geo-btn', '.modal-cta-gm', '.modal-cta-call', '.store-link-reserve']) {
      const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('(^|[},\\s])' + esc + '(?![\\w-])[^{},]*:hover[^{}]*\\{[^{}]*transform').test(flat)) hoverOutside.push(`${name}: ${s}`);
      if (['.fs-chip', '.m-fav', '.pg-btn', '.fs-go', '.scene-chip', '.scene-tile'].includes(s) && new RegExp('(^|[},\\s])' + esc + '(?![\\w-])[^{},]*:hover').test(flat)) hoverOutside.push(`${name}: ${s}`);
    }
  }
  assert.deepEqual(hoverOutside, []);
});

test('段階 2 A2: ♡ は保存したときだけ 1 回弾み「保存しました」を知らせる。外したときは弾まず知らせない', () => {
  const vm = require('vm');
  const start = INDEX.indexOf('function toggleFav(');
  const end = INDEX.indexOf('\n});\n', INDEX.indexOf("e.animationName === 'nbPop'")) + 5;
  assert.ok(start > 0 && end > start, 'toggleFav・nbPop が見つからない');
  const mkBtn = (name) => {
    const cls = new Set();
    return { cls, name, innerHTML: '', getAttribute: (k) => (k === 'data-name' ? name : null),
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
      get offsetWidth() { return 10; } };
  };
  const a = mkBtn('店A');
  const b = mkBtn('店B');
  let favs = [];
  const toasts = [];
  const listeners = [];
  const ctx = {
    getFavs: () => favs.slice(), saveFavs: (x) => { favs = x; }, trackEvent() {},
    showToast: (m2) => toasts.push(m2),
    document: { querySelectorAll: () => [a, b], addEventListener: (t, fn) => listeners.push([t, fn]) },
  };
  vm.createContext(ctx);
  vm.runInContext(INDEX.slice(start, end), ctx);
  ctx.toggleFav('店A');
  assert.equal(a.cls.has('faved') && a.cls.has('is-pop'), true, '保存で塗りと弾み');
  assert.equal(b.cls.has('is-pop'), false, 'ほかの店は弾まない');
  assert.deepEqual(toasts, ['保存しました']);
  // 弾みが終わったらクラスを外す（次に押したときにまた弾む）
  const [, onEnd] = listeners.find(([t]) => t === 'animationend');
  onEnd({ animationName: 'nbPop', target: a });
  assert.equal(a.cls.has('is-pop'), false);
  ctx.toggleFav('店A');
  assert.equal(a.cls.has('faved') || a.cls.has('is-pop'), false, '外したときは弾まない');
  assert.deepEqual(toasts, ['保存しました'], '外したときは知らせない');
});

test('段階 2 A2・A6: 知らせは読み上げられ、続けて出しても前のタイマーで早く消えない。件数は同じ数字なら動かさない', () => {
  assert.match(INDEX, /<div class="toast" id="toast" role="status" aria-live="polite"><\/div>/);
  assert.match(INDEX, /clearTimeout\(window\.__nbToastTimer\);\s*window\.__nbToastTimer = setTimeout/);
  assert.match(INDEX, /if \(cntEl\.textContent === cntText\) \{/);
});

test('段階 2 A7: 待ちの輪は先頭のアイコンをその場で回す（ボタンの幅を変えない）。印を付けるボタンはどれも先頭にアイコンを持つ', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8');
  // 文の後ろ・前に箱を足すと、ボタンが広がり横の検索欄が縮む（2026-10-16 の録画で「現在地」に出た）
  assert.doesNotMatch(css, /\.nb-wait-long::?(after|before)/);
  assert.match(css, /\.nb-wait-long>svg:first-child,\.nb-wait-long>\.nb-icon:first-child\{[^}]*animation:nbSpin/);
  // 現在地（index.html）とクイックビューの電話
  assert.match(INDEX, /btn\.innerHTML = NB_PIN_SVG \+ '取得中…';/);
  assert.match(INDEX, /data-call-loc="modal" onclick="nbCallStore\([^"]*\)" aria-label="[^"]*">' \+ NB_CALL_ICON_SVG \+ label/);
  // 店舗ページの電話（本文と下の行動バー）
  const gen = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.match(gen, /nb-bar-tel"[^`]*>\$\{BAR_PHONE_ICON\}<span>電話する<\/span><\/button>/);
  assert.match(gen, /class="link-btn tel"[^`]*に電話する"><svg /);
});
