'use strict';

/**
 * scripts/audit_ui_extra.js（デザイン監査の別の出力・Ondine #2411）の試験。
 * 良い見本は 0・欠点入りの見本は項目ごとに検出・判定できない所は数えない・同じ入力で2回一致。
 * audit_design_system.js と data/design_system.json を変えていないことも固定する。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const X = require(path.join(ROOT, 'scripts', 'audit_ui_extra.js'));
const tokens = { '--bg': '#ffffff', '--text': '#1c1c1a', '--lite': '#cccccc', '--tap': '44px' };
const htmlOf = (css, vp) => `<html><head><meta name="viewport" content="${vp || 'width=device-width, initial-scale=1, viewport-fit=cover'}"><style>${css}</style></head><body></body></html>`;
const rules = (html) => X.auditHtml(html, { tokens }).map((v) => v.rule).sort();

const GOOD = `
.card{color:var(--text);background:var(--bg)}
.btn{min-height:var(--tap);padding:8px}
input{font-size:16px}
.hero{min-height:100vh;min-height:100dvh}
.bar{position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom)}
.note{color:rgba(0,0,0,.5)}
.x{color:var(--unknown);background:#fff}
.g{color:#777;background:linear-gradient(#000,#fff)}
.c{height:calc(100% - 10px)}
@keyframes k{from{height:10px}to{height:20px}}
`;

test('良い見本は 0 件（判定できない所は数えない）', () => {
  assert.deepEqual(rules(htmlOf(GOOD)), []);
});

test('欠点入りの見本は項目ごとに検出する', () => {
  assert.deepEqual(rules(htmlOf('.a{color:var(--lite);background:var(--bg)}')), ['low-contrast']);
  assert.deepEqual(rules(htmlOf('.btn{height:20px}')), ['tap-target-24', 'tap-target-44']);
  assert.deepEqual(rules(htmlOf('a.x{min-height:30px}')), ['tap-target-44']);
  assert.deepEqual(rules(htmlOf('.s input{font-size:14px}')), ['input-font-16']);
  assert.deepEqual(rules(htmlOf('.h{height:100vh}')), ['vh-100']);
  assert.deepEqual(rules(htmlOf('.b{position:fixed;bottom:0}')), ['safe-area-bottom']);
  assert.deepEqual(rules(htmlOf('.b{padding:env(safe-area-inset-top)}', 'width=device-width, initial-scale=1')), ['safe-area-no-viewport-fit']);
  assert.deepEqual(rules(htmlOf('.a{}', 'width=device-width, user-scalable=no')), ['viewport-zoom-locked']);
  assert.deepEqual(rules(htmlOf('.a{}', 'width=device-width, maximum-scale=1')), ['viewport-zoom-locked']);
});

test('比の計算: 白と黒は 21:1', () => {
  assert.equal(Math.round(X.contrast({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })), 21);
});

test('CLI: 同じ入力で2回走らせて一致・良い見本は 0・欠点は検出', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uix-'));
  const good = path.join(d, 'good.html'), bad = path.join(d, 'bad.html');
  fs.writeFileSync(good, htmlOf(GOOD));
  fs.writeFileSync(bad, htmlOf('.h{height:100vh}.btn{height:20px}'));
  const run = (...a) => execFileSync('node', [path.join(ROOT, 'scripts', 'audit_ui_extra.js'), '--file', ...a], { encoding: 'utf8' });
  assert.equal(JSON.parse(run(good)).total, 0);
  assert.equal(JSON.parse(run(bad)).total, 3);
  assert.equal(run(good, bad), run(good, bad));
});

test('実リポジトリ: 全体を2回走らせて一致', () => {
  const run = () => execFileSync('node', [path.join(ROOT, 'scripts', 'audit_ui_extra.js'), '--file', path.join(ROOT, 'index.html'), path.join(ROOT, 'about.html')], { encoding: 'utf8' });
  assert.equal(run(), run());
});
