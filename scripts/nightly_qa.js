#!/usr/bin/env node
'use strict';

/**
 * scripts/nightly_qa.js
 *
 * 「その日に追加・変更されたシステムだけ」を対象に、夜間（3時デプロイの直前）で回す
 * 軽量QAランナー。全件総ざらいではなく、当日コミットで触れたファイルの
 * カテゴリに応じて、関連する単体テスト／既存監査スクリプトだけを起動する。
 *
 * 使い方:
 *   node scripts/nightly_qa.js                 # 前回QA済みSHA..HEAD を対象に実行
 *   node scripts/nightly_qa.js --since <sha>   # 起点SHAを明示
 *   node scripts/nightly_qa.js --hours 24      # マーカー無し時の遡り時間
 *   node scripts/nightly_qa.js --no-advance    # qa_state.json のマーカーを進めない（ドライ確認用）
 *
 * 出力:
 *   docs/qa/nightly-YYYY-MM-DD.md にレポートを書き出し、標準出力に要約。
 *   ハード失敗（単体テスト / isNagoya フィルタ）があれば exit code 1。
 *
 * 設計意図:
 *   - 既存 build.yml の3時デプロイは壊さない（これは独立した早期警報レイヤー）。
 *   - 依存ゼロ（Node 組み込みの node:test と child_process のみ）。
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  getChangedFiles, categorize, writeLastQaSha, ROOT,
} = require('./lib/changed_today.js');

// ── 引数パース ────────────────────────────────────────
const argv = process.argv.slice(2);
const getOpt = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};
const sinceArg = getOpt('--since');
const hoursArg = getOpt('--hours');
const noAdvance = argv.includes('--no-advance');
const windowOnly = argv.includes('--window-only'); // CI: マーカー無視で時間窓モード

const today = (() => {
  // JST の当日日付（YYYY-MM-DD）
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
})();

// ── 当日の差分を取得・分類 ────────────────────────────
const { files, sinceRef, head } = getChangedFiles({
  sinceSha: sinceArg !== undefined ? sinceArg : undefined,
  fallbackHours: hoursArg ? Number(hoursArg) : 24,
  windowOnly,
});
const cat = categorize(files);

// ── 当日カテゴリから「回すチェック」を決める ──────────
// hard:true は失敗で exit 1（デプロイ前に止めたい級）。false は報告のみ。
const checks = [];

// ── 毎晩の3本柱（差分に関係なく常時実行）──────────────
// 1. テスト実行
checks.push({
  id: 'unit-tests',
  title: 'ユニットテスト（node:test 全件）',
  hard: true,
  trigger: '常時',
  cmd: ['node', ['--test', ...listTestFiles()]],
});
// 2. 性能測定（監視・SOFT。測定値を必ずレポートに載せる）
checks.push({
  id: 'perf',
  title: '性能測定（静的指標・前回比退行検知）',
  hard: false,
  alwaysShow: true,
  trigger: '常時',
  cmd: ['node', ['scripts/perf_audit.js']],
});
// 3. セキュリティチェック（機密混入/シークレット=HARD・脆弱性=SOFT）
checks.push({
  id: 'security',
  title: 'セキュリティチェック（機密追跡/シークレット/npm監査）',
  hard: true,
  alwaysShow: true,
  trigger: '常時',
  cmd: ['node', ['scripts/security_audit.js']],
});

if (cat.buildCore.length) {
  checks.push({
    id: 'isnagoya-filter',
    title: 'isNagoyaStore 品質フィルタ単体テスト',
    hard: true,
    trigger: cat.buildCore.join(', '),
    cmd: ['node', ['scripts/audit_isnagoya_filter.js']],
  });
}

if (cat.featureHtml.length) {
  checks.push({
    id: 'feature-stores',
    title: '架空店監査（特集の掲載店 vs LOCAL_STORES）',
    hard: false,
    trigger: `${cat.featureHtml.length} 件の特集変更`,
    cmd: ['node', ['scripts/audit_feature_stores.js']],
  });
  checks.push({
    id: 'feature-schema',
    title: 'features スキーマ整合性監査',
    hard: false,
    trigger: `${cat.featureHtml.length} 件の特集変更`,
    cmd: ['node', ['scripts/audit_feature_schema_alignment.js']],
  });
}

if (cat.journalHtml.length && fs.existsSync(path.join(ROOT, 'scripts/audit_journal.js'))) {
  checks.push({
    id: 'journal-audit',
    title: 'ジャーナル監査',
    hard: false,
    trigger: `${cat.journalHtml.length} 件のジャーナル変更`,
    cmd: ['node', ['scripts/audit_journal.js']],
  });
}

if (cat.dataManual.length) {
  checks.push({
    id: 'manual-links',
    title: 'manual_stores.json リンク到達性監査',
    hard: false,
    trigger: 'data/manual_stores.json 変更',
    cmd: ['node', ['scripts/audit_manual_stores_links.js']],
  });
}

// 変更された Node スクリプトは構文チェック（壊れた push の早期検知）
const changedScripts = [...cat.scripts, ...cat.buildCore].filter(f => f.endsWith('.js'));
for (const f of changedScripts) {
  checks.push({
    id: `syntax:${f}`,
    title: `構文チェック ${f}`,
    hard: true,
    trigger: f,
    cmd: ['node', ['--check', f]],
  });
}

// ── 実行 ──────────────────────────────────────────────
function listTestFiles() {
  const dir = path.join(ROOT, 'tests');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).map(f => `tests/${f}`);
}

function run(check) {
  const [bin, args] = check.cmd;
  try {
    const out = execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ...check, ok: true, output: out };
  } catch (e) {
    const output = `${e.stdout || ''}${e.stderr || ''}` || e.message;
    return { ...check, ok: false, output };
  }
}

const results = checks.map(run);
const hardFails = results.filter(r => !r.ok && r.hard);
const softFails = results.filter(r => !r.ok && !r.hard);
const verdict = hardFails.length === 0 ? (softFails.length ? 'WARN' : 'PASS') : 'FAIL';

// ── レポート生成 ──────────────────────────────────────
const tail = (s, n = 25) => (s || '').trimEnd().split('\n').slice(-n).join('\n');
const icon = ok => (ok ? '✅' : '❌');

const changedSummary = Object.entries(cat)
  .filter(([, v]) => v.length)
  .map(([k, v]) => `| ${k} | ${v.length} | ${v.slice(0, 8).join('<br>')}${v.length > 8 ? `<br>…他${v.length - 8}件` : ''} |`)
  .join('\n');

const report = `# 夜間QAレポート ${today}

| 項目 | 値 |
|------|----|
| 判定 | **${verdict}** |
| 差分起点 | \`${sinceRef}\` |
| HEAD | \`${head.slice(0, 9)}\` |
| 変更ファイル数 | ${files.length} |
| ハード失敗 | ${hardFails.length} |
| ソフト警告 | ${softFails.length} |

## その日に変更されたシステム（QAスコープ）

${changedSummary || '_対象となる変更なし_'}

## チェック結果

| | チェック | 種別 | きっかけ |
|--|---------|------|---------|
${results.map(r => `| ${icon(r.ok)} | ${r.title} | ${r.hard ? 'hard' : 'soft'} | ${r.trigger} |`).join('\n')}

${results.filter(r => !r.ok || r.alwaysShow).map(r => `### ${icon(r.ok)} ${r.title}\n\n\`\`\`\n${tail(r.output, 30)}\n\`\`\`\n`).join('\n') || '_全チェック合格_'}

---
_generated by scripts/nightly_qa.js_
`;

const qaDir = path.join(ROOT, 'docs', 'qa');
fs.mkdirSync(qaDir, { recursive: true });
const reportPath = path.join(qaDir, `nightly-${today}.md`);
fs.writeFileSync(reportPath, report);

// ── 標準出力サマリ ────────────────────────────────────
console.log(`\n夜間QA ${today} — 判定: ${verdict}`);
console.log(`  差分: ${sinceRef}..${head.slice(0, 9)} / 変更 ${files.length} 件`);
for (const r of results) console.log(`  ${icon(r.ok)} [${r.hard ? 'hard' : 'soft'}] ${r.title}`);
console.log(`  レポート: ${path.relative(ROOT, reportPath)}`);

// ── 発見事項を Notion 課題トラッカーへ流す ────────────
// 設計: ここでは agent-backlog.md に [QA-*] エントリを冪等起票するだけ。
//       実際の Notion 反映は既存の sync_backlog_to_notion.js → /sync-backlog（Notion MCP）が担う。
//       「修正点が見つかったら必ず Notion にタスクとして残す」を単一経路（backlog）で保証する。
function collectFindings() {
  const out = [];
  for (const [bin, args] of [['node', ['scripts/security_audit.js', '--json']], ['node', ['scripts/perf_audit.js', '--json', '--no-record']]]) {
    try {
      const json = execFileSync(bin, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed.findings)) out.push(...parsed.findings);
    } catch (e) {
      // security_audit は HARD 検知で exit 1 でも stdout に JSON を出している
      try {
        const parsed = JSON.parse((e.stdout || '').toString());
        if (Array.isArray(parsed.findings)) out.push(...parsed.findings);
      } catch (_) { /* スキップ */ }
    }
  }
  return out;
}

