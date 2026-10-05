#!/usr/bin/env node
/**
 * 未完了の Linear Issue を「Project = Nagoya Bites、KR = ラベル」の構成にそろえる（docs/decisions/0003）。
 *  - Project が未設定、または一時的に作った KR 別 Project（retiredProjects）にある Issue → Nagoya Bites へ
 *  - KR ラベル（"KR:" で始まる）が1つも無い Issue → category の規則（krLabelRules）で KR ラベルを追加
 *  - 役割ラベル（"担当:" で始まる）が1つも無い Issue → backlog の owner から役割ラベルを追加（docs/decisions/0005）
 *  - 担当者が未設定の Issue → 既定の担当（assigneeId＝オーナー）を設定（期限は一斉に付けない: 起点が無く全件同時に期限が来るため）
 * 人が付けた別の Project・既存の KR ラベルは上書きしない。ラベルは追加のみ（既存ラベルを消さない）。
 *
 *   node scripts/assign_linear_projects.js           # dry-run（書き込みなし）
 *   node scripts/assign_linear_projects.js --apply   # Linear へ反映（何度実行しても同じ結果＝冪等）
 *
 * category の出どころ: タイトル先頭の [ID] → agent-backlog.md の category。backlog に無い移行課題は
 * 説明文の「Notionカテゴリ」。どちらも無ければ KR ラベルは付けない。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseBacklog } = require('./next_task');
const { krLabelForCategory, isKrLabel, roleLabelsForOwner, isRoleLabel } = require('./lib/linear_project_map');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE = '130a2f2b-aa8e-4db1-9250-4fcadebbba1f';
const ACTIVE = new Set(['backlog', 'unstarted', 'started']);
const OWN_ISSUE = /^\[[A-Z]+(?:-[A-Z]+)*-\d+\]/;

function orca(args) {
  const run = spawnSync('orca', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  let parsed;
  try { parsed = JSON.parse(run.stdout || '{}'); } catch (_) { parsed = {}; }
  if (run.status !== 0 || !parsed.ok) throw new Error(`${args.slice(0, 3).join(' ')} failed: ${(run.stderr || run.stdout || '').slice(0, 300)}`);
  return parsed.result;
}

function categoryFor(issue, byId) {
  const id = (issue.title.match(/^\[([A-Z]+(?:-[A-Z]+)*-\d+)\]/) || [])[1];
  if (id && byId.get(id)?.category) return byId.get(id).category;
  const notion = (issue.description || '').match(/\*\*Notionカテゴリ:\*\*\s*([^\n]+)/);
  if (notion && notion[1].trim() !== '未設定') return notion[1].trim();
  return null;
}

function ownerFor(issue, byId) {
  const id = (issue.title.match(/^\[([A-Z]+(?:-[A-Z]+)*-\d+)\]/) || [])[1];
  if (id && byId.get(id)?.owner) return byId.get(id).owner;
  const notion = (issue.description || '').match(/\*\*Notion担当部署:\*\*\s*([^\n]+)/);
  if (notion && notion[1].trim() !== '未設定') return notion[1].trim();
  return null;
}

function plan(issues, tasks, defaults) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const retired = new Set(defaults.retiredProjects || []);
  const items = [];
  // タイトルが [ID] で始まるもの＝このプロジェクトの課題だけ。Linear 既定のチュートリアル課題等は触らない。
  for (const issue of issues.filter(i => ACTIVE.has(i.state?.type) && OWN_ISSUE.test(i.title))) {
    const current = issue.project?.name || null;
    const moveProject = (!current || retired.has(current)) && current !== defaults.projectName;
    const hasKr = (issue.labels || []).some(l => isKrLabel(l.name || l));
    const category = categoryFor(issue, byId);
    const krLabel = hasKr ? null : krLabelForCategory(category, defaults);
    const hasRole = (issue.labels || []).some(l => isRoleLabel(l.name || l, defaults));
    const roleLabels = hasRole ? [] : roleLabelsForOwner(ownerFor(issue, byId), defaults);
    const assignee = !issue.assignee && defaults.assigneeId ? defaults.assigneeId : null;
    if (!moveProject && !krLabel && !roleLabels.length && !assignee) continue;
    items.push({ identifier: issue.identifier, title: issue.title, category,
      project: moveProject ? defaults.projectName : null, from: current, krLabel, roleLabels, assignee });
  }
  return items;
}

function main() {
  const apply = process.argv.includes('--apply');
  const defaults = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/linear_issue_defaults.json'), 'utf8'));
  const tasks = parseBacklog(fs.readFileSync(path.join(ROOT, 'agent-backlog.md'), 'utf8'));
  const listed = orca(['linear', 'list-issues', '--team', 'P', '--workspace', WORKSPACE, '--json']);
  if (listed.truncated) throw new Error('Linear issue listing was truncated; refusing to assign on a partial list');
  const items = plan(listed.issues || [], tasks, defaults);
  const labels = items.reduce((a, x) => {
    for (const l of [x.krLabel, ...x.roleLabels].filter(Boolean)) a[l] = (a[l] || 0) + 1;
    return a;
  }, {});
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: items.length,
    moveToProject: items.filter(x => x.project).length, labels, items }, null, 2));
  if (!apply) return;
  const failed = [];
  const once = args => { try { orca(args); } catch (_) { orca(args); } }; // 一時的な失敗は1回だけ再試行（冪等な操作のみ）
  for (const item of items) {
    try {
      if (item.project) once(['linear', 'save-issue', item.identifier, '--project', item.project, '--workspace', WORKSPACE, '--json']);
      if (item.assignee) once(['linear', 'assignee', 'set', item.identifier, '--to-id', item.assignee, '--workspace', WORKSPACE, '--json']);
      const add = [item.krLabel, ...item.roleLabels].filter(Boolean);
      if (add.length) once(['linear', 'label', 'add', item.identifier, ...add.flatMap(l => ['--label', l]), '--workspace', WORKSPACE, '--json']);
      console.log(`updated: ${item.identifier}${item.project ? ` → ${item.project}` : ''}${add.length ? ` + ${add.join(', ')}` : ''}${item.assignee ? ' +担当' : ''}`);
    } catch (error) {
      failed.push(item.identifier);
      console.error(`failed: ${item.identifier} ${error.message.slice(0, 200)}`);
    }
  }
  if (failed.length) {
    console.error(`未反映 ${failed.length}件: ${failed.join(', ')}（再実行すれば残りだけ処理される）`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { plan, categoryFor, ownerFor };
