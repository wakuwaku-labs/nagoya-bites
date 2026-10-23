'use strict';
// X 投稿の待ち合わせ（scripts/lib/x_post.js の planWait・scripts/x_post_wait.js）。眠りも git も差し替えて、実際には待たない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('../scripts/lib/x_post');
const W = require('../scripts/x_post_wait');

const policy = { postSlot: { weekday: '12:00', weekend: null, draftWaitMinutes: 15 } };
// JST の時刻で書く（2026-10-23 は金曜・10-24 は土曜）
const jst = (s) => new Date(`${s}+09:00`);

test('planWait: 平日の朝は 12:00 までの秒数', () => {
  const r = X.planWait({ policy, date: '2026-10-23', now: jst('2026-10-23T09:00:00') });
  assert.deepStrictEqual(r, { waitSeconds: 3 * 3600, slot: '12:00', reason: 'wait' });
});

test('planWait: 平日の 13 時・ちょうど 12:00 は 0', () => {
  assert.strictEqual(X.planWait({ policy, date: '2026-10-23', now: jst('2026-10-23T13:00:00') }).waitSeconds, 0);
  assert.strictEqual(X.planWait({ policy, date: '2026-10-23', now: jst('2026-10-23T12:00:00') }).waitSeconds, 0);
});

test('planWait: 土日・過去の日・枠なしは 0', () => {
  assert.deepStrictEqual(X.planWait({ policy, date: '2026-10-24', now: jst('2026-10-24T09:00:00') }), { waitSeconds: 0, slot: null, reason: 'weekend' });
  assert.strictEqual(X.planWait({ policy, date: '2026-10-25', now: jst('2026-10-25T09:00:00') }).waitSeconds, 0);
  assert.strictEqual(X.planWait({ policy, date: '2026-10-22', now: jst('2026-10-23T09:00:00') }).reason, 'not_today');
  assert.strictEqual(X.planWait({ policy: {}, date: '2026-10-23', now: jst('2026-10-23T09:00:00') }).waitSeconds, 0);
  assert.strictEqual(X.planWait({ policy: { postSlot: { weekday: null } }, date: '2026-10-23', now: jst('2026-10-23T09:00:00') }).waitSeconds, 0);
});

test('planWait: JST の日付で判定する（UTC では前日・金曜 23 時台の JST は土曜扱いにならない）', () => {
  // 2026-10-23T23:30 JST = 14:30 UTC。JST でも金曜・枠を過ぎている
  assert.strictEqual(X.planWait({ policy, date: '2026-10-23', now: jst('2026-10-23T23:30:00') }).reason, 'passed');
  // 2026-10-24T00:30 JST = 10-23 15:30 UTC。JST では土曜
  assert.strictEqual(X.planWait({ policy, date: '2026-10-24', now: jst('2026-10-24T00:30:00') }).reason, 'weekend');
});

// --- x_post_wait.js ---
function makeRoot({ mode = 'live', draft = true, posted = false, journal = true, waitMinutes = 3 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xwait-'));
  fs.mkdirSync(path.join(root, 'data/x_post_drafts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify({
    mode, draft: { generate: draft, useInPost: draft }, postSlot: { weekday: '12:00', weekend: null, draftWaitMinutes: waitMinutes },
  }));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({
    entries: journal ? [{ date: '2026-10-23', slug: 's1', title: 't', published_at: '2026-10-23T09:00:00+09:00' }] : [],
  }));
  fs.writeFileSync(path.join(root, 'data/x_post_log.json'), JSON.stringify({ posts: posted ? [{ slug: 's1', status: 'posted' }] : [] }));
  return root;
}
const draftFile = (root) => path.join(root, 'data/x_post_drafts/2026-10-23.json');
const quiet = { log: () => {} };

test('待ち: 平日の朝は 12:00 まで眠り、そのあと pull する', async () => {
  const root = makeRoot();
  fs.writeFileSync(draftFile(root), '{}');
  const slept = []; let pulls = 0;
  const r = await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T09:00:00'), sleep: async (ms) => slept.push(ms), pull: () => { pulls++; return { ok: true }; }, ...quiet });
  assert.deepStrictEqual(slept, [3 * 3600 * 1000]);
  assert.strictEqual(pulls, 1);
  assert.strictEqual(r.result, 'done');
});

