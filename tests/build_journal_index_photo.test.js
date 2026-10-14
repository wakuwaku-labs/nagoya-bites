'use strict';
/**
 * tests/build_journal_index_photo.test.js — トップの「最新ジャーナル」カードに、記事の顔の写真と出所を添える部品（I-24・P-399）
 * scripts/build_journal_index.js の readCredit / readHeroPhoto / renderLatestCard / updateRootLatestSection
 *
 * 確かめること:
 *   1. 写真は記事自身の figure.art-hero-img から読む。data-hero-source が places / press / hotpepper で、
 *      店名・https の写真・出所のキャプションがそろうものだけ（ここで新しく選ばない）
 *   2. 出所（クレジット）は「テキストと https のリンクだけ」に作り直す。ほかのタグが混じるもの・javascript: のリンクは使わない
 *      （プレスリリース写真は発行企業名とリリースへのリンクが載せる条件。CLAUDE.md 写真ソース優先3）
 *   3. 読めない・形が違う・ファイルが無い記事は null＝文字だけのカード。例外を出さない（日次ジャーナルの処理を止めない）
 *   4. カードのリンクはタイトルだけ。クレジットのリンクと入れ子にならない
 *   5. 目印の間だけを最新 3 件で書き換える
 *
 * 日次の記事そのもの（本物の journal/*.html）の語や件数を数えるテストは置かない（ADR 0033 の取り決め）。
 * 見本は実際の記事（places / press / hotpepper）と同じ作りの小さな HTML。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BJI = require('../scripts/build_journal_index.js');

const FIG = {
  places: `  <figure class="art-hero-img" data-hero-source="places" data-hero-store="ひものや 官兵衛 伏見駅店">
  <img src="https://lh3.googleusercontent.com/grass-cs/AABkmLd3tP=s1600-w1200" alt="栄・伏見の干物定食" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">写真: <a href="https://www.google.com/maps/place/?q=place_id:ChIJFbXRgLx3A2ARa5S-tgY5dO0" target="_blank" rel="noopener">Mr,あゆきー</a> / <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a></figcaption>
</figure>`,
  press: `  <figure class="art-hero-img" data-hero-source="press" data-hero-store="なかがわ 街仲食堂 by ジーバーFOOD">
  <img src="https://prcdn.freetls.fastly.net/release_image/138955/30/138955-30-2df91f7fa8b8c153b9a50042f2a38130-639x427.png" alt="中川区の開店" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">写真: 提供 株式会社ジーバー（<a href="https://prtimes.jp/main/html/rd/p/000000030.000138955.html" target="_blank" rel="noopener">プレスリリース</a>より）</figcaption>
</figure>`,
  hotpepper: `  <figure class="art-hero-img" data-hero-source="hotpepper" data-hero-store="山本屋総本家 金シャチ横丁店">
  <img src="https://imgfp.hotp.jp/IMGH/64/36/P043876436/P043876436.jpg" alt="金シャチ横丁" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">写真: <a href="https://www.hotpepper.jp" target="_blank" rel="noopener">店舗公式写真</a> / <a href="https://www.hotpepper.jp" target="_blank" rel="noopener">HotPepper</a></figcaption>
</figure>`,
};
const page = (figure) => `<!DOCTYPE html><html lang="ja"><body><article><h1>題</h1>\n${figure}\n<p>本文</p></article></body></html>`;

function journalDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jphoto-'));
  for (const [slug, html] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${slug}.html`), html);
  return dir;
}
function withDir(files, fn) {
  const dir = journalDir(files);
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function maxAnchorDepth(html) {
  let depth = 0; let max = 0;
  for (const m of html.matchAll(/<a\b[^>]*>|<\/a>/g)) {
    if (m[0] === '</a>') depth--; else { depth++; max = Math.max(max, depth); }
  }
  return { max, end: depth };
}

// ── 1・2. 出所（クレジット） ─────────────────────────────────────────
test('readCredit: 客の投稿写真・プレスリリース・店舗公式写真の出所を、テキストと https のリンクだけで作り直す', () => {
  const inner = (name) => FIG[name].match(/<figcaption class="art-img-credit">([\s\S]*?)<\/figcaption>/)[1];
  assert.strictEqual(
    BJI.readCredit(inner('places')),
    '写真: <a href="https://www.google.com/maps/place/?q=place_id:ChIJFbXRgLx3A2ARa5S-tgY5dO0" target="_blank" rel="noopener">Mr,あゆきー</a> / <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  );
  const press = BJI.readCredit(inner('press'));
  assert.ok(press.startsWith('写真: 提供 株式会社ジーバー（<a href="https://prtimes.jp/main/html/rd/p/000000030.000138955.html"'), press);
  assert.ok(press.endsWith('>プレスリリース</a>より）'), '発行企業名とリリースへのリンクが残る');
  assert.ok(BJI.readCredit(inner('hotpepper')).includes('店舗公式写真'));
});

test('readCredit: 記号は戻してから 1 回だけ逃がす（&amp; が二重にならない・&lt; は文字のまま）', () => {
  const out = BJI.readCredit('写真: <a href="https://example.com/?a=1&amp;b=2">A&amp;B &lt;店&gt;</a>');
  assert.strictEqual(out, '写真: <a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener">A&amp;B &lt;店&gt;</a>');
  assert.ok(!out.includes('&amp;amp;'));
  // リンクの外のテキストでも同じ
  const plain = BJI.readCredit('写真: 提供 A&amp;B &lt;社&gt;（<a href="https://example.com/">リリース</a>より）');
  assert.strictEqual(plain, '写真: 提供 A&amp;B &lt;社&gt;（<a href="https://example.com/" target="_blank" rel="noopener">リリース</a>より）');
});

test('readCredit: 余計なタグ・javascript: のリンク・入れ子・「写真」の無いものは使わない', () => {
  for (const bad of [
    '写真: <a href="javascript:alert(1)">店</a>',
    '写真: <a href="data:text/html,x">店</a>',
    '写真: <b>店</b>',
    '写真: <script>alert(1)</script>',
    '写真: <a href="https://example.com/"><b>店</b></a>',
    '写真: <img src="https://example.com/x.png">',
    '写真 < 提供',
    '写真: 店<',
    '店舗公式 / HotPepper',
    '<a href="https://example.com/">リンクだけ</a>',
    '',
    '   ',
    null,
    undefined,
  ]) {
    assert.strictEqual(BJI.readCredit(bad), null, String(bad));
  }
});

test('readCredit: リンクの余計な属性は引き継がない（onclick などを出力に持ち込まない）', () => {
  const out = BJI.readCredit('写真: <a onclick="steal()" href="https://example.com/x" style="x" data-a="1">店</a>');
  assert.strictEqual(out, '写真: <a href="https://example.com/x" target="_blank" rel="noopener">店</a>');
});

// ── 1・3. 記事から顔の写真を読む ─────────────────────────────────────
test('readHeroPhoto: 実際の記事と同じ作りの 3 種（places / press / hotpepper）から写真・店名・出所を読む', () => {
  withDir({ p: page(FIG.places), q: page(FIG.press), h: page(FIG.hotpepper) }, (dir) => {
    const p = BJI.readHeroPhoto('p', dir);
    assert.strictEqual(p.source, 'places');
    assert.strictEqual(p.store, 'ひものや 官兵衛 伏見駅店');
    assert.strictEqual(p.src, 'https://lh3.googleusercontent.com/grass-cs/AABkmLd3tP=s1600-w1200');
    assert.ok(p.credit.startsWith('写真: <a href="https://www.google.com/maps/place/'));
    const q = BJI.readHeroPhoto('q', dir);
    assert.strictEqual(q.source, 'press');
    assert.ok(q.credit.includes('株式会社ジーバー') && q.credit.includes('prtimes.jp'), '発行企業名とリリースのリンク');
    const h = BJI.readHeroPhoto('h', dir);
    assert.strictEqual(h.source, 'hotpepper');
    assert.strictEqual(h.src, 'https://imgfp.hotp.jp/IMGH/64/36/P043876436/P043876436.jpg');
  });
});

test('readHeroPhoto: 店名と写真の URL の &amp; は戻して返す（描くときに 1 回だけ逃がす）', () => {
  const fig = FIG.places
    .replace('data-hero-store="ひものや 官兵衛 伏見駅店"', 'data-hero-store="A &amp; B"')
    .replace('AABkmLd3tP=s1600-w1200', 'AAB?x=1&amp;y=2');
  withDir({ a: page(fig) }, (dir) => {
    const r = BJI.readHeroPhoto('a', dir);
    assert.strictEqual(r.store, 'A & B');
    assert.strictEqual(r.src, 'https://lh3.googleusercontent.com/grass-cs/AAB?x=1&y=2');
  });
});

test('readHeroPhoto: 読めないもの・形が違うものは null（文字だけのカードに戻す）で、例外を出さない', () => {
  const noFig = '<html><body><article><h1>題</h1><p>本文</p></article></body></html>';
  const bodyPhotoOnly = '<html><body><figure class="art-body-img"><img src="https://example.com/a.jpg"><figcaption>写真: 店</figcaption></figure></body></html>';
  const sub = (s, a, b) => s.replace(a, b);
  const cases = {
    noFig,
    bodyPhotoOnly,
    unknownSource: page(sub(FIG.places, 'data-hero-source="places"', 'data-hero-source="stock"')),
    noSourceAttr: page(sub(FIG.places, ' data-hero-source="places"', '')),
    noStoreAttr: page(sub(FIG.places, ' data-hero-store="ひものや 官兵衛 伏見駅店"', '')),
    emptyStore: page(sub(FIG.places, 'data-hero-store="ひものや 官兵衛 伏見駅店"', 'data-hero-store="  "')),
    noFigcaption: page(FIG.places.replace(/<figcaption[\s\S]*?<\/figcaption>/, '')),
    otherCaptionClass: page(sub(FIG.places, 'class="art-img-credit"', 'class="other"')),
    httpImg: page(sub(FIG.places, 'src="https://lh3', 'src="http://lh3')),
    relativeImg: page(sub(FIG.places, /src="https:\/\/[^"]+"/.exec(FIG.places)[0], 'src="/assets/x.jpg"')),
    dataImg: page(sub(FIG.places, /src="https:\/\/[^"]+"/.exec(FIG.places)[0], 'src="data:image/png;base64,AAAA"')),
    noImg: page(FIG.places.replace(/<img[^>]*>/, '')),
    creditWithoutShashin: page(sub(FIG.places, '写真: ', '')),
    creditWithScript: page(sub(FIG.places, 'Mr,あゆきー', '<script>x</script>')),
  };
  withDir(cases, (dir) => {
    for (const slug of Object.keys(cases)) assert.strictEqual(BJI.readHeroPhoto(slug, dir), null, slug);
    assert.strictEqual(BJI.readHeroPhoto('no-such-file', dir), null, 'ファイルが無い');
    assert.strictEqual(BJI.readHeroPhoto(undefined, dir), null);
    assert.strictEqual(BJI.readHeroPhoto('../' + path.basename(dir) + '/noFig', dir), null);
  });
  assert.strictEqual(BJI.readHeroPhoto('x', path.join(os.tmpdir(), 'jphoto-no-such-dir')), null, 'ディレクトリが無い');
});

// ── 4. カード ───────────────────────────────────────────────────────
const ENTRY = { slug: '2026-10-13-x', date: '2026-10-13', title: '干物定食 <おかわり> & "コスパ"', description: '説明 & <b>', theme: 'today_one' };
const PHOTO = { src: 'https://lh3.googleusercontent.com/a?x=1&y=2', store: 'A & B', source: 'places', credit: '写真: <a href="https://maps.google.com" target="_blank" rel="noopener">店</a> / <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>' };

test('renderLatestCard: 写真があるカード — 写真と出所、リンクはタイトルだけ、入れ子のリンクが無い', () => {
  const html = BJI.renderLatestCard(ENTRY, PHOTO);
  assert.ok(html.includes('<article class="latest-journal-card has-photo">'));
  assert.ok(html.includes('<figure class="ljc-photo">'));
  assert.ok(html.includes('<img class="ljc-img" src="https://lh3.googleusercontent.com/a?x=1&amp;y=2" alt="A &amp; B" width="480" height="320" loading="lazy" decoding="async"'), html);
  assert.ok(html.includes(`<figcaption class="ljc-credit">${PHOTO.credit}</figcaption>`), '出所は記事と同じ文');
  assert.ok(html.includes('<h3 class="ljc-title"><a class="ljc-link" href="journal/2026-10-13-x.html">干物定食 &lt;おかわり&gt; &amp; &quot;コスパ&quot;</a></h3>'), html);
  assert.ok(html.includes('<p class="ljc-desc">説明 &amp; &lt;b&gt;</p>'));
  assert.ok(html.includes('<span class="ljc-theme">今日の1軒</span>'));
  const d = maxAnchorDepth(html);
  assert.deepStrictEqual(d, { max: 1, end: 0 }, 'リンクが入れ子になっていない');
});

test('renderLatestCard: 記事の slug も属性の中で逃がす', () => {
  const html = BJI.renderLatestCard(Object.assign({}, ENTRY, { slug: 'a"b&c' }), null);
  assert.ok(html.includes('href="journal/a&quot;b&amp;c.html"'), html);
});

test('renderLatestCard: 写真が無いカード — 従来と同じ文字だけ（figure も has-photo も無い）', () => {
  const html = BJI.renderLatestCard(ENTRY, null);
  assert.ok(html.includes('<article class="latest-journal-card">'));
  assert.ok(!html.includes('has-photo') && !html.includes('<figure') && !html.includes('<img'));
  assert.ok(html.includes('class="ljc-link" href="journal/2026-10-13-x.html"'));
  assert.strictEqual(BJI.renderLatestCard(ENTRY).includes('<figure'), false, '第 2 引数なしでも文字だけ');
});

// ── 5. 目印の間の書き換え ───────────────────────────────────────────
const SKELETON = '<main>\nA\n      <!-- LATEST_JOURNAL_START -->OLD\n      <!-- LATEST_JOURNAL_END -->\nB\n</main>';
function withIndex(html, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jroot-'));
  const idx = path.join(dir, 'index.html');
  fs.writeFileSync(idx, html);
  try { return fn(idx); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const E = (date, slug, title) => ({ slug, date, title, description: title + 'の説明', theme: 'today_one' });

test('updateRootLatestSection: 新しい順の 3 件だけを目印の間へ。写真のある記事は写真つき、無い記事は文字だけ。外側は変えない', () => {
  withDir({ new1: page(FIG.places), new2: page(FIG.press), old: page(FIG.hotpepper) }, (jdir) => {
    withIndex(SKELETON, (idx) => {
      const entries = [E('2026-10-01', 'old', '古い'), E('2026-10-13', 'new1', '最新'), E('2026-10-12', 'new2', '次'), E('2026-10-11', 'noart', '記事のファイルが無い'), E('2026-09-01', 'older', 'もっと古い')];
      assert.strictEqual(BJI.updateRootLatestSection(entries, jdir, idx), true);
      const out = fs.readFileSync(idx, 'utf8');
      assert.ok(out.startsWith('<main>\nA\n      <!-- LATEST_JOURNAL_START -->'));
      assert.ok(out.endsWith('<!-- LATEST_JOURNAL_END -->\nB\n</main>'));
      const slugs = [...out.matchAll(/href="journal\/([^"]+)\.html"/g)].map((m) => m[1]);
      assert.deepStrictEqual(slugs, ['new1', 'new2', 'noart'], '日付の新しい順に 3 件');
      const cards = out.split('<article ').slice(1);
      assert.strictEqual(cards.length, 3);
      assert.ok(cards[0].includes('has-photo') && cards[0].includes('ひものや 官兵衛 伏見駅店'));
      assert.ok(cards[1].includes('has-photo') && cards[1].includes('プレスリリース'));
      assert.ok(!cards[2].includes('has-photo'), '記事のファイルが無ければ文字だけ');
      assert.ok(!out.includes('OLD'));
      assert.strictEqual(maxAnchorDepth(out).max, 1, '入れ子のリンクが無い');
      assert.strictEqual(maxAnchorDepth(out).end, 0);
      // 冪等
      BJI.updateRootLatestSection(entries, jdir, idx);
      assert.strictEqual(fs.readFileSync(idx, 'utf8'), out);
    });
  });
});

test('updateRootLatestSection: 記事が 0 件なら空に。目印が無い index.html は書き換えずに false', () => {
  withIndex(SKELETON, (idx) => {
    assert.strictEqual(BJI.updateRootLatestSection([], os.tmpdir(), idx), true);
    assert.strictEqual(fs.readFileSync(idx, 'utf8'), '<main>\nA\n      <!-- LATEST_JOURNAL_START -->\n      <!-- LATEST_JOURNAL_END -->\nB\n</main>');
  });
  withIndex('<main>目印なし</main>', (idx) => {
    assert.strictEqual(BJI.updateRootLatestSection([E('2026-10-13', 'x', 't')], os.tmpdir(), idx), false);
    assert.strictEqual(fs.readFileSync(idx, 'utf8'), '<main>目印なし</main>');
  });
});

test('buildList / buildFeed は今までどおり動く（呼び出し元の build.js が使う公開関数）', () => {
  assert.strictEqual(typeof BJI.buildList, 'function');
  assert.strictEqual(typeof BJI.buildFeed, 'function');
  assert.strictEqual(typeof BJI.main, 'function');
  assert.ok(BJI.buildList([]).includes('準備中'));
});
