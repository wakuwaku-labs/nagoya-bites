#!/usr/bin/env node
'use strict';
/**
 * NAGOYA BITES の X の数字（フォロワー・投稿ごとの表示回数・いいね等）を1日1回取って data/x_metrics.json に積む。
 * Ondine の SNS 画面がこの JSON を読む。実行: .github/workflows/x-metrics.yml（毎日1回）
 *
 * 取り方（段階D1・Ondine #1601）: 台帳 data/x_post_log.json の tweet_id（先頭の投稿だけ。スレッドの続きは数えない）のうち、
 * 投稿後 1 日・3 日・7 日の節目に達してまだ取っていない物（30 日以内）だけを GET /2/tweets?ids= で 1 回にまとめて取る。
 * 取らなかった投稿は直近の値を carried:true つきで写す（Ondine の一覧が欠けないように）。項目は public_metrics のまま。
 *
 * 使い方: node scripts/fetch_x_metrics.js [--dry-run] [--force]
 *   --dry-run … 通信せず、今日取る投稿・見積と今月の使用額だけ出す
 *   --probe-nonpublic … 一回限りの試し。自分の投稿1件に non_public_metrics 等を1回だけ頼み、項目名・値の有無・HTTP 状態を出す（通常の取得はしない・約 $0.005）
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
const OWNED_READ_USD = 0.001;  // Owned Reads（自分のアプリで自分の投稿）1件。GET /2/tweets?ids= が当たるかは未確認
const TWEETS_READ_USD = 0.005; // 投稿の読み取り 1 件。ids の取得が Owned Reads かどうか未確認なので高い方で見積もる・数える
const MILESTONE_DAYS = [1, 3, 7];  // 投稿後この日数に達したら 1 回取る（ids 方式の既定）。timeline 方式の既定は [1, 3]（下の milestonesFor）
const GRACE_DAYS = 1.5;            // 節目から何日以内なら取りに行くか（過ぎた分の遡りはしない＝初回に古い投稿を一括で取らない）
const WINDOW_DAYS = 30;            // これを過ぎた投稿は取りに行かない
const IDS_MAX = 100;               // GET /2/tweets?ids= の 1 回の上限
const MAX_RESULTS = 10;            // 旧方式（タイムライン直近 10 件）の件数。互換のため export だけ残す
const DAY_MS = 86400000;
const CAP_USD = 1.0;           // 月の上限（150円 ÷ 1ドル150円）
const JPY_PER_USD = 150;
const MAX_SNAPSHOTS = 180;

const API = 'https://api.x.com/2';
const REL = 'data/x_metrics.json';
const COMMENT = 'NAGOYA BITES の X の数字（scripts/fetch_x_metrics.js が毎日1回書く）。Ondine の SNS 画面が読む';

const round3 = (n) => Math.round(n * 1000) / 1000;
const estimate = (n = 0) => round3(USER_READ_USD + TWEETS_READ_USD * n);
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


/** 台帳の先頭の投稿（status=posted・tweet_id あり・投稿から 30 日以内）。 */
function ledgerHeads(root, now) {
  const log = X.readLog(root);
  const out = [];
  for (const p of (log.posts || [])) {
    if (!p || p.status !== 'posted' || !p.tweet_id) continue;
    const t = Date.parse(p.posted_at || p.attempted_at);
    if (!Number.isFinite(t)) continue;
    const age = now.getTime() - t;
    if (age < 0 || age > WINDOW_DAYS * DAY_MS) continue;
    out.push({ id: String(p.tweet_id), postedMs: t, ageDays: age / DAY_MS });
  }
  return out;
}

/** 前のスナップショットから、その投稿の「実際に取った」行（carried でない）を新しい順に。 */
function fetchedRows(snapshots, id) {
  const rows = [];
  for (const s of snapshots) {
    for (const p of (Array.isArray(s.posts) ? s.posts : [])) {
      if (p && String(p.id) === id && !p.carried) rows.push({ at: Date.parse(s.at), post: p });
    }
  }
  return rows.sort((a, b) => b.at - a.at);
}

/** 今日取る投稿: 到達した節目のうち、まだ取っていない物がある投稿。→ [{ id, milestone }] */
function duePosts(heads, snapshots, milestones = MILESTONE_DAYS) {
  const due = [];
  for (const h of heads) {
    const reached = milestones.filter((m) => h.ageDays >= m && h.ageDays < m + GRACE_DAYS);
    if (!reached.length) continue;
    const top = reached[reached.length - 1];
    const doneMax = fetchedRows(snapshots, h.id).reduce((mx, r) => {
      const a = (r.at - h.postedMs) / DAY_MS;
      return Math.max(mx, ...milestones.filter((m) => a >= m), 0);
    }, 0);
    if (top > doneMax) due.push({ id: h.id, milestone: top, ageDays: h.ageDays });
  }
  // 節目が浅い（新しい）投稿を先に。上限で切れても新しい物が残る
  return due.sort((a, b) => a.ageDays - b.ageDays);
}

