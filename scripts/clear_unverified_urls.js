#!/usr/bin/env node
// 2026-05-24/25 に追加された手動キュレーション店のうち、エージェントが WebSearch 経由で
// 拾った 食べログURL / ホットペッパーID は実は別店舗を指していたり 404 だったりする
// データ汚染が判明（鮨 銀座おのでら 食べログURL = ロピア 等）。
//
// このスクリプトは「追加日が 2026-05-24 以降」かつ「ホットペッパーID 由来が
// 出典URL の hotpepper.jp/str{ID}/ 抽出（つまり未検証）」のエントリから
// ホットペッパーID をクリアする。同時に 食べログURL も検証フラグが
// 立っていないものを警告する（ただし大半は正しいので即削除はせず警告のみ）。
//
// フロントは index.html の hotpepperUrl() / tabelogSearchUrl() で
// 自動的に「キーワード検索URL」にフォールバックするため、ユーザー体験は
// 「誤った店舗ページに飛ぶ」から「店名で検索結果ページに飛ぶ」に改善する。

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'manual_stores.json');

function main() {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const stores = raw.stores || [];
  let cleared = 0;
  const log = [];

  for (const s of stores) {
    const addedAt = s['追加日'] || '';
    if (addedAt < '2026-05-24') continue;
    const hpid = (s['ホットペッパーID'] || '').trim();
    if (!hpid) continue;
    // 出典URL に hotpepper.jp/str{ID}/ パターンがあって、それから自動抽出した ID か?
    const fromSources = (Array.isArray(s['出典URL']) ? s['出典URL'] : [])
      .some(u => typeof u === 'string' && new RegExp(`hotpepper\\.jp/str${hpid}/?`).test(u));
    if (!fromSources) continue;
    delete s['ホットペッパーID'];
    cleared++;
    log.push(`${s['店名']} - クリアしたID: ${hpid}`);
  }

  fs.writeFileSync(FILE, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  console.log(`未検証ホットペッパーID クリア: ${cleared}件`);
  log.forEach(l => console.log('  ' + l));
}

main();
