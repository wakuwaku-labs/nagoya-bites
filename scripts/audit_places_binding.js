#!/usr/bin/env node
'use strict';

/**
 * Google Places の紐付け（data/places_resolved.json）が別の店を指していないかの監査（P-142 / ISSUE-147）。
 *
 * build.js が適用する紐付け（rejected・notFound・error 以外）のうち、今の店名ゲート
 * （namesMatch + branchConflict・fetch_places.js と同じ判定）を通らないものを、
 * 一致率の帯ごとに数える。判定はすべて検証できる事実だけ（制約10）:
 *   - 掲載の店名／住所（data/stores.json・HotPepper の掲載住所）
 *   - places_resolved に残る Google 側の名前・住所
 * 外部へは一切問い合わせない（Google Maps / Places の API は呼ばない）。
 *
 * 帯: branch-conflict（支店名の食い違い）→ sim=0 → sim<0.3 → 0.3〜0.6 → 0.6以上
 * 住所の判定（compareJpAddress）: same / different / unknown
 *
 * 紐付けを外す（rejected）のは一致率 0.3 未満で、(a) 住所が別の場所（different）、または
 * (b) 住所は同じ建物だが屋号に共通する文字が無く英字⇔カナの読み違いでもない候補のうち、
 *     人が 1 件ずつ確かめて data/places_binding_reviewed.json に decision=reject と根拠を書いたもの、だけ。
 * それ以外は外さず「決められない」のまま残す（推測で外さない）。
 *
 *   node scripts/audit_places_binding.js              # 帯ごとの件数
 *   node scripts/audit_places_binding.js --json       # 1件ごとの一覧
 *   node scripts/audit_places_binding.js --check      # 外すべき紐付けが残っていれば exit 1
 *   node scripts/audit_places_binding.js --apply      # 外すべき紐付けを rejected にして書き戻す
 *   node scripts/audit_places_binding.js --impact     # 外す前後の口コミ信頼度の段階の分布（再計算・書き込みなし）
 *   node scripts/audit_places_binding.js --states [--json] [--check]   # 紐付けの状態（scripts/lib/place_binding.js）ごとの店の数と、
 *                                                           # 電話・評価・口コミ信頼度・地図リンクの place_id がどの状態の紐付けを使っているか（MEO-003）
 *                                                           # --check: 設定が許していない状態で出している店があれば exit 1（夜間 QA・MEO-005）
 *   node scripts/audit_places_binding.js --sample 30 [--seed N]  # 帯ごとに N 組を無作為に選ぶ（標本の確かめ・MEO-003 の A2）
 */

const fs = require('fs');
const path = require('path');
const { namesMatch, branchConflict, norm } = require('./lib/store_name_match');
const { compareJpAddress } = require('./lib/store_link_identity');
const { placesKey } = require('./lib/places_key');

