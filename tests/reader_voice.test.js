'use strict';
// S7-2 読者の声: 記事末尾の部品の注入、通知メールの取り込み（実送信はしない）、再訪問率の集計
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const chrome = require('../scripts/lib/site_chrome');
const T = require('../scripts/feedback_triage');
const L = require('../scripts/lib/ga4_baseline');
const B = require('../scripts/ga4_baseline');

const ROOT = path.resolve(__dirname, '..');

test('部品を入れるのは特集・ジャーナルの記事だけ', () => {
  assert.ok(chrome.isReaderVoicePage('features/banquet.html'));
  assert.ok(chrome.isReaderVoicePage('journal/_template.html'));
  assert.ok(chrome.isReaderVoicePage('journal/2026-11-10-foo.html'));
  ['features/index.html', 'features/editorial-policy.html', 'journal/index.html', 'index.html', 'stores/abc.html', 'about.html']
    .forEach(r => assert.ok(!chrome.isReaderVoicePage(r), r));
});

test('applyReaderVoice はべき等で、フッターの手前に入り、対象外は変えない', () => {
  const page = '<main>本文</main>\n<!-- NB-CHROME:FOOTER:START -->\n<footer></footer>\n<!-- NB-CHROME:FOOTER:END -->\n';
  const once = chrome.applyReaderVoice(page, 'features/x.html');
  assert.ok(once.indexOf('NB-READER-VOICE:START') < once.indexOf('NB-CHROME:FOOTER:START'));
  assert.strictEqual(chrome.applyReaderVoice(once, 'features/x.html'), once);
  assert.strictEqual(chrome.applyReaderVoice(page, 'features/index.html'), page);
  assert.strictEqual(chrome.applyReaderVoice('<p>x</p>', 'features/x.html'), '<p>x</p>');
});

test('部品は個人情報欄を持たず、既存の Formspree に記事 URL つきで送る', () => {
  const h = chrome.renderReaderVoice();
  assert.ok(h.includes('https://formspree.io/f/xaqaygze'));
  assert.ok(h.includes('article_url'));
  assert.ok(h.includes('[site-feedback] '));
  assert.ok(!/type="(email|tel)"|name="(email|name|tel)"/.test(h));
});

test('日次記事の雛形と特集に部品が入っている（apply_site_chrome の結果）', () => {
  const t = fs.readFileSync(path.join(ROOT, 'journal/_template.html'), 'utf8');
  assert.ok(t.includes('NB-READER-VOICE:START'));
  const f = fs.readFileSync(path.join(ROOT, 'features/banquet.html'), 'utf8');
  assert.ok(f.includes('nb-reader-voice'));
});

test('取り込み: 記事 URL つきの見本メールが article-widget として読める', () => {
  const mail = [
    'New submission from nagoya-bites',
    'category: 記事: 情報の誤り',
    'article_answer: error',
    'article_url: https://nagoya-bites.com/features/banquet.html',
    'page: /features/banquet.html',
    'body: 〇〇食堂は閉店していました。',
    '2行目の補足',
    'submittedAt: 2026-11-17T01:00:00.000Z',
  ].join('\n');
  const r = T.parseFormspreeMail(mail);
  assert.strictEqual(r.source, 'article-widget');
  assert.strictEqual(r.page, '/features/banquet.html');
  assert.strictEqual(r.article_answer, 'error');
  assert.strictEqual(r.suggested_verdict, 'fact_check');
  assert.ok(r.feedback.includes('閉店') && r.feedback.includes('補足'));
});

test('取り込み: 従来のご意見は site-widget のまま・記事 URL が違うものは記事の声にしない', () => {
  const old = T.parseFormspreeMail('category: その他\nbody: ここが使いにくい\npage: #feedback');
  assert.strictEqual(old.source, 'site-widget');
  assert.strictEqual(old.article_url, null);
  const bad = T.parseFormspreeMail('article_url: https://evil.example/features/x.html\narticle_answer: yes\nbody: a');
  assert.strictEqual(bad.source, 'site-widget');
});

test('再訪問率の集計と問い合わせ', () => {
  const r = L.aggregateReturning([
    { dims: ['new'], mets: [60, 70] }, { dims: ['returning'], mets: [40, 90] }, { dims: ['(not set)'], mets: [5, 5] },
  ]);
  assert.strictEqual(r.returningUserRate, 0.4);
  assert.strictEqual(r.returningSessionRate, 0.563);
  assert.strictEqual(L.aggregateReturning([]).returningUserRate, null);
  const req = B.buildRequests({ start: '2026-11-01', end: '2026-11-10' });
  assert.strictEqual(req.returning.dimensions[0].name, 'newVsReturning');
  assert.ok(L.EVENTS.includes('article_feedback'));
});
