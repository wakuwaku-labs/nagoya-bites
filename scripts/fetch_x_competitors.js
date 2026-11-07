#!/usr/bin/env node
'use strict';
/**
 * 競合の X アカウント（data/x_competitors_config.json）の投稿の「数字と特徴」を週1回取って data/x_competitors.json に積む（段階E6・Ondine #1601）。
 * 実行: .github/workflows/x-competitors.yml（毎週月曜 07:00 JST）
 *
 * 取り方: GET /2/users/by?usernames=（1回・フォロワー数とユーザーID）→ 各アカウントの GET /2/users/:id/tweets
 *   （max_results 件・since_id で前回より新しい物だけ・返信とリポストは除く）。
 * 費用: 月の上限 $1（既存の CAP_USD とは別。使用額は出力の cost）。呼ぶ前に見積もり、超えるなら呼ばない。
 * 保存: 公開リポジトリなので本文・画像・URL は保存しない。数字（metrics）と特徴（features）だけ。90 日を超えた投稿は消す（開発者ポリシー）。
 *
 * 使い方: node scripts/fetch_x_competitors.js [--dry-run]
 * 鍵: X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET（値はログにも JSON にも出さない）
 */
const fs = require('fs');
const path = require('path');
const X = require('./lib/x_post');
const M = require('./fetch_x_metrics');

const USER_READ_USD = 0.010;   // ユーザー 1 件の読み取り
const POST_READ_USD = 0.005;   // 他人の投稿 1 件の読み取り
const CONFIG_REL = 'data/x_competitors_config.json';
const OUT_REL = 'data/x_competitors.json';
const SCHEMA = 'x-competitor/1';
const DAY_MS = 86400000;
const round3 = (n) => Math.round(n * 1000) / 1000;
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function readJson(root, rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (_) { return null; }
}

