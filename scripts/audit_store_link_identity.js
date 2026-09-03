#!/usr/bin/env node
/**
 * data/manual_stores.json の外部リンク（食べログURL / ホットペッパーID）が、
 * 実際にその店のページを指しているかを実地検証する。
 *
 * 既存の scripts/audit_manual_stores_links.js は URL の「形式」（個別店舗ページの
 * 形をしているか）だけを静的にチェックしており、「形式は正しいが実際には別の店
 * （閉店店舗を含む）を指すURL」は検出できなかった。判定器は scripts/lib/
 * store_link_identity.js の1本（実際にURLを fetch し、ページの店名と我々の店名を
 * scripts/lib/store_name_match.js の namesMatch() で突き合わせる）。
 *
 * 使い方:
 *   node scripts/audit_store_link_identity.js                 # 未検証/期限切れ分のみ検証
 *   node scripts/audit_store_link_identity.js --limit 20       # 動作確認用（先頭20件）
 *   node scripts/audit_store_link_identity.js --store "サラマンジェ"  # 店名部分一致で1店のみ
 *   node scripts/audit_store_link_identity.js --force          # キャッシュ無視で全件再検証
 *   node scripts/audit_store_link_identity.js --check          # 不一致があれば exit 1（CI向け）
 *
 * キャッシュ（data/store_link_identity_checked.json）:
 *   一度 ok:true と確認できたURLは MAX_AGE_DAYS の間は再検証をスキップする
 *   （食べログ/ホットペッパーへの外部アクセス回数を抑えるため）。ok:false だった
 *   ものは毎回レポートに出す（キャッシュが「まだ直っていない不一致」を握りつぶさない）。
 *   店舗数が多いため既定では1回の実行で全件は検証しない（--limit の既定値）。
 *   複数回実行すれば「未検証のものから」順に消化され、いずれ全件をカバーする。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { checkTabelogUrl, checkHotpepperId } = require('./lib/store_link_identity');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const CACHE_PATH = path.join(ROOT, 'data', 'store_link_identity_checked.json');
const REPORT_PATH = path.join(ROOT, 'data', 'store_link_identity_report.json');

const MAX_AGE_DAYS = 60;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const opts = { limit: 40, force: false, store: null, delayMs: 4000, jitterMs: 2000, check: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
  else if (a === '--check') opts.check = true;
  else if (a === '--all') opts.limit = Infinity;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function classifyTabelogFormat(url) {
  if (!url || !url.trim()) return 'missing';
  if (/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{5,}\/?$/i.test(url)) return 'direct';
  return 'other';
}

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function cacheKey(kind, url, storeName) {
  return crypto.createHash('md5').update(`${kind}|${url}|${storeName}`).digest('hex');
}

async function main() {
  const raw = loadJson(MANUAL_PATH, { stores: [] });
  const stores = Array.isArray(raw.stores) ? raw.stores : [];
  const cache = loadJson(CACHE_PATH, {});

  let targets = [];
  for (const s of stores) {
    const name = s['店名'] || '';
    if (opts.store && !name.includes(opts.store)) continue;
    const area = s['エリア'] || '';
    if (classifyTabelogFormat(s['食べログURL']) === 'direct') {
      targets.push({ kind: 'tabelog', url: s['食べログURL'], storeName: name, area });
    }
    if (s['ホットペッパーID'] && s['ホットペッパーID'].trim()) {
      targets.push({ kind: 'hotpepper', id: s['ホットペッパーID'].trim(), storeName: name, area });
    }
  }

  console.log(`=== 外部リンク実地検証 (対象候補 ${targets.length}件) ===`);

  let checkedCount = 0;
  let skippedFresh = 0;
  const now = Date.now();

  for (const t of targets) {
    const url = t.kind === 'tabelog' ? t.url : `https://www.hotpepper.jp/str${t.id}/`;
    const key = cacheKey(t.kind, url, t.storeName);
    const cached = cache[key];
    const fresh = cached && (now - new Date(cached.checkedAt).getTime()) < MAX_AGE_MS;

    if (!opts.force && fresh && cached.ok) {
      skippedFresh++;
      continue;
    }
    if (checkedCount >= opts.limit) continue;

    let result;
    if (t.kind === 'tabelog') {
      result = await checkTabelogUrl(t.url, t.storeName);
    } else {
      result = await checkHotpepperId(t.id, t.storeName);
    }
    cache[key] = { ...result, kind: t.kind, area: t.area, checkedAt: new Date().toISOString() };
    checkedCount++;

    const mark = result.ok ? '✅' : '❌';
    console.log(`${mark} [${t.kind}] ${t.storeName} (${t.area}) — ${result.ok ? `一致 (sim=${result.sim})` : `${result.reason}${result.matchedName ? ` 「${result.matchedName}」` : ''}${result.error ? `: ${result.error}` : ''}`}`);

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    if (checkedCount < opts.limit && targets.indexOf(t) < targets.length - 1) {
      await sleep(opts.delayMs + Math.floor(Math.random() * opts.jitterMs));
    }
  }

  console.log('');
  console.log(`検証実行: ${checkedCount}件 / スキップ(直近${MAX_AGE_DAYS}日以内に一致確認済み): ${skippedFresh}件 / 未検証(次回持ち越し): ${Math.max(targets.length - checkedCount - skippedFresh, 0)}件`);

  // レポート: キャッシュ全体から現時点の不一致を集計（今回検証していない過去の不一致も含む）
  const mismatches = [];
  for (const t of targets) {
    const url = t.kind === 'tabelog' ? t.url : `https://www.hotpepper.jp/str${t.id}/`;
    const key = cacheKey(t.kind, url, t.storeName);
    const cached = cache[key];
    if (cached && cached.ok === false) {
      mismatches.push({
        店名: t.storeName,
        エリア: t.area,
        種別: t.kind,
        url,
        理由: cached.reason,
        検出タイトル: cached.matchedName || cached.title || null,
        検証日: cached.checkedAt,
      });
    }
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), mismatches }, null, 2));

  console.log('');
  if (mismatches.length) {
    console.log(`❌ 不一致 ${mismatches.length}件（別の店 or 閉店店舗を指している可能性・要手動修正）:`);
    mismatches.forEach((m) => console.log(`  - ${m.店名} (${m.エリア}) [${m.種別}] ${m.url} — ${m.理由}${m.検出タイトル ? ` 「${m.検出タイトル}」` : ''}`));
    console.log('');
    console.log(`詳細: ${path.relative(ROOT, REPORT_PATH)}`);
    if (opts.check) process.exit(1);
  } else {
    console.log('✅ 検証済みの範囲で不一致は見つかりませんでした');
  }
}

main().catch((e) => {
  console.error('致命的エラー:', e);
  process.exit(1);
});
