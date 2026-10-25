'use strict';
// X の数字の取得（scripts/fetch_x_metrics.js・check_x_metrics_health.js）。X には通信しない（fetch は偽物）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const M = require('../scripts/fetch_x_metrics');
const H = require('../scripts/check_x_metrics_health');
const X = require('../scripts/lib/x_post');

const ENV = { X_API_KEY: 'ck', X_API_SECRET: 'cs', X_ACCESS_TOKEN: 'tk', X_ACCESS_TOKEN_SECRET: 'ts' };
const quiet = () => {};

function tmpRoot(initial) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xm-'));
  fs.mkdirSync(path.join(root, 'data'));
  if (initial) fs.writeFileSync(path.join(root, 'data/x_metrics.json'), JSON.stringify(initial));
  return root;
}
const readOut = (root) => JSON.parse(fs.readFileSync(path.join(root, 'data/x_metrics.json'), 'utf8'));

function fakeFetch({ me, tweets, meStatus = 200, twStatus = 200 } = {}) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, auth: opts.headers.authorization });
    const isMe = url.includes('/users/me');
    const status = isMe ? meStatus : twStatus;
    const body = isMe ? (me || { data: { id: '77', username: 'nagoya_bites', name: 'NAGOYA BITES', public_metrics: { followers_count: 12, following_count: 3, tweet_count: 40 } } })
      : (tweets || { data: [
        { id: '1', created_at: '2026-10-25T00:00:00.000Z', text: 'あ'.repeat(100), public_metrics: { impression_count: 120, like_count: 3, retweet_count: 0, reply_count: 1, quote_count: 0, bookmark_count: 0 } },
        { id: '2', text: 'x', public_metrics: { like_count: 1 } },
      ] });
    return { status, text: async () => JSON.stringify(body) };
  };
  f.calls = calls;
  return f;
}
const NOW = new Date('2026-10-25T21:40:05.000Z');

test('見積は $0.02', () => { assert.strictEqual(M.estimate(), 0.02); });

test('dry-run は通信せず何も書かない', async () => {
  const root = tmpRoot(); const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, dryRun: true, log: quiet });
  assert.strictEqual(f.calls.length, 0);
  assert.ok(!fs.existsSync(path.join(root, 'data/x_metrics.json')));
  assert.strictEqual(r.result, 'skipped');
});

test('正常: 形・使用額・欠けた値は null（0 で埋めない）・本文は80字', async () => {
  const root = tmpRoot(); const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  const j = readOut(root);
  assert.strictEqual(j.version, 1);
  assert.deepStrictEqual(j.account, { id: '77', username: 'nagoya_bites', name: 'NAGOYA BITES' });
  assert.strictEqual(j.snapshots.length, 1);
  const s = j.snapshots[0];
  assert.deepStrictEqual([s.at, s.followers, s.following, s.tweet_count], [NOW.toISOString(), 12, 3, 40]);
  assert.strictEqual(s.posts[0].impressions, 120);
  assert.strictEqual(s.posts[0].text.length, 80);
  assert.strictEqual(s.posts[0].url, 'https://x.com/nagoya_bites/status/1');
  assert.deepStrictEqual(s.posts[1], { id: '2', created_at: null, text: 'x', url: 'https://x.com/nagoya_bites/status/2', impressions: null, likes: 1, reposts: null, replies: null, quotes: null, bookmarks: null });
  assert.deepStrictEqual(j.budget, { month: '2026-10', spent_usd: 0.012, cap_usd: 1, cap_jpy: 150 });
  assert.deepStrictEqual(j.last_run, { at: NOW.toISOString(), result: 'ok', reason: null });
  assert.ok(f.calls[1].url.startsWith('https://api.x.com/2/users/77/tweets?'));
});

test('署名は GET のクエリを含む（署名を作り直して一致）', async () => {
  const f = fakeFetch(); const root = tmpRoot();
  await M.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  const c = f.calls[0];
  const get = (k) => new RegExp(`${k}="([^"]*)"`).exec(c.auth)[1];
  const q = { 'user.fields': 'public_metrics,username,name' };
  const oauth = { oauth_consumer_key: 'ck', oauth_nonce: decodeURIComponent(get('oauth_nonce')), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: get('oauth_timestamp'), oauth_token: 'tk', oauth_version: '1.0' };
  const all = { ...q, ...oauth };
  const ps = Object.keys(all).sort().map((k) => `${X.pct(k)}=${X.pct(all[k])}`).join('&');
  const base = ['GET', X.pct('https://api.x.com/2/users/me'), X.pct(ps)].join('&');
  const sig = crypto.createHmac('sha1', 'cs&ts').update(base).digest('base64');
  assert.strictEqual(decodeURIComponent(get('oauth_signature')), sig);
  assert.ok(!c.auth.includes('user.fields'));
});

