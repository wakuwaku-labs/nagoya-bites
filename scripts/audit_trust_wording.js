#!/usr/bin/env node
'use strict';
/**
 * scripts/audit_trust_wording.js — 口コミ信頼度の「公開文言」監査
 *
 * 基準は data/trust_display_policy.json（唯一の情報源）。2 つを検査する:
 *   A. 旧名称（legacyNames: 整合度順／TRUST SCORE／スコア信頼度／信頼性スコア／信頼度スコア）が
 *      公開面に残っていないか — 名前が複数あるとブランドにならない
 *   B. 禁止語（bannedWords: 疑い／サクラ／ガチャ／化粧／操作）が「口コミ信頼度の表示面」に
 *      出ていないか — 公開文言は観測事実だけを書き、結論語を書かない（名指し回避）
 *
 * B のスコープは表示面に限定する（無差別 grep は「サクラゼロ宣言」「順位操作はなく」「店名 サクラ」で
 * 偽陽性だらけになる）:
 *   (1) data/crosscheck.json の全 reason（8軸・S7 parts）
 *   (2) data/trust_display_policy.json 自身（bannedWords/legacyNames の定義行は除外）
 *   (3) index.html の <!-- REVIEW_TRUST_BOX_START/END --> と // REVIEW_TRUST_RENDER_START/END 区間
 *   (4) stores/*.html の .trust-breakdown ブロックと .ccs-badge の title
 *   (5) features/review-trust.html 全文
 * A のスコープ: index.html 全体・features/*.html（integrity-method / no-fake-reviews /
 *   editorial-policy を含む）・about.html・faq.html・llms.txt・stores/*.html
 *
 * stores/*.html のスコープは「data/stores.json に現存する店（＝ gen-store-pages.js が
 * 実際に再生成する店）」だけに限定する（2026-08-20・ISSUE-101 マージ直後に発覚）。
 * stores/ ディレクトリには過去に閉店・統合等でカタログから外れた店の孤児ページが
 * 676件残っており、gen-store-pages.js は既定では孤児を再生成も削除もしない
 * （破壊的操作のため --delete-orphans が明示指定された時のみ）。この監査が全ファイルを
 * 対象にすると、この PR と無関係な孤児ページの内容で CI が恒久的に赤くなる。
 * 孤児ページの是正（削除 or 再生成）は別チケット（ISSUE-050 と同じ「孤児ページ」クラス）で
 * 扱い、ここでは対象外である旨を info として出すに留める（削除は破壊的操作のため単独では行わない）。
 *
 * 使い方:
 *   node scripts/audit_trust_wording.js           # レポート
 *   node scripts/audit_trust_wording.js --check   # 違反あれば exit 1（CI 用）
 * crosscheck.json が旧形式（reviewTrust 無し＝CI ビルド前）なら (1) は警告のみで skip する。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { loadPolicy } = require('./lib/trust_display');

const CHECK = process.argv.includes('--check');
const P = loadPolicy();
const violations = [];
const warnings = [];
const info = [];

function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { return null; } }
function lineOf(text, idx) { return text.slice(0, idx).split('\n').length; }

function scanWords(text, words, label, opts) {
  if (text == null) return;
  const max = (opts && opts.max) || 5;
  for (const w of words) {
    let from = 0, hits = 0;
    while (true) {
      const i = text.indexOf(w, from);
      if (i < 0) break;
      hits++;
      if (hits <= max) {
        const ln = lineOf(text, i);
        const ctx = text.slice(Math.max(0, i - 30), i + w.length + 30).replace(/\s+/g, ' ');
        violations.push(`${label}:${ln} 「${w}」 …${ctx}…`);
      }
      from = i + w.length;
    }
    if (hits > max) violations.push(`${label} 「${w}」 ほか ${hits - max} 件`);
  }
}

function listFiles(dir, re) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter(f => re.test(f)).map(f => path.join(dir, f));
}

/** stores/*.html のうち data/stores.json に現存する店だけ（gen-store-pages.js が実際に管理する範囲） */
function managedStoreFiles() {
  const all = listFiles('stores', /\.html$/);
  let ids;
  try {
    const { loadStores } = require('./lib/load_stores');
    ids = new Set(loadStores().map(s => s['ホットペッパーID']).filter(Boolean));
  } catch (e) {
    return { managed: all, orphanCount: 0 }; // stores.json 未生成環境ではフィルタしない
  }
  const managed = all.filter(f => ids.has(path.basename(f, '.html')));
  return { managed, orphanCount: all.length - managed.length };
}
const { managed: MANAGED_STORE_FILES, orphanCount: ORPHAN_STORE_COUNT } = managedStoreFiles();
if (ORPHAN_STORE_COUNT > 0) {
  info.push(`stores/*.html: 孤児ページ ${ORPHAN_STORE_COUNT}件は data/stores.json に現存しないため本監査の対象外（gen-store-pages.js --delete-orphans で是正・別チケット）`);
}

