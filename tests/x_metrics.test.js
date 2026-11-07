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

function tmpRoot(initial, ledger) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xm-'));
  fs.mkdirSync(path.join(root, 'data'));
  if (initial) fs.writeFileSync(path.join(root, 'data/x_metrics.json'), JSON.stringify(initial));
  if (ledger) fs.writeFileSync(path.join(root, 'data/x_post_log.json'), JSON.stringify({ version: 1, posts: ledger }));
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
      : (tweets || { data: [] });
    return { status, text: async () => JSON.stringify(body) };
  };
  f.calls = calls;
  return f;
}
const NOW = new Date('2026-10-25T21:40:05.000Z');
const pm = (n) => ({ impression_count: n, like_count: 3, retweet_count: 0, reply_count: 1, quote_count: 0, bookmark_count: 0 });
const lp = (id, postedAt, replies = []) => ({ date: postedAt.slice(0, 10), slug: `s${id}`, status: 'posted', tweet_id: id, posted_at: postedAt, ...(replies.length ? { thread: { replies: replies.map((r) => ({ tweet_id: r, text: 'r' })) } } : {}) });
// 台帳: 1 = 1.5 日前（1 日の節目）／2 = 10 時間前（まだ）／3 = 40 日前（30 日超）／4 = 失敗（tweet_id 無し）
const LEDGER = [
  lp('1', '2026-10-24T09:40:00.000Z', ['11', '12']),
  lp('2', '2026-10-25T11:40:00.000Z'),
  lp('3', '2026-09-15T00:00:00.000Z'),
  { date: '2026-10-24', slug: 's4', status: 'failed' },
];
const TL = { data: [
  { id: '2', created_at: '2026-10-25T11:40:00.000Z', text: 'b', public_metrics: pm(5) },
  { id: '12', created_at: '2026-10-24T09:41:00.000Z', text: 'reply2', public_metrics: pm(7) },
  { id: '11', created_at: '2026-10-24T09:40:30.000Z', text: 'reply1', public_metrics: pm(8) },
  { id: '1', created_at: '2026-10-24T09:40:00.000Z', text: 'あ'.repeat(100), attachments: { media_keys: ['m1'] }, public_metrics: pm(120) },
], includes: { media: [{ media_key: 'm1', type: 'video', public_metrics: { view_count: 33 } }] } };

test('見積は 取得件数ゼロで $0.01、n 件で 単価×n を足す', () => {
  assert.strictEqual(M.estimate(), 0.01);
  assert.strictEqual(M.estimateFor('timeline', 20), 0.03);
  assert.strictEqual(M.estimateFor('ids', 20), 0.11);
});

test('dry-run は通信せず何も書かない', async () => {
  const root = tmpRoot(null, LEDGER); const f = fakeFetch(); const lines = [];
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, dryRun: true, log: (l) => lines.push(l) });
  assert.strictEqual(f.calls.length, 0);
  assert.ok(!fs.existsSync(path.join(root, 'data/x_metrics.json')));
  assert.strictEqual(r.result, 'skipped');
  assert.ok(lines[0].includes('今日取る投稿 1件'));
});

