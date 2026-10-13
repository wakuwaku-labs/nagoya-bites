'use strict';
// P-371（P-332 の 3 本目）: 公開済みのジャーナル記事の「本文」から、人が選んだ・書いたと読める言い方を外す移行の検査。
// 対象: 本文のテキスト節（<p>・<li>・見出し・箱の見出し）、画像の alt、HTML コメントの撮影メモの 1 文。
// 題の系統（title・h1・og／twitter:title・headline・パンくず・関連リンクの題）と説明文の系統は、この段階では触らない（P-334・P-370）。
// ジャーナルは毎日新しい記事が加わるので、公開中の記事の語や件数を数える検査はここに置かない（ADR 0033）。
// ここにあるのは fixture の検査と、手書きの対応表そのものの整合だけ。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  rewriteText, splitSentences, isTitleFamilyLine, digitsOf, quotesOf, emptyElements, looksBroken, loadTargetTerms, hasHit, main,
} = require('../scripts/rewrite_journal_wording');
const OVERRIDES = require('../scripts/lib/journal_wording_overrides');

const ROOT = path.join(__dirname, '..');
const terms = loadTargetTerms(ROOT);
const quiet = () => {};
const body = (text, pairs) => rewriteText(text, ['body'], terms, { bodyPairs: pairs });

test('splitSentences: 。！？で割り、「」『』（）の中の句点では割らない。つなぐと元に戻る', () => {
  assert.deepEqual(splitSentences('前の文。次の文！その次？最後'), ['前の文。', '次の文！', 'その次？', '最後']);
  assert.deepEqual(splitSentences('彼は「行く。」と言った。次だ。'), ['彼は「行く。」と言った。', '次だ。']);
  assert.deepEqual(splitSentences('見出し『谷間日。』の話（注。補足）である。'), ['見出し『谷間日。』の話（注。補足）である。']);
  assert.deepEqual(splitSentences('A。 B。 C'), ['A。', ' B。', ' C'], '文のあいだの空白は次の文につく');
  for (const s of ['', 'ただの句', '。', '「A。B」。', '終わり。　', '一。二！三？四']) assert.equal(splitSentences(s).join(''), s, JSON.stringify(s));
});

test('digitsOf・quotesOf: 数字の並びと「」『』の中身を取り出す', () => {
  assert.equal(digitsOf('22時以降に約5,000店、1.5倍'), '22|5,000|1.5');
  assert.equal(digitsOf('数字なし'), '');
  assert.equal(quotesOf('「予約困難」を避け、『谷間』を狙う'), '「予約困難」|『谷間』');
  assert.equal(quotesOf('引用なし'), '');
});

test('isTitleFamilyLine: 題・説明文・関連リンクの系統の行だけが true。本文の行は false', () => {
  const family = [
    '<title>題 | NAGOYA BITES</title>',
    '<meta property="og:title" content="題">',
    '<meta name="twitter:title" content="題">',
    '<meta name="description" content="説明">',
    '<meta property="og:description" content="説明">',
    '<meta name="twitter:description" content="説明">',
    '<h1 class="art-title">題</h1>',
    '  "headline": "題",',
    '      { "@type": "ListItem", "position": 3, "name": "題" }',
    '    "name": "題"',
    '    "description": "説明",',
    '<a class="related-link is-primary" href="x.html">題</a>',
    '<a class="related-link" href="y.html">題</a>',
  ];
  for (const l of family) assert.equal(isTitleFamilyLine(l), true, l);
  const bodyLines = [
    '<p>本文。</p>', '<li>項目</li>', '<h2>見出し</h2>', '<p class="insider-title">箱の見出し</p>',
    '  - [shot_type] 撮影コンセプト', '<img alt="説明" src="a.jpg">', '<th>列の見出し</th>',
    '<p class="art-lead">冒頭リードは本文と同じに見る</p>',
  ];
  for (const l of bodyLines) assert.equal(isTitleFamilyLine(l), false, l);
});