// ── A. 旧名称 ──────────────────────────────────────────────
const legacyTargets = ['index.html', 'about.html', 'faq.html', 'llms.txt']
  .concat(listFiles('features', /\.html$/));
for (const f of legacyTargets) scanWords(read(f), P.legacyNames, `[旧名称] ${f}`);
// stores/*.html は件数が多いので集計のみ（管理下＝data/stores.json に現存する店のみ）
{
  const files = MANAGED_STORE_FILES;
  const counts = {};
  let scanned = 0;
  for (const f of files) {
    const t = read(f); if (t == null) continue; scanned++;
    for (const w of P.legacyNames) if (t.includes(w)) counts[w] = (counts[w] || 0) + 1;
  }
  const anyNew = files.some(f => (read(f) || '').includes(`${P.name}の内訳`));
  if (scanned > 0 && !anyNew) warnings.push(`stores/*.html は旧形式（CI 再生成前）のため旧名称検査を skip（${scanned}件）`);
  else for (const [w, n] of Object.entries(counts)) violations.push(`[旧名称] stores/*.html 「${w}」 ${n}/${scanned} ファイル`);
}

// ── B-1. crosscheck.json の reason ─────────────────────────
{
  const raw = read('data/crosscheck.json');
  if (raw == null) warnings.push('data/crosscheck.json が無いため reason 検査を skip');
  else {
    let map; try { map = JSON.parse(raw); } catch (e) { map = null; }
    if (!map) warnings.push('data/crosscheck.json を parse できないため reason 検査を skip');
    else {
      const ids = Object.keys(map);
      const isNew = ids.some(id => map[id] && map[id].reviewTrust);
      if (!isNew) {
        warnings.push(`data/crosscheck.json は旧形式（reviewTrust 無し・CI ビルド前）のため reason 検査を skip（${ids.length}件）`);
      } else {
        const counts = {};
        const samples = {};
        for (const id of ids) {
          const e = map[id]; if (!e) continue;
          for (const [k, axis] of Object.entries(e)) {
            if (!axis || typeof axis !== 'object' || k === 'reviewTrust') continue;
            const reasons = [axis.reason].concat((axis.parts || []).map(p => p.reason)).filter(Boolean);
            for (const r of reasons) for (const w of P.bannedWords) if (r.includes(w)) {
              counts[w] = (counts[w] || 0) + 1;
              if (!samples[w]) samples[w] = `${id} ${k}: ${r}`;
            }
          }
        }
        for (const [w, n] of Object.entries(counts)) violations.push(`[禁止語] data/crosscheck.json 「${w}」 ${n} 件 例: ${samples[w]}`);
      }
    }
  }
}

