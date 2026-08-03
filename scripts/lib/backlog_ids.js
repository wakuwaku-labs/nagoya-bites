#!/usr/bin/env node
/**
 * agent-backlog.md の ID 採番・正規化・重複検知 共通ライブラリ
 *
 * 設計（seo_triage.js / sync_backlog_to_notion.js と同じ思想）:
 *   - このライブラリは「判断」をしない。決定的処理だけを持つ
 *     （採番 / 正規化 / fingerprint / 重複ID検知）。
 *   - 課題の採否・中身の判断はエージェントが CLAUDE.md を根拠に行う。
 *
 * seo_triage.js の SEO- 専用ロジック（normalize/fingerprint/maxSeoNum/nextId）を
 * 接頭辞非依存に一般化したもの。seo_triage.js はこのライブラリの薄いラッパになる。
 *
 * 公開関数:
 *   normalize(text)               正規化（絵文字/数値+単位/記号を畳む）
 *   fingerprint(text)             normalize 後の sha1 先頭16桁
 *   maxNum(prefix[, extraTexts])  agent-backlog.md（+追加テキスト群）から PREFIX-NNN の最大値
 *   nextId(prefix[, opts])        次の PREFIX-NNN（3桁ゼロ詰め）。opts.offset / opts.extraTexts
 *   scanAllIds([text])            見出し行 "### [ID]" の出現を { id: [行番号...] } で返す
 *   findDuplicateIds([text])      2回以上出現した見出しIDだけを { id: [行番号...] } で返す
 *
 * CLI（補助・デバッグ用。出力は常に JSON / 失敗は {ok:false,error}）:
 *   --next-id <PREFIX>            次IDを表示（例: --next-id ISSUE → ISSUE-062）
 *   --scan-dups                   agent-backlog.md の重複見出しIDを表示
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// このファイルは scripts/lib/ にあるのでリポジトリ root は2つ上
const ROOT = path.resolve(__dirname, '..', '..');
const BACKLOG_PATH = path.join(ROOT, 'agent-backlog.md');

// ──────────────────────────────────────────────────────────
// 正規化 & fingerprint（seo_triage.js から移植・接頭辞非依存）
// ──────────────────────────────────────────────────────────

/**
 * テキストを「同種判定」用に正規化する。
 * - 絵文字 / 記号 / 数字+単位を畳む（「流入12%」「流入15%」を同種扱いにする）
 * - 空白を畳む、小文字化
 * 数値を落とすのは意図的: 助言は毎日数値だけ変えて同じ施策を繰り返すため。
 * opts.keepNumbers: true で数値を残す。消費者フィードバック（「電話番号が違う」
 * 「営業時間が11時になっている」等、数値そのものが指摘の識別子になる入力）向け。
 * 既定 false = 従来挙動（SEOループの既存 fingerprint は不変）。
 */
