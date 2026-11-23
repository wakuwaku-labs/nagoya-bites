'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { restyle } = require('../scripts/restyle_point_boxes');
const ES = require('../scripts/lib/editorial_standard');

const OLD_CONC = '<div class="insider-box nb-jbox nb-jconclusion"><p class="insider-title">先に結論</p><ul><li>向く人: ひとり飲み &amp; 早帰り</li><li>向かない人: 煙が苦手な人</li><li>来店前にいちばん確かめたい点: 喫煙の扱い。分からなかった点は4点で、項目ごとに下の一覧に書いています。</li></ul></div>';
const ROW_OK = '<li><span class="nb-check-name">喫煙</span>: 全席禁煙（ホットペッパー・11月23日確認）</li>';
const ROW_NG = '<li><span class="nb-check-name">お通し・席料</span> <span class="nb-check-state">確認できなかった</span>: 記載なし。予約時に店へ確認を</li>';
const box = (rows) => `<details class="nb-jbox nb-check" open><summary>来店前に確かめたいこと</summary><ul>${rows.join('')}</ul></details>`;

test('公開済みの記事: 先に結論 → ここがポイント（生成と同じ形）。未確認の数の文は外す', () => {
  const out = restyle(`<p>a</p>${OLD_CONC}<p>b</p>`);
  assert.strictEqual(out, `<p>a</p>${ES.pointBoxHtml({ fit: 'ひとり飲み & 早帰り', not: '煙が苦手な人', check: '喫煙の扱い。' })}<p>b</p>`);
  assert.ok(out.includes('ひとり飲み &amp; 早帰り'));
  assert.ok(!out.includes('分からなかった点'));
  assert.strictEqual(restyle(out), out); // 冪等
});

test('公開済みの記事: 確認できなかった行を外し、残らなければ欄ごと外す', () => {
  assert.strictEqual(restyle(box([ROW_NG, ROW_OK])), box([ROW_OK]));
  assert.strictEqual(restyle(`<p>x</p>${box([ROW_NG])}`), '<p>x</p>');
  assert.strictEqual(restyle(box([ROW_OK])), box([ROW_OK]));
});

test('公開済みの記事: 知らない行がある箱は触らない（取り違えて消さない）', () => {
  const odd = OLD_CONC.replace('<li>向かない人: 煙が苦手な人</li>', '<li>別の行</li>');
  assert.strictEqual(restyle(odd), odd);
});
