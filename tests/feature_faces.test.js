'use strict';
/**
 * tests/feature_faces.test.js — 特集の「顔」は図ではなく、その特集の掲載店の実写（Ondine #2097）
 *
 * 確かめること:
 *   1. lib: 決めた写真が今も掲載店のものなら使い、外れていたら先頭の店で代える（pinned=false）。顔を持たない特集は null
 *   2. 特集ページへの反映が冪等で、図は置き換え・顔の無い古い型には足し・手で入れた別の写真には触らない（replaceHero を除く）
 *   3. 特集一覧のカードは、図のカードと自分が出所を足したカードだけを直し、手で入れた写真のカードは触らない
 *   4. 実際のファイル: 顔を決めた特集はすべて、掲載店のホットペッパー写真・出所の文字・幅と高さがあり、図が顔に残っていない。
 *      顔は URL の参照だけ（自ホストの写真ファイルを作らない）・掲載店の写真を持たない特集（keepFigure）は図のまま
 *   5. 実際のトップの特集ストリップ: 図のカードが無く、写真のカードには出所の文字がある
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const F = require('../scripts/lib/feature_face');

const ROOT = path.resolve(__dirname, '..');
const cfg = {
  credit: 'ホットペッパーグルメ',
  faces: { demo: { store: '店A', photo: 'https://imgfp.hotp.jp/IMGH/11/11/P000000001/P000000001_480.jpg' } },
  replaceHero: ['replaced'],
  rejectedPhotos: ['P000000003'],
};
const card = (id, alt) => `<div class="store-card"><div class="store-photo"><img src="https://imgfp.hotp.jp/IMGH/00/00/${id}/${id}_480.jpg" alt="${alt}"></div></div>`;
const page = (hero, cards) => `<html><head><style>.art-hero-image{x:1}</style></head><body>\n<nav>パンくず</nav>\n<article>\n  ${hero}\n<div class="art-hero"><h1>題</h1></div>\n${cards}\n</article></body></html>`;
const FIG = '<div class="art-hero-image">\n  <img src="../assets/feature-figures/demo.svg" alt="x" loading="eager">\n</div>';
const HAND = '<div class="art-hero-image">\n  <img src="https://imgfp.hotp.jp/IMGH/99/99/P000000099/P000000099_480.jpg" alt="手で入れた">\n</div>';

test('resolveFace: 決めた写真が今も掲載店のものなら使う。外れたら先頭の店で代える。顔の無い特集は null', () => {
  const listed = page(FIG, card('P000000001', '店A') + card('P000000002', '店B'));
  assert.deepStrictEqual(F.resolveFace('demo', listed, cfg), { src: cfg.faces.demo.photo, store: '店A', pinned: true });
  // 大きさ違いの URL（_480 と原寸）でも写真の番号で同じ写真と見る
  const master = page(FIG, `<img src="https://imgfp.hotp.jp/IMGH/11/11/P000000001/P000000001.jpg" alt="店A">`);
  assert.strictEqual(F.resolveFace('demo', master, cfg).pinned, true);
  // 外れた: 先頭の店（rejectedPhotos の写真は飛ばす）
  const dropped = page(FIG, card('P000000003', '却下の店') + card('P000000002', '店B'));
  const r = F.resolveFace('demo', dropped, cfg);
  assert.strictEqual(r.pinned, false);
  assert.strictEqual(r.store, '店B');
  assert.strictEqual(F.resolveFace('nope', listed, cfg), null);
  // 今の顔の写真（art-hero-image・区画）は掲載店の写真に数えない
  const onlyHero = page(HAND, '');
  assert.strictEqual(F.resolveFace('demo', onlyHero, cfg), null);
});

test('applyHero: 図は区画に置き換え、冪等。出所の文字・幅と高さ・遅延しない・fetchpriority', () => {
  const html = page(FIG, card('P000000001', '店A'));
  const face = F.resolveFace('demo', html, cfg);
  const once = F.applyHero(html, face, cfg, 'demo');
  assert.ok(!once.includes('feature-figures/demo.svg'));
  assert.ok(once.includes(F.FACE_START) && once.includes(F.FACE_END));
  assert.ok(once.includes('<p class="art-hero-credit">写真: 店A（ホットペッパーグルメ）</p>'));
  assert.ok(/<img src="https:\/\/imgfp\.hotp\.jp\/[^"]+" alt="店Aの料理・店内" width="480" height="320" loading="eager" fetchpriority="high"/.test(once), once);
  assert.strictEqual(F.applyHero(once, F.resolveFace('demo', once, cfg), cfg, 'demo'), once, '冪等（区画の中身を作り直しても同じ）');
});

test('applyHero: 顔の無い古い型には hero の前に足す。手で入れた別の写真は触らない（replaceHero の特集だけ置き換える）', () => {
  const old = `<html><body>\n<nav>x</nav>\n<div class="hero"><h1>題</h1></div>\n${card('P000000001', '店A')}</body></html>`;
  const face = F.resolveFace('demo', old, cfg);
  const added = F.applyHero(old, face, cfg, 'demo');
  assert.ok(added.indexOf(F.FACE_START) < added.indexOf('<div class="hero">'), 'hero の前');
  const hand = page(HAND, card('P000000001', '店A'));
  assert.strictEqual(F.applyHero(hand, face, cfg, 'demo'), hand, '手で入れた別の写真には触らない');
  const replaced = F.applyHero(hand, face, cfg, 'replaced');
  assert.ok(replaced.includes(F.FACE_START) && !replaced.includes('P000000099'), 'replaceHero の特集は置き換える');
});

test('applyIndexCard: 図のカードと、自分が出所を足したカードだけを直す。手で入れた写真のカードは触らない', () => {
  const face = { src: cfg.faces.demo.photo, store: '店A' };
  const figCard = `<a class="article-card" href="demo.html">\n    <div class="card-badge">\n      <img class="card-img" src="../assets/feature-figures/demo.svg" alt="デモ" loading="lazy">\n    </div>\n    <div class="card-body">\n      <p class="card-desc">説明</p>\n    </div>\n  </a>`;
  const once = F.applyIndexCard(`<main>${figCard}</main>`, 'demo', face, cfg);
  assert.ok(once.includes(`src="${face.src}"`) && once.includes('<p class="card-photo-credit">写真: 店A（ホットペッパーグルメ）</p>'));
  assert.strictEqual(F.applyIndexCard(once, 'demo', face, cfg), once, '冪等');
  const handCard = figCard.replace('../assets/feature-figures/demo.svg', 'https://imgfp.hotp.jp/IMGH/99/99/P000000099/P000000099_480.jpg');
  assert.strictEqual(F.applyIndexCard(`<main>${handCard}</main>`, 'demo', face, cfg), `<main>${handCard}</main>`);
  assert.strictEqual(F.applyIndexCard('<main></main>', 'demo', face, cfg), '<main></main>', 'カードが無ければ何もしない');
});

test('実際のファイル: 顔を決めた特集は、掲載店の実写（URL の参照）と出所の文字を持ち、図が顔に残らない', () => {
  const real = F.loadConfig();
  const slugs = Object.keys(real.faces);
  assert.ok(slugs.length >= 20, `顔を決めた特集の数: ${slugs.length}`);
  for (const slug of slugs) {
    const html = fs.readFileSync(path.join(ROOT, 'features', `${slug}.html`), 'utf8');
    const m = html.match(new RegExp(`${F.FACE_START}([\\s\\S]*?)${F.FACE_END}`));
    assert.ok(m, `${slug}: 顔の区画がある`);
    const img = (m[1].match(/<img [^>]*>/) || [])[0] || '';
    assert.ok(/src="https:\/\/imgfp\.hotp\.jp\/IMGH\/[^"]+"/.test(img), `${slug}: ホットペッパー写真の参照`);
    assert.ok(/width="\d+" height="\d+"/.test(img) && /alt="[^"]+"/.test(img), `${slug}: 幅・高さ・alt`);
    assert.ok(/<p class="art-hero-credit">写真: [^<]+（ホットペッパーグルメ）<\/p>/.test(m[1]), `${slug}: 出所の文字`);
    // 顔の写真は、その特集の掲載店の写真（決めた店が外れていれば警告が出ている）
    const face = F.resolveFace(slug, html, real);
    assert.ok(face && face.pinned, `${slug}: 決めた店が今も掲載店（外れたら data/feature_faces.json を目で選び直す）`);
    // 図が顔に残っていない（顔の div は区画の1つだけ）
    const body = html.slice(html.indexOf('<body'));
    assert.strictEqual((body.match(/<div class="art-hero-image/g) || []).length, 1, `${slug}: 顔の div は1つ`);
    assert.ok(!/class="art-hero-image"[^>]*>\s*<img[^>]*feature-figures/.test(body), `${slug}: 図が顔に残っていない`);
  }
  // 自ホストの写真ファイルを作らない（加工・複製保存をしない）
  const dir = path.join(ROOT, 'assets', 'feature-faces');
  assert.ok(!fs.existsSync(dir), 'assets/feature-faces を作らない');
});

test('実際のファイル: 掲載店の写真を持たない特集（keepFigure）は図のまま・顔の区画を入れない', () => {
  const real = F.loadConfig();
  assert.ok(real.keepFigure.slugs.length > 0);
  for (const slug of real.keepFigure.slugs) {
    assert.ok(!real.faces[slug], `${slug}: faces に入れない`);
    const html = fs.readFileSync(path.join(ROOT, 'features', `${slug}.html`), 'utf8');
    assert.ok(!html.includes(F.FACE_START), `${slug}: 顔の区画を入れない`);
  }
});

test('実際の特集一覧: 図のカードが残るのは keepFigure だけ。写真に替えたカードには出所の文字がある', () => {
  const real = F.loadConfig();
  const html = fs.readFileSync(path.join(ROOT, 'features', 'index.html'), 'utf8');
  const keep = new Set(real.keepFigure.slugs);
  for (const m of html.matchAll(/<a class="article-card[^"]*" href="([^"]+)\.html"[^>]*>([\s\S]*?)<\/a>/g)) {
    const slug = m[1];
    if (/<img class="card-img" src="[^"]*feature-figures\//.test(m[2])) {
      assert.ok(keep.has(slug) || !real.faces[slug], `${slug}: 顔を決めた特集のカードが図のまま`);
    }
    if (/<p class="card-photo-credit">/.test(m[2])) {
      assert.ok(/<p class="card-photo-credit">写真: [^<]+（ホットペッパーグルメ）<\/p>/.test(m[2]), `${slug}: 出所の文字`);
      assert.ok(/<img class="card-img" src="https:\/\/imgfp\.hotp\.jp\//.test(m[2]), `${slug}: ホットペッパー写真`);
    }
  }
});

test('実際のトップの特集ストリップ: 顔を決めた特集の図が残らず、写真には出所の文字がある', () => {
  const real = F.loadConfig();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const strip = (html.match(/<!-- FEATURED_START -->([\s\S]*?)<!-- FEATURED_END -->/) || [])[1] || '';
  assert.ok(strip.length > 500);
  for (const m of strip.matchAll(/<a class="feature-card" href="features\/([^"]+)\.html">([\s\S]*?)<\/a>/g)) {
    const [, slug, inner] = m;
    if (/feature-figures\/[^"]*\.svg/.test(inner)) assert.ok(!real.faces[slug], `${slug}: ストリップの図が残っている`);
    if (/class="feature-card-credit"/.test(inner)) assert.ok(/class="feature-card-credit">写真: [^<]+（ホットペッパーグルメ）</.test(inner), `${slug}: 出所の文字`);
  }
});
