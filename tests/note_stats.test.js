'use strict';
// note の自分の記事の数字（scripts/fetch_note_stats.js）と、note-next.json の「今週試す1つ」（scripts/build_note_draft.js）。
// note にも iCloud にも触らない（偽の読み手・一時フォルダ）。docs/decisions/0059
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('../scripts/fetch_note_stats');
const B = require('../scripts/build_note_draft');

const REAL_ROOT = path.resolve(__dirname, '..');
const NOW = new Date('2026-11-08T22:30:00Z'); // JST 11-09 07:30
const NEXT_NOW = new Date('2026-11-09T01:00:00Z');

function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

function repoRoot() {
  const root = tmp('nstats-root-');
  fs.mkdirSync(path.join(root, 'data'));
  fs.copyFileSync(path.join(REAL_ROOT, 'data/note_post_policy.json'), path.join(root, 'data/note_post_policy.json'));
  fs.writeFileSync(path.join(root, 'data/note_post_log.json'), JSON.stringify({ entries: [
    { slug: 'a-1', date: '2026-11-01', status: 'live', url: 'https://note.com/nagoya_bites/n/n0001aaaa?app_launch=false' },
    { slug: 'b-2', date: '2026-11-02', status: 'live', url: 'https://note.com/nagoya_bites/n/n0002bbbb' },
    { slug: 'c-3', date: '2026-11-03', status: 'draft', url: 'https://note.com/nagoya_bites/n/n0003cccc' },
  ] }));
  return root;
}

const stat = (key, v, l, c) => ({ key, name: key, read_count: v, like_count: l, comment_count: c });
const pvBody = (items, last = 1) => JSON.stringify({ data: { note_stats: items, last_page: last } });

function fakeReader({ user = { nickname: 'NAGOYA BITES', urlname: 'nagoya_bites' }, pv = [{ status: 200, text: pvBody([stat('n0001aaaa', 10, 2, 1), stat('n0002bbbb', 5, 0, 0), stat('n9999zzzz', 1, 1, 1)]) }], creator } = {}) {
  const calls = [];
  let i = 0;
  const r = {
    calls,
    currentUser: async () => user,
    get: async (url) => {
      calls.push(url);
      if (url.includes('/stats/pv')) return pv[Math.min(i++, pv.length - 1)];
      return creator || { status: 200, text: JSON.stringify({ data: { followerCount: 42 } }) };
    },
    close: async () => {},
  };
  return r;
}

function withDir(fn) {
  return async () => {
    const dir = tmp('nstats-icloud-');
    process.env.SNS_ANALYZER_X_DIR = dir;
    try { await fn(dir); } finally { delete process.env.SNS_ANALYZER_X_DIR; }
  };
}
const readOut = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'note_metrics.json'), 'utf8'));

test('正常: 台帳にある公開済みの記事だけを保存し、フォロワーも残す。本文は保存しない', withDir(async (dir) => {
  const reader = fakeReader();
  const r = await F.run({}, { root: repoRoot(), now: NOW, reader });
  assert.strictEqual(r.result, 'ok');
  assert.strictEqual(r.articles_read, 2, '台帳に無い記事（n9999zzzz）と下書きは入れない');
  const j = readOut(dir);
  assert.strictEqual(j.schema, 'note-metrics/1');
  assert.deepStrictEqual(j.articles.map((a) => [a.slug, a.note_key]), [['a-1', 'n0001aaaa'], ['b-2', 'n0002bbbb']]);
  assert.deepStrictEqual(j.articles[0].snapshots, [{ fetched_at: NOW.toISOString(), views: 10, likes: 2, comments: 1 }]);
  assert.deepStrictEqual(j.followers, [{ fetched_at: NOW.toISOString(), count: 42 }]);
  assert.strictEqual(j.updated_at, NOW.toISOString());
  assert.ok(reader.calls.length <= 6);
  assert.ok(reader.calls.every((u) => /^https:\/\/note\.com\/api\/v[12]\/(stats\/pv|creators\/nagoya_bites$)/.test(u.split('?')[0]) || u.includes('/stats/pv')), '読む先は自分の統計とプロフィールだけ');
}));

