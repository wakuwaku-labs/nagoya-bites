#!/usr/bin/env node
/**
 * /solve-next の「次に解く課題」を決定的に選ぶ判定器
 *
 * 設計（seo_triage.js / sync_backlog_to_notion.js と同じ思想）:
 *   - このスクリプトは「実装」をしない。順番だけを決める。
 *   - 順番の根拠は agent-backlog.md に実在する事実（priority / status / detected）だけ。
 *     エージェントが自由に書ける自己申告のスコアは使わない（CLAUDE.md 制約10）。
 *   - 運用ルール（消化レート・滞留の繰り上げ・除外）は data/solve_next_policy.json が唯一の情報源。
 *     .claude/commands/*.md は自己改変ブロックで編集できないため、挙動の変更はポリシー側で行う。
 *
 * なぜ必要か（2026-08-16 の実測）:
 *   同点 P2 が並ぶと検出日の古い課題が永久に順番待ちになり、SEO-008 は 54日間 ready のままだった。
 *   さらに superseded を open と数える誤りで、滞留が実際の 8件に対し 12件に見えていた。
 *
 * サブコマンド:
 *   （引数なし）        次に解くべき課題を dailyQuota 件ぶん表示（人が読める表）
 *   --json             同じ結果を JSON で出す
 *   --top N            上位 N 件まで表示（quota を無視して列全体を見る）
 *   --all              closed も含めた全件の内訳を出す
 *   --check            列の健全性のみ検査。警告があれば exit 1（CI 向け）
 *   --date YYYY-MM-DD  「今日」を固定して滞留日数を計算（テスト用）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKLOG_PATH = path.join(ROOT, 'agent-backlog.md');
const POLICY_PATH = path.join(ROOT, 'data/solve_next_policy.json');

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

function loadPolicy() {
  return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
}

// ──────────────────────────────────────────────────────────
// agent-backlog.md のパース
// ──────────────────────────────────────────────────────────

/**
 * 見出し "### [ID] タイトル" ごとにブロックを切り、priority / status / detected / owner /
 * category を拾う。status は「ready（要否そのものを再判断）」のような注記付きで書かれることが
 * あるため、先頭の識別子だけを取る。detected も「2026-07-27（…経緯…）」の形があるため
 * 先頭の日付だけを取る（ここを \S+ で取ると括弧ごと掴んで日付解釈に失敗する）。
 */
