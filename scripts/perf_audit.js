#!/usr/bin/env node
'use strict';

/**
 * scripts/perf_audit.js
 *
 * 夜間QAの性能測定。依存ゼロ（zlib/fs のみ）。ブラウザ不要の静的指標を計測し、
 * data/perf_history.json に時系列で追記して「前回からの退行」を検知する。
 *
 * 計測:
 *   - index.html の生サイズ / gzip サイズ（実測）
 *   - インライン LOCAL_STORES バイト数
 *   - <script> 総数 / 外部 src 数 / <head> 内の同期描画ブロッキング数
 *   - 特集 features/*.html の合計・最大サイズ
 *   - sitemap.xml の URL 数・サイズ
 *   - 個別店舗ページ stores/*.html 件数
 *
 * 判定（すべて SOFT＝監視。デプロイは止めない）:
 *   - index.html 生サイズが閾値超え or 前回比 +15% で警告
 *
 * 使い方: node scripts/perf_audit.js [--no-record]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'perf_history.json');
const noRecord = process.argv.includes('--no-record');
const asJson = process.argv.includes('--json');

const sizeOf = p => (fs.existsSync(p) ? fs.statSync(p).size : 0);
const gzipOf = p => (fs.existsSync(p) ? zlib.gzipSync(fs.readFileSync(p)).length : 0);
const countFiles = (dir, ext) => {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith(ext)).map(f => path.join(d, f));
};

const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const indexPath = path.join(ROOT, 'index.html');
const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
const head = (indexHtml.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
const storesMatch = indexHtml.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);

const featurePages = countFiles('features', '.html');
const featureSizes = featurePages.map(p => ({ f: path.basename(p), bytes: sizeOf(p) }));
const featureTotal = featureSizes.reduce((s, x) => s + x.bytes, 0);
const largestFeature = featureSizes.sort((a, b) => b.bytes - a.bytes)[0] || { f: '-', bytes: 0 };

const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemapXml = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';

const metrics = {
  date: today,
  indexBytes: sizeOf(indexPath),
  indexGzip: gzipOf(indexPath),
  localStoresBytes: storesMatch ? storesMatch[1].length : 0,
  scriptTags: (indexHtml.match(/<script\b/g) || []).length,
  externalScripts: (indexHtml.match(/<script[^>]+src=/gi) || []).length,
  headBlocking: (head.match(/<script[^>]+src=/gi) || []).length
    + (head.match(/<link[^>]+rel=["']?stylesheet/gi) || []).length,
  featureCount: featurePages.length,
  featureTotalBytes: featureTotal,
  largestFeature: largestFeature.f,
  largestFeatureBytes: largestFeature.bytes,
  sitemapUrls: (sitemapXml.match(/<url>/g) || []).length,
  sitemapBytes: sizeOf(sitemapPath),
  storePages: countFiles('stores', '.html').length,
};

// ── 履歴ロード・前回比 ────────────────────────────────
let history = [];
try { history = JSON.parse(fs.readFileSync(HISTORY, 'utf8')); if (!Array.isArray(history)) history = []; } catch (_) {}
const prev = history.length ? history[history.length - 1] : null;

const warnings = [];   // 人間向け文字列
const findings = [];   // 構造化（Notion 起票用）
const INDEX_RAW_CEIL = 3.0 * 1048576; // 3MB を超えたら警告
if (metrics.indexBytes > INDEX_RAW_CEIL) {
  const msg = `index.html が ${(metrics.indexBytes / 1048576).toFixed(2)}MB（閾値 3MB 超）`;
  warnings.push(msg);
  findings.push({
    id: 'QA-PERF-INDEX-SIZE', sev: 'soft', priority: 'P2', category: 'パフォーマンス', owner: 'Builder',
    title: `index.html が肥大（${(metrics.indexBytes / 1048576).toFixed(2)}MB・閾値3MB超）`,
    body: `単一HTMLの初期ロードが重い。\n- acceptance: 遅延読込/分割等で初期ペイロード削減を検討（単一ファイル制約1とのバランス）／次回QAでサイズ推移を追跡`,
  });
}
if (prev && prev.indexGzip) {
  const delta = (metrics.indexGzip - prev.indexGzip) / prev.indexGzip;
  if (delta > 0.15) {
    const msg = `index.html gzip が前回比 +${(delta * 100).toFixed(0)}%（${(prev.indexGzip / 1024).toFixed(0)}KB→${(metrics.indexGzip / 1024).toFixed(0)}KB）`;
    warnings.push(msg);
    findings.push({
      id: 'QA-PERF-INDEX-GZIP-REGRESSION', sev: 'soft', priority: 'P2', category: 'パフォーマンス', owner: 'Builder',
      title: `index.html gzip が前回比 +${(delta * 100).toFixed(0)}% に増加`,
      body: `${msg}。直近のビルド/データ変更でペイロードが増えた可能性。\n- acceptance: 増加要因を特定し不要な肥大なら是正／意図的なら基準を更新`,
    });
  }
}

// ── 履歴追記（先に記録してから出力）──────────────────
if (!noRecord) {
  history = history.filter(h => h.date !== today);
  history.push(metrics);
  if (history.length > 90) history = history.slice(-90);
  fs.writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n');
}

// ── 出力 ──────────────────────────────────────────────
if (asJson) {
  process.stdout.write(JSON.stringify({ metrics, findings }, null, 0));
  process.exit(0);
}

const kb = n => (n / 1024).toFixed(0) + 'KB';
const mb = n => (n / 1048576).toFixed(2) + 'MB';
console.log('[perf] 測定結果:');
console.log(`  index.html      : ${mb(metrics.indexBytes)} (gzip ${kb(metrics.indexGzip)})` + (prev ? `  前回 gzip ${kb(prev.indexGzip)}` : ''));
console.log(`  LOCAL_STORES    : ${kb(metrics.localStoresBytes)}`);
console.log(`  <script>        : ${metrics.scriptTags} 個（外部 ${metrics.externalScripts}・head描画ブロッキング ${metrics.headBlocking}）`);
console.log(`  features        : ${metrics.featureCount} 本 / 計 ${mb(metrics.featureTotalBytes)}（最大 ${metrics.largestFeature} ${kb(metrics.largestFeatureBytes)}）`);
console.log(`  sitemap         : ${metrics.sitemapUrls} URL / ${mb(metrics.sitemapBytes)}`);
console.log(`  店舗ページ      : ${metrics.storePages} 件`);
for (const w of warnings) console.log(`[perf] ⚠ ${w}`);
if (!warnings.length) console.log('[perf] ✅ 退行なし');

process.exit(0); // perf は監視のみ（HARD失敗にしない）
