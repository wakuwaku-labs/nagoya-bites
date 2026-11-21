'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { voice, measureReadability, readabilityWarnings } = require('../scripts/lib/editorial_standard');

test('voice: 決まり5つ・言い換え表・閾値がある', () => {
  const v = voice();
  assert.strictEqual(v.rules.length, 5);
  assert.ok(v.jargon.some((j) => j.word === 'お通し' && j.plain));
  assert.ok(v.readability.avgSentenceChars > 0 && v.readability.moneyPer1000Chars > 0);
});

test('measureReadability: 文の長さ・料金の数字・業界語を数える', () => {
  const r = measureReadability('お通し代は300円です。サービス料は10%かかります。\n窯焼きのピザが名物です。');
  assert.strictEqual(r.sentences, 3);
  assert.strictEqual(r.moneyCount, 2);
  assert.deepStrictEqual(r.jargonHits.map((j) => j.word).sort(), ['お通し', 'サービス料']);
});

test('readabilityWarnings: 親しみやすい文は警告なし・料金だらけは警告', () => {
  assert.strictEqual(readabilityWarnings('窯で焼くピザが名物の小さな店です。カウンターがあり、ひとりでも入りやすい雰囲気です。').warnings.length, 0);
  assert.ok(readabilityWarnings('前日は50%。当日は100%。深夜は10%。ランチは900円。夜は3000円。').warnings.length > 0);
});

test('measureReadability: 言い換えの後に括弧で添えた業界語は数えない（2026-11-21 の誤検知）', () => {
  const r = measureReadability('16時からは、席に座るだけでかかるお金（席料）が1人ずつかかります。席に着くと出る小鉢(お通し)があります。');
  assert.deepStrictEqual(r.jargonHits, []);
  assert.deepStrictEqual(measureReadability('席料は500円です。').jargonHits.map((j) => j.word), ['席料']);
});