test('正常: 台帳の先頭だけ記録（スレッドの続き・30日超は対象外）。既存のキーは今までと同じ形', async () => {
  const root = tmpRoot(null, LEDGER); const f = fakeFetch({ tweets: TL });
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  const j = readOut(root);
  assert.strictEqual(j.version, 1);
  assert.deepStrictEqual(j.account, { id: '77', username: 'nagoya_bites', name: 'NAGOYA BITES' });
  const s = j.snapshots[0];
  assert.deepStrictEqual([s.at, s.followers, s.following, s.tweet_count], [NOW.toISOString(), 12, 3, 40]);
  assert.deepStrictEqual(s.posts.map((p) => p.id), ['1']);
  const p = s.posts[0];
  // Ondine（server/domain/sns.js）が読むキー: id・text・url・created_at・impressions・likes・reposts・replies・bookmarks（quotes も残す）
  for (const k of ['id', 'created_at', 'text', 'url', 'impressions', 'likes', 'reposts', 'replies', 'quotes', 'bookmarks']) assert.ok(k in p, k);
  assert.deepStrictEqual([p.impressions, p.likes, p.replies, p.url, p.text.length], [120, 3, 1, 'https://x.com/nagoya_bites/status/1', 80]);
  assert.deepStrictEqual([p.video_views, p.milestone_days], [33, 1]);
  assert.deepStrictEqual(s.posts_fetch, { status: 'ok', mode: 'timeline', due: 1, fetched: 1, returned: 4 });
  assert.deepStrictEqual(Object.keys(j).sort(), ['_comment', 'account', 'budget', 'last_run', 'snapshots', 'version']);
  assert.deepStrictEqual(j.budget, { month: '2026-10', spent_usd: 0.014, cap_usd: 1, cap_jpy: 150 });
  assert.deepStrictEqual(j.last_run, { at: NOW.toISOString(), result: 'ok', reason: null });
  const u = new URL(f.calls[1].url);
  assert.strictEqual(u.pathname, '/2/users/77/tweets');
  // 最も古い対象（投稿 1）より新しい分: 先頭 1 + 続き 2 + 投稿 2 の 1 = 4 件 + 余裕 3 = 7 件
  assert.strictEqual(u.searchParams.get('max_results'), '7');
  assert.ok(u.searchParams.get('media.fields'));
  assert.ok(!f.calls[1].url.includes('non_public') && !f.calls[1].url.includes('organic'));
});

