#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_store_liveness.js
 *
 * 掲載店の「営業実体」を退行検知する監査。CLAUDE.md「実在検証ゲート / 架空店ブロック」と
 * 制約7（信頼毀損の禁止）に対応。閉店・掲載保留・移転消滅した店が LOCAL_STORES /
 * data/stores.json に紛れ込むのを CI で都度検出する。2026-06-11「餃子歩兵 名古屋泉店
 * （2023-09-30閉店）」混入の再発防止として新設。
 *
 * 判定ソース（すべてオフライン・ネット不要）:
 *   1. data/closed_stores.json … 一次情報で閉店確認した店の永久除外リスト（最優先・HARD）
 *   2. data/places_resolved.json … Google Places の business_status
 *        - CLOSED_PERMANENTLY  → HARD（掲載してはならない）
 *        - CLOSED_TEMPORARILY  → WARN（再開しうるため警告のみ）
 *   3. テキスト走査 … おすすめポイント/備考/コメントの閉店ワード
 *        - 「閉店済み」「掲載保留」「閉業」「営業終了」 → HARD（自社データが閉店と明記）
 *        - 「移転」 → WARN（店は存続。住所が陳腐化している可能性）
 *
 * 使い方:
 *   node scripts/audit_store_liveness.js            # レポート出力（違反あれば exit 1）
 *   node scripts/audit_store_liveness.js --warn-only  # 常に exit 0（観測のみ）
 *   node scripts/audit_store_liveness.js --json       # /tmp/liveness_audit.json に書き出し
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { loadStores } = require('./lib/load_stores');

const nrm = (v) => String(v || '').normalize('NFKC').replace(/[\s　]/g, '').toLowerCase();
const tabelogId = (s) => {
  const m = String(s['食べログURL'] || '').match(/(\d{6,})\/?$/);
  return m ? m[1] : '';
};

// 「閉店」を含むが実際は閉店でない文脈を除外するためのHARDワードは断定形のみに絞る。
// 単独の「閉店」（例: 「2024年8月の閉店を経て…復活オープン」）は誤検出になるためWARN扱い。
const HARD_TEXT = /閉店済|掲載保留|閉業|営業終了|閉館|廃業/;
const WARN_TEXT = /移転|一時休業|休業中/;
const TEXT_FIELDS = ['おすすめポイント', '備考', 'コメント', '話題コメント', '営業状況', '営業ステータス'];

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function main() {
  const argv = process.argv.slice(2);
  const warnOnly = argv.includes('--warn-only');
  const toJson = argv.includes('--json');

  const stores = loadStores();
  const places = loadJson('data/places_resolved.json') || {};
  const closedRaw = loadJson('data/closed_stores.json') || { stores: [] };
  const closedList = (closedRaw.stores || []).filter(c => c && c['店名']);

  // インライン LOCAL_STORES（ユーザーが最初に見る TOP50）を別途把握し、深刻度を上げる
  let inlineNames = new Set();
  try {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
    if (m) inlineNames = new Set(JSON.parse(m[1]).map(s => nrm(s['店名'])));
  } catch (e) { /* noop */ }

  const hard = []; // 掲載してはならない（exit 1）
  const warn = []; // 要確認（非ブロッキング）

  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    const inInline = inlineNames.has(nrm(s['店名']));
    const where = `idx${i}${i < 50 ? ' TOP50' : ''}${inInline ? ' INLINE' : ''}`;

    // 1. 閉店リスト照合（最優先）
    const closedHit = closedList.find(c => {
      if (c['ホットペッパーID'] && s['ホットペッパーID'] && c['ホットペッパーID'] === s['ホットペッパーID']) return true;
      if (c['食べログID'] && tabelogId(s) && c['食べログID'] === tabelogId(s)) return true;
      if (nrm(c['店名']) && nrm(c['店名']) === nrm(s['店名'])) {
        if (c['エリア']) return nrm(c['エリア']) === nrm(s['エリア']);
        return true;
      }
      return false;
    });
    if (closedHit) {
      hard.push({ where, 店名: s['店名'], エリア: s['エリア'], 種別: '閉店リスト', 詳細: closedHit['理由'] || '' });
      continue;
    }

    // 2. Places business_status
    const id = s['ホットペッパーID'];
    const pe = id && places[id];
    const st = pe && pe.business_status;
    if (st === 'CLOSED_PERMANENTLY') {
      hard.push({ where, 店名: s['店名'], エリア: s['エリア'], 種別: 'Places閉店', 詳細: 'CLOSED_PERMANENTLY' });
      continue;
    }
    if (st === 'CLOSED_TEMPORARILY') {
      warn.push({ where, 店名: s['店名'], エリア: s['エリア'], 種別: 'Places一時休業', 詳細: 'CLOSED_TEMPORARILY' });
    }

    // 3. テキスト走査
    const blob = TEXT_FIELDS.map(k => s[k]).filter(Boolean).join(' ');
    if (HARD_TEXT.test(blob)) {
      hard.push({ where, 店名: s['店名'], エリア: s['エリア'], 種別: '閉店ワード', 詳細: (blob.match(HARD_TEXT) || [])[0] });
    } else if (WARN_TEXT.test(blob)) {
      warn.push({ where, 店名: s['店名'], エリア: s['エリア'], 種別: '移転/休業ワード', 詳細: (blob.match(WARN_TEXT) || [])[0] });
    }
  }

  console.log(`営業実体監査: 全${stores.length}件 / HARD ${hard.length}件 / WARN ${warn.length}件 / 閉店リスト ${closedList.length}件登録`);
  if (hard.length) {
    console.log('\n── HARD（掲載不可・要除外） ──');
    hard.forEach(h => console.log(`  ❌ [${h.where}] ${h.店名}（${h.エリア || ''}）: ${h.種別} — ${h.詳細}`));
  }
  if (warn.length) {
    console.log('\n── WARN（要確認・非ブロッキング） ──');
    warn.slice(0, 50).forEach(w => console.log(`  ⚠️  [${w.where}] ${w.店名}（${w.エリア || ''}）: ${w.種別} — ${w.詳細}`));
    if (warn.length > 50) console.log(`  …他 ${warn.length - 50}件`);
  }

  if (toJson) {
    fs.writeFileSync('/tmp/liveness_audit.json', JSON.stringify({ hard, warn }, null, 2), 'utf8');
    console.log('\n→ /tmp/liveness_audit.json に書き出しました');
  }

  if (hard.length && !warnOnly) {
    console.error(`\n[FAIL] 閉店/掲載保留が確定した店が ${hard.length}件 掲載されています。data/closed_stores.json への登録 or データ除去で解消してください。`);
    process.exit(1);
  }
  console.log('\n[OK] 掲載不可の閉店店は検出されませんでした。');
}

main();
