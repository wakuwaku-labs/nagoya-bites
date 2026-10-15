'use strict';
// MEO-003: 特集の店カードの★を、データに評価が無い店（紐付けの状態で評価を消した店など）から外す。

const test = require('node:test');
const assert = require('node:assert/strict');
const { ratedIndex, stripScores } = require('../scripts/sync_feature_scores.js');

const card = (id, score) => `      <div class="store-card">
        <div class="store-num">01</div>
        <div class="store-info">
          <h3 class="store-name"><a href="https://nagoya-bites.com/stores/${id}.html">店</a></h3>
          <div class="store-meta"><span>栄</span><span>居酒屋</span><span class="score">★ ${score}</span><span>2001～3000円</span></div>
        </div>
      </div>`;

test('データに評価が無い店の★だけ外し、評価がある店・データに無い店の★は残す', () => {
  const rated = ratedIndex([
    { 'ホットペッパーID': 'J1', 'Google評価': '4.2' },
    { 'ホットペッパーID': 'J2' },
  ]);
  const html = [card('J1', '4.2'), card('J2', '4.7'), card('J9', '4.0')].join('\n');
  const r = stripScores(html, rated);
  assert.deepEqual(r.removed, ['J2']);
  assert.match(r.html, /stores\/J1\.html[\s\S]*★ 4\.2/);
  assert.doesNotMatch(r.html, /★ 4\.7/);
  assert.match(r.html, /★ 4\.0/, 'データに無い店（J9）は触らない');
  assert.match(r.html, /<span>居酒屋<\/span><span>2001～3000円<\/span>/, '★を外した後も、ほかの項目は並んだまま');
  assert.deepEqual(stripScores(r.html, rated).removed, [], '2 回目は何もしない（冪等）');
});

test('店カードの外の★と、カードの始まりから離れすぎた★は触らない', () => {
  const rated = ratedIndex([{ 'ホットペッパーID': 'J2' }]);
  const outside = `<p><span class="score">★ 4.5</span></p>`;
  assert.deepEqual(stripScores(outside, rated).removed, []);
  const far = `<div class="store-card"><a href="stores/J2.html">x</a></div>${' '.repeat(3000)}<span class="score">★ 4.5</span>`;
  assert.deepEqual(stripScores(far, rated).removed, []);
});

test('手書きのカード（★の後に店舗ページへのリンク）は★の行ごと外す。別の店へのリンクが混ざるカードは触らない', () => {
  const rated = ratedIndex([{ 'ホットペッパーID': 'J2' }, { 'ホットペッパーID': 'J3' }]);
  const hand = `<div class="store-card">
        <div class="store-info">
          <h3 class="store-name">店</h3>
          <div class="store-meta">
            <span class="score">★ 4.4</span>
            <span>金山</span>
          </div>
          <a class="store-link" href="../stores/J2.html">店舗ページで詳細を見る</a>
        </div>
      </div>`;
  const r = stripScores(hand, rated);
  assert.deepEqual(r.removed, ['J2']);
  assert.match(r.html, /<div class="store-meta">\n {12}<span>金山<\/span>/, '空の行を残さない');
  const mixed = hand.replace('</a>', '</a><a href="../stores/J3.html">似た店</a>');
  assert.deepEqual(stripScores(mixed, rated).removed, [], 'どの店の★か 1 つに決まらない');
});

test('外枠が class="store" の手書きの特集（ひつまぶし）でも、カードの店の★を外す', () => {
  const rated = ratedIndex([{ 'ホットペッパーID': 'J1', 'Google評価': '4.3' }, { 'ホットペッパーID': 'J2' }]);
  const store = (id, score) => `<div class="store">
  <div class="store-body">
  <div class="store-meta"><span>和食 / ひつまぶし</span><span class="score">★ Google ${score}（587件）</span></div>
  <a class="store-link" href="../stores/${id}.html">詳細ページを見る</a>
</div></div>`;
  const r = stripScores(store('J1', '4.3') + store('J2', '4.6'), rated);
  assert.deepEqual(r.removed, ['J2']);
  assert.match(r.html, /Google 4\.3/);
  assert.doesNotMatch(r.html, /Google 4\.6/);
});
