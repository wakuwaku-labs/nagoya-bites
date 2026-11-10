'use strict';
/**
 * SNS分析ツールが iCloud に置くファイル（next.json・note-next.json）と、こちらが置くファイル（note_metrics.json）の
 * 読み書きの共通部分（docs/decisions/0059）。置き場は
 *   ~/Library/Mobile Documents/com~apple~CloudDocs/sns-analyzer-x/nagoya_bites/
 * 環境変数 SNS_ANALYZER_X_DIR で変えられる（iCloud が launchd から読めない環境の逃げ道・試験用）。
 * 実測（2026-11-08）: launchd から動く /bin/bash は iCloud Drive の中を読めない（Operation not permitted）。
 * そのため環境変数が無いときは、iCloud → ~/.config/sns-analyzer-x/nagoya_bites の順に探す（読むときは最初に使えたもの、
 * 書くときは最初に読み書きできるもの）。後者へ写しを置くのは SNS分析ツール側の仕事。
 * 読めない・無い・壊れ・古い・schema 違いは、すべて「指定なし」（理由つき）で返し、例外を投げない。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_DIR = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/sns-analyzer-x/nagoya_bites');

const FALLBACK_DIR = path.join(os.homedir(), '.config/sns-analyzer-x/nagoya_bites');

/** 探す置き場（優先順）。環境変数があればそれだけ。 */
function analyzerDirs() {
  return process.env.SNS_ANALYZER_X_DIR ? [process.env.SNS_ANALYZER_X_DIR] : [DEFAULT_DIR, FALLBACK_DIR];
}

/** 書き込み先。最初に「作れて・中身を読めて・書ける」置き場。無ければ先頭（書くときに失敗として出る）。 */
function analyzerDir() {
  const dirs = analyzerDirs();
  for (const d of dirs) {
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.readdirSync(d);
      fs.accessSync(d, fs.constants.W_OK);
      return d;
    } catch (_) { /* 次の置き場へ */ }
  }
  return dirs[0];
}

/** JST の日付（YYYY-MM-DD）の曜日。月=0 … 日=6。 */
function weekdayJst(date) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** JST の日付の ISO 週（例 2026-W46）。 */
function isoWeekJst(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // 月=0
  d.setUTCDate(d.getUTCDate() - day + 3); // その週の木曜
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * <dir>/<name> を読む。schema が違う・generated_at が maxAgeDays より古い（または未来すぎる）・壊れは理由つきで落とす。
 * 返り値: { ok: true, data } か { ok: false, reason }。
 */
function readFresh(name, opts = {}) {
  if (opts.dir) return readFreshIn(opts.dir, name, opts);
  let first = null;
  for (const dir of analyzerDirs()) {
    const r = readFreshIn(dir, name, opts);
    if (r.ok) return r;
    first = first || r;
  }
  return first;
}

function readFreshIn(dir, name, { schema, maxAgeDays = 8, now = new Date() } = {}) {
  let raw;
  try { raw = fs.readFileSync(path.join(dir, name), 'utf8'); } catch (e) { return { ok: false, reason: e.code === 'ENOENT' ? 'missing' : `unreadable:${e.code || e.message}` }; }
  let data;
  try { data = JSON.parse(raw); } catch (_) { return { ok: false, reason: 'bad_json' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'bad_shape' };
  if (schema && data.schema !== schema) return { ok: false, reason: 'schema_mismatch' };
  const t = Date.parse(data.generated_at);
  if (!Number.isFinite(t)) return { ok: false, reason: 'no_generated_at' };
  const ageDays = (now.getTime() - t) / 86400000;
  if (ageDays > maxAgeDays) return { ok: false, reason: 'stale' };
  if (ageDays < -1) return { ok: false, reason: 'from_future' };
  return { ok: true, data };
}

const KINDS = new Set(['number', 'mechanism', 'checklist']);
const FIRST_LINES = new Set(['question', 'number', 'assertion']);
const LENGTHS = new Set(['short', 'mid', 'long']);

/**
 * next.json の plan から、date（JST）の枠を取り出す。条件: plan.week が date の週・slots が配列・曜日の枠が有り、値が既知。
 * 返り値: { ok: true, plan: { week, slot, role, experiment_id, cell_id, topic, url_variant, nb_kind, first_line, length } } か { ok: false, reason }。
 */
function pickSlot(next, date) {
  const plan = next && next.plan;
  if (!plan || typeof plan !== 'object') return { ok: false, reason: 'no_plan' };
  if (plan.week !== isoWeekJst(date)) return { ok: false, reason: 'other_week' };
  if (!Array.isArray(plan.slots)) return { ok: false, reason: 'bad_slots' };
  const wd = weekdayJst(date);
  const s = plan.slots.find((x) => x && x.slot === wd);
  if (!s) return { ok: false, reason: 'no_slot' };
  const f = (s.format && typeof s.format === 'object') ? s.format : {};
  const nb = f.nb_kind ?? null;
  const fl = f.first_line ?? null;
  const ln = f.length ?? null;
  if ((nb !== null && !KINDS.has(nb)) || (fl !== null && !FIRST_LINES.has(fl)) || (ln !== null && !LENGTHS.has(ln))) return { ok: false, reason: 'unknown_value' };
  const md = f.media === 'image' || f.media === 'none' ? f.media : null; // 画像カードの付ける・付けない（scripts/lib/x_image_card.js）
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  return {
    ok: true,
    plan: { week: plan.week, slot: wd, role: s.role === 'explore' || s.role === 'exploit' ? s.role : null,
      experiment_id: str(s.experiment_id), cell_id: str(s.cell_id), topic: str(s.topic),
      url_variant: s.url_variant === 'url' || s.url_variant === 'no_url' ? s.url_variant : null, nb_kind: nb, first_line: fl, length: ln, ...(md ? { media: md } : {}) },
  };
}

module.exports = { analyzerDir, analyzerDirs, weekdayJst, isoWeekJst, readFresh, pickSlot, KINDS, FIRST_LINES, LENGTHS };
