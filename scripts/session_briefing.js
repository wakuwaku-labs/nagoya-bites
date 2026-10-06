#!/usr/bin/env node
/**
 * セッション開始時の自動ブリーフィング（「おはよう」と言わなくても毎回出る）。
 *
 * .claude/settings.json の SessionStart フックが毎セッション実行し、出力が Claude の文脈に入る。
 * 判定は検証できる事実だけ（Linear の状態・優先度・期日・更新日時、HANDOFF.md の先頭行）で行う（制約10）。
 * 閾値の正本は data/session_briefing_policy.json。
 *
 *   node scripts/session_briefing.js          # 人と Claude 向けの短い要約
 *   node scripts/session_briefing.js --json   # 機械向け
 *
 * 取得に失敗しても exit 0（セッション開始を止めない）。ただし失敗は理由つきで必ず表示する
 * （「取れなかった」を「問題なし」と同じ顔にしない）。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const POLICY = path.join(ROOT, 'data/session_briefing_policy.json');
const HANDOFF = path.join(ROOT, 'HANDOFF.md');
const ACTIVE_TYPES = new Set(['backlog', 'unstarted', 'started']);
const DAY = 86400000;

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`)) / DAY);
}

/** Linear の Issue 一覧から、今日見るべきものを分類する（純関数・テスト対象）。 */
function classify(issues, today, policy) {
  const active = issues.filter(i => ACTIVE_TYPES.has(i.state?.type));
  const overdue = [];
  const dueSoon = [];
  const urgentNotStarted = [];
  const inProgress = [];
  const stale = [];
  for (const issue of active) {
    const started = issue.state.type === 'started';
    if (issue.dueDate) {
      const left = daysBetween(today, issue.dueDate);
      if (left < 0) overdue.push({ ...issue, daysLate: -left });
      else if (left <= policy.dueSoonDays) dueSoon.push({ ...issue, daysLeft: left });
    }
    if (issue.priority === 1 && !started) urgentNotStarted.push(issue);
    if (started) inProgress.push(issue);
    const idle = issue.updatedAt ? daysBetween(issue.updatedAt, today) : 0;
    if (idle >= policy.staleDays) stale.push({ ...issue, idleDays: idle });
  }
  overdue.sort((a, b) => b.daysLate - a.daysLate);
  dueSoon.sort((a, b) => a.daysLeft - b.daysLeft);
  stale.sort((a, b) => b.idleDays - a.idleDays);
  const byPriority = (a, b) => (a.priority || 5) - (b.priority || 5);
  inProgress.sort(byPriority);

  // 今日の候補: 期限切れ → Urgent未着手 → 期限間近 → 進行中（優先度順）。重複は除く。
  const picks = [];
  const seen = new Set();
  for (const [reason, list] of [['期限切れ', overdue], ['緊急・未着手', urgentNotStarted], ['期限間近', dueSoon], ['進行中', inProgress]]) {
    for (const issue of list) {
      if (picks.length >= policy.maxTodayPicks) break;
      if (seen.has(issue.identifier)) continue;
      seen.add(issue.identifier);
      picks.push({ identifier: issue.identifier, title: issue.title, reason });
    }
  }
  return {
    activeCount: active.length,
    overdue, dueSoon, urgentNotStarted, inProgress, stale, picks,
    missing: {
      project: active.filter(i => !i.project).length,
      assignee: active.filter(i => !i.assignee).length,
      dueDate: active.filter(i => !i.dueDate).length,
    },
  };
}

