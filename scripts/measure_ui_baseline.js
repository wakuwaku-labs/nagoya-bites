#!/usr/bin/env node
/**
 * measure_ui_baseline.js — 代表画面の今の数字（基準値）を「割合（分母つき）」で記録する（UI/UX 計画 段階2 の7番・Ondine #2412）
 *
 * 代表画面の一覧は docs/ui-map.md の「代表画面」節と同じ（下の PAGES）。数えるのは既存の2本の検査の結果だけで、
 * 判定のロジックは持たない（scripts/audit_design_system.js・scripts/audit_ui_extra.js・data/design_system.json は変えない）。
 *   - design: audit_design_system.js --check を1回（既存の合否の違反・動きの件数を、代表画面の行だけ拾う。違反のある画面の割合）
 *   - extra : audit_ui_extra.js の auditHtml / auditCss（数えるだけ。項目ごとに「違反のある画面の割合」と
 *             「読んだ CSS 規則あたりの違反の割合」。CSS 規則の数は同じスクリプトの parseCss で数える）
 * 合否は決めない（終了コードは常に 0。読めなかったときだけ 2）。日時は入れない（同じ入力で2回測ると同じ出力になる）。
 *
 * 使い方:
 *   node scripts/measure_ui_baseline.js                 # 標準出力に JSON
 *   node scripts/measure_ui_baseline.js --write         # data/ui_baseline_ratio.json に書く
 *   node scripts/measure_ui_baseline.js --root <dir> --page <name>=<相対パス> ...   # 試験用（代表画面を差し替える）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const extra = require('./audit_ui_extra.js');

// 代表画面（docs/ui-map.md と同じ。替えるときは両方を直し、基準値を測り直す）
const PAGES = [
  { key: 'top', label: 'トップ（店の検索・絞り込み・店のモーダル）', path: 'index.html' },
  { key: 'store', label: '店ページ（E1）', path: 'stores/J000015064.html' },
  { key: 'journal', label: 'ジャーナルの記事（E2）', path: 'journal/2026-04-21-yabamisen-nagoya-insider.html' },
  { key: 'feature', label: '特集の記事', path: 'features/banquet.html' },
  { key: 'features-index', label: '特集一覧', path: 'features/index.html' },
  { key: 'journal-index', label: 'ジャーナル一覧', path: 'journal/index.html' },
];
const SHARED_CSS = 'assets/css/nb.css';

const ratio = (num, den) => ({ num, den, ratio: den ? Math.round((num / den) * 10000) / 10000 : null });

function styleBlocks(html) {
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/** audit_design_system.js --check を全体で1回走らせ、代表画面ごとの違反・動きの件数を拾う（このスクリプトに --file は無い） */
function designRun(root) {
  const script = path.join(__dirname, 'audit_design_system.js');
  let stdout = '';
  let code = 0;
  try {
    stdout = execFileSync(process.execPath, [script, '--check', '--root', root], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    stdout = e.stdout || '';
    code = e.status == null ? 1 : e.status;
  }
  let json = null;
  try { json = JSON.parse(stdout); } catch (_) { /* 読めない */ }
  if (!json) throw new Error(`audit_design_system.js の出力を読めない（終了コード ${code}）`);
  return json;
}

function designFor(run, rel) {
  const v = (run.violations || []).filter((x) => x && x.file === rel).length;
  const m = run.motion && run.motion.byFile && run.motion.byFile[rel] ? Object.values(run.motion.byFile[rel]).reduce((a, b) => a + b, 0) : 0;
  return { violations: v, motion: m };
}

function measure(root, pages) {
  const nbCssPath = path.join(root, SHARED_CSS);
  const nbCss = fs.existsSync(nbCssPath) ? fs.readFileSync(nbCssPath, 'utf8') : '';
  const nbRules = nbCss ? extra.parseCss(nbCss) : [];
  const tokens = {};
  for (const r of nbRules) if (r.selector === ':root') for (const [k, v] of r.decls) if (k.startsWith('--')) tokens[k] = v; // audit_ui_extra.js の tokensOf と同じ
  const nbRes = nbCss ? extra.auditCss(nbCss, { tokens }) : { violations: [], usesSafeEnv: false };
  const run = designRun(root);

  const perPage = [];
  for (const p of pages) {
    const abs = path.join(root, p.path);
    if (!fs.existsSync(abs)) throw new Error(`代表画面が無い: ${p.path}`);
    const html = fs.readFileSync(abs, 'utf8');
    const vs = extra.auditHtml(html, { tokens, cssUsesSafeEnv: nbRes.usesSafeEnv }); // audit_ui_extra.js の既定の範囲と同じ渡し方
    const cssRules = styleBlocks(html).reduce((n, css) => n + extra.parseCss(css).length, 0);
    const byRule = Object.fromEntries(extra.RULES.map((r) => [r, 0]));
    for (const v of vs) if (v.rule in byRule) byRule[v.rule]++;
    perPage.push({ key: p.key, label: p.label, path: p.path, cssRules, extra: { total: vs.length, byRule }, design: designFor(run, p.path) });
  }

  // 共有スタイルシート（全画面が読む）は1本として別に数える
  const nbVs = nbRes.violations;
  const nbByRule = Object.fromEntries(extra.RULES.map((r) => [r, 0]));
  for (const v of nbVs) if (v.rule in nbByRule) nbByRule[v.rule]++;

  const n = perPage.length;
  const totalRules = perPage.reduce((s, p) => s + p.cssRules, 0);
  const extraRatios = {};
  for (const r of extra.RULES) {
    const pagesWith = perPage.filter((p) => p.extra.byRule[r] > 0).length;
    const count = perPage.reduce((s, p) => s + p.extra.byRule[r], 0);
    extraRatios[r] = { pagesWithViolation: ratio(pagesWith, n), perCssRule: ratio(count, totalRules) };
  }
  const extraAny = perPage.filter((p) => p.extra.total > 0).length;
  const extraTotal = perPage.reduce((s, p) => s + p.extra.total, 0);

  return {
    about: '代表画面の基準値（割合は num/den。den は代表画面の数か、読んだ CSS 規則の数）。数えるだけで合否には使わない（Ondine #2412・docs/ui-map.md）',
    sources: ['scripts/audit_design_system.js --check（全体を1回。代表画面の行だけ拾う）', 'scripts/audit_ui_extra.js (auditHtml / auditCss / parseCss)'],
    pages: perPage.map((p) => ({ key: p.key, label: p.label, path: p.path })),
    sharedCss: SHARED_CSS,
    ratios: {
      design_pagesWithViolation: ratio(perPage.filter((p) => p.design.violations > 0).length, n),
      design_pagesWithMotionCount: ratio(perPage.filter((p) => p.design.motion > 0).length, n),
      extra_pagesWithAny: ratio(extraAny, n),
      extra_perCssRule: ratio(extraTotal, totalRules),
      extra_byRule: extraRatios,
      sharedCss_perCssRule: ratio(nbVs.length, nbRules.length),
    },
    detail: {
      perPage,
      sharedCss: { cssRules: nbRules.length, total: nbVs.length, byRule: nbByRule },
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  let root = path.resolve(__dirname, '..');
  let pages = PAGES;
  let write = false;
  const custom = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') root = path.resolve(args[++i]);
    else if (args[i] === '--write') write = true;
    else if (args[i] === '--page') { const [k, p] = String(args[++i]).split('='); custom.push({ key: k, label: k, path: p }); }
  }
  if (custom.length) pages = custom;
  let out;
  try { out = measure(root, pages); } catch (e) { console.error(e.message); process.exit(2); }
  const text = JSON.stringify(out, null, 2) + '\n';
  if (write) fs.writeFileSync(path.join(root, 'data/ui_baseline_ratio.json'), text);
  else process.stdout.write(text);
}

if (require.main === module) main();
module.exports = { measure, PAGES };
