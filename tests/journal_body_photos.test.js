'use strict';
/**
 * ジャーナルの本文写真（art-body-img）— 配置と帰属の判定
 *
 * 写真を増やしたぶん「その記事の店の写真か」を検証しない経路が増えていないことを確かめる。
 * 判定器はヒーローと共有（scripts/lib/hero_photo_gate.js）なので、ここでは
 * 本文写真の経路がその判定器を実際に通っていることを検査する。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JP = require(path.join(ROOT, 'scripts/lib/journal_photos.js'));
const { judgePhoto, extractBodyPhotosFromHtml, loadPolicy } = require(path.join(ROOT, 'scripts/lib/hero_photo_gate.js'));
const { loadStores } = require(path.join(ROOT, 'scripts/lib/load_stores.js'));
const { extractStores } = require(path.join(ROOT, 'scripts/add_journal_body_photos.js'));

const ARTICLE = { slug: '2026-09-21-test', date: '2026-09-21' };

function twoStoresWithPhotos() {
  const withPhoto = loadStores().filter(s => /imgfp\.hotp\.jp/.test(String(s['写真URL'] || '')));
  return [withPhoto[0], withPhoto.find(s => s['店名'] !== withPhoto[0]['店名'])];
}

test('policy: bodyPhotos の目安枚数は2枚以上（写真1枚のままにしない）', () => {
  const p = loadPolicy().bodyPhotos;
  assert.ok(p, 'data/journal_photo_policy.json に bodyPhotos が必要');
  assert.ok(p.targetTotal >= 2, `targetTotal=${p.targetTotal}`);
  assert.ok(p.maxTotal >= p.targetTotal);
});

test('配置: 見出しのある記事では最初の見出しの手前に置かない（ヒーロー直下に写真を重ねない）', () => {
  const body = '<p>a</p>\n<h2>A</h2>\n<p>b</p>\n<h2>B</h2>\n<p>c</p>\n<h2>C</h2>\n<p>d</p>';
  const anchors = JP.planAnchors(body, 2);
  assert.strictEqual(anchors.length, 2);
  const firstH2 = body.indexOf('<h2>');
  assert.ok(anchors.every(a => a > firstH2), '最初の見出しより後ろに置く');
});

test('配置: 見出しの無い記事でも段落の切れ目に散る（先頭段落の直後は避ける）', () => {
  const body = ['<p>p1</p>', '<p>p2</p>', '<p>p3</p>', '<p>p4</p>', '<p>p5</p>'].join('\n');
  const anchors = JP.planAnchors(body, 2);
  assert.strictEqual(anchors.length, 2);
  const firstEnd = body.indexOf('</p>') + 4;
  assert.ok(anchors.every(a => a > firstEnd), '先頭段落の直後には置かない');
  assert.ok(anchors[1] - anchors[0] > 0, '同じ位置に重ねない');
});

test('挿入: 本文の順序を壊さず figure が入る', () => {
  const body = '<p>a</p>\n<h2>A</h2>\n<p>b</p>\n<h2>B</h2>\n<p>c</p>';
  const fig = '<figure class="art-body-img"><img src="x"></figure>';
  const res = JP.insertIntoBody(body, [fig]);
  assert.strictEqual(res.inserted, 1);
  assert.ok(res.html.includes(fig));
  // 元の本文はすべて残る
  for (const frag of ['<p>a</p>', '<h2>A</h2>', '<p>b</p>', '<h2>B</h2>', '<p>c</p>']) {
    assert.ok(res.html.includes(frag), frag);
  }
});

test('出所を書けない写真は figure にしない（載せない）', () => {
  assert.strictEqual(JP.figureHtml({ url: 'https://example.com/a.jpg', storeName: 'テスト店' }), null);
});

test('figure は帰属の証跡を刻み、監査側がそれを読み戻せる', () => {
  const [a] = twoStoresWithPhotos();
  const fig = JP.figureHtml({
    url: a['写真URL'], source: 'hotpepper', storeName: a['店名'],
    creditName: '店舗公式写真', creditUrl: 'https://www.hotpepper.jp',
  });
  const html = `<div class="art-body">${fig}</div><h3 class="store-name">${a['店名']}</h3>`;
  const [read] = extractBodyPhotosFromHtml(html, ARTICLE.slug, ARTICLE.date);
  assert.strictEqual(read.heroUrl, a['写真URL']);
  assert.strictEqual(read.heroSource, 'hotpepper');
  assert.strictEqual(read.heroStore, a['店名']);
  assert.strictEqual(judgePhoto(read).ok, true);
});

// 後追いスクリプトは、記事の h3（エスケープ済みの文字）から店名を取り出して figureHtml（esc 1回）へ渡す。
// 取り出した店名のエスケープを戻さないと二重になり（Chef&amp;#39;s）、画面にそのまま出る（2026-08-28 の記事）。
const ENTITY_ARTICLE = `<div class="art-body"><p>本文</p></div>
<div class="store-list">
  <div class="store-card" data-store-id="J000000001">
    <div class="store-num">01</div>
    <div class="store-info">
      <h3 class="store-name">ホテル Chef&#39;s Kitchen &amp; Bar &quot;A&quot;</h3>
      <div class="store-meta"><span>各国料理</span><span>名古屋 &amp; 栄</span><span class="score">★3.9</span></div>
    </div>
  </div>
  <div class="store-card" data-store-id="J000000002">
    <div class="store-info">
      <h3 class="store-name">普通の店</h3>
      <div class="store-meta"><span>居酒屋</span><span>名古屋駅</span></div>
    </div>
  </div>
</div>`;
const DOUBLE_ESCAPED = /&amp;(?:amp|lt|gt|quot|apos|#\d+|#[xX][0-9a-fA-F]+);/;

test('後追いスクリプト: 記事の店名は素の文字に戻して取り出す', () => {
  assert.deepStrictEqual(extractStores(ENTITY_ARTICLE).map(({ name, id }) => ({ name, id })), [
    { name: `ホテル Chef's Kitchen & Bar "A"`, id: 'J000000001' },
    { name: '普通の店', id: 'J000000002' },
  ]);
});

test('後追いスクリプト: エリアも素の文字に戻す（メタが見出しの前にある並びで読めたとき）', () => {
  // 今のテンプレートはメタが h3 の後ろにあり、エリアはデータ側（エリア列）から引く。
  // メタが見出しの前にある並びを読めたときの値も、店名と同じく素の文字にそろえておく。
  const html = `<div class="store-card" data-store-id="J000000003"><span>各国料理</span><span>名古屋 &amp; 栄</span>
    <h3 class="store-name">店</h3></div>`;
  assert.deepStrictEqual(extractStores(html), [{ name: '店', id: 'J000000003', area: '名古屋 & 栄' }]);
});

test('後追いスクリプト: 取り出した店名で作った figure は、エスケープが1回だけ（二重にならない）', () => {
  const [s] = extractStores(ENTITY_ARTICLE);
  const fig = JP.figureHtml({
    url: 'https://imgfp.hotp.jp/IMGH/00/00/P000000000/P000000000.jpg', source: 'hotpepper',
    storeName: s.name, area: '名古屋 & 栄', creditName: '店舗公式写真', creditUrl: 'https://www.hotpepper.jp',
  });
  assert.doesNotMatch(fig, DOUBLE_ESCAPED);
  assert.match(fig, /data-photo-store="ホテル Chef&#39;s Kitchen &amp; Bar &quot;A&quot;"/);
  assert.match(fig, /alt="ホテル Chef&#39;s Kitchen &amp; Bar &quot;A&quot;（名古屋 &amp; 栄）の店舗写真"/);
  // 監査側（記事の h3 は同じエスケープ済みの文字）から読み戻すと、店名が記事の店と一致する
  const html = `<div class="art-body">${fig}</div>${ENTITY_ARTICLE}`;
  const [read] = extractBodyPhotosFromHtml(html, ARTICLE.slug, ARTICLE.date);
  assert.strictEqual(read.heroStore, 'ホテル Chef&#39;s Kitchen &amp; Bar &quot;A&quot;');
  assert.ok(read.storeNames.includes(read.heroStore), '図の店名の証跡が、記事の h3 の書き方と同じ');
  assert.strictEqual(judgePhoto(read).ok, true);
});

test('2026-08-28 の記事: 本文写真の店名の証跡・代替テキスト・出所の表示が二重エスケープされていない', () => {
  // 後追いスクリプトで挿した記事。全記事を走査するテストにはしない（日次で増える記事に引きずられて
  // build の npm test を止めないため）。直した1本だけを固定して見る。
  const html = fs.readFileSync(path.join(ROOT, 'journal', '2026-08-28-meieki-autumn-sweets-weekday.html'), 'utf8');
  const figs = [...html.matchAll(/<figure class="art-body-img"[\s\S]*?<\/figure>/g)].map(m => m[0]);
  assert.ok(figs.length >= 1, '本文写真が残っている');
  for (const fig of figs) assert.doesNotMatch(fig, DOUBLE_ESCAPED);
  assert.ok(figs.some(f => f.includes("Chef&#39;s Live Kitchen")), '店名に \' を含む店の写真が 1 枚はある（確認の前提）');
});

test('記事に出てこない店の写真は本文写真でも FAIL（ヒーローと同じ基準）', () => {
  const [a, b] = twoStoresWithPhotos();
  const verdict = JP.judgeBodyPhoto(
    { url: b['写真URL'], source: 'hotpepper', storeName: b['店名'] },
    { ...ARTICLE, storeNames: [a['店名']] }
  );
  assert.strictEqual(verdict.ok, false);
  assert.ok(verdict.findings.some(f => f.code === 'hero_store_mismatch'));
});

test('出所の自己申告では照合を回避できない（URL側で判定する）', () => {
  const [a, b] = twoStoresWithPhotos();
  // 他店の HotPepper 画像に「places」と書いて、自店名の証跡を添えたケース
  const verdict = judgePhoto({
    role: 'body', ...ARTICLE,
    heroUrl: b['写真URL'], heroSource: 'places', heroStore: a['店名'],
    storeNames: [a['店名']],
  });
  assert.strictEqual(verdict.ok, false, '宣言を信じると素通りしてしまう');
  assert.ok(verdict.findings.some(f => f.code === 'source_attr_mismatch'));
});

test('屋号が一般語で消える店名でも、同じ店は一致し別の店は一致しない', () => {
  // core() は「升半茶店 本店」を空にする（[^\s]{1,6}店 と 本店）。空どうしを不一致にすると
  // 記事の店そのものの写真が hero_store_mismatch で落ちていた（2026-09-27 記事）。
  const base = { role: 'body', ...ARTICLE, heroUrl: 'https://lh3.googleusercontent.com/place-photos/x', heroSource: 'places' };
  assert.strictEqual(judgePhoto({ ...base, heroStore: '升半茶店 本店', storeNames: ['升半茶店 本店'] }).ok, true);
  const other = judgePhoto({ ...base, heroStore: '丸八茶店 本店', storeNames: ['升半茶店 本店'] });
  assert.strictEqual(other.ok, false);
  assert.ok(other.findings.some(f => f.code === 'hero_store_mismatch'));
});

test('公開済み記事: 本文写真は記事の店に帰属している（退行検知）', () => {
  const dir = path.join(ROOT, 'journal');
  const files = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f));
  const bad = [];
  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const bp of extractBodyPhotosFromHtml(html, slug, slug.slice(0, 10))) {
      const v = judgePhoto(bp);
      if (!v.ok) bad.push(`${slug}: ${v.findings.filter(x => x.level === 'fail').map(x => x.code).join(',')}`);
    }
  }
  assert.deepStrictEqual(bad, []);
});
