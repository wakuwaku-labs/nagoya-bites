#!/usr/bin/env node
/**
 * agent-backlog.md → Notion 同期プランナー
 *
 * 設計:
 *   - このスクリプト自体は Notion API を直接叩かない（純粋なパーサー＋差分計算）
 *   - JSON 形式で「やるべきこと」(creates/updates/archives) を stdout に出力する
 *   - 実際の Notion API 呼び出しは /sync-backlog スラッシュコマンドが MCP 経由で行う
 *
 * モード:
 *   --print-diff  : 差分プランを JSON で stdout 出力（既定）
 *   --if-changed  : agent-backlog.md が前回syncから変わっていれば --print-diff、変わってなければ {"changed":false}
 *   --mark-synced : 同期完了時にハッシュを保存（slash command 側から呼ぶ）
 *   --full        : 強制的に全件出力（state を無視）
 *
 * State file: data/.notion_sync_state.json
 *   {
 *     "notion_db_id": "59089557-3115-42a1-a6d4-39c8de0284ca",
 *     "notion_data_source_id": "6d73b2cb-579b-4772-8ef5-453ccc16833a",
 *     "notion_parent_page_id": "35826260-227a-81e5-95aa-f5d9fc4caa6c",
 *     "last_backlog_hash": "...",
 *     "last_synced_at": "2026-05-06T...",
 *     "page_id_map": { "ISSUE-001": "<notion-page-uuid>", ... }
 *   }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BACKLOG_PATH = path.join(ROOT, 'agent-backlog.md');
const STATE_PATH = path.join(ROOT, 'data/.notion_sync_state.json');

// ──────────────────────────────────────────────────────────
// パース: agent-backlog.md → タスクオブジェクト配列
// ──────────────────────────────────────────────────────────

/**
 * `### [ID] タイトル ✅` 形式の見出しブロックを抽出。
 * 各ブロックは次の `### ` または `## ` または `---` または EOF まで。
 */
function parseBacklog(md) {
  const lines = md.split('\n');
  const tasks = [];
  let current = null;
  let bodyLines = [];

  function flush() {
    if (!current) return;
    current.body = bodyLines.join('\n').trim();
    parseFields(current);
    tasks.push(current);
    current = null;
    bodyLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+\[([A-Z]+-[A-Z0-9-]+)\]\s*(.+?)\s*$/);
    if (headingMatch) {
      flush();
      const id = headingMatch[1];
      let title = headingMatch[2].replace(/[✅🔴🟡🟢🔄❌]/g, '').trim();
      current = { id, title, body: '', priority: null, status: null, owner: null, category: null, detected: null, resolved: null, files: null };
      continue;
    }
    if (current && (line.startsWith('## ') || line.startsWith('---'))) {
      flush();
      continue;
    }
    if (current) bodyLines.push(line);
  }
  flush();
  return tasks;
}

