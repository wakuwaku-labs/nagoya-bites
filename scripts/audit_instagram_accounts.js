'use strict';

/**
 * scripts/audit_instagram_accounts.js
 *
 * カードの「Instagram」ボタンが別ブランドのアカウントに飛ぶ問題を検出・修正する。
 * （ISSUE-090）
 *
 * ── 何を検出するか ─────────────────────────────────────────────
 * 1つの Instagram アカウントがブランドの異なる複数店に紐づいている場合、
 * ボタンを押すと見知らぬ別店舗のページへ飛ぶ。これは「実在保証・編集独立性」
 * という Moat を直接毀損する（CLAUDE.md 制約7）。
 *
 * ── 判定に使う事実（CLAUDE.md 制約10）─────────────────────────
 * 自己申告値は一切使わない。使うのは次の2つだけ:
 *   (1) LOCAL_STORES の Instagram フィールドから取り出したハンドル名
 *   (2) 同じハンドルに紐づく全店舗の店名（→ sameBrand() で同一ブランド判定）
 *
 * ── 判定 ──────────────────────────────────────────────────────
 *   OK          1店のみに紐づく、または同一ブランド内の複数店
 *   SHARED      ブランドが異なる複数店に同じアカウントが紐づいている
 *
 * ── 修正（--fix）─────────────────────────────────────────────
 * data/instagram_resolved.json の対象エントリの instagram を '' にクリアし、
 * cleared_by_audit: true を付ける。build.js は instagram が空のエントリをスキップ
 * するため、次回 build で該当店の Instagram ボタンは検索フォールバックに戻る。
 * manual_stores.json に直接書かれたアカウントは対象外（人が手動で設定した信頼できる値）。
 *
 * 使い方:
 *   node scripts/audit_instagram_accounts.js            内訳レポート
 *   node scripts/audit_instagram_accounts.js --fix      問題エントリを instagram_resolved.json からクリア
 *   node scripts/audit_instagram_accounts.js --check    CI用（共有アカウントが残っていれば exit 1）
 *   node scripts/audit_instagram_accounts.js --list     共有アカウント一覧（全店名付き）
 */

const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores.js');

const ROOT = path.resolve(__dirname, '..');
const RESOLVED_JSON = path.join(ROOT, 'data', 'instagram_resolved.json');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual_stores.json');

// audit_reel_ownership.js と同じ正規化ロジック
const AREA_RE = /(名古屋駅|名駅|名古屋|栄東|栄|錦|金山|伏見|大須|今池|千種|藤が丘|本山|住吉|新栄|覚王山|八事|鶴舞|黒川|池下|矢場町|東別院|柳橋|広小路|笹島|岩塚|徳重|栄生|九条|西口|東口|南口|北口|駅前|本店|支店|店|丁目|[0-9０-９]|\s|　)/g;

const brandCore = name => String(name || '').replace(AREA_RE, '');

function sameBrand(names) {
  const cores = names.map(brandCore).filter(c => c.length >= 2);
  if (cores.length !== names.length) return false;
  const base = cores[0];
  for (let len = base.length; len >= 2; len--) {
    for (let i = 0; i + len <= base.length; i++) {
      const sub = base.substr(i, len);
      if (cores.every(c => c.includes(sub))) return true;
    }
  }
  return false;
}

function acctHandle(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (m) return m[1].toLowerCase().replace(/\/$/, '');
  return s.replace(/^@/, '').replace(/^instagram\.com\//i, '').toLowerCase().replace(/\/$/, '');
}

// manual_stores.json に直接登録されたアカウントのハンドルセットを返す
// （人が手動設定した信頼できる値なので audit からは除外する）
function loadManualHandles() {
  const handles = new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(MANUAL_JSON, 'utf8'));
    for (const s of raw.stores || []) {
      const h = acctHandle(s['Instagram'] || '');
      if (h) handles.add(h);
    }
  } catch {}
  return handles;
}

function audit() {
  const stores = loadStores();
  const manualHandles = loadManualHandles();

  // ハンドル → 該当店舗のリスト
  const byAcct = new Map();
  for (const s of stores) {
    const ig = s['Instagram'];
    if (!ig) continue;
    const h = acctHandle(ig);
    if (!h) continue;
    if (!byAcct.has(h)) byAcct.set(h, []);
    byAcct.get(h).push({ name: s['店名'] || '', id: s['ホットペッパーID'] || '' });
  }

  const shared = [];
  const ok = [];
  for (const [handle, entries] of byAcct) {
    if (entries.length <= 1) {
      ok.push({ handle, entries });
      continue;
    }
    const names = entries.map(e => e.name);
    if (sameBrand(names)) {
      ok.push({ handle, entries });
    } else {
      // manual で設定されているなら audit 対象外
      if (manualHandles.has(handle)) {
        ok.push({ handle, entries });
      } else {
        shared.push({ handle, entries, names });
      }
    }
  }

  return { byAcct, shared, ok, stores };
}

