'use strict';
const test = require('node:test');
const assert = require('node:assert');
const N = require('../scripts/lib/note_draft');

const policy = N.loadPolicy();
const entry = { slug: '2026-10-21-x', title: '伏見の店で読む', date: '2026-10-21' };
const html = `<h1 class="art-title">伏見の店で<em>読む</em></h1><p class="art-lead">導入文。</p>
<div class="art-body"><p class="nb-site-intro">x</p>
<h2>節1</h2><p>営業は<strong>17:00</strong>からです。</p><h2>節2</h2><p>二つ目。</p>
<div class="insider-box"><ul><li>ポイント1</li></ul></div><div class="store-list"></div></article>`;

test('excerpt: 最初の節とポイントだけ載せ、残りは元記事へ誘導する', () => {
  const d = N.buildNoteDraft(entry, html, policy);
  assert.match(d.body, /## 節1/);
  assert.doesNotMatch(d.body, /節2/);
  assert.match(d.body, /残り1節/);
  assert.match(d.body, /\*\*17:00\*\*/);
  assert.match(d.body, /utm_source=note/);
  assert.ok(d.tags.includes('伏見'));
});

test('検査: 記事に無い数字・使えない言い方・UTM欠落を止める', () => {
  const art = N.htmlToText(html);
  const d = N.buildNoteDraft(entry, html, policy);
  assert.deepStrictEqual(N.validateNoteDraft(d, { policy, articleText: art }), []);
  const bad = { ...d, body: d.body + '\n業界人が厳選した98店' };
  const f = N.validateNoteDraft(bad, { policy, articleText: art }).join(' ');
  assert.match(f, /wording/);
  assert.match(f, /numbers_not_in_article:98/);
  assert.match(N.validateNoteDraft({ ...d, body: 'a' }, { policy, articleText: art }).join(' '), /utm_missing/);
});
