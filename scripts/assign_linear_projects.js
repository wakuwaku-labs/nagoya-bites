#!/usr/bin/env node
/**
 * Project 未設定の未完了 Linear Issue に、category の規則（data/linear_issue_defaults.json の projectRules）で
 * Project を付ける。既に Project がある Issue は触らない（人が付けた値を上書きしない）。
 *
 *   node scripts/assign_linear_projects.js           # dry-run（書き込みなし）
 *   node scripts/assign_linear_projects.js --apply   # Linear へ反映
 *
 * category の出どころ: タイトル先頭の [ID] → agent-backlog.md の category。backlog に無い移行課題は
 * 説明文の「Notionカテゴリ」。どちらも無ければ受け皿（projectName）。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseBacklog } = require('./next_task');
const { projectForCategory } = require('./lib/linear_project_map');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE = '130a2f2b-aa8e-4db1-9250-4fcadebbba1f';
const ACTIVE = new Set(['backlog', 'unstarted', 'started']);

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

function plan(issues, tasks, defaults) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  return issues
    // タイトルが [ID] で始まるもの＝このプロジェクトの課題だけ。Linear 既定のチュートリアル課題等は触らない。
    .filter(i => ACTIVE.has(i.state?.type) && !i.project && /^\[[A-Z]+(?:-[A-Z]+)*-\d+\]/.test(i.title))
    .map(i => {
      const category = categoryFor(i, byId);
      return { identifier: i.identifier, title: i.title, category, project: projectForCategory(category, defaults) };
    });
}

function main() {
  const apply = process.argv.includes('--apply');
  const defaults = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/linear_issue_defaults.json'), 'utf8'));
  const tasks = parseBacklog(fs.readFileSync(path.join(ROOT, 'agent-backlog.md'), 'utf8'));
  const listed = orca(['linear', 'list-issues', '--team', 'P', '--workspace', WORKSPACE, '--json']);
  if (listed.truncated) throw new Error('Linear issue listing was truncated; refusing to assign on a partial list');
  const items = plan(listed.issues || [], tasks, defaults);
  const summary = items.reduce((a, x) => (a[x.project || '(なし)'] = (a[x.project || '(なし)'] || 0) + 1, a), {});
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: items.length, summary, items }, null, 2));
  if (!apply) return;
  const failed = [];
  for (const item of items) {
    if (!item.project) continue;
    const args = ['linear', 'save-issue', item.identifier, '--project', item.project, '--workspace', WORKSPACE, '--json'];
    try {
      try { orca(args); } catch (_) { orca(args); } // 一時的な失敗は1回だけ再試行（同じ値の上書きなので冪等）
      console.log(`project: ${item.identifier} → ${item.project}`);
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

module.exports = { plan, categoryFor };
