'use strict';

/**
 * Web フォントを使わないことの試験（P-318・判断の記録 0026）。
 *
 * 事故ではなく方針の固定: サイトは Web フォント（Google Fonts の Cormorant Garamond / Shippori Mincho / Noto Sans JP /
 * DM Mono）をやめ、端末にある書体だけを nb.css のトークン（--font-display / --font-body / --font-mono）で指す。
 * 全ページが同じ 4 書体の約 1.3〜1.7 MB を毎回読み込み、文字が出るまでの待ちと、書体が切り替わる瞬間のずれ（CLS）の
 * 原因になっていた。方針が静かに戻らないよう、次を見る:
 *   (1) data/design_system.json の webFonts が「使わない」を宣言し、fontsUrl が残っていない
 *   (2) nb.css のトークンが退役した書体を指さず、端末の書体の並び（scripts/lib/web_fonts.js の DEVICE_STACKS）と一致する
 *   (3) 生成器とテンプレートが、配信元への <link> も退役した書体の直書きも書き出さない
 *   (4) 手で保守しているページ（ルート・特集・ジャーナル・店舗一覧）に Web フォントの使用が無い
 *   (5) 判定と書き換えの部品（scripts/lib/web_fonts.js）が、決めた形のタグ・宣言だけを扱う
 * 有効な店舗ページ約 5,000 本とハブ約 700 本は、このテストの時点（CI の再生成の前）では古い形が残っているため
 * 読まない。再生成の後に scripts/audit_design_system.js --check（blocking）が見る。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const wf = require(path.join(ROOT, 'scripts', 'lib', 'web_fonts.js'));
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'design_system.json'), 'utf8'));
const NB = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8');
const POLICY = wf.loadWebFontsPolicy(ROOT);

const norm = (s) => s.replace(/\s+/g, '');

/** nb.css の :root から --font-xxx の値を取り出す */
function token(name) {
  const m = NB.match(new RegExp('--' + name + '\\s*:\\s*([^;]+);'));
  assert.ok(m, `nb.css に --${name} が無い`);
  return m[1].trim();
}

test('design_system.json: Web フォントは使わない方針で、fontsUrl が残っていない', () => {
  assert.equal(DS.webFonts.allowed, false);
  assert.ok(!('fontsUrl' in DS), 'fontsUrl は Web フォントと一緒にやめた（判断の記録 0026）');
  assert.deepEqual(POLICY.forbiddenHosts, ['fonts.googleapis.com', 'fonts.gstatic.com']);
  assert.deepEqual(POLICY.retiredFamilies, ['Cormorant Garamond', 'Shippori Mincho', 'Noto Sans JP', 'DM Mono']);
});

test('nb.css: フォントのトークンは退役した書体を指さず、端末の書体の並び（DEVICE_STACKS）と一致する', () => {
  const pairs = [['font-display', 'display'], ['font-body', 'body'], ['font-mono', 'mono']];
  for (const [tokenName, key] of pairs) {
    const value = token(tokenName);
    for (const fam of POLICY.retiredFamilies) {
      assert.ok(!value.includes(fam), `--${tokenName} が退役した書体 ${fam} を指している`);
    }
    assert.equal(norm(value), norm(wf.DEVICE_STACKS[key]), `--${tokenName} が scripts/lib/web_fonts.js の DEVICE_STACKS.${key} とずれている（孤児ページに直接書く値と同じにする）`);
  }
});

test('nb.css: 端末の書体の並びは日本語の主な端末の書体と、最後の総称ファミリーを持つ', () => {
  const display = token('font-display');
  const body = token('font-body');
  const mono = token('font-mono');
  for (const name of ['Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP']) assert.ok(display.includes(`'${name}'`), `--font-display に ${name} が無い`);
  for (const name of ['Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Noto Sans CJK JP', 'Yu Gothic']) assert.ok(body.includes(`'${name}'`), `--font-body に ${name} が無い`);
  assert.match(display, /,\s*serif$/, '--font-display が serif で終わっていない');
  assert.match(body, /,\s*sans-serif$/, '--font-body が sans-serif で終わっていない');
  assert.match(mono, /,\s*monospace$/, '--font-mono が monospace で終わっていない');
  assert.ok(mono.startsWith('ui-monospace'), '--font-mono が端末の等幅（ui-monospace）から始まっていない');
});

test('nb.css: @font-face・@import・配信元の URL を持たない（書体を自分で配るなら判断の記録を先に書く）', () => {
  const css = NB.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /@font-face/i);
  assert.doesNotMatch(css, /@import/i);
  for (const h of POLICY.forbiddenHosts) assert.ok(!css.includes(h), `nb.css が ${h} を指している`);
});

test('生成器とテンプレート: 配信元への <link> も、退役した書体の直書きも書き出さない', () => {
  const sources = [
    'gen-store-pages.js',
    'build_features.js',
    path.join('scripts', 'gen_area_genre_pages.js'),
    path.join('scripts', 'gen_industry_features.js'),
    path.join('scripts', 'gen_404_page.js'),
    path.join('scripts', 'add_related_features.js'),
    path.join('scripts', 'replace_type_icon_photos.js'),
    path.join('scripts', 'lib', 'site_chrome.js'),
    path.join('journal', '_template.html'),
  ];
  const bad = [];
  for (const rel of sources) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const h of POLICY.forbiddenHosts) if (src.includes(h)) bad.push(`${rel}: ${h}`);
    if (/<link\b[^>]*rel=["']preconnect["'][^>]*fonts\./i.test(src)) bad.push(`${rel}: preconnect`);
    for (const fam of POLICY.retiredFamilies) {
      if (new RegExp(`font-family\\s*:\\s*['"]${fam}`, 'i').test(src)) bad.push(`${rel}: font-family に ${fam}`);
    }
  }
  assert.deepEqual(bad, []);
});

