#!/usr/bin/env node
'use strict';
/**
 * 自分の note 記事の数字（ビュー・スキ・コメント）とフォロワー数を、1日1回、読むだけで取る（docs/decisions/0059・取り決め §2）。
 *
 * - 使うのは既存の専用プロファイルのログイン（scripts/lib/note_browser.js）だけ。新しい認証情報は作らず、
 *   未ログイン・別アカウント・401/403・形の違いは「再ログインを試さず」その日の取得を止めて終了コード 1 を返す
 *   （run_journal_local.sh が Mac の通知を出す。理由は保存先の last_run にも残る）。
 * - 読むのは自分のアカウントの統計だけ。書き込み・スキ・フォロー・コメントは一切しない。1回の実行で 6 リクエストまで。
 * - 保存先: ~/Library/Mobile Documents/com~apple~CloudDocs/sns-analyzer-x/nagoya_bites/note_metrics.json
 *   （schema "note-metrics/1"。公開リポジトリには置かない。環境変数 SNS_ANALYZER_X_DIR で変えられる）。
 *   記事の本文は保存しない。同じ日（JST）に2回動いたら、その日の行を置き換える（増えない）。
 * - 取れない項目は null と理由を残す（推測で埋めない）。
 * - AI の環境（Claude Code の中）では本物の note に通信しない。--dry-run は通信も保存もしない。
 *
 *   node scripts/fetch_note_stats.js [--dry-run] [--json]
 * 終了コード: 0 = 取れた／dry-run／対象なし、1 = その日は取れなかった、2 = 引数の誤り・AI の環境での本番実行
 */
const fs = require('fs');
const path = require('path');
const S = require('./lib/sns_analyzer');

const ROOT = path.resolve(__dirname, '..');
const OUT_NAME = 'note_metrics.json';
const SCHEMA = 'note-metrics/1';
const MAX_PAGES = 5;
const PV_URL = (page) => `https://note.com/api/v1/stats/pv?filter=all&page=${page}&sort=pv`;
const CREATOR_URL = (urlname) => `https://note.com/api/v2/creators/${encodeURIComponent(urlname)}`;

class StatsError extends Error {
  constructor(cls, message) { super(message); this.cls = cls; }
}

function parseArgs(argv) {
  const a = { dryRun: false, json: false };
  for (const k of argv) {
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--json') a.json = true;
    else throw new Error(`知らない引数: ${k}`);
  }
  return a;
}

const todayJst = (now) => new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const isCount = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 台帳（data/note_post_log.json・gitignore 済み）から note_key → slug。公開済み（live）だけ。 */
function keyToSlug(root) {
  const map = new Map();
  let log;
  try { log = JSON.parse(fs.readFileSync(path.join(root, 'data/note_post_log.json'), 'utf8')); } catch (_) { return map; }
  for (const e of (log.entries || [])) {
    if (!e || e.status !== 'live' || !e.slug) continue;
    const m = /\/n\/(n[0-9a-z]+)/i.exec(String(e.url || ''));
    if (m) map.set(m[1], e.slug);
  }
  return map;
}

/** 統計の1ページ分の応答を検査して { items, lastPage } にする。形が違えば StatsError('shape')。 */
function parseStatsPage(status, text) {
  if (status === 401 || status === 403) throw new StatsError('auth', `統計の取得が拒否されました（HTTP ${status}）`);
  if (status < 200 || status >= 300) throw new StatsError('http', `統計の取得に失敗しました（HTTP ${status}）`);
  let j;
  try { j = JSON.parse(text); } catch (_) { throw new StatsError('shape', '統計の応答が JSON ではありません'); }
  const d = j && j.data;
  const list = d && d.note_stats;
  if (!Array.isArray(list)) throw new StatsError('shape', '統計の応答に data.note_stats の配列がありません');
  const items = list.map((x, i) => {
    if (!x || typeof x.key !== 'string' || !isCount(x.read_count) || !isCount(x.like_count) || !isCount(x.comment_count)) {
      throw new StatsError('shape', `統計の ${i + 1} 件目の形が違います（key・read_count・like_count・comment_count）`);
    }
    return { key: x.key, views: x.read_count, likes: x.like_count, comments: x.comment_count };
  });
  const lastPage = isCount(d.last_page) ? d.last_page : 1;
  return { items, lastPage };
}

