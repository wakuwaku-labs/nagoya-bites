'use strict';
// 競合の X の数字の取得（scripts/fetch_x_competitors.js）。X には通信しない（fetch は偽物）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const C = require('../scripts/fetch_x_competitors');

const ENV = { X_API_KEY: 'ck', X_API_SECRET: 'cs', X_ACCESS_TOKEN: 'tk', X_ACCESS_TOKEN_SECRET: 'ts' };
const quiet = () => {};
const NOW = new Date('2026-11-09T22:00:00Z');
const cfg = (n = 2, extra = {}) => ({ version: 1, capUsd: 1, maxResults: 10, retentionDays: 90, accounts: Array.from({ length: n }, (_, i) => ({ handle: `acc${i}`, reason: 'r' })), ...extra });

function tmpRoot(config, out) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xc-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'data/x_competitors_config.json'), JSON.stringify(config));
  if (out) fs.writeFileSync(path.join(root, 'data/x_competitors.json'), JSON.stringify(out));
  return root;
}
const readOut = (root) => JSON.parse(fs.readFileSync(path.join(root, 'data/x_competitors.json'), 'utf8'));
const SECRET_TEXT = 'ひみつの本文 https://example.com/x';
const tw = (id, at, extra = {}) => ({
  id, created_at: at, text: extra.text || `今日のランチ3選は？\n${SECRET_TEXT}`,
  public_metrics: { impression_count: 100, like_count: 5, retweet_count: 1, reply_count: 2, quote_count: 0, bookmark_count: 3 },
  entities: { urls: [{ expanded_url: 'https://example.com/x', display_url: 'example.com/x' }, { expanded_url: 'https://x.com/a/status/1/photo/1', display_url: 'pic.x.com/abc' }], hashtags: [{ tag: '名古屋グルメ' }] },
  attachments: { media_keys: ['m1'] }, ...extra.more,
});

function fake({ byStatus = 200, tlStatus = 200, tweets = {} } = {}) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url: decodeURIComponent(url), auth: opts.headers.authorization });
    if (url.includes('/users/by')) {
      const names = decodeURIComponent(url).match(/usernames=([^&]+)/)[1].split(',');
      return { status: byStatus, text: async () => JSON.stringify({ data: names.map((n, i) => ({ id: String(100 + i), username: n, public_metrics: { followers_count: 1000 + i } })) }) };
    }
    const uid = url.match(/users\/(\d+)\/tweets/)[1];
    const body = tweets[uid] || { data: [tw(`${uid}0001`, '2026-11-08T03:00:00.000Z')], includes: { media: [{ media_key: 'm1', type: 'video' }] } };
    return { status: tlStatus, text: async () => JSON.stringify(body) };
  };
  f.calls = calls;
  return f;
}

test('正常: 形が仕様どおり。本文・URL・画像は保存せず、特徴と数字だけ。費用を記録', async () => {
  const root = tmpRoot(cfg(2));
  const f = fake();
  const r = await C.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  const o = readOut(root);
  assert.strictEqual(o.schema, 'x-competitor/1');
  assert.strictEqual(o.project, 'nagoya_bites');
  assert.deepStrictEqual(o.cost, { month: '2026-11', usd: 0.03, cap_usd: 1 });
  assert.strictEqual(o.accounts.length, 2);
  const a = o.accounts[0];
  assert.deepStrictEqual([a.handle, a.user_id, a.followers], ['acc0', '100', 1000]);
  assert.deepStrictEqual(Object.keys(a.posts[0]), ['id', 'created_at', 'metrics', 'features']);
  assert.deepStrictEqual(a.posts[0].metrics, { impressions: 100, likes: 5, reposts: 1, replies: 2, quotes: 0, bookmarks: 3 });
  assert.deepStrictEqual(a.posts[0].features, { media: 'video', has_url: true, chars: [...`今日のランチ3選は？\n${SECRET_TEXT}`].length, first_line: 'question', hashtags: ['名古屋グルメ'], topic: 'ランチ' });
  const raw = fs.readFileSync(path.join(root, 'data/x_competitors.json'), 'utf8');
  assert.ok(!raw.includes('ひみつ') && !raw.includes('example.com') && !raw.includes('pic.x.com') && !/oauth/i.test(raw));
  assert.ok(f.calls[0].url.includes('/users/by?') && f.calls.filter((c) => c.url.includes('/tweets')).every((c) => c.url.includes('exclude=replies,retweets') && c.url.includes('max_results=10')));
  assert.strictEqual(f.calls.length, 3);
});

