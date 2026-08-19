'use strict';

/**
 * scripts/audit_instagram_links.js
 *
 * Instagramボタンのリンク先（r['Instagram']）の正確性を監査する。
 *
 * ── 何のための検証か ──────────────────────────────────────────
 * カードの「Instagram」ボタンは r['Instagram']（= instagram_resolved.json 由来）を
 * 直接リンク先に使う。1つのアカウントが異なるブランドの複数店に登録されている場合、
 * ボタンを押すと別の店の Instagram に飛ぶ。
 *
 * ── 判定に使う事実（CLAUDE.md 制約10）─────────────────────────
 * 自己申告値（スコア等）は使わない。使うのは次の検証できる事実のみ:
 *   (1) instagram_resolved.json に記録されたアカウント名
 *   (2) 同じアカウントが紐づく全店舗の店名から求めるブランド判定
 *
 * ── 判定 ──────────────────────────────────────────────────
 *   OK          単一アカウント、または同一ブランド内の複数店で共有
 *   BLOCK       異なるブランドをまたいで共有 → Instagram を空にする
 *
 * ── ブランド判定 ─────────────────────────────────────────────
 * audit_reel_ownership.js と同じ sameBrand() を使う。
 * 店名からエリア語・支店語を除いたブランドコアを抽出し、
 * 全店名に共通する2文字以上の部分文字列があれば同一ブランドとみなす。
 *
 * 使い方:
 *   node scripts/audit_instagram_links.js             内訳レポート
 *   node scripts/audit_instagram_links.js --check     CI用（違反あり=exit 1）
 *   node scripts/audit_instagram_links.js --fix       instagram_resolved.json を修正
 *   node scripts/audit_instagram_links.js --list-blocked  遮断リストを表示
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RESOLVED_JSON = path.join(ROOT, 'data', 'instagram_resolved.json');

const args = process.argv.slice(2);
const MODE_CHECK = args.includes('--check');
const MODE_FIX = args.includes('--fix');
const MODE_LIST = args.includes('--list-blocked');

// audit_reel_ownership.js と同一のエリア語・支店語パターン
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

function acctHandle(url) {
  if (!url) return '';
  const s = String(url).trim();
  const m = s.match(/^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (m) return m[1].toLowerCase().replace(/\/$/, '');
  return s.toLowerCase().replace(/^@/, '').replace(/^instagram\.com\//i, '');
}

function loadResolved() {
  try { return JSON.parse(fs.readFileSync(RESOLVED_JSON, 'utf8')); }
  catch { return {}; }
}

function audit() {
  const resolved = loadResolved();

  // アカウント → そのアカウントが登録されている {id, name, entry} のリスト
  const byAcct = new Map();
  for (const [id, entry] of Object.entries(resolved)) {
    const ig = entry.instagram;
    if (!ig) continue;
    const acct = acctHandle(ig);
    if (!acct) continue;
    if (!byAcct.has(acct)) byAcct.set(acct, []);
    byAcct.get(acct).push({ id, name: entry.store || '', entry });
  }

  const violations = []; // { acct, stores[] }
  const ok = [];

  for (const [acct, stores] of byAcct) {
    if (stores.length <= 1) {
      ok.push({ acct, stores });
      continue;
    }
    const names = stores.map(s => s.name);
    if (sameBrand(names)) {
      ok.push({ acct, stores });
    } else {
      violations.push({ acct, stores });
    }
  }

  return { byAcct, violations, ok, resolved };
}

function main() {
  const { violations, ok, byAcct, resolved } = audit();

  const totalResolved = Object.values(resolved).filter(e => e.instagram).length;
  const totalViolationStores = violations.reduce((n, v) => n + v.stores.length, 0);
  const totalOkStores = ok.reduce((n, v) => n + v.stores.length, 0);

  if (!MODE_CHECK) {
    console.log('=== Instagram リンク監査レポート ===');
    console.log(`解決済みアカウント数: ${byAcct.size}`);
    console.log(`Instagram設定済み店舗数: ${totalResolved}`);
    console.log(`  正常（単独 or 同一ブランド）: ${ok.length} アカウント / ${totalOkStores} 店舗`);
    console.log(`  違反（異ブランド共有）:         ${violations.length} アカウント / ${totalViolationStores} 店舗`);
    console.log();
  }

  if (violations.length === 0) {
    if (!MODE_CHECK) console.log('✅ 違反なし');
    process.exit(0);
  }

  if (MODE_CHECK) {
    console.error(`[audit_instagram_links] ❌ 異ブランド共有アカウント ${violations.length} 件 / ${totalViolationStores} 店舗`);
    for (const v of violations.slice(0, 10)) {
      const names = v.stores.map(s => s.name).join(' / ');
      console.error(`  ${v.acct}: ${names}`);
    }
    process.exit(1);
  }

  if (MODE_LIST || !MODE_FIX) {
    console.log('🚫 異ブランド共有 → 遮断対象:');
    for (const v of violations) {
      console.log(`  ${v.acct} (${v.stores.length} 店舗):`);
      for (const s of v.stores) {
        console.log(`    [${s.id}] ${s.name} (score=${s.entry.score || 0})`);
      }
    }
    console.log();
  }

  if (MODE_FIX) {
    let fixCount = 0;
    for (const v of violations) {
      for (const s of v.stores) {
        if (resolved[s.id] && resolved[s.id].instagram) {
          resolved[s.id].instagram = '';
          fixCount++;
        }
      }
    }
    fs.writeFileSync(RESOLVED_JSON, JSON.stringify(resolved, null, 2) + '\n', 'utf8');
    console.log(`✅ --fix 完了: ${fixCount} 店舗の Instagram を空にしました`);
    console.log(`   対象: ${violations.map(v => v.acct).join(', ')}`);
  }
}

main();
