'use strict';
// 基本方針 段階1（S1-1・S1-4）: 読者を誤解させうる表示の再発検査と、閉業・休業の注記（ADR 0069）
const test = require('node:test');
const assert = require('node:assert');
const { auditHtml, makeContext } = require('../scripts/audit_feature_facts');
const { syncNotes } = require('../scripts/sync_feature_closure_notes');
const { buildNoticeIndex, noticeFor } = require('../scripts/lib/operating_notice');
const { effectiveVisitStatus, visitStatusLabel } = require('../scripts/lib/editor_reason');
const { scanFeatureStars } = require('../scripts/lib/feature_stars');

const ctx = makeContext();

test('特集の現在の中身は、誤解を招く表示が0件', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'features');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    n += auditHtml(fs.readFileSync(path.join(dir, f), 'utf8'), ctx).length;
  }
  assert.strictEqual(n, 0);
});

test('掲載歴・訪問済バッジ・食べログ点数・内部の項目名を検出する', () => {
  const html = '<p class="media-features">掲載歴: 〇〇賞（2024）</p><span class="store-badge">編集部訪問済</span>食べログ4.8を維持。editorReason を見る。食べログ4.5超えは引用';
  const kinds = auditHtml(html, ctx).map((x) => x.kind);
  for (const k of ['掲載歴', '訪問済', '食べログ点', '内部の項目名']) assert.ok(kinds.includes(k), k);
  assert.strictEqual(kinds.filter((k) => k === '食べログ点').length, 1); // 「4.5超え」は除く
});

test('本文の★がデータと違う・データに無いときに検出し、合っているときは検出しない', () => {
  const s = [...ctx.byName.values()].find((x) => parseFloat(x['Google評価']) > 0 && String(x['店名']).length >= 6);
  const none = [...ctx.byName.values()].find((x) => !x['Google評価'] && String(x['店名']).length >= 6 && ![...ctx.byName.keys()].some((o) => o !== x['店名'] && o.includes(x['店名'])));
  const r = parseFloat(s['Google評価']);
  const wrong = r >= 4.5 ? r - 0.5 : r + 0.4;
  const v = (html) => scanFeatureStars(html, ctx.byName).map((x) => x.verdict);
  assert.deepStrictEqual(v(`<h3>${s['店名']}</h3><span class="tag">★ ${r.toFixed(1)}</span>`), ['ok']);
  assert.deepStrictEqual(v(`<h3>${s['店名']}</h3><span class="tag">★ ${wrong.toFixed(1)}</span>`), ['mismatch']);
  assert.deepStrictEqual(v(`<h3>${none['店名']}</h3><span class="tag">★ 4.5</span>`), ['nodata']);
});

test('「訪問済」「店主取材済」は訪問・取材の日付の記録がある店だけ。無ければ公開情報ベース', () => {
  assert.strictEqual(effectiveVisitStatus({ visitStatus: 'visited' }), 'desk');
  assert.strictEqual(visitStatusLabel({ visitStatus: 'visited' }), '公開情報ベース');
  assert.strictEqual(visitStatusLabel({ visitStatus: 'interview' }), '公開情報ベース');
  assert.strictEqual(visitStatusLabel({ visitStatus: 'visited', visitedOn: '2026-10-01' }), '訪問済');
  assert.strictEqual(visitStatusLabel({ visitStatus: 'industry_known' }), '業界内で評判');
});

test('閉業・一時休業の注記は、人が営業中と確かめた店には出さず、事実の言い方で書く', () => {
  const stores = [{ 店名: 'テスト店', エリア: '栄', ホットペッパーID: 'J000000001' }];
  const status = { entries: { J000000001: { status: 'CLOSED_PERMANENTLY', usable: true, checkedAt: '2026-10-19T06:00:00.000Z' } } };
  const idx = buildNoticeIndex(stores, status, []);
  const n = noticeFor(stores[0], idx);
  assert.strictEqual(n.kind, 'permanent');
  assert.match(n.text, /Google では「閉業」と表示されています（2026年10月19日確認）/);
  assert.ok(!/閉店しました|営業していません/.test(n.text), '断定しない');
  const reviewed = buildNoticeIndex(stores, status, [{ id: 'J000000001', verdict: '営業中' }]);
  assert.strictEqual(noticeFor(stores[0], reviewed), null);
  const unusable = buildNoticeIndex(stores, { entries: { J000000001: { status: 'CLOSED_PERMANENTLY', usable: false, checkedAt: '2026-10-19T06:00:00.000Z' } } }, []);
  assert.strictEqual(noticeFor(stores[0], unusable), null);
});

test('特集の店カードへの注記は冪等で、状態が戻れば消える', () => {
  const card = '<div class="store-card">\n  <div class="store-info">\n    <h3 class="store-name">テスト店</h3>\n    <a href="../stores/J000000001.html">詳細</a>\n  </div>\n</div>\n';
  const notices = new Map([['J000000001', { kind: 'temporary', text: 'Google では「一時休業」と表示されています。' }]]);
  const a = syncNotes(card, notices, new Set(['J000000001']));
  assert.deepStrictEqual(a.added, ['J000000001']);
  assert.ok(a.html.includes('nb-note closure-note'));
  const b = syncNotes(a.html, notices, new Set(['J000000001']));
  assert.strictEqual(b.html, a.html);
  const c = syncNotes(a.html, new Map(), new Set(['J000000001']));
  assert.strictEqual(c.html, card);
  // 掲載データに無い ID は「閉業」とは書かず、いまの掲載データに無いと出す
  const d = syncNotes(card, new Map(), new Set());
  assert.match(d.html, /いまの掲載データに無い店です/);
});