function fix(shared) {
  let resolved;
  try {
    resolved = JSON.parse(fs.readFileSync(RESOLVED_JSON, 'utf8'));
  } catch (e) {
    console.error('instagram_resolved.json を読み込めません:', e.message);
    process.exit(1);
  }

  // 共有アカウントに紐づく HP ID を収集
  const badHandles = new Set(shared.map(s => s.handle));
  let cleared = 0;

  for (const [id, entry] of Object.entries(resolved)) {
    if (!entry.instagram) continue;
    const h = acctHandle(entry.instagram);
    if (badHandles.has(h)) {
      entry.original_instagram = entry.instagram;
      entry.instagram = '';
      entry.cleared_by_audit = true;
      entry.cleared_at = new Date().toISOString();
      cleared++;
    }
  }

  fs.writeFileSync(RESOLVED_JSON, JSON.stringify(resolved, null, 2) + '\n', 'utf8');
  console.log(`instagram_resolved.json: ${cleared}件をクリア（instagram=''・cleared_by_audit=true）`);
  return cleared;
}

function main() {
  const args = process.argv.slice(2);
  const { shared, ok, byAcct } = audit();
  const affectedStores = shared.reduce((n, s) => n + s.entries.length, 0);

  if (args.includes('--list')) {
    if (shared.length === 0) {
      console.log('共有アカウント（ブランド割れ）: 0件');
      return;
    }
    console.log(`共有アカウント（ブランド割れ）: ${shared.length}アカウント / 影響店舗数: ${affectedStores}`);
    for (const { handle, entries } of shared.sort((a, b) => b.entries.length - a.entries.length)) {
      console.log(`\n  @${handle} (${entries.length}店)`);
      for (const e of entries) {
        console.log(`    - ${e.name}${e.id ? ' (' + e.id + ')' : ''}`);
      }
    }
    return;
  }

  if (args.includes('--fix')) {
    if (shared.length === 0) {
      console.log('共有アカウント（ブランド割れ）: 0件。修正不要。');
      return;
    }
    console.log(`共有アカウント ${shared.length}個（影響 ${affectedStores}店）を修正します...`);
    const cleared = fix(shared);
    console.log(`完了: ${cleared}エントリをクリア。次回 node build.js で反映されます。`);
    return;
  }

  // デフォルト: レポート
  const total = [...byAcct.values()].reduce((n, v) => n + v.length, 0);
  console.log('── Instagram アカウント監査 ─────────────────────────────');
  console.log(`登録アカウント数 : ${byAcct.size}（うち複数店共有: ${byAcct.size - ok.filter(o => o.entries.length <= 1).length}アカウント）`);
  console.log(`対象店舗数       : ${total}`);
  console.log(`  OK（1店 or 同一ブランド）: ${ok.reduce((n, o) => n + o.entries.length, 0)}店`);
  console.log(`  SHARED（別ブランド複数店）: ${affectedStores}店  ← 修正対象`);

  if (shared.length > 0) {
    shared.sort((a, b) => b.entries.length - a.entries.length);
    console.log(`\n上位共有アカウント（--list で全件表示）:`);
    for (const { handle, entries } of shared.slice(0, 10)) {
      const preview = entries.slice(0, 3).map(e => e.name).join(' / ');
      console.log(`  @${handle} (${entries.length}店): ${preview}${entries.length > 3 ? ' …' : ''}`);
    }
    if (shared.length > 10) console.log(`  …他 ${shared.length - 10} アカウント`);
    console.log('\n→ node scripts/audit_instagram_accounts.js --fix で修正し、node build.js を実行してください');
  }

  if (args.includes('--check')) {
    if (shared.length > 0) {
      console.error(`\nCI チェック失敗: ${shared.length}アカウントが別ブランドの複数店に共有されています（影響 ${affectedStores}店）`);
      console.error('→ node scripts/audit_instagram_accounts.js --fix && node build.js を実行してください');
      process.exit(1);
    }
    console.log('\nCI チェック通過: 共有アカウント（ブランド割れ）0件');
  }
}

main();
