'use strict';

/**
 * tests/heading_levels.test.js — I-26f「見出しの階層が飛ばない」の決まり（計画 U-78）
 *
 * 直す前は、公開ページ 19 本で見出しの段が飛んでいた:
 *   - 特集 4 本（become-reviewer・editorial-policy・no-fake-reviews・nagoya-solo-dining）: h2 の次に h4
 *   - 日次ジャーナル 15 本: 本文に h2 が無く、h1 の次に店名の h3
 * 画面の読み上げは見出しの一覧を階層で辿るので、段が飛ぶと「親の無い見出し」になる。
 *
 * ここで確かめること:
 *   ① 判定器（scripts/lib/heading_levels.js）の約束
 *   ② 日次ジャーナルの生成器: 店の一覧の先頭に見えない h2 を書く。本文に h2 が無くても有っても飛ばない
 *   ③ 直した 19 本（ファイル名を決め打ちで）。ディレクトリを全部走査しない: 日次で増える記事を見ると、
 *      1本の崩れで build.yml の npm test（再生成の前に回る）が止まる。全体の見張りは夜間QA の heading-levels（soft）が持つ
 *   ④ 見えない見出しが見えてしまわないための CSS（nb.css）と、監査 CLI・夜間QA への登録
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const { outline, findJumps, stripNonContent } = require(path.join(SCRIPTS, 'lib', 'heading_levels.js'));
const audit = require(path.join(SCRIPTS, 'audit_heading_levels.js'));
const { renderHtml, buildStores, STORE_LIST_HEADING } = require(path.join(SCRIPTS, 'generate_daily_draft.js'));

// ══ ① 判定器 ═══════════════════════════════════════════════════════════════════
test('findJumps: 1段ずつ深くなる・同じ段・浅くなる、は飛びではない', () => {
  assert.deepEqual(findJumps('<h1>a</h1><h2>b</h2><h3>c</h3><h3>d</h3><h2>e</h2><h3>f</h3>'), []);
  assert.deepEqual(findJumps('<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h2>e</h2><h1>f</h1>'), []);
  assert.deepEqual(findJumps('<h1>a</h1>'), []);
  assert.deepEqual(findJumps('<p>見出しの無いページ</p>'), []);
});

test('findJumps: 2段以上深くなる所が飛び（h1→h3・h2→h4）。浅くなってから再び飛んでも数える', () => {
  assert.deepEqual(findJumps('<h1>a</h1><h3>店名</h3>'), [{ from: 1, to: 3, text: '店名' }]);
  assert.deepEqual(findJumps('<h1>a</h1><h2>b</h2><h4>c</h4>'), [{ from: 2, to: 4, text: 'c' }]);
  const j = findJumps('<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2><h4>e</h4>');
  assert.equal(j.length, 1);
  assert.deepEqual(j[0], { from: 2, to: 4, text: 'e' });
});

test('findJumps: ページの最初の見出しが h1 でないときも飛び（from=0）', () => {
  assert.deepEqual(findJumps('<h2>a</h2><h3>b</h3>'), [{ from: 0, to: 2, text: 'a' }]);
});

test('outline: script・style・コメント・template の中の見出しは数えず、中のタグは文字にしない', () => {
  const html = '<h1>題<em>名</em></h1><script>var s="<h4>x</h4>"</script><style>h4{}</style><!-- <h5>c</h5> --><template><h6>t</h6></template><h2> 節\n  名 </h2>';
  assert.deepEqual(outline(html), [{ level: 1, text: '題名' }, { level: 2, text: '節 名' }]);
  assert.equal(stripNonContent(html).includes('h4'), false);
  assert.deepEqual(findJumps(html), []);
});

test('outline: 属性つきの見出しも拾う（class・id）', () => {
  assert.deepEqual(outline('<h1 class="art-title">a</h1><h2 class="visually-hidden" id="x">b</h2>').map((h) => h.level), [1, 2]);
});

// ══ ② 日次ジャーナルの生成器 ═══════════════════════════════════════════════════
const STORES = [
  { name: 'テスト食堂', genre: '食堂', area: '名駅', desc: '説明', score: '' },
  { name: '二軒目の店', genre: '居酒屋', area: '栄', desc: '説明', score: '' },
];
const article = (body, stores = STORES) => renderHtml({
  title: 'テスト記事', description: '説明', slug: '2026-10-12-test', date: '2026-10-12', lead: 'リード',
  theme: 'today_one', body_html: body, stores, sources: [], insider_points: ['要点'],
});

test('buildStores: 先頭に見えない h2 を書く。店が無い回は何も書かない', () => {
  const html = buildStores(STORES);
  assert.ok(html.trimStart().startsWith(STORE_LIST_HEADING), '先頭が見えない h2');
  assert.equal(STORE_LIST_HEADING, '<h2 class="visually-hidden">紹介した店</h2>');
  assert.equal((html.match(/class="visually-hidden"/g) || []).length, 1, '見えない h2 は1つ（店ごとには付けない）');
  assert.equal((html.match(/<h3 class="store-name">/g) || []).length, 2);
  assert.equal(buildStores([]), '');
  assert.equal(buildStores(null), '');
});

test('renderHtml: 本文に h2 が無い回でも、見出しの階層が飛ばない（h1 → 見えない h2 → 店名の h3）', () => {
  const html = article('<p>本文は段落だけ。</p>');
  assert.deepEqual(findJumps(html), []);
  const heads = outline(html).filter((h) => h.level <= 3).map((h) => `${h.level}:${h.text}`);
  const i = heads.indexOf('2:紹介した店');
  assert.ok(i > 0, `見えない h2 がある: ${heads.join(' | ')}`);
  assert.equal(heads[i - 1].startsWith('1:'), true, '直前は h1');
  assert.deepEqual(heads.slice(i + 1, i + 3), ['3:テスト食堂', '3:二軒目の店']);
});

test('renderHtml: 本文に h2 がある回でも飛ばず、店名の h3 は本文の最後の節の子にならない', () => {
  const html = article('<h2>最初の節</h2><p>a</p><h2>最後の節</h2><p>b</p>');
  assert.deepEqual(findJumps(html), []);
  const heads = outline(html).filter((h) => h.level <= 3).map((h) => `${h.level}:${h.text}`);
  const last = heads.indexOf('2:最後の節');
  assert.equal(heads[last + 1], '2:紹介した店', '店の一覧は自分の節');
  assert.equal(heads[last + 2], '3:テスト食堂');
});

test('renderHtml: 見えない h2 は店の一覧（div.store-list）の中の先頭、最初の店カードの前にある', () => {
  const html = article('<p>本文</p>');
  const open = html.indexOf('<div class="store-list">');
  const hidden = html.indexOf(STORE_LIST_HEADING);
  const card = html.indexOf('<div class="store-card"');
  assert.ok(open > 0 && open < hidden && hidden < card, `${open} < ${hidden} < ${card}`);
  // 本文写真の挿し位置を決める部品は本文だけを見る（店の一覧の中の h2 は候補にならない）
  const body = html.slice(html.indexOf('<div class="art-body">'), open);
  assert.equal(body.includes('visually-hidden'), false);
});

test('renderHtml: 店が無い回は見えない h2 も出さない（空の節を作らない）', () => {
  const html = article('<p>本文</p>', []);
  assert.equal(html.includes('visually-hidden">紹介した店'), false);
  assert.deepEqual(findJumps(html), []);
});

// ══ ③ 直した 19 本 ═════════════════════════════════════════════════════════════
const FIXED_FEATURES = ['become-reviewer', 'editorial-policy', 'no-fake-reviews', 'nagoya-solo-dining'];
const FIXED_JOURNALS = [
  '2026-04-25-wakamaru-akita-sakae', '2026-05-12-katteguchi-kawachiya-marunouchi', '2026-05-23-yakisoba-stand-rafu-tsuruzato',
  '2026-05-26-risho-bettei-meieki', '2026-06-04-tebasaki-summit-yotteba-meieki', '2026-06-25-kisoji-kawaramachi-hokkaido-matsuri',
  '2026-06-26-portama-haera-nimousaku', '2026-06-27-karamen-hanabi-shinsakae', '2026-07-16-unafuji-taikoguchi-doyo',
  '2026-09-04-meieki-shokudo-tomoru-sanma-price', '2026-09-11-sakae-mirai-tower-tsukimi-date-lastorder',
  '2026-09-15-imaike-okute-yamamotoya-misonikomi-export', '2026-09-18-sakae-akizake-fes-2026-coin-price',
  '2026-09-27-marunouchi-masuhan-matcha-price', '2026-09-28-arahata-tonkatsu-nakayoshi-lunch1200',
];

test('直した特集 4 本: 見出しが飛ばず、h4 が残っていない（CSS の選択子も h3 に合わせてある）', () => {
  for (const slug of FIXED_FEATURES) {
    const html = read(`features/${slug}.html`);
    assert.deepEqual(findJumps(html), [], slug);
    assert.equal(/<h4[\s>]/.test(html), false, `${slug}: h4 が残っている`);
    assert.equal(/\bh4\s*\{/.test(html), false, `${slug}: h4 の CSS が残っている`);
  }
  // 小見出しの見た目は、グローバルの h3 の余白・色に負けないよう、上の余白を 0 と明示して持つ
  assert.match(read('features/become-reviewer.html'), /\.sub-principle h3\{[^}]*margin:0 0 \.35rem/);
  assert.match(read('features/no-fake-reviews.html'), /\.sub-principle h3\{[^}]*margin:0 0 \.35rem/);
  assert.match(read('features/editorial-policy.html'), /\.sub-principle h3\{[^}]*margin:0 0 \.35rem/);
  assert.match(read('features/nagoya-solo-dining.html'), /\.type-card h3\{[^}]*margin:0 0 \.3rem/);
});

test('直した日次ジャーナル 15 本: 見出しが飛ばない', () => {
  for (const slug of FIXED_JOURNALS) assert.deepEqual(findJumps(read(`journal/${slug}.html`)), [], slug);
});

test('直した日次ジャーナル: 店名は h3 のまま（`<h3 class="store-name">` を文字で探す道具が壊れない）', () => {
  for (const slug of FIXED_JOURNALS) {
    const html = read(`journal/${slug}.html`);
    assert.ok(/<h3 class="store-name">/.test(html), `${slug}: 店名の h3`);
    assert.equal(/<h2 class="store-name"/.test(html), false, slug);
  }
});

test('2026-05-12 以外の 14 本は見えない h2 を店の一覧の先頭に持ち、2026-05-12 は本文の見出し ①②③ が h2', () => {
  for (const slug of FIXED_JOURNALS) {
    const html = read(`journal/${slug}.html`);
    if (slug.startsWith('2026-05-12')) {
      assert.equal((html.match(/<h2>[①②③]/g) || []).length, 3, '本文の ①②③ が h2');
      assert.equal(/<h3>[①②③]/.test(html), false);
    } else {
      assert.match(html, /<div class="store-list">\n[ \t]*\n      <h2 class="visually-hidden">紹介した店<\/h2>\n[ \t]*<div class="store-card"/, slug);
    }
  }
});

// ══ ④ 見えない見出し・監査・夜間QA ═════════════════════════════════════════════
test('nb.css: 見えない h2 は .art-body h2 の余白・上線に負けない', () => {
  const css = read('assets/css/nb.css');
  assert.match(css, /\.visually-hidden,\.sr-only\{[^}]*position:absolute;[^}]*clip:rect\(0,0,0,0\)/);
  const m = css.match(/\.art-body h2\.visually-hidden[^{]*\{([^}]*)\}/);
  assert.ok(m, '.art-body h2.visually-hidden の規則がある');
  for (const decl of ['margin:-1px', 'padding:0', 'border:0']) assert.ok(m[1].includes(decl), decl);
});

function makeRoot(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i26f-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
const page = (body) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`;

test('audit: 飛ぶページだけを数え、種別ごとに分け、--check は飛ぶページがあれば exit 1', () => {
  const dir = makeRoot({
    'index.html': page('<h1>a</h1><h2>b</h2>'),
    'features/ok.html': page('<h1>a</h1><h2>b</h2><h3>c</h3>'),
    'features/bad.html': page('<h1>a</h1><h2>b</h2><h4>c</h4>'),
    'journal/2026-10-12-bad.html': page('<h1>a</h1><h3>店</h3>'),
    'journal/_template.html': page('<h1>a</h1><h3>補助ページは数えない</h3>'),
  });
  try {
    const r = audit.audit({ root: dir });
    assert.equal(r.ok, false);
    assert.equal(r.pages_with_jumps, 2);
    assert.deepEqual(r.by_section, { features: 1, journal: 1 });
    assert.deepEqual(r.pages.map((p) => p.file).sort(), ['features/bad.html', 'journal/2026-10-12-bad.html']);
    const only = audit.audit({ root: dir, only: 'journal' });
    assert.equal(only.pages_with_jumps, 1);
    const cli = spawnSync('node', [path.join(SCRIPTS, 'audit_heading_levels.js'), '--root', dir, '--check'], { encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /features\/bad\.html/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('audit: 飛ぶページが無ければ --check は exit 0', () => {
  const dir = makeRoot({ 'features/ok.html': page('<h1>a</h1><h2>b</h2>') });
  try {
    const cli = spawnSync('node', [path.join(SCRIPTS, 'audit_heading_levels.js'), '--root', dir, '--check'], { encoding: 'utf8' });
    assert.equal(cli.status, 0);
    assert.match(cli.stdout, /飛ぶページ: 0 本/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('audit: --only に知らない区分を渡すと exit 2', () => {
  const cli = spawnSync('node', [path.join(SCRIPTS, 'audit_heading_levels.js'), '--only', 'nothing'], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
});

test('夜間QA: heading-levels が soft で載り、監査を --check で呼ぶ', () => {
  const qa = read('scripts/nightly_qa.js');
  const i = qa.indexOf("id: 'heading-levels'");
  assert.ok(i > 0, '夜間QA に載っている');
  const block = qa.slice(i, qa.indexOf('});', i));
  assert.ok(block.includes('hard: false'), 'soft');
  assert.ok(block.includes('alwaysShow: true'), '報告に常に載る');
  assert.ok(block.includes("['scripts/audit_heading_levels.js', '--check']"));
});
