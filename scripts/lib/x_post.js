'use strict';
/**
 * X 自動投稿（SNS-001）の文面づくりと検査の唯一の情報源。
 * 投稿（scripts/post_journal_to_x.js）と見張り役（scripts/check_x_post_health.js）が同じ判定を使う。
 * 計画書: docs/x-auto-posting-plan-2026-10.md の 5 章。
 *
 * - 文面は記事の題名をそのまま使う（記事と同じ文なので事実の食い違いが起きない）
 * - 検査は検証できる事実だけで行う（CLAUDE.md 制約10）:
 *   X の数え方の文字数・文面の数字が記事の本文にあるか・使わない言い方・UTM・過去の投稿との重複
 * - npm 依存を足さない。OAuth 1.0a の署名は Node 標準の crypto で書く
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// ── X の文字数の数え方（twitter-text v3 の設定と同じ）──────────────────────
// 下の範囲の文字は 1、それ以外（日本語・絵文字など）は 2。URL は長さに関係なく 23。上限 280。
const WEIGHT_ONE_RANGES = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];
const URL_WEIGHT = 23;
const URL_RE = /https?:\/\/[^\s　]+/g;

function charWeight(cp) {
  return WEIGHT_ONE_RANGES.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
}

/** X が数える文字数（日本語=2・URL=23）。 */
function weightedLength(text) {
  let total = 0;
  let last = 0;
  const s = String(text || '').normalize('NFC');
  for (const m of s.matchAll(URL_RE)) {
    total += plainWeight(s.slice(last, m.index)) + URL_WEIGHT;
    last = m.index + m[0].length;
  }
  return total + plainWeight(s.slice(last));
}

function plainWeight(s) {
  let n = 0;
  for (const ch of s) n += charWeight(ch.codePointAt(0));
  return n;
}

// ── 文面の部品 ─────────────────────────────────────────────────────────
function loadJson(rel, root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function loadPolicy(root = ROOT) {
  return loadJson('data/x_post_policy.json', root);
}

/** 記事の識別子（URL の末尾から .html を除いたもの）。docs/sns-utm-convention.md の決まり。 */
function articleUrl(entry, policy) {
  const base = String(policy.siteBase || '').replace(/\/+$/, '');
  return `${base}/journal/${entry.slug}.html`;
}

function utmUrl(entry, policy) {
  const u = new URL(articleUrl(entry, policy));
  u.searchParams.set('utm_source', policy.utm.source);
  u.searchParams.set('utm_medium', policy.utm.medium);
  u.searchParams.set('utm_campaign', entry.slug);
  return u.toString();
}

/** 題名に出てくる地名（「」の中の店名は除く）を1つだけハッシュタグにする。長い語から照合する。 */
function areaHashtag(title, policy) {
  const outside = String(title || '').replace(/「[^」]*」/g, ' ');
  const words = [...(policy.areaHashtagWords || [])].sort((a, b) => b.length - a.length);
  for (const w of words) if (outside.includes(w)) return `#${w}`;
  return null;
}

function hashtagsFor(entry, policy) {
  const tags = [...(policy.baseHashtags || [])];
  const area = areaHashtag(entry.title, policy);
  if (area && !tags.includes(area)) tags.push(area);
  return tags.slice(0, Math.max(0, policy.maxHashtags || 0));
}

/** X の文面に限って題名の言い方を置き換える（data/x_post_policy.json の titleRewrites）。 */
function rewriteTitle(title, policy) {
  let t = String(title || '').trim();
  for (const r of policy.titleRewrites || []) t = t.replace(new RegExp(r.pattern, 'g'), r.replace);
  return t;
}

function compose({ header, title, url, hashtags }) {
  const lines = [];
  if (header) lines.push(header);
  lines.push(title, '', url);
  if (hashtags.length) lines.push(hashtags.join(' '));
  return lines.join('\n');
}

/**
 * 定型の文面を作る。280 を超えるときは、ハッシュタグ → 見出しの順に削る。題名は途中で切らない。
 * 返り値: { ok, text, url, hashtags, weighted, reason }
 */
function buildTemplatePost(entry, policy) {
  if (!entry || !entry.slug || !entry.title) return { ok: false, reason: 'missing_entry_fields' };
  const url = utmUrl(entry, policy);
  const title = rewriteTitle(entry.title, policy);
  const max = policy.maxWeightedLength || 280;
  const tags = hashtagsFor(entry, policy);
  const candidates = [];
  for (let n = tags.length; n >= 0; n--) candidates.push({ header: policy.header, hashtags: tags.slice(0, n) });
  candidates.push({ header: '', hashtags: [] });
  for (const c of candidates) {
    const text = compose({ header: c.header, title, url, hashtags: c.hashtags });
    const weighted = weightedLength(text);
    if (weighted <= max) return { ok: true, text, url, hashtags: c.hashtags, weighted };
  }
  return { ok: false, reason: 'too_long', weighted: weightedLength(compose({ header: '', title, url, hashtags: [] })) };
}

// ── 検査 ────────────────────────────────────────────────────────────────
/** HTML から読める文字だけを取り出す（script・style・タグを除く）。 */
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ');
}

/** 全角数字を半角に、桁区切りのカンマを外す。 */
function normalizeDigits(s) {
  return String(s || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/(\d)[,，](?=\d{3})/g, '$1');
}

