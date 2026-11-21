'use strict';

/**
 * scripts/measure_ui_baseline.js（代表画面の基準値を割合で記録・Ondine #2412）の試験。
 * 生成済みの公開ページは読まない（小さな見本を一時フォルダに作る）。
 * 割合が分母つきで出る・同じ入力で2回一致・欠点の数え方が audit_ui_extra.js と同じ・代表画面が無ければ終了コード 2。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'measure_ui_baseline.js');
const page = (css) => `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>t</title><style>${css}</style></head><body><p>本文</p></body></html>`;

function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uib-'));
  fs.mkdirSync(path.join(d, 'data'));
  fs.mkdirSync(path.join(d, 'assets/css'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'data/design_system.json'), path.join(d, 'data/design_system.json'));
  fs.writeFileSync(path.join(d, 'assets/css/nb.css'), ':root{--bg:#ffffff}\n.btn{min-height:44px}\n');
  fs.writeFileSync(path.join(d, 'good.html'), page('.a{color:#1c1c1a;background:#ffffff}'));
  fs.writeFileSync(path.join(d, 'bad.html'), page('.h{height:100vh}.b{position:fixed;bottom:0}'));
  return d;
}

const run = (d) => execFileSync(process.execPath, [SCRIPT, '--root', d, '--page', 'good=good.html', '--page', 'bad=bad.html'], { encoding: 'utf8' });

test('割合は分母つきで、欠点の入った画面だけが数えられる', () => {
  const d = fixture();
  const j = JSON.parse(run(d));
  assert.deepEqual(j.ratios.extra_pagesWithAny, { num: 1, den: 2, ratio: 0.5 });
  assert.deepEqual(j.ratios.extra_byRule['vh-100'].pagesWithViolation, { num: 1, den: 2, ratio: 0.5 });
  assert.deepEqual(j.ratios.extra_byRule['safe-area-bottom'].pagesWithViolation, { num: 1, den: 2, ratio: 0.5 });
  assert.equal(j.ratios.extra_perCssRule.num, 2);
  assert.equal(j.ratios.extra_perCssRule.den, 3); // good 1規則 + bad 2規則
  assert.equal(j.ratios.design_pagesWithViolation.den, 2);
  assert.deepEqual(j.ratios.sharedCss_perCssRule, { num: 0, den: 2, ratio: 0 });
});

test('同じ入力で2回測ると完全に一致する（日時を入れない）', () => {
  const d = fixture();
  assert.equal(run(d), run(d));
});

test('代表画面のファイルが無ければ終了コード 2', () => {
  const d = fixture();
  const r = spawnSync(process.execPath, [SCRIPT, '--root', d, '--page', 'x=missing.html'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('記録の代表画面は PAGES と同じで、割合はすべて num/den の形', () => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ui_baseline_ratio.json'), 'utf8'));
  const { PAGES } = require(SCRIPT);
  assert.deepEqual(j.pages.map((p) => p.path), PAGES.map((p) => p.path));
  const walk = (o) => {
    if (o && typeof o === 'object' && 'num' in o) { assert.equal(typeof o.den, 'number'); assert.ok(o.den > 0); return; }
    for (const v of Object.values(o || {})) if (v && typeof v === 'object') walk(v);
  };
  walk(j.ratios);
});