function parseBacklog(md) {
  const lines = md.split('\n');
  const tasks = [];
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^###\s+\[([A-Z]+-[0-9]+)\]\s*(.*)$/);
    if (h) {
      cur = {
        id: h[1],
        prefix: h[1].split('-')[0],
        title: h[2].replace(/\s*✅\s*$/, '').trim(),
        line: i + 1,
        priority: null,
        status: null,
        statusNote: '',
        detected: null,
        owner: null,
        category: null,
      };
      tasks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^##\s/.test(lines[i])) { cur = null; continue; }

    const pr = lines[i].match(/\*\*priority\*\*\s*[:：]\s*(P[0-3])/);
    if (pr && !cur.priority) cur.priority = pr[1];

    const st = lines[i].match(/\*\*status\*\*\s*[:：]\s*([a-z_]+)(.*)$/);
    if (st && !cur.status) {
      cur.status = st[1];
      cur.statusNote = (st[2] || '').trim();
    }

    const dt = lines[i].match(/\*\*detected\*\*\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
    if (dt && !cur.detected) cur.detected = dt[1];

    const ow = lines[i].match(/\*\*owner\*\*\s*[:：]\s*([^\n（(]+)/);
    if (ow && !cur.owner) cur.owner = ow[1].trim();

    const ca = lines[i].match(/\*\*category\*\*\s*[:：]\s*([^\n]+)/);
    if (ca && !cur.category) cur.category = ca[1].trim();
  }

  return tasks;
}

function ageDays(detected, today) {
  if (!detected) return null;
  const d = new Date(detected + 'T00:00:00Z');
  const t = new Date(today + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((t - d) / 86400000);
}

/**
 * 滞留日数による実効優先度の繰り上げ。1段だけ・P1 が上限。
 * P0 へは決して昇格させない（P0 は事故の意味であり、時計が作ってよい状態ではない）。
 */
function effectivePriority(task, age, policy) {
  const base = task.priority || 'P3';
  if (!policy.aging || !policy.aging.enabled) return { effective: base, escalated: false };
  if (age === null) return { effective: base, escalated: false };

  const threshold = (policy.aging.escalateAfterDays || {})[base];
  if (!threshold || age < threshold) return { effective: base, escalated: false };

  const idx = PRIORITIES.indexOf(base);
  const cap = PRIORITIES.indexOf(policy.aging.maxEscalatedPriority || 'P1');
  const next = Math.max(idx - 1, cap);
  const effective = PRIORITIES[next];
  return { effective, escalated: effective !== base };
}

/**
 * オーナー本人にしか進められない課題を見分ける。
 * 判定材料は agent-backlog.md に実在する owner 名と status の注記だけ（自己申告のスコアは使わない）。
 * これを自動ルーチンの選定対象に混ぜると、毎朝それを選んでは何もできずに終わる。
 */
function awaitingHuman(task, policy) {
  const cfg = policy.awaitingHuman || {};
  const owners = cfg.owners || [];
  const patterns = cfg.notePatterns || [];

  const owner = task.owner || '';
  const hitOwner = owners.find((o) => owner.includes(o));
  if (hitOwner) return { hit: true, reason: `owner が ${hitOwner}（オーナー本人の作業）` };

  const note = task.statusNote || '';
  const hitNote = patterns.find((p) => note.includes(p));
  if (hitNote) return { hit: true, reason: `status 注記「${note.replace(/^[（(]|[）)]$/g, '')}」` };

  return { hit: false, reason: null };
}

function build(today) {
  const policy = loadPolicy();
  const md = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const tasks = parseBacklog(md);

  const openSet = new Set(policy.statuses.open);
  const closedSet = new Set(policy.statuses.closed);
  const skipSet = new Set(policy.statuses.skip);

  const warnings = [];
  const byStatus = {};
  const open = [];

  for (const t of tasks) {
    const st = t.status || 'unknown';
    byStatus[st] = (byStatus[st] || 0) + 1;

    if (!t.status) {
      warnings.push(`${t.id}: status を読み取れない（agent-backlog.md:${t.line}）`);
      continue;
    }
    if (closedSet.has(st) || skipSet.has(st)) continue;
    if (!openSet.has(st)) {
      warnings.push(`${t.id}: 未知の status "${st}" — ポリシーの open/closed/skip のどれにも属さない（agent-backlog.md:${t.line}）`);
      continue;
    }

    const age = ageDays(t.detected, today);
    if (age === null && policy.requireDetectedDate) {
      warnings.push(`${t.id}: detected の日付が無く滞留日数を測れない（agent-backlog.md:${t.line}）`);
    }
    const { effective, escalated } = effectivePriority(t, age, policy);
    const waiting = awaitingHuman(t, policy);
    open.push({ ...t, age, effectivePriority: effective, escalated, awaitingHuman: waiting.hit, awaitingReason: waiting.reason });
  }

  open.sort((a, b) => {
    const p = PRIORITIES.indexOf(a.effectivePriority) - PRIORITIES.indexOf(b.effectivePriority);
    if (p !== 0) return p;
    const s = (policy.statusRank[a.status] ?? 9) - (policy.statusRank[b.status] ?? 9);
    if (s !== 0) return s;
    const ageA = a.age === null ? -1 : a.age;
    const ageB = b.age === null ? -1 : b.age;
    if (ageA !== ageB) return ageB - ageA; // 古い順
    return a.id.localeCompare(b.id);
  });

  const actionable = open.filter((t) => !t.awaitingHuman);
  const waiting = open.filter((t) => t.awaitingHuman);

  return { policy, tasks, open, actionable, waiting, warnings, byStatus, today };
}

// ──────────────────────────────────────────────────────────
// 出力
// ──────────────────────────────────────────────────────────

function renderTable(rows) {
  const head = ['#', 'ID', '実効', '元', 'status', '滞留', 'owner', 'タイトル'];
  const body = rows.map((t, i) => [
    String(i + 1),
    t.id,
    t.effectivePriority + (t.escalated ? '↑' : ''),
    t.priority || '-',
    t.status,
    t.age === null ? '不明' : t.age + '日',
    t.owner || '-',
    t.title.length > 46 ? t.title.slice(0, 46) + '…' : t.title,
  ]);
  const all = [head, ...body];
  const w = head.map((_, c) => Math.max(...all.map((r) => [...r[c]].length)));
  const line = (r) => r.map((v, c) => v + ' '.repeat(Math.max(0, w[c] - [...v].length))).join('  ');
  return [line(head), w.map((n) => '-'.repeat(n)).join('  '), ...body.map(line)].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf('--date');
  const today = dateIdx >= 0 && args[dateIdx + 1]
    ? args[dateIdx + 1]
    : new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); // JST

  let r;
  try {
    r = build(today);
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
    process.exit(1);
  }

  const quota = r.policy.dailyQuota || 1;
  const topIdx = args.indexOf('--top');
  const limit = args.includes('--all')
    ? r.actionable.length
    : topIdx >= 0 && args[topIdx + 1]
      ? Number(args[topIdx + 1])
      : quota;

  if (args.includes('--check')) {
    console.log(JSON.stringify({
      ok: r.warnings.length === 0,
      open_count: r.open.length,
      actionable_count: r.actionable.length,
      awaiting_human_count: r.waiting.length,
      by_status: r.byStatus,
      warnings: r.warnings,
    }, null, 2));
    process.exit(r.warnings.length === 0 ? 0 : 1);
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      ok: true,
      today,
      daily_quota: quota,
      open_count: r.open.length,
      picks: r.actionable.slice(0, quota),
      queue: r.actionable.slice(0, limit),
      awaiting_human: r.waiting.map((t) => ({ id: t.id, title: t.title, age: t.age, reason: t.awaitingReason })),
      warnings: r.warnings,
      by_status: r.byStatus,
    }, null, 2));
    return;
  }

  console.log(`# 次に解く課題（${today} 時点）`);
  console.log(`未処理 ${r.open.length}件 ＝ エージェントが解ける ${r.actionable.length}件 ＋ オーナー待ち ${r.waiting.length}件 / 本日の消化上限 ${quota}件\n`);
  console.log(renderTable(r.actionable.slice(0, limit)));
  console.log(`\n実効: 滞留日数で繰り上げた優先度（↑ が繰り上がったもの・P0へは昇格させない）`);
  console.log(`元  : agent-backlog.md に書かれている優先度`);

  if (r.waiting.length) {
    console.log(`\n👤 オーナー（あなた）にしか進められない課題 ${r.waiting.length}件 — 自動ルーチンは選ばない:`);
    for (const t of r.waiting.sort((a, b) => (b.age || 0) - (a.age || 0))) {
      console.log(`  - ${t.id}（滞留${t.age === null ? '不明' : t.age + '日'}）${t.title.slice(0, 40)} … ${t.awaitingReason}`);
    }
  }
  if (r.warnings.length) {
    console.log(`\n⚠ 列の健全性（${r.warnings.length}件）:`);
    for (const w of r.warnings) console.log('  - ' + w);
  }
  console.log(`\nポリシー: data/solve_next_policy.json（消化レート・繰り上げ日数・除外の唯一の情報源）`);
}

if (require.main === module) main();

module.exports = { parseBacklog, effectivePriority, ageDays, build };