/** フォロワー数。取れなければ { count: null, reason }（失敗にはしない）。 */
function parseFollowers(status, text) {
  if (status === 401 || status === 403) throw new StatsError('auth', `フォロワー数の取得が拒否されました（HTTP ${status}）`);
  if (status < 200 || status >= 300) return { count: null, reason: `http_${status}` };
  try {
    const d = JSON.parse(text).data;
    const n = d && (d.followerCount ?? d.follower_count);
    return isCount(n) ? { count: n } : { count: null, reason: 'follower_count_missing' };
  } catch (_) { return { count: null, reason: 'bad_json' }; }
}

function readMetrics(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw new StatsError('storage', `保存先を読めません: ${e.code || e.message}`); }
  try {
    const j = JSON.parse(raw);
    if (j && j.schema === SCHEMA && Array.isArray(j.articles) && Array.isArray(j.followers)) return j;
  } catch (_) { /* 下で止める */ }
  // 壊れた・知らない形のファイルを黙って上書きしない（それまでの蓄積を失わないため）
  throw new StatsError('storage', `${path.basename(file)} が壊れているか知らない形です。上書きせずに止めます`);
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

/** 取った数字を保存先の形に足す（同じ日の行は置き換え。既存のキーは変えない）。 */
function merge(doc, { fetchedAt, day, rows, slugOf, followers }) {
  const out = doc || { schema: SCHEMA, updated_at: null, articles: [], followers: [] };
  const sameDay = (s) => todayJst(new Date(s.fetched_at)) === day;
  for (const r of rows) {
    let a = out.articles.find((x) => x.note_key === r.key);
    if (!a) { a = { slug: slugOf.get(r.key), note_key: r.key, snapshots: [] }; out.articles.push(a); }
    a.snapshots = a.snapshots.filter((s) => !sameDay(s));
    a.snapshots.push({ fetched_at: fetchedAt, views: r.views, likes: r.likes, comments: r.comments });
  }
  if (followers.count !== null) {
    out.followers = out.followers.filter((s) => !sameDay(s));
    out.followers.push({ fetched_at: fetchedAt, count: followers.count });
  }
  out.updated_at = fetchedAt;
  return out;
}

/**
 * 本体。reader = { currentUser(), get(url) → { status, text }, close() }（試験では偽物を渡す）。
 * 返り値: { result: 'ok'|'failed'|'dry_run'|'nothing', ... }。例外は投げない。
 */
