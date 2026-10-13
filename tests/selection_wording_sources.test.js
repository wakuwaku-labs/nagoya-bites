'use strict';
/**
 * 店の選び方の言い方を、元（生成器・テンプレート）に置かない（P-326〜・設計書 5.5 節・8.4 節の順 1）
 *
 * オーナーの指示（2026-10-11）:
 *   「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者がすべての店舗を
 *    選定しているような表現は使用しないでください。」
 *
 * 公開ページ全体の検査（scripts/audit_selection_wording.js）は、既存の約6,000ページが残っているあいだ
 * 夜間QA の soft（赤くなっても止めない）。この検査はそれとは別に、「直し終えた元」が元の言い方に戻らないよう、
 * 元のファイルそのものを、data/selection_wording_policy.json の語（severity=error）で調べる。
 * 直したファイルは CLEAN_SOURCES に足していく（足すのは、そのファイルに語が 1 件も無いときだけ）。
 * 語が要るファイル（検索で狙う語の台帳など）は、足さずに、その理由を書く。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'selection_wording_policy.json'), 'utf8'));
const errorTerms = policy.terms.filter((t) => t.severity === 'error').map((t) => ({ id: t.id, re: new RegExp(t.pattern, 'g') }));

// 直し終えた元。日次ジャーナルが新しく作るページの元（P-326）
const CLEAN_SOURCES = [
  'journal/_template.html',
  'scripts/add_journal_site_intro.js',
  'scripts/build_journal_index.js',
  'scripts/generate_daily_draft.js',
];

// 共通のクローム（ヘッダー・ナビ・フッター）は scripts/lib/site_chrome.js が正本で、各ページの区画はその写し。
// 言い方の直しは正本で行い（P-327）、写しは apply_site_chrome.js が合わせる。写しの区画はここでは見ない。
function withoutChrome(text) {
  return text.replace(/<!-- NB-CHROME:(\w+):START -->[\s\S]*?<!-- NB-CHROME:\1:END -->/g, '');
}

function hits(text) {
  const out = [];
  for (const t of errorTerms) {
    t.re.lastIndex = 0;
    let m;
    while ((m = t.re.exec(text)) !== null) out.push(`${t.id}: ${text.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10).replace(/\s+/g, ' ')}`);
  }
  return out;
}

test('共通クロームの区画だけを除く（区画の外の言い方は見る）', () => {
  const t = 'A現役の飲食店マネージャーA<!-- NB-CHROME:FOOTER:START -->現役の飲食店マネージャー<!-- NB-CHROME:FOOTER:END -->B';
  assert.equal(withoutChrome(t), 'A現役の飲食店マネージャーAB');
  assert.equal(hits(withoutChrome(t)).length, 1);
});

test('policy の語（severity=error）が読めて、検査が空でない', () => {
  assert.ok(errorTerms.length >= 5, String(errorTerms.length));
  assert.ok(hits('飲食のプロが選んだ').length >= 1, 'プロが選んだ');
  assert.ok(hits('業界人の目利き').length >= 1, '業界人');
  assert.equal(hits('名古屋の新店と話題を、毎日まとめています').length, 0);
});

for (const rel of CLEAN_SOURCES) {
  test(`元に人が選んだと読める言い方が無い: ${rel}`, () => {
    const text = withoutChrome(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    assert.deepEqual(hits(text), [], `${rel} に、人が選んだ・書いたと読める言い方が戻っている（設計書 5.5 節の言い換えを使う）`);
  });
}

test('日次ジャーナルの下書きの見出しと仮の文は、新しい言い方（P-326）', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'journal', '_template.html'), 'utf8');
  assert.ok(tpl.includes('<p class="insider-title">知っておきたいポイント</p>'));
  const gen = fs.readFileSync(path.join(ROOT, 'scripts', 'generate_daily_draft.js'), 'utf8');
  assert.ok(gen.includes('<li>(読み解きのポイントを記述)</li>'));
  const idx = fs.readFileSync(path.join(ROOT, 'scripts', 'build_journal_index.js'), 'utf8');
  assert.equal((idx.match(/名古屋の新店と話題を、毎日まとめています/g) || []).length, 2, 'RSS の description と Atom の subtitle');
});