const DOC = [
  '<article>',
  '<h2>業界人が滑り込む3カテゴリ</h2>',
  '<p>前の文。これが業界人の使い方だ。 後の文。</p>',
  '<ul>',
  '  <li>22時以降に業界人の来店が集中する。</li>',
  '</ul>',
  '<div class="insider-box">',
  '  <p class="insider-title">土曜夜タイムライン — 業界人の動き方</p>',
  '</div>',
  '<p><strong>要点</strong>業界人は連休の構造を読んで、あえて『谷間』に集中する。</p>',
  '</article>',
  '',
].join('\n');
const PAIRS = [
  ['業界人が滑り込む3カテゴリ', '予約なしで滑り込める3カテゴリ'],
  ['これが業界人の使い方だ。', 'これが使い方の基本だ。'],
  ['22時以降に業界人の来店が集中する。', '22時以降に来店が集中する。'],
  ['土曜夜タイムライン — 業界人の動き方', '土曜夜タイムライン — 動き方'],
  ['業界人は連休の構造を読んで、あえて『谷間』に集中する。', '連休の構造を読んで、あえて『谷間』に集中するのが得策だ。'],
];

test('body 段階: <p>・<li>・見出し・箱の見出しの文を置き換え、前後の文と空白・タグは変えない。冪等', () => {
  const r = body(DOC, PAIRS);
  assert.deepEqual(r.violations, []);
  assert.equal(r.stats.body, 5);
  assert.deepEqual(r.changes.map((c) => c.n), [2, 3, 5, 8, 10]);
  let expected = DOC;
  for (const [b, a] of PAIRS) expected = expected.replace(b, () => a);
  assert.equal(r.text, expected);
  assert.ok(r.text.includes('<p>前の文。これが使い方の基本だ。 後の文。</p>'), '前後の文と空白は残る');
  assert.ok(r.text.includes('<p><strong>要点</strong>連休の構造を読んで'), 'タグをまたいだテキスト節も、節ごとに直る');
  const again = body(r.text, PAIRS);
  assert.equal(again.text, r.text, '2 回目は何も変えない');
  assert.deepEqual(again.stats, {});
});

test('body 段階: 文全体が表の旧と一致したときだけ置き換える（部分一致はしない）', () => {
  const pairs = [['業界人が見るのは、', '見るのは、']];
  const long = '<p>業界人が見るのは、限定のひやおろしが並ぶ日だ。</p>\n';
  assert.equal(body(long, pairs).text, long, '長い文の頭だけ一致しても触らない');
  assert.deepEqual(body(long, pairs).stats, {});
  const frag = '<p><a href="a.html">限定の特集</a>業界人が見るのは、</p>\n';
  assert.equal(body(frag, pairs).text, '<p><a href="a.html">限定の特集</a>見るのは、</p>\n', 'タグで切れた断片は、その断片だけの節に当たる');
  const mid = '<p>前置き。業界人が見るのは、</p>\n';
  assert.equal(body(mid, pairs).text, '<p>前置き。見るのは、</p>\n');
});

test('body 段階: 題の系統・説明文の系統・関連リンク・パンくず・<style> の行は、同じ文があっても触らない', () => {
  const X = 'これが業界人の使い方だ。';
  const pairs = [[X, 'これが使い方の基本だ。']];
  const untouched = [
    `<title>${X}</title>`,
    `<h1 class="art-title">${X}</h1>`,
    `<a class="related-link" href="a.html">${X}</a>`,
    `<a class="related-link is-primary" href="b.html">${X}</a>`,
    '<style>',
    X,
    '</style>',
    '<div class="breadcrumb">',
    '  <a href="../index.html">トップ</a>',
    `  <span>${X}</span>`,
    '</div>',
  ].join('\n');
  const r = body(`${untouched}\n<p>${X}</p>\n`, pairs);
  assert.equal(r.text, `${untouched}\n<p>これが使い方の基本だ。</p>\n`, '本文の 1 行だけが直る');
  assert.equal(r.stats.body, 1);
  assert.deepEqual(r.violations, []);
});