/** 1 行目の型。question = ？を含む／number = 数字を含む／assertion = 。！で言い切る／other */
function firstLineType(text) {
  const line = String(text || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (/[?？]/.test(line)) return 'question';
  if (/[0-9０-９]/.test(line)) return 'number';
  if (/[。！!]$/.test(line)) return 'assertion';
  return 'other';
}

// 題材の分類（SNS分析ツールの x-features.ts の NB_TOPICS と同じ。上から順に最初に当たった物）
const NB_TOPICS = [
  ['宴会・忘年会', /忘年会|新年会|宴会|貸切/],
  ['デート', /デート|記念日|夜景/],
  ['ひとり飲み・ひとりごはん', /一人|ひとり|1人|カウンター/],
  ['ランチ', /ランチ|定食|昼/],
  ['イベント', /フェス|イベント|まつり|祭/],
  ['お酒', /飲み放題|ワイン|日本酒|酒|ビール|ハイボール/],
  ['喫茶・カフェ', /モーニング|喫茶|カフェ|コーヒー/],
];

function topicOf(text) {
  const s = String(text || '');
  for (const [name, re] of NB_TOPICS) if (re.test(s)) return name;
  return 'その他';
}

/** 本文を保存せずに特徴だけを取り出す。 */
function features(t, mediaByKey) {
  const text = typeof t.text === 'string' ? t.text : '';
  const ent = t.entities || {};
  const urls = (ent.urls || []).filter((u) => {
    const e = String((u && (u.expanded_url || u.display_url)) || '');
    return !/\/(photo|video)\/\d+$/.test(e) && !/^pic\.(x|twitter)\.com/.test(String(u.display_url || ''));
  });
  const types = ((t.attachments && t.attachments.media_keys) || []).map((k) => mediaByKey.get(k)).filter(Boolean);
  const media = types.some((m) => m === 'video' || m === 'animated_gif') ? 'video' : (types.includes('photo') ? 'image' : 'none');
  return {
    media,
    has_url: urls.length > 0,
    chars: [...text].length,
    first_line: firstLineType(text),
    hashtags: (ent.hashtags || []).map((h) => String(h.tag)).filter(Boolean),
    topic: topicOf(text),
  };
}

function postRow(t, mediaByKey) {
  const m = t.public_metrics || {};
  return {
    id: String(t.id),
    created_at: t.created_at || null,
    metrics: {
      impressions: numOrNull(m.impression_count),
      likes: int0(m.like_count), reposts: int0(m.retweet_count), replies: int0(m.reply_count),
      quotes: int0(m.quote_count), bookmarks: int0(m.bookmark_count),
    },
    features: features(t, mediaByKey),
  };
}

const bigMax = (ids) => ids.reduce((mx, v) => (mx === null || BigInt(v) > BigInt(mx) ? v : mx), null);

async function run({ root = X.ROOT, env = process.env, fetchImpl = fetch, now = new Date(), dryRun = false, log = console.log } = {}) {
  const cfg = readJson(root, CONFIG_REL);
  if (!cfg || !Array.isArray(cfg.accounts) || !cfg.accounts.length) return { result: 'error', reason: '競合の一覧（data/x_competitors_config.json）が読めません' };
  const capUsd = numOrNull(cfg.capUsd) != null ? cfg.capUsd : 1;
  const maxResults = Math.max(5, Math.min(100, Math.floor(numOrNull(cfg.maxResults) || 10)));
  const retentionMs = (numOrNull(cfg.retentionDays) || 90) * DAY_MS;
  const iso = now.toISOString();
  const month = iso.slice(0, 7);
  const handles = cfg.accounts.map((a) => String(a.handle).replace(/^@/, ''));

  const prev = readJson(root, OUT_REL) || {};
  const prevAcc = new Map(((prev.accounts) || []).map((a) => [String(a.handle).toLowerCase(), a]));
  let spent = prev.cost && prev.cost.month === month && numOrNull(prev.cost.usd) != null ? prev.cost.usd : 0;

  const out = {
    schema: SCHEMA, project: 'nagoya_bites', updated_at: iso,
    cost: { month, usd: round3(spent), cap_usd: capUsd },
    accounts: [],
    last_run: { at: iso, result: 'ok', reason: null },
  };
  const finish = (result, reason, persist = true) => {
    out.cost.usd = round3(spent);
    out.last_run = { at: iso, result, reason: reason || null };
    if (persist) X.writeJson(OUT_REL, out, root);
    return { result, reason: reason || null, data: out };
  };
  // 設定にある順に、前回の中身を引き継いだ行を作る（90 日超の投稿はここで消す）
  const accRows = new Map();
  for (const a of cfg.accounts) {
    const h = String(a.handle).replace(/^@/, '');
    const p = prevAcc.get(h.toLowerCase());
    const row = {
      handle: h, user_id: p ? p.user_id : '', followers: p ? numOrNull(p.followers) : null,
      fetched_at: p ? p.fetched_at : null,
      posts: ((p && p.posts) || []).filter((x) => { const t = Date.parse(x.created_at); return Number.isFinite(t) && now.getTime() - t <= retentionMs; }),
    };
    accRows.set(h.toLowerCase(), row);
    out.accounts.push(row);
  }

  const estimateAll = USER_READ_USD * handles.length + POST_READ_USD * maxResults * handles.length;
  if (dryRun) {
    log(`[dry-run] 対象 ${handles.length}件／最大見積 $${estimateAll.toFixed(3)}／今月の使用額 $${spent.toFixed(3)}／上限 $${capUsd}`);
    return finish('skipped', 'dry-run', false);
  }
  const cred = M.credentials(env);
  if (!cred) return finish('error', '鍵（X_API_KEY など4つの Secrets）が揃っていません');

  const can = (usd) => round3(spent + usd) <= capUsd + 1e-9;
  if (!can(USER_READ_USD * handles.length)) return finish('budget', `月の上限 $${capUsd} に達するため停止（使用額 $${spent.toFixed(3)}）`);

  // 1) ユーザー（フォロワー数とID）
  let ub;
  try {
    ub = await M.xGet('/users/by', { usernames: handles.join(','), 'user.fields': 'public_metrics' }, cred, fetchImpl);
  } catch (e) {
    return finish('error', `通信に失敗（users/by）: ${e && e.name ? e.name : 'error'}`);
  }
  if (ub.status !== 200 || !ub.body || typeof ub.body !== 'object') {
    if (ub.status === 401 || ub.status === 402 || ub.status === 403) {
      for (const r of out.accounts) r.error = M.errReason(ub.status, ub.body);
      return finish('unavailable', `競合の取得不可: ${M.errReason(ub.status, ub.body)}`);
    }
    return finish('error', M.errReason(ub.status, ub.body));
  }
  const users = Array.isArray(ub.body.data) ? ub.body.data : [];
  spent = round3(spent + USER_READ_USD * users.length);
  const byName = new Map(users.map((u) => [String(u.username).toLowerCase(), u]));

  // 2) 各アカウントの投稿
  let fetchedTotal = 0;
  const perAccount = [];
  let stopReason = null;
  for (const row of out.accounts) {
    const u = byName.get(row.handle.toLowerCase());
    if (!u) { row.error = 'ユーザーが見つからない（ハンドルの変更・凍結など）'; perAccount.push(`${row.handle}:なし`); continue; }
    row.user_id = String(u.id);
    row.followers = numOrNull(u.public_metrics && u.public_metrics.followers_count);
    row.fetched_at = iso;
    delete row.error;
    if (!can(POST_READ_USD * maxResults)) { stopReason = `月の上限 $${capUsd} に達するため以降は取らない（使用額 $${spent.toFixed(3)}）`; row.error = '上限のため今回は取らない'; perAccount.push(`${row.handle}:上限`); continue; }
    const query = {
      max_results: String(maxResults), exclude: 'replies,retweets',
      'tweet.fields': 'public_metrics,created_at,entities,attachments',
      expansions: 'attachments.media_keys', 'media.fields': 'type',
    };
    const since = bigMax(row.posts.map((p) => p.id));
    if (since) query.since_id = since;
    let tw;
    try { tw = await M.xGet(`/users/${u.id}/tweets`, query, cred, fetchImpl); } catch (e) { row.error = `通信に失敗: ${e && e.name ? e.name : 'error'}`; perAccount.push(`${row.handle}:通信失敗`); continue; }
    if (tw.status !== 200 || !tw.body || typeof tw.body !== 'object') { row.error = M.errReason(tw.status, tw.body); perAccount.push(`${row.handle}:${tw.status}`); continue; }
    const items = Array.isArray(tw.body.data) ? tw.body.data : [];
    spent = round3(spent + POST_READ_USD * items.length);
    const mediaByKey = new Map(((tw.body.includes && tw.body.includes.media) || []).map((m) => [m.media_key, m.type]));
    const have = new Set(row.posts.map((p) => p.id));
    for (const t of items) {
      if (have.has(String(t.id))) continue;
      const r = postRow(t, mediaByKey);
      const ct = Date.parse(r.created_at);
      if (!Number.isFinite(ct) || now.getTime() - ct > retentionMs) continue;
      row.posts.push(r); have.add(r.id); fetchedTotal++;
    }
    row.posts.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    perAccount.push(`${row.handle}:${items.length}件`);
  }
  log(`競合の取得: ${perAccount.join(' ')}／新しく保存 ${fetchedTotal}件／今月の使用額 $${spent.toFixed(3)}（上限 $${capUsd}）`);
  const errs = out.accounts.filter((r) => r.error && r.error !== '上限のため今回は取らない');
  if (stopReason) return finish('budget', stopReason);
  return finish(errs.length === out.accounts.length ? 'error' : 'ok', errs.length ? `${errs.length}件でエラー: ${errs.map((r) => `${r.handle} ${r.error}`).join(' / ')}` : null);
}

if (require.main === module) {
  run({ dryRun: process.argv.includes('--dry-run') })
    .then((r) => { process.exit(r.result === 'error' ? 1 : 0); })
    .catch((e) => { console.error('予期しない失敗:', e && e.message ? e.message : 'error'); process.exit(1); });
}

module.exports = { run, firstLineType, features, NB_TOPICS, topicOf, postRow, USER_READ_USD, POST_READ_USD };
