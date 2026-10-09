'use strict';
/**
 * claude --print が「利用上限」で止まったかを出力の文から読み取り、解除まで待つかを決める（ISSUE-184）。
 *
 * 2026-10-09 の日次ジャーナルは、09:00 の実行が
 *   "You've hit your session limit · resets 11:10am (Asia/Tokyo)"
 * で終わり、ラッパーが認証エラーでもネットワーク瞬断でもないとして作り直さずに HOLD にした。
 * 上限は 11:10 に解けていたので、待てば同じ日に出せた。
 *
 * 判定に使うのは claude が出した文だけ（自己申告値は使わない・制約10）。
 * 解除時刻が読めないとき・待つ時間が上限を超えるとき（週の上限など）・待ち終わりが日付をまたぐときは待たない
 * （ラッパーは起動時の日付の記事を作るため、日付をまたいで作り直すと別の日の扱いになる）。
 * レート制限（"rate limit reached" や HTTP 429）は利用上限として扱わない。
 * 待つ上限は data/journal_gate_policy.json の usage_limit_retry で持つ（スクリプトは触らない）。
 *
 * CLI（run_journal_local.sh が使う）:
 *   node scripts/lib/claude_usage_limit.js <出力のファイル> [--now <ISO>]
 *   → 1行: "NONE" | "WAIT <秒> <解除 HH:MM>" | "NOWAIT <理由> <解除 HH:MM|->"
 *   理由: too-long（待つ上限を超える）/ next-day（待ち終わりが日付をまたぐ）/ no-reset-time / unknown-time-zone
 *   解除の表示の空白は "_" に置き換える（シェルの read で1語にするため）
 */
const fs = require('fs');
const path = require('path');

const POLICY_FILE = path.join(__dirname, '..', '..', 'data', 'journal_gate_policy.json');
const DEFAULT_POLICY = { max_wait_minutes: 330, margin_minutes: 3, max_waits_per_run: 2, default_time_zone: 'Asia/Tokyo' };

// 上限に当たったことを示す文（Claude Code の表示の揺れを含む）。"rate limit reached"（429）は含めない
const LIMIT_RE = /hit your [\w -]*limit|reached your [\w -]*limit|usage limit reached|(?:session|weekly|daily|5-hour|opus|sonnet) limit reached|limit will reset/i;
// 古い Claude Code の表示 "Claude AI usage limit reached|1760000000"（解除の UNIX 時刻）
const EPOCH_RE = /usage limit reached\|(\d{10}|\d{13})\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// "resets 11:10am (Asia/Tokyo)" / "resets Oct 13, 9am" / "will reset at 5pm (Asia/Tokyo)" / "resets 17:00"
// 午前・午後も分も無い数字（"resets 5"）は時刻と決められないので使わない
const RESET_RE = /reset(?:s)?\s+(?:at\s+)?(?:([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm)\b)?(?:\s*\(([^)]+)\))?/gi;

function loadPolicy(file = POLICY_FILE) {
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')).usage_limit_retry || {};
    return { ...DEFAULT_POLICY, ...p };
  } catch (e) {
    return { ...DEFAULT_POLICY };
  }
}

