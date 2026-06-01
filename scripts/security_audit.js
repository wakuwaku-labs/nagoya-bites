#!/usr/bin/env node
'use strict';

/**
 * scripts/security_audit.js
 *
 * 夜間QAのセキュリティチェック。依存ゼロ（git / npm のみ）。
 *
 *   1. 機密ファイルの追跡検査 — cookie / 鍵 / .env 等が git に入っていないか（HARD）
 *   2. シークレット文字列スキャン — APIキー/秘密鍵がコミットされていないか（HARD）
 *   3. npm 依存の脆弱性サマリ（SOFT・報告のみ）
 *   4. .gitignore の必須エントリ確認（SOFT）
 *
 * 終了コード: HARD 検知があれば 1。
 * --json 指定時: 構造化された findings を stdout に JSON 出力（nightly_qa が Notion 起票に使う）。
 *
 * 誤検知の除外: .qa-secret-allowlist.txt に「パス部分文字列」を1行1件で書くとスキップ。
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const asJson = process.argv.includes('--json');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

const findings = []; // { id, sev, title, body, priority, category, owner }
const add = (f) => findings.push({ category: 'Security', owner: 'DataKeeper', ...f });

// 機密ファイル名 → 安定ID用スラッグ（.ig_cookies.json → IG-COOKIES）
const fileSlug = f => path.basename(f)
  .replace(/^\./, '').replace(/\.[^.]+$/, '')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase();

// ── allowlist ─────────────────────────────────────────
const allowlist = (() => {
  const p = path.join(ROOT, '.qa-secret-allowlist.txt');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
})();
const allowed = file => allowlist.some(a => file.includes(a));

// ── tracked files ─────────────────────────────────────
let tracked = [];
try { tracked = git(['ls-files']).split('\n').filter(Boolean); } catch (_) {}

// 1. 機密ファイルがコミットされていないか
const SENSITIVE_FILE = /(^|\/)(\.?ig_cookies\.json|cookies\.json|service-account.*\.json|credentials?\.json|\.env(\..+)?|.*\.pem|id_rsa|.*private.*key.*\.json|\.clasp\.json|\.netrc)$/i;
for (const f of tracked) {
  if (allowed(f)) continue;
  if (SENSITIVE_FILE.test(f)) {
    add({
      id: `QA-SEC-${fileSlug(f)}`,
      sev: 'hard',
      priority: 'P1',
      title: `\`${f}\`（機密ファイル）が git 追跡されている`,
      body: `機密ファイル \`${f}\` がリポジトリにコミットされている。履歴に残っている時点で漏洩扱い。\n- acceptance: \`git rm --cached ${f}\` で追跡解除＋.gitignore 追記／関連クレデンシャルのローテーション／夜間QAセキュリティチェックの PASS で再評価`,
    });
  }
}

// 2. シークレット文字列スキャン（追跡テキストのみ・git grep で binary は自動除外）
const SECRET_PATTERNS = [
  ['Google API key', 'AIza[0-9A-Za-z_\\-]{35}'],
  ['秘密鍵(PEM)', '-----BEGIN [A-Z ]*PRIVATE KEY-----'],
  ['AWS access key', 'AKIA[0-9A-Z]{16}'],
  ['GitHub PAT', '(ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{60,})'],
  ['Slack token', 'xox[baprs]-[0-9A-Za-z-]{10,}'],
  ['Anthropic key', 'sk-ant-[0-9A-Za-z\\-]{20,}'],
  ['OpenAI key', 'sk-[A-Za-z0-9]{32,}'],
];
for (const [label, re] of SECRET_PATTERNS) {
  let out = '';
  try {
    // -I: binary除外 / -n: 行番号 / -E: 拡張正規 / -e: パターン明示（先頭 - 対策）
    out = git(['grep', '-nIE', '-e', re]);
  } catch (e) {
    out = (e.stdout || '').toString(); // 無一致なら空
  }
  const hits = out.split('\n').filter(Boolean).filter(line => !allowed(line.split(':')[0]));
  if (hits.length) {
    const sample = hits.slice(0, 5).map(l => {
      const [file, ln] = l.split(':');
      return `    ${file}:${ln}`; // 値は出さない（漏洩二次被害防止）
    }).join('\n');
    add({
      id: `QA-SEC-SECRET-${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()}`,
      sev: 'hard',
      priority: 'P0',
      title: `${label} らしき文字列がコミットされている疑い（${hits.length}箇所）`,
      body: `シークレット文字列スキャンで検出（値は秘匿）:\n${sample}\n- acceptance: 該当値を確認し本物なら即ローテーション＋履歴消去／誤検知なら .qa-secret-allowlist.txt に登録`,
    });
  }
}

// 3. npm 依存の脆弱性（SOFT）
try {
  let auditJson = '';
  try { auditJson = execFileSync('npm', ['audit', '--json', '--omit=dev'], { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { auditJson = (e.stdout || '').toString(); } // 脆弱性ありでも exit!=0
  const a = JSON.parse(auditJson);
  const v = a.metadata && a.metadata.vulnerabilities;
  if (v && (v.total || 0) > 0) {
    add({
      id: 'QA-SEC-NPM-AUDIT',
      sev: 'soft',
      priority: (v.critical || v.high) ? 'P2' : 'P3',
      title: `npm 依存に既知脆弱性 ${v.total} 件（critical ${v.critical || 0} / high ${v.high || 0} / moderate ${v.moderate || 0}）`,
      body: `\`npm audit --omit=dev\` 結果。\n- acceptance: 破壊的変更の無い範囲で \`npm audit fix\`／高リスクは個別精査／残存はリスク受容理由を記録／次回QAで推移を追跡（制約4: サイト用新依存は追加しない）`,
    });
  }
} catch (_) {
  // 解析失敗は黙ってスキップ（環境依存）
}

// 4. .gitignore 必須エントリ
const gi = fs.existsSync(path.join(ROOT, '.gitignore')) ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
const giLines = gi.split('\n').map(s => s.trim());
for (const must of ['service-account.json', '.env', 'node_modules/']) {
  if (!giLines.includes(must)) {
    add({
      id: `QA-SEC-GITIGNORE-${must.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()}`,
      sev: 'soft', priority: 'P3',
      title: `.gitignore に "${must}" が無い`,
      body: `機密混入の予防として .gitignore に "${must}" を追加すべき。`,
    });
  }
}

// ── 出力 ──────────────────────────────────────────────
const hard = findings.filter(f => f.sev === 'hard');

if (asJson) {
  process.stdout.write(JSON.stringify({ findings }, null, 0));
} else {
  console.log(`[security] 追跡ファイル ${tracked.length} 件をスキャン`);
  if (!findings.length) console.log('[security] ✅ 問題なし');
  for (const f of hard) console.log(`[security] ❌ HARD [${f.id}]: ${f.title}`);
  for (const f of findings.filter(x => x.sev === 'soft')) console.log(`[security] ⚠ soft [${f.id}]: ${f.title}`);
}

process.exit(hard.length ? 1 : 0);
