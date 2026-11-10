'use strict';
// X の画像カード（scripts/lib/x_image_card.js・scripts/make_x_image_card.js・scripts/post_journal_to_x.js の画像の段）。
// X にも Chrome にも通信しない（ラスタライザと fetch は差し替える）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('../scripts/lib/x_post');
const C = require('../scripts/lib/x_image_card');
const S = require('../scripts/lib/sns_analyzer');
const { run: postRun } = require('../scripts/post_journal_to_x');
const { run: makeRun } = require('../scripts/make_x_image_card');

const REAL_ROOT = path.resolve(__dirname, '..');
const realPolicy = X.loadPolicy(REAL_ROOT);
const entry = { slug: '2026-11-10-test-ramen', date: '2026-11-10', title: '東別院のラーメン『チャーシューメン ススル』950円とカウンター12席の一人ランチ', published_at: '2026-11-10T08:00:00+09:00' };
const NOW = new Date('2026-11-10T03:00:00Z');
const ARTICLE = `<html><head><meta property="og:image" content="https://img.example/a.jpg"></head><body><article>
<h1>${entry.title}</h1>
<div class="insider-box"><ul><li>ラーメン2種は950円。</li></ul></div>
<p>東別院のラーメン店。チャーシューメンは950円、カウンター12席。</p></article></body></html>`;
const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: '1-t', X_ACCESS_TOKEN_SECRET: 'ts' };

// 1x1 ではなく 1200x675 の PNG の頭（署名と IHDR の大きさだけ）を持つ偽ファイル
function fakePng(w = 1200, h = 675) {
  const b = Buffer.alloc(64);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write('IHDR', 12);
  b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b;
}
const fakeRaster = { kind: 'fake', bin: 'fake' };

function fixture(policyOver = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xcard-'));
  for (const d of ['data', 'journal', 'docs', 'icons']) fs.mkdirSync(path.join(root, d), { recursive: true });
  const policy = { ...realPolicy, mode: 'live', planExperiment: { enabled: false }, urlExperiment: { enabled: false }, draft: { ...realPolicy.draft, useInPost: false }, template: { points: false }, imageCard: { ...realPolicy.imageCard, ...policyOver } };
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify(policy));
  fs.copyFileSync(path.join(REAL_ROOT, 'data/selection_wording_policy.json'), path.join(root, 'data/selection_wording_policy.json'));
  fs.copyFileSync(path.join(REAL_ROOT, 'icons/icon-512.png'), path.join(root, 'icons/icon-512.png'));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [entry] }));
  fs.writeFileSync(path.join(root, `journal/${entry.slug}.html`), ARTICLE);
  return { root, policy };
}

function placeCard(root, variant = 'image', png = fakePng()) {
  fs.mkdirSync(path.join(root, 'data/x_post_cards'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/x-cards'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/x_post_cards', `${entry.date}.json`), JSON.stringify({ variant, reason: 'odd_day', source: 'alternate' }));
  if (png) fs.writeFileSync(path.join(root, 'assets/x-cards', `${entry.date}.png`), png);
}

/** 呼び出しを記録する偽の fetch。uploadStatuses で v2・v1.1 の応答を変えられる。 */
function fakeFetch(root, { v2 = 200, v1 = 200, tweetStatuses = [201] } = {}) {
  const calls = [];
  let tweets = 0;
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === C.UPLOAD_V2) return { status: v2, text: async () => JSON.stringify(v2 === 200 ? { data: { id: 'm-v2' } } : { error: 'nope' }) };
    if (url === C.UPLOAD_V1) return { status: v1, text: async () => JSON.stringify(v1 === 200 ? { media_id_string: 'm-v1' } : { error: 'nope' }) };
    if (url.startsWith('https://api.x.com/2/tweets')) {
      const st = tweetStatuses[Math.min(tweets++, tweetStatuses.length - 1)];
      return { status: st, text: async () => JSON.stringify(st === 201 ? { data: { id: '900' } } : { detail: 'bad' }) };
    }
    if (url.startsWith('https://img.example/')) return { status: 200, headers: { get: () => 'image/jpeg' }, body: null };
    return { status: 200, text: async () => fs.readFileSync(path.join(root, `journal/${entry.slug}.html`), 'utf8'), headers: { get: () => 'text/html' } };
  };
  fn.calls = calls;
  fn.tweetBodies = () => calls.filter((c) => c.url.startsWith('https://api.x.com/2/tweets')).map((c) => JSON.parse(c.opts.body));
  return fn;
}

