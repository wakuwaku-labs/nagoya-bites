'use strict';

/**
 * tests/related_label.test.js — 関連記事のリンク文を「…」で切らない（I-26f の続き・I-26g・U-78）
 *
 * 事故: 日次ジャーナルの「関連記事」と特集の「この特集の店の最新ジャーナル記事」は、記事の題が 38 字を超えると
 * 36 字＋「…」に切ってリンク文にしていた（公開ページ 362 か所）。画面の読み上げは途中で終わった文を
 * 「…」まで読み、見ている人もどの記事か分かりにくい。直す場所は書いている2本の生成器（毎日作り直すため）。
 * 切り方は scripts/lib/related_label.js の1本にまとめ、ここで、長い題が切れずに出ること・古い題の副題だけを
 * 落とすこと・2本の生成器が同じ決め方を通ることを確かめる。公開済みのページは読まない
 * （build.yml は npm test を再生成の前に回し、日次で増える記事を全部読むテストは build を止めうる）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { relatedLabel } = require(path.join(__dirname, '..', 'scripts', 'lib', 'related_label.js'));
const features = require(path.join(__dirname, '..', 'scripts', 'add_feature_journal_links.js'));
const { buildRelatedHtml } = require(path.join(__dirname, '..', 'scripts', 'refresh_journal_related.js'));

// 実在する記事の題（日次ジャーナル 2026-10）。どれも 38 字を超え、旧実装では 36 字＋「…」になっていた
const LONG_TITLES = [
  '栄三越9階に「宮きしめん伊兵衛 栄店」10月31日開店｜会席3,300円と味噌煮込1,800円を業界人が読む',
  '名駅の上海蟹、10月解禁——マリオット梨杏の美食会35,000円と伏見・王朝の中華コース16,000円、接待の相場を業界人が読む',
  '丸の内の予約が取れない鮨と日本料理、金曜19時が空かないのは席が埋まっているからではない',
];

test('relatedLabel: 38 字を超える題も切らずにそのまま出す（「…」を足さない）', () => {
  for (const t of LONG_TITLES) {
    assert.ok(t.length > 38, `前提: 旧実装なら切れる長さ（${t.length}字）`);
    const label = relatedLabel(t);
    assert.equal(label, t);
    assert.ok(!label.includes('…'), label);
  }
});

test('relatedLabel: 古い題「見出し — 副題」は副題を落として見出しだけを出す（従来どおり）', () => {
  assert.equal(relatedLabel('GW土曜の予約難民へ — 名古屋で『今からでも入れる』店の見分け方'), 'GW土曜の予約難民へ');
  // 副題を落とした見出しが長くても、文字数では切らない
  const head = '名古屋で「秋田」を貫く一軒を業界人目線で読み解く、栄の居酒屋を価格とオペから見る長い見出しの例です';
  assert.ok(head.length > 38);
  assert.equal(relatedLabel(`${head} — 副題`), head);
  // 区切りの「—」は前後に空白があるときだけ（題の中の「——」は切らない）
  assert.equal(relatedLabel('名駅の上海蟹、10月解禁——マリオット梨杏の美食会'), '名駅の上海蟹、10月解禁——マリオット梨杏の美食会');
});

test('relatedLabel: 空・未定義は空文字（落ちない）', () => {
  assert.equal(relatedLabel(''), '');
  assert.equal(relatedLabel(undefined), '');
  assert.equal(relatedLabel(null), '');
});

test('特集の生成器: チップの文字も計測の link_text も、長い題をそのまま出す', () => {
  const entries = LONG_TITLES.map((title, i) => ({ slug: `2026-10-0${i + 1}-x`, title, date: `2026-10-0${i + 1}` }));
  const block = features.buildBlockHtml(entries);
  for (const t of LONG_TITLES) {
    // チップの見える文字（HTML のエスケープ後）と、計測の link_text（' < > を除く）
    const visible = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    assert.ok(block.includes(`>${visible}</a>`), `チップに全文: ${t}`);
    assert.ok(block.includes(`link_text:'${t}'`), `link_text に全文: ${t}`);
  }
  assert.ok(!block.includes('…'), '特集のブロックに「…」が出ない');
});

test('特集の生成器: 同じ入力を2回流すと同じ（冪等）', () => {
  const entries = LONG_TITLES.map((title, i) => ({ slug: `2026-10-0${i + 1}-x`, title, date: `2026-10-0${i + 1}` }));
  const once = features.inject('<div class="related">\n  <p class="related-journal">x</p>\n</div>\n', features.buildBlockHtml(entries));
  const twice = features.inject(once, features.buildBlockHtml(entries));
  assert.equal(twice, once);
});

test('特集の生成器は、関連記事と同じ relatedLabel を通る（決め方が2か所に分かれない）', () => {
  assert.equal(features.shortLabel, relatedLabel);
});

test('日次ジャーナルの生成器: 関連記事の3本のチップが長い題をそのまま出し、「…」で終わらない', () => {
  const posts = ['2026-10-10-a.html', '2026-10-09-b.html', '2026-10-08-c.html', '2026-10-07-d.html'];
  const meta = {
    [posts[0]]: { title: '現在の記事のテスト題', topics: new Set() },
    [posts[1]]: { title: LONG_TITLES[0], topics: new Set() },
    [posts[2]]: { title: LONG_TITLES[1], topics: new Set() },
    [posts[3]]: { title: LONG_TITLES[2], topics: new Set() },
  };
  const html = buildRelatedHtml(posts[0], posts, meta);
  for (const [f, t] of [[posts[1], LONG_TITLES[0]], [posts[2], LONG_TITLES[1]], [posts[3], LONG_TITLES[2]]]) {
    assert.ok(html.includes(`<a class="related-link" href="${f}">${t}</a>`), `チップに全文: ${t}`);
  }
  assert.ok(!html.includes('…'), '関連記事のブロックに「…」が出ない');
});

test('日次ジャーナルの生成器: 古い題の副題は落とす（従来どおり）', () => {
  const posts = ['2026-10-10-a.html', '2026-10-09-b.html'];
  const meta = {
    [posts[0]]: { title: '現在の記事のテスト題', topics: new Set() },
    [posts[1]]: { title: '5/3憲法記念日の名古屋 — 「祝日も通常営業」を見抜く3シグナル', topics: new Set() },
  };
  const html = buildRelatedHtml(posts[0], posts, meta);
  assert.ok(html.includes('<a class="related-link" href="2026-10-09-b.html">5/3憲法記念日の名古屋</a>'), html);
});
