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

test('policy: 動きのトークン 8 つが coreTokens と nb.css にあり、motion の節が決めた形', () => {
  // --dur-instant（押し込み 50ms）と --dur-emph（♡ の弾み 300ms）は段階 3a で足した
  const tokens = ['--dur-instant', '--dur-press', '--dur-fast', '--dur-base', '--dur-slow', '--dur-emph', '--ease-out', '--ease-in'];
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
        if (/\.(skel|nb-wait-long)(?![\w-])/.test(sel)) continue;
        left.push(`${name}: ${sel.slice(-60)} { ${d.trim()} }`);
      }
    }
  }
  assert.deepEqual(left, [], '時間の直書きが残っている');
});

test('段階 2 A1・段階 3a A-2/A-3: 押した物は沈み（ボタン .96・小さい部品 .94・カード .985）暗さ .16 で濃くなる。押し込みは --dur-instant。ホバーは @media(hover:hover) の中だけ', () => {
  const pressIndex = ['.search-wrap button', '.sticky-search-btn', '.fs-go', '.modal-cta-btn', '.card-cta a', '.m-pg-btn', '.empty-state-reset', '.filter-toggle-btn', '.scene-tile', '.scene-chip',
    '.mobile-cta-bar .cta-filter', '.tb-filter', '.view-toggle button', '.geo-btn', '.sbtn', '.share-btn', '.clear-all-btn', '.fs-reset', '.fs-suggest-btn', '.suggest-pill', '.fold-toggle'];
  const smallIndex = ['.fav-btn', '.m-fav', '.mcl', '.fs-close', '.fs-chip', '.chip', '.pg-btn', '#scroll-top', '.mhi-nav'];
  const cardIndex = ['.card', '.tp-card', '.feature-card', '.latest-journal-card', '.hist-card', '.modal-rsc'];
  const pressNb = ['.nb-btn', '.store-link', '.link-btn', '.nb-bar-btn', '.related-link', '.nb-conclusion-hubs a'];
  const activeRule = (css, scale, extra) => {
    const re = new RegExp('([^{}]*:active[^{}]*)\\{transform:scale\\(' + scale.replace('.', '\\.') + '\\);box-shadow:inset 0 0 0 100vmax rgba\\(0,0,0,\\.16\\);transition-duration:var\\(--dur-instant\\);' + (extra || '') + '\\}');
    const r = css.match(re);
    return r ? r[1] : '';
  };
  const ai = activeRule(INDEX_CSS, '.96');
  for (const s2 of pressIndex) assert.ok(ai.includes(s2 + ':active'), `index.html: ${s2} の押した瞬間（.96）が無い`);
  const as = activeRule(INDEX_CSS, '.94');
  for (const s2 of smallIndex) assert.ok(as.includes(s2 + ':active'), `index.html: ${s2} の押した瞬間（.94）が無い`);
  // カードはスクロールし始めた指で一瞬暗くならないよう、押し込みを --dur-instant だけ遅らせる。
  // 写真の上は内側の影では暗くならないので、写真まで覆う膜（::after）を暗くする
  const cr = INDEX_CSS.match(/([^{}]*:active[^{}]*)\{transform:scale\(\.985\);transition-duration:var\(--dur-instant\);transition-delay:var\(--dur-instant\);\}/);
  const ac = cr ? cr[1] : '';
  for (const s2 of cardIndex) assert.ok(ac.includes(s2 + ':active'), `index.html: ${s2} の押した瞬間（.985）が無い`);
  // カードの中の ♡・予約・動画を押したときは、カードごとは沈ませない
  assert.match(ac, /\.card:active:not\(:has\(\.fav-btn:active,\.card-cta a:active,\.reel-play:active\)\)/);
  assert.match(INDEX_CSS, /\.card:active:not\(:has\([^)]*\)\) \.cn-link::after\{background-color:rgba\(0,0,0,\.16\);transition-duration:var\(--dur-instant\);transition-delay:var\(--dur-instant\);\}/);
  const film = INDEX_CSS.match(/([^{}]*:active::after[^{}]*)\{background-color:rgba\(0,0,0,\.16\);transition-duration:var\(--dur-instant\);transition-delay:var\(--dur-instant\);\}/);
  for (const s2 of cardIndex.filter((c) => c !== '.card')) assert.ok(film && film[1].includes(s2 + ':active::after'), `index.html: ${s2} の膜が無い`);
  assert.match(INDEX_CSS, /\.tp-card::after,\.feature-card::after,\.latest-journal-card::after,\.hist-card::after,\.modal-rsc::after\{content:"";position:absolute;inset:0;z-index:3;border-radius:inherit;pointer-events:none;/);
  const an = activeRule(NB2, '.96');
  for (const s2 of pressNb) assert.ok(an.includes(s2 + ':active'), `nb.css: ${s2} の押した瞬間が無い`);
  assert.match(NB2, /\.hamburger:active\{transform:scale\(\.94\);box-shadow:inset 0 0 0 100vmax rgba\(0,0,0,\.16\);transition-duration:var\(--dur-instant\);\}/);
  // 戻りは 200ms（--dur-base）。押せる物の transition はプロパティを並べて書く（all にしない）
  assert.match(NB2, /\.nb-btn,\.store-link,\.link-btn,\.nb-bar-btn,\.related-link,\.nb-conclusion-hubs a,\.hamburger\{transition-property:color,background-color,border-color,box-shadow,transform,opacity;transition-duration:var\(--dur-base\);/);
  // 古い押した見た目（段階 2 の .98・.12、トップの .card:active の背景の差し替え）は残さない
  assert.doesNotMatch(INDEX_CSS + NB2, /scale\(\.98\);box-shadow:inset 0 0 0 100vmax rgba\(0,0,0,\.12\)/);
  assert.doesNotMatch(INDEX_CSS, /\.card:active\{transform:scale\(\.99\)/);
  // 押す相手と ♡・絞り込みのチップのホバーは、触った後に残らないよう @media(hover:hover) の中だけ
  const hoverOutside = [];
  for (const [name, css] of [['index.html', INDEX_CSS], ['nb.css', NB2]]) {
    const flat = outsideReduced(css).replace(/@media\s*\(\s*hover\s*:\s*hover\s*\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const s2 of [...pressIndex, ...pressNb, '.fs-chip', '.m-fav', '.geo-btn', '.modal-cta-gm', '.modal-cta-call', '.store-link-reserve']) {
      const esc = s2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('(^|[},\\s])' + esc + '(?![\\w-])[^{},]*:hover[^{}]*\\{[^{}]*transform').test(flat)) hoverOutside.push(`${name}: ${s2}`);
      if (['.fs-chip', '.m-fav', '.pg-btn', '.fs-go', '.scene-chip', '.scene-tile'].includes(s2) && new RegExp('(^|[},\\s])' + esc + '(?![\\w-])[^{},]*:hover').test(flat)) hoverOutside.push(`${name}: ${s2}`);
    }
  }
  assert.deepEqual(hoverOutside, []);
});

test('段階 3a A-1: iPhone で押した見た目を出す空の touchstart（passive）が、トップの頭の <script> と全ページの共通の <script> にある', () => {
  const touch = "document.addEventListener('touchstart',function(){},{passive:true});";
  const head = INDEX.slice(0, INDEX.indexOf('</head>'));
  assert.ok(head.includes(touch), 'index.html の <head> に無い');
  const chrome = require(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'));
  assert.ok(chrome.chromeScript().includes(touch), 'chromeScript() に無い');
  // 店舗ページ・特集・ジャーナル・ハブ・404 は chromeScript を通る（生成器が呼ぶ／apply_site_chrome.js が写す）
  for (const f of ['gen-store-pages.js', 'scripts/gen_area_genre_pages.js', 'scripts/gen_industry_features.js', 'scripts/gen_404_page.js']) {
    assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /chromeScript\(\)/, f);
  }
});

test('段階 3a: 押した見た目を自前で出す部品では、ブラウザの押した光（Android の青い膜）を消している', () => {
  // :active で沈む・濃くなる部品のどれにも、transition を書いた同じ規則で -webkit-tap-highlight-color:transparent を付ける
  const flatIndex = INDEX.replace(/\/\*[\s\S]*?\*\//g, '');
  const nbcss = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [name, css, first] of [['index.html', flatIndex, '.search-wrap button,.sticky-search-btn'], ['nb.css', nbcss, '.nb-btn,.store-link,.link-btn']]) {
    const i = css.indexOf(first);
    assert.ok(i >= 0, name + ': 押す相手の規則が見つからない');
    const rule = css.slice(i, css.indexOf('}', i) + 1);
    assert.match(rule, /transition-property:[^;]*transform/, name);
    assert.match(rule, /-webkit-tap-highlight-color:transparent/, name + ': 押した光を消していない');
    for (const sel of rule.slice(0, rule.indexOf('{')).split(',')) {
      assert.ok(new RegExp(sel.trim().replace(/[.*+?^${}()|[\]\\#]/g, '\\$&') + '[^,{]*:active').test(css), name + ': ' + sel + ' に :active が無い');
    }
  }
});

test('段階 3a: ハブのカードと店舗ページの関連リンクにも押した見た目がある', () => {
  const hub = fs.readFileSync(path.join(ROOT, 'scripts', 'gen_area_genre_pages.js'), 'utf8');
  assert.match(hub, /\.hub-grid a:active\{transform:scale\(\.985\);box-shadow:inset 0 0 0 100vmax rgba\(0,0,0,\.16\);transition-duration:var\(--dur-instant\);\}/);
  const gen = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  // 文中のリンク（inline）は transform が効かないので、背景の色で返す
  // 自前で押した見た目を出すので、ブラウザの押した光も消す
  assert.match(hub, /\.hub-grid a\{[^}]*-webkit-tap-highlight-color:transparent;\}/);
  assert.match(gen, /\.related-features a,\.related-stores a\{[^}]*-webkit-tap-highlight-color:transparent;\}/);
  assert.match(gen, /\.related-features a:active,\.related-stores a:active\{color:var\(--gold2\);background-color:rgba\(122,92,16,\.16\);transition-duration:var\(--dur-instant\);\}/);
});

test('段階 2 A2・段階 3a A-5: ♡ は保存したら弾み「保存しました」、外したら縮んで「保存を外しました」と知らせる', () => {
  const vm = require('vm');
  const start = INDEX.indexOf('function toggleFav(');
  const end = INDEX.indexOf('\n});\n', INDEX.indexOf("e.animationName === 'nbPop'")) + 5;
  assert.ok(start > 0 && end > start, 'toggleFav・nbPop が見つからない');
  const mkBtn = (name) => {
    const cls = new Set();
    return { cls, name, innerHTML: '', getAttribute: (k) => (k === 'data-name' ? name : null),
      classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), add: (c) => cls.add(c), remove: (...cs) => cs.forEach((c) => cls.delete(c)), contains: (c) => cls.has(c) },
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
  // 弾みが終わったらクラスを外す（次に押したときにまた動く）
  const [, onEnd] = listeners.find(([t]) => t === 'animationend');
  onEnd({ animationName: 'nbPop', target: a });
  assert.equal(a.cls.has('is-pop'), false);
  ctx.toggleFav('店A');
  assert.equal(a.cls.has('faved'), false, '外すと塗りが消える');
  assert.equal(a.cls.has('is-unpop') && !a.cls.has('is-pop'), true, '外したときは縮む（弾まない）');
  assert.deepEqual(toasts, ['保存しました', '保存を外しました'], '外したときも知らせる');
  // 縮みの途中でもう一度押したら、縮みを外して弾みに付け替える
  ctx.toggleFav('店A');
  assert.equal(a.cls.has('is-pop') && !a.cls.has('is-unpop'), true);
  onEnd({ animationName: 'nbPop', target: a });
  ctx.toggleFav('店A');
  onEnd({ animationName: 'nbUnpop', target: a });
  assert.equal(a.cls.has('is-unpop'), false, '縮みが終わったらクラスを外す');
  // CSS: 弾みは 1→1.3→.92→1（--dur-emph＝300ms）、縮みは .85（--dur-fast）
  assert.match(INDEX_CSS, /@keyframes nbPop\{0%\{transform:scale\(1\);[^}]*\}35%\{transform:scale\(1\.3\);\}70%\{transform:scale\(\.92\);\}100%\{transform:scale\(1\);/);
  assert.match(INDEX_CSS, /\.fav-btn\.is-pop,\.m-fav\.is-pop\{animation:nbPop var\(--dur-emph\) var\(--ease-out\);\}/);
  assert.match(INDEX_CSS, /@keyframes nbUnpop\{50%\{transform:scale\(\.85\);\}\}/);
  assert.match(INDEX_CSS, /\.fav-btn\.is-unpop,\.m-fav\.is-unpop\{animation:nbUnpop var\(--dur-fast\) var\(--ease-out\);\}/);
});

test('段階 2 A2・A6: 知らせは読み上げられ、続けて出しても前のタイマーで早く消えない。件数は同じ数字なら動かさない', () => {
  assert.match(INDEX, /<div class="toast" id="toast" role="status" aria-live="polite"><\/div>/);
  assert.match(INDEX, /clearTimeout\(window\.__nbToastTimer\);\s*window\.__nbToastTimer = setTimeout/);
  // 段階 3a の B-1: 見えない #cnt の動き（CSS と __nbCntTimer）は外し、見える件数の要素で動かす
  assert.doesNotMatch(INDEX, /__nbCntTimer/);
  assert.doesNotMatch(INDEX_CSS, /#cnt\b/);
  assert.match(INDEX, /\['results-summary-count', 'filter-badge', 'tb-filter-badge', 'fs-go'\]\.forEach\(function\(id\) \{/);
});

// 件数の動きの判定（nbCountTick）を取り出して動かす
function loadCountTick(now, lastInput, restoring) {
  const vm = require('vm');
  const start = INDEX.indexOf('var NB_TICK_WINDOW_MS');
  const end = INDEX.indexOf('// シートの主ボタンが全店のデータを待っている間か');
  assert.ok(start > 0 && end > start, 'nbCountTick の区画が見つからない');
  const ctx = { Date: { now: () => now }, window: { __nbLastInput: lastInput }, NB_RESTORING: restoring ? 1 : 0,
    document: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(INDEX.slice(start, end), ctx);
  return ctx;
}
const mkEl = () => {
  const cls = new Set();
  return { cls, classList: { add: (c) => cls.add(c), remove: (...cs) => cs.forEach((c) => cls.delete(c)), contains: (c) => cls.has(c) } };
};

test('段階 3a B-1: 件数は触ってから 1 秒の間に数字が変わった 1 回だけ動く（増えたら up・減ったら down）', () => {
  let c = loadCountTick(10000, 9500, false);
  let el = mkEl();
  assert.equal(c.nbCountTick(el, '1,234', '87'), true);
  assert.equal(el.cls.has('is-tick-down'), true, '減ったら上から');
  el = mkEl();
  assert.equal(c.nbCountTick(el, '87軒を見る', '1,234軒を見る'), true);
  assert.equal(el.cls.has('is-tick-up'), true, '増えたら下から（文の中の数字を読む）');
  // 同じ数字・前が数字でない（「--」「読み込み中…」）は動かさない
  for (const [x, y] of [['87', '87'], ['--', '87'], ['読み込み中…', '87軒を見る'], ['87軒を見る', '該当するお店がありません']]) {
    el = mkEl();
    assert.equal(c.nbCountTick(el, x, y), false, `${x} → ${y}`);
    assert.equal(el.cls.size, 0);
  }
  // 触ってから 1 秒より後（全店のデータの到着など）・戻る／進むの読み直しの間は動かさない
  c = loadCountTick(10000, 8900, false);
  assert.equal(c.nbCountTick(mkEl(), '1,234', '87'), false);
  c = loadCountTick(10000, 9900, true);
  assert.equal(c.nbCountTick(mkEl(), '1,234', '87'), false);
  // 待っていた主ボタンに件数が届いたときは、触っていなくても 1 回動かす（force）
  c = loadCountTick(10000, 0, false);
  el = mkEl();
  assert.equal(c.nbCountTick(el, '読み込み中…', '1,234軒を見る', true), true);
  assert.equal(el.cls.has('is-tick-up'), true);
  // CSS: 帯の数字は入れ替わり・丸は弾み・主ボタンは小さく弾む。どれも transform と opacity だけ
  assert.match(INDEX_CSS, /#results-summary-count\.is-tick-up\{animation:nbCountUp var\(--dur-base\) var\(--ease-out\);\}/);
  assert.match(INDEX_CSS, /\.filter-badge\.is-tick-up,\.filter-badge\.is-tick-down\{animation:nbBadge var\(--dur-slow\) var\(--ease-out\);\}/);
  assert.match(INDEX_CSS, /\.fs-go\.is-tick-up,\.fs-go\.is-tick-down\{animation:nbBump var\(--dur-slow\) var\(--ease-out\);\}/);
  // 触った時刻は頭の <script> が覚える（指・マウス・キー・入力）
  assert.match(INDEX, /\['pointerdown','keydown','input'\]\.forEach\(function\(t\)\{document\.addEventListener\(t,function\(\)\{window\.__nbLastInput=Date\.now\(\);\},\{capture:true,passive:true\}\);\}\);/);
});

test('段階 3a A-4: シートのチップは押して選んだ 1 つだけ ✓ が弾む（外したとき・開いたときは動かない）', () => {
  const vm = require('vm');
  const start = INDEX.indexOf('function nbCheckPop(chip)');
  const end = INDEX.indexOf('\n  }\n', start) + 5;   // シートのクリック処理（即時関数）の中の関数
  assert.ok(start > 0, 'nbCheckPop が見つからない');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(INDEX.slice(start, end), ctx);
  const mkChip = (pressed) => Object.assign(mkEl(), { getAttribute: (k) => (k === 'aria-pressed' ? pressed : null) });
  const on = mkChip('true');
  ctx.nbCheckPop(on);
  assert.equal(on.cls.has('is-check'), true);
  const off = mkChip('false');
  ctx.nbCheckPop(off);
  assert.equal(off.cls.has('is-check'), false);
  // 押したときだけ呼ぶ（nbSheetSync の後）。開いたときの描画（nbRenderFilterSheet）からは呼ばない
  assert.match(INDEX, /nbSheetSync\(\);\n\s*nbCheckPop\(chip\);/);
  assert.equal((INDEX.match(/nbCheckPop\(/g) || []).length, 2, '定義と押したときの 1 か所だけ');
  assert.match(INDEX_CSS, /\.fs-chip\.is-check\[aria-pressed="true"\]::before\{animation:nbCheck var\(--dur-base\) var\(--ease-out\);\}/);
  assert.match(INDEX, /else if \(n === 'nbCheck'\) t\.classList\.remove\('is-check'\);/);
});

test('段階 3a D-1: シートの主ボタンは全店のデータを 1 秒より長く待つと輪を出す（幅を変えない）。取得に失敗しても待ちを止める', () => {
  assert.match(INDEX, /var NB_SHEET_WAIT_MS = 1000;/);
  assert.match(INDEX, /if \(nbSheetWaiting\(\)\) go\.classList\.add\('nb-wait-long'\);/);
  // 輪は文の左に重ねて描く（position:absolute）。ボタンの幅と文の位置は変わらない
  assert.match(INDEX_CSS, /\.fs-go\.nb-wait-long::before\{content:"";position:absolute;left:1rem;top:50%;width:1em;height:1em;[^}]*animation:nbSpin \.8s linear infinite;\}/);
  // 全店のデータの取得に失敗したら、シートを数え直して「読み込み中…」と輪を止める
  assert.match(INDEX, /FULL_CATALOG_FAILED = true;\n\s*applyFilters\(\);[^\n]*\n\s*nbRefreshFilterSheet\(\);/);
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