test('動画の再生数が応答に無くても失敗にならない（null）', async () => {
  const root = tmpRoot(null, LEDGER);
  const tl = { data: [{ id: '1', created_at: '2026-10-24T09:40:00.000Z', text: 'x', public_metrics: pm(1) }] };
  const r = await M.run({ root, env: ENV, fetchImpl: fakeFetch({ tweets: tl }), now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  assert.strictEqual(readOut(root).snapshots[0].posts[0].video_views, null);
});

test('取る投稿が無い日はタイムラインを呼ばない（users/me だけ）', async () => {
  const root = tmpRoot(null, [lp('2', '2026-10-25T11:40:00.000Z')]); const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok'); assert.strictEqual(f.calls.length, 1);
  assert.deepStrictEqual(readOut(root).snapshots[0].posts, []);
  assert.strictEqual(readOut(root).budget.spent_usd, 0.01);
});

test('節目は 1 回ずつ: 取った節目は再取得せず、前回の値を carried で写す。30 日超・節目の遡りはしない', async () => {
  const root = tmpRoot(null, LEDGER);
  await M.run({ root, env: ENV, fetchImpl: fakeFetch({ tweets: TL }), now: NOW, log: quiet });
  const f = fakeFetch({ tweets: TL });
  const next = new Date('2026-10-26T21:40:00.000Z'); // 投稿 1 は 2.5 日（1 日は取得済み・3 日はまだ）
  await M.run({ root, env: ENV, fetchImpl: f, now: next, log: quiet });
  assert.strictEqual(f.calls.length, 2); // 投稿 2 が 1 日の節目に入った分だけ取る
  const s = readOut(root).snapshots[1];
  const c1 = s.posts.find((p) => p.id === '1');
  assert.strictEqual(c1.carried, true); assert.strictEqual(c1.impressions, 120);
  assert.ok(!s.posts.find((p) => p.id === '2').carried);
  // 3 日の節目に達したら取り直す
  const f3 = fakeFetch({ tweets: { data: [{ id: '1', created_at: '2026-10-24T09:40:00.000Z', text: 'x', public_metrics: pm(300) }] } });
  await M.run({ root, env: ENV, fetchImpl: f3, now: new Date('2026-10-27T21:40:00.000Z'), log: quiet });
  const s3 = readOut(root).snapshots[2].posts.find((p) => p.id === '1');
  assert.deepStrictEqual([s3.impressions, s3.carried, s3.milestone_days], [300, undefined, 3]);
  // 節目を大きく過ぎた古い投稿（30 日超）は対象にならない
  assert.deepStrictEqual(M.plan({ root, snapshots: [], now: NOW, mode: 'timeline' }).due.map((d) => d.id), ['1']);
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

test('ids 方式（既定オフ）: GET /2/tweets?ids= で先頭だけ・節目は 1・3・7・単価 $0.005', async () => {
  const root = tmpRoot(null, LEDGER); const f = fakeFetch({ tweets: TL });
  const r = await M.run({ root, env: { ...ENV, X_METRICS_FETCH_MODE: 'ids' }, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  const u = new URL(f.calls[1].url);
  assert.strictEqual(u.pathname, '/2/tweets'); assert.strictEqual(u.searchParams.get('ids'), '1');
  const j = readOut(root);
  assert.deepStrictEqual(j.snapshots[0].posts.map((p) => p.id), ['1']);
  assert.strictEqual(j.budget.spent_usd, 0.03); // 0.01 + 返った 4 件 × 0.005（高い方で数える）
  assert.deepStrictEqual(M.milestonesFor('ids'), [1, 3, 7]);
});

test('投稿の取得が 401・403 でも落ちず、取得不可を記録してフォロワーは残す', async () => {
  for (const st of [401, 403]) {
    const root = tmpRoot(null, LEDGER);
    const r = await M.run({ root, env: ENV, fetchImpl: fakeFetch({ twStatus: st, tweets: { title: 'x' } }), now: NOW, log: quiet });
    assert.strictEqual(r.result, 'error');
    const s = readOut(root).snapshots[0];
    assert.strictEqual(s.followers, 12);
    assert.strictEqual(s.posts_fetch.status, 'unavailable');
    assert.ok(s.posts_fetch.reason.includes(String(st)));
  }
});

test('投稿の取得が失敗しても投稿処理（post_journal_to_x）は影響を受けない: 取得は台帳を書かない', async () => {
  const root = tmpRoot(null, LEDGER);
  const before = fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8');
  await M.run({ root, env: ENV, fetchImpl: async () => { throw new Error('boom'); }, now: NOW, log: quiet });
  assert.strictEqual(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8'), before);
});

test('同じ UTC 日は呼ばない。--force は上書き（件数が増えない）', async () => {
  const root = tmpRoot(null, LEDGER);
  await M.run({ root, env: ENV, fetchImpl: fakeFetch({ tweets: TL }), now: NOW, log: quiet });
  const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: new Date('2026-10-25T23:00:00Z'), log: quiet });
  assert.strictEqual(r.result, 'skipped'); assert.strictEqual(f.calls.length, 0);
  assert.strictEqual(readOut(root).snapshots.length, 1);
  const r2 = await M.run({ root, env: ENV, fetchImpl: fakeFetch({ tweets: TL }), now: new Date('2026-10-25T23:00:00Z'), force: true, log: quiet });
  assert.strictEqual(r2.result, 'ok');
  assert.strictEqual(readOut(root).snapshots.length, 1);
});

test('上限を超える見積なら呼ばず budget。既存のスナップショットは残る', async () => {
  const prev = { version: 1, snapshots: [{ at: '2026-10-24T21:40:00.000Z', followers: 1, posts: [] }], budget: { month: '2026-10', spent_usd: 0.995, cap_usd: 1, cap_jpy: 150 } };
  const root = tmpRoot(prev); const f = fakeFetch();
  const r = await M.run({ root, env: ENV, fetchImpl: f, now: NOW, log: quiet });
  assert.strictEqual(r.result, 'budget'); assert.strictEqual(f.calls.length, 0);
  const j = readOut(root);
  assert.strictEqual(j.snapshots.length, 1); assert.strictEqual(j.last_run.result, 'budget');
  // ちょうど上限に収まるなら呼ぶ
  const root2 = tmpRoot({ ...prev, budget: { month: '2026-10', spent_usd: 0.99, cap_usd: 1, cap_jpy: 150 } });
  assert.strictEqual((await M.run({ root: root2, env: ENV, fetchImpl: fakeFetch(), now: NOW, log: quiet })).result, 'ok');
  // 取得件数が増えて上限を超える場合も止まる
  const root3 = tmpRoot({ ...prev, budget: { month: '2026-10', spent_usd: 0.99, cap_usd: 1, cap_jpy: 150 } }, LEDGER);
  assert.strictEqual((await M.run({ root: root3, env: ENV, fetchImpl: fakeFetch({ tweets: TL }), now: NOW, log: quiet })).result, 'budget');
});

test('月が変わると使用額は 0 から', async () => {
  const prev = { version: 1, snapshots: [], budget: { month: '2026-09', spent_usd: 0.99, cap_usd: 1, cap_jpy: 150 } };
  const root = tmpRoot(prev);
  const r = await M.run({ root, env: ENV, fetchImpl: fakeFetch(), now: NOW, log: quiet });
  assert.strictEqual(r.result, 'ok');
  assert.deepStrictEqual([readOut(root).budget.month, readOut(root).budget.spent_usd], ['2026-10', 0.01]);
});

test('失敗（401・429・通信エラー・鍵なし）は error で、既存のスナップショットを消さず、秘密を出さない', async () => {
  const prev = { version: 1, snapshots: [{ at: '2026-10-24T21:40:00.000Z', followers: 1, posts: [] }] };
  for (const opt of [{ meStatus: 401, me: { title: 'Unauthorized' } }, { twStatus: 429, tweets: {} }]) {
    const root = tmpRoot(prev, LEDGER);
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

// ── 一回限りの試し（--probe-nonpublic）──────────────────────────────────
function probeFetch(status, body) {
  const calls = [];
  const f = async (url, opts) => { calls.push({ url, auth: opts.headers.authorization }); return { status, text: async () => JSON.stringify(body) }; };
  f.calls = calls;
  return f;
}

test('probe: 自分の最新の投稿 1 件に 1 回だけ頼み、項目名と値の有無を残す（本文・鍵は残さない・通常の取得はしない）', async () => {
  const root = tmpRoot(null, LEDGER); const lines = [];
  const f = probeFetch(200, { data: [{ id: '2', text: 'ひみつの本文', edit_history_tweet_ids: ['2'], public_metrics: pm(5), non_public_metrics: { impression_count: 9, url_link_clicks: 1, user_profile_clicks: null }, attachments: { media_keys: ['m1'] } }],
    includes: { media: [{ media_key: 'm1', public_metrics: { view_count: 4 }, non_public_metrics: { playback_50_count: 2 } }] } });
  const r = await M.probeNonpublic({ root, env: ENV, fetchImpl: f, now: NOW, log: (l) => lines.push(l) });
  assert.strictEqual(f.calls.length, 1);
  assert.ok(f.calls[0].url.includes('/2/tweets?') && f.calls[0].url.includes('ids=2') && !f.calls[0].url.includes('users/me'));
  assert.ok(decodeURIComponent(f.calls[0].url).includes('non_public_metrics,organic_metrics,public_metrics'));
  assert.ok(decodeURIComponent(f.calls[0].url).includes('attachments.media_keys'));
  assert.strictEqual(r.result, 'ok');
  assert.deepStrictEqual(r.non_public_metrics, { impression_count: 9, url_link_clicks: 1, user_profile_clicks: null });
  assert.deepStrictEqual(r.media_non_public_metrics, [{ playback_50_count: 2 }]);
  const out = readOut(root);
  assert.strictEqual(out.budget.spent_usd, 0.005);
  assert.strictEqual(out.snapshots.length, 0);
  const all = JSON.stringify(out) + lines.join('\n');
  assert.ok(!all.includes('ひみつの本文'));
  assert.ok(!/oauth_signature|OAuth /i.test(all));
});

test('probe: 403 は取得不可として HTTP 状態を残し落ちない／上限・鍵なし・対象なしは呼ばない', async () => {
  const root = tmpRoot(null, LEDGER);
  const r = await M.probeNonpublic({ root, env: ENV, fetchImpl: probeFetch(403, { title: 'Forbidden', detail: 'x' }), now: NOW, log: quiet });
  assert.strictEqual(r.result, 'unavailable');
  assert.strictEqual(r.http_status, 403);
  assert.ok(/403/.test(r.reason));
  const f = probeFetch(200, {});
  const over = tmpRoot({ version: 1, snapshots: [], budget: { month: '2026-10', spent_usd: 0.999 } }, LEDGER);
  assert.strictEqual((await M.probeNonpublic({ root: over, env: ENV, fetchImpl: f, now: NOW, log: quiet })).result, 'budget');
  assert.strictEqual((await M.probeNonpublic({ root: tmpRoot(null, LEDGER), env: {}, fetchImpl: f, now: NOW, log: quiet })).result, 'error');
  assert.strictEqual((await M.probeNonpublic({ root: tmpRoot(null, []), env: ENV, fetchImpl: f, now: NOW, log: quiet })).result, 'no_target');
  assert.strictEqual(f.calls.length, 0);
});
