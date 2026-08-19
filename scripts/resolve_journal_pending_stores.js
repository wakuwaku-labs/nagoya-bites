#!/usr/bin/env node
'use strict';
/**
 * resolve_journal_pending_stores.js  (SEO-056 acceptance 3)
 *
 * data/journal_published.json の pending_store_keys（"店名|エリアヒント" 形式・
 * LOCAL_STORES 未突合のまま残っている店）を、data/stores.json と再突合して
 * store_ids を埋める。埋まらない分は放置してよいが、件数をログに出し
 * 「何本が未解決か」を後から検算できる状態にする（制約10）。
 *
 * マッチ判定は photo_policy.js と同じ bigram Dice 実装を使うが、**一般語除去（core()）はしない**。
 * core() は「わさびの店｜川名店」のような表記ゆれ吸収を狙って `[^\s]{1,6}店` 等の
 * 一般語を丸ごと削るため、"酔っ手羽 名駅3丁目店" と "酔っ手羽 名駅椿町店"（別店舗）のような
 * **チェーン店の支店違いまで同一店として一致してしまう**（実測: dice=1.00 の誤爆3件を検出・
 * 一風堂/ミリネヤンコプチャン等も同様）。本用途は「別店舗の記事に別店舗のURLを貼る」誤りが
 * 実在保証Moatを直接損なうため、正規化のみ（NFKC・空白統一）に留めた素の名前で閾値0.85を取る。
 * 閾値自体は fetch_manual_store_photos.js / photo_policy.js と同じ 0.85 を踏襲する。
 *
 * 使い方:
 *   node scripts/resolve_journal_pending_stores.js            # 実行して published.json を更新
 *   node scripts/resolve_journal_pending_stores.js --dry-run  # 書き込まず結果だけ表示
 */

const fs = require('fs');
const path = require('path');
const { dice, norm } = require('./lib/photo_policy');

const ROOT = path.join(__dirname, '..');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const STORES = path.join(ROOT, 'data', 'stores.json');

const NAME_THRESHOLD = 0.85;

function loadStores() {
  const raw = JSON.parse(fs.readFileSync(STORES, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.stores || []);
}

function findMatch(pendingKey, stores) {
  const [nameRaw, areaHint] = String(pendingKey).split('|');
  const name = (nameRaw || '').trim();
  if (!name) return null;
  const nameNorm = norm(name);

  let candidates = stores
    .map((s) => ({ s, score: dice(nameNorm, norm(s['店名'] || '')) }))
    .filter((c) => c.score >= NAME_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].s;

  // 同名候補が複数あるときはエリアヒントで絞る（曖昧なら最上位スコアを採用）
  if (areaHint) {
    const areaNorm = norm(areaHint.trim());
    const withArea = candidates.filter((c) => {
      const storeArea = norm(c.s['エリア'] || '') + norm(c.s['住所'] || '');
      return areaNorm && storeArea.includes(areaNorm.slice(0, 4));
    });
    if (withArea.length >= 1) return withArea[0].s;
  }
  return candidates[0].s;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const data = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const stores = loadStores();

  let resolved = 0;
  let unresolved = 0;
  const unresolvedList = [];

  for (const entry of data.entries) {
    const pending = entry.pending_store_keys || [];
    if (pending.length === 0) continue;

    const stillPending = [];
    for (const key of pending) {
      const match = findMatch(key, stores);
      const hpId = match && match['ホットペッパーID'];
      if (hpId) {
        entry.store_ids = entry.store_ids || [];
        if (!entry.store_ids.includes(hpId)) entry.store_ids.push(hpId);
        resolved++;
      } else {
        stillPending.push(key);
        unresolved++;
        unresolvedList.push({ slug: entry.slug, key });
      }
    }
    entry.pending_store_keys = stillPending;
  }

  console.log(`resolve_journal_pending_stores: 解決=${resolved} / 未解決=${unresolved}`);
  if (unresolvedList.length) {
    console.log('未解決一覧（LOCAL_STORES に一致店が見つからなかった）:');
    unresolvedList.forEach((u) => console.log(`  - ${u.slug}: ${u.key}`));
  }

  if (!dryRun && resolved > 0) {
    fs.writeFileSync(PUBLISHED, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`data/journal_published.json を更新しました（${resolved}件のstore_idsを追記）`);
  } else if (dryRun) {
    console.log('(--dry-run のため書き込みなし)');
  }
}

main();
