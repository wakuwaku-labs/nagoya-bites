'use strict';
// SEO-149: ジャーナル本文冒頭の「合わせて読む」（SEO-070 の区画）を新しい記事にも入れる。
// 日次ジャーナルの refresh_journal_related.js が --add-only の形で全記事に呼び、区画の無い記事にだけ入れる。
// 既にある区画は書き換えない（docs/decisions/0015 の5）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, processFile, findInsertionAfterIntroPara, START, END } = require('../scripts/inject_journal_feature_cta');

const ROOT = path.join(__dirname, '..');
const SITE_INTRO = '<p class="nb-site-intro">この記事は<a href="../index.html">NAGOYA BITES</a> — 名古屋のグルメガイドの一部です。</p>';
const page = (title, body) => `<html><body><h1 class="art-title">${title}</h1>
  <div class="art-body">
${body}
  </div></body></html>`;
const OLD_BLOCK = `${START}
<div class="tips-box" role="complementary" aria-label="関連特集">
  <a href="../features/nagoya-yakiniku.html">焼肉おすすめ10選 →</a>
</div>
${END}`;

function tmpJournal(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-cta-'));
  for (const [name, html] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), html);
  return dir;
}

test('区画はサイト紹介の1行ではなく、記事の導入段落の後に入る', () => {
  const html = page('x', `${SITE_INTRO}\n    <h2>見出し</h2>\n<p>導入の段落。</p>\n<p>次の段落。</p>`);
  const at = findInsertionAfterIntroPara(html);
  assert.strictEqual(html.slice(at - '導入の段落。</p>'.length, at), '導入の段落。</p>');
  // 同じ行に段落が続いていても、閉じタグの直後で切る
  const oneLine = page('x', `${SITE_INTRO}\n<p>一つ目。</p><p>二つ目。</p>`);
  assert.strictEqual(oneLine.slice(findInsertionAfterIntroPara(oneLine)), '<p>二つ目。</p>\n  </div></body></html>');
  // 本文が無ければ入れない
  assert.strictEqual(findInsertionAfterIntroPara('<div class="art-body">\n</div>'), -1);
  assert.strictEqual(findInsertionAfterIntroPara('<p>本文の外</p>'), -1);
});

test('--add-only は区画の無い記事にだけ入れ、既にある区画は書き換えも削除もしない', () => {
  const dir = tmpJournal({
    '2026-10-01-new-yakitori.html': page('錦の焼き鳥で一人飲み', `${SITE_INTRO}\n<p>導入。</p>\n<p>本文。</p>`),
    '2026-09-01-old-yakiniku.html': page('名駅の焼肉の新店', `${SITE_INTRO}\n${OLD_BLOCK}\n<p>導入。</p>`),
    '2026-08-01-old-nomatch.html': page('今日の話', `${SITE_INTRO}\n${OLD_BLOCK}\n<p>導入。</p>`),
    '2026-07-01-nomatch.html': page('今日の話', `${SITE_INTRO}\n<p>導入。</p>`),
  });
  const before = Object.fromEntries(fs.readdirSync(dir).map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  // 書かずに数える: 区画が無くて表に当たる記事だけが would_add
  const checked = run({ check: true, dir });
  assert.deepStrictEqual(checked.filter(r => r.status === 'would_add').map(r => r.file), ['2026-10-01-new-yakitori.html']);
  assert.deepStrictEqual(fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')), Object.values(before));
  const r = Object.fromEntries(run({ addOnly: true, dir }).map(x => [x.file, x.status]));
  assert.deepStrictEqual(r, {
    '2026-10-01-new-yakitori.html': 'added',
    '2026-09-01-old-yakiniku.html': 'kept',
    '2026-08-01-old-nomatch.html': 'no_topic_match',
    '2026-07-01-nomatch.html': 'no_topic_match',
  });
  const added = fs.readFileSync(path.join(dir, '2026-10-01-new-yakitori.html'), 'utf8');
  assert.ok(added.includes(`導入。</p>\n${START}`), '導入段落の直後');
  assert.ok(added.indexOf(START) > added.indexOf('nb-site-intro'));
  assert.ok(/href="\.\.\/features\/nagoya-yakitori\.html"/.test(added));
  for (const f of ['2026-09-01-old-yakiniku.html', '2026-08-01-old-nomatch.html', '2026-07-01-nomatch.html']) {
    assert.strictEqual(fs.readFileSync(path.join(dir, f), 'utf8'), before[f], f);
  }
  // 冪等: もう一度回しても何も変わらない
  assert.ok(run({ addOnly: true, dir }).every(x => !x.changed));
  // --add-only でなければ、旧い区画は今の表で置き換わる（明示して再実行したときだけ）
  assert.strictEqual(processFile('2026-09-01-old-yakiniku.html', { dir }).status, 'updated');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('日次ジャーナルの関連記事の更新が --add-only で呼び、夜間QA が soft で数える', () => {
  const rel = fs.readFileSync(path.join(ROOT, 'scripts', 'refresh_journal_related.js'), 'utf8');
  assert.ok(rel.includes("require('./inject_journal_feature_cta').run({ addOnly: true })"));
  // 件数をそろえる処理（syncAll）より前に入れる
  assert.ok(rel.indexOf("require('./inject_journal_feature_cta')") < rel.indexOf("syncAll({ target: 'journal'"));
  const qa = fs.readFileSync(path.join(ROOT, 'scripts', 'nightly_qa.js'), 'utf8');
  const i = qa.indexOf("id: 'journal-feature-cta'");
  assert.ok(i > 0);
  const block = qa.slice(i, qa.indexOf('});', i));
  assert.ok(block.includes('hard: false'));
  assert.ok(block.includes("'scripts/inject_journal_feature_cta.js', '--check'"));
});
