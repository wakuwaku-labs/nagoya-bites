'use strict';
// X の「料理のイメージ写真」（店の写真が無い日・scripts/lib/x_food_card.js・Ondine #2713）。X にも Chrome にも通信しない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('../scripts/lib/x_post');
const C = require('../scripts/lib/x_image_card');
const F = require('../scripts/lib/x_food_card');
const { run: postRun, summaryMarkdown } = require('../scripts/post_journal_to_x');
const { runFood } = require('../scripts/make_x_image_card');

const REAL = path.resolve(__dirname, '..');
const realPolicy = X.loadPolicy(REAL);
const entry = { slug: '2026-11-10-test-ramen', date: '2026-11-10', title: '東別院のラーメン『チャーシューメン ススル』950円とカウンター12席の一人ランチ', published_at: '2026-11-10T08:00:00+09:00' };
const NOW = new Date('2026-11-10T03:00:00Z');
const ARTICLE = `<html><head><meta property="og:image" content="https://img.example/a.jpg"></head><body><article>
<h1>${entry.title}</h1><div class="insider-box"><ul><li>ラーメン2種は950円。</li></ul></div>
<p>東別院のラーメン店。チャーシューメンは950円、カウンター12席。</p></article></body></html>`;
const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: '1-t', X_ACCESS_TOKEN_SECRET: 'ts' };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
const fakeRaster = { kind: 'fake', bin: 'fake' };

function fakePng(w = 1200, h = 675) {
  const b = Buffer.alloc(64);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write('IHDR', 12);
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}

function fixture(over = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xfood-'));
  for (const d of ['data', 'journal', 'docs', 'icons']) fs.mkdirSync(path.join(root, d), { recursive: true });
  const policy = { ...realPolicy, mode: 'live', planExperiment: { enabled: false }, urlExperiment: { enabled: false }, draft: { ...realPolicy.draft, useInPost: false }, template: { points: false }, ...over };
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify(policy));
  for (const f of ['data/selection_wording_policy.json', 'data/note_post_policy.json', 'data/note_food_photos.json', 'icons/icon-512.png']) fs.copyFileSync(path.join(REAL, f), path.join(root, f));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [entry] }));
  fs.writeFileSync(path.join(root, `journal/${entry.slug}.html`), ARTICLE);
  return { root, policy };
}

function fakeFetch(root, { tweetStatuses = [201] } = {}) {
  const calls = [];
  let tweets = 0;
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === C.UPLOAD_V2) return { status: 200, text: async () => JSON.stringify({ data: { id: 'm-food' } }) };
    if (url.startsWith('https://api.x.com/2/tweets')) {
      const st = tweetStatuses[Math.min(tweets++, tweetStatuses.length - 1)];
      return { status: st, text: async () => JSON.stringify(st === 201 ? { data: { id: '900' } } : { detail: 'bad' }) };
    }
    if (/wikimedia\.org/.test(url)) return { status: 200, arrayBuffer: async () => JPEG };
    return { status: 200, text: async () => ARTICLE, headers: { get: () => 'text/html' } };
  };
  fn.calls = calls;
  fn.tweetBodies = () => calls.filter((c) => c.url.startsWith('https://api.x.com/2/tweets')).map((c) => JSON.parse(c.opts.body));
  return fn;
}

// 偽ラスタライザの代わりに、PNG を直接置く（renderPng は実際の Chrome が要るので、描画は別の試験で見る）
function placeFood(root, food = { genre: 'ラーメン', label: 'ラーメン', author: 'Test Author', license: 'CC BY 4.0', page: 'https://commons.wikimedia.org/wiki/File:x.jpg', src: 'https://upload.wikimedia.org/x.jpg' }) {
  fs.mkdirSync(path.join(root, 'data/x_post_cards'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/x-cards'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/x_post_cards', `${entry.date}.json`), JSON.stringify({ variant: 'image', source: 'food', reason: 'food_image', food }));
  fs.writeFileSync(path.join(root, 'assets/x-cards', `${entry.date}.png`), fakePng());
  return food;
}

