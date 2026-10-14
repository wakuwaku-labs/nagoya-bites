#!/usr/bin/env node
'use strict';
/**
 * 日次ジャーナルを X に投稿する（SNS-001・計画書 docs/x-auto-posting-plan-2026-10.md）。
 *
 * 動き方は data/x_post_policy.json の mode で決まる:
 *   off     … 何もしない
 *   dry-run … 送る予定の文面を作って検査し、結果を出すだけ（X に送らない・台帳も書かない）
 *   live    … X に送り、台帳 data/x_post_log.json と心拍 data/x_post_health.json を書く
 *
 * 使い方:
 *   node scripts/post_journal_to_x.js                 # 今日（JST）の記事。mode はポリシーのとおり
 *   node scripts/post_journal_to_x.js --date 2026-10-12
 *   node scripts/post_journal_to_x.js --dry-run       # ポリシーが live でも送らない
 *   node scripts/post_journal_to_x.js --force-live    # ポリシーが dry-run でも送る（初回の手動投稿用。off のときは送らない）
 *   node scripts/post_journal_to_x.js --skip-live-check  # 本番 URL の確認を省く（手元の試し用・live では使えない）
 *   node scripts/post_journal_to_x.js --json
 *
 * 鍵（GitHub Secrets）: X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
 *
 * 終了コード: 0 = 送った・送る必要が無かった・試運転（試運転は検査に落ちても 0）/ 1 = live で送れなかった（理由は出力と心拍に書く）
 *
 * 二重投稿を防ぐ仕組み:
 *   1. 台帳に posted / duplicate があれば送らない
 *   2. ワークフローは同時に1つだけ動く（concurrency）
 *   3. 送った直後に落ちて台帳が残らなかった場合も、文面は同じ記事から同じものが作られるので、
 *      次の回は X が「重複」として拒む → それを届いた印として台帳に duplicate と書く（もう送らない）
 */
const fs = require('fs');
const path = require('path');
const X = require('./lib/x_post');

const TWEET_URL = 'https://api.x.com/2/tweets';

function todayJst(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const a = { date: null, dryRun: false, forceLive: false, skipLiveCheck: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--date') a.date = argv[++i];
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--force-live') a.forceLive = true;
    else if (k === '--skip-live-check') a.skipLiveCheck = true;
    else if (k === '--json') a.json = true;
    else throw new Error(`知らない引数: ${k}`);
  }
  if (a.date && !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('--date は YYYY-MM-DD');
  return a;
}

function effectiveMode(policyMode, args) {
  if (policyMode === 'off') return 'off';
  if (args.dryRun) return 'dry-run';
  if (args.forceLive) return 'live';
  return policyMode === 'live' ? 'live' : 'dry-run';
}

function findEntry(date, root) {
  const pub = JSON.parse(fs.readFileSync(path.join(root, 'data/journal_published.json'), 'utf8'));
  const list = (pub.entries || []).filter((e) => e.date === date && e.slug && e.title);
  // 同じ日に2本ある（やり直しで差し替えた等）ときは、最後に公開したものを使う
  list.sort((x, y) => String(x.published_at || '').localeCompare(String(y.published_at || '')));
  return list[list.length - 1] || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 本番の記事 URL が 200 を返すまで待つ。返り値: { ok, status, html, attempts } */
async function waitForLivePage(url, { attempts, intervalSeconds, fetchImpl = fetch }) {
  let last = { ok: false, status: 0, html: '', attempts: 0 };
  attempts = Math.max(1, Number(attempts) || 1);
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetchImpl(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
      const html = res.status === 200 ? await res.text() : '';
      last = { ok: res.status === 200, status: res.status, html, attempts: i };
      if (last.ok) return last;
    } catch (e) {
      last = { ok: false, status: 0, html: '', attempts: i, error: String(e.message || e) };
    }
    if (i < attempts) await sleep(intervalSeconds * 1000);
  }
  return last;
}

/** 記事の og:image が画像として取れるか（取れなくても投稿はする。カードの画像が出ないだけ）。 */
async function checkOgImage(html, fetchImpl = fetch) {
  const m = String(html).match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return { ok: false, reason: 'og_image_missing' };
  const url = m[1];
  if (/\.svg(\?|$)/i.test(url)) return { ok: false, url, reason: 'og_image_svg' };
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    if (res.body && res.body.cancel) await res.body.cancel().catch(() => {});
    if (res.status !== 200) return { ok: false, url, reason: `og_image_http_${res.status}` };
    if (!/^image\//i.test(type) || /svg/i.test(type)) return { ok: false, url, reason: `og_image_type_${type || 'unknown'}` };
    return { ok: true, url };
  } catch (e) {
    return { ok: false, url, reason: 'og_image_fetch_error' };
  }
}

function credentials(env) {
  const c = {
    consumerKey: env.X_API_KEY, consumerSecret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET,
  };
  return Object.values(c).every((v) => v && String(v).trim()) ? c : null;
}

const CREDENTIAL_NAMES = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];

