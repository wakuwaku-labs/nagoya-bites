'use strict';
/**
 * scripts/lib/store_link_tracking.js
 *
 * 店舗ページの内部リンクのクリック計測（internal_link_click）を読み込む <script> タグの唯一の正本。
 * 本体は assets/js/store-link-tracking.js（全店舗ページで共有。ページごとにインラインで持たない）。
 * 使う側: gen-store-pages.js（生成）と scripts/add_store_link_tracking.js（既存ページへの後追い）。
 * 2つは同じ位置（</body> の直前の行）に同じ1行を入れるので、変換したページを生成し直しても差分が出ない。
 */

const MARKER = 'assets/js/store-link-tracking.js';
const TAG = '<script defer src="../assets/js/store-link-tracking.js"></script>';

/** 計測タグが入っているか */
function hasTracking(html) {
  return html.includes(MARKER);
}

/** 内部リンクのブロック（クリックを数える対象）があるか。gen-store-pages.js の CSS クラスと同じ */
function hasBlocks(html) {
  return /class="(?:related-features|related-stores|back-section)\b|class="breadcrumb"/.test(html);
}

/** </body> の直前の行に計測タグを入れて返す（冪等）。</body> が無ければ null */
function applyToHtml(html) {
  if (hasTracking(html)) return html;
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return null;
  return html.slice(0, idx) + TAG + '\n' + html.slice(idx);
}

module.exports = { MARKER, TAG, hasTracking, hasBlocks, applyToHtml };
