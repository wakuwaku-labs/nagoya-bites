'use strict';

/**
 * scripts/lib/inline_js.js / scripts/audit_inline_js_syntax.js の単体テスト（SEO-115）。
 *
 * このゲートが守るもの:
 *   「公開ページのインライン <script> が構文として通り、GA4 の設定が実行されること」。
 * 2026-10-09、gen-store-pages.js のテンプレートリテラル内で `\/\/` が `//` に解決され、
 * 店舗ページ約5,000本の GA4 ブロックが構文エラーで丸ごと止まっていたと判明した
 * （2026-05-08 生成分から5か月間・検知ゼロ）。この既知の壊れ方を固定回帰テストとして残す
 * （CLAUDE.md 品質ゲートの原則5）。
 *
 * コミット済みの stores/*.html は見ない。生成器を直してから日次 build.yml が再生成するまでの間は
 * 古いページが残るため、ここでは「生成器の出力」と「テンプレート・既存ページの見本」を検査する。
 * 実ファイル全件の検査は audit_inline_js_syntax.js（build.yml・夜間QA）が担う。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { auditHtml, extractInlineScripts } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));
const audit = require(path.join(ROOT, 'scripts', 'audit_inline_js_syntax.js'));

const GA_LOADER = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-3LCZNGZPWJ"></script>';
const gaBlock = (regex) => [
  '<script>',
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-3LCZNGZPWJ');",
  "document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!" + regex + ".test(href))return;},true);",
  '</script>',
].join('\n');
const page = (body) => `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">\n${body}\n</head><body></body></html>`;

// 2026-05-08〜10-09 に店舗ページへ出ていた壊れた形（正規表現の \/\/ が // に化けた）
const BROKEN = page(GA_LOADER + '\n' + gaBlock('/^https?:///i'));
const FIXED = page(GA_LOADER + '\n' + gaBlock('/^https?:\\/\\//i'));

test('inline_js: 既知の壊れ方（/^https?:///i）を js-syntax と ga-config-broken の両方で検出する', () => {
  const r = auditHtml(BROKEN, { filename: 'broken.html' });
  const rules = r.violations.map(v => v.rule).sort();
  assert.deepEqual(rules, ['ga-config-broken', 'js-syntax']);
  const js = r.violations.find(v => v.rule === 'js-syntax');
  assert.equal(js.line, 3, 'エラー位置としてブロックの開始行を返す');
});

test('inline_js: 正しくエスケープした形は違反0', () => {
  const r = auditHtml(FIXED, { filename: 'fixed.html' });
  assert.deepEqual(r.violations, []);
  assert.equal(r.checked, 1);
});

test('inline_js: src付きscriptは検査せず、JSON-LDは JSON.parse で見る。未知の type は数えるだけ', () => {
  const html = page([
    '<script src="https://example.com/x.js"></script>',
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant","name":"A",}</script>',
    '<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>',
    '<script type="text/template"><div>{{NAME}}</div></script>',
  ].join('\n'));
  const r = auditHtml(html, { filename: 'mixed.html' });
  assert.equal(r.blocks, 3, 'src付きは抽出しない');
  assert.equal(r.checked, 2);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.violations.map(v => v.rule), ['json-syntax']);
});

test('inline_js: GA を読み込まないページには gtag config を要求しない', () => {
  const r = auditHtml(page('<script>var a = 1;</script>'), { filename: 'nogaloader.html' });
  assert.deepEqual(r.violations, []);
});

test('inline_js: GA を読み込むのに config が別IDしか無ければ ga-config-broken', () => {
  const html = page(GA_LOADER + "\n<script>function gtag(){}gtag('config','G-OTHER');</script>");
  const r = auditHtml(html, { filename: 'otherid.html' });
  assert.deepEqual(r.violations.map(v => v.rule), ['ga-config-broken']);
});

test('inline_js: 最初の </script> でブロックを閉じる（ブラウザと同じ）', () => {
  const blocks = extractInlineScripts('<script>var s = "</script>"; var t = 1;</script>');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].code, 'var s = "');
});

test('gen-store-pages.js: renderStorePage の出力に構文エラーが無く GA config が生きている（2026-10-09 回帰防止）', () => {
  const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
  const samples = [{ '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋' }];
  const storesJsonPath = path.join(ROOT, 'data', 'stores.json');
  if (fs.existsSync(storesJsonPath)) {
    const stores = JSON.parse(fs.readFileSync(storesJsonPath, 'utf8'));
    const real = stores.find(s => s['ホットペッパーID']);
    if (real) samples.push(real);
  }
  for (const s of samples) {
    const html = renderStorePage(s, s['ホットペッパーID'] || 'J-test', [], []);
    assert.ok(html.includes('googletagmanager.com/gtag/js'), 'GA の読み込みがある');
    const r = auditHtml(html, { filename: `render:${s['店名']}` });
    assert.deepEqual(r.violations, [], `${s['店名']}: ${JSON.stringify(r.violations)}`);
  }
});

test('GA スニペットを持つ他の生成元の見本も構文OK（journal テンプレート・特集・エリア×ジャンル）', () => {
  const files = ['journal/_template.html', 'features/nagoya-solo-dining.html'];
  const areaDir = path.join(ROOT, 'stores', 'area', 'sakae');
  if (fs.existsSync(areaDir)) {
    const first = fs.readdirSync(areaDir).filter(f => f.endsWith('.html')).sort()[0];
    if (first) files.push(path.join('stores', 'area', 'sakae', first));
  }
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const r = auditHtml(fs.readFileSync(p, 'utf8'), { filename: f });
    assert.deepEqual(r.violations, [], `${f}: ${JSON.stringify(r.violations)}`);
  }
});

test('audit_inline_js_syntax.js: 壊れたページがあれば ok=false、直れば ok=true（一時ディレクトリで確認）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-js-'));
  try {
    fs.mkdirSync(path.join(tmp, 'stores', 'area', 'sakae'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'features'));
    fs.mkdirSync(path.join(tmp, 'journal'));
    fs.writeFileSync(path.join(tmp, 'index.html'), FIXED);
    fs.writeFileSync(path.join(tmp, 'stores', 'J000000001.html'), BROKEN);
    fs.writeFileSync(path.join(tmp, 'stores', 'area', 'sakae', 'izakaya.html'), FIXED);
    fs.writeFileSync(path.join(tmp, 'journal', '_template.html'), BROKEN); // テンプレートは監査対象外
    let r = audit.run({ check: true, sample: null, only: null }, tmp);
    assert.equal(r.ok, false);
    assert.equal(r.files_scanned, 3);
    assert.deepEqual(r.by_rule, { 'js-syntax': 1, 'ga-config-broken': 1 });
    assert.equal(r.by_section.stores.violations, 2);
    fs.writeFileSync(path.join(tmp, 'stores', 'J000000001.html'), FIXED);
    r = audit.run({ check: true, sample: null, only: null }, tmp);
    assert.equal(r.ok, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('audit_inline_js_syntax.js: --sample は決定的な等間隔抽出、引数の誤りは例外', () => {
  const files = Array.from({ length: 10 }, (_, i) => `f${i}`);
  assert.deepEqual(audit.sampleEvenly(files, 5), ['f0', 'f2', 'f4', 'f6', 'f8']);
  assert.deepEqual(audit.sampleEvenly(files, 20), files);
  assert.throws(() => audit.parseArgs(['--sample', '0']));
  assert.throws(() => audit.parseArgs(['--only', 'nope']));
  assert.deepEqual(audit.parseArgs(['--check', '--only', 'stores']), { check: true, sample: null, only: 'stores' });
});
