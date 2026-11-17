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
  assert.deepStrictEqual(F.resolveFace('demo', listed, cfg), { src: cfg.faces.demo.photo, store: '店A', pinned: true, srcset: '', maxW: 480 });
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

test('applyIndexCard: 図の札・写真の無い札・手で入れた写真の札を顔にそろえ、出所を写真の枠の直後に出す。冪等・同じ特集の札は全部直す', () => {
  const face = { src: cfg.faces.demo.photo, store: '店A', srcset: '', maxW: 480 };
  const mk = (img) => `<a class="article-card" href="demo.html">\n    <div class="card-badge">${img}\n      <div class="card-category">分類</div>\n    </div>\n    <div class="card-body">\n      <p class="card-desc">説明</p>\n    </div>\n  </a>`;
  const fig = mk('\n      <img class="card-img" src="../assets/feature-figures/demo.svg" alt="デモ" loading="lazy">');
  const once = F.applyIndexCard(`<main>${fig}</main>`, 'demo', face, cfg);
  assert.ok(once.includes(`src="${face.src}"`) && once.includes('alt="デモ"'));
  assert.ok(/<\/div>\s*<p class="card-photo-credit">写真: 店A（ホットペッパーグルメ）<\/p>\s*<div class="card-body">/.test(once), '出所は写真の枠のすぐ下（本文の前）');
  assert.strictEqual(F.applyIndexCard(once, 'demo', face, cfg), once, '冪等');
  // 手で入れた別の写真（ロゴが主役など）の札も、顔にそろえる
  const hand = mk('\n      <img class="card-img" src="https://imgfp.hotp.jp/IMGH/99/99/P000000099/P000000099_480.jpg" alt="デモ" loading="lazy">');
  const fixed = F.applyIndexCard(`<main>${hand}</main>`, 'demo', face, cfg);
  assert.ok(!fixed.includes('P000000099') && fixed.includes('card-photo-credit'));
  // 写真の無い札（季節の札）には画像を足す
  const none = F.applyIndexCard(`<main>${mk('')}</main>`, 'demo', face, cfg);
  assert.ok(/<div class="card-badge">\s*<img class="card-img" src="[^"]+" alt="店Aの料理・店内"/.test(none) && none.includes('card-photo-credit'));
  // 同じ特集の札が2か所あれば、2か所とも
  const twice = F.applyIndexCard(`<main>${fig}${hand}</main>`, 'demo', face, cfg);
  assert.strictEqual((twice.match(/card-photo-credit">写真: 店A/g) || []).length, 2);
  // 大きい版があるときは srcset を足す
  const big = F.applyIndexCard(`<main>${fig}</main>`, 'demo', Object.assign({}, face, { srcset: 'a 480w, b 960w' }), cfg);
  assert.ok(big.includes('srcset="a 480w, b 960w"'));
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

// CLAUDE.md「同じ画像を複数の記事の顔に使い回さない」: 特集ページの顔（先頭の画像）の写真が、特集どうしで重ならない
function heroPhotoOf(html) {
  const m = html.match(/<div class="art-hero-image[^"]*"[^>]*>\s*(?:<!--[^>]*-->\s*)*<img[^>]*?src="([^"]+)"/);
  return m ? m[1] : null;
}

test('特集ページの顔: どの2本の特集も同じ写真を顔にしない（図・転送ページ・顔の無い型は数えない）', () => {
  const dir = path.join(ROOT, 'features');
  const seen = new Map();
  let withPhoto = 0;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.html'))) {
    const src = heroPhotoOf(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!src || /feature-figures\//.test(src)) continue;
    withPhoto++;
    const id = F.photoId(src);
    assert.ok(!seen.has(id), `顔の写真が重なっている: ${f} と ${seen.get(id)}（${id}）`);
    seen.set(id, f);
  }
  assert.ok(withPhoto >= 30, `写真の顔を持つ特集の数: ${withPhoto}`);
});

test('data/feature_faces.json: 顔に決めた写真が特集どうしで重ならない', () => {
  const real = F.loadConfig();
  const seen = new Map();
  for (const [slug, f] of Object.entries(real.faces)) {
    const id = F.photoId(f.photo);
    assert.ok(!seen.has(id), `${slug} と ${seen.get(id)} が同じ写真（${id}）`);
    seen.set(id, slug);
  }
});

// ── Ondine #2097 検査の差し戻し（ぼやけ・ロゴ・出所・並び・文言）────────────────────────────

const HP = require('../scripts/lib/hotpepper_photo');
const U = (id, suffix) => `https://imgfp.hotp.jp/IMGH/11/11/${id}/${id}${suffix}.jpg`;

test('hotpepper_photo.pick: 測った幅の範囲だけ使う。大きい版が広ければ srcset に足し、狭い・測っていなければ 480px のまま', () => {
  const sizes = { P000000001: { s: 480, l: 1280 }, P000000002: { s: 480, l: 347 }, P000000003: { s: 0, l: 855 }, P000000004: { s: 0, l: 0 } };
  const a = HP.pick(U('P000000001', '_480'), sizes);
  assert.deepStrictEqual(a, { src: U('P000000001', '_480'), srcset: `${U('P000000001', '_480')} 480w, ${U('P000000001', '')} 1280w`, maxW: 1280 });
  assert.deepStrictEqual(HP.pick(U('P000000002', '_480'), sizes), { src: U('P000000002', '_480'), srcset: '', maxW: 480 }, '大きい版が狭い店は足さない');
  assert.deepStrictEqual(HP.pick(U('P000000003', ''), sizes), { src: U('P000000003', ''), srcset: '', maxW: 855 }, '_480 が無い写真はその幅まで');
  assert.deepStrictEqual(HP.pick(U('P000000009', '_480'), sizes), { src: U('P000000009', '_480'), srcset: '', maxW: 480 }, '測っていない写真は 480px');
  assert.deepStrictEqual(HP.pick('https://example.com/x.jpg', sizes), { src: 'https://example.com/x.jpg', srcset: '', maxW: 480 }, 'ホットペッパー以外は触らない');
});

test('実際の特集ページの顔: 画面に出す幅（--face-w）は元の写真の幅まで。大きい版の URL は同じ写真の参照だけ（自ホストしない）', () => {
  const real = F.loadConfig();
  const sizes = HP.loadSizes();
  for (const slug of Object.keys(real.faces)) {
    const html = fs.readFileSync(path.join(ROOT, 'features', `${slug}.html`), 'utf8');
    const m = html.match(new RegExp(`${F.FACE_START}([\\s\\S]*?)${F.FACE_END}`))[1];
    const w = Number((m.match(/--face-w:(\d+)px/) || [])[1]);
    const src = (m.match(/<img src="([^"]+)"/) || [])[1];
    const rec = sizes[HP.idOf(src)];
    const native = rec ? Math.max(rec.s, rec.l) : 480;
    assert.ok(w > 0 && w <= Math.max(native, 480), `${slug}: 表示幅 ${w}px が元の幅 ${native}px を超えない`);
    for (const u of m.matchAll(/https:\/\/[^\s",]+/g)) assert.ok(/^https:\/\/imgfp\.hotp\.jp\/IMGH\//.test(u[0]), `${slug}: ホットペッパー写真の参照だけ`);
  }
});

test('実際の特集一覧: 写真のある札はすべて、特集ページの顔と同じ写真で、写真の枠の直後に同じ形の出所がある（ロゴの札・出所の無い札を残さない）', () => {
  const real = F.loadConfig();
  const html = fs.readFileSync(path.join(ROOT, 'features', 'index.html'), 'utf8');
  let photoCards = 0;
  for (const m of html.matchAll(/<a class="article-card[^"]*" href="([^"]+)\.html"[^>]*>([\s\S]*?)<\/a>/g)) {
    const [, slug, inner] = m;
    const img = (inner.match(/<img class="card-img"[^>]*>/) || [])[0];
    if (img && /imgfp\.hotp\.jp/.test(img)) {
      photoCards++;
      assert.ok(real.faces[slug], `${slug}: 顔を決めていない特集の写真が札に出ている`);
      const src = (img.match(/src="([^"]+)"/) || [])[1];
      assert.strictEqual(F.photoId(src), F.photoId(real.faces[slug].photo), `${slug}: 札の写真が特集の顔と同じ`);
      assert.ok(/<\/div>\s*<p class="card-photo-credit">写真: [^<]+（ホットペッパーグルメ）<\/p>\s*<div class="card-body">/.test(inner), `${slug}: 出所が写真の枠のすぐ下`);
    }
    // 季節の札も、顔があれば写真を出す
    if (real.faces[slug]) assert.ok(img && /imgfp\.hotp\.jp/.test(img), `${slug}: 顔のある特集の札に写真がある`);
  }
  assert.ok(photoCards >= 55, `写真の札の数: ${photoCards}`);
  assert.ok(/\.card-photo-credit\{font-size:var\(--fs-xs\)/.test(fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8')), '出所は 13px のトークン');
});

test('実際の特集一覧: 最初の写真の札が先頭の6枚に入る（文字だけの決定版ガイドと帯は、その後ろ）', () => {
  const html = fs.readFileSync(path.join(ROOT, 'features', 'index.html'), 'utf8');
  const cards = [...html.matchAll(/<a class="article-card[^"]*" href="([^"]+)\.html"[^>]*>([\s\S]*?)<\/a>/g)];
  const first6 = cards.slice(0, 6).map((c) => c[1]);
  assert.ok(!first6.includes('nagoya-gourmet-guide') && !first6.includes('nagoya-settai-concierge'), first6.join(','));
  assert.ok(cards.slice(0, 6).every((c) => /imgfp\.hotp\.jp/.test(c[2])), '先頭の6枚は写真の札');
});

test('図（SVG）の中の文字: 選び方の言い方の検査が、公開ページが参照する特集の図の文字も数える（settai-concierge.svg を見落とした）', () => {
  const audit = require('../scripts/audit_selection_wording');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svgwording-'));
  fs.mkdirSync(path.join(tmp, 'data'));
  fs.mkdirSync(path.join(tmp, 'features'));
  fs.mkdirSync(path.join(tmp, 'assets', 'feature-figures'), { recursive: true });
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'selection_wording_policy.json'), 'utf8'));
  fs.writeFileSync(path.join(tmp, 'data', 'selection_wording_policy.json'), JSON.stringify(policy));
  fs.writeFileSync(path.join(tmp, 'index.html'), '<html><body><p>ok</p></body></html>');
  fs.writeFileSync(path.join(tmp, 'features', 'a.html'), '<html><body><img src="../assets/feature-figures/a.svg" alt="a"><meta property="og:image" content="https://x/assets/feature-figures/b.png"></body></html>');
  fs.writeFileSync(path.join(tmp, 'assets', 'feature-figures', 'a.svg'), '<svg><text>現役飲食人が、名古屋の一軒を無料で見立てる</text></svg>');
  fs.writeFileSync(path.join(tmp, 'assets', 'feature-figures', 'b.svg'), '<svg><text>業界人推薦の店</text></svg>');
  fs.writeFileSync(path.join(tmp, 'assets', 'feature-figures', 'c.svg'), '<svg><text>業界人推薦の店</text></svg>');
  const r = audit.audit({ root: tmp });
  assert.strictEqual(r.ok, false, 'a.svg（<img>）と b.svg（og:image が b.png）の文字が違反');
  assert.strictEqual(r.svg.hard_files, 2, '参照されない c.svg は数えない');
  // 実物: 公開ページが参照する特集の図に違反が無い
  const real = audit.audit({});
  assert.strictEqual(real.svg.hard_occurrences, 0, JSON.stringify(real.svg.violations.filter((v) => v.hard)));
  assert.ok(real.svg.scanned > 20);
  assert.ok(!fs.readFileSync(path.join(ROOT, 'assets', 'feature-figures', 'settai-concierge.svg'), 'utf8').includes('現役飲食人'));
});
