'use strict';
// P-332（I-03f）: 公開済みのジャーナル記事から、人が選んだ・書いたと読める言い方を外す移行の検査。
// 段階 heading（P-369）: 区画の見出し・導入の 1 行・meta keywords・未記入のまま公開された箱。
// 題の系統（title・h1・og／twitter:title・headline・パンくず・関連リンクの題）は、この移行では触らない（P-334）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  rewriteText, rewriteHeadingLine, rewriteIntroLine, rewriteKeywordsLine, applyLineRules, signature, main,
} = require('../scripts/rewrite_journal_wording');

const ROOT = path.join(__dirname, '..');

const OLD_HEADING = '      <p class="insider-title">Inside Perspective — 業界人の目利き</p>';
const OLD_HEADING_2 = '      <p class="insider-title">Inside Perspective — 業界人の目線</p>';
const NEW_HEADING = '      <p class="insider-title">知っておきたいポイント</p>';
const OLD_INTRO = '<p class="nb-site-intro">この記事は<a href="../index.html">NAGOYA BITES</a> — 名古屋の厳選約5,000店を業界視点で紹介するグルメガイドの一部です。</p>';
const NEW_INTRO = '<p class="nb-site-intro">この記事は<a href="../index.html">NAGOYA BITES</a> — 名古屋の約5,000店を、公開情報をもとに紹介するグルメガイドの一部です。</p>';

test('見出し: 「Inside Perspective — 業界人の目利き／目線」だけを「知っておきたいポイント」にする（新しい記事の見出しと同じ）', () => {
  assert.equal(rewriteHeadingLine(OLD_HEADING), NEW_HEADING);
  assert.equal(rewriteHeadingLine(OLD_HEADING_2), NEW_HEADING);
  assert.equal(rewriteHeadingLine(NEW_HEADING), NEW_HEADING, '冪等');
  // 記事ごとの箱の題（本文の言い回し）は heading 段階では触らない
  const own = '      <p class="insider-title">土曜夜タイムライン — 業界人の動き方</p>';
  assert.equal(rewriteHeadingLine(own), own);
  const tpl = fs.readFileSync(path.join(ROOT, 'journal', '_template.html'), 'utf8');
  assert.ok(tpl.includes('<p class="insider-title">知っておきたいポイント</p>'), 'テンプレートの見出しと同じ文');
});

test('導入の 1 行: 数の表記（約5,000・1,100店超）を引き継ぎ、「厳選」と「業界視点で」を外す。nb-site-intro の行だけ', () => {
  assert.equal(rewriteIntroLine(OLD_INTRO), NEW_INTRO);
  assert.equal(rewriteIntroLine(NEW_INTRO), NEW_INTRO, '冪等');
  const legacy = OLD_INTRO.replace('約5,000店', '1,100店超');
  assert.equal(rewriteIntroLine(legacy), NEW_INTRO.replace('約5,000店', '1,100店超'));
  const elsewhere = '<p>名古屋の厳選約5,000店を業界視点で紹介する</p>';
  assert.equal(rewriteIntroLine(elsewhere), elsewhere, 'nb-site-intro 以外の行は触らない');
  const gen = fs.readFileSync(path.join(ROOT, 'scripts', 'add_journal_site_intro.js'), 'utf8');
  assert.ok(gen.includes('店を、公開情報をもとに紹介するグルメガイドの一部です。'), '新しい記事の導入と同じ文');
});

test('meta keywords: 「業界人」「業界人視点」を外し、「業界人 名古屋スイーツ」は先頭の語だけ外す。他の語は順序ごと残す', () => {
  const k = (s) => `<meta name="keywords" content="${s}">`;
  assert.equal(rewriteKeywordsLine(k('矢場味仙,台湾ラーメン,業界人')), k('矢場味仙,台湾ラーメン'));
  assert.equal(rewriteKeywordsLine(k('名古屋,業界人,GW,予約')), k('名古屋,GW,予約'));
  assert.equal(rewriteKeywordsLine(k('名古屋,業界人視点,GW')), k('名古屋,GW'));
  assert.equal(rewriteKeywordsLine(k('名古屋,業界人 名古屋スイーツ,GW')), k('名古屋,名古屋スイーツ,GW'));
  assert.equal(rewriteKeywordsLine(k('名古屋,GW')), k('名古屋,GW'), '冪等');
  assert.equal(rewriteKeywordsLine(k('名古屋,業界人向け')), k('名古屋,業界人向け'), '完全一致の語だけ（別の語は他の段階で見る）');
});

test('未記入のまま公開された箱: 仮の文だけの箱を外し、周りの余白は残す。中身のある箱は触らない', () => {
  const box = `${OLD_HEADING.replace('      <p', '    <div class="insider-box">\n      <p')}\n      <ul>\n        <li>(業界人視点を記述)</li>\n      </ul>\n    </div>\n`;
  const doc = `<p>導入</p>\n\n${box}\n    <div class="store-list">\n</div>\n`;
  const r = rewriteText(doc, ['heading']);
  assert.equal(r.text, '<p>導入</p>\n\n    <div class="store-list">\n</div>\n');
  assert.equal(r.stats.boxes, 1);
  const real = `<p>導入</p>\n\n    <div class="insider-box">\n${OLD_HEADING}\n      <ul>\n        <li>2個セットは330円差</li>\n      </ul>\n    </div>\n\n    <div class="store-list">\n`;
  const r2 = rewriteText(real, ['heading']);
  assert.equal(r2.stats.boxes, undefined);
  assert.equal(r2.text, real.replace(OLD_HEADING, NEW_HEADING));
});

