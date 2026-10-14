'use strict';
/**
 * ローカル実行（日次ジャーナル）で使った Places の月次消費の台帳（P-436・docs/decisions/0042）。
 *
 * 書き手を分ける: data/photo_pipeline_health.json は CI（build.yml）が毎日書き換えるため、
 * ローカルのジャーナルが同じファイルを書くと、ラッパーがコミットできず作業ツリーが汚れ、
 * 翌朝の取り込みで衝突する。そこでローカル分は data/photo_pipeline_health_local.json に分け、
 * 書き手は日次ジャーナルの実行（generate_daily_draft.js）だけにする。CI は読むだけ。
 * 月の上限の判定は「CI 分（photo_pipeline_health.json）＋ローカル分」で行う。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_FILE = 'data/photo_pipeline_health_local.json';
const SKU_ZERO = { textsearch: 0, details: 0, photo: 0 };

function localPath(root) { return path.join(root || ROOT, LOCAL_FILE); }

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; }
}

function monthOf(block, month) {
  return block && block.sku_month === month ? { ...SKU_ZERO, ...(block.sku_calls_month || {}) } : { ...SKU_ZERO };
}

function add(a, b) {
  return {
    textsearch: (Number(a.textsearch) || 0) + (Number(b.textsearch) || 0),
    details: (Number(a.details) || 0) + (Number(b.details) || 0),
    photo: (Number(a.photo) || 0) + (Number(b.photo) || 0),
  };
}

/** ローカル分（今月）。ファイルが無い・壊れている・月が違うときはゼロ */
function readLocalMonth(month, root) {
  return monthOf(readJson(localPath(root)), month);
}

/**
 * 月の合計 = CI 分（photo_pipeline_health.json の places）＋ローカル分。
 * healthRoot は photo_pipeline_health.json を読んだオブジェクト。
 */
function totalMonth(healthRoot, month, root) {
  return add(monthOf((healthRoot || {}).places, month), readLocalMonth(month, root));
}

/** ローカル台帳へ今回分を足して書く（書き手はジャーナルの実行だけ）。足した後の今月の値を返す */
function addLocalUsage(used, month, extra, root) {
  const next = add(readLocalMonth(month, root), used);
  fs.writeFileSync(localPath(root), JSON.stringify({
    sku_month: month,
    sku_calls_month: next,
    ...(extra || {}),
    last_run: new Date().toISOString(),
  }, null, 2) + '\n', 'utf8');
  return next;
}

module.exports = { LOCAL_FILE, SKU_ZERO, readLocalMonth, totalMonth, addLocalUsage, add };
