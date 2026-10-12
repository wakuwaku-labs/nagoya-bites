'use strict';

/**
 * tests/feature_journal_links_style.test.js — 特集の「この特集の店の最新ジャーナル記事」ラベルの大きさ（I-26b・U-47）
 *
 * 事故: scripts/add_feature_journal_links.js が、ラベルを style="…font-size:.7rem…"（11.2px）で書いていた。
 * デザインの監査（audit_design_system.js）は <style> の中の font-size しか見ないため、12px の床
 * （CLAUDE.md 制約12）を割ったまま特集 49 ページに出ていた。しかも生成器は毎日このブロックを作り直すので、
 * ページだけを直しても翌朝に戻る。直す場所は生成器。ここでは、生成器が書くラベルが床を割らず、
 * 直書きの色や大きさを持たず、既存のブロックを同じ形に置き換える（冪等）ことを確かめる。
 * 公開済みのページは読まない（build.yml は npm test を再生成の前に回す）。実物の検査は夜間QAの
 * inline-style-font-size（audit_design_system.js --inline-style）が受け持つ。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const gen = require(path.join(__dirname, '..', 'scripts', 'add_feature_journal_links.js'));

const ENTRIES = [
  { slug: '2026-10-06-sakae-hilton-buffet', title: '栄のホテルビュッフェで女子会｜秋の平日昼 — 副題', date: '2026-10-06' },
  { slug: '2026-10-03-fushimi-afternoon-tea', title: '錦・伏見のホテルカフェ', date: '2026-10-03' },
];
const LABEL_RE = /<p class="related-journal-title related-journal-articles" style="([^"]*)">/;

test('require してもスクリプトは走らない（出力もしないし、テストが特集を書き換えない）', () => {
  assert.equal(typeof gen.buildBlockHtml, 'function');
  assert.equal(typeof gen.inject, 'function');
  assert.ok(gen.EXISTING_BLOCK_RE instanceof RegExp);
  // もう一度読み込み直して、読み込むだけでは main() が動かず何も出さないことを見る
  const resolved = require.resolve(path.join(__dirname, '..', 'scripts', 'add_feature_journal_links.js'));
  delete require.cache[resolved];
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try { require(resolved); } finally { console.log = orig; }
  assert.deepEqual(logs, []);
});

test('ラベルの大きさはトークン（--fs-xs＝13px）で、12px の床を割る直書きの値を持たない', () => {
  const block = gen.buildBlockHtml(ENTRIES);
  const style = LABEL_RE.exec(block)[1];
  assert.equal(style, gen.LABEL_STYLE, '生成器が書くラベルの style は LABEL_STYLE の1つ');
  const sizes = [...style.matchAll(/font-size\s*:\s*([^;]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(sizes, ['var(--fs-xs)']);
  for (const v of sizes) assert.match(v, /^var\(--fs-(?:2xs|xs|sm|md|lg)\)$/, `トークンを使う: ${v}`);
});

test('ラベルの色は --muted（文字に必要な 4.5:1 を満たす）で、半透明の直書きを持たない。日本語に効かない uppercase も付けない', () => {
  const style = gen.LABEL_STYLE;
  assert.match(style, /color:var\(--muted\)/);
  assert.doesNotMatch(style, /rgba?\(/);
  assert.doesNotMatch(style, /text-transform/);
});

test('ブロックは、ラベルのあとにリンクが続く。リンクの計測（block:feature_journal）は変わらない', () => {
  const block = gen.buildBlockHtml(ENTRIES);
  assert.match(block, /この特集の店の最新ジャーナル記事<\/p>\n {2}<div class="related-links">/);
  assert.equal((block.match(/class="related-link"/g) || []).length, 2);
  assert.equal((block.match(/block:'feature_journal'/g) || []).length, 2);
  assert.match(block, /href="..\/journal\/2026-10-06-sakae-hilton-buffet.html"/);
});

// 公開済みの特集にある旧い形（11.2px・半透明の色・uppercase）
const OLD_BLOCK =
  '  <p class="related-journal-title related-journal-articles" style="margin-top:1.2rem;font-size:.7rem;letter-spacing:.08em;color:rgba(28,28,26,.5);text-transform:uppercase;">この特集の店の最新ジャーナル記事</p>\n' +
  '  <div class="related-links">\n    <a class="related-link" href="../journal/old.html">古い記事</a>\n  </div>\n';
const PAGE = (block) => '<div class="related">\n  <p class="related-journal" style="margin-top:1.2rem;font-size:.82rem;">名古屋の最新グルメは</p>\n' + block + '</div>\n<footer></footer>\n';

test('旧い形のブロックは、毎日の実行で新しい形に置き換わる。置き換えたあとはもう変わらない（冪等）', () => {
  const block = gen.buildBlockHtml(ENTRIES);
  const once = gen.inject(PAGE(OLD_BLOCK), block);
  assert.ok(once, '挿入先が見つかる');
  assert.doesNotMatch(once, /font-size:\.7rem/);
  assert.doesNotMatch(once, /text-transform:uppercase/);
  assert.match(once, /style="margin-top:1\.2rem;font-size:var\(--fs-xs\);letter-spacing:\.08em;color:var\(--muted\);"/);
  assert.equal((once.match(/related-journal-articles/g) || []).length, 1, 'ブロックが増えない');
  assert.doesNotMatch(once, /古い記事/, '旧いリンクは置き換わる');
  assert.equal(gen.inject(once, block), once, '2 回目は同じ');
});

test('ブロックが無いページには、related-journal の段落の直後に挿入する。上の段落は触らない', () => {
  const html = PAGE('');
  const out = gen.inject(html, gen.buildBlockHtml(ENTRIES));
  assert.match(out, /名古屋の最新グルメは<\/p>\n {2}<p class="related-journal-title related-journal-articles"/);
  assert.match(out, /<p class="related-journal" style="margin-top:1\.2rem;font-size:\.82rem;">/);
});