test('数字と「」『』の中身が変わる書き換えは行わず、violations に残す（実際の規則は数字を動かさない）', () => {
  assert.equal(signature('名古屋の約5,000店を『谷間日』に'), '5,000|『谷間日』');
  assert.notEqual(signature('約5,000店'), signature('約4,000店'));
  assert.notEqual(signature('「A」を'), signature('「B」を'));
  // 数字を動かしてしまう規則を当てると、その行は書き換えずに violations へ回る
  const stats = {};
  const violations = [];
  const changes = [];
  const out = applyLineRules('約5,000店\n約5,000軒\n', [
    ['digits', (l) => l.replace('5,000店', '4,000店')],
    ['ok', (l) => l.replace('軒', '店')],
  ], stats, violations, changes);
  assert.equal(out, '約5,000店\n約5,000店\n', '数字が動く行は元のまま、動かない行は書き換わる');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].key, 'digits');
  assert.equal(violations[0].n, 1);
  assert.deepEqual(stats, { ok: 1 });
  // 実際の導入の規則は数字を動かさない
  assert.equal(signature(OLD_INTRO), signature(NEW_INTRO));
  assert.deepEqual(rewriteText(`${OLD_INTRO}\n`, ['heading']).violations, []);
});

test('rewriteText: 3 つの規則を一度に当てても、2 回目は何も変えない', () => {
  const doc = [
    '<meta name="keywords" content="名古屋,業界人">',
    OLD_INTRO,
    OLD_HEADING,
    '<p>本文は触らない。業界人の目で読む。</p>',
    '',
  ].join('\n');
  const r1 = rewriteText(doc, ['heading']);
  assert.ok(r1.text.includes(NEW_HEADING.trim()) && r1.text.includes('<meta name="keywords" content="名古屋">') && r1.text.includes(NEW_INTRO));
  assert.ok(r1.text.includes('<p>本文は触らない。業界人の目で読む。</p>'), 'heading 段階は本文に触れない');
  const r2 = rewriteText(r1.text, ['heading']);
  assert.equal(r2.text, r1.text);
  assert.deepEqual(r2.stats, {});
});

function tmpRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-journal-'));
  fs.mkdirSync(path.join(root, 'journal'));
  for (const [name, html] of Object.entries(files)) fs.writeFileSync(path.join(root, 'journal', name), html);
  return root;
}

test('CLI: --check は書き換えが要るとき exit 1、--dry-run は書かない、実行後は --check が exit 0。記事以外（index.html）は見ない', () => {
  const art = `<html><head>\n<meta name="keywords" content="名古屋,業界人">\n</head><body>\n${OLD_INTRO}\n${OLD_HEADING}\n</body></html>\n`;
  const root = tmpRoot({ '2026-10-01-sample.html': art, 'index.html': art, '_template.html': art });
  const quiet = () => {};
  assert.equal(main(['--phase', 'heading', '--check', '--root', root], quiet), 1);
  assert.equal(main(['--phase', 'heading', '--dry-run', '--root', root], quiet), 0);
  assert.equal(fs.readFileSync(path.join(root, 'journal', '2026-10-01-sample.html'), 'utf8'), art, 'dry-run は書かない');
  assert.equal(main(['--phase', 'heading', '--root', root], quiet), 0);
  const after = fs.readFileSync(path.join(root, 'journal', '2026-10-01-sample.html'), 'utf8');
  assert.ok(after.includes(NEW_HEADING.trim()) && after.includes(NEW_INTRO) && !after.includes('業界人'));
  assert.equal(fs.readFileSync(path.join(root, 'journal', 'index.html'), 'utf8'), art, '記事以外は触らない');
  assert.equal(fs.readFileSync(path.join(root, 'journal', '_template.html'), 'utf8'), art, 'テンプレートは触らない');
  assert.equal(main(['--phase', 'heading', '--check', '--root', root], quiet), 0, '2 回目は何も変えない');
  assert.throws(() => main(['--root', root], quiet), /--phase が要る/);
  assert.throws(() => main(['--phase', 'nope', '--root', root], quiet), /知らない段階/);
});

test('公開済みの全記事: 区画の見出しと導入の 1 行に、人が選んだと読める言い方が戻っていない（P-369）', () => {
  const dir = path.join(ROOT, 'journal');
  const bad = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^20\d\d-\d\d-\d\d-.+\.html$/.test(x))) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/Inside Perspective — 業界人/.test(t)) bad.push(`${f}: 見出し`);
    if (/名古屋の厳選[^<]{1,12}?店(?:超)?を業界視点で紹介する/.test(t)) bad.push(`${f}: 導入の 1 行`);
    if (t.includes('(業界人視点を記述)')) bad.push(`${f}: 未記入の仮の文`);
  }
  assert.deepEqual(bad, [], '新しい記事は journal/_template.html と add_journal_site_intro.js が新しい言い方で作る。古い言い方が戻っている');
});
