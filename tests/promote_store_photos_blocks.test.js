'use strict';
// 店の写真の昇格（scripts/promote_store_photos.js）が、記事の写真を出す区画（トップの大きな写真・新しい記事・ジャーナル欄）を
// 書き換えないこと。2026-11-20 に一括置換でトップの大きな写真の src が _480 でなくなり、srcset が同じ URL の 480w/1280w になっていた。
const test = require('node:test');
const assert = require('node:assert');
const P = require('../scripts/promote_store_photos.js');

const O = 'https://imgfp.hotp.jp/IMGH/98/87/P047359887/P047359887_480.jpg';
const N = 'https://imgfp.hotp.jp/IMGH/98/87/P047359887/P047359887.jpg';

test('店のデータの URL は昇格し、記事の写真の区画の中は元のまま', () => {
  const html = [
    `var LOCAL_STORES = [{"写真URL":"${O}"}];`,
    `<!-- TOP_HERO_START --><img class="top-hero-img" src="${O}" srcset="${O} 480w, ${N} 1280w"><!-- TOP_HERO_END -->`,
    `<!-- TOP_ARTICLES_START --><img src="${O}"><!-- TOP_ARTICLES_END -->`,
    `<!-- TREND_PICKS_START --><img src="${O}"><!-- TREND_PICKS_END -->`,
    `<!-- LATEST_JOURNAL_START --><img src="${O}"><!-- LATEST_JOURNAL_END -->`,
  ].join('\n');
  const { html: out, hits } = P.replaceInIndexHtml(html, new Map([[O, N]]));
  assert.strictEqual(hits, 1);
  assert.ok(out.includes(`var LOCAL_STORES = [{"写真URL":"${N}"}];`));
  assert.ok(out.includes(`<!-- TREND_PICKS_START --><img src="${N}">`), '店の写真の区画は昇格する');
  for (const b of P.PROTECTED_BLOCKS) {
    const inner = (out.match(new RegExp(`<!-- ${b}_START -->([\\s\\S]*?)<!-- ${b}_END -->`)) || [])[1];
    assert.ok(inner && inner.includes(O), `${b} は元の _480 のまま`);
  }
  assert.ok(out.includes(`srcset="${O} 480w, ${N} 1280w"`), '大きな写真の srcset が壊れない');
});

test('区画が無い・置き換えが無いときは何も変えない', () => {
  assert.deepStrictEqual(P.replaceInIndexHtml('abc', new Map([[O, N]])), { html: 'abc', hits: 0 });
});
