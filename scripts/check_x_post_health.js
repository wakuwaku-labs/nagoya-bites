#!/usr/bin/env node
'use strict';
/**
 * X 自動投稿（SNS-001）の見張り役の判定。.github/workflows/x-post-watchdog.yml が毎晩実行する。
 *
 * 判定は検証できる事実だけで行う（CLAUDE.md 制約10）:
 *   data/journal_published.json の公開の記録 × data/x_post_log.json の投稿の記録 × data/x_post_health.json の最後の結果
 *
 * 鳴らすとき（mode=live のときだけ）:
 *   - missing_post … 記事の公開（published_at）から graceHours を過ぎても投稿が台帳に無い
 *   - human_action … 鍵が無効・権限が無い・残高切れなど、人が直すしかない失敗が最後の結果に残っている（猶予を待たない）
 *   - blocked      … 文面の検査に落ちて送っていない（題名に使わない言い方が残っている等）
 *   - draft_unused … 保存した文面（Mac 側の Claude が書くもの・P-476）が draft.alertAfterDays 回続けて使われず、
 *                    定型で送っている（Mac で書けていない・検査に落ちている。投稿そのものは続いている）
 * 鳴らさないとき: mode が live でない / ジャーナルが休みの日（それは journal-watchdog.yml の役目）
 *
 * 使い方: node scripts/check_x_post_health.js [--json]   （問題があれば exit 1）
 */
const fs = require('fs');
const path = require('path');
const X = require('./lib/x_post');

function readJson(root, rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (_) { return fallback; }
}

function jstDate(ms) {
  return new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
}

function check({ root = X.ROOT, now = new Date() } = {}) {
  const policy = X.loadPolicy(root);
  const today = jstDate(now.getTime());
  if (policy.mode !== 'live') return { ok: true, status: 'not_live', mode: policy.mode, today, problems: [] };

  const graceMs = ((policy.watchdog && policy.watchdog.graceHours) ?? 6) * 3600000;
  const liveSince = policy.liveSince || today;
  const yesterday = jstDate(now.getTime() - 86400000);
  const pub = readJson(root, 'data/journal_published.json', { entries: [] });
  const log = readJson(root, X.LOG_REL, { posts: [] });
  const health = readJson(root, X.HEALTH_REL, {}).last_run || null;

  const entries = (pub.entries || []).filter((e) => (e.date === today || e.date === yesterday) && e.date >= liveSince && e.slug);
  const problems = [];
  for (const e of entries) {
    if (X.alreadyPosted(log, e.slug)) continue;
    const rows = (log.posts || []).filter((p) => p.slug === e.slug);
    const last = rows[rows.length - 1];
    const lastHealth = health && health.slug === e.slug ? health : null;
    const errorClass = (last && last.error_class) || (lastHealth && lastHealth.error_class) || null;
    const reason = (last && last.reason) || (lastHealth && lastHealth.reason) || null;
    if (last && last.status === 'blocked') {
      problems.push({ kind: 'blocked', date: e.date, slug: e.slug, title: e.title, reason });
    } else if (errorClass && X.HUMAN_ACTION_ERRORS.has(errorClass)) {
      problems.push({ kind: 'human_action', date: e.date, slug: e.slug, title: e.title, error_class: errorClass, reason });
    } else {
      const published = Date.parse(e.published_at || `${e.date}T09:00:00+09:00`);
      if (Number.isFinite(published) && now.getTime() - published >= graceMs) {
        problems.push({ kind: 'missing_post', date: e.date, slug: e.slug, title: e.title, error_class: errorClass, reason: reason || (lastHealth && lastHealth.result) || 'x-post.yml が一度も投稿を試みていない' });
      }
    }
  }
  const du = draftUnused(policy, log, liveSince);
  if (du) problems.push(du);
  return { ok: problems.length === 0, status: problems.length ? 'problem' : 'ok', mode: policy.mode, today, last_run: health, problems };
}

