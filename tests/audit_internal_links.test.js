'use strict';
// P-383: 公開ページの内部リンクのリンク先が実在するかを数える
// （2026-05 から 5 か月、一度も公開されていない記事へのリンクが 404 のまま公開されていた・P-382）
// 実際のページの件数は数えない（日次で増える特集・ジャーナルを npm test の合否にしない・判断の記録 0033）。
// 実ページの確認は夜間QA の internal-links（soft）が行う。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { extractHrefs, classifyHref, auditPages, targetExists, createFs } = require('../scripts/lib/internal_links');
const { listPublishedPages } = require('../scripts/lib/published_pages');

const CLI = path.join(__dirname, '..', 'scripts', 'audit_internal_links.js');

function makeSite(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'internal-links-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return root;
}

function audit(root, only) {
  return auditPages(listPublishedPages({ root, only: only || null }), root);
}

const OK = '<!doctype html><title>ok</title>';

test('実在する相対リンクは数えず、無いものだけを「ページ → リンク先」で返す', () => {
  const root = makeSite({
    'index.html': '<a href="features/a.html">特集</a><a href="features/missing.html">無い</a>',
    'features/a.html': OK,
  });
  const r = audit(root);
  assert.strictEqual(r.pages, 2);
  assert.strictEqual(r.internalLinks, 2);
  assert.deepStrictEqual(r.broken.map((x) => [x.page, x.target, x.count]), [['index.html', 'features/missing.html', 1]]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('同じページの同じリンク先は 1 行にまとめて回数を持つ。ページが違えば別の行', () => {
  const root = makeSite({
    'features/a.html': '<a href="gone.html">1</a><a href="gone.html">2</a><a href="./gone.html">3</a>',
    'features/b.html': '<a href="gone.html">1</a>',
  });
  const r = audit(root);
  const rows = Object.fromEntries(r.broken.map((x) => [x.page, x]));
  assert.strictEqual(r.broken.length, 2);
  assert.strictEqual(rows['features/a.html'].count, 3);
  assert.strictEqual(rows['features/a.html'].target, 'features/gone.html');
  assert.strictEqual(rows['features/b.html'].count, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('ディレクトリへのリンクは、その下の index.html があるときだけ実在とする', () => {
  const root = makeSite({
    'index.html': '<a href="features/">あり</a><a href="journal/">index が無い</a><a href="stores/area/">空</a><a href="./">トップ</a><a href=".">トップ</a>',
    'features/index.html': OK,
    'journal/2026-01-01-a.html': OK,
    'stores/area/x/y.html': OK,
  });
  const r = audit(root);
  assert.deepStrictEqual(r.broken.map((x) => x.target).sort(), ['journal/', 'stores/area/']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('# だけ・fragment つき・query つきの扱い（fragment と query は外して実在を見る）', () => {
  const root = makeSite({
    'index.html': [
      '<a href="#top">先頭</a>',
      '<a href="features/a.html#sec">節</a>',
      '<a href="features/a.html?x=1&amp;y=2">query</a>',
      '<a href="?area=池下">自分自身</a>',
      '<a href="index.html?area=池下">トップ</a>',
      '<a href="features/gone.html#sec">節だが無い</a>',
      '<a href="features/gone.html?x=1">queryだが無い</a>',
    ].join('\n'),
    'features/a.html': OK,
  });
  const r = audit(root);
  // 無いリンクは fragment・query を外した同じリンク先として 1 行にまとまる（2 回）
  assert.deepStrictEqual(r.broken.map((x) => [x.target, x.count]), [['features/gone.html', 2]]);
  assert.strictEqual(r.internalLinks, 5); // '#top' と '?area=…' だけは内部リンクに数えない
  fs.rmSync(root, { recursive: true, force: true });
});

test('外部 URL・mailto・tel・javascript・別ホストは数えない（自分のドメインの絶対 URL は数える）', () => {
  const root = makeSite({
    'index.html': [
      '<a href="https://example.com/x.html">外</a>',
      '<a href="//cdn.example.com/x.js">外</a>',
      '<a href="mailto:a@example.com">mail</a>',
      '<a href="tel:0521234567">tel</a>',
      '<a href="javascript:void(0)">js</a>',
      '<a href="https://nagoya-bites.example.com/x.html">似た別ドメイン</a>',
      '<a href="https://nagoya-bites.com/features/a.html">自分・あり</a>',
      '<a href="https://www.nagoya-bites.com/features/a.html">www・あり</a>',
      '<a href="https://nagoya-bites.com/features/gone.html">自分・無い</a>',
      '<a href="http://nagoya-bites.com/features/gone2.html?x=1#y">http・無い</a>',
      '<a href="https://nagoya-bites.com">トップ</a>',
      '<a href="https://nagoya-bites.com/">トップ</a>',
      '<a href="//nagoya-bites.com/features/gone3.html">プロトコル省略・無い</a>',
    ].join('\n'),
    'features/a.html': OK,
  });
  const r = audit(root);
  assert.deepStrictEqual(r.broken.map((x) => x.target).sort(), ['features/gone.html', 'features/gone2.html', 'features/gone3.html']);
  assert.strictEqual(r.internalLinks, 7);
  fs.rmSync(root, { recursive: true, force: true });
});

test('ルート相対（/…）と ../ の解決。ルートの外へ出るものは実在としない', () => {
  const root = makeSite({
    'index.html': OK,
    'about.html': OK,
    'features/a.html': '<a href="/about.html">ルート</a><a href="/features/gone.html">無い</a><a href="../about.html">上</a><a href="../../x.html">外へ出る</a><a href="../">トップ</a><a href="..">トップ</a>',
    'stores/J1.html': '<a href="../index.html">トップ</a><a href="./J2.html">となり</a>',
    'stores/J2.html': OK,
    'stores/area/x/y.html': '<a href="../../J1.html">店</a><a href="../../../about.html">about</a><a href="../../../../about.html">外へ出る</a>',
  });
  const r = audit(root);
  const targets = r.broken.map((x) => x.page + ' → ' + x.target).sort();
  assert.deepStrictEqual(targets, [
    'features/a.html → ../x.html',
    'features/a.html → features/gone.html',
    'stores/area/x/y.html → ../about.html',
  ]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('拡張子の無い URL は .html か index.html があれば実在（GitHub Pages が返すもの）', () => {
  const root = makeSite({
    'index.html': '<a href="about">about</a><a href="features/a">特集</a><a href="features">特集一覧</a><a href="nothing">無い</a><a href="logo.png">無い画像</a><a href="weird.png">.png.html だけある</a>',
    'about.html': OK,
    'weird.png.html': OK,
    'features/a.html': OK,
    'features/index.html': OK,
  });
  const r = audit(root);
  assert.deepStrictEqual(r.broken.map((x) => x.target).sort(), ['logo.png', 'nothing', 'weird.png']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('大文字小文字は区別する（GitHub Pages は区別する・macOS のファイルシステムは区別しない）', () => {
  const root = makeSite({
    'index.html': '<a href="Features/a.html">大文字</a><a href="features/A.html">大文字</a><a href="features/a.html">小文字</a>',
    'features/a.html': OK,
  });
  const r = audit(root);
  assert.deepStrictEqual(r.broken.map((x) => x.target).sort(), ['Features/a.html', 'features/A.html']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('日本語のファイル名は、% でエンコードされていてもそのままでも実在を見る', () => {
  const root = makeSite({
    'index.html': '<a href="journal/%E6%97%A5%E6%9C%AC.html">encoded</a><a href="journal/日本.html">raw</a><a href="journal/%E7%84%A1.html">無い</a><a href="journal/%ZZ.html">壊れた</a>',
    'journal/日本.html': OK,
  });
  const r = audit(root);
  assert.deepStrictEqual(r.broken.map((x) => x.target).sort(), ['journal/%ZZ.html', 'journal/無.html']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('<script>・<style>・コメントの中と、JS の文字列のつなぎ・テンプレートの残りは数えない', () => {
  const root = makeSite({
    'index.html': [
      '<!-- <a href="gone-in-comment.html">x</a> -->',
      '<style>/* <a href="gone-in-style.html">x</a> */ a[href="gone-in-selector.html"]{color:red}</style>',
      '<script>var h = \'<a href="gone-in-script.html">x</a>\'; el.innerHTML = \'<a href="\' + u + \'">y</a>\';</script>',
      '<script type="text/template"><a href="gone-in-template.html">x</a></script>',
      '<a href="\' + url + \'">つなぎ</a>',
      '<a href="{{ url }}">テンプレート</a>',
      '<a href="${url}">テンプレート</a>',
      '<a href="gone-real.html">本物の無いリンク</a>',
    ].join('\n'),
  });
  const r = audit(root);
  assert.deepStrictEqual(r.broken.map((x) => x.target), ['gone-real.html']);
  assert.strictEqual(r.internalLinks, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('属性の並び・引用符・改行の違いでも href を拾う。<a> 以外（link・area・img）は数えない', () => {
  const html = [
    '<a class="x" href="one.html">1</a>',
    "<a href='two.html'>2</a>",
    '<a\n  data-x="1"\n  href = "three.html"\n>3</a>',
    '<A HREF="four.html">4</A>',
    '<link rel="canonical" href="https://nagoya-bites.com/five.html">',
    '<img src="six.png"><area href="seven.html"><abbr href="eight.html">',
  ].join('\n');
  assert.deepStrictEqual(extractHrefs(html), ['one.html', 'two.html', 'three.html', 'four.html']);
  // HTML の文字参照（&amp;）は戻してから判定する
  assert.deepStrictEqual(extractHrefs('<a href="x.html?a=1&amp;b=2">x</a>'), ['x.html?a=1&b=2']);
});

test('classifyHref: 種類ごとの判定と、書いたページからの解決', () => {
  const t = (href, from) => classifyHref(href, from);
  assert.deepStrictEqual(t('', 'a.html'), { kind: 'skip', reason: 'empty' });
  assert.deepStrictEqual(t('#x', 'a.html'), { kind: 'skip', reason: 'fragment' });
  assert.deepStrictEqual(t('?a=1', 'a.html'), { kind: 'skip', reason: 'self' });
  assert.deepStrictEqual(t('mailto:x@y.z', 'a.html'), { kind: 'skip', reason: 'scheme' });
  assert.deepStrictEqual(t('https://example.com/a', 'a.html'), { kind: 'skip', reason: 'external' });
  assert.deepStrictEqual(t('b.html', 'a.html'), { kind: 'internal', target: 'b.html' });
  assert.deepStrictEqual(t('b.html', 'features/a.html'), { kind: 'internal', target: 'features/b.html' });
  assert.deepStrictEqual(t('../b.html?x=1#y', 'features/a.html'), { kind: 'internal', target: 'b.html' });
  assert.deepStrictEqual(t('/features/b.html', 'stores/area/x/y.html'), { kind: 'internal', target: 'features/b.html' });
  assert.deepStrictEqual(t('../', 'stores/J1.html'), { kind: 'internal', target: '' });
  assert.deepStrictEqual(t('../features/', 'stores/J1.html'), { kind: 'internal', target: 'features/' });
  assert.deepStrictEqual(t('https://nagoya-bites.com/journal/', 'a.html'), { kind: 'internal', target: 'journal/' });
  assert.deepStrictEqual(t('https://nagoya-bites.com', 'a.html'), { kind: 'internal', target: '' });
});

test('targetExists: ルートの外・空・ディレクトリ・拡張子なし', () => {
  const root = makeSite({ 'index.html': OK, 'about.html': OK, 'features/index.html': OK, 'journal/x.html': OK });
  const fsx = createFs(root);
  assert.strictEqual(targetExists(fsx, ''), true);
  assert.strictEqual(targetExists(fsx, 'features/'), true);
  assert.strictEqual(targetExists(fsx, 'features'), true);
  assert.strictEqual(targetExists(fsx, 'journal/'), false);
  assert.strictEqual(targetExists(fsx, 'journal'), false);
  assert.strictEqual(targetExists(fsx, 'about'), true);
  assert.strictEqual(targetExists(fsx, 'about.html'), true);
  assert.strictEqual(targetExists(fsx, 'journal/x'), true);
  assert.strictEqual(targetExists(fsx, '../about.html'), false);
  assert.strictEqual(targetExists(fsx, 'nothing.html'), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('走査の対象は公開ページだけ（先頭 _ の補助ページは見ない）。--only で絞れる', () => {
  const root = makeSite({
    'index.html': '<a href="gone-top.html">x</a>',
    'journal/_template.html': '<a href="gone-template.html">x</a>',
    'journal/a.html': '<a href="gone-journal.html">x</a>',
    'stores/area/x/y.html': '<a href="gone-hub.html">x</a>',
    'docs/memo.html': '<a href="gone-docs.html">x</a>',
  });
  assert.deepStrictEqual(audit(root).broken.map((x) => x.page).sort(), ['index.html', 'journal/a.html', 'stores/area/x/y.html']);
  assert.deepStrictEqual(audit(root, 'journal').broken.map((x) => x.page), ['journal/a.html']);
  assert.deepStrictEqual(audit(root, 'area').broken.map((x) => x.page), ['stores/area/x/y.html']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('CLI: --check は 1 件でもあれば exit 1、無ければ exit 0。--json は件数と一覧を返す', () => {
  const bad = makeSite({ 'index.html': '<a href="gone.html">x</a><a href="gone.html">y</a>', 'about.html': OK });
  const good = makeSite({ 'index.html': '<a href="about.html">x</a>', 'about.html': OK });
  const run = (root, ...args) => spawnSync(process.execPath, [CLI, '--root', root, ...args], { encoding: 'utf8' });

  const b = run(bad, '--check');
  assert.strictEqual(b.status, 1);
  assert.match(b.stdout, /index\.html → gone\.html ×2/);
  assert.match(b.stdout, /リンク先が無い内部リンク: 2 件/);
  assert.strictEqual(run(bad).status, 0); // --check が無ければ落とさない

  const g = run(good, '--check');
  assert.strictEqual(g.status, 0);
  assert.match(g.stdout, /リンク先が無い内部リンク: 0 件/);

  const j = JSON.parse(run(bad, '--json').stdout);
  assert.strictEqual(j.pages, 2);
  assert.strictEqual(j.brokenLinks, 2);
  assert.strictEqual(j.brokenTargets, 1);
  assert.strictEqual(j.brokenPages, 1);
  assert.deepStrictEqual(j.broken, [{ page: 'index.html', href: 'gone.html', target: 'gone.html', count: 2 }]);

  assert.strictEqual(run(bad, '--only', 'features', '--check').status, 0); // 絞った先には無い
  assert.strictEqual(run(bad, '--only', 'nope').status, 2);
  assert.strictEqual(spawnSync(process.execPath, [CLI, '--root', path.join(bad, 'no-such-dir')], { encoding: 'utf8' }).status, 2);
  fs.rmSync(bad, { recursive: true, force: true });
  fs.rmSync(good, { recursive: true, force: true });
});

test('夜間QA が internal-links を soft で回す（hard にするのは 0 件が続いてから）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'nightly_qa.js'), 'utf8');
  const i = src.indexOf("id: 'internal-links'");
  assert.ok(i > 0, 'nightly_qa.js に internal-links が無い');
  const block = src.slice(i, i + 500);
  assert.match(block, /hard: false/);
  assert.match(block, /audit_internal_links\.js', '--check'/);
});