/** 台帳の先頭の投稿と、そのスレッドの続きの tweet_id（タイムラインの件数を決めるのに使う）。 */
function ledgerTweetCount(root, sinceMs) {
  const log = X.readLog(root);
  let n = 0;
  for (const p of (log.posts || [])) {
    if (!p || p.status !== 'posted' || !p.tweet_id) continue;
    const t = Date.parse(p.posted_at || p.attempted_at);
    if (!Number.isFinite(t) || t < sinceMs) continue;
    n += 1 + ((p.thread && Array.isArray(p.thread.replies)) ? p.thread.replies.length : 0);
  }
  return n;
}

/** 応答の media から、投稿ごとの動画の再生数（public_metrics.view_count）。出なければ null（失敗にしない）。 */
function videoViews(body) {
  const media = new Map();
  for (const m of ((body && body.includes && body.includes.media) || [])) {
    const v = m && m.public_metrics && numOrNull(m.public_metrics.view_count);
    if (m && m.media_key && v != null) media.set(m.media_key, v);
  }
  const out = new Map();
  for (const t of ((body && body.data) || [])) {
    const keys = (t && t.attachments && t.attachments.media_keys) || [];
    const vs = keys.map((k) => media.get(k)).filter((v) => v != null);
    if (vs.length) out.set(String(t.id), Math.max(...vs));
  }
  return out;
}

const TWEET_FIELDS = 'public_metrics,created_at,text,attachments';
const MEDIA_QUERY = { expansions: 'attachments.media_keys', 'media.fields': 'public_metrics' };

/** 取得の方法: 既定 timeline（users/:id/tweets・Owned reads）。X_METRICS_FETCH_MODE=ids で GET /2/tweets?ids=（$0.005/件・STOP-$ の判断待ち）。 */
function fetchMode(env) { return String(env.X_METRICS_FETCH_MODE || '').trim() === 'ids' ? 'ids' : 'timeline'; }
const perItemUsd = (mode) => (mode === 'ids' ? TWEETS_READ_USD : OWNED_READ_USD);

/**
 * 節目の日数。timeline 方式（既定）は 7 日の節目までタイムラインを遡ると 1 日あたり約 26 件（スレッドの続きを含む）になり、
 * 月の上限 $1 を超えるので既定は [1, 3]。ids 方式は 3 件前後で済むので [1, 3, 7]。X_METRICS_MILESTONES=1,3,7 で上書きできる（費用が増える＝STOP-$）。
 */
function milestonesFor(mode, env = {}) {
  const custom = String(env.X_METRICS_MILESTONES || '').split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v > 0 && v < WINDOW_DAYS);
  if (custom.length) return [...new Set(custom)].sort((a, b) => a - b);
  return mode === 'ids' ? MILESTONE_DAYS : [1, 3];
}

function plan({ root, snapshots, now, mode, env = {} }) {
  const milestones = milestonesFor(mode, env);
  const heads = ledgerHeads(root, now);
  const due = duePosts(heads, snapshots, milestones).slice(0, IDS_MAX);
  let n = 0;
  if (due.length) {
    if (mode === 'ids') n = due.length;
    else {
      const oldest = Math.min(...due.map((d) => now.getTime() - d.ageDays * DAY_MS));
      // 最も古い対象の投稿より新しい分（先頭＋スレッドの続き）が全部入る件数。X の下限 5・上限 100
      n = Math.max(5, Math.min(100, ledgerTweetCount(root, oldest - 60000) + 3));
    }
  }
  return { heads, due, n, milestones };
}
const estimateFor = (mode, n) => round3(USER_READ_USD + perItemUsd(mode) * n);

// ── 一回限りの試し（段階C2）: 非公開の数字（non_public_metrics など）が自分のアプリで取れるか ─────────────
const PROBE_FIELDS = 'non_public_metrics,organic_metrics,public_metrics';
const PROBE_MEDIA = { expansions: 'attachments.media_keys', 'media.fields': 'public_metrics,non_public_metrics' };
const PROBE_USD = TWEETS_READ_USD;  // GET /2/tweets?ids= 1 件（高い方で見積もる）

/** 項目ごとに「値があるか」を数値のまま写す（本文・URL は載せない）。 */
function describeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  return out;
}

/**
 * 30 日以内の自分の投稿 1 件に GET /2/tweets?ids= を 1 回だけ呼び、返った項目名と値の有無・HTTP 状態を log に出す。
 * 通常の取得（users/me・タイムライン）はしない。CAP_USD の関所を通し、使用額を data/x_metrics.json の budget に足す。
 * 結果（項目名・数値・状態のみ。本文は載せない）は data.probe_nonpublic に残す。
 */
