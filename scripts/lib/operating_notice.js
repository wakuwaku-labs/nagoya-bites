'use strict';
/**
 * 閉業・一時休業の注記（基本方針 段階1 S1-4・ADR 0069）。
 *
 * 掲載店のうち、Google の営業状態が「閉業」「一時休業」と取れている店（scripts/lib/place_status.js の closures・
 * 名前と住所が掲載と合う記録だけ）に、「Google では〜と表示（◯月◯日確認）」という事実の注記を出す。
 * 店を外す決まり（一次情報で確かめてから・data/closed_stores.json）は変えない。断定しない。
 * 人の確認（data/store_liveness_reviews.json）で「営業中」と判定した店には出さない。
 * 店舗ページ（gen-store-pages.js）と特集の店カード（scripts/sync_feature_closure_notes.js）が共有する。
 */
const fs = require('fs');
const path = require('path');
const ps = require('./place_status');
const { placesKey } = require('./places_key');

const ROOT = path.resolve(__dirname, '..', '..');
const REVIEWS_PATH = path.join(ROOT, 'data', 'store_liveness_reviews.json');

function loadReviews() {
  try { return JSON.parse(fs.readFileSync(REVIEWS_PATH, 'utf8')).reviews || []; } catch (e) { return []; }
}

function dateJa(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${j.getUTCFullYear()}年${j.getUTCMonth() + 1}月${j.getUTCDate()}日`;
}

function noticeText(kind, checkedAt) {
  const label = kind === 'permanent' ? '閉業' : '一時休業';
  const at = dateJa(checkedAt);
  return `Google では「${label}」と表示されています${at ? `（${at}確認）` : ''}。営業しているかは、お店に確認してください。`;
}

/** placesKey（ホットペッパーID、無ければ manual:店名|エリア）→ { kind, checkedAt, text } */
function buildNoticeIndex(stores, status, reviews) {
  const st = status || ps.loadStatus();
  const rv = reviews || loadReviews();
  const open = new Set(rv.filter((r) => r.verdict === '営業中').map((r) => r.id));
  const c = ps.closures(st, stores);
  const out = new Map();
  for (const [kind, list] of [['permanent', c.permanent], ['temporary', c.temporary]]) {
    for (const x of list) {
      if (open.has(x.key)) continue;
      out.set(x.key, { kind, checkedAt: x.checkedAt, text: noticeText(kind, x.checkedAt) });
    }
  }
  return out;
}

function noticeFor(store, index) {
  return (index && index.get(placesKey(store))) || null;
}

module.exports = { buildNoticeIndex, noticeFor, noticeText, dateJa };