const ROOT = path.resolve(__dirname, '..');
const PLACES_PATH = path.join(ROOT, 'data', 'places_resolved.json');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const REVIEWED_PATH = path.join(ROOT, 'data', 'places_binding_reviewed.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'places_history.json');
const REJECT_REASON = 'name-mismatch-audit';

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

/** 2つの名前に共通する最長の連続部分文字列の長さ（norm 後・文字単位） */
function longestCommon(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/** 英字表記 ↔ カナ表記の可能性（片方に英字、もう片方にカナ）。読みの違いで同じ店のことがあるので外さない */
function maybeTransliteration(a, b) {
  const latin = (x) => /[A-Za-z]/.test(x);
  const kana = (x) => /[ぁ-ゟ゠-ヿ]/.test(x);
  return (latin(a) && kana(b)) || (latin(b) && kana(a));
}

function bandOf(r) {
  if (r.branchConflict) return 'branch-conflict';
  if (r.sim === 0) return 'sim-0';
  if (r.sim < 0.3) return 'sim-lt-0.3';
  if (r.sim < 0.6) return 'sim-0.3-0.6';
  return 'sim-ge-0.6';
}
const BANDS = ['sim-0', 'sim-lt-0.3', 'sim-0.3-0.6', 'sim-ge-0.6', 'branch-conflict'];

/** build.js が適用する紐付けだけを対象に、今のゲートで照合する */
function audit(stores, places, reviewed) {
  const rows = [];
  const reviewedBy = new Map(((reviewed && reviewed.entries) || []).map(e => [e.key + '\u0000' + e.googleName, e]));
  for (const s of stores) {
    if (!s['店名']) continue;
    const key = placesKey(s);
    const e = places[key];
    if (!e || e.notFound || e.error || e.rejected || !e.name) continue;
    const nm = namesMatch(s['店名'], e.name);
    const bc = !!branchConflict(s['店名'], e.name);
    if (nm.ok && !bc) continue;
    // Google 側の住所が標準の形（〒が付く）でないものは住所の比較に使わない（例:「メゾン神宮 103号, ４丁目-１-21 神宮 熱田区」は
    // 並びが逆で、同じ場所でも different と出る）。決められないままにする
    const addr = (s['住所'] && e.formatted_address && /〒\d{3}-\d{4}/.test(e.formatted_address))
      ? compareJpAddress(s['住所'], e.formatted_address) : { verdict: 'unknown', reason: 'no-address' };
    const r = {
      key, store: s['店名'], storeAddress: s['住所'] || '',
      googleName: e.name, googleAddress: e.formatted_address || '', placeId: e.placeId || '',
      fetchedAt: e.fetchedAt || '', sim: nm.sim, nameOk: nm.ok, branchConflict: bc,
      addressVerdict: addr.verdict, addressReason: addr.reason
    };
    r.band = bandOf(r);
    const low = r.band === 'sim-0' || r.band === 'sim-lt-0.3';
    // 外す（どちらも第三者が掲載住所と Google の記録を見て確かめられる事実）:
    //  address-different … 掲載の住所と Google の住所が別の場所（compareJpAddress が different）
    //  same-building-no-shared-name … 住所は同じ建物だが、屋号に共通する文字が1つも無く（sim=0・
    //    共通部分文字列0）、英字⇔カナの読み違いでもない（入れ替わり・同じ建物の別の店）
    // 上記以外（住所が同じで屋号が一部重なる／読み違いの可能性／住所が決められない）は外さず undecided。
    r.longestCommon = longestCommon(norm(r.store), norm(r.googleName));
    if (!low) {
      r.decision = 'out-of-scope';
    } else if (r.addressVerdict === 'different') {
      r.decision = 'reject'; r.rejectBasis = 'address-different';
    } else if (r.addressVerdict === 'same' && r.sim === 0 && r.longestCommon === 0 && !maybeTransliteration(r.store, r.googleName)) {
      // 機械が決めるのは候補までで、外すかどうかは 1 件ずつ人が確かめた記録（reviewed）に従う。
      // 漢字の読み・字体の違い（清平⇔きよひら など）は機械では見分けられないため
      const rv = reviewedBy.get(r.key + '\u0000' + r.googleName);
      r.reviewed = rv ? rv.decision : null;
      if (rv && rv.decision === 'reject') { r.decision = 'reject'; r.rejectBasis = 'same-building-reviewed'; r.reviewReason = rv.reason; }
      else r.decision = 'undecided';
    } else {
      r.decision = 'undecided';
    }
    rows.push(r);
  }
  return rows;
}

function summarize(rows) {
  const out = {};
  for (const b of BANDS) out[b] = { total: 0, same: 0, different: 0, unknown: 0 };
  for (const r of rows) { const o = out[r.band]; o.total++; o[r.addressVerdict]++; }
  return out;
}

function applyRejects(rows, places) {
  const now = new Date().toISOString();
  let n = 0;
  for (const r of rows) {
    if (r.decision !== 'reject') continue;
    places[r.key] = {
      fetchedAt: now,
      rejected: true,
      rejectReason: REJECT_REASON,
      candidateName: r.googleName,
      candidateAddress: r.googleAddress,
      previousPlaceId: r.placeId,
      auditEvidence: { basis: r.rejectBasis, reason: r.reviewReason || undefined, storeName: r.store, storeAddress: r.storeAddress, sim: r.sim, addressVerdict: r.addressVerdict, addressReason: r.addressReason }
    };
    n++;
  }
  return n;
}

/** 外す前後の口コミ信頼度の段階。build.js の算出と同じ部品で再計算する（書き込みなし） */
function impact(stores, rows) {
  const { computeCrossCheckScore } = require('./lib/cross_check_v22');
  const { buildFingerprintIndex, evaluateStoreFingerprint } = require('./lib/review_fingerprint');
  const td = require('./lib/trust_display');
  const history = readJson(HISTORY_PATH);
  const rejectKeys = new Set(rows.filter(r => r.decision === 'reject').map(r => r.key));
  const fpIndex = buildFingerprintIndex(history);
  const date = new Date().toISOString().slice(0, 10);
  function run(afterReject) {
    const dist = {}; let googleShown = 0;
    for (const orig of stores) {
      const s = { ...orig };
      const key = s['店名'] ? placesKey(s) : '';
      const drop = afterReject && rejectKeys.has(key);
      if (drop) { s['Google評価'] = ''; s['口コミ数'] = ''; s['placeId'] = ''; }
      // 外した店は別の店の履歴（口コミの時系列・指紋）も使わない（build.js と同じ扱い）
      const he = (!drop && key && history[key]) ? history[key] : null;
      const fp = key ? evaluateStoreFingerprint(key, he, fpIndex) : null;
      const res = computeCrossCheckScore(s, he, fp);
      const t = td.evaluate(s, res, { lastChecked: td.lastCheckedFrom(he, date) });
      dist[t.tier] = (dist[t.tier] || 0) + 1;
      if (s['Google評価'] && parseFloat(s['Google評価']) > 0) googleShown++;
    }
    return { dist, googleShown };
  }
  return { rejected: rejectKeys.size, before: run(false), after: run(true) };
}

/** Google の評価を画面に出している店か（index.html・gen-store-pages.js と同じく、正の数のときだけ出る） */
function showsRating(s) { return !!(s['Google評価'] && parseFloat(s['Google評価']) > 0); }
/** 口コミ信頼度の段階が付いている店か（「—」は判定材料不足で、段階は出ない） */
function showsTrust(s) { return !!(s.reviewTrust && s.reviewTrust.t && s.reviewTrust.t !== '—'); }

/** 状態の内訳の名前（状態 → 帯か理由） */
function stateLabel(b) {
  if (b.state === 'review') return 'review:' + b.band;
  if (b.state === 'confirmed') return 'confirmed';
  return b.state + ':' + b.reason;
}

/**
 * 紐付けの状態ごとの店の数と、機能ごとにどの状態の紐付けを使っているか（MEO-003 の A1）。
 * 電話は data/stores.json の「電話確認」の欄（build.js が書いたもの）を、評価と口コミ信頼度は表示されている値を数える。
 * @param {Array<object>} stores  data/stores.json
 * @param {object} places  data/places_resolved.json
 * @param {object} [opts]  place_binding.buildContext() に渡す（policy・reviewed）
 * @param {string} [today]  YYYY-MM-DD（取得日の古さを数える基準。省略時は今日）
 */
function states(stores, places, opts, today) {
  const pb = require('./lib/place_binding');
  const { FIELD } = require('./lib/phone_link');
  const ctx = pb.buildContext(stores, places, opts);
  const now = new Date((today || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
  const byState = {};
  const features = { phone: {}, rating: {}, trust: {}, map: {} };
  const MAP_FIELD = require('./lib/map_link').FIELD;
  // 設定（data/place_binding_policy.json）が許していない状態で出している店。build.js の関門と同じ判定（gateFor）で数え直す。
  // ビルドの直後は 0 になるはずなので、0 でなければ関門か欄の書き出しが壊れている（MEO-005 の B3・夜間 QA）
  const violations = { phone: [], rating: [], trust: [], map: [] };
  const noBinding = { rating: 0, trust: 0 };
  let staleRating = 0;
  for (const s of stores) {
    const b = pb.bindingOf(s, ctx);
    const label = stateLabel(b);
    byState[label] = (byState[label] || 0) + 1;
    const note = (f, reason) => violations[f].push({ key: s['ホットペッパーID'] || s['店名'], name: s['店名'], state: label, reason });
    if (s[FIELD]) {
      features.phone[label] = (features.phone[label] || 0) + 1;
      const g = pb.gateFor('phone', b, ctx.policy);
      if (!g.ok) note('phone', g.reason);
    }
    if (s[MAP_FIELD]) {
      features.map[label] = (features.map[label] || 0) + 1;
      const g = pb.gateFor('map', b, ctx.policy);
      if (!g.ok) note('map', g.reason);
    }
    const rating = pb.gateFor('rating', b, ctx.policy);
    if (showsRating(s)) {
      features.rating[label] = (features.rating[label] || 0) + 1;
      const d = s.reviewTrust && s.reviewTrust.d ? new Date(s.reviewTrust.d + 'T00:00:00Z') : null;
      if (d && !isNaN(d) && (now - d) / 864e5 > 90) staleRating++;
      if (!rating.ok) note('rating', rating.reason);
      else if (rating.reason === 'no-binding') noBinding.rating++;
    }
    if (showsTrust(s)) {
      features.trust[label] = (features.trust[label] || 0) + 1;
      const trust = pb.gateFor('trust', b, ctx.policy);
      if (!rating.ok || !trust.ok) note('trust', trust.ok ? rating.reason : trust.reason);
      else if (trust.reason === 'no-binding') noBinding.trust++;
    }
  }
  const notConfirmed = (m) => Object.entries(m).filter(([k]) => k !== 'confirmed').reduce((a, [, v]) => a + v, 0);
  const switches = {};
  for (const f of Object.keys(features)) {
    const c = ctx.policy && ctx.policy.features && ctx.policy.features[f];
    switches[f] = c ? c.show !== false : null;
  }
  return {
    total: stores.length, byState, features,
    notConfirmed: { phone: notConfirmed(features.phone), rating: notConfirmed(features.rating), trust: notConfirmed(features.trust), map: notConfirmed(features.map) },
    violations, noBinding, switches,
    staleRating,
  };
}

/** 決まった種から作る乱数（同じ種なら同じ標本になる。第三者が選び方を再現できるように） */
function seeded(seed) {
  let x = (Number(seed) || 1) % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
}

/** 標本の帯（計画書 6.1 節）: 一致率 0.3 未満・0.3〜0.6・0.6 以上・支店名の食い違い（いずれも要確認）と、店名が合う（確認済み） */
const SAMPLE_BANDS = ['lt-0.3', 'sim-0.3-0.6', 'sim-ge-0.6', 'branch-conflict', 'confirmed'];
function sampleBandOf(b) {
  if (b.state === 'confirmed' && b.reason === 'name-match') return 'confirmed';
  if (b.state !== 'review') return null;
  return (b.band === 'sim-0' || b.band === 'sim-lt-0.3') ? 'lt-0.3' : b.band;
}

/**
 * 帯ごとに n 組を無作為に選ぶ（MEO-003 の A2）。不一致・紐付けなし・人が確かめ済みの組は選ばない。
 * 確かめに要る事実（掲載の店名・住所・ホットペッパーの店舗ページ、Google 側の店名・住所・place_id）を並べて返す。
 */
function sample(stores, places, n, seed, opts) {
  const pb = require('./lib/place_binding');
  const ctx = pb.buildContext(stores, places, opts);
  const pools = Object.fromEntries(SAMPLE_BANDS.map((k) => [k, []]));
  for (const s of stores) {
    const b = pb.bindingOf(s, ctx);
    const band = sampleBandOf(b);
    if (!band) continue;
    const rec = ctx.index.get(s.placeId) || {};
    const hp = s['ホットペッパーID'] || '';
    pools[band].push({
      band, key: placesKey(s), store: s['店名'], storeAddress: s['住所'] || '',
      storeUrl: /^J\d+$/.test(hp) ? `https://www.hotpepper.jp/str${hp}/` : (s['食べログURL'] || s['公式サイト'] || ''),
      googleName: b.googleName, googleAddress: rec.address || '', placeId: s.placeId,
      googleUrl: `https://www.google.com/maps/place/?q=place_id:${s.placeId}`,
      sim: Math.round(b.sim * 100) / 100, addressVerdict: b.addressVerdict || 'unknown',
    });
  }
  const rnd = seeded(seed);
  const out = {};
  for (const k of SAMPLE_BANDS) {
    const pool = pools[k].slice().sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    const picked = [];
    while (picked.length < n && pool.length) picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    out[k] = { poolSize: pools[k].length, picked };
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const stores = readJson(STORES_PATH);
  const places = readJson(PLACES_PATH);
  const reviewed = fs.existsSync(REVIEWED_PATH) ? readJson(REVIEWED_PATH) : null;
  const rows = audit(stores, places, reviewed);
  const toReject = rows.filter(r => r.decision === 'reject');

  if (argv.includes('--apply')) {
    const n = applyRejects(rows, places);
    fs.writeFileSync(PLACES_PATH, JSON.stringify(places, null, 2), 'utf8');
    console.log(`rejected にした紐付け: ${n}件（rejectReason=${REJECT_REASON}）`);
    return;
  }
  if (argv.includes('--states')) {
    const r = states(stores, places);
    const bad = Object.values(r.violations).reduce((a, v) => a + v.length, 0);
    if (argv.includes('--json')) {
      console.log(JSON.stringify(r, null, 2));
      if (argv.includes('--check') && bad > 0) process.exit(1);
      return;
    }
    const keys = Object.keys(r.byState).sort();
    console.log(`店 ${r.total} 件の紐付けの状態（scripts/lib/place_binding.js）と、機能ごとに使っている状態`);
    console.log(`  ${'状態'.padEnd(34)} ${'店数'.padStart(6)} ${'電話'.padStart(6)} ${'評価'.padStart(6)} ${'信頼度'.padStart(6)} ${'地図ID'.padStart(6)}`);
    for (const k of keys) {
      const f = (m) => String(m[k] || 0).padStart(6);
      console.log(`  ${k.padEnd(36)} ${String(r.byState[k]).padStart(6)} ${f(r.features.phone)} ${f(r.features.rating)} ${f(r.features.trust)} ${f(r.features.map)}`);
    }
    console.log(`確認済みでない紐付けで出している店: 電話 ${r.notConfirmed.phone} ／ 評価 ${r.notConfirmed.rating} ／ 口コミ信頼度 ${r.notConfirmed.trust} ／ 地図リンクの place_id ${r.notConfirmed.map}`);
    console.log(`取得日が 90 日より古い Google の評価を出している店: ${r.staleRating}`);
    const sw = (v) => (v === null ? '設定なし' : v ? '出す' : '止めている');
    console.log(`スイッチ（data/place_binding_policy.json）: 電話 ${sw(r.switches.phone)} ／ 評価 ${sw(r.switches.rating)} ／ 口コミ信頼度 ${sw(r.switches.trust)} ／ 地図リンクの place_id ${sw(r.switches.map)}`);
    console.log(`紐付けの無い店で出している（関門の対象外・P-473）: 評価 ${r.noBinding.rating} ／ 口コミ信頼度 ${r.noBinding.trust}`);
    console.log(`設定が許していない状態で出している店: 電話 ${r.violations.phone.length} ／ 評価 ${r.violations.rating.length} ／ 口コミ信頼度 ${r.violations.trust.length} ／ 地図リンクの place_id ${r.violations.map.length}`);
    for (const f of ['phone', 'rating', 'trust', 'map']) {
      for (const v of r.violations[f].slice(0, 5)) console.log(`  ${f}: ${v.name}（${v.key}）状態=${v.state} 理由=${v.reason}`);
    }
    if (argv.includes('--check') && bad > 0) {
      console.error(`設定が許していない状態で出している店が ${bad} 件あります（build.js の関門か欄の書き出しを確かめる）`);
      process.exit(1);
    }
    return;
  }
  const si = argv.indexOf('--sample');
  if (si >= 0) {
    const n = Number(argv[si + 1]) || 30;
    const ei = argv.indexOf('--seed');
    const seed = ei >= 0 ? Number(argv[ei + 1]) : 20261015;
    console.log(JSON.stringify({ seed, n, generatedAt: new Date().toISOString(), bands: sample(stores, places, n, seed) }, null, 2));
    return;
  }
  if (argv.includes('--impact')) {
    console.log(JSON.stringify(impact(stores, rows), null, 2));
    return;
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ summary: summarize(rows), rows }, null, 2));
    return;
  }
  const sum = summarize(rows);
  console.log(`今のゲートで不一致の紐付け（build.js が適用するもの）: ${rows.length}件`);
  for (const b of BANDS) {
    const o = sum[b];
    console.log(`  ${b.padEnd(16)} ${String(o.total).padStart(5)}件  住所 同じ${o.same} / 違う${o.different} / 決められない${o.unknown}`);
  }
  const low = rows.filter(r => r.band === 'sim-0' || r.band === 'sim-lt-0.3');
  const byBasis = (b) => toReject.filter(r => r.rejectBasis === b).length;
  console.log(`一致率0.3未満: ${low.length}件 → 外す ${toReject.length}（住所が別の場所 ${byBasis('address-different')} / 同じ建物で人が別の店と確かめた ${byBasis('same-building-reviewed')}） / 決められない ${low.length - toReject.length}`);
  if (argv.includes('--check') && toReject.length > 0) {
    console.error(`外すべき紐付けが${toReject.length}件残っています（--apply で rejected にする）`);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { REVIEWED_PATH, audit, summarize, bandOf, applyRejects, REJECT_REASON, states, sample, SAMPLE_BANDS, seeded };
