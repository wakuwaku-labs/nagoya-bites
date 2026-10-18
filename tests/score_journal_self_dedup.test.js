'use strict';
/**
 * 登録済みの当日記事と重複判定しない（P-567）。
 * 2026-10-18、登録後に採点し直したら今日の記事自身と「タイトル類似 sim=1.00」で失格になった。
 * 同種の自己参照は 2026-07-24 の validator 項目9 でも起きている。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreOne } = require('../scripts/score_journal_candidates');

const TODAY = '2026-10-18';
const policy = { auto_publish_min: 95, review_publish_min: 85 };
const cand = {
  id: 'c1', theme: 'today_one',
  title_draft: '名駅の新店ラーメンを価格帯と席の構成から読む',
  lead_draft: '名駅に開いた新店の席の構成と価格帯、予約の取り方を整理します。',
  angle: '価格帯と席の構成を読む',
  main_store: { id: 'S-NEW', name: '麺屋あたらし' },
  sources: [{ label: '公式プレスリリース', url: 'https://prtimes.jp/main/html/rd/p/x.html', date: '2026-10-17' }],
};
const todayEntry = {
  date: TODAY, title: cand.title_draft, description: cand.lead_draft,
  store_ids: ['S-NEW'], pending_store_keys: ['麺屋あたらし'], theme: 'today_one',
};
const pastEntry = Object.assign({}, todayEntry, { date: '2026-10-10' });

test('今日の日付で登録済みでも、登録前と同じ点数・判定になる', () => {
  const before = scoreOne(cand, { entries: [] }, TODAY, policy);
  const after = scoreOne(cand, { entries: [todayEntry] }, TODAY, policy);
  assert.notEqual(after.verdict, 'DISQUALIFIED');
  assert.equal(after.total, before.total);
  assert.equal(after.verdict, before.verdict);
});

test('過去の日付の同じ記事との重複は、今までどおり失格にする', () => {
  const r = scoreOne(cand, { entries: [pastEntry] }, TODAY, policy);
  assert.equal(r.verdict, 'DISQUALIFIED');
  assert.ok(r.disqualified_reasons.some(x => x.includes('タイトル類似')));
  assert.ok(r.disqualified_reasons.some(x => x.includes('同一店舗の再掲')));
});

test('今日の登録があっても、過去の重複は見逃さない', () => {
  const r = scoreOne(cand, { entries: [todayEntry, pastEntry] }, TODAY, policy);
  assert.equal(r.verdict, 'DISQUALIFIED');
});
