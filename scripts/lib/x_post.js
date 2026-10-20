'use strict';
/**
 * X 自動投稿（SNS-001）の文面づくりと検査の唯一の情報源。
 * 投稿（scripts/post_journal_to_x.js）と見張り役（scripts/check_x_post_health.js）が同じ判定を使う。
 * 計画書: docs/x-auto-posting-plan-2026-10.md の 5 章。
 *
 * - 文面の候補は上から順に試し、検査を通った最初のものを使う（postCandidates）:
 *   1. 保存した文面（data/x_post_drafts/<date>.json）… ジャーナルを作る Mac 側で Claude が書き、
 *      本文の数字がすべて「記事の原文の引用（evidence）」にあることを確かめたもの（P-476・docs/decisions/0047）
 *   2. 題名＋記事の「知っておきたいポイント」の1項目（記事の文をそのまま使う）
 *   3. 題名だけの定型
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

/** content を渡すと utm_content も付ける（文面の作り方ごとの反応を比べるため。定型は付けない）。 */
function utmUrl(entry, policy, content) {
  const u = new URL(articleUrl(entry, policy));
  u.searchParams.set('utm_source', policy.utm.source);
  u.searchParams.set('utm_medium', policy.utm.medium);
  u.searchParams.set('utm_campaign', entry.slug);
  if (content) u.searchParams.set('utm_content', content);
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

/** 本文の下に空行・URL・ハッシュタグを付ける。280 を超えるときはハッシュタグから削る。 */
function withLink(body, url, tags, max) {
  for (let n = tags.length; n >= 0; n--) {
    const lines = [body, '', url];
    if (n) lines.push(tags.slice(0, n).join(' '));
    const text = lines.join('\n');
    const weighted = weightedLength(text);
    if (weighted <= max) return { text, weighted, hashtags: tags.slice(0, n) };
  }
  return null;
}

// ── ポイント入りの定型（保存した文面が使えない日の代わり）────────────────────
/** 記事の「知っておきたいポイント」（insider-box の箇条書き）を、読める文字にして返す。 */
function insiderPoints(html) {
  const m = String(html || '').match(/class="insider-box"[\s\S]*?<\/ul>/);
  if (!m) return [];
  return [...m[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) => htmlToText(x[1]).trim()).filter(Boolean);
}

/**
 * 題名＋ポイント1項目の文面。ポイントは記事の文をそのまま使い、途中で切らない。
 * 280 に収まるポイントごとに1つずつ、記事の順で返す（収まるものが無ければ空の配列）。
 */
function buildPointPosts(entry, policy, html) {
  if (!entry || !entry.slug || !entry.title) return [];
  const title = rewriteTitle(entry.title, policy);
  const url = utmUrl(entry, policy, 'point');
  const max = policy.maxWeightedLength || 280;
  const out = [];
  insiderPoints(html).forEach((point, i) => {
    const body = [policy.header, title, '', point].filter((x, j) => j > 0 || x).join('\n');
    const r = withLink(body, url, hashtagsFor(entry, policy), max);
    if (r) out.push({ ok: true, mode: 'template-point', point: i, url, ...r });
  });
  return out;
}

// ── 保存した文面（Mac 側の Claude が書く）──────────────────────────────────
const DRAFT_DIR = 'data/x_post_drafts';

function draftPath(date, root = ROOT) {
  return path.join(root, DRAFT_DIR, `${date}.json`);
}

/** 返り値: { draft } か { draft: null, reason }。 */
function loadDraft(date, root = ROOT) {
  const p = draftPath(date, root);
  if (!fs.existsSync(p)) return { draft: null, reason: 'draft_missing' };
  try {
    return { draft: JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch (_) {
    return { draft: null, reason: 'draft_bad_json' };
  }
}

/** 引用と記事を突き合わせるための形（空白を除き、全角を半角に、桁区切りを外す）。 */
function compactForQuote(s) {
  return normalizeDigits(String(s || '').normalize('NFKC')).replace(/\s+/g, '');
}

/**
 * 保存した文面の検査。返り値は落ちた理由の配列（空なら通過）。
 * 本文の数字は「記事のどこかにある」では足りず、すべて引用（evidence）の中になければならない。
 * 引用は記事の原文そのまま（空白と全角・半角の違いだけ許す）。数字を別の品に付け替える誤りを防ぐ。
 */
function checkDraft(draft, { entry, policy, articleText }) {
  const cfg = policy.draft || {};
  if (!draft || typeof draft !== 'object') return ['draft_missing'];
  const f = [];
  if (!entry || draft.slug !== entry.slug) f.push('draft_slug_mismatch');
  const types = Object.keys(cfg.types || {});
  if (!types.includes(draft.type)) f.push(`draft_type_unknown:${draft.type}`);
  const body = typeof draft.body === 'string' ? draft.body.trim() : '';
  if (!body) f.push('draft_body_empty');
  if (/https?:\/\//i.test(body)) f.push('draft_body_has_url');
  if (/(^|\s)[#＃][^\s#＃]/.test(body)) f.push('draft_body_has_hashtag');
  const w = weightedLength(body);
  if (w > (cfg.maxBodyWeighted || 230)) f.push(`draft_body_too_long:${w}`);
  const ev = Array.isArray(draft.evidence) ? draft.evidence.filter((x) => typeof x === 'string' && x.trim()) : [];
  const maxItems = cfg.evidenceMaxItems || 6;
  if (!ev.length || ev.length > maxItems || ev.length !== (draft.evidence || []).length) f.push(`draft_evidence_count:${ev.length}`);
  const article = compactForQuote(articleText);
  ev.forEach((e, i) => {
    const len = [...e.trim()].length;
    if (len < (cfg.evidenceMinChars || 10) || len > (cfg.evidenceMaxChars || 160)) f.push(`draft_evidence_length:${i}`);
    else if (!article.includes(compactForQuote(e))) f.push(`draft_evidence_not_in_article:${i}`);
  });
  if (body) {
    const missing = numbersMissingFromArticle(body, ev.join(' \n '));
    if (missing.length) f.push(`draft_numbers_not_in_evidence:${missing.join(',')}`);
  }
  // 返信（続き）。本文と同じく、数字はすべて引用の中になければならない
  if (draft.replies !== undefined) {
    const replies = Array.isArray(draft.replies) ? draft.replies : null;
    const maxReplies = cfg.maxReplies ?? 3;
    if (!replies || replies.length > maxReplies) f.push(`draft_replies_count:${replies ? replies.length : 'not_array'}`);
    else {
      replies.forEach((r, i) => {
        const t = typeof r === 'string' ? r.trim() : '';
        if (!t) f.push(`draft_reply_empty:${i}`);
        else {
          if (/https?:\/\//i.test(t)) f.push(`draft_reply_has_url:${i}`);
          if (/(^|\s)[#＃][^\s#＃]/.test(t)) f.push(`draft_reply_has_hashtag:${i}`);
          const rw = weightedLength(t);
          if (rw > (cfg.maxReplyWeighted || 270)) f.push(`draft_reply_too_long:${i}:${rw}`);
          const miss = numbersMissingFromArticle(t, ev.join(' \n '));
          if (miss.length) f.push(`draft_reply_numbers_not_in_evidence:${i}:${miss.join(',')}`);
        }
      });
    }
  }
  return f;
}

/** 返信の文面（保存した文面の replies。空白だけのものは除く）。 */
function draftReplies(draft) {
  return (Array.isArray(draft && draft.replies) ? draft.replies : [])
    .filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
}

/**
 * 返信の送る前の検査。返り値は落ちた理由の配列（空なら通過）。
 * 数字が記事の本文にあるか・使わない言い方・長さを見る（本文は validatePost が見る）。
 */
function validateReplies(replies, { policy, articleText, root = ROOT }) {
  const f = [];
  const max = (policy.draft || {}).maxReplyWeighted || 270;
  (replies || []).forEach((t, i) => {
    const w = weightedLength(t);
    if (w > max) f.push(`reply${i}_too_long:${w}`);
    const missing = numbersMissingFromArticle(t, articleText);
    if (missing.length) f.push(`reply${i}_numbers_not_in_article:${missing.join(',')}`);
    const words = wordingViolations(t, root);
    if (words.length) f.push(`reply${i}_wording:${words.join(',')}`);
    if ((String(t).match(URL_RE) || []).length) f.push(`reply${i}_has_url`);
  });
  return f;
}

/** 保存した文面＋URL（utm_content=型）＋ハッシュタグ。 */
function buildDraftPost(draft, entry, policy) {
  const url = utmUrl(entry, policy, draft.type);
  const r = withLink(String(draft.body || '').trim(), url, hashtagsFor(entry, policy), policy.maxWeightedLength || 280);
  if (!r) return { ok: false, mode: 'draft', reason: 'too_long' };
  const replies = draftReplies(draft);
  return { ok: true, mode: 'draft', type: draft.type, url, ...r, ...(replies.length ? { replies } : {}) };
}

/**
 * 文面の候補を、使いたい順に返す。各候補は { mode, text, weighted, ... } か、作れなかったときは { mode, failures }。
 * 送る前の検査（validatePost）は呼び出し側で行い、通った最初の候補を使う。
 */
function postCandidates({ entry, policy, date, html, root = ROOT }) {
  const out = [];
  const cfg = policy.draft || {};
  if (cfg.useInPost) {
    const { draft, reason } = loadDraft(date, root);
    if (!draft) out.push({ mode: 'draft', failures: [reason] });
    else {
      const failures = checkDraft(draft, { entry, policy, articleText: htmlToText(html) });
      if (failures.length) out.push({ mode: 'draft', failures });
      else {
        const b = buildDraftPost(draft, entry, policy);
        // 返信の検査に落ちたら、保存した文面は使わない（定型に戻る）
        const rf = b.ok && b.replies ? validateReplies(b.replies, { policy, articleText: htmlToText(html), root }) : [];
        out.push(b.ok && !rf.length ? b : { mode: 'draft', failures: b.ok ? rf : [b.reason] });
      }
    }
  }
  if ((policy.template || {}).points) out.push(...buildPointPosts(entry, policy, html));
  const t = buildTemplatePost(entry, policy);
  out.push(t.ok ? { ...t, mode: 'template' } : { mode: 'template', failures: [t.reason] });
  return out;
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
  DRAFT_DIR, draftPath, loadDraft, checkDraft, draftReplies, validateReplies, buildDraftPost, insiderPoints, buildPointPosts, postCandidates,
  htmlToText, normalizeDigits, numbersMissingFromArticle, wordingViolations, validatePost,
  readLog, writeJson, alreadyPosted, recentTexts, oauthHeader, classifyError, pct,
};