test('料理カードの SVG: 「イメージ」の帯・「写真はイメージです」・作者とライセンスを必ず焼き込む', () => {
  const svg = F.buildFoodSvg({ photoDataUri: 'data:image/jpeg;base64,AAAA', food: { label: 'ラーメン', author: 'A & B', license: 'CC BY-SA 4.0' }, iconDataUri: null });
  assert.ok(svg.includes('>イメージ</text>'));
  assert.ok(svg.includes('写真はイメージです（実際のお店の料理ではありません）'));
  assert.ok(svg.includes('A &amp; B') && svg.includes('CC BY-SA 4.0') && svg.includes('Wikimedia Commons'));
  assert.ok(!svg.includes('NAGOYA BITES</text>'), 'ロゴと同じ名前の文字を並べない');
});

test('creditText: 作者が長い日は短い形・省略で右下のロゴにぶつからず、24px 以上で出す（design-qa 軽微の再発防止）', () => {
  const short = F.creditText({ label: 'ケーキ', author: 'Bim24', license: 'CC BY-SA 4.0' });
  assert.ok(short.includes('Wikimedia Commons') && short.includes('ケーキの写真'));
  const long = F.creditText({ label: 'ケーキ', author: 'Very Long Author Name '.repeat(6), license: 'CC BY-SA 4.0' });
  assert.ok(long.includes('CC BY-SA 4.0') && long.includes('…') && long.length < 80, long);
  assert.ok(F.buildFoodSvg({ photoDataUri: 'data:,', food: { label: 'a', author: 'b', license: 'c' } }).includes('font-size="24"'));
});