/**
 * 鍵が入っているかだけを返す（値は返さない・出さない）。
 * 試運転の要約に出して、送らずに登録を確かめるため。
 * Access Token は「数字-英数字」の形（X のユーザー ID で始まる）なので、形が違えば別の欄の値を貼った疑い。
 */
function credentialStatus(env) {
  const st = {};
  for (const name of CREDENTIAL_NAMES) {
    const v = env[name] == null ? '' : String(env[name]).trim();
    if (!v) st[name] = 'empty';
    else if (name === 'X_ACCESS_TOKEN') st[name] = /^\d+-[A-Za-z0-9]+$/.test(v) ? 'set' : 'bad_format';
    // OAuth 1.0a の残りの3つは英数字だけ。「数字-英数字」は Access Token を別の名前に貼った印
    else if (/^\d+-[A-Za-z0-9]+$/.test(v)) st[name] = 'looks_access_token';
    else if (!/^[A-Za-z0-9]+$/.test(v)) st[name] = 'bad_format';
    else st[name] = 'set';
  }
  // 同じ値を2つの名前に貼ったときも、値を出さずに知らせる
  const seen = new Map();
  for (const name of CREDENTIAL_NAMES) {
    const v = env[name] == null ? '' : String(env[name]).trim();
    if (!v) continue;
    if (seen.has(v)) { st[name] = 'duplicate'; st[seen.get(v)] = 'duplicate'; } else seen.set(v, name);
  }
  return st;
}

/**
 * 形が合わない鍵の「形」だけを言葉にする（値は出さない）。長さ・ハイフンの位置・先頭の数字の桁数・英数字以外の記号の種類だけ。
 * 例: 「長さ 50・ハイフン 1 個（11 文字目）・先頭の数字 10 桁・英数字以外: なし」
 */
function credentialShape(value) {
  const v = value == null ? '' : String(value);
  const t = v.trim();
  const hy = [];
  for (let i = 0; i < t.length; i++) if (t[i] === '-') hy.push(i + 1);
  const lead = (t.match(/^\d*/) || [''])[0].length;
  const names = { ' ': '空白', '\t': 'タブ', '\n': '改行', '\r': '改行', '\u3000': '全角の空白' };
  const others = [...new Set([...t].filter((c) => !/[A-Za-z0-9-]/.test(c)))]
    .map((c) => names[c] || (/[\x21-\x7e]/.test(c) ? `「${c}」` : '全角などの文字'));
  const parts = [`長さ ${t.length}`, hy.length ? `ハイフン ${hy.length} 個（${hy.join('・')} 文字目）` : 'ハイフンなし', `先頭の数字 ${lead} 桁`, `英数字以外: ${others.length ? [...new Set(others)].join('') : 'なし'}`];
  if (v.length !== t.length) parts.push('前後に空白・改行あり（読むときに外している）');
  return parts.join('・');
}

