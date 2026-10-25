#!/usr/bin/env node
'use strict';
/**
 * NAGOYA BITES の X の数字（フォロワー・投稿ごとの表示回数・いいね等）を1日1回取って data/x_metrics.json に積む。
 * Ondine の SNS 画面がこの JSON を読む。実行: .github/workflows/x-metrics.yml（毎日1回）
 *
 * 使い方: node scripts/fetch_x_metrics.js [--dry-run] [--force]
 *   --dry-run … 通信せず、見積と今月の使用額だけ出す
 *   --force   … 同じ UTC 日のスナップショットがあっても取り直して上書きする
 *
 * 鍵（GitHub Secrets・OAuth 1.0a）: X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
 * 鍵の値・トークンはログにも JSON にも出さない。
 */
const fs = require('fs');
const path = require('path');
const X = require('./lib/x_post');

// ── 単価（X の公式料金表。変わったらここだけ直す）──────────────────────
const PRICING_SOURCE = 'https://docs.x.com/x-api/getting-started/pricing';
const PRICING_CHECKED = '2026-10-25';
const USER_READ_USD = 0.010;   // User: Read（GET /2/users/me）1件
const OWNED_READ_USD = 0.001;  // Owned Reads（GET /2/users/{id}/tweets・自分のアプリで自分の投稿）1件
const MAX_RESULTS = 10;
const CAP_USD = 1.0;           // 月の上限（150円 ÷ 1ドル150円）
const JPY_PER_USD = 150;
const MAX_SNAPSHOTS = 180;

const API = 'https://api.x.com/2';
const REL = 'data/x_metrics.json';
const COMMENT = 'NAGOYA BITES の X の数字（scripts/fetch_x_metrics.js が毎日1回書く）。Ondine の SNS 画面が読む';

const round3 = (n) => Math.round(n * 1000) / 1000;
const estimate = () => round3(USER_READ_USD + OWNED_READ_USD * MAX_RESULTS);
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function load(root) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, REL), 'utf8'));
    if (j && typeof j === 'object' && Array.isArray(j.snapshots)) return j;
  } catch (_) { /* 無い・壊れている → 新規 */ }
  return { version: 1, _comment: COMMENT, account: null, snapshots: [], budget: null, last_run: null };
}

function normalizeBudget(b, month) {
  const spent = b && b.month === month && numOrNull(b.spent_usd) != null ? b.spent_usd : 0;
  return { month, spent_usd: round3(spent), cap_usd: CAP_USD, cap_jpy: Math.round(CAP_USD * JPY_PER_USD) };
}

function credentials(env) {
  const c = {
    consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET,
  };
  for (const k of Object.keys(c)) c[k] = c[k] == null ? '' : String(c[k]).trim();
  return Object.values(c).every(Boolean) ? c : null;
}

/** GET。クエリも OAuth の署名に入れる（署名の URL にはクエリを含めない）。 */
async function xGet(pathname, query, cred, fetchImpl) {
  const base = API + pathname;
  const auth = X.oauthHeader({ method: 'GET', url: base, params: query, ...cred });
  const qs = Object.keys(query).sort().map((k) => `${X.pct(k)}=${X.pct(query[k])}`).join('&');
  const res = await fetchImpl(`${base}?${qs}`, { method: 'GET', headers: { authorization: auth } });
  const raw = await res.text();
  let body;
  try { body = JSON.parse(raw); } catch (_) { body = raw; }
  return { status: res.status, body };
}

function errReason(status, body) {
  return `HTTP ${status}（${X.classifyError(status, body)}）`;
}

function buildPost(t, username) {
  const m = t.public_metrics || {};
  return {
    id: String(t.id),
    created_at: t.created_at || null,
    text: typeof t.text === 'string' ? [...t.text].slice(0, 80).join('') : null,
    url: `https://x.com/${username}/status/${t.id}`,
    impressions: numOrNull(m.impression_count),
    likes: numOrNull(m.like_count),
    reposts: numOrNull(m.retweet_count),
    replies: numOrNull(m.reply_count),
    quotes: numOrNull(m.quote_count),
    bookmarks: numOrNull(m.bookmark_count),
  };
}