test('body 段階: 冒頭リード（art-lead）は本文と同じに見る。meta の description は触らない', () => {
  const X = '名古屋の飲食業界で働く人間として、この「差額の構造」を正直に解剖する。';
  const pairs = [[X, 'この「差額の構造」を正直に解剖する。']];
  const meta = `<meta name="description" content="${X}">`;
  const doc = `${meta}\n<p class="art-lead">会計は8,000円を超えていた。${X}</p>\n`;
  const r = body(doc, pairs);
  assert.equal(r.text, `${meta}\n<p class="art-lead">会計は8,000円を超えていた。この「差額の構造」を正直に解剖する。</p>\n`);
  assert.equal(r.stats.body, 1);
  assert.equal(body(r.text, pairs).text, r.text, '2 回目は何も変えない');
});

test('body 段階: alt の値は値の全体が旧と一致したときだけ、HTML コメントの撮影メモは 1 行ぶんの文として直す。インデントは残す', () => {
  const pairs = [
    ['業界人が通う店の外観', '通う店の外観'],
    ['- [shot_type] 撮影コンセプト — ①外観 ②板前（業界人視点）', '- [shot_type] 撮影コンセプト — ①外観 ②板前'],
  ];
  const doc = [
    '<img src="a.jpg" alt="業界人が通う店の外観" width="800">',
    '<img src="b.jpg" alt="業界人が通う店の外観（夜）">',
    '<!--',
    'PHOTO SUGGESTIONS（読者には非表示）',
    '  - [shot_type] 撮影コンセプト — ①外観 ②板前（業界人視点）',
    '-->',
    '',
  ].join('\n');
  const r = body(doc, pairs);
  assert.deepEqual(r.violations, []);
  assert.equal(r.stats.body, 2);
  assert.equal(r.text, doc
    .replace('alt="業界人が通う店の外観" width', () => 'alt="通う店の外観" width')
    .replace('  - [shot_type] 撮影コンセプト — ①外観 ②板前（業界人視点）', () => '  - [shot_type] 撮影コンセプト — ①外観 ②板前'));
  assert.ok(r.text.includes('alt="業界人が通う店の外観（夜）"'), '値の一部だけの一致は触らない');
  assert.equal(body(r.text, pairs).text, r.text, '冪等');
});

test('body 段階: 新が空の対はその文を外す（前の空白も外す）。段落や項目が空になる行は書き換えず、violations に残す', () => {
  const pairs = [['業界人の間では有名な話だ。', '']];
  const mid = body('<p>前の文。業界人の間では有名な話だ。後の文。</p>\n', pairs);
  assert.equal(mid.text, '<p>前の文。後の文。</p>\n');
  assert.equal(mid.stats.body, 1);
  const spaced = body('<p>前の文。 業界人の間では有名な話だ。 後の文。</p>\n', pairs);
  assert.equal(spaced.text, '<p>前の文。 後の文。</p>\n', '空白が重ならない');
  const last = body('<p>前の文。 業界人の間では有名な話だ。</p>\n', pairs);
  assert.equal(last.text, '<p>前の文。</p>\n');
  const withOther = body('<p><strong>要点</strong>業界人の間では有名な話だ。</p>\n', pairs);
  assert.equal(withOther.text, '<p><strong>要点</strong></p>\n', '他に中身があれば空にはならない');
  for (const only of ['<p>業界人の間では有名な話だ。</p>\n', '<ul>\n<li> 業界人の間では有名な話だ。 </li>\n</ul>\n']) {
    const r = body(only, pairs);
    assert.equal(r.text, only, '空になるなら書き換えない');
    assert.equal(r.violations.length, 1);
    assert.match(r.violations[0].after, /空になる/);
    assert.deepEqual(r.stats, {});
  }
  assert.equal(emptyElements('<p></p><li> </li><p>あり</p><a href="x"></a>'), 3);
  assert.equal(emptyElements('<p><strong>要点</strong></p>'), 0);
});

