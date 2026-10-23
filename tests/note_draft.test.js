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
  assert.match(d.body, /この先は元記事で読めます/);
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

test('タグ: 公式の目安5個まで。題名の前に出る地名・テーマから選び、記事に無い語は付けない', () => {
  const t = (title, stores = []) => N.tagsFor({ title }, policy, stores);
  // 題名の前に出る地名を選ぶ（「栄・久屋大通」なら栄）。テーマも出てくる順
  assert.deepStrictEqual(t('栄・久屋大通のハロウィン、スノーピークカフェでデート'), ['名古屋グルメ', '名古屋', '栄', 'ハロウィン', 'カフェ']);
  // 同じ位置なら長い語（栄生を栄と取り違えない）
  assert.strictEqual(t('栄生の新しい店')[2], '栄生');
  // 題名に地名が無ければ店のエリア、テーマが無ければ店のジャンル。足りない分は埋め草
  assert.deepStrictEqual(t('昼だけ開く一軒', [{ 'エリア': '大須', 'ジャンル': '中華' }]), ['名古屋グルメ', '名古屋', '大須', '中華料理', 'グルメ']);
  // 何も当たらなければ基本タグ＋埋め草だけ（関係の無い語を足さない）
  assert.deepStrictEqual(t('ある店の話'), ['名古屋グルメ', '名古屋', 'グルメ']);
  for (const tag of t('栄の居酒屋で一人飲み、手羽先とどて煮のデート向けランチ')) assert.doesNotMatch(tag, /[-・\s]/);
  assert.ok(t('栄の居酒屋で一人飲み、手羽先とどて煮のデート向けランチ').length <= policy.tags.max);
});

test('タグ: 記事の店は data/stores.json の店舗IDで引く（無い ID は空で止めない）', () => {
  assert.deepStrictEqual(N.storesOf({ store_ids: ['__no_such_id__'] }), []);
  assert.deepStrictEqual(N.storesOf({}), []);
});
