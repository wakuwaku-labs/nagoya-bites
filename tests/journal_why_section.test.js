'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkWhySection } = require('../scripts/validate_journal_draft');

const page = (title, body) => `<h1 class="art-title">${title}</h1><div class="art-body">${body}<div class="store-list"></div>`;
const store = '<h2>青二才（今池駅から徒歩1分）</h2><p>やきとんの店です。（<a href="../stores/J004537019.html">店舗ページ</a>）</p>';
const why = '<h2>なぜ今池なのか</h2><p>今池は大衆酒場が集まる街です。駅のそばに小さな店が多く、ひとりで寄りやすいからです。</p>';

test('項目20: 「◯選」の記事は、店の紹介の前に「なぜ◯◯なのか」の節（2文以上）が要る（2026-11-23 本人の指摘）', () => {
  assert.strictEqual(checkWhySection(page('今池で一人飲みできる居酒屋おすすめ5選', why + store)).ok, true);
  assert.strictEqual(checkWhySection(page('今池で一人飲みできる居酒屋おすすめ5選', store)).ok, false);
  assert.strictEqual(checkWhySection(page('今池で一人飲みできる居酒屋おすすめ5選', store + why)).ok, false); // 店の後ろでは遅い
  assert.strictEqual(checkWhySection(page('名駅で鍋のおすすめ5選', '<h2>なぜ名駅なのか</h2><p>駅が近いです。</p>' + store)).ok, false); // 1文だけ
  // 「◯選」でない記事は対象外
  assert.strictEqual(checkWhySection(page('栄の焼鳥ごりょうでデート', store)).ok, true);
});

test('項目20: 公開中の今池の記事（2026-11-23）は通る', () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '../journal/2026-11-23-imaike-solo-izakaya-5.html'), 'utf8');
  assert.strictEqual(checkWhySection(html).ok, true);
});