// ── B-2. policy 自身 ───────────────────────────────────────
// JSON を構造的に走査し、禁止語の定義そのもの（P.bannedWords 配列）と内部メモ
// （_README / _why 等・公開面には注入されない）を除いた文字列値だけを対象にする。
// 生テキストの行フィルタだとインデント幅・改行位置が変わるだけで壊れるため使わない。
{
  const skipKeys = new Set(['bannedWords', 'legacyNames']);
  const violations2 = [];
  function walk(node, path) {
    if (node == null) return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, path)); return; }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (skipKeys.has(k) || k.startsWith('_')) continue;
        walk(v, path.concat(k));
      }
      return;
    }
    if (typeof node === 'string') {
      for (const w of P.bannedWords) if (node.includes(w)) {
        violations2.push(`[禁止語] data/trust_display_policy.json ${path.join('.')} 「${w}」: ${node}`);
      }
    }
  }
  walk(P, []);
  violations.push(...violations2);
}

// ── B-3. index.html の表示区間 ──────────────────────────────
{
  const html = read('index.html') || '';
  const take = (startMark, endMark) => {
    const a = html.indexOf(startMark), b = html.indexOf(endMark);
    if (a < 0 || b < 0 || b < a) { violations.push(`[構造] index.html に ${startMark} / ${endMark} の区間が見つからない`); return ''; }
    return html.slice(a, b);
  };
  scanWords(take('<!-- REVIEW_TRUST_BOX_START -->', '<!-- REVIEW_TRUST_BOX_END -->'), P.bannedWords, '[禁止語] index.html(REVIEW_TRUST_BOX)');
  scanWords(take('// REVIEW_TRUST_RENDER_START', '// REVIEW_TRUST_RENDER_END'), P.bannedWords, '[禁止語] index.html(REVIEW_TRUST_RENDER)');
  if (!/^var TRUST_POLICY = \{.*\};$/m.test(html)) violations.push('[構造] index.html に var TRUST_POLICY = {...}; が無い');
}

// ── B-4. stores/*.html の表示面（管理下＝data/stores.json に現存する店のみ） ─────────────────────────────
{
  const files = MANAGED_STORE_FILES;
  const counts = {}; const samples = {}; let scanned = 0; let newFormat = 0;
  for (const f of files) {
    const t = read(f); if (t == null) continue; scanned++;
    if (t.includes(`${P.name}の内訳`)) newFormat++;
    const parts = [];
    const a = t.indexOf('<div class="trust-breakdown">');
    if (a >= 0) { const b = t.indexOf('<div class="links-section">', a); parts.push(t.slice(a, b > a ? b : a + 6000)); }
    const m = t.match(/<span class="ccs-badge[^"]*" title="([^"]*)"/); if (m) parts.push(m[1]);
    for (const p of parts) for (const w of P.bannedWords) if (p.includes(w)) { counts[w] = (counts[w] || 0) + 1; if (!samples[w]) samples[w] = f; }
  }
  if (scanned > 0 && newFormat === 0) {
    warnings.push(`stores/*.html は旧形式（${P.name}の内訳が無い・CI 再生成前）のため禁止語検査を skip（${scanned}件）`);
  } else {
    for (const [w, n] of Object.entries(counts)) violations.push(`[禁止語] stores/*.html 「${w}」 ${n}/${scanned} ファイル 例: ${samples[w]}`);
  }
}

// ── B-5. 読み方ページ ──────────────────────────────────────
scanWords(read('features/review-trust.html'), P.bannedWords, '[禁止語] features/review-trust.html');

// ── 出力 ──────────────────────────────────────────────────
console.log(`口コミ信頼度 公開文言監査（policy v${P.version} / scoreVersion ${P.scoreVersion}）`);
for (const i of info) console.log(`  ℹ ${i}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (violations.length === 0) {
  console.log('  ✅ 旧名称 0 件・禁止語 0 件');
} else {
  console.log(`  ❌ 違反 ${violations.length} 件`);
  for (const v of violations) console.log(`   - ${v}`);
  if (CHECK) process.exit(1);
}