test('同じ日に2回動いても行は増えず、翌日は足される。既存のキーは残る', withDir(async (dir) => {
  const root = repoRoot();
  await F.run({}, { root, now: NOW, reader: fakeReader() });
  const j0 = readOut(dir); j0.extra_key = 'keep'; fs.writeFileSync(path.join(dir, 'note_metrics.json'), JSON.stringify(j0));
  await F.run({}, { root, now: new Date(NOW.getTime() + 3600000), reader: fakeReader() });
  let j = readOut(dir);
  assert.strictEqual(j.articles[0].snapshots.length, 1);
  assert.strictEqual(j.followers.length, 1);
  assert.strictEqual(j.extra_key, 'keep');
  await F.run({}, { root, now: new Date(NOW.getTime() + 86400000), reader: fakeReader() });
  j = readOut(dir);
  assert.strictEqual(j.articles[0].snapshots.length, 2);
  assert.strictEqual(j.followers.length, 2);
}));

test('複数ページ: last_page まで（最大5ページ）読む', withDir(async () => {
  const reader = fakeReader({ pv: [
    { status: 200, text: pvBody([stat('n0001aaaa', 1, 1, 1)], 2) },
    { status: 200, text: pvBody([stat('n0002bbbb', 2, 2, 2)], 2) },
  ] });
  const r = await F.run({}, { root: repoRoot(), now: NOW, reader });
  assert.strictEqual(r.articles_read, 2);
  assert.strictEqual(reader.calls.filter((u) => u.includes('/stats/pv')).length, 2);
}));

test('失敗は保存せずに止まる: 401・403・形の違い・空・未ログイン・別アカウント', withDir(async (dir) => {
  const root = repoRoot();
  const cases = [
    ['401', fakeReader({ pv: [{ status: 401, text: '{}' }] }), 'auth'],
    ['403', fakeReader({ pv: [{ status: 403, text: '{}' }] }), 'auth'],
    ['500', fakeReader({ pv: [{ status: 500, text: '' }] }), 'http'],
    ['HTML が返る', fakeReader({ pv: [{ status: 200, text: '<html>' }] }), 'shape'],
    ['note_stats が無い', fakeReader({ pv: [{ status: 200, text: JSON.stringify({ data: {} }) }] }), 'shape'],
    ['項目の型が違う', fakeReader({ pv: [{ status: 200, text: pvBody([{ key: 'n0001aaaa', read_count: '10', like_count: 1, comment_count: 1 }]) }] }), 'shape'],
    ['空', fakeReader({ pv: [{ status: 200, text: pvBody([]) }] }), 'empty'],
    ['台帳と一致しない', fakeReader({ pv: [{ status: 200, text: pvBody([stat('nXXXX', 1, 1, 1)]) }] }), 'shape'],
    ['未ログイン', fakeReader({ user: null }), 'auth'],
    ['別アカウント', fakeReader({ user: { nickname: 'vide太郎', urlname: 'vide' } }), 'account'],
    ['フォロワー取得が 403', fakeReader({ creator: { status: 403, text: '{}' } }), 'auth'],
  ];
  for (const [name, reader, cls] of cases) {
    const r = await F.run({}, { root, now: NOW, reader });
    assert.strictEqual(r.result, 'failed', name);
    assert.strictEqual(r.error_class, cls, name);
    assert.ok(!fs.existsSync(path.join(dir, 'note_metrics.json')), `${name}: 失敗した日は何も保存しない`);
  }
}));

test('失敗の理由は既存の蓄積に last_run として残り、蓄積は消えない。壊れた保存先は上書きしない', withDir(async (dir) => {
  const root = repoRoot();
  await F.run({}, { root, now: NOW, reader: fakeReader() });
  const before = readOut(dir);
  const r = await F.run({}, { root, now: new Date(NOW.getTime() + 86400000), reader: fakeReader({ pv: [{ status: 403, text: '{}' }] }) });
  assert.strictEqual(r.result, 'failed');
  const after = readOut(dir);
  assert.deepStrictEqual(after.articles, before.articles);
  assert.strictEqual(after.last_run.result, 'failed');
  assert.strictEqual(after.last_run.error_class, 'auth');

  fs.writeFileSync(path.join(dir, 'note_metrics.json'), '{broken');
  const r2 = await F.run({}, { root, now: new Date(NOW.getTime() + 2 * 86400000), reader: fakeReader() });
  assert.strictEqual(r2.result, 'failed');
  assert.strictEqual(r2.error_class, 'storage');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'note_metrics.json'), 'utf8'), '{broken');
}));

test('フォロワー数が応答に無くても失敗にしない（null と理由）。書き込み系の通信は無い', withDir(async (dir) => {
  const reader = fakeReader({ creator: { status: 200, text: JSON.stringify({ data: {} }) } });
  const r = await F.run({}, { root: repoRoot(), now: NOW, reader });
  assert.strictEqual(r.result, 'ok');
  const j = readOut(dir);
  assert.deepStrictEqual(j.followers, []);
  assert.strictEqual(j.last_run.followers_unavailable_reason, 'follower_count_missing');
  assert.ok(reader.calls.every((u) => typeof u === 'string'), 'get だけ（POST の口が無い）');
}));

