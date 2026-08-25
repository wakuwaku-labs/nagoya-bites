#!/usr/bin/env node
'use strict';

/**
 * GAS の正本が1本であることを検査する（SEO-073）。
 *
 * 背景: 2026-06-02 まで repo 直下の「Google分析オートLINE送信.js」が GAS のソースだったが、
 * その後の修正（SEO-047 / SEO-057 / SEO-062 / SEO-063）はすべて .gas-deploy/Code.js に入り、
 * root 側は凍結したまま残った。両者が同名の関数を持つため、後から読んだ人（人間もエージェントも）が
 * 旧ミラーを本番コードと誤認する。実際 2026-08-25 に誤診が発生している。
 *
 * 判定は「検証できる事実」だけで行う（CLAUDE.md 制約10）:
 *   GA4 Data API（AnalyticsData.Properties）を含む .js が .gas-deploy/Code.js 以外に
 *   存在しないこと。この API を使うのは日次/週次レポート配信スクリプトだけ。
 *
 * 使い方:
 *   node scripts/audit_gas_mirror.js           # 一覧表示
 *   node scripts/audit_gas_mirror.js --check   # 違反あれば exit 1（CI 用）
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join('.gas-deploy', 'Code.js');

// レポート配信スクリプト固有の署名。GA4 Data API は「日次/週次レポート」だけが使うため、
// これを含む .js が正本以外にあれば、それは同じスクリプトの複製（＝誤読の罠）である。
// 注意: gas_scores.js / gas_tagging.js は評価取得・タグ付けという**別プロジェクト**の GAS で、
// 複製ではないため検出対象にしない（「GASっぽい」で括ると正常なファイルまで落ちる）。
const REPORT_SIGNATURE = 'AnalyticsData.Properties';

// 自分自身は署名文字列を含むが複製ではない
const SELF = path.join('scripts', 'audit_gas_mirror.js');

function looksLikeReportScript(src) {
  return src.includes(REPORT_SIGNATURE);
}

function scanDir(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(rel, f))
    .filter((p) => p !== CANONICAL && p !== SELF);
}

function main() {
  const check = process.argv.includes('--check');
  const candidates = [...scanDir('.'), ...scanDir('scripts'), ...scanDir('.gas-deploy')];
  const offenders = [];

  for (const rel of candidates) {
    let src;
    try {
      src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    if (looksLikeReportScript(src)) {
      offenders.push({
        file: rel,
        marker: REPORT_SIGNATURE,
      });
    }
  }

  const canonicalExists = fs.existsSync(path.join(ROOT, CANONICAL));

  const result = {
    ok: canonicalExists && offenders.length === 0,
    canonical: CANONICAL,
    canonical_exists: canonicalExists,
    duplicate_count: offenders.length,
    duplicates: offenders,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!canonicalExists) {
    console.error(`❌ GAS の正本 ${CANONICAL} が見つかりません。`);
    if (check) process.exit(1);
    return;
  }
  if (offenders.length) {
    console.error(
      `❌ GAS スクリプトの重複が ${offenders.length} 件あります。正本は ${CANONICAL} の1本に統一してください（SEO-073）。`
    );
    for (const o of offenders) console.error(`   - ${o.file}（レポート署名 ${o.marker} を含む）`);
    if (check) process.exit(1);
    return;
  }
  console.error(`✅ GAS の正本は ${CANONICAL} の1本。重複なし。`);
}

main();