// ── 決め方 ──
test('decideImage: 設定が切れていれば付けない・奇数日に付け偶数日は付けず交互になる', () => {
  assert.strictEqual(C.decideImage({ date: '2026-11-10', policy: { imageCard: { enabled: false } } }).variant, 'none');
  assert.strictEqual(C.decideImage({ date: '2026-11-10', policy: {} }).source, 'off');
  const p = { imageCard: { enabled: true } };
  const seq = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'].map((d) => C.decideImage({ date: d, policy: p }).variant);
  assert.notStrictEqual(seq[0], seq[1]);
  assert.strictEqual(seq[0], seq[2]);
  assert.notStrictEqual(seq[2], seq[3]);
  // 逆の偶奇にもできる
  assert.notStrictEqual(C.decideImage({ date: '2026-11-10', policy: { imageCard: { enabled: true, imageOnOddDays: false } } }).variant, C.decideImage({ date: '2026-11-10', policy: p }).variant);
  // since より前は付けない
  assert.strictEqual(C.decideImage({ date: '2026-11-10', policy: { imageCard: { enabled: true, since: '2026-12-01' } } }).reason, 'before_since');
});

test('decideImage: 週の予定の media があれば従い、followPlan=false なら無視する', () => {
  const on = { imageCard: { enabled: true } };
  assert.deepStrictEqual(C.decideImage({ date: '2026-11-10', policy: on, plan: { media: 'none' } }), { variant: 'none', source: 'plan', reason: 'plan_media_none' });
  assert.strictEqual(C.decideImage({ date: '2026-11-11', policy: on, plan: { media: 'image' } }).variant, 'image');
  assert.strictEqual(C.decideImage({ date: '2026-11-10', policy: { imageCard: { enabled: true, followPlan: false } }, plan: { media: 'none' } }).source, 'alternate');
  assert.strictEqual(C.decideImage({ date: '2026-11-10', policy: on, plan: { media: 'video' } }).source, 'alternate');
});

test('pickSlot: 枠の format.media（image / none）だけを plan.media に載せ、他は載せない', () => {
  const mk = (media) => ({ plan: { week: '2026-W46', slots: [{ slot: 1, format: { nb_kind: null, first_line: null, length: null, ...(media !== undefined ? { media } : {}) } }] } });
  assert.strictEqual(S.pickSlot(mk('image'), '2026-11-10').plan.media, 'image');
  assert.strictEqual('media' in S.pickSlot(mk(undefined), '2026-11-10').plan, false);
  assert.strictEqual('media' in S.pickSlot(mk('video'), '2026-11-10').plan, false);
});

// ── 折り返し・SVG ──
test('wrapLines: 区切りで折り返し、はみ出す題は truncated', () => {
  const r = C.wrapLines(entry.title, 16, 4);
  assert.ok(!r.truncated);
  assert.ok(r.lines.every((l) => l.length > 0));
  assert.strictEqual(r.lines.join('').replace(/\s/g, ''), entry.title.replace(/\s/g, ''));
  assert.ok(C.wrapLines('あ'.repeat(200), 16, 4).truncated);
});