test('待ち: mode が off・ジャーナル無し・投稿済みは眠らない', async () => {
  for (const [opts, result] of [[{ mode: 'off' }, 'off'], [{ journal: false }, 'no_journal'], [{ posted: true }, 'already_posted']]) {
    const root = makeRoot(opts);
    const slept = [];
    const r = await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T09:00:00'), sleep: async (ms) => slept.push(ms), pull: () => ({ ok: true }), ...quiet });
    assert.strictEqual(r.result, result);
    assert.deepStrictEqual(slept, []);
  }
});

test('文面待ち: 文面が無ければ 1 分おきに pull し、最大回数で抜ける', async () => {
  const root = makeRoot({ waitMinutes: 3 });
  const slept = []; let pulls = 0;
  const r = await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T13:00:00'), sleep: async (ms) => slept.push(ms), pull: () => { pulls++; return { ok: true }; }, ...quiet });
  assert.deepStrictEqual(slept, [60000, 60000, 60000]);
  assert.strictEqual(pulls, 3);
  assert.strictEqual(r.draftWaited, 3);
  assert.ok(!r.draftArrived);
  assert.strictEqual(r.result, 'done');
});

test('文面待ち: 途中で文面が現れたら抜ける', async () => {
  const root = makeRoot({ waitMinutes: 5 });
  let pulls = 0;
  const r = await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T13:00:00'), sleep: async () => {}, pull: () => { pulls++; if (pulls === 2) fs.writeFileSync(draftFile(root), '{}'); return { ok: true }; }, ...quiet });
  assert.strictEqual(pulls, 2);
  assert.strictEqual(r.draftArrived, true);
});

test('文面待ち: 文面の生成を使わない設定・待ち 0 分なら待たない', async () => {
  for (const opts of [{ draft: false }, { waitMinutes: 0 }]) {
    const root = makeRoot(opts);
    const slept = [];
    await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T13:00:00'), sleep: async (ms) => slept.push(ms), pull: () => ({ ok: true }), ...quiet });
    assert.deepStrictEqual(slept, []);
  }
});

test('git が失敗しても投げず、警告を出して続ける', async () => {
  const root = makeRoot({ waitMinutes: 2 });
  const logs = [];
  const r = await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T09:00:00'), sleep: async () => {}, pull: () => ({ ok: false, error: 'network' }), log: (m) => logs.push(m) });
  assert.strictEqual(r.result, 'done');
  assert.ok(logs.some((m) => m.includes('警告') && m.includes('network')));
});

test('parseArgs: --date と --now だけ受ける', () => {
  assert.deepStrictEqual(W.parseArgs(['--date', '2026-10-23']), { date: '2026-10-23', now: false });
  assert.throws(() => W.parseArgs(['--x']));
  assert.throws(() => W.parseArgs(['--date', 'abc']));
});

test('待ち: maxWaitMinutes を超える分は眠らない（早朝の公開でもジョブの上限に収める）', async () => {
  const root = makeRoot();
  fs.writeFileSync(draftFile(root), '{}');
  const pol = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_policy.json'), 'utf8'));
  pol.postSlot.maxWaitMinutes = 300;
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify(pol));
  const slept = [];
  // 05:00 JST → 12:00 まで 7 時間だが、上限の 300 分だけ眠る
  const r = await W.run({ date: '2026-10-23' }, { root, now: () => jst('2026-10-23T05:00:00'), sleep: async (ms) => slept.push(ms), pull: () => ({ ok: true }), ...quiet });
  assert.deepStrictEqual(slept, [300 * 60 * 1000]);
  assert.strictEqual(r.slept, 300 * 60);
});

test('待ち: --now は平日の朝でも枠を待たない（文面があれば即抜ける）', async () => {
  const root = makeRoot();
  fs.writeFileSync(draftFile(root), '{}');
  const slept = [];
  const r = await W.run({ date: '2026-10-23', now: true }, { root, now: () => jst('2026-10-23T09:00:00'), sleep: async (ms) => slept.push(ms), pull: () => ({ ok: true }), ...quiet });
  assert.deepStrictEqual(slept, []);
  assert.strictEqual(r.plan.reason, 'now');
  assert.deepStrictEqual(W.parseArgs(['--date', '2026-10-23', '--now']), { date: '2026-10-23', now: true });
});
