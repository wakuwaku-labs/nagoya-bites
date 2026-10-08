#!/usr/bin/env node
/**
 * agent-backlog.md → Linear one-way sync through Orca CLI.
 *
 * Dry-run by default. Pass --apply to write. Linear owns workflow status and
 * priority after synchronization; backlog remains the task specification and
 * selection-policy source. Existing imported descriptions are never replaced.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseBacklog } = require('./next_task');
const { krLabelForCategory, roleLabelsForOwner } = require('./lib/linear_project_map');

const ROOT = path.resolve(__dirname, '..');
const BACKLOG = path.join(ROOT, 'agent-backlog.md');
const STATE = path.join(ROOT, 'data/linear_sync_state.json');
const DEFAULTS = path.join(ROOT, 'data/linear_issue_defaults.json');
const WORKSPACE = '130a2f2b-aa8e-4db1-9250-4fcadebbba1f';
const TEAM = 'P';
const open = new Set(['ready', 'in_progress', 'partial', 'blocked']);
const stateFor = { ready: 'Todo', in_progress: 'In Progress', partial: 'In Progress', blocked: 'Todo', done: 'Done', wont_fix: 'Canceled', superseded: 'Canceled', duplicate: 'Duplicate' };
const priorityFor = { P0: 'urgent', P1: 'high', P2: 'medium', P3: 'low' };
const priorityNumber = { urgent: 1, high: 2, medium: 3, low: 4 };

function isValidDueDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function missingCreateFields(task) {
  return [
    !task.assignee && 'assignee',
    !isValidDueDate(task.dueDate) && 'dueDate',
    !task.project && 'project',
  ].filter(Boolean);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Fill missing create fields from data/linear_issue_defaults.json.
 * Explicit backlog values always win. Every issue belongs to the configured
 * projectName (Nagoya Bites); the KR is a label chosen by krLabelRules.
 */
function withCreateDefaults(task, defaults = {}, today = new Date().toISOString().slice(0, 10)) {
  const days = defaults.dueDateDaysByPriority?.[task.priority || 'P2'];
  return {
    ...task,
    krLabel: krLabelForCategory(task.category, defaults),
    roleLabels: roleLabelsForOwner(task.owner, defaults),
    assignee: task.assignee || defaults.assigneeName || null,
    dueDate: task.dueDate || (Number.isInteger(days) && days >= 0 ? addDays(today, days) : null),
    project: task.project || defaults.projectName || null,
  };
}

function readDefaults() {
  try { return JSON.parse(fs.readFileSync(DEFAULTS, 'utf8')); } catch (_) { return {}; }
}

function readState() {
  return JSON.parse(fs.readFileSync(STATE, 'utf8'));
}