test('安全の検査: 数字が変わる・「」『』の中身が変わる（印なし）・語が残る・文が崩れる対は書き換えず、violations に残す', () => {
  const cases = [
    ['業界人が3軒を選ぶ。', '4軒を選ぶ。', '数字が変わる'],
    ['業界人は「予約困難」を避ける。', '「人気店」を避ける。', '「」『』の中身が変わる'],
    ['業界人が選ぶ店。', '業界人が選ぶ名店。', '検査の語が残る'],
    ['業界人が使う店を紹介する。', '店を。紹介する。', '文が崩れて見える'],
  ];
  for (const [before, after, problem] of cases) {
    const doc = `<p>${before}</p>\n`;
    const r = body(doc, [[before, after]]);
    assert.equal(r.text, doc, `書き換えない: ${before}`);
    assert.equal(r.violations.length, 1, before);
    assert.equal(r.violations[0].key, 'body');
    assert.equal(r.violations[0].n, 1);
    assert.ok(r.violations[0].after.includes(problem), r.violations[0].after);
    assert.deepEqual(r.stats, {});
  }
  // 印（{ q: true }）をつけた対だけ、引用の言い換えを許す。数字は印があっても変えられない
  const q = body('<p>業界人は「予約困難」を避ける。</p>\n', [['業界人は「予約困難」を避ける。', '「人気店」を避ける。', { q: true }]]);
  assert.equal(q.text, '<p>「人気店」を避ける。</p>\n');
  assert.deepEqual(q.violations, []);
  const d = body('<p>業界人が3軒を選ぶ。</p>\n', [['業界人が3軒を選ぶ。', '4軒を選ぶ。', { q: true }]]);
  assert.equal(d.violations.length, 1);
  assert.equal(d.text, '<p>業界人が3軒を選ぶ。</p>\n');
});

test('heading と同じ実行で一緒に当てられる。2 回目は何も変えない', () => {
  const doc = '<meta name="keywords" content="名古屋,業界人">\n<p>これが業界人の使い方だ。</p>\n';
  const r = rewriteText(doc, ['heading', 'body'], terms, { bodyPairs: [['これが業界人の使い方だ。', 'これが使い方の基本だ。']] });
  assert.equal(r.text, '<meta name="keywords" content="名古屋">\n<p>これが使い方の基本だ。</p>\n');
  assert.deepEqual(r.stats, { keywords: 1, body: 1 });
  assert.equal(rewriteText(r.text, ['heading', 'body'], terms, { bodyPairs: [['これが業界人の使い方だ。', 'これが使い方の基本だ。']] }).text, r.text);
});

