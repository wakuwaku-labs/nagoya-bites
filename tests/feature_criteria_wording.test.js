'use strict';

/**
 * 特集の本文・メタ・FAQ に書かれた「選び方の数値」が、掲載店を入れ替える条件の
 * 実際の値と合っているかの検査（P-366）。
 *
 * 入れ替えの対象（data/feature_rosters.json の features）の特集:
 *   「Google評価N以上」の N は、その特集の scene.minGoogle、無ければ gates.minGoogle と同じ。
 *   「価格帯N円以上」の N は、その特集の scene.minPrice と同じ（無ければ書かない）。
 * 入れ替えの対象でない特集: 選び方としての「Google評価N以上」を書かない
 *   （読者への一般的な目安を書いたページだけ ALLOW に置く）。
 * 全特集: 確かめられない件数「editor_picks に登録された100店」を書かない。
 * 正本は data/feature_rosters.json。数値を変えるときはその JSON と本文を一緒に直す。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const rosters = require('../data/feature_rosters.json');
const faqs = require('../data/feature_faqs.json');
const FEATURES = path.join(ROOT, 'features');

// 選び方ではなく、読者への一般的な目安として評価の数字を書いているページ
const ALLOW = new Set(['index', 'nagoya-gourmet-guide']);

const RATING_RE = /Google\s*評価\s*(\d\.\d)\s*以上/g;
const PRICE_RE = /価格帯\s*([\d,]+)\s*円以上/g;

function numbers(text, re) {
  return [...text.matchAll(re)].map(m => m[1]);
}
function pages() {
  return fs.readdirSync(FEATURES).filter(f => f.endsWith('.html')).map(f => {
    const slug = f.slice(0, -5);
    let text = fs.readFileSync(path.join(FEATURES, f), 'utf8');
    // 画面の FAQ は data/feature_faqs.json と同じ文なので、JSON 側も同じ検査にかける
    const j = faqs[f];
    if (j) text += '\n' + j.map(x => x.q + ' ' + x.a).join('\n');
    return { slug, text };
  });
}

test('入れ替え対象の特集: 本文の「Google評価N以上」は scene.minGoogle（無ければ全体の下限）と同じ', () => {
  const bad = [];
  for (const { slug, text } of pages()) {
    const cfg = rosters.features[slug];
    if (!cfg) continue;
    const expect = String(Number((cfg.scene && cfg.scene.minGoogle) || rosters.gates.minGoogle).toFixed(1));
    for (const n of numbers(text, RATING_RE)) {
      if (n !== expect) bad.push(`${slug}: 本文 ${n} / 条件 ${expect}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('入れ替え対象の特集: 本文の「価格帯N円以上」は scene.minPrice と同じ', () => {
  const bad = [];
  for (const { slug, text } of pages()) {
    const cfg = rosters.features[slug];
    if (!cfg) continue;
    const min = cfg.scene && cfg.scene.minPrice;
    for (const n of numbers(text, PRICE_RE)) {
      if (!min || Number(n.replace(/,/g, '')) !== min) bad.push(`${slug}: 本文 ${n}円 / 条件 ${min || 'なし'}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('入れ替え対象でない特集: 選び方としての「Google評価N以上」を書かない', () => {
  const bad = [];
  for (const { slug, text } of pages()) {
    if (rosters.features[slug] || ALLOW.has(slug)) continue;
    const ns = numbers(text, RATING_RE);
    if (ns.length) bad.push(`${slug}: ${ns.join(',')}`);
  }
  assert.deepEqual(bad, []);
});

test('全特集: 確かめられない件数「editor_picks に登録された◯店」を書かない', () => {
  const bad = [];
  for (const { slug, text } of pages()) {
    if (/editor_picks\s*に登録された\s*\d+\s*店/.test(text)) bad.push(slug);
  }
  assert.deepEqual(bad, []);
});
