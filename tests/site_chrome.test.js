'use strict';

/**
 * scripts/lib/site_chrome.js / scripts/apply_site_chrome.js の単体テスト（DSN-003）。
 *
 * このゲートが守るもの:
 *   「全ページのヘッダー/ナビ/パンくず/フッターが scripts/lib/site_chrome.js の
 *    正本と一致すること」。ここでの回帰は「ページ種別ごとにナビ項目がバラバラに戻る」
 *    という形で表に出るため、レンダラーの決定性（同じ入力→同じ出力）と、
 *    apply_site_chrome.js --check の純読み取り性を固定回帰テストとして残す。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APPLY = path.join(ROOT, 'scripts', 'apply_site_chrome.js');
const chrome = require(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'));

test('site_chrome.js: NAV_PRIMARY has 5 items, NAV_SECONDARY has 2, FOOTER_GROUPS has 3', () => {
  assert.equal(chrome.NAV_PRIMARY.length, 5);
  assert.equal(chrome.NAV_SECONDARY.length, 2);
  assert.equal(chrome.FOOTER_GROUPS.length, 3);
});

test('site_chrome.js: renderHeader is deterministic (same input -> same output)', () => {
  const a = chrome.renderHeader({ depth: 1, active: 'features' });
  const b = chrome.renderHeader({ depth: 1, active: 'features' });
  assert.equal(a, b);
});

test('site_chrome.js: renderHeader marks the active nav item with aria-current, others without', () => {
  const html = chrome.renderHeader({ depth: 0, active: 'journal' });
  assert.match(html, /<a href="journal\/index\.html" aria-current="page">ジャーナル<\/a>/);
  assert.doesNotMatch(html, /<a href="index\.html" aria-current="page">/);
});

test('site_chrome.js: renderHeader depth prefixes hrefs with the right number of "../"', () => {
  const html = chrome.renderHeader({ depth: 2, active: null });
  assert.match(html, /href="\.\.\/\.\.\/index\.html"/);
});

test('site_chrome.js: renderHeader withFav includes the saved-count link, otherwise omits it', () => {
  const withFav = chrome.renderHeader({ depth: 0, active: 'top', withFav: true });
  const withoutFav = chrome.renderHeader({ depth: 0, active: 'top', withFav: false });
  assert.match(withFav, /class="nav-fav"/);
  assert.doesNotMatch(withoutFav, /class="nav-fav"/);
});

test('site_chrome.js: renderFooter includes all 3 groups and the feedback-nudge class', () => {
  const html = chrome.renderFooter({ depth: 1 });
  for (const g of chrome.FOOTER_GROUPS) {
    assert.match(html, new RegExp(`aria-label="${g.title}"`));
  }
  assert.match(html, /class="feedback-nudge"/);
});

test('site_chrome.js: renderBreadcrumb escapes HTML-special characters in labels', () => {
  const html = chrome.renderBreadcrumb([{ href: 'index.html', label: 'TOP' }, { label: 'A & B <script>' }], { depth: 0 });
  assert.match(html, /A &amp; B &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('site_chrome.js: activeKeyFor maps each page group to the expected nav key', () => {
  assert.equal(chrome.activeKeyFor('index.html'), 'top');
  assert.equal(chrome.activeKeyFor('features/editorial-policy.html'), 'editorial');
  assert.equal(chrome.activeKeyFor('features/banquet.html'), 'features');
  assert.equal(chrome.activeKeyFor('journal/2026-09-07-foo.html'), 'journal');
  assert.equal(chrome.activeKeyFor('stores/J000015064.html'), 'top');
  assert.equal(chrome.activeKeyFor('about.html'), 'about');
});

test('apply_site_chrome.js: --check is a pure read (never writes to disk)', () => {
  const targetFile = path.join(ROOT, 'about.html');
  const before = fs.readFileSync(targetFile, 'utf8');
  execFileSync('node', [APPLY, '--check', '--only', 'root'], { cwd: ROOT, encoding: 'utf8' });
  const after = fs.readFileSync(targetFile, 'utf8');
  assert.equal(before, after);
});

test('apply_site_chrome.js: --dry-run is a pure read (never writes to disk)', () => {
  const targetFile = path.join(ROOT, 'index.html');
  const before = fs.readFileSync(targetFile, 'utf8');
  execFileSync('node', [APPLY, '--dry-run', '--only', 'root'], { cwd: ROOT, encoding: 'utf8' });
  const after = fs.readFileSync(targetFile, 'utf8');
  assert.equal(before, after);
});

test('apply_site_chrome.js: --check reports zero mismatches across a sample of every group', () => {
  for (const group of ['root', 'features', 'journal', 'stores']) {
    const out = execFileSync('node', [APPLY, '--check', '--only', group, '--sample', '40'], { cwd: ROOT, encoding: 'utf8' });
    const parsed = JSON.parse(out);
    assert.equal(parsed.files_changed, 0, `group ${group} should be idempotent (0 changes), got: ${out}`);
  }
});

test('gen-store-pages.js: renderStorePage output contains all 4 chrome markers with balanced braces', () => {
  const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
  const storesJsonPath = path.join(ROOT, 'data', 'stores.json');
  if (!fs.existsSync(storesJsonPath)) return; // 環境依存（ローカルビルド未実行）はスキップ
  const stores = JSON.parse(fs.readFileSync(storesJsonPath, 'utf8'));
  const sample = stores.find(s => s['ホットペッパーID']);
  if (!sample) return;
  const html = renderStorePage(sample, sample['ホットペッパーID'], []);
  assert.match(html, /NB-CHROME:HEADER:START/);
  assert.match(html, /NB-CHROME:BREADCRUMB:START/);
  assert.match(html, /NB-CHROME:FOOTER:START/);
  assert.match(html, /NB-CHROME:SCRIPT:START/);
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const body = styleMatch[1];
  const diff = (body.match(/\{/g) || []).length - (body.match(/\}/g) || []).length;
  assert.equal(diff, 0, 'store page <style> braces should balance');
});
