'use strict';
// 検索流入の上位2本の題の変更（ADR 0069 決定4・ADR 0070）: 記録と、今のページと、戻す道具が合っている
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TOP_TITLES } = require('../scripts/lib/selection_wording_rules');
const { apply } = require('../scripts/rewrite_selection_wording');

const ROOT = path.resolve(__dirname, '..');
const LEDGER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/top_title_changes.json'), 'utf8'));

test('記録: 規則の2本と同じで、applied なら今のページが新しい題・reverted なら元の題', () => {
  assert.deepEqual(LEDGER.changes.map((c) => c.id).sort(), TOP_TITLES.map((p) => p.id).sort());
  for (const c of LEDGER.changes) {
    const rule = TOP_TITLES.find((p) => p.id === c.id);
    assert.equal(c.old, rule.old);
    assert.equal(c.neu, rule.neu);
    const html = fs.readFileSync(path.join(ROOT, c.path), 'utf8');
    assert.ok(['applied', 'reverted'].includes(c.status));
    if (c.status === 'applied') { assert.ok(html.includes(c.neu), c.path); assert.ok(!html.includes(c.old), c.path); }
    else assert.ok(html.includes(c.old), c.path);
    assert.ok(c.baseline.clicks > 0 && c.stop.clicksAtOrBelow === Math.floor(c.baseline.clicks / 2), `${c.id}: 半減の条件`);
  }
});

test('一括の書き換えは上位2本の題に触れない（1本ずつ変える決まり）', () => {
  for (const p of TOP_TITLES) assert.equal(apply(`｜${p.old}｜`), `｜${p.old}｜`);
});
