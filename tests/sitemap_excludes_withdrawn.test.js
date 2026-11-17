'use strict';
// 取り下げた記事（noindex の印あり）をサイトマップから外す（S4-4・基本方針 段階4・ADR 0069）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const J = require('../scripts/lib/journal_category');

test('取り下げの印のある記事だけを除く', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
  fs.writeFileSync(path.join(dir, '2026-11-01-a.html'), '<head><meta name="robots" content="noindex" data-withdrawn></head>');
  fs.writeFileSync(path.join(dir, '2026-11-02-b.html'), '<head><title>b</title></head>');
  const out = J.filterPublicArticleFiles(dir, ['2026-11-01-a.html', '2026-11-02-b.html', '2026-11-03-missing.html']);
  assert.deepStrictEqual(out, ['2026-11-02-b.html', '2026-11-03-missing.html']);
});

test('gen-store-pages.js のサイトマップ生成が除外を通っている', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'gen-store-pages.js'), 'utf8');
  assert.match(src, /filterPublicArticleFiles\(\s*journalDir/);
});

test('現在のサイトマップに取り下げ記事の URL が無い', () => {
  const dir = path.join(__dirname, '..', 'journal');
  const sm = fs.readFileSync(path.join(__dirname, '..', 'sitemap.xml'), 'utf8');
  for (const f of fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}.*\.html$/.test(f))) {
    if (J.isWithdrawnHtml(fs.readFileSync(path.join(dir, f), 'utf8'))) assert.ok(!sm.includes('/journal/' + f), f);
  }
});