/** 送った投稿が直近 alertAfterDays 回続けて保存した文面を使っていなければ、その問題を返す。 */
function draftUnused(policy, log, liveSince) {
  const d = policy.draft || {};
  const n = Number(d.alertAfterDays) || 0;
  if (!d.generate || !d.useInPost || n <= 0) return null;
  const since = d.since || liveSince;
  const sent = (log.posts || [])
    .filter((p) => (p.status === 'posted' || p.status === 'duplicate') && p.date >= since)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const lastN = sent.slice(-n);
  // 作り方を記録していない行（P-476 より前）は数えない
  if (lastN.length < n || !lastN.every((p) => p.text_mode && p.text_mode !== 'draft')) return null;
  const last = lastN[lastN.length - 1];
  return {
    kind: 'draft_unused', date: last.date, slug: last.slug,
    title: `保存した文面が ${n} 回続けて使われていない`,
    reason: lastN.map((p) => `${p.date}: ${p.text_mode}${p.draft_reason ? `（${p.draft_reason}）` : ''}`).join(' / '),
  };
}

const FIX = {
  auth: '鍵（X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET）が無いか無効です。X の開発者画面で Access Token を作り直し、GitHub の Settings → Secrets and variables → Actions で4つを登録し直してください（docs/x-api-setup.md）。',
  forbidden: 'アプリの権限が足りません。X の開発者画面で User authentication settings の権限を「Read and write」にし、Access Token を作り直して GitHub Secrets を更新してください（権限を変えたあとは古いトークンでは投稿できません）。',
  payment: 'X API の残高切れか、上限額に達しています。X の開発者画面の Billing で残高と上限（Spending limit）を確かめてください。',
};

function issueBody(r) {
  const lines = [`X 自動投稿で問題を見つけました（JST ${r.today} 時点）。`, ''];
  for (const p of r.problems) {
    lines.push(`## ${p.date} — ${p.title || p.slug}`);
    lines.push(`- 種類: \`${p.kind}\``);
    if (p.error_class) lines.push(`- 失敗の分類: \`${p.error_class}\``);
    if (p.reason) lines.push(`- 理由: ${String(p.reason).slice(0, 300)}`);
    if (p.kind === 'draft_unused') lines.push('- 対処: 投稿は題名＋記事のポイントの定型で続いています。理由が draft_missing なら Mac 側で書けていません（~/nagoya-bites/.local-logs/ の「X 用の文面」の行を確認。Claude の認証切れ・利用上限・時間切れ・claude の --safe-mode / --tools の変更）。それ以外なら検査に落ちているので docs/x-post-prompt.md を直してください（docs/decisions/0047-x-post-drafts.md）。');
    else if (p.kind === 'blocked') lines.push('- 対処: 文面の検査に落ちたため送っていません。題名に使わない言い方（data/selection_wording_policy.json）が残っていないか確かめ、必要なら data/x_post_policy.json の titleRewrites に置き換えを足してください。');
    else if (FIX[p.error_class]) lines.push(`- 対処: ${FIX[p.error_class]}`);
    else lines.push('- 対処: Actions の「X 自動投稿」の最新の実行の要約を見てください。X 側の一時的な不調なら次の起動で自動で投稿されます。直したあと手動で実行する場合は Actions → X 自動投稿 → Run workflow。');
    lines.push('');
  }
  if (r.last_run) lines.push(`最後の実行: \`${r.last_run.result}\`（${r.last_run.recorded_at}）`, '');
  lines.push('---', 'この Issue は投稿が確認できると自動でクローズされます（x-post-watchdog.yml）。止めたいときは data/x_post_policy.json の mode を dry-run か off にしてください。');
  return lines.join('\n');
}

if (require.main === module) {
  const r = check();
  r.issue_body = r.ok ? null : issueBody(r);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else console.log(r.ok ? `OK（${r.status}・mode=${r.mode}）` : r.issue_body);
  process.exitCode = r.ok ? 0 : 1;
}

module.exports = { check, issueBody, draftUnused };
