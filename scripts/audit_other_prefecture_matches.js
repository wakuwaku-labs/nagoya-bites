#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_other_prefecture_matches.js
 *
 * ISSUE-103 の再発防止監査。scripts/fetch_places.js が住所不一致で却下した候補
 * （data/places_resolved.json の rejected:true）のうち、候補住所が愛知県外の
 * 都道府県を指しているものを検出する。
 *
 * 背景: 2026-08-20、71件の他都市チェーン店舗（大阪・神奈川・北海道・沖縄等）が
 * 「栄」エリア・愛知県の名古屋店として誤登録されていたことが発覚した（ISSUE-103）。
 * fetch_places.js の validateAddress() 自体は正しく却下していたが、却下ログを
 * 誰も定期的に見ていなかったため、8.7%の店が「口コミ信頼度 —」になるまで気づけなかった。
 * このスクリプトは、その却下ログを毎回自動集計し、未対応（data/closed_stores.json 未登録）の
 * 他都道府県マッチが残っていないかを CI で検知する（品質ゲート原則3: 検知とは人が何もしなくても届くこと）。
 *
 * 判定は検証できる事実だけを使う（CLAUDE.md 制約10）:
 *   - candidateAddress（Google Places が返した実際の住所文字列。地の文の都道府県名）
 *   - data/closed_stores.json のホットペッパーID登録の有無（対応済みかどうか）
 *
 * 使い方:
 *   node scripts/audit_other_prefecture_matches.js            # レポート出力（未対応があれば exit 1）
 *   node scripts/audit_other_prefecture_matches.js --check     # CI向け。上と同じだが件数のみの短い出力
 *   node scripts/audit_other_prefecture_matches.js --json      # /tmp/other_prefecture_audit.json に書き出し
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PREF_RE = /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function main() {
  const argv = process.argv.slice(2);
  const checkMode = argv.includes('--check');
  const toJson = argv.includes('--json');

  const places = loadJson('data/places_resolved.json') || {};
  const closedRaw = loadJson('data/closed_stores.json') || { stores: [] };
  const closedHpIds = new Set(
    (closedRaw.stores || []).map((c) => c['ホットペッパーID']).filter(Boolean)
  );
  const exceptionsRaw = loadJson('data/other_prefecture_match_exceptions.json') || { exceptions: [] };
  const exceptionHpIds = new Set(
    (exceptionsRaw.exceptions || []).map((c) => c['ホットペッパーID']).filter(Boolean)
  );

  const rejectedIds = Object.keys(places).filter((k) => places[k] && places[k].rejected);

  const rows = [];
  for (const id of rejectedIds) {
    const r = places[id];
    const addr = r.candidateAddress || '';
    const m = addr.match(PREF_RE);
    const pref = m ? m[1] : '不明';
    if (pref === '愛知県' || pref === '不明') continue; // 愛知県内の郊外店・住所不明は別チケット扱い（ISSUE-103 acceptance 5）
    rows.push({
      hotpepperId: id,
      pref,
      candidateName: r.candidateName || '',
      candidateAddress: addr,
      alreadyExcluded: closedHpIds.has(id) || exceptionHpIds.has(id),
    });
  }

  const unresolved = rows.filter((r) => !r.alreadyExcluded);

  if (toJson) {
    fs.writeFileSync('/tmp/other_prefecture_audit.json', JSON.stringify(rows, null, 2));
  }

  console.log(`他都道府県マッチ却下ログ: 総数=${rows.length} / 除外済み(closed_stores.json)=${rows.length - unresolved.length} / 未対応=${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log('\n未対応の他都道府県マッチ（実在検証のうえ data/closed_stores.json への登録 or 削除判断が必要）:');
    for (const r of unresolved.slice(0, 30)) {
      console.log(`  - [${r.hotpepperId}] ${r.candidateName} — 候補住所: ${r.candidateAddress}`);
    }
    if (unresolved.length > 30) console.log(`  ...他 ${unresolved.length - 30} 件`);
  }

  if (!checkMode) {
    console.log(`\n判定対象: data/places_resolved.json の rejected エントリ ${rejectedIds.length} 件中、`);
    console.log('候補住所が愛知県外を指すもの（住所不明・愛知県内郊外は対象外）。');
  }

  if (unresolved.length > 0) {
    console.error(`\n[FAIL] 未対応の他都道府県マッチが ${unresolved.length} 件あります。実在検証のうえ data/closed_stores.json に登録してください（ISSUE-103 と同じ手順）。`);
    process.exit(1);
  }

  console.log('[OK] 未対応の他都道府県マッチはありません。');
  process.exit(0);
}

main();
