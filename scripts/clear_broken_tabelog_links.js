#!/usr/bin/env node
/**
 * scripts/audit_store_link_identity.js が「別の店（完全に無関係）を指している」と
 * 実地検証で確認した食べログURLを、manual_stores.json / stores.json / stores/*.html の
 * 3層から取り除く。
 *
 * 対象は data/store_link_identity_checked.json のうち sim===0（=リンク先ページのタイトルに
 * 我々の店名の痕跡が一切無い）のものだけに限定する。sim>0（那古亭/雷杏等、ふりがな併記や
 * ローマ字表記の差で閾値未達なだけの疑いがあるもの）は対象外とし、人による個別確認に残す
 * （品質ゲート原則: 検証できる事実だけで機械的に判定する。閾値ぎりぎりのものを自動処理しない）。
 *
 * 削除であって「正しいURLへの差し替え」ではない。正しいURLの再調査は別途行う。
 * フロントは 食べログURL が空なら食べログボタンを出さない（gen-store-pages.js の
 * `tbUrl && ...` 分岐 / index.html の同等ロジック）ため、安全に「リンク非表示」へ落ちる
 * （clear_unverified_urls.js と同じ思想）。
 *
 * 使い方:
 *   node scripts/clear_broken_tabelog_links.js --dry-run   # 対象一覧のみ表示
 *   node scripts/clear_broken_tabelog_links.js             # 実際に書き換え
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'store_link_identity_checked.json');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const STORES_JSON_PATH = path.join(ROOT, 'data', 'stores.json');
const STORES_DIR = path.join(ROOT, 'stores');

const dryRun = process.argv.includes('--dry-run');

function loadTargets() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const targets = [];
  for (const c of Object.values(cache)) {
    if (c.kind !== 'tabelog') continue;
    if (c.ok !== false) continue;
    // name-mismatch: リンク先が別店（sim=0のみ・閾値ぎりぎりのものは対象外）
    // confirmed-404: リンク先ページ自体が存在しない（HTTP 404 を実地確認済み）
    const isNameMismatch = c.reason === 'name-mismatch' && (c.sim || 0) === 0;
    const isConfirmed404 = c.reason === 'confirmed-404';
    if (!isNameMismatch && !isConfirmed404) continue;
    targets.push({ storeName: c.storeName, url: c.url });
  }
  return targets;
}

function patchManualStores(targets) {
  const raw = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8'));
  const stores = raw.stores || [];
  let n = 0;
  for (const t of targets) {
    for (const s of stores) {
      if (s['店名'] !== t.storeName) continue;
      if (s['食べログURL'] !== t.url) continue;
      s['食べログURL'] = '';
      delete s['食べログ評価'];
      if (Array.isArray(s['出典URL'])) {
        s['出典URL'] = s['出典URL'].filter((u) => u !== t.url);
      }
      n++;
    }
  }
  if (!dryRun && n) fs.writeFileSync(MANUAL_PATH, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return n;
}

function patchStoresJson(targets) {
  const stores = JSON.parse(fs.readFileSync(STORES_JSON_PATH, 'utf8'));
  let n = 0;
  for (const t of targets) {
    for (const s of stores) {
      if (s['店名'] !== t.storeName) continue;
      if (s['食べログURL'] !== t.url) continue;
      s['食べログURL'] = '';
      n++;
    }
  }
  if (!dryRun && n) fs.writeFileSync(STORES_JSON_PATH, JSON.stringify(stores), 'utf8');
  return n;
}

function findLdJsonRange(html) {
  const m = html.match(/<script type="application\/ld\+json">\s*\[/);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // position of '['
  let depth = 0, i = start, inStr = false, esc = false;
  while (i < html.length) {
    const c = html[i];
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === '"') inStr = !inStr;
    else if (!inStr) {
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) break; }
    }
    i++;
  }
  return { start, end: i + 1 };
}

function patchStoreHtmlFiles(targets) {
  const files = fs.readdirSync(STORES_DIR).filter((f) => f.endsWith('.html'));
  let filesTouched = 0;
  const urlSet = new Map(targets.map((t) => [t.url, t.storeName]));

  for (const f of files) {
    const p = path.join(STORES_DIR, f);
    let html = fs.readFileSync(p, 'utf8');
    let touched = false;

    for (const [url] of urlSet) {
      if (!html.includes(url)) continue;

      // 1) 可視CTAボタンの行を削除
      const btnRe = new RegExp(
        `\\s*<a class="link-btn tb" href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>食べログ<\\/a>`,
        'g'
      );
      if (btnRe.test(html)) {
        html = html.replace(btnRe, '');
        touched = true;
      }

      // 2) JSON-LD の sameAs 配列からURLを除去
      const range = findLdJsonRange(html);
      if (range) {
        const jsonText = html.slice(range.start, range.end);
        let arr;
        try {
          arr = JSON.parse(jsonText);
        } catch {
          arr = null;
        }
        if (arr) {
          let ldChanged = false;
          for (const obj of arr) {
            if (Array.isArray(obj.sameAs) && obj.sameAs.includes(url)) {
              obj.sameAs = obj.sameAs.filter((u) => u !== url);
              if (!obj.sameAs.length) delete obj.sameAs;
              ldChanged = true;
            }
          }
          if (ldChanged) {
            // 元ファイルは JSON.stringify(arr, null, 2) 相当のインデントで書かれている
            // （gen-store-pages.js の出力形式）。minify すると無関係な差分行が
            // ファイル全体に広がり diff レビューを困難にするため、同じ整形を維持する。
            html = html.slice(0, range.start) + JSON.stringify(arr, null, 2) + html.slice(range.end);
            touched = true;
          }
        }
      }
    }

    if (touched) {
      filesTouched++;
      if (!dryRun) fs.writeFileSync(p, html, 'utf8');
    }
  }
  return filesTouched;
}

function main() {
  const targets = loadTargets();
  console.log(`対象URL: ${targets.length}件${dryRun ? ' (--dry-run)' : ''}`);
  targets.forEach((t) => console.log(`  - ${t.storeName}: ${t.url}`));
  console.log('');

  const n1 = patchManualStores(targets);
  console.log(`data/manual_stores.json: ${n1}件クリア`);

  const n2 = patchStoresJson(targets);
  console.log(`data/stores.json: ${n2}件クリア`);

  const n3 = patchStoreHtmlFiles(targets);
  console.log(`stores/*.html: ${n3}ファイル修正`);

  if (dryRun) console.log('\n--dry-run のため実際の書き換えはしていません');
}

main();
