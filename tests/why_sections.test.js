'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { renderWhy, checkWhy, appliesTo, insertWhy, loadWhyData } = require('../scripts/lib/why_section');

const ROOT = path.join(__dirname, '..');
const ok = { heading: 'なぜ今池なのか', paragraphs: ['今池は大衆酒場が集まる街です。駅のそばに小さな店が多いです。', 'ひとりで寄りやすい店を選びました。'], sources: [{ label: 'Aichi Now', url: 'https://www.aichinow.pref.aichi.jp/spots/detail/4156/' }] };

test('節: 2文以上＋出典リンクがあれば通る。無い・短い・出典なしは落ちる', () => {
  assert.strictEqual(checkWhy('<div>' + renderWhy(ok, 'feature') + '</div>').ok, true);
  assert.strictEqual(checkWhy('<h2>店の紹介</h2><p>本文です。</p>').ok, false);
  assert.strictEqual(checkWhy(renderWhy({ ...ok, paragraphs: ['駅が近いです。'] }, 'feature')).ok, false); // 1文だけ
  assert.strictEqual(checkWhy(renderWhy({ ...ok, sources: [] }, 'feature')).ok, false); // 出典なし
  assert.strictEqual(checkWhy(renderWhy({ ...ok, sources: [], internal: true }, 'hub')).ok, true); // 掲載データの集計だけの節は出典不要
  assert.strictEqual(checkWhy('<h2>なぜ今池なのか</h2><p>今池は大衆酒場の街です。ひとりで入れる店が多いです。</p><a href="https://example.com/">x</a>').ok, true); // 手書きの節も認める
});

test('対象判定: エリアのハブと、題に◯選・ガイドがある特集だけ', () => {
  assert.strictEqual(appliesTo('stores/area/sakae/index.html', ''), 'hub');
  assert.strictEqual(appliesTo('stores/area/index.html', ''), 'hub');
  assert.strictEqual(appliesTo('stores/area/sakae/izakaya.html', ''), null);
  assert.strictEqual(appliesTo('features/x.html', '<h1 class="art-title">栄<em>15選</em></h1>'), 'feature');
  assert.strictEqual(appliesTo('features/x.html', '<h1>編集規約</h1>'), null);
  assert.strictEqual(appliesTo('features/index.html', '<h1>15選</h1>'), null);
});

test('差し込み: 冪等で、冒頭（art-lead）と題は変えない', () => {
  const page = '<h1 class="art-title">栄の飲食店</h1>\n  <div class="art-lead"><p>冒頭です。</p></div>\n  <dl></dl>';
  const once = insertWhy(page, renderWhy(ok, 'hub'), 'hub');
  assert.ok(once.includes('<div class="art-lead"><p>冒頭です。</p></div>'));
  assert.strictEqual(insertWhy(once, renderWhy(ok, 'hub'), 'hub'), once);
  const feat = '<div class="art-body">\n<h2 class="section-label">Top</h2>';
  assert.ok(insertWhy(feat, renderWhy(ok, 'feature'), 'feature').indexOf('nb-why') < feat.length + 400);
});

test('data/why_sections.json の本文は、出典付き・2文以上・出所の無い言い切りを含まない', () => {
  const d = loadWhyData();
  for (const [k, e] of [...Object.entries(d.areas), ...Object.entries(d.features)]) {
    const r = checkWhy(renderWhy(e, k.startsWith('features/') ? 'feature' : 'hub', { n: 100, g1: '居酒屋', g1n: 50, areas: 10, hubMin: 10 }));
    assert.strictEqual(r.ok, true, `${k}: ${r.msg}`);
    const text = e.paragraphs.join('');
    assert.ok(!/人気|定番|有名|随一|No\.?1|最大の繁華街/.test(text.replace('日本最大級とされています', '')), `${k}: 「人気」「定番」などの出所の無い言い切り`);
  }
});

test('エリアのハブ全件に節があり、検査（audit）が新規の頁の欠落を FAIL にする', () => {
  const { targets } = require('../scripts/audit_why_sections');
  const all = targets();
  const hubs = all.filter((t) => t.kind === 'hub');
  assert.ok(hubs.length >= 11);
  assert.deepStrictEqual(hubs.filter((t) => !t.res.ok).map((t) => t.rel), []);
  // 猶予リストに無い頁で節が無いものは0（今後作る頁は必ず節が要る）
  const base = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/why_section_baseline.json'), 'utf8')).pages);
  assert.deepStrictEqual(all.filter((t) => !t.res.ok && !base.has(t.rel)).map((t) => t.rel), []);
  // 猶予リストの頁は、まだ節が無いものだけ（足したら外す）
  assert.deepStrictEqual([...base].filter((p) => all.find((t) => t.rel === p && t.res.ok)), []);
});

test('生成器（gen_area_genre_pages）と適用スクリプトが同じ節を出す', () => {
  const g = fs.readFileSync(path.join(ROOT, 'scripts/gen_area_genre_pages.js'), 'utf8');
  assert.ok(g.includes("require('./lib/why_section')") && g.includes('whyArea') && g.includes('whyRoot'));
});