async function sendTweet(text, cred, fetchImpl = fetch) {
  const auth = X.oauthHeader({ method: 'POST', url: TWEET_URL, ...cred });
  const res = await fetchImpl(TWEET_URL, {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  let body;
  const raw = await res.text();
  try { body = JSON.parse(raw); } catch (_) { body = raw; }
  return { status: res.status, body };
}

/** 結果を台帳・心拍に書く（live のときだけ呼ぶ）。 */
function record(root, { date, entry, result, reason, text, tweetId, errorClass, status }) {
  const now = new Date().toISOString();
  if (status) {
    const log = X.readLog(root);
    log.posts = log.posts || [];
    const row = {
      date, slug: entry.slug, status, text,
      attempted_at: now,
      ...(tweetId ? { tweet_id: tweetId, tweet_url: `https://x.com/i/web/status/${tweetId}`, posted_at: now } : {}),
      ...(errorClass ? { error_class: errorClass } : {}),
      ...(reason ? { reason } : {}),
    };
    // 同じ記事の未完了の行（failed・blocked）は最新の1行に置き換える（台帳が失敗で膨らまないように）
    log.posts = log.posts.filter((p) => !(p.slug === entry.slug && (p.status === 'failed' || p.status === 'blocked')));
    log.posts.push(row);
    log.posts = log.posts.slice(-400);
    X.writeJson(X.LOG_REL, log, root);
  }
  X.writeJson(X.HEALTH_REL, {
    _comment: 'X 自動投稿の最後の実行結果（scripts/post_journal_to_x.js が live のときに書く）。見張り役は .github/workflows/x-post-watchdog.yml',
    last_run: {
      date, slug: entry ? entry.slug : null, result, reason: reason || null,
      ...(errorClass ? { error_class: errorClass } : {}),
      ...(tweetId ? { tweet_id: tweetId } : {}),
      recorded_at: now,
    },
  }, root);
}

async function run(args, { root = X.ROOT, env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const policy = X.loadPolicy(root);
  const mode = effectiveMode(policy.mode, args);
  const date = args.date || todayJst(now);
  const out = { date, mode, policyMode: policy.mode };
  out.credentials = credentialStatus(env);
  out.credentialShapes = {};
  for (const n of CREDENTIAL_NAMES) if (!['set', 'empty'].includes(out.credentials[n])) out.credentialShapes[n] = credentialShape(env[n]);

  if (mode === 'off') return { ...out, result: 'off', exitCode: 0 };
  if (mode === 'live' && args.skipLiveCheck) throw new Error('--skip-live-check は live では使えません');

  const entry = findEntry(date, root);
  if (!entry) {
    // ジャーナルが休みの日は送らない（代わりの投稿を作らない）。心拍も書かない（休みの警報は journal-watchdog の役目）
    return { ...out, result: 'no_journal', exitCode: 0 };
  }
  out.slug = entry.slug;

  const log = X.readLog(root);
  if (X.alreadyPosted(log, entry.slug)) return { ...out, result: 'already_posted', exitCode: 0 };

  const articlePath = path.join(root, 'journal', `${entry.slug}.html`);
  if (!fs.existsSync(articlePath)) {
    if (mode === 'live') record(root, { date, entry, result: 'failed', reason: 'article_html_missing' });
    return { ...out, result: 'failed', reason: 'article_html_missing', exitCode: 1 };
  }
  const articleText = X.htmlToText(fs.readFileSync(articlePath, 'utf8'));

  const built = X.buildTemplatePost(entry, policy);
  if (!built.ok) {
    if (mode === 'live') record(root, { date, entry, result: 'blocked', reason: built.reason, status: 'blocked' });
    return { ...out, result: 'blocked', reason: built.reason, exitCode: 1 };
  }
  out.text = built.text;
  out.weighted = built.weighted;
  out.textMode = 'template';

  const failures = X.validatePost(built.text, {
    entry, policy, articleText, root,
    recentTexts: X.recentTexts(log, date, policy.duplicateWindowDays || 30),
  });
  if (failures.length) {
    const reason = failures.join(' / ');
    if (mode === 'live') record(root, { date, entry, result: 'blocked', reason, text: built.text, status: 'blocked' });
    return { ...out, result: 'blocked', reason, exitCode: 1 };
  }

  // 本番の記事が出ているか（出ていないページを貼るとリンクカードが壊れる）
  if (!args.skipLiveCheck) {
    const lp = policy.livePage || {};
    const live = await waitForLivePage(X.articleUrl(entry, policy), {
      attempts: mode === 'live' ? (lp.attempts ?? 20) : 1,
      intervalSeconds: lp.intervalSeconds ?? 30,
      fetchImpl,
    });
    out.livePage = { ok: live.ok, status: live.status, attempts: live.attempts };
    if (!live.ok) {
      // 次の起動でやり直す。失敗としては扱わない（見張り役が猶予の後で判断する）
      if (mode === 'live') record(root, { date, entry, result: 'page_not_live', reason: `http_${live.status}` });
      return { ...out, result: 'page_not_live', reason: `http_${live.status}`, exitCode: 0 };
    }
    out.ogImage = await checkOgImage(live.html, fetchImpl);
  }

  if (mode === 'dry-run') return { ...out, result: 'dry_run_ok', exitCode: 0 };

  const cred = credentials(env);
  if (!cred) {
    record(root, { date, entry, result: 'failed', reason: 'no_credentials', errorClass: 'auth', text: built.text, status: 'failed' });
    return { ...out, result: 'failed', reason: 'no_credentials', errorClass: 'auth', exitCode: 1 };
  }

  let res;
  try {
    res = await sendTweet(built.text, cred, fetchImpl);
  } catch (e) {
    const reason = `network:${e.message || e}`;
    record(root, { date, entry, result: 'failed', reason, errorClass: 'server', text: built.text, status: 'failed' });
    return { ...out, result: 'failed', reason, errorClass: 'server', exitCode: 1 };
  }
  const id = res.body && res.body.data && res.body.data.id;
  if ((res.status === 201 || res.status === 200) && id) {
    record(root, { date, entry, result: 'posted', text: built.text, tweetId: id, status: 'posted' });
    return { ...out, result: 'posted', tweetId: id, tweetUrl: `https://x.com/i/web/status/${id}`, exitCode: 0 };
  }
  const errorClass = X.classifyError(res.status, res.body);
  const detail = typeof res.body === 'string' ? res.body.slice(0, 300) : JSON.stringify(res.body).slice(0, 300);
  const reason = `http_${res.status}: ${detail}`;
  if (errorClass === 'duplicate') {
    // 同じ文面が既に X にある＝前の回で届いていた。もう送らない
    record(root, { date, entry, result: 'duplicate', reason, errorClass, text: built.text, status: 'duplicate' });
    return { ...out, result: 'duplicate', reason, errorClass, exitCode: 0 };
  }
  record(root, { date, entry, result: 'failed', reason, errorClass, text: built.text, status: 'failed' });
  return { ...out, result: 'failed', reason, errorClass, exitCode: 1 };
}

const RESULT_JA = {
  off: '停止中（mode=off）', no_journal: '今日のジャーナルが無いので送らない', already_posted: '投稿済み',
  failed: '送れなかった', blocked: '文面の検査に落ちたので送らない', page_not_live: '本番の記事がまだ出ていない（次の回でやり直す）',
  dry_run_ok: '試運転: 文面の検査を通過（X には送っていない）', posted: '投稿した', duplicate: '同じ文面が既に X にある（前の回で届いていた）',
};

function summaryMarkdown(r) {
  const lines = [`## X 自動投稿 ${r.date}`, '', `- 結果: **${RESULT_JA[r.result] || r.result}**`, `- mode: \`${r.mode}\`（ポリシー: \`${r.policyMode}\`）`];
  if (r.slug) lines.push(`- 記事: \`${r.slug}\``);
  if (r.reason) lines.push(`- 理由: ${r.reason}`);
  if (r.weighted) lines.push(`- 文字数（X の数え方）: ${r.weighted} / 280`);
  if (r.livePage) lines.push(`- 本番の記事: HTTP ${r.livePage.status}（${r.livePage.attempts} 回目）`);
  if (r.ogImage) lines.push(`- リンクカードの画像: ${r.ogImage.ok ? 'OK' : `出ない見込み（${r.ogImage.reason}）`}`);
  if (r.tweetUrl) lines.push(`- 投稿: ${r.tweetUrl}`);
  if (r.credentials) {
    const ja = { set: '登録済み', empty: '空（未登録）', bad_format: '形が違う（別の欄の値の疑い）', looks_access_token: 'Access Token の値が入っている疑い', duplicate: 'ほかの名前と同じ値' };
    lines.push(`- 鍵（値は出さない）: ${CREDENTIAL_NAMES.map((n) => `${n}=${ja[r.credentials[n]]}`).join('・')}`);
    for (const [n, shape] of Object.entries(r.credentialShapes || {})) lines.push(`  - ${n} の形: ${shape}`);
  }
  if (r.text) lines.push('', '### 文面', '', '```', r.text, '```');
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const r = await run(args);
  // 試運転では検査に落ちても終了コードは 0（結果は要約に出す。試運転の間に毎日ジョブの失敗メールを出さない）
  if (r.mode !== 'live') r.exitCode = 0;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(r));
  if (args.json) console.log(JSON.stringify(r, null, 2));
  else process.stdout.write(summaryMarkdown(r));
  process.exitCode = r.exitCode;
}

if (require.main === module) {
  main().catch((e) => { console.error(e.stack || String(e)); process.exitCode = 1; });
}

module.exports = { run, parseArgs, effectiveMode, findEntry, todayJst, waitForLivePage, checkOgImage, credentials, credentialStatus, credentialShape, summaryMarkdown };
