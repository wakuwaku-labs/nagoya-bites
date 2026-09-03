'use strict';

/**
 * scripts/audit_design_system.js / scripts/apply_design_system.js の単体テスト（DSN-001）。
 *
 * このゲートが守るもの:
 *   「可視テキストの font-size 12px 未満を禁止する」（CLAUDE.md 制約12）。
 * ここでの回帰は「小さすぎる文字が再びサイトに出る」という形で表に出るため、
 * 既知のバグパターン（CSSコメントがセレクタ名に混入する・!important 付きの値を見落とす）を
 * 固定回帰テストとして残す（CLAUDE.md 品質ゲートの原則5）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AUDIT = path.join(ROOT, 'scripts', 'audit_design_system.js');
const APPLY = path.join(ROOT, 'scripts', 'apply_design_system.js');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'design_system.json'), 'utf8'));

test('design_system.json: floorPx is 12 and fontsUrl is a single https URL', () => {
  assert.equal(DS.floorPx, 12);
  assert.match(DS.fontsUrl, /^https:\/\/fonts\.googleapis\.com\//);
});

test('design_system.json: coreTokens has no duplicates', () => {
  const seen = new Set(DS.coreTokens);
  assert.equal(seen.size, DS.coreTokens.length);
});

test('audit_design_system.js: CLI runs and produces valid JSON on --report', () => {
  const out = execFileSync('node', [AUDIT, '--report', '--sample', '5'], { cwd: ROOT, encoding: 'utf8' });
  const parsed = JSON.parse(out);
  assert.equal(typeof parsed.ok, 'boolean');
  assert.equal(typeof parsed.files_scanned, 'number');
  assert.ok(Array.isArray(parsed.violations));
});

test('apply_design_system.js: --check is a pure read (never writes to disk)', () => {
  const targetFile = path.join(ROOT, 'about.html');
  const before = fs.readFileSync(targetFile, 'utf8');
  execFileSync('node', [APPLY, '--check', '--only', 'root'], { cwd: ROOT, encoding: 'utf8' });
  const after = fs.readFileSync(targetFile, 'utf8');
  assert.equal(before, after, '--check must not modify files on disk');
});

test('apply_design_system.js: --dry-run is a pure read (never writes to disk)', () => {
  const targetFile = path.join(ROOT, 'features', 'banquet.html');
  const before = fs.readFileSync(targetFile, 'utf8');
  execFileSync('node', [APPLY, '--dry-run', '--only', 'features'], { cwd: ROOT, encoding: 'utf8' });
  const after = fs.readFileSync(targetFile, 'utf8');
  assert.equal(before, after, '--dry-run must not modify files on disk');
});

test('regression: font-size below floor with !important suffix is still detected (past bug)', () => {
  // 過去の実バグ: pxFromFontSize が "!important" 付きの値を解釈できず、
  // .nav-fav{font-size:.72rem !important;} のような宣言が検査を素通りしていた。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsn-important-'));
  try {
    const fixture = `<!DOCTYPE html><html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${DS.fontsUrl}" rel="stylesheet">
<link rel="stylesheet" href="assets/css/nb.css">
<style>.x{font-size:.5rem !important;}</style>
</head><body><header><a class="logo">L</a></header><footer>f</footer></body></html>`;
    // audit_design_system.js は固定ディレクトリ走査のため、ここではパース関数の挙動を
    // ソース文字列から直接呼び出して確認する（軽量な単体テスト）。
    const modSrc = fs.readFileSync(AUDIT, 'utf8');
    const fnMatch = modSrc.match(/function pxFromFontSize\([\s\S]*?\n}/);
    assert.ok(fnMatch, 'pxFromFontSize function must exist in audit_design_system.js');
    // eslint-disable-next-line no-new-func
    const pxFromFontSize = new Function('value', fnMatch[0].replace(/^function pxFromFontSize\(value\) \{/, '').replace(/\n}$/, ''));
    const px = pxFromFontSize('.5rem !important');
    assert.equal(px, 8, 'must parse px value even with !important suffix (regression guard)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('regression: CSS comment immediately before a selector does not get glued into it (past bug)', () => {
  // 過去の実バグ: splitRules が「直前のコメント」をセレクタ名に混入させ、
  // "/* HEADER */\nheader" のようになった結果 chromeSelectors との完全一致判定に失敗し、
  // header/nav/footer の重複ルールが index.html から一切除去されていなかった。
  const modSrc = fs.readFileSync(APPLY, 'utf8');
  assert.match(
    modSrc,
    /cleanSelector = selBuf\.replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\/\/g, ''\)\.trim\(\)/,
    'splitRules must strip /* comments */ before comparing selector names'
  );
});
