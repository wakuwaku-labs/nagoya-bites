#!/usr/bin/env node
'use strict';
/**
 * note 自動投稿（docs/decisions/0054）の見張り役の判定。.github/workflows/note-post-watchdog.yml が毎日実行する。
 *
 * 投稿は Mac の run_journal_local.sh の最後で post_note.js が行うので、Mac の中の記録だけを見ると
 * Mac ごと止まった日に気づけない（ISSUE-084 原則1）。そこで「note に記事が実際に出ているか」を
 * GitHub から note の RSS で確かめ、原因は Mac が push する data/note_post_health.json から運ぶ。
 *
 * 判定は検証できる事実だけで行う（CLAUDE.md 制約10）:
 *   data/journal_published.json の公開の記録 × note の RSS の題名 × data/note_post_health.json の最後の結果
 *
 * 鳴らすとき（mode=live のときだけ）:
 *   - human_action … 未ログイン・別アカウントなど、人が直すしかない失敗が最後の結果に残っている（猶予を待たない）
 *   - blocked      … 下書きの検査に落ちて送っていない
 *   - missing_post … 記事の公開（published_at）から graceHours を過ぎても note の RSS に出ていない
 * 鳴らさないとき: mode が live でない / ジャーナルが休みの日（それは journal-watchdog.yml の役目）
 * RSS が読めなかった日は、Mac の記録が「公開済み」なら出ているとみなす（取得の一時的な失敗で鳴らさない）。
 *
 *   node scripts/check_note_post_health.js [--rss <RSS の XML ファイル>] [--json]   （問題があれば exit 1）
 */
const fs = require('fs');
const path = require('path');
const N = require('./lib/note_draft');

const ROOT = path.resolve(__dirname, '..');
const HEALTH_REL = 'data/note_post_health.json';
/** 人が直すしかない失敗（post_note.js の errorClass と同じ値） */
const HUMAN_ACTION = new Set(['login']);

function readJson(root, rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (_) { return fallback; }
}

const jstDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const norm = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, '');
const decode = (s) => String(s || '')
  .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&').trim();

/** note の RSS から記事の題名・URL を取り出す。 */
function parseRss(xml) {
  return [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const tag = (t) => decode((new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(m[1]) || [])[1]);
    return { title: tag('title'), link: tag('link'), pubDate: tag('pubDate') };
  });
}

/** note に出るはずの題名（post_note.js と同じく記事の h1 から作る。読めなければ公開の記録の題名）。 */
function expectedTitle(root, entry) {
  try {
    return N.parseArticle(fs.readFileSync(path.join(root, 'journal', `${entry.slug}.html`), 'utf8')).title || entry.title;
  } catch (_) { return entry.title; }
}

function check({ root = ROOT, now = new Date(), rss = null } = {}) {
  const policy = N.loadPolicy(root);
  const today = jstDate(now.getTime());
  if (policy.mode !== 'live') return { ok: true, status: 'not_live', mode: policy.mode, today, problems: [] };

  const w = policy.watchdog || {};
  const graceMs = (w.graceHours ?? 3) * 3600000;
  const liveSince = policy.liveSince || today;
  const yesterday = jstDate(now.getTime() - 86400000);
  const pub = readJson(root, 'data/journal_published.json', { entries: [] });
  const health = readJson(root, HEALTH_REL, {}).last_run || null;
  const items = rss == null ? null : parseRss(rss);

  // post_note.js は日付ごとに最後に公開した1本だけを送る（build_note_draft.js と同じ選び方）
  const byDate = new Map();
  for (const e of (pub.entries || [])) {
    if (!e.slug || !e.title || e.date < liveSince || (e.date !== today && e.date !== yesterday)) continue;
    const cur = byDate.get(e.date);
    if (!cur || String(e.published_at).localeCompare(String(cur.published_at)) >= 0) byDate.set(e.date, e);
  }

  const problems = [];
  for (const e of [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))) {
    const title = expectedTitle(root, e);
    const h = health && health.slug === e.slug ? health : null;
    const onNote = items
      ? items.some((i) => norm(i.title) === norm(title))
      : Boolean(h && h.result === 'live');
    if (onNote) continue;
    const base = { date: e.date, slug: e.slug, title, error_class: h ? h.error_class || null : null, reason: h ? h.reason || null : null };
    if (h && h.result === 'blocked') problems.push({ kind: 'blocked', ...base });
    else if (h && HUMAN_ACTION.has(h.error_class)) problems.push({ kind: 'human_action', ...base });
    else {
      const published = Date.parse(e.published_at || `${e.date}T09:00:00+09:00`);
      if (Number.isFinite(published) && now.getTime() - published >= graceMs) {
        problems.push({ kind: 'missing_post', ...base,
          reason: base.reason || (h ? `Mac 側の最後の結果: ${h.result}` : 'Mac 側にこの記事の送信の記録がない（毎朝の実行が note の手前で止まったか、記録の push に失敗した）') });
      }
    }
  }
  return { ok: problems.length === 0, status: problems.length ? 'problem' : 'ok', mode: policy.mode, today,
    rss: items ? `${items.length} 件` : '読めなかった', last_run: health, problems };
}