test('同じ UTC 日は呼ばない。--force は上書き（件数が増えない）', async () => {
  const root = tmpRoot();
  await M.run({ root, env: ENV, fetchImpl: fakeFetch(), now: NOW, log: quiet });
  const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: new Date('2026-10-25T23:00:00Z'), log: quiet });
  assert.strictEqual(r.result, 'skipped'); assert.strictEqual(f.calls.length, 0);
  assert.strictEqual(readOut(root).snapshots.length, 1);
  const r2 = await M.run({ root, env: ENV, fetchImpl: fakeFetch(), now: new Date('2026-10-25T23:00:00Z'), force: true, log: quiet });
  assert.strictEqual(r2.result, 'ok');
  const j = readOut(root);
  assert.strictEqual(j.snapshots.length, 1);
  assert.strictEqual(j.budget.spent_usd, 0.024);
});

test('上限を超える見積なら呼ばず budget。既存のスナップショットは残る', async () => {
  const prev = { version: 1, snapshots: [{ at: '2026-10-24T21:40:00.000Z', followers: 1, posts: [] }], budget: { month: '2026-10', spent_usd: 0.99, cap_usd: 1, cap_jpy: 150 } };
  const root = tmpRoot(prev); const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'budget'); assert.strictEqual(f.calls.length, 0);
  const j = readOut(root);
  assert.strictEqual(j.snapshots.length, 1); assert.strictEqual(j.last_run.result, 'budget');
  // ちょうど上限に収まるなら呼ぶ
  const root2 = tmpRoot({ ...prev, budget: { month: '2026-10', spent_usd: 0.98, cap_usd: 1, cap_jpy: 150 } });
  assert.strictEqual((await M.run({ root: root2, env: ENV, fetchImpl: fakeFetch(), now: NOW, log: quiet })).result, 'ok');
});

test('月が変わると使用額は 0 から', async () => {
  const prev = { version: 1, snapshots: [], budget: { month: '2026-09', spent_usd: 0.99, cap_usd: 1, cap_jpy: 150 } };
  const root = tmpRoot(prev);
  const r = await M.run({ root, env: ENV, fetchImpl: fakeFetch(), now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  assert.deepStrictEqual([readOut(root).budget.month, readOut(root).budget.spent_usd], ['2026-10', 0.012]);
});

test('失敗（401・429・通信エラー・鍵なし）は error で、既存のスナップショットを消さず、秘密を出さない', async () => {
  const prev = { version: 1, snapshots: [{ at: '2026-10-24T21:40:00.000Z', followers: 1, posts: [] }] };
  for (const opt of [{ meStatus: 401, me: { title: 'Unauthorized' } }, { twStatus: 429, tweets: {} }]) {
    const root = tmpRoot(prev);
    const r = await M.run({ root, env: ENV, fetchImpl: fakeFetch(opt), now: NOW, log: quiet });
    assert.strictEqual(r.result, 'error');
    const j = readOut(root);
    assert.strictEqual(j.snapshots.length, 1);
    assert.ok(!JSON.stringify(j).includes('OAuth'));
  }
  const root = tmpRoot(prev);
  const boom = async () => { throw new Error('secret-token-value'); };
  const r = await M.run({ root, env: ENV, fetchImpl: boom, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'error'); assert.ok(!r.reason.includes('secret-token-value'));
  const r2 = await M.run({ root: tmpRoot(prev), env: {}, fetchImpl: fakeFetch(), now: NOW, log: quiet });
  assert.strictEqual(r2.result, 'error');
});

test('スナップショットは最大180件', async () => {
  const snaps = Array.from({ length: 180 }, (_, i) => ({ at: new Date(Date.UTC(2026, 3, 1 + i)).toISOString(), posts: [] }));
  const root = tmpRoot({ version: 1, snapshots: snaps });
  await M.run({ root, env: ENV, fetchImpl: fakeFetch(), now: NOW, log: quiet });
  const j = readOut(root);
  assert.strictEqual(j.snapshots.length, 180);
  assert.strictEqual(j.snapshots[179].at, NOW.toISOString());
});

test('見張り: 36時間超・error が1日続く・正常・ファイル無し', () => {
  const mk = (at, result) => tmpRoot({ snapshots: [{ at }], last_run: { at, result, reason: 'x' } });
  const n = new Date('2026-10-26T12:00:00Z');
  assert.ok(H.check(mk('2026-10-26T00:00:00Z', 'ok'), n).ok);
  assert.ok(!H.check(mk('2026-10-24T20:00:00Z', 'ok'), n).ok);
  assert.ok(!H.check(mk('2026-10-25T10:00:00Z', 'error'), n).ok);
  assert.ok(H.check(mk('2026-10-26T06:00:00Z', 'error'), n).ok);
  assert.ok(!H.check(tmpRoot(), n).ok);
});