async function probeNonpublic({ root = X.ROOT, env = process.env, fetchImpl = fetch, now = new Date(), log = console.log } = {}) {
  const data = load(root);
  const iso = now.toISOString();
  const month = iso.slice(0, 7);
  data.version = 1;
  data._comment = COMMENT;
  data.budget = normalizeBudget(data.budget, month);
  const finish = (result, reason, extra = {}) => {
    data.probe_nonpublic = { at: iso, result, reason: reason || null, ...extra };
    X.writeJson(REL, data, root);
    log(`[probe] 結果 ${result}${reason ? `（${reason}）` : ''} ${JSON.stringify(extra)}`);
    return { result, reason: reason || null, ...extra, data };
  };
  if (round3(data.budget.spent_usd + PROBE_USD) > CAP_USD + 1e-9) {
    return finish('budget', `月の上限 $${CAP_USD.toFixed(2)} に達するため呼ばない（使用額 $${data.budget.spent_usd.toFixed(3)}）`);
  }
  const cred = credentials(env);
  if (!cred) return finish('error', '鍵（X_API_KEY など4つの Secrets）が揃っていません');
  const heads = ledgerHeads(root, now).sort((a, b) => b.postedMs - a.postedMs);
  if (!heads.length) return finish('no_target', '30 日以内の自分の投稿が台帳に無い');
  const id = heads[0].id;
  let res;
  try {
    res = await xGet('/tweets', { ids: id, 'tweet.fields': PROBE_FIELDS, ...PROBE_MEDIA }, cred, fetchImpl);
  } catch (e) {
    return finish('error', `通信に失敗: ${e && e.name ? e.name : 'error'}`);
  }
  const body = res.body && typeof res.body === 'object' ? res.body : {};
  const t = Array.isArray(body.data) ? body.data[0] : null;
  const media = (body.includes && Array.isArray(body.includes.media)) ? body.includes.media : [];
  const extra = {
    http_status: res.status,
    tweet_id: id,
    fields: t ? Object.keys(t).filter((k) => k !== 'text' && k !== 'edit_history_tweet_ids') : [],
    public_metrics: t ? describeFields(t.public_metrics) : null,
    non_public_metrics: t ? describeFields(t.non_public_metrics) : null,
    organic_metrics: t ? describeFields(t.organic_metrics) : null,
    media_count: media.length,
    media_public_metrics: media.map((m) => describeFields(m.public_metrics)),
    media_non_public_metrics: media.map((m) => describeFields(m.non_public_metrics)),
    errors: Array.isArray(body.errors) ? body.errors.map((e) => ({ title: e.title || null, detail: typeof e.detail === 'string' ? e.detail.slice(0, 200) : null, parameter: e.parameter || null })) : [],
  };
  if (res.status >= 200 && res.status < 300) data.budget.spent_usd = round3(data.budget.spent_usd + PROBE_USD);
  if (res.status !== 200) return finish('unavailable', errReason(res.status, res.body), extra);
  return finish(extra.non_public_metrics && Object.keys(extra.non_public_metrics).length ? 'ok' : 'no_nonpublic', null, extra);
}