function normalize(text, opts = {}) {
  let s = String(text || '')
    .normalize('NFKC')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, ' '); // 絵文字・矢印
  if (!opts.keepNumbers) {
    s = s.replace(/[0-9０-９]+(\.[0-9]+)?\s*[%％件人軒日週月]?/g, ' '); // 数値+単位を落とす
  }
  return s
    .replace(/[「」『』（）()【】\[\]、。,.・:：\/／…\-—~〜!！?？\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function fingerprint(text, opts = {}) {
  return crypto.createHash('sha1').update(normalize(text, opts)).digest('hex').slice(0, 16);
}

// ──────────────────────────────────────────────────────────
// I/O
// ──────────────────────────────────────────────────────────

function readBacklog() {
  return fs.existsSync(BACKLOG_PATH) ? fs.readFileSync(BACKLOG_PATH, 'utf8') : '';
}

// ──────────────────────────────────────────────────────────
// ID 採番（接頭辞引数化）
// ──────────────────────────────────────────────────────────

/**
 * 指定接頭辞の数値型ID（PREFIX-NNN）の最大値を返す。
 * - PREFIX-WEEKLY-... / PREFIX-MONTHLY-... のような非数値派生は拾わない（数値ロットのみ）
 * - extraTexts: backlog 以外も走査対象に加える（例: SEO は seo_advice_log の id 群を渡す）
 */
function maxNum(prefix, extraTexts = []) {
  if (!prefix || !/^[A-Z]+$/.test(prefix)) {
    throw new Error('prefix must be uppercase letters, got: ' + JSON.stringify(prefix));
  }
  let max = 0;
  // backlog は「課題見出しの実ID」だけを対象にする（scanAllIds 経由）。
  // 本文中の言及（"ORG-006 で正式化予定"・検証例の "SEO-007" 等）で採番が飛ぶのを防ぐ。
  // PREFIX-NNN の後がハイフンか終端のものを数値ロットとして拾う（ISSUE-015-P2 → 15 / STR-MONTHLY-... は除外）。
  const headingRe = new RegExp('^' + prefix + '-(\\d+)(?:-|$)');
  for (const id of Object.keys(scanAllIds(readBacklog()))) {
    const m = id.match(headingRe);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  // extraTexts（seo_advice_log の id 値など実IDの集合）は「言及」でないので全文 scan でよい。
  for (const t of extraTexts) {
    const re = new RegExp(prefix + '-(\\d+)', 'g'); // g フラグの lastIndex 回避のため毎回生成
    let m;
    while ((m = re.exec(String(t))) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

/**
 * 次の PREFIX-NNN を返す（3桁ゼロ詰め）。
 * opts.offset: 連番でまとめ採番する時の +N（既定0）
 * opts.extraTexts: maxNum に渡す追加走査テキスト
 */
function nextId(prefix, opts = {}) {
  const offset = opts.offset || 0;
  const extraTexts = opts.extraTexts || [];
  const n = maxNum(prefix, extraTexts) + 1 + offset;
  return prefix + '-' + String(n).padStart(3, '0');
}

// ──────────────────────────────────────────────────────────
// 重複ID検知（見出し行ベース）
// ──────────────────────────────────────────────────────────

/**
 * agent-backlog.md の課題見出し "### [ID] タイトル" を走査し、
 * 各 ID の出現行番号（1-based）を { id: [行...] } で返す。
 */
function scanAllIds(text) {
  const md = text != null ? String(text) : readBacklog();
  const lines = md.split('\n');
  const map = {};
  const re = /^###\s+\[([A-Z]+-[A-Z0-9-]+)\]/; // 課題見出しのIDだけを抽出
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) {
      const id = m[1];
      (map[id] = map[id] || []).push(i + 1);
    }
  }
  return map;
}

/** scanAllIds のうち、2回以上出現した（=重複起票された）IDだけを返す。 */
function findDuplicateIds(text) {
  const all = scanAllIds(text);
  const dups = {};
  for (const id of Object.keys(all)) {
    if (all[id].length > 1) dups[id] = all[id];
  }
  return dups;
}

// ──────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--next-id')) {
    const prefix = args[args.indexOf('--next-id') + 1];
    if (!prefix) { out({ ok: false, error: '--next-id requires a PREFIX (e.g. ISSUE)' }); process.exit(1); }
    try { out({ ok: true, prefix, next_id: nextId(prefix) }); }
    catch (e) { out({ ok: false, error: e.message }); process.exit(1); }
    return;
  }

  if (args.includes('--scan-dups')) {
    const dups = findDuplicateIds();
    out({ ok: true, duplicate_count: Object.keys(dups).length, duplicates: dups });
    return;
  }

  out({ ok: false, error: 'no subcommand', usage: ['--next-id <PREFIX>', '--scan-dups'] });
  process.exit(1);
}

if (require.main === module) main();

module.exports = { normalize, fingerprint, maxNum, nextId, scanAllIds, findDuplicateIds };
