'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { topicKeys, relatedEntries } = require('../scripts/seo_triage');

test('topicKeys: 括弧KW・特集slug・日付slugを抜き、slugは kw と page で二重化しない', () => {
  const k = topicKeys('人気ページ「nagoya-solo-dining」と features/date.html、「名古屋駅  一人飲み」を強化');
  assert.deepStrictEqual(k.sort(), ['kw:名古屋駅 一人飲み', 'page:date', 'page:nagoya-solo-dining'].sort());
});

test('topicKeys: 論点キーが無い汎用文は空', () => {
  assert.deepStrictEqual(topicKeys('写真と紹介文を魅力的に更新しましょう'), []);
  assert.deepStrictEqual(topicKeys(''), []);
});

test('relatedEntries: 言い換えでも同じKWの過去判定を新しい順に返す', () => {
  const entries = [
    { date: '2026-09-28', verdict: 'adopted', id: 'SEO-087', advice: '「名古屋駅 一人飲み」で features/nagoya-solo-dining を強化' },
    { date: '2026-10-05', verdict: 'duplicate', advice: 'タイトルに名古屋駅を足し「名古屋駅 一人飲み」を狙う' },
    { date: '2026-10-01', verdict: 'rejected', advice: '「名古屋 デート ディナー」の特集を新規作成' },
  ];
  const r = relatedEntries('index.htmlのフィルタに「名古屋駅 一人飲み」タグを追加', entries);
  assert.strictEqual(r.related_total, 2);
  assert.deepStrictEqual(r.related.map((x) => x.date), ['2026-10-05', '2026-09-28']);
  assert.deepStrictEqual(r.related[0].shared_keys, ['kw:名古屋駅 一人飲み']);
});

test('relatedEntries: キーが多く一致した方を先に出す', () => {
  const entries = [
    { date: '2026-10-06', verdict: 'rejected', advice: '「名古屋駅 一人飲み」' },
    { date: '2026-09-01', verdict: 'adopted', advice: '「名古屋駅 一人飲み」を features/nagoya-solo-dining に' },
  ];
  const r = relatedEntries('「名古屋駅 一人飲み」を nagoya-solo-dining 冒頭へ', entries);
  assert.strictEqual(r.related[0].date, '2026-09-01');
});
