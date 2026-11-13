'use strict';
/**
 * X の投稿を1件消す（本人の指示があったときだけ使う）。
 *   node scripts/delete_x_post.js --id <tweet_id> [--reason 理由] [--yes]
 * - 消せるのは data/x_post_log.json に載っている tweet_id（親投稿）だけ。載っていない ID は何もせず止まる。
 * - 既定は試運転（X に送らない）。--yes のときだけ DELETE https://api.x.com/2/tweets/:id を送る。
 * - 成功したら（または X が「すでに無い」と答えたら）台帳のその行に deleted_at と deleted_reason を残す。
 * 鍵（GitHub Secrets）: X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
 */
const X = require('./lib/x_post');

const API = 'https://api.x.com/2/tweets/';

function credentials(env = process.env) {
  const c = { consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET };
  return Object.values(c).every(Boolean) ? c : null;
}

/** 台帳から対象の行を探す。返り値: 行 か null */
function findEntry(log, id) {
  return (log.posts || []).find((p) => p.tweet_id === String(id)) || null;
}

async function run({ id, reason = '', yes = false, root = X.ROOT, env = process.env, fetchImpl = fetch, now = new Date() }) {
  if (!/^\d{5,25}$/.test(String(id || ''))) return { ok: false, code: 'bad_id' };
  const log = X.readLog(root);
  const entry = findEntry(log, id);
  if (!entry) return { ok: false, code: 'not_in_log' };
  if (entry.deleted_at) return { ok: true, code: 'already_deleted', deleted_at: entry.deleted_at };
  if (!yes) return { ok: true, code: 'dry_run', slug: entry.slug, text: entry.text };
  const cred = credentials(env);
  if (!cred) return { ok: false, code: 'no_credentials' };
  const url = API + String(id);
  const res = await fetchImpl(url, { method: 'DELETE', headers: { authorization: X.oauthHeader({ method: 'DELETE', url, ...cred }) } });
  let body = null;
  try { body = JSON.parse(await res.text()); } catch (_) { /* 本文が JSON でなくても続ける */ }
  const deleted = res.status === 200 && body && body.data && body.data.deleted === true;
  const gone = res.status === 404; // すでに無い
  if (!deleted && !gone) return { ok: false, code: 'x_error', status: res.status, kind: X.classifyError(res.status, body) };
  entry.deleted_at = now.toISOString();
  entry.deleted_reason = String(reason || '').slice(0, 200);
  X.writeJson(X.LOG_REL, log, root);
  return { ok: true, code: deleted ? 'deleted' : 'already_gone', deleted_at: entry.deleted_at };
}

function parseArgs(argv) {
  const a = { yes: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--yes') a.yes = true;
    else if (argv[i] === '--id') a.id = argv[++i];
    else if (argv[i] === '--reason') a.reason = argv[++i];
  }
  return a;
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2))).then((r) => {
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => { console.error(`失敗: ${e.message}`); process.exit(1); });
}

module.exports = { run, findEntry, credentials, parseArgs };