async function run(args, { root = ROOT, now = new Date(), reader = null, openReader = null } = {}) {
  const file = path.join(S.analyzerDir(), OUT_NAME);
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'data/note_post_policy.json'), 'utf8'));
  const account = policy.account || {};
  const day = todayJst(now);
  const slugOf = keyToSlug(root);
  const out = { day, file, articles_expected: slugOf.size };
  if (args.dryRun) {
    return { ...out, result: 'dry_run', requests: [PV_URL(1), `（2 ページ目以降は last_page まで・最大 ${MAX_PAGES} ページ）`, CREATOR_URL(account.urlname || '(urlname)')], account: account.nickname || null };
  }
  if (slugOf.size === 0) return { ...out, result: 'nothing', reason: '台帳（data/note_post_log.json）に公開済みの記事がありません' };

  let r = reader;
  let opened = false;
  try {
    if (!r) { r = await openReader(); opened = true; }
    const who = await r.currentUser();
    if (!who) throw new StatsError('auth', '専用プロファイルが note に未ログインです（再ログインは試しません）');
    if (account.nickname && who.nickname !== account.nickname) {
      throw new StatsError('account', `ログイン中のアカウントが違います（今: ${who.nickname} / 必要: ${account.nickname}）`);
    }
    const rows = [];
    let last = 1;
    for (let page = 1; page <= Math.min(last, MAX_PAGES); page++) {
      const res = await r.get(PV_URL(page));
      const p = parseStatsPage(res.status, res.text);
      last = p.lastPage;
      rows.push(...p.items);
      if (!p.items.length) break;
    }
    if (!rows.length) throw new StatsError('empty', '統計が 0 件でした（台帳には公開済みの記事があるのに空）。取り込まずに止めます');
    const mine = rows.filter((x) => slugOf.has(x.key));
    if (!mine.length) throw new StatsError('shape', '統計の記事 key が台帳のどれにも一致しません。取り込まずに止めます');
    const fres = await r.get(CREATOR_URL(who.urlname || account.urlname));
    const followers = parseFollowers(fres.status, fres.text);

    const fetchedAt = now.toISOString();
    const doc = merge(readMetrics(file), { fetchedAt, day, rows: mine, slugOf, followers });
    doc.last_run = { at: fetchedAt, result: 'ok', reason: null,
      ...(followers.count === null ? { followers_unavailable_reason: followers.reason } : {}),
      articles_read: mine.length, articles_expected: slugOf.size };
    writeAtomic(file, doc);
    return { ...out, result: 'ok', articles_read: mine.length, followers: followers.count, followers_reason: followers.reason || null };
  } catch (e) {
    const cls = e instanceof StatsError ? e.cls : 'error';
    const reason = (e.message || String(e)).slice(0, 300);
    // 失敗の理由も保存先に残す（読めるときだけ。蓄積は壊さない）
    try {
      const doc = readMetrics(file);
      if (doc) { doc.last_run = { at: now.toISOString(), result: 'failed', error_class: cls, reason }; writeAtomic(file, doc); }
    } catch (_) { /* 保存先が壊れているときは触らない */ }
    return { ...out, result: 'failed', error_class: cls, reason };
  } finally {
    if (opened && r) { try { await r.close(); } catch (_) { /* 閉じられなくても続ける */ } }
  }
}

/** 本物の note を読む窓口（Mac の人の環境でだけ使う）。専用プロファイルのログインで入り、再ログインは試さない。 */
async function openRealReader() {
  const B = require('./lib/note_browser');
  const browser = await B.launch({ headless: false }); // headless だと note が 403 を返す（post_note.js と同じ）
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await B.restoreCookies(page);
  await page.goto('https://note.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  return {
    currentUser: () => B.currentUser(page),
    get: async (url) => {
      await new Promise((r) => setTimeout(r, 1000));
      return page.evaluate(async (u) => {
        const r = await fetch(u, { credentials: 'include' });
        return { status: r.status, text: await r.text() };
      }, url);
    },
    close: () => browser.close(),
  };
}

const inAiEnvironment = (env = process.env) => !!(env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT || env.CODEX_SANDBOX || env.CODEX_HOME);

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (!args.dryRun && inAiEnvironment()) {
    console.error('AI の環境では本物の note に通信しません。--dry-run を使ってください（本番は Mac の launchd が動かします）');
    process.exit(2);
  }
  const r = await run(args, { openReader: openRealReader });
  if (args.json) console.log(JSON.stringify(r, null, 2));
  else if (r.result === 'ok') console.log(`note の数字: 記事 ${r.articles_read}/${r.articles_expected} 件、フォロワー ${r.followers === null ? '取得不可（' + r.followers_reason + '）' : r.followers} → ${r.file}`);
  else if (r.result === 'failed') console.error(`note の数字を取れませんでした（${r.error_class}）: ${r.reason}`);
  else if (r.result === 'dry_run') console.log(`試し（通信しない・保存しない）: 保存先 ${r.file}、対象 ${r.articles_expected} 件、アカウント ${r.account}\n${r.requests.join('\n')}`);
  else console.log(`note の数字: ${r.reason}`);
  process.exit(r.result === 'failed' ? 1 : 0);
}

if (require.main === module) main();

module.exports = { run, parseArgs, parseStatsPage, parseFollowers, keyToSlug, merge, inAiEnvironment, OUT_NAME, SCHEMA };
