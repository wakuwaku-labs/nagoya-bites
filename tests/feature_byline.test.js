'use strict';
// SEO-145: 特集の公開日・更新日・書き手を、JSON-LD を正本にした部品1つで出す
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'scripts', 'lib', 'feature_byline.js'));

const LD = (pub, mod) => `<script type="application/ld+json">{"@type":"Article","datePublished":"${pub}","dateModified":"${mod}"}</script>`;
const page = (ld, hero) => `<html><head>${ld}</head><body>\n<div class="art-hero">\n    <h1 class="art-title">題</h1>\n${hero}\n</div>\n<p>本文</p></body></html>`;

test('公開・更新の語が付いた日付と書き手名だけを消し、版の表記と催しの日付は残す', () => {
  for (const t of ['公開 2026年5月8日', '2026年4月23日 更新', '2026年05月08 公開', '2026.04.23 更新', '2026-05-22 公開',
    '更新 2026-08-20', '初版 2026年4月', '最終更新 2026年8月', '2026年5月更新', 'NAGOYA BITES 編集部', '編集: NAGOYA BITES編集部']) {
    assert.equal(B.isRedundantSegment(t), true, t);
  }
  for (const t of ['2026年版', '2026年完全版', '2026年春版', '2026年5月10日', '5月3日〜6日対応', '掲載10軒', '現役飲食店マネージャー監修']) {
    assert.equal(B.isRedundantSegment(t), false, t);
  }
});

test('span の meta 行: 部品を meta 行の前に置き、重なる区切りだけ除く。2回当てても変わらない', () => {
  const html = page(LD('2026-04-15', '2026-10-09'),
    '    <div class="art-meta">\n      <span>2026年版</span>\n      <span>公開 2026年4月15日</span>\n      <span>NAGOYA BITES 編集部</span>\n    </div>');
  const out = B.applyByline(html, { selfFile: 'banquet.html' });
  assert.match(out, /<p class="nb-byline"><span>公開 <time datetime="2026-04-15">2026年4月15日<\/time><\/span><span>更新 <time datetime="2026-10-09">2026年10月9日<\/time><\/span><span>執筆 <a href="editorial-policy.html">NAGOYA BITES 編集部<\/a>/);
  assert.ok(out.indexOf('nb-byline') < out.indexOf('art-meta'), '部品は meta 行の前');
  assert.match(out, /<div class="art-meta">\n      <span>2026年版<\/span>\n    <\/div>/);
  assert.equal(B.applyByline(out, { selfFile: 'banquet.html' }), out);
});

test('文字だけの meta 行: 区切りごとに判定し、先頭の「日付 更新 —」も外す', () => {
  assert.equal(B.cleanMetaInner('NAGOYA BITES編集部 ｜ 2026年5月更新 ｜ 10店掲載'), '10店掲載');
  assert.equal(B.cleanMetaInner('2026.05.14 更新 — 名駅・栄・伏見・大須エリア対応'), '名駅・栄・伏見・大須エリア対応');
  assert.equal(B.cleanMetaInner('2026年5月10日 ｜ 個室あり'), '2026年5月10日 ｜ 個室あり');
});

test('meta 行が空になれば行ごと除き、部品が見出しまわりの最後の行になる', () => {
  const html = page(LD('2026-04-20', '2026-08-20'),
    '    <div class="art-meta">\n      <span>初版 2026年4月</span>\n      <span>最終更新 2026年8月</span>\n    </div>');
  const out = B.applyByline(html, { selfFile: 'editorial-policy.html' });
  assert.ok(!out.includes('art-meta'));
  assert.match(out, /<p class="nb-byline nb-byline--end">/);
  assert.ok(!out.includes('<a href="editorial-policy.html">'), '編集規約のページ自身にはリンクを張らない');
  assert.equal(B.applyByline(out, { selfFile: 'editorial-policy.html' }), out);
});

test('更新日が公開日と同じなら更新を出さない。datePublished が無いページは触らない', () => {
  const same = B.applyByline(page(LD('2026-05-14', '2026-05-14'), '    <p class="hero-meta">10店掲載</p>'));
  assert.ok(same.includes('公開 <time datetime="2026-05-14">'));
  assert.ok(!same.includes('更新 <time'));
  const undated = '<html><body><h1>特集一覧</h1><p class="art-meta"><span>2026年版</span></p></body></html>';
  assert.equal(B.applyByline(undated), undated);
});

test('JSON-LD の日付は最も古い datePublished と最も新しい dateModified を採る', () => {
  const html = LD('2026-05-14', '2026-05-22') + LD('2026-05-10', '2026-06-01');
  assert.deepEqual(B.readJsonLdDates(html), { published: '2026-05-10', modified: '2026-06-01' });
  assert.deepEqual(B.readJsonLdDates(LD('2026-05-14', '2026-05-01')), { published: '2026-05-14', modified: '2026-05-14' });
});

test('公開中の全特集: 部品が当たり済みで、日付はサイト開始日（2026-03-28）以降・未来日なし', () => {
  const dir = path.join(ROOT, 'features');
  // 編集部は日本時間で日付を書く（UTC ではまだ前日のことがある）
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  let dated = 0;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const dates = B.readJsonLdDates(html);
    if (!dates) continue;
    dated++;
    assert.equal(B.applyByline(html, { selfFile: file }), html, `${file}: node scripts/apply_feature_byline.js を実行する`);
    assert.equal(html.split(B.START).length - 1, 1, `${file}: 部品は1つだけ`);
    assert.ok(dates.published >= '2026-03-28', `${file}: datePublished ${dates.published} がサイト開始前`);
    assert.ok(dates.modified <= today, `${file}: dateModified ${dates.modified} が未来`);
  }
  assert.ok(dated >= 60, `日付のある特集が ${dated} 本しかない`);
});