function backlogEntry(f) {
  const lines = [
    `### [${f.id}] ${f.title}`,
    `- **priority**: ${f.priority || 'P2'} → **status**: ready`,
    `- **detected**: ${today}`,
    `- **category**: ${f.category || 'Security'}`,
    `- **owner**: ${f.owner || 'DataKeeper'}`,
    `- **source**: 夜間QA（scripts/nightly_qa.js 自動起票）${today}`,
  ];
  if (f.body) lines.push(...String(f.body).split('\n').map(l => l.length ? `- ${l.replace(/^- /, '')}` : l));
  return lines.join('\n');
}

function upsertBacklog(findings) {
  const BACKLOG = path.join(ROOT, 'agent-backlog.md');
  if (!fs.existsSync(BACKLOG)) return { created: [], existing: [] };
  let md = fs.readFileSync(BACKLOG, 'utf8');
  const created = [], existing = [];
  const newBlocks = [];
  for (const f of findings) {
    if (!f.id) continue;
    if (md.includes(`[${f.id}]`)) { existing.push(f.id); continue; }
    newBlocks.push(backlogEntry(f));
    created.push(f.id);
  }
  if (newBlocks.length) {
    const SECTION = '## 夜間QA検出課題（QA-*）';
    if (md.includes(SECTION)) {
      md = md.replace(SECTION, `${SECTION}\n\n${newBlocks.join('\n\n')}`);
    } else {
      md = `${md.trimEnd()}\n\n---\n\n${SECTION}\n\n${newBlocks.join('\n\n')}\n`;
    }
    fs.writeFileSync(BACKLOG, md);
  }
  return { created, existing };
}

const findings = collectFindings();
const routed = upsertBacklog(findings);
fs.writeFileSync(path.join(ROOT, 'data', 'qa_findings.json'),
  JSON.stringify({ date: today, head, verdict, findings, created: routed.created, existing: routed.existing }, null, 2) + '\n');

if (findings.length) {
  console.log(`  Notion連携: 発見 ${findings.length} 件 / backlog 新規起票 ${routed.created.length} 件${routed.created.length ? '（' + routed.created.join(', ') + '）' : ''}・既存 ${routed.existing.length} 件`);
  if (routed.created.length) console.log('  → 次回の backlog→Notion 同期（/sync-backlog）で課題トラッカーへ反映されます');
}

// ── マーカー前進（次回の差分起点を HEAD に）───────────
if (!noAdvance) {
  writeLastQaSha(head, { updatedAt: today, lastVerdict: verdict });
}

// GitHub Actions 用の出力（Issue 本文などに使う）
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${verdict}\nreport_path=${path.relative(ROOT, reportPath)}\nhard_fails=${hardFails.length}\nsoft_fails=${softFails.length}\n`);
}

process.exit(hardFails.length ? 1 : 0);