function listHtml(dir) {
  return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f));
}

test('手で保守しているページ（ルート・404・特集・ジャーナル・店舗一覧）に Web フォントの使用が無い', () => {
  const pages = [
    'index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html', '404.html',
    ...listHtml('features'), ...listHtml('journal'), path.join('stores', 'index.html'),
  ];
  assert.ok(pages.length > 200, `ページが ${pages.length} 本しか見つからない`);
  const bad = [];
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const v = wf.findViolations(html, POLICY);
    if (v.length) bad.push(`${rel}: ${v.map((x) => x.rule + ' ' + x.detail).join(' / ').slice(0, 160)}`);
  }
  assert.deepEqual(bad.slice(0, 10), [], `Web フォントの使用が残っているページ ${bad.length} 本（node scripts/apply_design_system.js で外せる）`);
});

test('removeWebFontLinks: preconnect 2 本とスタイルシートを外し、ほかの <link> と改行を壊さない（2 回流しても同じ）', () => {
  const head = [
    '<meta name="theme-color" content="#7a5c10">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=DM+Mono:wght@400&display=swap" rel="stylesheet">',
    '<link rel="stylesheet" href="../assets/css/nb.css">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400&display=swap">',
    "<link rel='preconnect' href='//fonts.gstatic.com'>",
    '<link rel="preconnect" href="https://www.googletagmanager.com">',
    '<style>body{margin:0}</style>',
  ].join('\n');
  const r = wf.removeWebFontLinks(head, POLICY.forbiddenHosts);
  assert.equal(r.changed, true);
  assert.equal(r.html, [
    '<meta name="theme-color" content="#7a5c10">',
    '<link rel="stylesheet" href="../assets/css/nb.css">',
    '<link rel="preconnect" href="https://www.googletagmanager.com">',
    '<style>body{margin:0}</style>',
  ].join('\n'));
  const again = wf.removeWebFontLinks(r.html, POLICY.forbiddenHosts);
  assert.equal(again.changed, false);
  assert.equal(again.html, r.html);
});

test('rewriteFamilyLiterals: 直書きの書体名をトークンへ（nb.css を読まない古いページは端末の書体の並びへ）', () => {
  const css = [
    ".a{font-family:'Cormorant Garamond',serif;font-weight:400}",
    ".b{font-family:'Cormorant Garamond','Noto Sans JP',serif}",
    ".c{font-family: 'Noto Sans JP', sans-serif;color:red}",
    ".d{font-family:'DM Mono',monospace;font-size:var(--fs-xs)}",
    '.e{font-family:var(--font-body)}',
  ].join('\n');
  const t = wf.rewriteFamilyLiterals(css);
  assert.equal(t.changed, true);
  assert.equal(t.html, [
    '.a{font-family:var(--font-display);font-weight:400}',
    '.b{font-family:var(--font-body)}',
    '.c{font-family:var(--font-body);color:red}',
    '.d{font-family:var(--font-mono);font-size:var(--fs-xs)}',
    '.e{font-family:var(--font-body)}',
  ].join('\n'));
  assert.equal(wf.rewriteFamilyLiterals(t.html).changed, false);

  const d = wf.rewriteFamilyLiterals(".a{font-family:'Cormorant Garamond',serif}.d{font-family:'DM Mono',monospace}", { useTokens: false });
  assert.equal(d.html, `.a{font-family:${wf.DEVICE_STACKS.display}}.d{font-family:${wf.DEVICE_STACKS.mono}}`);
  for (const fam of POLICY.retiredFamilies) assert.ok(!d.html.includes(fam), `${fam} が残っている`);
});

test('findViolations: <link>・@import・<style> と style 属性の書体名を数え、本文の語・トークンは数えない', () => {
  const html = `<!DOCTYPE html><html><head>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
@import url("https://fonts.googleapis.com/css2?family=DM+Mono");
/* font-family:'DM Mono',monospace は書き換え前の例（コメントは数えない） */
.a{font-family:'Cormorant Garamond',serif}
.b{font-family:var(--font-body)}
.c{font:400 1rem/1.4 'Noto Sans JP',sans-serif}
</style></head><body>
<p>DM Mono という名前の店がある。Noto Sans JP の話ではない。</p>
<span style="font-family:'Shippori Mincho',serif">x</span>
<span style="font-family:var(--font-display)">y</span>
</body></html>`;
  const v = wf.findViolations(html, POLICY);
  const rules = v.map((x) => x.rule).sort();
  assert.deepEqual(rules, ['retired-family', 'retired-family', 'retired-family', 'webfont-import', 'webfont-link']);

  const clean = `<html><head><link rel="stylesheet" href="assets/css/nb.css"><style>.a{font-family:var(--font-display)}</style></head><body><p>DM Mono</p></body></html>`;
  assert.deepEqual(wf.findViolations(clean, POLICY), []);
});

test('apply_design_system.js: 乾燥実行は何も書かず、手で保守するページに直すものが無い（冪等）', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'apply_design_system.js'), '--dry-run', '--only', 'root'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(JSON.parse(out).files_changed, 0, 'ルートのページに直すものが残っている');
  for (const group of ['features', 'journal', 'stores']) {
    const o = execFileSync('node', [path.join(ROOT, 'scripts', 'apply_design_system.js'), '--dry-run', '--only', group], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(JSON.parse(o).files_changed, 0, `${group} に直すものが残っている`);
  }
});
