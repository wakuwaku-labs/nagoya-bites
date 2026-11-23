'use strict';
/**
 * X のアカウントの有料プランを確かめる（読み取りだけ・投稿しない・ADR 0082）。
 * GET /2/users/me?user.fields=subscription_type,verified_type。鍵は x-post.yml と同じ環境変数。
 * 出力: username・subscription_type（None / Basic / Premium / PremiumPlus など）・verified_type。鍵の中身は出さない。
 */
const X = require('./lib/x_post');

const URL_BASE = 'https://api.x.com/2/users/me';
const PARAMS = { 'user.fields': 'subscription_type,verified_type' };

async function run(env = process.env, fetchImpl = fetch) {
  const cred = {
    consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET,
  };
  if (Object.values(cred).some((v) => !v)) return { ok: false, reason: 'no_credentials' };
  const auth = X.oauthHeader({ method: 'GET', url: URL_BASE, params: PARAMS, ...cred });
  const qs = Object.entries(PARAMS).map(([k, v]) => `${X.pct(k)}=${X.pct(v)}`).join('&');
  const res = await fetchImpl(`${URL_BASE}?${qs}`, { headers: { authorization: auth } });
  const raw = await res.text();
  let body;
  try { body = JSON.parse(raw); } catch (_) { body = raw; }
  const d = body && body.data;
  if (res.status !== 200 || !d) return { ok: false, reason: `http_${res.status}: ${(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 200)}` };
  return { ok: true, username: d.username, subscription_type: d.subscription_type ?? '(項目なし)', verified_type: d.verified_type ?? '(項目なし)' };
}

if (require.main === module) {
  run().then((r) => {
    console.log(JSON.stringify(r));
    process.exitCode = r.ok ? 0 : 1;
  });
}

module.exports = { run };