async function run({ root = X.ROOT, env = process.env, fetchImpl = fetch, now = new Date(), force = false, dryRun = false, log = console.log } = {}) {
  const data = load(root);
  const iso = now.toISOString();
  const month = iso.slice(0, 7);
  const today = iso.slice(0, 10);
  data.version = 1;
  data._comment = COMMENT;
  data.budget = normalizeBudget(data.budget, month);
  const est = estimate();
  const finish = (result, reason, persist = true) => {
    data.last_run = { at: iso, result, reason: reason || null };
    if (persist) X.writeJson(REL, data, root);
    return { result, reason: reason || null, data };
  };

  if (dryRun) {
    log(`[dry-run] 見積 $${est.toFixed(3)}（User Read $${USER_READ_USD} + 投稿 ${MAX_RESULTS}件 × $${OWNED_READ_USD}）／今月 ${month} の使用額 $${data.budget.spent_usd.toFixed(3)} / 上限 $${CAP_USD.toFixed(2)}（${data.budget.cap_jpy}円）。単価の出典 ${PRICING_SOURCE}（${PRICING_CHECKED} 確認）。通信はしていません`);
    return finish('skipped', 'dry-run', false);
  }

  const last = data.snapshots[data.snapshots.length - 1];
  if (!force && last && String(last.at).slice(0, 10) === today) {
    log(`同じ UTC 日（${today}）のスナップショットがあるので呼びません`);
    return finish('skipped', `同じ UTC 日（${today}）は取得済み`);
  }

  if (round3(data.budget.spent_usd + est) > CAP_USD + 1e-9) {
    log(`今月の使用額 $${data.budget.spent_usd.toFixed(3)} + 見積 $${est.toFixed(3)} が上限 $${CAP_USD.toFixed(2)} を超えるので呼びません`);
    return finish('budget', `月の上限 $${CAP_USD.toFixed(2)} に達するため停止（使用額 $${data.budget.spent_usd.toFixed(3)}）`);
  }

  const cred = credentials(env);
  if (!cred) return finish('error', '鍵（X_API_KEY など4つの Secrets）が揃っていません');

  let me;
  try {
    me = await xGet('/users/me', { 'user.fields': 'public_metrics,username,name' }, cred, fetchImpl);
  } catch (e) {
    return finish('error', `通信に失敗（users/me）: ${e && e.name ? e.name : 'error'}`);
  }
  if (me.status !== 200 || !me.body || !me.body.data || !me.body.data.id) {
    // 失敗の請求は不明なので、安全側で User Read 1件分を足す（401/403 などは通常課金されないが上限の余裕は十分）
    if (me.status >= 200 && me.status < 300) data.budget.spent_usd = round3(data.budget.spent_usd + USER_READ_USD);
    return finish('error', errReason(me.status, me.body));
  }
  const u = me.body.data;
  data.budget.spent_usd = round3(data.budget.spent_usd + USER_READ_USD);
  const pm = u.public_metrics || {};

  let tw;
  try {
    tw = await xGet(`/users/${u.id}/tweets`, {
      max_results: String(MAX_RESULTS), exclude: 'replies,retweets', 'tweet.fields': 'public_metrics,created_at,text',
    }, cred, fetchImpl);
  } catch (e) {
    return finish('error', `通信に失敗（tweets）: ${e && e.name ? e.name : 'error'}`);
  }
  if (tw.status !== 200 || !tw.body || typeof tw.body !== 'object') {
    return finish('error', errReason(tw.status, tw.body));
  }
  const tweets = Array.isArray(tw.body.data) ? tw.body.data : [];
  data.budget.spent_usd = round3(data.budget.spent_usd + OWNED_READ_USD * tweets.length);

  data.account = { id: String(u.id), username: u.username || null, name: u.name || null };
  const snap = {
    at: iso,
    followers: numOrNull(pm.followers_count),
    following: numOrNull(pm.following_count),
    tweet_count: numOrNull(pm.tweet_count),
    posts: tweets.map((t) => buildPost(t, u.username)),
  };
  // --force は同じ UTC 日のスナップショットを置き換える
  data.snapshots = data.snapshots.filter((s) => String(s.at).slice(0, 10) !== today);
  data.snapshots.push(snap);
  data.snapshots.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  data.snapshots = data.snapshots.slice(-MAX_SNAPSHOTS);
  log(`取得 OK: @${u.username} フォロワー ${snap.followers} 投稿 ${tweets.length}件 今月の使用額 $${data.budget.spent_usd.toFixed(3)}`);
  return finish('ok', null);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  run({ force: argv.includes('--force'), dryRun: argv.includes('--dry-run') })
    .then((r) => { process.exit(r.result === 'error' ? 1 : 0); })
    .catch((e) => { console.error('予期しない失敗:', e && e.message ? e.message : 'error'); process.exit(1); });
}

module.exports = { run, estimate, load, USER_READ_USD, OWNED_READ_USD, CAP_USD, MAX_RESULTS, MAX_SNAPSHOTS };
