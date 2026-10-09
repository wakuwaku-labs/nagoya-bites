'use strict';
/**
 * scripts/lib/feature_tracking.js
 *
 * 特集ページの計測（onclick）と予約申告プロンプトの入れ方の唯一の正本（ISSUE-153）。
 * 使う側: scripts/add_feature_top_cta.js（冒頭の EDITORS' PICK）・scripts/apply_feature_conclusions.js（先に結論）・
 * scripts/refresh_feature_rosters.js（掲載店の入れ替え）・scripts/add_feature_tracking.js（後から補う）。
 *
 * 背景: 区画を毎日作り直す生成器が計測なしでリンクを書いていたため、後から add_feature_tracking.js で
 * 足した計測が次の再生成で消えていた。2026-10-09 には、#417 で EDITORS' PICK に足した予約送客の計測が
 * 同じ朝の CI の再生成（add_feature_top_cta.js --all）で消え、特集の冒頭の予約ボタンは
 * 店別の予約送客（cta_click）に数えられていなかった。生成器が最初からこの部品の文字列で書けば、
 * 後から補う側との行き来が起きない。
 *
 * 語彙は scripts/lib/reservation_exits.js の cta_click と同じ。window.nbReserveExit は予約申告プロンプト
 * （scripts/lib/reservation_ask_snippet.js）が定義し、プロンプトの無いページでも trackEvent で送る。
 */
const fs = require('fs');
const path = require('path');
const { applyToHtml: applyReserveAsk } = require('./reservation_ask_snippet');

/** onclick="…" の中の '…' に入れる文字列（属性の " と &、JS の \ と ' を逃がす） */
function jsq(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** HotPepper の予約導線（予約送客・cta_click） */
function reserveExitOnclick(name, id, slug) {
  return `(window.nbReserveExit||trackEvent)('cta_click',{store_name:'${jsq(name)}',store_id:'${jsq(id)}',link_domain:'www.hotpepper.jp',location:'feature',feature:'${slug}'})`;
}

/** 店舗ページ（stores/J….html）へのリンク */
function featureStoreOnclick(id, slug) {
  return `trackEvent('feature_store_click',{store:'${id}',feature:'${slug}'})`;
}

/** 予約導線を持つページか（予約申告プロンプトを入れる条件） */
function hasReserveExit(html) {
  return /hotpepper\.jp\/str|nbReserveExit/.test(html);
}

/** 予約導線を持つページに予約申告プロンプトを入れる（冪等・導線が無いページは変えない） */
function withReserveAsk(html) {
  return hasReserveExit(html) ? applyReserveAsk(html) : html;
}

let NAME_BY_ID = null;
/** ホットペッパーID → data/stores.json の店名（無ければ空文字） */
function storeNameById(id) {
  if (!NAME_BY_ID) {
    NAME_BY_ID = new Map();
    try {
      const stores = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'stores.json'), 'utf8'));
      for (const s of stores) if (s['ホットペッパーID']) NAME_BY_ID.set(s['ホットペッパーID'], s['店名'] || '');
    } catch (e) { /* 店名が分からなくても store_id で集計できる */ }
  }
  return NAME_BY_ID.get(id) || '';
}

module.exports = { jsq, reserveExitOnclick, featureStoreOnclick, hasReserveExit, withReserveAsk, storeNameById };