function parseFields(task) {
  const body = task.body;
  // priority
  const pri = body.match(/\*\*priority\*\*\s*[:：]\s*(P[0-3])/);
  if (pri) task.priority = pri[1];

  // status: "in_progress" or "done" etc. May appear as "**status**: done" or "→ **status**: done"
  const st = body.match(/\*\*status\*\*\s*[:：]\s*([a-z_]+)/);
  if (st) task.status = st[1];

  // owner
  const ow = body.match(/\*\*owner\*\*\s*[:：]\s*([A-Za-z][A-Za-z\s+]*?)\s*(?:\n|$|\()/);
  if (ow) task.owner = ow[1].trim().split(/\s*\+\s*/)[0]; // 共同作業の場合は最初を主担当に

  // category
  const cat = body.match(/\*\*category\*\*\s*[:：]\s*([^\n]+)/);
  if (cat) task.category = cat[1].trim().split(/\s*[\/／]\s*/)[0]; // 複数あれば最初を主カテゴリ

  // detected
  const det = body.match(/\*\*detected\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
  if (det) task.detected = det[1];

  // resolved
  const res = body.match(/\*\*resolved\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
  if (res) task.resolved = res[1];

  // files
  const fl = body.match(/\*\*files\*\*\s*[:：]\s*([^\n]+)/);
  if (fl) task.files = fl[1].trim();
}

// ──────────────────────────────────────────────────────────
// マッピング: タスク → Notion プロパティ
// ──────────────────────────────────────────────────────────

const OWNER_NORMALIZE = {
  'Orchestrator': 'Orchestrator',
  'Builder': 'Builder',
  'DataKeeper': 'DataKeeper',
  'Inspector': 'Inspector',
  'Editor': 'Editor',
  'Marketer': 'Marketer',
  'Strategist': 'Strategist',
  'Editor (人間運営側)': 'Editor',
};

const CATEGORY_NORMALIZE = {
  '組織': '組織',
  '編集': '編集',
  '技術': '技術',
  'SEO': 'SEO',
  'a11y': 'a11y',
  'データ': 'データ',
  'マネタイズ': 'マネタイズ',
  'パフォーマンス': 'パフォーマンス',
  'コンテンツ': 'コンテンツ',
  'UX': 'UX',
  'editorial': '編集',
  'content': 'コンテンツ',
  'visual': 'UX',
  'performance': 'パフォーマンス',
  'seo': 'SEO',
  'data': 'データ',
  '標準準拠': 'SEO',
  'SEO・OGP': 'SEO',
  'マーケティング': 'マネタイズ',
  '戦略': '組織',
};

// ID 接頭辞 → デフォルト owner
const ID_PREFIX_TO_OWNER = {
  'ISSUE': 'Builder',
  'EDT': 'Editor',
  'CTN': 'Editor',
  'CTN-DAILY': 'Editor',
  'BATCH': 'Builder',
  'ORG': 'Orchestrator',
  'MKT': 'Marketer',
  'STR': 'Strategist',
};

function inferOwner(task) {
  if (task.owner && OWNER_NORMALIZE[task.owner]) return OWNER_NORMALIZE[task.owner];
  if (task.owner) {
    // partial match
    for (const k of Object.keys(OWNER_NORMALIZE)) {
      if (task.owner.includes(k)) return OWNER_NORMALIZE[k];
    }
  }
  // ID prefix fallback
  const prefix = task.id.split('-')[0];
  return ID_PREFIX_TO_OWNER[prefix] || 'Builder';
}

function inferCategory(task) {
  if (task.category && CATEGORY_NORMALIZE[task.category]) return CATEGORY_NORMALIZE[task.category];
  if (task.category) {
    for (const k of Object.keys(CATEGORY_NORMALIZE)) {
      if (task.category.includes(k)) return CATEGORY_NORMALIZE[k];
    }
  }
  return null;
}

function buildNotionProperties(task) {
  const props = {
    'タイトル': task.title,
    '課題ID': task.id,
  };
  if (task.status && ['ready','in_progress','blocked','partial','wont_fix'].includes(task.status)) {
    props['ステータス'] = task.status;
  }
  if (task.priority) props['優先度'] = task.priority;
  const owner = inferOwner(task);
  if (owner) props['担当部署'] = owner;
  const category = inferCategory(task);
  if (category) props['カテゴリ'] = category;
  if (task.detected) props['date:検出日:start'] = task.detected;
  if (task.resolved) props['date:解決日:start'] = task.resolved;
  return props;
}

function buildNotionContent(task) {
  // ページ本文：description 部分を抽出して入れる
  const lines = task.body.split('\n');
  const content = [];
  content.push(`## ${task.id}: ${task.title}`);
  content.push('');
  for (const line of lines) {
    // メタ行（**priority**, **status** 等）はスキップ
    if (/^\s*-\s+\*\*(priority|status|detected|resolved|owner|category)\*\*/.test(line)) continue;
    content.push(line);
  }
  return content.join('\n').trim();
}

// ──────────────────────────────────────────────────────────
// State 管理
// ──────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {
    notion_db_id: null,
    notion_data_source_id: null,
    notion_parent_page_id: null,
    last_backlog_hash: null,
    last_synced_at: null,
    page_id_map: {},
  };
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function fileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ──────────────────────────────────────────────────────────
// 差分計算
// ──────────────────────────────────────────────────────────

function planSync(tasks, state, opts = {}) {
  const creates = [];
  const updates = [];
  const archives = [];

  const seenIds = new Set();
  for (const task of tasks) {
    seenIds.add(task.id);
    const existingPageId = state.page_id_map[task.id];

    if (task.status === 'done' || task.status === 'wont_fix' && opts.archiveWontFix) {
      // done → アーカイブ
      if (existingPageId) {
        archives.push({ id: task.id, page_id: existingPageId, reason: task.status });
      }
      // 新規 done は何もしない
      continue;
    }

    const properties = buildNotionProperties(task);
    const content = buildNotionContent(task);

    if (existingPageId) {
      updates.push({ id: task.id, page_id: existingPageId, properties, content });
    } else {
      creates.push({ id: task.id, properties, content });
    }
  }

  // state にあるが backlog から消えた ID もアーカイブ
  for (const id of Object.keys(state.page_id_map)) {
    if (!seenIds.has(id)) {
      archives.push({ id, page_id: state.page_id_map[id], reason: 'removed_from_backlog' });
    }
  }

  return { creates, updates, archives };
}

// ──────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mark-synced') ? 'mark-synced'
             : args.includes('--if-changed') ? 'if-changed'
             : args.includes('--full') ? 'full'
             : 'print-diff';

  const backlog = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const hash = fileHash(backlog);
  const state = loadState();

  if (mode === 'mark-synced') {
    // /sync-backlog 実行後に呼ばれる。コマンドライン引数で page_id_map の追加更新を受け取る
    // 形式: --mark-synced --add ID1=pageId1 ID2=pageId2 ...
    state.last_backlog_hash = hash;
    state.last_synced_at = new Date().toISOString();
    const addIdx = args.indexOf('--add');
    if (addIdx >= 0) {
      for (let i = addIdx + 1; i < args.length; i++) {
        const m = args[i].match(/^([A-Z]+-[A-Z0-9-]+)=(.+)$/);
        if (m) state.page_id_map[m[1]] = m[2];
      }
    }
    const removeIdx = args.indexOf('--remove');
    if (removeIdx >= 0) {
      for (let i = removeIdx + 1; i < args.length; i++) {
        if (args[i].startsWith('--')) break;
        delete state.page_id_map[args[i]];
      }
    }
    saveState(state);
    console.log(JSON.stringify({ ok: true, last_synced_at: state.last_synced_at }));
    return;
  }

  if (mode === 'if-changed' && state.last_backlog_hash === hash) {
    console.log(JSON.stringify({ changed: false, hash }));
    return;
  }

  const tasks = parseBacklog(backlog);
  const plan = planSync(tasks, state, { archiveWontFix: false });

  console.log(JSON.stringify({
    changed: true,
    hash,
    notion_db_id: state.notion_db_id,
    notion_data_source_id: state.notion_data_source_id,
    notion_parent_page_id: state.notion_parent_page_id,
    total_tasks: tasks.length,
    plan,
  }, null, 2));
}

if (require.main === module) main();

module.exports = { parseBacklog, planSync, buildNotionProperties, buildNotionContent, fileHash };
