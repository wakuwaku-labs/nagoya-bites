'use strict';
// 基本方針の段階2（Ondine #2049）: 出典の台帳と確認日（S2-1）・料金備考などの保存と表示（S2-2）・星の件数と時点（S2-3）
const test = require('node:test');
const assert = require('node:assert');
const G = require('../scripts/generate_daily_draft');
const C = require('../scripts/lib/store_conditions');

test('S2-1: 出典に確認日が必ず付き、台帳の形と表示が一致する', () => {
  const src = [{ label: 'A', url: 'https://www.example.com/x', date: '2026-11-10' }, { label: 'B', url: 'https://b.example/y', checked: '2026-11-15' }];
  const led = src.map(s => G.normalizeSource(s, '2026-11-16'));
  assert.ok(led.every(l => /^\d{4}-\d{2}-\d{2}$/.test(l.checked)), '確認日100%');
  assert.strictEqual(led[0].checked, '2026-11-16');
  assert.strictEqual(led[0].checked_by, 'writer_declared');
  assert.strictEqual(led[0].publisher, 'example.com');
  const html = G.buildSources(src, '2026-11-16');
  assert.match(html, /（11月16日確認）/);
  assert.match(html, /（11月15日確認）/);
  assert.match(html, /（2026-11-10掲載）/);
  assert.strictEqual(G.buildSources([], '2026-11-16'), '');
});

test('S2-1: 形式の違う確認日は申告として採らず記事の日付にする', () => {
  assert.strictEqual(G.normalizeSource({ label: 'x', url: 'https://a.b/', checked: '昨日' }, '2026-11-16').checked, '2026-11-16');
  assert.strictEqual(G.toMonthDayJa('昨日'), '');
});

test('S2-2: 料金備考などを原文のまま保存し、否定・長すぎる文は保存しない', () => {
  const c = C.conditionsFromShop({ budget_memo: 'お通し代300円', shop_detail_memo: ' 席料  500円 ', other_memo: 'なし', charter: '貸切可', child: 'お子様連れNG', midnight: '営業している' });
  assert.deepStrictEqual(c, { 料金備考: 'お通し代300円', 店舗備考: '席料 500円', 貸切: '貸切可', 深夜営業: '営業している' });
  assert.deepStrictEqual(C.conditionsFromShop({ budget_memo: 'あ'.repeat(C.MAX_LEN + 1) }), {});
});

test('S2-2: 既存の店へ足し、取れなかった店の元の値は残し、取れた店は取り直す', () => {
  const stores = [{ 店名: 'a', ホットペッパーID: 'J1', 料金備考: '古い' }, { 店名: 'b', ホットペッパーID: 'J2', 料金備考: '残す' }, { 店名: 'c', ホットペッパーID: 'J3' }];
  const r = C.enrichConditions(stores, [{ id: 'J1' }, { id: 'J3', budget_memo: 'サービス料10%' }], '2026-11-16');
  assert.strictEqual(stores[0]['料金備考'], undefined, '店が消した条件を残さない');
  assert.strictEqual(stores[1]['料金備考'], '残す');
  assert.strictEqual(stores[2]['料金備考'], 'サービス料10%');
  assert.strictEqual(stores[2]['条件取得日'], '2026-11-16');
  assert.deepStrictEqual([r.matched, r.withAny], [2, 1]);
});

test('S2-2: 表示は原文・取得日つきで、欄が無い店は何も出さない', () => {
  const s = { 料金備考: 'お通し代300円', 条件取得日: '2026-11-16' };
  assert.deepStrictEqual(C.conditionRows(s), [{ label: '料金の備考', value: 'お通し代300円' }]);
  assert.strictEqual(C.acquiredText(s), '2026年11月16日取得');
  assert.deepStrictEqual(C.conditionRows({}), []);
  assert.strictEqual(C.acquiredText({}), '');
});

const R = require('../scripts/lib/rating_display');
const F = require('../scripts/sync_feature_scores');
const { buildStoreGlance } = require('../gen-store-pages');
const fs = require('fs');
const path = require('path');

test('S2-3: 星は「評価・件数・時点」の形。30件未満は件数が少ないと添え、件数か時点が無ければ出さない', () => {
  assert.strictEqual(R.formatRating({ rating: '4.5', count: '652', date: '2026-11-03' }), 'Google★4.5（652件・2026年11月時点）');
  assert.strictEqual(R.formatRating({ rating: '4.9', count: '12', date: '2026-08-20' }), 'Google★4.9（12件・2026年8月時点・件数が少ない）');
  assert.strictEqual(R.formatRating({ rating: '4.9', count: '', date: '2026-08-20' }), '');
  assert.strictEqual(R.formatRating({ rating: '4.9', count: '40', date: '' }), '');
  assert.ok(R.isBareStar('★ 4.8') && !R.isBareStar('Google★4.8（40件・2026年8月時点）'));
});

test('S2-3: 特集の店カードの星を統一形へ。件数が無い店・出どころの無い星は外し、2回かけても変わらない', () => {
  const card = (id, star) => `<div class="store-card"><h3><a href="https://nagoya-bites.com/stores/${id}.html">x</a></h3><div class="store-meta"><span>栄</span><span class="score">${star}</span></div></div>`;
  const by = F.storeIndex([
    { ホットペッパーID: 'J1', Google評価: '4.8', 口コミ数: '36', reviewTrust: { d: '2026-08-20' } },
    { ホットペッパーID: 'J2', Google評価: '4.8', reviewTrust: { d: '2026-08-20' } },
  ]);
  const r = F.unifyScores(card('J1', '★ 4.8') + card('J2', '★ 4.8') + card('J9', '★ 4.0'), by);
  assert.match(r.html, /Google★4\.8（36件・2026年8月時点）/);
  assert.strictEqual(F.bareScores(r.html).length, 0);
  assert.strictEqual(r.dropped.length, 2);
  const again = F.unifyScores(r.html, by);
  assert.strictEqual(again.html, r.html);
  assert.strictEqual(again.unified, 0);
});

test('S2-3: 店舗ページの★の脇に時点と「件数が少ない」が付く', () => {
  assert.strictEqual(buildStoreGlance({ 'Google評価': '4.3', '口コミ数': '39', reviewTrust: { d: '2026-08-20' } }).note, '（Google・39件・2026年8月時点）');
  assert.strictEqual(buildStoreGlance({ 'Google評価': '4.3', '口コミ数': '12', reviewTrust: { d: '2026-08-20' } }).note, '（Google・12件・2026年8月時点・件数が少ない）');
});

test('S2-3: 特集に件数・時点の無い星が残っていない（検査で固定）', () => {
  const dir = path.join(__dirname, '..', 'features');
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
    const n = F.bareScores(fs.readFileSync(path.join(dir, f), 'utf8')).length;
    if (n) bad.push(`${f}:${n}`);
  }
  assert.deepStrictEqual(bad, []);
});
