'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const D = require('../scripts/delete_x_post');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-del-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'data/x_post_log.json'), JSON.stringify({ version: 1, posts: [{ slug: 'a', tweet_id: '111111111', text: 't' }, { slug: 'b', tweet_id: '222222222' }] }));
  return root;
}
const env = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };
const log = (root) => JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8'));
const mk = (status, body) => { const calls = []; const f = async (u, o) => { calls.push({ u, o }); return { status, text: async () => JSON.stringify(body) }; }; f.calls = calls; return f; };

test('既定は試運転: X に送らず台帳も変えない', async () => {
  const root = setup(); const f = mk(200, {});
  const r = await D.run({ id: '111111111', root, env, fetchImpl: f });
  assert.strictEqual(r.code, 'dry_run'); assert.strictEqual(f.calls.length, 0); assert.ok(!log(root).posts[0].deleted_at);
});

test('台帳に無い ID は送らない', async () => {
  const root = setup(); const f = mk(200, {});
  const r = await D.run({ id: '999999999', root, env, yes: true, fetchImpl: f });
  assert.strictEqual(r.code, 'not_in_log'); assert.strictEqual(f.calls.length, 0);
});

test('不正な ID・鍵なしは送らない', async () => {
  const root = setup(); const f = mk(200, {});
  assert.strictEqual((await D.run({ id: '1; rm', root, env, yes: true, fetchImpl: f })).code, 'bad_id');
  assert.strictEqual((await D.run({ id: '111111111', root, env: {}, yes: true, fetchImpl: f })).code, 'no_credentials');
  assert.strictEqual(f.calls.length, 0);
});

test('--yes: DELETE を1回だけ送り、その行だけに deleted_at・理由を残す', async () => {
  const root = setup(); const f = mk(200, { data: { deleted: true } });
  const r = await D.run({ id: '111111111', reason: '理由', root, env, yes: true, fetchImpl: f });
  assert.strictEqual(r.code, 'deleted');
  assert.strictEqual(f.calls.length, 1);
  assert.strictEqual(f.calls[0].u, 'https://api.x.com/2/tweets/111111111');
  assert.strictEqual(f.calls[0].o.method, 'DELETE');
  assert.match(f.calls[0].o.headers.authorization, /^OAuth /);
  const l = log(root);
  assert.ok(l.posts[0].deleted_at); assert.strictEqual(l.posts[0].deleted_reason, '理由'); assert.ok(!l.posts[1].deleted_at);
});

test('X のエラーは台帳を変えない・404 は済み扱い・再実行は送らない', async () => {
  let root = setup();
  assert.strictEqual((await D.run({ id: '111111111', root, env, yes: true, fetchImpl: mk(403, {}) })).ok, false);
  assert.ok(!log(root).posts[0].deleted_at);
  assert.strictEqual((await D.run({ id: '111111111', root, env, yes: true, fetchImpl: mk(404, {}) })).code, 'already_gone');
  const f = mk(200, {});
  assert.strictEqual((await D.run({ id: '111111111', root, env, yes: true, fetchImpl: f })).code, 'already_deleted');
  assert.strictEqual(f.calls.length, 0);
});
