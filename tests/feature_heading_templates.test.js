'use strict';
// 特集の店カードを生成するスクリプトが、店名を h3 で出すことを固定する（SEO-060 の退行防止）。
// 2026-10-06、refresh_feature_rosters.js が <div class="shop-name"> を出していたため、
// ロスター再生成のたびに build.yml の見出し階層監査（migrate_feature_headings.js --check）が落ちた。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// 月次で既存ページの店カードを置き換える生成器だけを対象にする（置き換え先のページは SEO-060 で
// h3 用の CSS 調整が済んでいる）。gen_industry_features.js はページ全体を作り、見出しの変換と CSS 調整を
// migrate_feature_headings.js に任せているため対象外。
const GENERATORS = [
  'scripts/refresh_feature_rosters.js',
];

for (const rel of GENERATORS) {
  test(`${rel} は店名を div で出力しない`, () => {
    const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    assert.ok(!/<div class="(shop|store)-name">/.test(src), `${rel} に <div class="shop-name|store-name"> のテンプレートが残っている`);
  });
}