test('pickFood: note と同じ選び方で、題から料理の写真・作者・ライセンスを返す', () => {
  const { root } = fixture();
  const f = F.pickFood(entry, root);
  assert.ok(f, 'ラーメンの題なら料理写真が引ける');
  assert.match(f.src, /^https:\/\/(upload|thumb)\.wikimedia\.org\//);
  assert.ok(f.author && f.license && f.page);
  assert.deepStrictEqual(F.pickFood(entry, root), f, '同じ日は同じ写真');
  assert.strictEqual(F.pickFood({ ...entry, title: 'あいうえお', date: entry.date }, root), null, '料理が引けない題は付けない');
});

test('withCredit: 作者の行を足し、280 を超えるなら短い形、それでも超えるなら null', () => {
  const food = { label: 'ラーメン', author: 'Test Author', license: 'CC BY 4.0' };
  const t = F.withCredit('本文です', food);
  assert.ok(t.endsWith('写真（イメージ）: ラーメン / Test Author（CC BY 4.0・Wikimedia Commons）'));
  const long = 'あ'.repeat(105); // 210+2+72 > 280 > 210+2+39
  assert.ok(F.withCredit(long, food).endsWith('写真（イメージ）: Test Author CC BY 4.0'));
  assert.strictEqual(F.withCredit('あ'.repeat(139), food), null);
});

test('loadCard: 料理カードは foodImage のスイッチで決まる（imageCard が切れていても付く・foodImage が切れていれば付かない）', () => {
  const { root } = fixture();
  placeFood(root);
  const on = C.loadCard(entry.date, { imageCard: { enabled: false }, foodImage: { enabled: true } }, root);
  assert.strictEqual(on.attach, true);
  assert.strictEqual(on.source, 'food');
  assert.strictEqual(on.food.author, 'Test Author');
  assert.strictEqual(C.loadCard(entry.date, { imageCard: { enabled: true }, foodImage: { enabled: false } }, root).reason, 'food_disabled');
});

test('本番の設定: 料理イメージは有効・店の写真が先', () => {
  assert.strictEqual(realPolicy.foodImage.enabled, true);
  assert.strictEqual(realPolicy.storePhoto.enabled, true);
});

test('makeFoodCard: 店の写真（PR TIMES）がある日・設定が切れた日・料理が引けない日は作らない', async () => {
  const { root, policy } = fixture();
  const call = (p, html = ARTICLE, e = entry) => F.makeFoodCard({ date: e.date, entry: e, policy: p, html, root, rasterizer: fakeRaster, fetchImpl: fakeFetch(root) });
  assert.strictEqual((await call({ ...policy, foodImage: { enabled: false } })).reason, 'food_disabled');
  const press = ARTICLE.replace('<h1>', '<figure class="art-hero-img" data-hero-source="press" data-hero-store="ススル"><img src="https://prcdn.freetls.fastly.net/release_image/1/2/3.jpg" alt=""><figcaption>写真: <a href="https://prtimes.jp/main/html/rd/p/000000001.html">提供 株式会社テスト（プレスリリースより）</a></figcaption></figure><h1>');
  assert.strictEqual((await call(policy, press)).reason, 'store_photo_available');
  assert.strictEqual((await call(policy, ARTICLE, { ...entry, title: 'あいうえお' })).reason, 'no_food_photo');
});

test('makeFoodCard: 写真が取れない日は画像なしで記録し、例外を投げない', async () => {
  const { root, policy } = fixture();
  const bad = async () => ({ status: 404 });
  const r = await F.makeFoodCard({ date: entry.date, entry, policy, html: ARTICLE, root, rasterizer: fakeRaster, fetchImpl: bad });
  assert.strictEqual(r.reason, 'food_render_failed');
  const info = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_cards', `${entry.date}.json`), 'utf8'));
  assert.strictEqual(info.variant, 'none');
});

test('runFood: 記事が無い日は何もしない', async () => {
  const { root } = fixture();
  assert.strictEqual((await runFood({ date: '2026-01-01' }, { root, now: NOW })).result, 'no_journal');
});

test('試運転: 料理イメージ写真は「画像あり・イメージの作者行つき」と出て、何も送らない', async () => {
  const { root } = fixture();
  const food = placeFood(root);
  const f = fakeFetch(root);
  const r = await postRun({ date: entry.date, dryRun: true }, { root, env: {}, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'dry_run_ok');
  assert.strictEqual(r.media.variant, 'food');
  assert.ok(r.media.credit.startsWith('写真（イメージ）'), r.media.credit);
  assert.ok(r.media.credit.includes(food.author));
  assert.strictEqual(f.tweetBodies().length, 0);
});

test('投稿(live): 料理イメージ写真を上げ、本文の最後に「写真（イメージ）」の行、台帳に media=food', async () => {
  const { root } = fixture();
  const food = placeFood(root);
  const f = fakeFetch(root);
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  // 実行の要約欄の作者名が空にならない（11/26 の本番で「料理のイメージ写真を付ける（）」と出た）
  assert.ok(r.media.credit && r.media.credit.includes(food.author), JSON.stringify(r.media));
  assert.ok(summaryMarkdown(r).includes(`料理のイメージ写真を付ける（${r.media.credit}）`));
  const body = f.tweetBodies()[0];
  assert.deepStrictEqual(body.media.media_ids, ['m-food']);
  assert.ok(body.text.includes('写真（イメージ）: '), body.text);
  assert.ok(X.weightedLength(body.text) <= 280);
  const row = X.readLog(root).posts[0];
  assert.strictEqual(row.media, 'food');
  assert.strictEqual(row.text, body.text);
});

test('投稿(live): 画像つきが断られたら、画像と作者の行を外してもう1回だけ送る', async () => {
  const { root } = fixture();
  placeFood(root);
  const f = fakeFetch(root, { tweetStatuses: [403, 201] });
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  const bodies = f.tweetBodies();
  assert.strictEqual(bodies.length, 2);
  assert.ok(!bodies[1].media);
  assert.ok(!bodies[1].text.includes('写真（イメージ）'));
});

test('投稿(live): 作者の行を足すと 280 を超える日は、料理写真を付けず文字だけで送る', async () => {
  const { root } = fixture();
  placeFood(root, { genre: 'ラーメン', label: 'ラーメン', author: 'あ'.repeat(300), license: 'CC BY 4.0', page: 'https://x', src: 'https://upload.wikimedia.org/x.jpg' });
  const f = fakeFetch(root);
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.ok(!f.calls.some((c) => c.url === C.UPLOAD_V2));
  assert.ok(!f.tweetBodies()[0].text.includes('写真（イメージ）'));
  assert.strictEqual(X.readLog(root).posts[0].media, 'none');
});