const FIX = {
  human_action: '投稿用の Chrome の窓が note に NAGOYA BITES で入れませんでした（投稿の前の自動の入り直しも通らなかった）。Mac のターミナルで `node scripts/note_login.js --google` を実行し、だめなら `node scripts/note_login.js --own`（開いた窓で本人が NAGOYA BITES にログイン）のあと `node scripts/post_note.js --date <日付>` で出し直してください（判断の記録 0057）。',
  blocked: '下書きの検査（使わない言い方・記事に無い数字・UTM）に落ちたため送っていません。理由の項目を見て scripts/lib/note_draft.js か記事を直し、`node scripts/post_note.js --date <日付>` で出し直してください。',
  missing_post: 'Mac の ~/nagoya-bites/.local-logs/journal-<日付>.log の「note へ送信」の行と、失敗時の画面の写真 ~/.config/nagoya-bites/note-fail/<日付>.png を見てください。Mac がスリープしていた・窓が開けなかった等の一時的な失敗なら `node scripts/post_note.js --date <日付>` で出し直せます（同じ記事は二重に出ません）。',
};

function issueBody(r) {
  const lines = [`note 自動投稿で問題を見つけました（JST ${r.today} 時点・note の RSS: ${r.rss}）。`, ''];
  for (const p of r.problems) {
    lines.push(`## ${p.date} — ${p.title || p.slug}`);
    lines.push(`- 種類: \`${p.kind}\``);
    if (p.error_class) lines.push(`- 失敗の分類: \`${p.error_class}\``);
    if (p.reason) lines.push(`- 理由: ${String(p.reason).slice(0, 300)}`);
    lines.push(`- 対処: ${FIX[p.kind].replace(/<日付>/g, p.date)}`);
    lines.push('');
  }
  if (r.last_run) lines.push(`Mac 側の最後の結果: \`${r.last_run.result}\`（${r.last_run.date}・${r.last_run.recorded_at}）`, '');
  lines.push('---', 'この Issue は note に記事が出たのを確認すると自動でクローズされます（note-post-watchdog.yml）。止めたいときは data/note_post_policy.json の mode を dry-run か off にしてください。');
  return lines.join('\n');
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const rssPath = a.includes('--rss') ? a[a.indexOf('--rss') + 1] : null;
  let rss = null;
  if (rssPath) { try { rss = fs.readFileSync(rssPath, 'utf8'); if (!/<rss[\s>]/.test(rss)) rss = null; } catch (_) { rss = null; } }
  const r = check({ rss });
  r.issue_body = r.ok ? null : issueBody(r);
  if (a.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else console.log(r.ok ? `OK（${r.status}・mode=${r.mode}・RSS ${r.rss}）` : r.issue_body);
  process.exitCode = r.ok ? 0 : 1;
}

module.exports = { check, issueBody, parseRss, HEALTH_REL };
