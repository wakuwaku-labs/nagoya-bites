#!/usr/bin/env node
/** Create only newly discovered nightly QA backlog entries in Linear. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEAM_ID = '076bb18d-f0a7-4272-8604-967f24f77646';
const findingsPath = path.join(ROOT, 'data/qa_findings.json');
const backlogPath = path.join(ROOT, 'agent-backlog.md');
const statePath = path.join(ROOT, 'data/linear_sync_state.json');
const pendingPath = path.join(ROOT, 'data/linear_sync_pending.json');
const priority = { P0: 1, P1: 2, P2: 3, P3: 4 };

function mergePendingIds(pending, created) {
  return [...new Set([...(pending || []), ...(created || [])])];
}

function remainingPendingIds(ids, completedId) {
  return ids.filter(id => id !== completedId);
}

function persistPendingIds(ids) {
  fs.writeFileSync(pendingPath, `${JSON.stringify(ids, null, 2)}\n`);
}

async function gql(query, variables) {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { Authorization: process.env.LINEAR_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    const messages = (result.errors || []).map(e => e.message).join('; ');
    throw new Error(`Linear API request failed (${response.status})${messages ? `: ${messages}` : ''}`);
  }
  return result.data;
}

function taskBlock(markdown, id) {
  const lines = markdown.split('\n');
  const start = lines.findIndex(line => line.startsWith(`### [${id}] `));
  if (start < 0) throw new Error(`New QA finding ${id} is missing from agent-backlog.md`);
  let end = start + 1;
  while (end < lines.length && !/^###\s+\[[A-Z]+-[0-9]+\]/.test(lines[end]) && !/^##\s/.test(lines[end])) end++;
  return lines.slice(start, end).join('\n').trim();
}

async function main() {
  const qa = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
  const pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath, 'utf8')) : [];
  const ids = mergePendingIds(pending, qa.created);
  // Record all work before network calls so transient failures cannot lose new IDs.
  if (ids.length) persistPendingIds(ids);
  if (!process.env.LINEAR_API_KEY) {
    throw new Error('The LINEAR_API_KEY GitHub Actions secret is not configured.');
  }

  // Validate the configured secret even on runs with no findings, without logging it.
  await gql('query VerifyLinearAuth { viewer { id } }', {});
  if (!ids.length) {
    console.log('Linear API authentication succeeded; no new QA findings to create.');
    return;
  }

  const markdown = fs.readFileSync(backlogPath, 'utf8');
  const syncState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  syncState.issues ||= {};
  const query = `query TeamAndIssues($teamId: String!, $after: String) {
    team(id: $teamId) { states { nodes { id name } } issues(first: 100, after: $after) {
      nodes { id identifier title } pageInfo { hasNextPage endCursor }
    } }
  }`;
  let after = null;
  let teamStates;
  const existing = new Map();
  do {
    const data = await gql(query, { teamId: TEAM_ID, after });
    if (!data.team) throw new Error('Configured Linear team was not found.');
    teamStates = data.team.states.nodes;
    for (const issue of data.team.issues.nodes) existing.set(issue.title, issue);
    const page = data.team.issues.pageInfo;
    after = page.hasNextPage ? page.endCursor : null;
  } while (after);

  const todo = teamStates.find(state => state.name === 'Todo');
  if (!todo) throw new Error('Linear team has no Todo state.');
  for (const id of ids) {
    const titleLine = markdown.split('\n').find(line => line.startsWith(`### [${id}] `));
    if (!titleLine) throw new Error(`New QA finding ${id} is missing from agent-backlog.md`);
    const title = titleLine.replace(/^###\s+/, '');
    let issue = existing.get(title); // Retry after create-before-commit: reuse rather than duplicate.
    if (!issue) {
      const block = taskBlock(markdown, id);
      const taskPriority = block.match(/\*\*priority\*\*\s*[:：]\s*(P[0-3])/i)?.[1] || 'P2';
      const created = await gql(`mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { id identifier title url } }
      }`, { input: {
        teamId: TEAM_ID, stateId: todo.id, title, description: block,
        priority: priority[taskPriority] || priority.P2,
      } });
      if (!created.issueCreate?.success || !created.issueCreate.issue) throw new Error(`Linear did not create ${id}.`);
      issue = created.issueCreate.issue;
      existing.set(title, issue);
    }
    syncState.issues[id] = {
      identifier: issue.identifier,
      url: issue.url || `https://linear.app/wakato1251999/issue/${issue.identifier}`,
      source: 'agent-backlog',
    };
    fs.writeFileSync(statePath, `${JSON.stringify(syncState, null, 2)}\n`);
    persistPendingIds(remainingPendingIds(ids, id));
    console.log(`${id} → ${issue.identifier}`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { mergePendingIds, remainingPendingIds };