test('since_id: 2 回目は前回より新しい物だけを頼み、同じ投稿を重ねない', async () => {
  const root = tmpRoot(cfg(1));
  await C.run({ root, env: ENV, fetchImpl: fake(), now: NOW, log: quiet });
  const f2 = fake({ tweets: { 100: { data: [tw('1000001', '2026-11-08T03:00:00.000Z'), tw('1000002', '2026-11-09T03:00:00.000Z')] } } });
  await C.run({ root, env: ENV, fetchImpl: f2, now: new Date('2026-11-16T22:00:00Z'), log: quiet });
  assert.ok(f2.calls.find((c) => c.url.includes('/tweets')).url.includes('since_id=1000001'));
  const ids = readOut(root).accounts[0].posts.map((p) => p.id);
  assert.deepStrictEqual(ids.sort(), ['1000001', '1000002']);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('401・403 は落ちずに記録し、前回の中身を消さない', async () => {
  const root = tmpRoot(cfg(1));
  await C.run({ root, env: ENV, fetchImpl: fake(), now: NOW, log: quiet });
  const r = await C.run({ root, env: ENV, fetchImpl: fake({ byStatus: 403 }), now: new Date('2026-11-16T22:00:00Z'), log: quiet });
  assert.strictEqual(r.result, 'unavailable');
  const o = readOut(root);
  assert.strictEqual(o.last_run.result, 'unavailable');
  assert.ok(/403/.test(o.accounts[0].error));
  assert.strictEqual(o.accounts[0].posts.length, 1);
  const r2 = await C.run({ root, env: ENV, fetchImpl: fake({ tlStatus: 401 }), now: new Date('2026-11-23T22:00:00Z'), log: quiet });
  assert.strictEqual(r2.result, 'error');
  assert.ok(/401/.test(readOut(root).accounts[0].error));
  assert.strictEqual(readOut(root).accounts[0].posts.length, 1);
});

test('月の上限で止まる（呼ばない）。月が変われば使用額は 0 から', async () => {
  const out = { schema: 'x-competitor/1', project: 'nagoya_bites', cost: { month: '2026-11', usd: 0.99, cap_usd: 1 }, accounts: [] };
  const root = tmpRoot(cfg(2), out);
  const f = fake();
  const r = await C.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'budget');
  assert.strictEqual(f.calls.length, 0);
  assert.strictEqual(readOut(root).cost.usd, 0.99);
  // 途中で超えそうなら、その手前で止まる（users/by は通り、最初の投稿の取得で超える）
  const out2 = { ...out, cost: { month: '2026-11', usd: 0.93, cap_usd: 1 } };
  const root2 = tmpRoot(cfg(2), out2); const f2 = fake();
  const r2 = await C.run({ root: root2, env: ENV, fetchImpl: f2, now: NOW, log: quiet });
  assert.strictEqual(r2.result, 'budget');
  assert.ok(readOut(root2).cost.usd <= 1);
  assert.ok(f2.calls.filter((c) => c.url.includes('/tweets')).length < 2);
  const root3 = tmpRoot(cfg(1), out);
  const r3 = await C.run({ root: root3, env: ENV, fetchImpl: fake(), now: new Date('2026-12-07T22:00:00Z'), log: quiet });
  assert.strictEqual(r3.result, 'ok');
  assert.strictEqual(readOut(root3).cost.month, '2026-12');
});

test('90 日を超えた投稿は消す。保存済みの新しい投稿は残す', async () => {
  const out = { schema: 'x-competitor/1', project: 'nagoya_bites', cost: { month: '2026-11', usd: 0, cap_usd: 1 }, accounts: [{ handle: 'acc0', user_id: '100', followers: 1, fetched_at: '2026-08-01T00:00:00.000Z', posts: [
    { id: '1', created_at: '2026-07-01T00:00:00.000Z', metrics: {}, features: {} },
    { id: '2', created_at: '2026-11-01T00:00:00.000Z', metrics: {}, features: {} }] }] };
  const root = tmpRoot(cfg(1), out);
  await C.run({ root, env: ENV, fetchImpl: fake({ tweets: { 100: { data: [] } } }), now: NOW, log: quiet });
  assert.deepStrictEqual(readOut(root).accounts[0].posts.map((p) => p.id), ['2']);
});

test('特徴: 1 行目の型・画像・URL なし', () => {
  assert.strictEqual(C.firstLineType('11月の新店3つ'), 'number');
  assert.strictEqual(C.firstLineType('行列の理由は\nあ'), 'other');
  assert.strictEqual(C.firstLineType('ここが一番うまい。'), 'assertion');
  const f = C.features({ text: 'abc', attachments: { media_keys: ['k'] } }, new Map([['k', 'photo']]));
  assert.deepStrictEqual(f, { media: 'image', has_url: false, chars: 3, first_line: 'other', hashtags: [], topic: 'その他' });
});

test('dry-run は通信せず何も書かない／鍵なしは error', async () => {
  const root = tmpRoot(cfg(2)); const f = fake();
  await C.run({ root, env: ENV, fetchImpl: f, now: NOW, dryRun: true, log: quiet });
  assert.strictEqual(f.calls.length, 0);
  assert.ok(!fs.existsSync(path.join(root, 'data/x_competitors.json')));
  assert.strictEqual((await C.run({ root, env: {}, fetchImpl: f, now: NOW, log: quiet })).result, 'error');
});

test('本物の設定: 5 アカウントで、各項目に選んだ理由がある', () => {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/x_competitors_config.json'), 'utf8'));
  assert.strictEqual(c.accounts.length, 5);
  assert.ok(c.accounts.every((a) => a.handle && !a.handle.startsWith('@') && a.reason.length > 10));
  assert.ok(C.USER_READ_USD * 5 + C.POST_READ_USD * c.maxResults * 5 < 1);
});

test('題材の分類: 各分類・順番・空文字・本文が出力に入らない', () => {
  const cases = [['忘年会の予約', '宴会・忘年会'], ['夜景がきれい', 'デート'], ['カウンターあります', 'ひとり飲み・ひとりごはん'],
    ['日替わり定食', 'ランチ'], ['秋のまつり', 'イベント'], ['ハイボール', 'お酒'], ['モーニング', '喫茶・カフェ'], ['こんにちは', 'その他']];
  for (const [t, want] of cases) assert.strictEqual(C.topicOf(t), want, t);
  assert.strictEqual(C.topicOf('忘年会のランチ'), '宴会・忘年会');
  assert.strictEqual(C.topicOf(''), 'その他');
  assert.strictEqual(C.topicOf(undefined), 'その他');
  const f = C.features({ text: 'ひみつの本文ランチ' }, new Map());
  assert.strictEqual(f.topic, 'ランチ');
  assert.ok(!JSON.stringify(f).includes('ひみつの本文'));
});