test('buildCardSvg: 題・要点・ロゴ・サイト名だけで他社の画像参照を含まない。長すぎる題は null', () => {
  const svg = C.buildCardSvg({ entry, policy: realPolicy, point: 'ラーメン2種は950円。', iconDataUri: 'data:image/png;base64,AAAA' });
  assert.ok(svg.includes('ススル'));
  assert.ok(svg.includes('NAGOYA BITES'));
  assert.ok(svg.includes('ラーメン2種は950円'));
  assert.ok(!/https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg', '')), '外部の URL（他社の画像）を参照しない');
  assert.strictEqual((svg.match(/<image /g) || []).length, 1, '画像はサイトのロゴ1つだけ');
  assert.strictEqual(C.buildCardSvg({ entry: { ...entry, title: 'あ'.repeat(300) }, policy: realPolicy }), null);
  // 要点が 2 行に収まらなければ載せない
  assert.ok(!C.buildCardSvg({ entry, policy: realPolicy, point: 'あ'.repeat(200) }).includes('あああ'));
});

// ── 作る（make_x_image_card）──
test('makeCard: 付ける日は PNG と記録を作り、付けない日は記録だけ・描画に失敗したら画像なしで記録して例外を投げない', () => {
  const { root } = fixture({ imageOnOddDays: true });
  const rast = { kind: 'chrome', bin: '/nonexistent/chrome' };
  // 描画失敗（存在しないブラウザ）
  const bad = makeRun({ date: entry.date }, { root, now: NOW, rasterizer: rast });
  assert.strictEqual(bad.reason, 'render_failed');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_cards', `${entry.date}.json`), 'utf8')).variant, 'none');
  assert.ok(!fs.existsSync(path.join(root, 'assets/x-cards', `${entry.date}.png`)));
  // 付けない日
  const off = fixture({ enabled: false });
  const r2 = makeRun({ date: entry.date }, { root: off.root, now: NOW });
  assert.strictEqual(r2.result, 'no_card');
  assert.ok(fs.existsSync(path.join(off.root, 'data/x_post_cards', `${entry.date}.json`)));
  assert.ok(!fs.existsSync(path.join(off.root, 'assets/x-cards')));
  // 記事が無い日
  assert.strictEqual(makeRun({ date: '2026-01-01' }, { root, now: NOW }).result, 'no_journal');
});

test('makeCard: 実際のラスタライザがあれば 1200x675 の PNG ができる（無ければ飛ばす）', (t) => {
  const F = require('../scripts/lib/og_figure_png');
  if (!F.findRasterizer()) return t.skip('ラスタライザなし');
  const { root } = fixture({ imageOnOddDays: true });
  const r = makeRun({ date: entry.date }, { root, now: NOW });
  assert.strictEqual(r.result, 'card_made');
  const png = path.join(root, 'assets/x-cards', `${entry.date}.png`);
  assert.deepStrictEqual(F.readPngSize(png), { width: 1200, height: 675 });
  assert.ok(C.loadCard(entry.date, X.loadPolicy(root), root).attach);
});

// ── 読む（loadCard）──
test('loadCard: 記録・PNG の署名と大きさ・設定を確かめる', () => {
  const { root, policy } = fixture();
  assert.strictEqual(C.loadCard(entry.date, policy, root).reason, 'no_card_record');
  placeCard(root, 'image', null);
  assert.strictEqual(C.loadCard(entry.date, policy, root).reason, 'png_missing');
  placeCard(root, 'image', Buffer.from('not a png at all, just text'));
  assert.strictEqual(C.loadCard(entry.date, policy, root).reason, 'png_invalid');
  placeCard(root, 'image', fakePng(1200, 630));
  assert.strictEqual(C.loadCard(entry.date, policy, root).reason, 'png_invalid');
  placeCard(root, 'none');
  assert.strictEqual(C.loadCard(entry.date, policy, root).attach, false);
  placeCard(root, 'image');
  assert.strictEqual(C.loadCard(entry.date, policy, root).attach, true);
  assert.strictEqual(C.loadCard(entry.date, { imageCard: { enabled: false } }, root).reason, 'disabled');
});

// ── 上げる・投稿 ──
test('uploadImage: v2 が通れば v2・通らなければ v1.1・両方だめなら理由つきで失敗（例外なし）', async () => {
  const { root } = fixture();
  placeCard(root);
  const file = path.join(root, 'assets/x-cards', `${entry.date}.png`);
  const cred = { consumerKey: 'k', consumerSecret: 's', token: '1-t', tokenSecret: 'ts' };
  const a = await C.uploadImage(file, cred, fakeFetch(root));
  assert.deepStrictEqual([a.ok, a.id, a.via], [true, 'm-v2', 'v2']);
  const f2 = fakeFetch(root, { v2: 403 });
  const b = await C.uploadImage(file, cred, f2);
  assert.deepStrictEqual([b.ok, b.id, b.via], [true, 'm-v1', 'v1.1']);
  assert.ok(f2.calls[0].opts.headers.authorization.startsWith('OAuth '));
  const c = await C.uploadImage(file, cred, fakeFetch(root, { v2: 403, v1: 401 }));
  assert.strictEqual(c.ok, false);
  assert.ok(/v2:http_403/.test(c.reason) && /v1\.1:http_401/.test(c.reason));
  const d = await C.uploadImage(file, cred, async () => { throw new Error('boom'); });
  assert.strictEqual(d.ok, false);
});

test('投稿(live): 付ける日は画像を上げて media_ids を付け、URL は本文に残り、台帳に media=image', async () => {
  const { root } = fixture();
  placeCard(root);
  const f = fakeFetch(root);
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.strictEqual(r.media.variant, 'image');
  assert.ok(f.calls.some((c) => c.url === C.UPLOAD_V2), '上げる手順が呼ばれる');
  const [body] = f.tweetBodies();
  assert.deepStrictEqual(body.media, { media_ids: ['m-v2'] });
  assert.ok(/https?:\/\//.test(body.text), 'URL は本文に残す（判断記録 0055）');
  const row = X.readLog(root).posts[0];
  assert.strictEqual(row.media, 'image');
  assert.strictEqual(row.media_id, 'm-v2');
});

test('投稿(live): 付けない日は上げず media なし・台帳に media=none', async () => {
  const { root } = fixture();
  placeCard(root, 'none');
  const f = fakeFetch(root);
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.ok(!f.calls.some((c) => c.url === C.UPLOAD_V2 || c.url === C.UPLOAD_V1));
  assert.strictEqual('media' in f.tweetBodies()[0], false);
  assert.strictEqual(X.readLog(root).posts[0].media, 'none');
});

test('投稿(live): 画像の上げに失敗しても画像なしで投稿し、理由を台帳に残す', async () => {
  const { root } = fixture();
  placeCard(root);
  const f = fakeFetch(root, { v2: 403, v1: 401 });
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.strictEqual('media' in f.tweetBodies()[0], false);
  const row = X.readLog(root).posts[0];
  assert.strictEqual(row.media, 'none');
  assert.ok(row.media_reason.startsWith('upload_failed'));
});

test('投稿(live): 画像つきの投稿が 403 で断られたら、画像なしでもう1回だけ送る', async () => {
  const { root } = fixture();
  placeCard(root);
  const f = fakeFetch(root, { tweetStatuses: [403, 201] });
  const r = await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  const bodies = f.tweetBodies();
  assert.strictEqual(bodies.length, 2);
  assert.ok(bodies[0].media && !bodies[1].media);
  assert.ok(X.readLog(root).posts[0].media_reason.startsWith('tweet_with_media_rejected'));
});

test('投稿(live): 設定が切れていれば、カードがあっても上げない', async () => {
  const { root } = fixture({ enabled: false });
  placeCard(root);
  const f = fakeFetch(root);
  await postRun({ date: entry.date }, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.ok(!f.calls.some((c) => c.url === C.UPLOAD_V2));
  assert.strictEqual(X.readLog(root).posts[0].media, 'none');
});

test('試運転: 何も送らず、付ける日・付けない日の判定だけを出す', async () => {
  for (const [variant, expect] of [['image', 'image'], ['none', 'none']]) {
    const { root } = fixture();
    placeCard(root, variant);
    const f = fakeFetch(root);
    const r = await postRun({ date: entry.date, dryRun: true }, { root, env: {}, fetchImpl: f, now: NOW });
    assert.strictEqual(r.result, 'dry_run_ok');
    assert.strictEqual(r.media.variant, expect);
    assert.ok(!f.calls.some((c) => c.url === C.UPLOAD_V2 || c.url.startsWith('https://api.x.com/2/tweets')));
  }
});
