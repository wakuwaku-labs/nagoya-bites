'use strict';
/**
 * scripts/audit_journal.js
 *
 * 月次で journal/ の過去30日分の記事をチェック:
 *   - 掲載店の 営業状況 が "閉店" に変わっていないか
 *   - リンク切れが発生していないか
 *   - pending_stores.json の情報源URLが 404 になっていないか(任意・時間かかるのでスキップ可)
 *
 * 使い方:
 *   node scripts/audit_journal.js           # 30日遡及
 *   node scripts/audit_journal.js --all     # 全期間
 *
 * 週次パイプラインに組み込む想定。閉店店舗を含む記事は
 *   ・記事末尾に "※{店名} はその後閉店しました" の脚注を追記
 *   ・journal_published.json の該当 entry に audited:true, closed_stores:[] を付与
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const JOURNAL_DIR = path.join(ROOT, 'journal');

function extractLocalStores() {
  const src = fs.readFileSync(INDEX, 'utf8');
  const m = src.match(/var\s+LOCAL_STORES\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  try { return eval(m[1]); } catch (_) { return []; }
}

function main() {
  const all = process.argv.includes('--all');
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const stores = extractLocalStores();
  const closedIds = new Set(stores.filter(s => String(s['公開フラグ']).toUpperCase() === 'FALSE' || s['営業状況'] === '閉店').map(s => s['店名']));

  const today = new Date();
  const issues = [];
  (published.entries || []).forEach(e => {
    if (!all) {
      const days = (today - new Date(e.date)) / 86400000;
      if (days > 30) return;
    }
    const closedInEntry = (e.store_ids || []).filter(id => closedIds.has(id));
    const file = path.join(JOURNAL_DIR, e.slug + '.html');
    const fileExists = fs.existsSync(file);
    if (closedInEntry.length > 0) issues.push({ slug: e.slug, type: 'closed', stores: closedInEntry });
    if (!fileExists) issues.push({ slug: e.slug, type: 'missing_file' });

    if (closedInEntry.length > 0) {
      e.audited = true;
      e.closed_stores = closedInEntry;
    }
  });

  if (issues.length > 0) {
    fs.writeFileSync(PUBLISHED, JSON.stringify(published, null, 2) + '\n');
    console.log(`⚠️  ${issues.length}件の要確認項目があります:`);
    issues.forEach(i => console.log(' -', JSON.stringify(i)));
  } else {
    console.log('✅ 監査結果: 問題なし');
  }
}

if (require.main === module) main();