function descriptionFor(md, task) {
  const lines = md.split('\n');
  const start = task.line - 1;
  let end = start + 1;
  while (end < lines.length && !/^###\s+\[[A-Z]+-\d+\]/.test(lines[end]) && !/^##\s/.test(lines[end])) end++;
  return `Linear task migrated from agent-backlog.md (${task.id}).\n\n${lines.slice(start, end).join('\n').trim()}`;
}

function readJson(args) {
  // 全件一覧は142件で約560KB。上限4MBでは約1,000件で溢れるため余裕を取る（ISSUE-145）
  const run = spawnSync('orca', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let result;
  try { result = JSON.parse(run.stdout || '{}'); } catch (_) { result = {}; }
  if (run.status !== 0 || !result.ok) throw new Error(JSON.stringify({ args, result, stderr: run.stderr }));
  return result.result;
}

// ISSUE-145: 一覧は全件を取る。旧実装は --limit 200 で取り、打ち切られたら同期を拒否していたため、
// チームの課題が200件を超えると同期が毎回止まった。Orca CLI は --limit を省くと全件を返す。
// それでも続きがある（hasMore）と返ったときは nextCursor で辿る。続きを辿れない一覧・一部の
// ワークスペースが読めなかった一覧（partial）では同期しない（不完全な一覧で重複作成しないための安全装置）。
function listAllIssues(read = readJson, maxPages = 50) {
  const issues = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page++) {
    const args = ['linear', 'list-issues', '--team', TEAM, '--workspace', WORKSPACE, '--json'];
    if (cursor) args.push('--cursor', cursor);
    const listed = read(args) || {};
    const meta = listed.meta || {};
    if (meta.partial || (meta.workspaceErrors || []).length) {
      throw new Error('Linear issue listing was partial; refusing to sync an incomplete list');
    }
    issues.push(...(listed.issues || []));
    if (!listed.truncated && !meta.hasMore) return issues;
    cursor = meta.nextCursor || null;
    if (!cursor) throw new Error('Linear issue listing was truncated; refusing to sync an incomplete list');
  }
  throw new Error(`Linear issue listing did not finish within ${maxPages} pages; refusing to sync an incomplete list`);
}

function main() {
  const apply = process.argv.includes('--apply');
  const skipAt = process.argv.indexOf('--skip');
  const skipped = new Set(skipAt >= 0 ? (process.argv[skipAt + 1] || '').split(',').filter(Boolean) : []);
  const md = fs.readFileSync(BACKLOG, 'utf8');
  const tasks = parseBacklog(md);
  const state = readState();
  const defaults = readDefaults();
  let liveIssues;
  try {
    liveIssues = new Map(listAllIssues().map(issue => [issue.identifier, issue]));
  } catch (error) {
    console.error(`Could not read Linear issues: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const active = tasks.filter(t => stateFor[t.status]);
  const plan = [];
  for (const task of active) {
    const entry = state.issues[task.id];
    const status = stateFor[task.status];
    const priority = priorityFor[task.priority] || 'low';
    if (entry) {
      const current = liveIssues.get(entry.identifier);
      const title = `[${task.id}] ${task.title}`;
      if (!current || current.state?.name !== status || current.priority !== priorityNumber[priority] || current.title !== title) {
        plan.push({ action: 'update', task, identifier: entry.identifier, status, priority, description: null });
      }
    } else if (open.has(task.status)) {
      plan.push({ action: 'create', task: withCreateDefaults(task, defaults), status, priority, description: descriptionFor(md, task) });
    }
  }
  for (const duplicate of state.duplicateImports || []) {
    try {
      const context = readJson(['linear', 'issue', duplicate.identifier, '--relations', '--workspace', WORKSPACE, '--json']);
      const issue = context.issue;
      const related = (context.relations || []).some(r => r.relationship === 'duplicateOf' && r.relatedIssue?.identifier === duplicate.canonical);
      if (issue.state?.type !== 'duplicate' || issue.title !== duplicate.title || !related) {
        plan.push({ action: 'mark-duplicate', task: { id: duplicate.source_id, title: duplicate.title },
          identifier: duplicate.identifier, status: 'Duplicate', priority: null });
      }
    } catch (error) {
      console.error(`Could not verify duplicate issue ${duplicate.identifier}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }
  const pending = plan.filter(x => !skipped.has(x.identifier));
  const counts = pending.reduce((a, x) => (a[x.action]++, a), { create: 0, update: 0, 'mark-duplicate': 0 });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', workspace: state.workspaceName, total: pending.length, ...counts,
    tasks: pending.map(x => ({ action: x.action, id: x.task.id, title: x.task.title, linear: x.identifier || null, status: x.status, priority: x.priority,
      missingFields: x.action === 'create' ? missingCreateFields(x.task) : [] })) }, null, 2));
  if (!apply) return;

  const invalidCreates = pending.filter(x => x.action === 'create' && missingCreateFields(x.task).length);
  if (invalidCreates.length) {
    console.error(JSON.stringify({ error: 'Refusing to create incomplete Linear issues; add assignee, valid due date, and project to agent-backlog.md or configure data/linear_issue_defaults.json',
      tasks: invalidCreates.map(x => ({ id: x.task.id, missingFields: missingCreateFields(x.task) })) }, null, 2));
    process.exitCode = 1;
    return;
  }

  for (const item of pending) {
    if (item.action === 'mark-duplicate') {
      const read = spawnSync('orca', ['linear', 'issue', item.identifier, '--relations', '--workspace', WORKSPACE, '--json'],
        { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
      let current;
      try { current = JSON.parse(read.stdout || '{}'); } catch (_) { current = {}; }
      if (read.status !== 0 || !current.ok) {
        console.error(JSON.stringify({ error: 'Could not read duplicate issue; stopped', task: item.task.id,
          identifier: item.identifier, result: current, stderr: read.stderr }, null, 2));
        process.exitCode = 1;
        return;
      }
      const duplicateIssue = current.result.issue;
      const canonical = state.issues[item.task.id].identifier;
      const related = (current.result.relations || []).some(r => r.relationship === 'duplicateOf' && r.relatedIssue?.identifier === canonical);
      if (!related) {
        const relation = spawnSync('orca', ['linear', 'relation', 'add', item.identifier,
          '--related', canonical, '--type', 'duplicate-of', '--workspace', WORKSPACE, '--json'],
          { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
        let relationResult;
        try { relationResult = JSON.parse(relation.stdout || '{}'); } catch (_) { relationResult = {}; }
        if (relation.status !== 0 || !relationResult.ok) {
          console.error(JSON.stringify({ error: 'Could not add duplicate relation; stopped', task: item.task.id,
            identifier: item.identifier, relation: relationResult, stderr: relation.stderr }, null, 2));
          process.exitCode = 1;
          return;
        }
      }
      if (duplicateIssue.state.type === 'duplicate' && duplicateIssue.title === item.task.title) {
        console.log(`mark-duplicate: ${item.task.id} → ${item.identifier} (already synced)`);
        continue;
      }
    }
    const args = ['linear', 'save-issue'];
    if (item.identifier) args.push(item.identifier);
    if (!item.identifier) args.push('--team', TEAM);
    const targetTitle = item.action === 'mark-duplicate' ? item.task.title : `[${item.task.id}] ${item.task.title}`;
    args.push('--title', targetTitle, '--state', item.status,
      '--workspace', WORKSPACE, '--json');
    if (item.priority) args.push('--priority', item.priority);
    if (item.description) args.push('--description', item.description);
    if (item.action === 'create') {
      args.push('--assignee', item.task.assignee, '--due-date', item.task.dueDate, '--project', item.task.project);
      for (const label of [item.task.krLabel, ...(item.task.roleLabels || [])].filter(Boolean)) args.push('--label', label);
    }
    const run = spawnSync('orca', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    let result;
    try { result = JSON.parse(run.stdout || '{}'); } catch (_) { result = {}; }
    if (run.status !== 0 || !result.ok) {
      console.error(JSON.stringify({ error: 'Linear write failed; stopped without continuing', task: item.task.id,
        exitCode: run.status, stdout: run.stdout, stderr: run.stderr }, null, 2));
      process.exitCode = 1;
      return;
    }
    const issue = result.result.issue || result.result;
    if (item.action === 'create') {
      state.issues[item.task.id] = { identifier: issue.identifier, url: issue.url, source: 'agent-backlog' };
      fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
    }
    console.log(`${item.action}: ${item.task.id} → ${issue.identifier}`);
  }
}

if (require.main === module) main();

module.exports = { isValidDueDate, missingCreateFields, withCreateDefaults, listAllIssues };