test('対応表（body）: 旧は 1 文・新は語を含まない・数字が同じ・「」『』は印つきの対だけ変わる・文が崩れない・旧と違う。旧の重複なし', () => {
  const pairs = OVERRIDES.body;
  assert.ok(pairs.length >= 200, '手書きの対応表がある');
  const olds = new Set(pairs.map(([b]) => b));
  assert.equal(olds.size, pairs.length, '旧の重複（後の対が前の対を黙って上書きする）');
  const problems = [];
  for (const [before, after, flags] of pairs) {
    const tag = before.slice(0, 40);
    if (typeof before !== 'string' || typeof after !== 'string' || !before) { problems.push(`文字列でない／旧が空: ${tag}`); continue; }
    if (flags !== undefined && !(Object.keys(flags).length >= 1 && Object.entries(flags).every(([k, v]) => (k === 'q' || k === 'ctx') && v === true))) problems.push(`3 つ目は { q: true }・{ ctx: true }・両方のどれか: ${tag}`);
    const ctx = Boolean(flags && flags.ctx);
    // 旧に検査の語が無い対は文脈の直し（出典・経歴の主張や、削った文を受けていた文）。表の中で { ctx: true } と明示させる
    if (!hasHit(terms, before) && !ctx) problems.push(`旧に検査の語が無い。意図した文脈の直しなら { ctx: true } をつける: ${tag}`);
    if (hasHit(terms, before) && ctx) problems.push(`旧に検査の語があるのに { ctx: true } がついている: ${tag}`);
    if (hasHit(terms, after)) problems.push(`新にも検査の語が残る: ${tag}`);
    if (digitsOf(before) !== digitsOf(after)) problems.push(`数字が変わる: ${tag}`);
    const quotesChange = quotesOf(before) !== quotesOf(after);
    if (quotesChange !== Boolean(flags && flags.q)) problems.push(`「」『』の中身が変わるのは { q: true } の対だけ（印だけある対も不可）: ${tag}`);
    if (looksBroken(before, after)) problems.push(`文が崩れて見える: ${after.slice(0, 40)}`);
    if (before === after) problems.push(`旧と同じ: ${tag}`);
    if (/\n/.test(before + after)) problems.push(`改行を含む: ${tag}`);
    if (before !== before.trim() || after !== after.trim()) problems.push(`前後に空白がある（置き換えは元の空白を残す）: ${tag}`);
    const parts = splitSentences(before);
    if (parts.length !== 1 || parts[0] !== before) problems.push(`旧が 1 つの文になっていない（当たらない）: ${tag}`);
    if (after && olds.has(after)) problems.push(`新が別の対の旧になる（2 回目に動く）: ${tag}`);
  }
  assert.deepEqual(problems, []);
});

function tmpRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-journal-body-'));
  fs.mkdirSync(path.join(root, 'journal'));
  for (const [name, html] of Object.entries(files)) fs.writeFileSync(path.join(root, 'journal', name), html);
  return root;
}
const read = (root, name) => fs.readFileSync(path.join(root, 'journal', name), 'utf8');

test('CLI: --check は要るとき exit 1、--dry-run は書かない、実行後は --check が exit 0。--only で絞る。記事以外は見ない', () => {
  // 実際の対応表から、数字も引用も含まない 1 対を借りる（表の中身が変わっても、この検査は表の整合だけに頼る）
  const pair = OVERRIDES.body.find(([b, a]) => a && !/\d/.test(b) && !/[「『]/.test(b) && b.length < 40);
  assert.ok(pair, '借りられる対がある');
  const [OLD, NEW] = pair;
  const art = `<html><head>\n<title>題</title>\n</head><body>\n<p>${OLD}</p>\n</body></html>\n`;
  const root = tmpRoot({ '2026-10-01-a.html': art, '2026-10-02-b.html': art, 'index.html': art, '_template.html': art });
  assert.equal(main(['--phase', 'body', '--check', '--root', root], quiet), 1);
  assert.equal(main(['--phase', 'body', '--dry-run', '--root', root], quiet), 0);
  assert.equal(read(root, '2026-10-01-a.html'), art, 'dry-run は書かない');
  assert.equal(main(['--phase', 'body', '--only', '10-02-b', '--root', root], quiet), 0);
  assert.equal(read(root, '2026-10-01-a.html'), art, '絞った外の記事は触らない');
  assert.equal(read(root, '2026-10-02-b.html'), art.replace(OLD, () => NEW));
  assert.equal(main(['--phase', 'body', '--root', root], quiet), 0);
  assert.equal(read(root, '2026-10-01-a.html'), art.replace(OLD, () => NEW));
  assert.equal(read(root, 'index.html'), art, '記事以外は触らない');
  assert.equal(read(root, '_template.html'), art, 'テンプレートは触らない');
  assert.equal(main(['--phase', 'body', '--check', '--root', root], quiet), 0, '2 回目は何も変えない');
  assert.throws(() => main(['--phase', 'body', '--oops', '--root', root], quiet), /知らない引数/);
});
