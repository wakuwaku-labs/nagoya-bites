'use strict';
// SEO-143: 店舗ページの本文に「編集部の選定理由」（editorReason）を出す。
// - おすすめポイントと同じ文なら二重に出さない
// - insiderNote は出さない（オーナーが書いたか確かめた記録が無いため）
// - 選定の根拠（visitStatus）はトップのモーダルと同じ語で添える
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage, buildEditorReason } = require(path.join(ROOT, 'gen-store-pages.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const BASE = { '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', 'おすすめポイント': '炭火の焼き鳥が看板。' };

test('editorReason を持つ店は「編集部の選定理由」を本文に出し、HTML をエスケープする', () => {
  const html = buildEditorReason({ ...BASE, editorReason: '<b>串打ち</b>を毎朝店で行う一軒。', visitStatus: 'visited' });
  assert.match(html, /<section class="editor-reason">/);
  assert.match(html, /<h2>編集部の選定理由<\/h2>/);
  assert.ok(html.includes('&lt;b&gt;串打ち&lt;/b&gt;を毎朝店で行う一軒。'));
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('選定の根拠：訪問済'));
});

test('おすすめポイントと同じ文なら出さない（文末の句点の有無は同じ文とみなす）', () => {
  assert.equal(buildEditorReason({ ...BASE, editorReason: '炭火の焼き鳥が看板' }), '');
  assert.equal(buildEditorReason({ ...BASE, editorReason: '  炭火の焼き鳥が看板。 ' }), '');
});

test('editorReason が無い・空白だけなら出さない', () => {
  assert.equal(buildEditorReason(BASE), '');
  assert.equal(buildEditorReason({ ...BASE, editorReason: '   ' }), '');
});

test('visitStatus が未知・無しのときは根拠の行を出さない', () => {
  const html = buildEditorReason({ ...BASE, editorReason: '別の文。', visitStatus: 'unknown' });
  assert.match(html, /<section class="editor-reason">/);
  assert.ok(!html.includes('選定の根拠'));
  assert.ok(buildEditorReason({ ...BASE, editorReason: '別の文。', visitStatus: 'desk_automated' })
    .includes('選定の根拠：公開情報ベース（自動収集）'));
});

test('renderStorePage: 選定理由はおすすめポイントの後に出し、insiderNote は出さない。インライン JS も壊さない', () => {
  const s = { ...BASE, editorReason: '仕込みの丁寧さで選んだ。', visitStatus: 'desk', insiderNote: '業界人メモの本文テキスト' };
  const html = renderStorePage(s, 'J-test', [], []);
  const iPoint = html.indexOf('<div class="point-box">');
  const iReason = html.indexOf('<section class="editor-reason">');
  assert.ok(iPoint > 0 && iReason > iPoint, 'おすすめポイントの後に置く');
  assert.ok(html.includes('仕込みの丁寧さで選んだ。'));
  assert.ok(html.includes('選定の根拠：公開情報ベース'));
  assert.ok(!html.includes('業界人メモの本文テキスト'), 'insiderNote は出さない');
  const r = auditHtml(html, { filename: 'render:editor-reason' });
  assert.deepEqual(r.violations, []);

  const plain = renderStorePage(BASE, 'J-test', [], []);
  assert.ok(!plain.includes('<section class="editor-reason">'));
});
