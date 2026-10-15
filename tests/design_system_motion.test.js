'use strict';

/**
 * 動き（モーション）の判定器 scripts/lib/motion_audit.js と、audit_design_system.js への組み込みの試験
 * （動きの計画 5.3 節・段階 0）。5 つの検査それぞれの当たり・外れと、enforce の切り替えを固定する。
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
  assert.equal(P.enforce, false);
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

test('実物: nb.css は 300ms 超・transition:all を持たない（既存の 1 件は width の動きとして数えている）', () => {
  const nb = fs.readFileSync(path.join(ROOT, DS.cssPath), 'utf8');
  const v = m.auditCss(nb, P, { file: DS.cssPath });
  assert.equal(v.filter((x) => x.rule === 'transition-all' || x.rule === 'motion-duration').length, 0);
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
