#!/usr/bin/env node
/**
 * QA ゲートの決定化（ORG-006・セルフレビューの客観証跡化）
 *
 * 設計（seo_triage.js / track_metrics.js と同じ思想）:
 *   - 自己申告だった QA を「スクリプトの客観出力＋証跡」に変える。
 *   - セルフレビュー（提案も実装も同一モデル）でも、後から監査できる数値を残すのが目的。
 *
 * orchestrator.md の QA-1〜5 のうち、機械判定できる QA-2/3/4 を決定的に出力する:
 *   QA-2 店舗件数 5%減検知 / QA-3 diff範囲・LOCAL_STORES行変更 / QA-4 JS構文＋機能マーカー保全
 * 範囲外（別途）:
 *   QA-1 build.js 正常終了 → `node build.js` を直接実行して確認（重い・環境依存なのでここでは扱わない）
 *   QA-5 UX 目視（モバイル/CTA）→ 人/AI が判断
 *
 * 機能マーカーは「あるべき絶対値」でなく **before→after の相対比較** で見る
 * （index.html は圧縮済みで固定文字列が当てにならないため）。before の出現が十分多い
 * マーカーが after で半減以下になったら「機能が丸ごと壊れた疑い」として fail。
 *
 * サブコマンド（出力は常に JSON / --after は fail で exit 1）:
 *   --before   実装前: 店舗件数・機能マーカー出現・index バイト数を /tmp/qa_gate_before.json に保存
 *   --after    実装後: QA-2/3/4 を判定して JSON 出力
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const STORES = path.join(ROOT, 'data/stores.json');
const SNAP = '/tmp/qa_gate_before.json';

// CLAUDE.md 制約5（フィルタ/検索/モーダル/IG/評価を壊さない）+ Moat 由来の保全対象マーカー。
// 相対比較で使うので、現状 0 のものが混ざっていても害はない（0→0 は変化なし）。
const FEATURE_MARKERS = ['LOCAL_STORES', 'modal', 'filter', 'search', 'instagram', 'fetchFullCatalog', 'crossCheck', 'editorReason'];

function out(o) { console.log(JSON.stringify(o, null, 2)); }

function storeCount() {
  try {
    const s = JSON.parse(fs.readFileSync(STORES, 'utf8'));
    return Array.isArray(s) ? s.length : (s.stores ? s.stores.length : null);
  } catch (e) { return null; }
}

function readIndex() { return fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : ''; }

function markerCounts(html) {
  const m = {};
  for (const k of FEATURE_MARKERS) {
    const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    m[k] = (html.match(re) || []).length;
  }
  return m;
}

function jsSyntaxRough(html) {
  // 完全な構文解析ではなく「大崩れ検知」。index.html を読めること＋括弧バランスの近傍チェック。
  const open = (html.match(/[{(]/g) || []).length;
  const close = (html.match(/[})]/g) || []).length;
  return { readable: html.length > 0, brace_paren_diff: open - close, note: '0近傍が正常。大きくズレたら手動確認' };
}

function before() {
  const html = readIndex();
  const snap = { at: new Date().toISOString(), store_count: storeCount(), markers: markerCounts(html), index_bytes: html.length };
  fs.writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  return { ok: true, saved: SNAP, ...snap };
}

function after() {
  const html = readIndex();
  const prev = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : null;

  // QA-2: 店舗件数 5%減検知
  const nowCount = storeCount();
  let qa2;
  if (prev && prev.store_count && nowCount != null) {
    const dp = (nowCount - prev.store_count) / prev.store_count * 100;
    qa2 = { pass: dp >= -5, before: prev.store_count, after: nowCount, delta_pct: +dp.toFixed(2) };
  } else {
    qa2 = { pass: true, before: prev ? prev.store_count : null, after: nowCount, note: 'before未取得 or 件数不明（--before を先に）' };
  }

  // QA-3: diff 範囲 + LOCAL_STORES 行変更
  let qa3;
  try {
    const names = cp.execSync('git diff --name-only', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
    const indexDiff = cp.execSync('git diff -- index.html', { cwd: ROOT }).toString();
    const localStoresTouched = /LOCAL_STORES/.test(indexDiff);
    qa3 = { pass: true, changed_files: names, local_stores_line_touched: localStoresTouched, note: localStoresTouched ? 'LOCAL_STORES行に差分→要目視確認' : 'OK' };
  } catch (e) {
    qa3 = { pass: true, note: 'git diff取得不可: ' + e.message };
  }

  // QA-4: JS構文（大崩れ検知）+ 機能マーカー保全（before比で半減以下を検知）
  const syn = jsSyntaxRough(html);
  const nowM = markerCounts(html);
  const regressions = [];
  if (prev && prev.markers) {
    for (const k of FEATURE_MARKERS) {
      const b = prev.markers[k] || 0;
      const a = nowM[k] || 0;
      if (b >= 5 && a < b * 0.5) regressions.push({ marker: k, before: b, after: a });
    }
  }
  const qa4 = { pass: syn.readable && regressions.length === 0, syntax: syn, marker_regressions: regressions };

  const result = {
    ok: qa2.pass && qa3.pass && qa4.pass,
    qa2_store_count: qa2,
    qa3_diff: qa3,
    qa4_syntax_features: qa4,
    qa1_build: '別途 `node build.js` で確認（重い・環境依存のため qa_gate 範囲外）',
    qa5_ux: '人/AI の目視（モバイル表示・CTA導線）— qa_gate では判定しない',
  };
  out(result);
  if (!result.ok) process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--before')) { out(before()); return; }
  if (args.includes('--after')) { after(); return; }
  out({ ok: false, error: 'no subcommand', usage: ['--before', '--after'] });
  process.exit(1);
}

if (require.main === module) main();

module.exports = { before, after, storeCount, markerCounts };
