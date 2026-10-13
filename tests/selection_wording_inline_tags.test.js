'use strict';
/**
 * 検査が、強調・リンク・改行のタグで割れた言い回しも数える（P-389）
 *
 * 背景（2026-10-14）: トップの最初の画面の見出しが
 *   <h1>飲食の<em>プロ</em>が、<br>名古屋<em>だけ</em>を<br>…深く選んだ。</h1>
 * で、人が選んだと読める言い回しなのに、検査は「タグのついた文字列」に語を当てていたため 0 件に見えていた。
 * P-330（トップの言い方の書き換え）は本文に「名古屋の飲食店を、確かめられる情報で選ぶ。」と書いたが、
 * 見出しは直らないまま「検査の語が 0 件」で達成条件を満たして見えた。
 *
 * この検査は、タグを外した文字列にも同じ語の一覧を当て、元の文字列でタグをまたぐ一致だけを足す。
 *   ・タグをまたがない一致は二重に数えない
 *   ・段落・見出し・リスト項目などの境目（ブロックのタグ）は外さないので、別の文どうしをつないで数えることはない
 * 判断の記録: docs/decisions/0034-detector-counts-tag-split-phrases.md
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const audit = require('../scripts/audit_selection_wording');

const compiled = audit.compilePolicy(audit.loadPolicy(ROOT));
const scan = (html, opts) => audit.scanHtml(html, compiled, opts).counts;

test('強調のタグで割れた言い回しを 1 件と数える（飲食の<em>プロ</em>が）', () => {
  assert.deepEqual(scan('<h1>飲食の<em>プロ</em>が、深く選んだ。</h1>'), { 'inshoku-pro': 1 });
});

test('改行・リンク・強調が重なって割れていても数える', () => {
  assert.deepEqual(scan('<p>飲食の<br>プロ</p>'), { 'inshoku-pro': 1 });
  assert.deepEqual(scan('<p>業界<a href="/x">人</a>が通う店</p>'), { 'gyokai-jin': 1 });
  assert.deepEqual(scan('<p>現役の<strong>店<span>長</span></strong>が選ぶ</p>')['genneki-tencho'], 1);
});

test('タグをまたがない一致は、タグを外した走査で二重に数えない', () => {
  assert.deepEqual(scan('<p>業界人が通う店</p>'), { 'gyokai-jin': 1 });
  // 割れた 1 件と割れない 1 件が同じページにあれば 2 件（足し引きで数が合う）
  assert.deepEqual(scan('<p>業界人が通う店</p><p>業界<em>人</em>が集う</p>'), { 'gyokai-jin': 2 });
  // 同じ語が離れて 2 回出ても 2 件
  assert.deepEqual(scan('<p>業界<em>人</em>が選ぶ</p><p>業界<em>人</em>が通う</p>'), { 'gyokai-jin': 2 });
});

test('段落・見出し・リスト項目の境目（ブロックのタグ）はつないで数えない', () => {
  assert.deepEqual(scan('<p>飲食の</p><p>プロ</p>'), {});
  assert.deepEqual(scan('<ul><li>業界</li><li>人気店</li></ul>'), {});
  assert.deepEqual(scan('<h2>現役の</h2><p>店長</p>'), {});
});

test('属性（代替文）の中の言い回しは 1 件と数える', () => {
  assert.deepEqual(scan('<img src="a.jpg" alt="業界人が選ぶ">'), { 'gyokai-jin': 1 });
});

test('語が無いタグつきの文は 0 件（タグを外しても語が生まれない）', () => {
  assert.deepEqual(scan('<h1>名古屋の店を、<br><em>確かめられる</em><br><span class="fade">情報で選ぶ。</span></h1>'), {});
  assert.deepEqual(scan('<p>飲食の<em>プロ</em>デュース店</p>'), {}, '「プロデュース」は飲食のプロではない（語の先読みの除外が、タグをまたいでも効く）');
});

test('flattenInline: タグが無ければ null、あれば外した文字列と元の位置の対応を返す', () => {
  assert.equal(audit.flattenInline('<p>業界人</p>'), null, 'ブロックのタグだけなら外さない');
  assert.equal(audit.flattenInline('語だけ'), null);
  const markup = '<p>飲食の<em>プロ</em>が</p>';
  const f = audit.flattenInline(markup);
  assert.ok(f);
  assert.equal(f.flat, '<p>飲食のプロが</p>');
  // 外した後の「飲食のプロ」（先頭の「飲」から末尾の「ロ」まで）は、元の文字列では <em> をまたぐ
  const start = f.flat.indexOf('飲食のプロ');
  const last = start + '飲食のプロ'.length - 1;
  const from = f.toOrig(start);
  const to = f.toOrig(last) + 1;
  assert.equal(markup.slice(from, to), '飲食の<em>プロ');
});

test('語の一覧（作業の一覧）に、割れた言い回しがタグを除いた読める形で、前後つきで出る', () => {
  const r = audit.scanHtml('<h1>飲食の<em>プロ</em>が、深く選んだ。</h1>', compiled, {});
  assert.equal(r.phrases.length, 1);
  assert.equal(r.phrases[0].term, 'inshoku-pro');
  assert.ok(r.phrases[0].phrase.includes('【飲食のプロ】'), r.phrases[0].phrase);
});

test('これまでのトップの見出し（飲食の<em>プロ</em>が、名古屋<em>だけ</em>を深く選んだ）は違反として数え、今の見出しは数えない', () => {
  const OLD = '<h1>飲食の<em>プロ</em>が、<br>名古屋<em>だけ</em>を<br><span class="fade">深く選んだ。</span></h1>';
  assert.equal(scan(OLD)['inshoku-pro'], 1, '直す前の見出しは検査に引っかかる');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const h1 = (html.match(/<h1>[\s\S]*?<\/h1>/) || [])[0];
  assert.ok(h1, 'トップに h1 がある');
  assert.deepEqual(scan(h1), {}, `今の見出しに語が出ている: ${h1}`);
});