/** その時刻の、指定タイムゾーンでの壁時計（年・月・日・時・分）。不正なタイムゾーンは例外 */
function wallClock(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** タイムゾーンの壁時計 → 実際の時刻（夏時間でも合うよう2回寄せる） */
function fromWallClock(y, mo, d, h, mi, timeZone) {
  const target = Date.UTC(y, mo - 1, d, h, mi, 0);
  let t = target;
  for (let i = 0; i < 2; i++) {
    const w = wallClock(new Date(t), timeZone);
    const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
    t += target - asUtc;
  }
  return new Date(t);
}

function hhmm(date, timeZone) {
  const w = wallClock(date, timeZone);
  return `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`;
}

/**
 * 出力の文を読む（純関数）。
 * 戻り値: { limited:false } | { limited:true, resetAt:Date|null, resetLabel:string|null, waitSeconds:number|null, wait:boolean, reason:string }
 */
function parseUsageLimit(text, now = new Date(), policy = DEFAULT_POLICY) {
  const s = String(text || '');
  if (!LIMIT_RE.test(s)) return { limited: false };
  const dayZone = policy.default_time_zone || 'Asia/Tokyo';
  const stop = (reason, resetAt = null, resetLabel = null, waitSeconds = null) => ({ limited: true, resetAt, resetLabel, waitSeconds, wait: false, reason });
  let resetAt = null;
  let resetLabel = null;
  try {
    const ep = s.match(EPOCH_RE);
    if (ep) {
      resetAt = new Date(ep[1].length === 13 ? Number(ep[1]) : Number(ep[1]) * 1000);
    } else {
      // 午前・午後か分のある最初の「reset(s) …」を使う
      const m = [...s.matchAll(RESET_RE)].find((x) => x[5] || x[4]);
      if (!m) return stop('no-reset-time');
      const [, mon, day, hourS, minS, ampm, tzRaw] = m;
      const timeZone = (tzRaw || dayZone).trim();
      let hour = Number(hourS);
      if (ampm) {
        if (hour < 1 || hour > 12) return stop('no-reset-time');
        hour = (hour % 12) + (ampm.toLowerCase() === 'pm' ? 12 : 0);
      } else if (hour > 23) {
        return stop('no-reset-time');
      }
      const minute = minS ? Number(minS) : 0;
      if (minute > 59) return stop('no-reset-time');
      const w = wallClock(now, timeZone);
      if (mon) {
        const mo = MONTHS.indexOf(mon.toLowerCase()) + 1;
        if (!mo) return stop('no-reset-time');
        resetAt = fromWallClock(w.y, mo, Number(day), hour, minute, timeZone);
        // 年をまたぐ表示（12月に "Jan 2"）は翌年
        if (resetAt.getTime() < now.getTime() - 86400000) resetAt = fromWallClock(w.y + 1, mo, Number(day), hour, minute, timeZone);
      } else {
        resetAt = fromWallClock(w.y, w.mo, w.d, hour, minute, timeZone);
        if (resetAt.getTime() <= now.getTime()) resetAt = new Date(resetAt.getTime() + 86400000);
      }
    }
  } catch (e) {
    return stop('unknown-time-zone');
  }
  if (Number.isNaN(resetAt.getTime())) return stop('no-reset-time');
  // 解除の表示は読む人（オーナー）の時刻（既定 Asia/Tokyo）で書き、今日でなければ日付を添える
  const today = wallClock(now, dayZone);
  const rw = wallClock(resetAt, dayZone);
  resetLabel = hhmm(resetAt, dayZone) + (rw.y === today.y && rw.mo === today.mo && rw.d === today.d ? '' : `（${rw.mo}/${rw.d}）`);
  const waitSeconds = Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)) + Math.round((policy.margin_minutes || 0) * 60);
  if (waitSeconds > (policy.max_wait_minutes || 0) * 60) return stop('too-long', resetAt, resetLabel, waitSeconds);
  // 待ち終わりが日付をまたぐなら待たない（ラッパーは起動時の日付の記事を作る）
  const b = wallClock(new Date(now.getTime() + waitSeconds * 1000), dayZone);
  if (today.y !== b.y || today.mo !== b.mo || today.d !== b.d) return stop('next-day', resetAt, resetLabel, waitSeconds);
  return { limited: true, resetAt, resetLabel, waitSeconds, wait: true, reason: 'ok' };
}

/** ラッパー向けの1行 */
function formatLine(r) {
  if (!r.limited) return 'NONE';
  const label = r.resetLabel ? r.resetLabel.replace(/\s+/g, '_') : '-';
  return r.wait ? `WAIT ${r.waitSeconds} ${label}` : `NOWAIT ${r.reason} ${label}`;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const ni = args.indexOf('--now');
  const now = ni >= 0 ? new Date(args[ni + 1]) : new Date();
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { /* 読めなければ上限ではないとみなす */ }
  process.stdout.write(formatLine(parseUsageLimit(text, now, loadPolicy())) + '\n');
}

module.exports = { parseUsageLimit, formatLine, loadPolicy, DEFAULT_POLICY };