test('--dry-run: 通信も保存もしない。AI の環境判定', withDir(async (dir) => {
  let touched = false;
  const r = await F.run({ dryRun: true }, { root: repoRoot(), now: NOW, reader: { currentUser: () => { touched = true; }, get: () => { touched = true; } }, openReader: () => { touched = true; } });
  assert.strictEqual(r.result, 'dry_run');
  assert.strictEqual(touched, false);
  assert.ok(!fs.existsSync(path.join(dir, 'note_metrics.json')));
  assert.strictEqual(F.inAiEnvironment({ CLAUDECODE: '1' }), true);
  assert.strictEqual(F.inAiEnvironment({}), false);
  assert.deepStrictEqual(F.parseArgs(['--dry-run']), { dryRun: true, json: false });
  assert.throws(() => F.parseArgs(['--live']));
}));

// ── note-next.json ────────────────────────────────────────────────────
function nextFile(over) {
  const dir = tmp('nnext-');
  const doc = { schema: 'note-next/1', account: 'nagoya_bites', generated_at: '2026-11-08T21:30:00.000Z', judgement: 'insufficient_data',
    try: { knob: 'sections', value: 2, experiment_id: 'note-sections-1' }, notes: [], ...over };
  fs.writeFileSync(path.join(dir, 'note-next.json'), typeof over === 'string' ? over : JSON.stringify(doc));
  process.env.SNS_ANALYZER_X_DIR = dir;
}
test.after(() => { delete process.env.SNS_ANALYZER_X_DIR; });

test('note-next: sections と title_style を読む。範囲外・知らない knob・壊れ・古い・schema 違い・try が null は今までどおり', () => {
  nextFile({});
  assert.deepStrictEqual(B.loadNoteTry(NEXT_NOW), { knob: 'sections', value: 2, experiment_id: 'note-sections-1' });
  nextFile({ try: { knob: 'sections', value: '3', experiment_id: 'x' } });
  assert.strictEqual(B.loadNoteTry(NEXT_NOW).value, 3);
  nextFile({ try: { knob: 'title_style', value: 'short', experiment_id: 'x' } });
  assert.strictEqual(B.loadNoteTry(NEXT_NOW).value, 'short');
  for (const bad of [
    { try: { knob: 'sections', value: 0 } }, { try: { knob: 'sections', value: 5 } }, { try: { knob: 'sections', value: 1.5 } },
    { try: { knob: 'sections', value: 'many' } }, { try: { knob: 'title_style', value: 'shout' } }, { try: { knob: 'select_order', value: 'reaction' } },
    { try: null }, { schema: 'note-next/2' }, { generated_at: '2026-10-01T00:00:00.000Z' },
  ]) { nextFile(bad); assert.strictEqual(B.loadNoteTry(NEXT_NOW), null, JSON.stringify(bad)); }
  nextFile('{broken');
  assert.strictEqual(B.loadNoteTry(NEXT_NOW), null);
  process.env.SNS_ANALYZER_X_DIR = tmp('nnext-empty-');
  assert.strictEqual(B.loadNoteTry(NEXT_NOW), null);
});

test('note-next: sections は抜粋の節の数に、title_style short は題名に効く。full 本文モードと無指定は変えない', () => {
  const policy = { body: { mode: 'excerpt', sections: 1 }, titleMax: 100 };
  assert.strictEqual(B.applyTry(policy, { knob: 'sections', value: 3 }).policy.body.sections, 3);
  assert.strictEqual(B.applyTry(policy, null).policy, policy);
  const full = { body: { mode: 'full', sections: 1 } };
  assert.strictEqual(B.applyTry(full, { knob: 'sections', value: 3 }).policy, full);
  const t = '池下のイタリアン「QQ」でデート、棚のワインと抜栓料20%';
  assert.strictEqual(B.applyTry(policy, { knob: 'title_style', value: 'short' }).applyTitle(t), '池下のイタリアン「QQ」でデート');
  assert.strictEqual(B.shortTitle('短い、題'), '短い、題', '12字未満になるなら今まで');
  assert.strictEqual(B.shortTitle('区切りの無い題名'), '区切りの無い題名');
  assert.strictEqual(B.applyTry(policy, { knob: 'title_style', value: 'full' }).applyTitle(t), t);
});