/** 文面（URL とハッシュタグを除く）に出る数字のうち、記事の本文に無いもの。 */
function numbersMissingFromArticle(text, articleText) {
  const body = normalizeDigits(String(text || '').replace(URL_RE, ' ').replace(/#[^\s#]+/g, ' '));
  const article = normalizeDigits(articleText);
  const nums = [...new Set(body.match(/\d+(?:\.\d+)?/g) || [])];
  return nums.filter((n) => !new RegExp(`(^|[^\\d.])${n.replace('.', '\\.')}($|[^\\d])`).test(article));
}

/** data/selection_wording_policy.json の error 語のうち、文面に出るもの。 */
function wordingViolations(text, root = ROOT) {
  const { loadPolicy: loadWording, compilePolicy } = require('../audit_selection_wording');
  const { terms } = compilePolicy(loadWording(root));
  return terms
    .filter((t) => t.severity === 'error')
    .filter((t) => new RegExp(t.pattern).test(text))
    .map((t) => t.id);
}

/**
 * 投稿前の検査。返り値は落ちた理由の配列（空なら通過）。
 * articleText: 記事の本文の文字（htmlToText 済み）。recentTexts: 過去の投稿の文面。
 */
function validatePost(text, { entry, policy, articleText, recentTexts = [], root = ROOT }) {
  const failures = [];
  const max = policy.maxWeightedLength || 280;
  const w = weightedLength(text);
  if (w > max) failures.push(`too_long:${w}`);
  const missing = numbersMissingFromArticle(text, articleText);
  if (missing.length) failures.push(`numbers_not_in_article:${missing.join(',')}`);
  const words = wordingViolations(text, root);
  if (words.length) failures.push(`wording:${words.join(',')}`);
  const urls = String(text).match(URL_RE) || [];
  if (urls.length !== 1) failures.push(`url_count:${urls.length}`);
  else {
    let u;
    try { u = new URL(urls[0]); } catch (_) { u = null; }
    const expected = articleUrl(entry, policy);
    if (!u || `${u.origin}${u.pathname}` !== expected) failures.push('url_not_article');
    else if (u.searchParams.get('utm_source') !== policy.utm.source
      || u.searchParams.get('utm_medium') !== policy.utm.medium
      || u.searchParams.get('utm_campaign') !== entry.slug) failures.push('utm_missing');
  }
  if (recentTexts.some((t) => String(t).trim() === String(text).trim())) failures.push('duplicate_recent');
  return failures;
}

// ── 台帳 ────────────────────────────────────────────────────────────────
const LOG_REL = 'data/x_post_log.json';
const HEALTH_REL = 'data/x_post_health.json';

function readLog(root = ROOT) {
  try { return loadJson(LOG_REL, root); } catch (_) { return { version: 1, posts: [] }; }
}

function writeJson(rel, data, root = ROOT) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + '\n');
}

/** その記事が投稿済み（または X が重複として拒んだ＝届いている）か。 */
function alreadyPosted(log, slug) {
  return (log.posts || []).some((p) => p.slug === slug && (p.status === 'posted' || p.status === 'duplicate'));
}

function recentTexts(log, today, days) {
  const since = new Date(`${today}T00:00:00+09:00`).getTime() - days * 86400000;
  return (log.posts || [])
    .filter((p) => p.text && p.status === 'posted' && new Date(p.posted_at || p.attempted_at).getTime() >= since)
    .map((p) => p.text);
}

// ── OAuth 1.0a（HMAC-SHA1）──────────────────────────────────────────────
function pct(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * OAuth 1.0a の Authorization ヘッダーを作る。
 * params: 署名に含めるクエリ・フォームの値（JSON の本文は含めない＝X API v2 の POST /2/tweets）。
 */
function oauthHeader({ method, url, params = {}, consumerKey, consumerSecret, token, tokenSecret, nonce, timestamp }) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce || crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all).sort().map((k) => `${pct(k)}=${pct(all[k])}`).join('&');
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join('&');
  const key = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(', ');
}

/**
 * X の応答を、人が直すべき原因の分類に変える。
 * auth = 鍵が無効（401）/ forbidden = 権限・アプリ設定（403）/ duplicate = 同じ文面の投稿（403）/
 * payment = 残高・上限（402 か、本文に credit・billing・spend）/ rate = 回数の上限（429）/ server = X 側の不調（5xx）
 */
function classifyError(status, body) {
  const s = typeof body === 'string' ? body : JSON.stringify(body || {});
  if (/duplicate/i.test(s)) return 'duplicate';
  if (status === 402 || /credit|billing|spend|payment|usage cap/i.test(s)) return 'payment';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** 人が直す必要がある失敗か（見張り役がすぐ警報を出す）。 */
const HUMAN_ACTION_ERRORS = new Set(['auth', 'forbidden', 'payment']);

module.exports = {
  ROOT, LOG_REL, HEALTH_REL, HUMAN_ACTION_ERRORS,
  weightedLength, loadPolicy, articleUrl, utmUrl, areaHashtag, hashtagsFor, rewriteTitle, buildTemplatePost,
  htmlToText, normalizeDigits, numbersMissingFromArticle, wordingViolations, validatePost,
  readLog, writeJson, alreadyPosted, recentTexts, oauthHeader, classifyError, pct,
};
