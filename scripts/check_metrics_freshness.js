'use strict';
/**
 * scripts/check_metrics_freshness.js
 *
 * 毎日書き直されるはずの計測のファイルが古くなっていないかを見る（MEO-006・計画書 docs/meo-plan-2026-10.md の 6.4 節）。
 * GA4・Search Console の鍵が切れる、取得の段が落ちるなどで書き直しが止まると、レポートは古い数字のまま出続ける。
 * 判定はファイルの generatedAt（取得した時刻）だけで行う（制約10）。
 *
 * 使い方:
 *   node scripts/check_metrics_freshness.js            # 一覧を出す
 *   node scripts/check_metrics_freshness.js --check    # 1 つでも古い・読めないファイルがあれば exit 1（夜間QA の soft）
 *   node scripts/check_metrics_freshness.js --json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAX_AGE_DAYS = 2;
const FILES = [
  'data/view_counts.json',
  'data/site_metrics.json',
  'data/store_referrals.json',
  'data/gsc_metrics.json',
];

/**
 * @param {Array<{file:string, generatedAt?:string, error?:string}>} entries
 * @param {number} nowMs
 * @param {number} maxAgeDays
 * @returns {Array<{file:string, generatedAt:string|null, ageDays:number|null, ok:boolean, reason:string}>}
 */
function judge(entries, nowMs, maxAgeDays = MAX_AGE_DAYS) {
  return entries.map((e) => {
    if (e.error) return { file: e.file, generatedAt: null, ageDays: null, ok: false, reason: e.error };
    const t = Date.parse(e.generatedAt || '');
    if (!Number.isFinite(t)) return { file: e.file, generatedAt: e.generatedAt || null, ageDays: null, ok: false, reason: 'generatedAt が無い・読めない' };
    const ageDays = Math.round(((nowMs - t) / 86400000) * 10) / 10;
    const ok = nowMs - t <= maxAgeDays * 86400000;
    return { file: e.file, generatedAt: e.generatedAt, ageDays, ok, reason: ok ? '' : `${maxAgeDays} 日より古い` };
  });
}

function readEntries(files = FILES) {
  return files.map((file) => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      return { file, generatedAt: d && d.generatedAt };
    } catch (e) {
      return { file, error: fs.existsSync(path.join(ROOT, file)) ? 'JSON として読めない' : 'ファイルが無い' };
    }
  });
}

module.exports = { judge, readEntries, FILES, MAX_AGE_DAYS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const rows = judge(readEntries(), Date.now());
  if (args.includes('--json')) {
    console.log(JSON.stringify({ maxAgeDays: MAX_AGE_DAYS, files: rows }, null, 2));
  } else {
    console.log(`計測のファイルの鮮度（${MAX_AGE_DAYS} 日より古ければ赤）`);
    for (const r of rows) {
      console.log(`  ${r.ok ? '✅' : '❌'} ${r.file}  ${r.generatedAt || '-'}${r.ageDays == null ? '' : `（${r.ageDays} 日前）`}${r.reason ? `  ${r.reason}` : ''}`);
    }
  }
  if (args.includes('--check') && rows.some((r) => !r.ok)) process.exit(1);
}
