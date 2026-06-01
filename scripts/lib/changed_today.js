'use strict';

/**
 * scripts/lib/changed_today.js
 *
 * 「その日に追加・変更されたシステムだけ」をQA対象に絞り込むための共有ヘルパー。
 *
 * 設計:
 *   - 前回 nightly QA が処理したコミット SHA を data/qa_state.json に記録（マーカー方式）。
 *   - 今回は そのSHA..HEAD の差分ファイルだけをスコープにする（冪等・取りこぼし無し）。
 *   - マーカーが無い初回 / SHA が解決できない場合は「直近 N 時間」窓にフォールバック。
 *
 * 全件をなめ回すのではなく、その日のコミットで触れたファイルだけを
 * 関連バリデータに流すことで、夜間QAを軽く・速く・意味のあるものに保つ。
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const QA_STATE = path.join(ROOT, 'data', 'qa_state.json');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function headSha() {
  return git(['rev-parse', 'HEAD']);
}

/** data/qa_state.json から前回QA済みSHAを読む（無ければ null） */
function readLastQaSha() {
  try {
    const j = JSON.parse(fs.readFileSync(QA_STATE, 'utf8'));
    return typeof j.lastQaSha === 'string' && j.lastQaSha ? j.lastQaSha : null;
  } catch (_) {
    return null;
  }
}

/** 今回のQA済みSHAを保存（次回の差分起点になる） */
function writeLastQaSha(sha, extra = {}) {
  const payload = { lastQaSha: sha, updatedAt: extra.updatedAt || null, ...extra };
  fs.writeFileSync(QA_STATE, JSON.stringify(payload, null, 2) + '\n');
}

/**
 * 差分ファイル一覧を取得する。
 * @param {object} opts
 * @param {string|null} opts.sinceSha 起点コミット（null なら時間窓フォールバック）
 * @param {number} opts.fallbackHours マーカー無し時に遡る時間（既定24h）
 * @param {boolean} opts.windowOnly true ならマーカーを無視して必ず時間窓モード（CI 用）
 * @returns {{ files: string[], sinceRef: string, head: string }}
 */
function getChangedFiles(opts = {}) {
  const head = headSha();
  const fallbackHours = opts.fallbackHours || 24;
  let sinceSha = opts.windowOnly
    ? null
    : (opts.sinceSha === undefined ? readLastQaSha() : opts.sinceSha);

  // 起点SHAが現在のリポジトリで解決できるか検証（force-push / 浅いcloneで消えている場合に備える）
  if (sinceSha) {
    try {
      git(['cat-file', '-e', `${sinceSha}^{commit}`]);
    } catch (_) {
      sinceSha = null; // 解決不能 → フォールバック
    }
  }

  let files;
  let sinceRef;
  if (sinceSha && sinceSha !== head) {
    files = git(['diff', '--name-only', `${sinceSha}..${head}`]).split('\n');
    sinceRef = sinceSha;
  } else if (sinceSha && sinceSha === head) {
    files = []; // 新規コミット無し
    sinceRef = sinceSha;
  } else {
    files = git(['log', `--since=${fallbackHours} hours ago`, '--name-only', '--pretty=format:'])
      .split('\n');
    sinceRef = `~${fallbackHours}h`;
  }

  files = Array.from(new Set(files.map(f => f.trim()).filter(Boolean)))
    // 既に削除されたファイルは対象外（存在するものだけ検証する）
    .filter(f => fs.existsSync(path.join(ROOT, f)));

  return { files, sinceRef, head };
}

/**
 * 変更ファイル一覧を QA カテゴリへ分類する（純粋関数・テスト対象）。
 * @param {string[]} files リポジトリルートからの相対パス配列
 * @returns {Record<string,string[]>}
 */
function categorize(files) {
  const cat = {
    journalHtml: [],   // 日次ジャーナル記事
    featureHtml: [],   // 特集記事
    buildCore: [],     // サイト生成の中核スクリプト
    gas: [],           // GAS（LINE/レポート配信）
    scripts: [],       // その他 Node スクリプト
    dataManual: [],    // 手動キュレーション店マスター
    dataStores: [],    // canonical 店舗カタログ
    other: [],
  };

  const isDupCopy = f => / \d+\.(js|html)$/.test(f); // "foo 2.js" 等の Finder 複製は対象外

  for (const f of files) {
    if (isDupCopy(f)) { cat.other.push(f); continue; }

    if (f.startsWith('journal/') && f.endsWith('.html')) cat.journalHtml.push(f);
    else if (f.startsWith('features/') && f.endsWith('.html')) cat.featureHtml.push(f);
    else if (/^(build\.js|gen-store-pages\.js|build_features\.js)$/.test(f)) cat.buildCore.push(f);
    else if (f === 'Google分析オートLINE送信.js' || f === '.gas-deploy/Code.js') cat.gas.push(f);
    else if (f === 'data/manual_stores.json') cat.dataManual.push(f);
    else if (f === 'data/stores.json') cat.dataStores.push(f);
    else if (f.endsWith('.js') && !f.startsWith('node_modules/')) cat.scripts.push(f);
    else cat.other.push(f);
  }
  return cat;
}

module.exports = {
  getChangedFiles,
  categorize,
  readLastQaSha,
  writeLastQaSha,
  headSha,
  QA_STATE,
  ROOT,
};
