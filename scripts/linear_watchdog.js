#!/usr/bin/env node
/**
 * Linear の放置・期限切れのサーバ側監視（ISSUE-135）。
 *
 * セッション開始時の確認（scripts/session_briefing.js）は、セッションを開かない日は誰にも届かない
 * （CLAUDE.md 制約11）。こちらは GitHub Actions（.github/workflows/linear-watchdog.yml）から
 * LINEAR_API_KEY で Linear を読み、session_briefing.js の classify() と同じ判定で
 * 「期限切れ・緊急未着手・放置」を検出する。結果は JSON で出し、Issue の起票/クローズは
 * ワークフロー側が行う。
 *
 * 判定は Linear の状態・優先度・期日・更新日時という検証できる事実だけで行う（制約10）。
 * 閾値の正本は data/session_briefing_policy.json（セッション開始時の確認と共有）。
 *
 *   node scripts/linear_watchdog.js --json   # 判定結果（ok / problems / retro）
 *   node scripts/linear_watchdog.js          # 人向けの要約
 *
 * Linear に届かない（キー未設定・認証切れ・API障害）ことも異常として返す。
 * 「読めなかった」を「問題なし」と同じ顔にしない（ISSUE-084 原則4）。
 */
const fs = require('fs');
const path = require('path');
const { classify, daysBetween } = require('./session_briefing');

const ROOT = path.resolve(__dirname, '..');
const POLICY = path.join(ROOT, 'data/session_briefing_policy.json');

const QUERY = `query($team: String!, $after: String) {
  issues(first: 100, after: $after, filter: { team: { key: { eq: $team } } }) {
    nodes {
      identifier title url priority dueDate createdAt updatedAt completedAt canceledAt
      state { type name } project { name } assignee { name }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchIssues(team, apiKey, fetchImpl = fetch) {
  const issues = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const response = await fetchImpl('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { team, after } }),
    });
    let result;
    try { result = await response.json(); } catch (_) { result = {}; }
    if (!response.ok || result.errors?.length) {
      const messages = (result.errors || []).map(e => e.message).join('; ');
      throw new Error(`Linear API ${response.status}${messages ? `: ${messages}` : ''}`);
    }
    const conn = result.data.issues;
    issues.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) return issues;
    after = conn.pageInfo.endCursor;
  }
  throw new Error('Linear の Issue が 2,000 件を超えたため途中で打ち切りました');
}

/** 直近 days 日の振り返り（完了・中止・新規・滞留）。純関数。 */
function retro(issues, today, days = 7) {
  const within = iso => iso && daysBetween(iso, today) <= days && daysBetween(iso, today) >= 0;
  return {
    days,
    completed: issues.filter(i => within(i.completedAt)).map(i => ({ identifier: i.identifier, title: i.title })),
    canceled: issues.filter(i => within(i.canceledAt)).length,
    created: issues.filter(i => within(i.createdAt)).length,
  };
}

/** 判定本体（純関数・テスト対象）。 */
function buildReport(issues, today, policy) {
  const r = classify(issues, today, policy);
  const problems = [];
  const pick = list => list.map(i => ({ identifier: i.identifier, title: i.title, url: i.url,
    daysLate: i.daysLate, idleDays: i.idleDays }));
  if (r.overdue.length) problems.push({ kind: 'overdue', label: '期限切れ', items: pick(r.overdue) });
  if (r.urgentNotStarted.length) problems.push({ kind: 'urgent_not_started', label: '緊急・未着手', items: pick(r.urgentNotStarted) });
  if (r.stale.length) problems.push({ kind: 'stale', label: `${policy.staleDays}日以上放置`, items: pick(r.stale) });
  return {
    ok: problems.length === 0,
    today,
    activeCount: r.activeCount,
    inProgress: r.inProgress.length,
    dueSoon: pick(r.dueSoon),
    problems,
    missing: r.missing,
    retro: retro(issues, today),
  };
}

function render(report) {
  if (report.error) return `Linear を読めませんでした: ${report.error}`;
  const lines = [`Linear 監視 ${report.today}: 未完了 ${report.activeCount}件 / 進行中 ${report.inProgress}`];
  if (report.ok) lines.push('期限切れ・緊急未着手・放置はありません。');
  for (const p of report.problems) {
    lines.push(`${p.label} ${p.items.length}件:`);
    for (const i of p.items) lines.push(`  - ${i.identifier} ${i.title}`);
  }
  const rt = report.retro;
  lines.push(`直近${rt.days}日: 完了 ${rt.completed.length} / 中止 ${rt.canceled} / 新規 ${rt.created}`);
  return lines.join('\n');
}

async function main() {
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8'));
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // JST
  let report;
  if (!process.env.LINEAR_API_KEY) {
    report = { ok: false, today, error: 'LINEAR_API_KEY が設定されていません（GitHub Actions の secret を確認）' };
  } else {
    try {
      report = buildReport(await fetchIssues(policy.team, process.env.LINEAR_API_KEY), today, policy);
    } catch (error) {
      report = { ok: false, today, error: error.message.slice(0, 300) };
    }
  }
  if (report.error) report.problems = [{ kind: 'linear_unreachable', label: 'Linear を読めない', items: [] }];
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : render(report));
}

if (require.main === module) main();

module.exports = { buildReport, retro, fetchIssues, render };
