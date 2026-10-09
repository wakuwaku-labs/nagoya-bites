'use strict';
// SEO-118: 計測が変わった日をまたぐ比較に注意を出す（scripts/track_metrics.js measurementChangesBetween）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { measurementChangesBetween } = require('../scripts/track_metrics.js');

function book(changes) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-')), 'changes.json');
  fs.writeFileSync(p, JSON.stringify({ changes }));
  return p;
}
const ga4 = { date: '2026-10-09', id: 'SEO-115', affects: ['ga4'], summary: 'x' };

test('変更日が後の日以前で、前の日の30日窓の始まりより後なら注意を出す', () => {
  const p = book([ga4]);
  assert.strictEqual(measurementChangesBetween('2026-10-02', '2026-10-09', { changesPath: p }).length, 1);
  // 前の日が変更日の後でも、前の日の30日窓に変更前の計測が混ざる
  assert.strictEqual(measurementChangesBetween('2026-10-20', '2026-10-27', { changesPath: p }).length, 1);
});

test('両方の窓が変更の後に収まれば注意を出さない', () => {
  const p = book([ga4]);
  assert.deepStrictEqual(measurementChangesBetween('2026-11-08', '2026-11-15', { changesPath: p }), []);
});

test('両方の日が変更の前なら注意を出さない', () => {
  const p = book([ga4]);
  assert.deepStrictEqual(measurementChangesBetween('2026-09-01', '2026-10-08', { changesPath: p }), []);
});

test('GA4 だけの変更は GSC の比較に注意を出さない', () => {
  const p = book([ga4]);
  assert.deepStrictEqual(measurementChangesBetween('2026-10-02', '2026-10-09', { changesPath: p, source: 'gsc' }), []);
});

test('台帳が無い・壊れている・日付が欠けているときは空配列', () => {
  assert.deepStrictEqual(measurementChangesBetween('2026-10-02', '2026-10-09', { changesPath: '/nonexistent/x.json' }), []);
  const bad = book([]); fs.writeFileSync(bad, '{');
  assert.deepStrictEqual(measurementChangesBetween('2026-10-02', '2026-10-09', { changesPath: bad }), []);
  assert.deepStrictEqual(measurementChangesBetween(null, '2026-10-09', { changesPath: book([ga4]) }), []);
});

test('本番の台帳に SEO-115 の計測変更（2026-10-09・ga4）が載っている', () => {
  const b = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/measurement_changes.json'), 'utf8'));
  const c = b.changes.find((x) => x.id === 'SEO-115');
  assert.ok(c && c.date === '2026-10-09' && c.affects.includes('ga4'));
});