function readHandoff() {
  try {
    const text = fs.readFileSync(HANDOFF, 'utf8');
    const status = (text.match(/^status:\s*(\S+)/m) || [])[1] || 'unknown';
    const next = (text.split(/^# 次にやること\s*$/m)[1] || '').split(/^# /m)[0]
      .split('\n').filter(l => /^- /.test(l)).slice(0, 3).map(l => l.slice(2).trim());
    return { status, next };
  } catch (_) {
    return { status: 'none', next: [] };
  }
}

function fetchLinear(policy) {
  const args = ['linear', 'list-issues', '--team', policy.team, '--json'];
  if (policy.project) args.push('--project', policy.project); // 他アプリの課題を混ぜない
  const run = spawnSync('orca', args,
    { encoding: 'utf8', timeout: policy.linearTimeoutMs, maxBuffer: 16 * 1024 * 1024 });
  if (run.error) return { error: run.error.code === 'ETIMEDOUT' ? 'タイムアウト' : run.error.message };
  let parsed;
  try { parsed = JSON.parse(run.stdout || '{}'); } catch (_) { parsed = {}; }
  if (run.status !== 0 || !parsed.ok) return { error: (parsed.error?.message || run.stderr || `exit ${run.status}`).toString().slice(0, 200) };
  return { issues: parsed.result.issues || [], truncated: Boolean(parsed.result.truncated) };
}

function fetchOpenAlerts(policy) {
  const run = spawnSync('gh', ['issue', 'list', '--state', 'open', '--limit', '20', '--json', 'number,title,createdAt'],
    { encoding: 'utf8', timeout: policy.githubTimeoutMs, cwd: ROOT });
  if (run.error || run.status !== 0) return { error: (run.error?.message || run.stderr || '').toString().trim().slice(0, 160) || '取得失敗' };
  try { return { issues: JSON.parse(run.stdout || '[]') }; } catch (_) { return { error: 'JSON解析失敗' }; }
}

function short(issue) {
  const title = issue.title.length > 48 ? `${issue.title.slice(0, 48)}…` : issue.title;
  return `${issue.identifier} ${title}`;
}

function render({ today, handoff, linear, result, alerts, policy }) {
  const out = [`【自動ブリーフィング ${today}】`];
  out.push(`HANDOFF: ${handoff.status}${handoff.next[0] ? ` — 次: ${handoff.next[0].slice(0, 80)}` : ''}`);
  if (linear.error) {
    out.push(`Linear: 取得できず（${linear.error}）。状況は未確認のまま扱うこと。`);
  } else {
    const max = policy.maxItemsPerSection;
    const r = result;
    out.push(`Linear: 未完了 ${r.activeCount}件 / 進行中 ${r.inProgress.length} / 期限切れ ${r.overdue.length} / 期限間近 ${r.dueSoon.length} / 緊急未着手 ${r.urgentNotStarted.length} / ${policy.staleDays}日以上放置 ${r.stale.length}${linear.truncated ? '（一覧が途中まで）' : ''}`);
    if (r.picks.length) out.push(`今日の候補: ${r.picks.map(p => `${p.identifier}（${p.reason}）`).join('、')}`);
    for (const i of r.overdue.slice(0, max)) out.push(`  ⚠ 期限切れ${i.daysLate}日: ${short(i)}`);
    for (const i of r.urgentNotStarted.slice(0, max)) out.push(`  ⚠ 緊急・未着手: ${short(i)}`);
    for (const i of r.stale.slice(0, max)) out.push(`  … 放置${i.idleDays}日: ${short(i)}`);
    const m = r.missing;
    if (m.project || m.dueDate || m.assignee) out.push(`未設定: Project ${m.project}件 / 期限 ${m.dueDate}件 / 担当 ${m.assignee}件`);
  }
  if (alerts.error) out.push(`GitHub警報Issue: 取得できず（${alerts.error}）`);
  else if (alerts.issues.length) out.push(`GitHub警報Issue（未解決 ${alerts.issues.length}件）: ${alerts.issues.slice(0, 3).map(i => `#${i.number} ${i.title.slice(0, 40)}`).join(' / ')}`);
  return out.join('\n');
}

function main() {
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8'));
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // JST
  const handoff = readHandoff();
  const linear = fetchLinear(policy);
  const result = linear.error ? null : classify(linear.issues, today, policy);
  const alerts = fetchOpenAlerts(policy);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ today, handoff, linearError: linear.error || null, result, alerts }, null, 2));
  } else {
    console.log(render({ today, handoff, linear, result, alerts, policy }));
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.log(`【自動ブリーフィング】作成に失敗: ${error.message}`); }
}

module.exports = { classify, daysBetween, render };