async function run({ root = X.ROOT, env = process.env, fetchImpl = fetch, now = new Date(), force = false, dryRun = false, log = console.log } = {}) {
  const data = load(root);
  const iso = now.toISOString();
  const month = iso.slice(0, 7);
  const today = iso.slice(0, 10);
  data.version = 1;
  data._comment = COMMENT;
  data.budget = normalizeBudget(data.budget, month);
  const mode = fetchMode(env);
  const pl = plan({ root, snapshots: data.snapshots, now, mode, env });
  const est = estimateFor(mode, pl.n);
  const finish = (result, reason, persist = true) => {
    data.last_run = { at: iso, result, reason: reason || null };
    if (persist) X.writeJson(REL, data, root);
    return { result, reason: reason || null, data };
  };

  if (dryRun) {
    log(`[dry-run] 方法 ${mode}／今日取る投稿 ${pl.due.length}件（台帳の先頭 ${pl.heads.length}件のうち節目 ${pl.milestones.join('・')}日に達して未取得）／取得件数 ${pl.n}／見積 $${est.toFixed(3)}（User Read $${USER_READ_USD} + ${pl.n}件 × $${perItemUsd(mode)}。${mode === 'timeline' ? `参考: 高い方の単価 $${TWEETS_READ_USD} なら $${estimateFor('ids', pl.n).toFixed(3)}` : ''}）／今月 ${month} の使用額 $${data.budget.spent_usd.toFixed(3)} / 上限 $${CAP_USD.toFixed(2)}（${data.budget.cap_jpy}円）。単価の出典 ${PRICING_SOURCE}（${PRICING_CHECKED} 確認）。通信はしていません`);
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

  // 先頭の投稿の取得。取るものが無い日は呼ばない。401/402/403 は「取得不可」として記録し、フォロワーの記録は続ける
  let fetched = [];
  let videoMap = new Map();
  let postsFetch = { status: 'none_due', mode, due: 0 };
  if (pl.due.length) {
    let tw;
    try {
      if (mode === 'ids') {
        tw = await xGet('/tweets', { ids: pl.due.map((d) => d.id).join(','), 'tweet.fields': TWEET_FIELDS, ...MEDIA_QUERY }, cred, fetchImpl);
      } else {
        tw = await xGet(`/users/${u.id}/tweets`, { max_results: String(pl.n), 'tweet.fields': TWEET_FIELDS, ...MEDIA_QUERY }, cred, fetchImpl);
      }
    } catch (e) {
      return finish('error', `通信に失敗（tweets）: ${e && e.name ? e.name : 'error'}`);
    }
    if (tw.status === 401 || tw.status === 402 || tw.status === 403) {
      postsFetch = { status: 'unavailable', mode, due: pl.due.length, reason: errReason(tw.status, tw.body) };
    } else if (tw.status !== 200 || !tw.body || typeof tw.body !== 'object') {
      return finish('error', errReason(tw.status, tw.body));
    } else {
      const items = Array.isArray(tw.body.data) ? tw.body.data : [];
      data.budget.spent_usd = round3(data.budget.spent_usd + perItemUsd(mode) * items.length);
      videoMap = videoViews(tw.body);
      const dueMap = new Map(pl.due.map((d) => [d.id, d]));
      // 台帳の先頭の投稿だけを記録する（スレッドの続き・台帳に無い投稿は記録対象から外す）
      fetched = items.filter((t) => dueMap.has(String(t.id))).map((t) => ({ t, d: dueMap.get(String(t.id)) }));
      postsFetch = { status: 'ok', mode, due: pl.due.length, fetched: fetched.length, returned: items.length };
    }
  }

  const fetchedIds = new Set(fetched.map((f) => String(f.t.id)));
  const posts = fetched.map(({ t, d }) => {
    const row = buildPost(t, u.username);
    row.milestone_days = d.milestone;
    row.video_views = videoMap.has(String(t.id)) ? videoMap.get(String(t.id)) : null;
    return row;
  });
  // 今日取らなかった台帳の先頭の投稿は、直近に取った値を写す（Ondine の一覧が欠けないように）。carried:true は取得日ではない印
  for (const h of pl.heads) {
    if (fetchedIds.has(h.id)) continue;
    const prev = fetchedRows(data.snapshots, h.id)[0];
    if (prev) posts.push({ ...prev.post, carried: true, carried_from: new Date(prev.at).toISOString() });
  }
  posts.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  data.account = { id: String(u.id), username: u.username || null, name: u.name || null };
  const snap = {
    at: iso,
    followers: numOrNull(pm.followers_count),
    following: numOrNull(pm.following_count),
    tweet_count: numOrNull(pm.tweet_count),
    posts,
    posts_fetch: postsFetch,
  };
  // --force は同じ UTC 日のスナップショットを置き換える
  data.snapshots = data.snapshots.filter((s) => String(s.at).slice(0, 10) !== today);
  data.snapshots.push(snap);
  data.snapshots.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  data.snapshots = data.snapshots.slice(-MAX_SNAPSHOTS);
  log(`取得 OK: @${u.username} フォロワー ${snap.followers} 今日取った投稿 ${fetched.length}件（${postsFetch.status}）今月の使用額 $${data.budget.spent_usd.toFixed(3)}`);
  return finish(postsFetch.status === 'unavailable' ? 'error' : 'ok', postsFetch.status === 'unavailable' ? `投稿の数字は取得不可: ${postsFetch.reason}` : null);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  (argv.includes('--probe-nonpublic') ? probeNonpublic() : run({ force: argv.includes('--force'), dryRun: argv.includes('--dry-run') }))
    .then((r) => { process.exit(r.result === 'error' ? 1 : 0); })
    .catch((e) => { console.error('予期しない失敗:', e && e.message ? e.message : 'error'); process.exit(1); });
}

module.exports = { run, probeNonpublic, xGet, credentials, errReason, estimate, estimateFor, duePosts, milestonesFor, ledgerHeads, plan, fetchMode, load, TWEETS_READ_USD, MILESTONE_DAYS, USER_READ_USD, OWNED_READ_USD, CAP_USD, MAX_RESULTS, MAX_SNAPSHOTS };
