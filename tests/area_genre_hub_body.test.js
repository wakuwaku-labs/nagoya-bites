'use strict';

/**
 * エリア×ジャンル×条件ページ（stores/area/）の本文の検査（SEO-124）。
 * 編集部の見分け方（data/area_genre_pages_policy.json の guide）・選定理由がある店の別枠・
 * 予算帯と最寄り駅の表・FAQPage の構造化データを出さないこと・データ更新日が台帳の updated と
 * 一致することを、生成器の関数と生成済みページの両方で確かめる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const policy = require('../data/area_genre_pages_policy.json');
const manifest = require('../data/area_genre_pages_manifest.json');
const { priceBandRows, editorPicks, topStations } = require('../scripts/gen_area_genre_pages.js');
const { firstAichiStation, canonicalStation } = require('../scripts/lib/station_names.js');

const activePages = manifest.pages.filter((p) => p.status === 'active');
const read = (p) => fs.readFileSync(path.join(ROOT, p.path), 'utf8');

test('policy: ジャンル17・条件13のすべてに見分け方の短文がある', () => {
  for (const g of [...policy.genres, ...policy.conditions]) {
    assert.ok(typeof g.guide === 'string' && g.guide.length >= 20, `${g.slug} の guide が無いか短すぎる`);
  }
  assert.equal(typeof policy.editorPicks.max, 'number');
  assert.equal(typeof policy.tables.stationTop, 'number');
});

test('policy: 見分け方に推測の数値を書かない（法律の「20歳」だけは確定事実として許す）', () => {
  for (const g of [...policy.genres, ...policy.conditions]) {
    assert.doesNotMatch(g.guide.replace(/20歳/g, ''), /[0-9０-９]/, `${g.slug} の guide に数字がある: ${g.guide}`);
  }
});

test('priceBandRows: 価格帯の下限の安い順に並べ、表記の無い店は数えない', () => {
  const stores = [
    { '価格帯': '3001～4000円' }, { '価格帯': '1001～1500円' }, { '価格帯': '3001～4000円' },
    { '価格帯': '' }, {}, { '価格帯': '～1000円' }, { '価格帯': '10001～15000円' },
  ];
  assert.deepEqual(priceBandRows(stores), [
    ['～1000円', 1], ['1001～1500円', 1], ['3001～4000円', 2], ['10001～15000円', 1],
  ]);
});

test('editorPicks: おすすめポイントと同じ文は数えず、根拠の強い順に最大件数まで', () => {
  const a = { '店名': 'A', editorReason: '理由A', 'おすすめポイント': '別の文', visitStatus: 'desk_automated', 'Google評価': '4.5', '口コミ数': '100' };
  const b = { '店名': 'B', editorReason: '理由B', 'おすすめポイント': '別の文', visitStatus: 'visited', 'Google評価': '3.5', '口コミ数': '10' };
  const c = { '店名': 'C', editorReason: '同じ文。', 'おすすめポイント': '同じ文', visitStatus: 'visited' };
  const d = { '店名': 'D', 'おすすめポイント': '理由なし' };
  const e = { '店名': 'E', editorReason: '理由E', 'おすすめポイント': '', visitStatus: 'interview', 'Google評価': '4.0', '口コミ数': '50' };
  assert.deepEqual(editorPicks([a, b, c, d, e], 3).map((s) => s['店名']), ['B', 'E', 'A']);
  assert.deepEqual(editorPicks([a, b, c, d, e], 1).map((s) => s['店名']), ['B']);
  assert.deepEqual(editorPicks([c, d], 3), []);
});

test('firstAichiStation: 県内の駅名だけを返し、旧駅名・略称は今の駅名にそろえる', () => {
  assert.equal(firstAichiStation('JR名古屋駅 徒歩5分'), '名古屋');
  assert.equal(firstAichiStation('地下鉄東山線名古屋駅5出口より徒歩約6分/地下鉄桜通線国際センター駅'), '名古屋');
  assert.equal(firstAichiStation('空港バス，名古屋市営地下鉄桜通線，名古屋市営地下鉄東山線名古屋駅'), '名古屋');
  assert.equal(firstAichiStation('名駅から徒歩3分'), '名古屋');
  assert.equal(firstAichiStation('地下鉄市役所駅2番出口すぐ'), '名古屋城');
  assert.equal(firstAichiStation('JR釧路駅出口より徒歩約14分'), null);
  assert.equal(firstAichiStation('JR神田(東京)駅東口より約1分 栄駅から徒歩5分'), '栄');
  assert.equal(firstAichiStation('地下鉄東山駅から徒歩2分'), null);
  assert.equal(firstAichiStation('バス停「栄町」下車'), null);
  assert.equal(canonicalStation('金山総合'), '金山');
});

test('topStations: 同じ駅の表記ゆれを1つに数え、県外の駅は数えず、駅の分かる店が半分未満なら出さない', () => {
  const st = (a) => ({ 'アクセス': a });
  assert.deepEqual(
    topStations([st('JR名古屋駅 徒歩5分'), st('名古屋駅から3分'), st('JR釧路駅から18分'), st('栄駅すぐ')], 5),
    [['名古屋駅', 2], ['栄駅', 1]],
  );
  assert.deepEqual(topStations([st('JR釧路駅から18分'), st('JR釧路駅から14分'), st('栄駅すぐ')], 5), []);
});

test('生成済みページ: FAQPage の構造化データを出さない（画面の FAQ は残す）', () => {
  let withVisibleFaq = 0;
  for (const p of activePages) {
    const html = read(p);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotMatch(m[1], /"FAQPage"/, `${p.path} に FAQPage がある`);
    }
    if (html.includes('class="faq-section"')) withVisibleFaq++;
  }
  assert.ok(withVisibleFaq > 0, '画面の FAQ が1本も無い');
});

test('生成済みページ: 一覧ページはすべて見分け方を持ち、データ更新日が台帳の updated と一致する', () => {
  const listing = activePages.filter((p) => p.type === 'genre' || p.type === 'condition');
  assert.ok(listing.length > 600);
  for (const p of listing) {
    const html = read(p);
    assert.match(html, /編集部の見分け方/, `${p.path} に見分け方が無い`);
    const d = html.match(/データ更新日\s*(\d{4}-\d{2}-\d{2})/);
    assert.ok(d, `${p.path} にデータ更新日が無い`);
    assert.equal(d[1], p.updated, `${p.path} のデータ更新日が台帳と違う`);
  }
});

test('生成済みページ: 本文に幅と左右の余白があり、表は上揃え（スマホで端まで詰めない）', () => {
  const html = read(activePages.find((p) => p.type === 'condition'));
  assert.match(html, /\.container\{max-width:var\(--container-mid\);margin:0 auto;padding:var\(--sp-5\) var\(--sp-4\) var\(--sp-7\);\}/);
  assert.match(html, /\.hub-tables\{[^}]*align-items:start;/);
});
