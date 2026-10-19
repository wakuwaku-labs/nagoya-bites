'use strict';
/**
 * scripts/lib/place_status.js — 掲載店の Google の営業状態の取り直しの判定（ISSUE-173・P-177）
 *
 * 対象: 紐付けが「確認済み」（店名が合う・住所が違わない）の店だけ。別の店の営業状態を、この店のものとして
 * 数えないため（ISSUE-147）。取った時点の Google 側の名前と住所も、掲載と合うかを毎回検算する（制約10）。
 * 取った結果は data/place_status.json に店ごとの日時つきで残す。自動では店を外さない（外すのは ISSUE-170 の確認の後）。
 */
const fs = require('fs');
const path = require('path');
const { namesMatch, branchConflict } = require('./store_name_match');
const { compareJpAddress } = require('./store_link_identity');
const { placesKey } = require('./places_key');
const binding = require('./place_binding');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'data', 'place_status_policy.json');
const STATUS_PATH = path.join(ROOT, 'data', 'place_status.json');

function loadPolicy() { return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8')); }
function loadStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')); } catch (e) { return { usage: {}, entries: {} }; }
}
const monthOf = (d) => d.toISOString().slice(0, 7);

/**
 * 今日取り直す店を選ぶ。紐付けが確認済みの店だけ。一度も取っていない店が先、次に取った日が古い順。
 * 今月の残り枠と1日の上限の小さい方まで。
 */
function pickTargets(stores, places, status, policy, now) {
  const ctx = binding.buildContext(stores, places);
  const used = (status.usage && status.usage[monthOf(now)]) || 0;
  const n = Math.max(0, Math.min(policy.dailyLimit, policy.monthlyCap - used));
  const cand = [];
  for (const s of stores) {
    if (!s.placeId) continue;
    if (binding.bindingOf(s, ctx).state !== 'confirmed') continue;
    const e = status.entries[placesKey(s)];
    const at = e && e.placeId === s.placeId ? Date.parse(e.checkedAt) : 0;
    cand.push({ store: s, at });
  }
  cand.sort((a, b) => a.at - b.at);
  return cand.slice(0, n).map((c) => c.store);
}

/** 取れた結果を、掲載と合うかを添えて1件の記録にする（根拠にしてよいのは nameOk かつ addrVerdict が different でないとき） */
function judge(store, fetched, now) {
  const nm = namesMatch(store['店名'] || '', fetched.name || '');
  const nameOk = !!(nm.ok && !branchConflict(store['店名'] || '', fetched.name || ''));
  const addr = (store['住所'] && fetched.formatted_address && /〒\d{3}-\d{4}/.test(fetched.formatted_address))
    ? compareJpAddress(store['住所'], fetched.formatted_address).verdict : 'unknown';
  return {
    placeId: store.placeId, checkedAt: now.toISOString(), status: fetched.business_status || null,
    googleName: fetched.name || '', nameOk, addrVerdict: addr, usable: nameOk && addr !== 'different',
  };
}

/** 閉業・一時休業に変わった店（根拠にしてよい記録だけ） */
function closures(status, stores) {
  const byKey = new Map(stores.map((s) => [placesKey(s), s]));
  const out = { permanent: [], temporary: [], unusable: 0 };
  for (const [key, e] of Object.entries(status.entries || {})) {
    if (e.status !== 'CLOSED_PERMANENTLY' && e.status !== 'CLOSED_TEMPORARILY') continue;
    if (!e.usable) { out.unusable++; continue; }
    const s = byKey.get(key);
    if (!s) continue;
    (e.status === 'CLOSED_PERMANENTLY' ? out.permanent : out.temporary).push({ key, 店名: s['店名'], エリア: s['エリア'], checkedAt: e.checkedAt });
  }
  return out;
}

module.exports = { POLICY_PATH, STATUS_PATH, loadPolicy, loadStatus, monthOf, pickTargets, judge, closures };
