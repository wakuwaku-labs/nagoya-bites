/**
 * 配信終了が「確定」した写真URLの台帳（data/dead_photo_urls.json）の読み書き・照合。
 * ISSUE-124。確定の根拠は scripts/lib/photo_url_liveness.js の judgeLiveness
 * （404/410 を間隔を置いて2回連続観測）だけ。推測では台帳に載せない（制約10）。
 *
 * 台帳が必要な理由: build.js は毎日 HotPepper API から 写真URL を取り直すため、stores.json から
 * URL をクリアしただけでは翌日のビルドで壊れたURLが蘇る（clear_broken_tabelog_links.js が
 * tabelog_resolved.json を failed 化するのと同じ事情）。build.js の normalizePhotoUrl が
 * この台帳を引いて空へ落とす。照合は写真アセットID（P0xxxxxxx）単位＝サイズ違い
 * （_238/_480 等）も同じ写真として落ちる（全サイズ404を実測済み）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'dead_photo_urls.json');

function hotpepperPhotoId(url) {
  const m = String(url || '').match(/imgfp\.hotp\.jp\/.*\/(P\d{6,})(?:_\d+)?\.[a-z]+/i);
  return m ? m[1] : '';
}

function loadRegistry(p = REGISTRY_PATH) {
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j && Array.isArray(j.entries)) return j;
  } catch { /* 無ければ空 */ }
  return { version: 1, entries: [] };
}

let cachedIds = null;
function deadAssetIds() {
  if (!cachedIds) cachedIds = new Set(loadRegistry().entries.map((e) => e.assetId).filter(Boolean));
  return cachedIds;
}

/** 台帳に載っている配信終了済みの写真か（HotPepper の写真アセットID単位で照合）。 */
function isDeadPhotoUrl(url, ids = deadAssetIds()) {
  const id = hotpepperPhotoId(url);
  return !!id && ids.has(id);
}

module.exports = { REGISTRY_PATH, hotpepperPhotoId, loadRegistry, isDeadPhotoUrl };
