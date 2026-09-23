#!/usr/bin/env node
/**
 * scripts/audit_store_link_identity.js が「別の店（完全に無関係）を指している」と
 * 実地検証で確認した食べログURLを、manual_stores.json / stores.json / stores/*.html の
 * 3層から取り除く。
 *
 * 対象は data/store_link_identity_checked.json のうち、次のいずれかに該当するものだけ。
 *   (a) sim===0 … リンク先ページのタイトルに我々の店名の痕跡が一切無い
 *   (b) confirmed-404 … リンク先ページ自体が存在しない
 *   (c) 住所違い … 店名が一致せず、かつ我々が Google Places で持つ住所とリンク先の
 *       住所（JSON-LD）が食い違う＝別の建物を指している（2026-09-20 追加）
 * sim>0 でも住所が食い違えば (c) で落とす。逆に、どちらかの住所が取れない場合は
 * 何も主張できないので対象外とし、人による個別確認に残す
 * （品質ゲート原則: 検証できる事実だけで機械的に判定する。推測で消さない）。
 *
 * 解決キャッシュ（data/tabelog_resolved.json）も同時に failed 化する。これを忘れると
 * build.js が「食べログURLが空の店」をキャッシュで埋め戻すため、消したURLが翌日のCIで
 * 蘇る（2026-09-20 に Hot Pepper 由来店へ対象を広げた際に判明）。
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
const { buildPlacesAddressIndex, normalizeJpAddress } = require('./lib/store_link_identity');

const ROOT = path.resolve(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'data', 'store_link_identity_checked.json');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const STORES_JSON_PATH = path.join(ROOT, 'data', 'stores.json');
const STORES_DIR = path.join(ROOT, 'stores');
const TABELOG_CACHE_PATH = path.join(ROOT, 'data', 'tabelog_resolved.json');

const dryRun = process.argv.includes('--dry-run');

function loadTargets() {
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const addressIndex = buildPlacesAddressIndex(ROOT);
  const targets = [];
  for (const c of Object.values(cache)) {
    if (c.kind !== 'tabelog') continue;
    if (c.ok !== false) continue;
    // name-mismatch: リンク先が別店（sim=0のみ・閾値ぎりぎりのものは対象外）
    // confirmed-404: リンク先ページ自体が存在しない（HTTP 404 を実地確認済み）
    const isNameMismatch = c.reason === 'name-mismatch' && (c.sim || 0) === 0;
    const isConfirmed404 = c.reason === 'confirmed-404';
    // address-mismatch: 名前が一致しない**うえに**、我々が Google Places で持つ住所と
    // リンク先ページの住所（JSON-LD）が食い違う＝別の建物を指している。
    // sim の大小より強い証拠なので、sim>0 でも対象にする（2026-09-20 の全件検証では
    // name-mismatch 873件のうち 770件がこれに該当した）。住所がどちらか取れない場合は
    // 何も主張できないので対象外＝人の確認に残す（品質ゲート原則: 検証できる事実だけ）。
    const ourAddress = normalizeJpAddress(addressIndex.get(c.storeName) || '');
    const theirAddress = c.matchedAddress || '';
    const isAddressMismatch = c.reason === 'name-mismatch'
      && !!ourAddress && !!theirAddress && ourAddress !== theirAddress;
    if (!isNameMismatch && !isConfirmed404 && !isAddressMismatch) continue;
    targets.push({
      storeName: c.storeName,
      url: c.url,
      why: isConfirmed404 ? '404' : (isAddressMismatch ? `住所違い(${ourAddress}≠${theirAddress})` : '店名の痕跡なし'),
    });
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

/**
 * 解決キャッシュ（data/tabelog_resolved.json）からも取り除く。
 *
 * これを忘れると**消したURLが翌日の build.js で蘇る**。build.js は
 * 「食べログURLが空の店」をこのキャッシュで埋め戻す設計のため
 * （build.js の「キャッシュからInstagram/食べログURLをマージ」）、
 * stores.json だけを空にしても次のCIで元に戻ってしまう。
 * エントリは消さずに failed 印と消した理由・消した元URLを残す
 * （後から第三者が「なぜ空欄なのか」を検算できるようにするため・制約10）。
 */
function patchTabelogResolvedCache(targets) {
  if (!fs.existsSync(TABELOG_CACHE_PATH)) return 0;
  const cache = JSON.parse(fs.readFileSync(TABELOG_CACHE_PATH, 'utf8'));
  const byUrl = new Set(targets.map((t) => t.url));
  let n = 0;
  for (const [id, entry] of Object.entries(cache)) {
    if (!entry || !entry.tabelog || !byUrl.has(entry.tabelog)) continue;
    cache[id] = {
      store: entry.store,
      failed: true,
      failedBy: 'tabelog',
      clearedBy: 'identity-audit',
      clearedReason: '実地検証でリンク先が別店（sim=0）または404だったため空欄化',
      previousUrl: entry.tabelog,
      resolvedAt: new Date().toISOString(),
    };
    n++;
  }
  if (!dryRun && n) fs.writeFileSync(TABELOG_CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  return n;
}

function main() {
  const targets = loadTargets();
  console.log(`対象URL: ${targets.length}件${dryRun ? ' (--dry-run)' : ''}`);
  targets.forEach((t) => console.log(`  - ${t.storeName}: ${t.url}${t.why ? ` — ${t.why}` : ''}`));
  console.log('');

  const n1 = patchManualStores(targets);
  console.log(`data/manual_stores.json: ${n1}件クリア`);

  const n2 = patchStoresJson(targets);
  console.log(`data/stores.json: ${n2}件クリア`);

  const n3 = patchStoreHtmlFiles(targets);
  console.log(`stores/*.html: ${n3}ファイル修正`);

  const n4 = patchTabelogResolvedCache(targets);
  console.log(`data/tabelog_resolved.json: ${n4}件を failed 化（再埋め戻しの防止）`);

  if (dryRun) console.log('\n--dry-run のため実際の書き換えはしていません');
}

main();
