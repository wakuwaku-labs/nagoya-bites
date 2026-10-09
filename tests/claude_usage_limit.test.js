'use strict';
// ISSUE-184: 日次ジャーナルが Claude の利用上限で止まったとき、出力の文から解除時刻を読み、
// 待てる範囲なら解除まで待って作り直し、待たないときは理由に「利用上限（解除 HH:MM）」を書く
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseUsageLimit, formatLine, loadPolicy, DEFAULT_POLICY } = require('../scripts/lib/claude_usage_limit');

const ROOT = path.join(__dirname, '..');
const P = { ...DEFAULT_POLICY, max_wait_minutes: 330, margin_minutes: 3, default_time_zone: 'Asia/Tokyo' };
const at = (iso) => new Date(iso);
// 2026-10-09 09:00 の launchd 実行のログに出た文（~/nagoya-bites/.local-logs/journal-2026-10-09.log）
const OBSERVED = "You've hit your session limit · resets 11:10am (Asia/Tokyo)";

test('10-09 に出た文は 11:10 の解除まで（余裕3分を足して）待つ', () => {
  const r = parseUsageLimit(OBSERVED, at('2026-10-09T09:00:16+09:00'), P);
  assert.strictEqual(r.limited, true);
  assert.strictEqual(r.wait, true);
  assert.strictEqual(r.resetLabel, '11:10');
  assert.strictEqual(r.resetAt.toISOString(), '2026-10-09T02:10:00.000Z');
  assert.strictEqual(r.waitSeconds, 7964); // 2時間9分44秒 + 3分
  assert.strictEqual(formatLine(r), 'WAIT 7964 11:10');
});

test('ほかの表示の形も読む（will reset at / 月日つき / 24時間 / UNIX 時刻）', () => {
  const now = at('2026-10-09T09:00:00+09:00');
  const a = parseUsageLimit('Claude usage limit reached. Your limit will reset at 1pm (Asia/Tokyo).', now, P);
  assert.deepStrictEqual([a.wait, a.resetLabel, a.waitSeconds], [true, '13:00', 4 * 3600 + 180]);
  const b = parseUsageLimit('5-hour limit reached ∙ resets 12:30', now, P);
  assert.deepStrictEqual([b.wait, b.resetLabel], [true, '12:30']);
  const c = parseUsageLimit("You've hit your weekly limit · resets Oct 13, 9am (Asia/Tokyo)", now, P);
  assert.deepStrictEqual([c.wait, c.reason, c.resetLabel], [false, 'too-long', '09:00（10/13）']);
  assert.strictEqual(c.resetAt.toISOString(), '2026-10-13T00:00:00.000Z');
  const d = parseUsageLimit(`Claude AI usage limit reached|${Date.parse('2026-10-09T11:00:00+09:00') / 1000}`, now, P);
  assert.deepStrictEqual([d.wait, d.resetLabel, d.waitSeconds], [true, '11:00', 2 * 3600 + 180]);
  // タイムゾーンの書かれていない表示は既定（Asia/Tokyo）で読む
  const e = parseUsageLimit("You've hit your session limit · resets 10am", now, P);
  assert.deepStrictEqual([e.wait, e.resetLabel], [true, '10:00']);
  // 別のタイムゾーンで書かれた時刻も実際の時刻に直す（ニューヨークの 22:00 = 東京の翌 11:00）
  const f = parseUsageLimit("You've hit your session limit · resets 10pm (America/New_York)", now, P);
  assert.strictEqual(f.resetAt.toISOString(), '2026-10-09T02:00:00.000Z');
  assert.deepStrictEqual([f.wait, f.resetLabel], [true, '11:00']); // 表示は東京の時刻
});

test('待たないとき: 上限を超える・日付をまたぐ・時刻が読めない・タイムゾーンが不正', () => {
  // その日の解除時刻を過ぎた表示は翌日の同じ時刻 → 待つ上限（330分）を超える
  const late = parseUsageLimit("You've hit your session limit · resets 9am (Asia/Tokyo)", at('2026-10-09T10:00:00+09:00'), P);
  assert.deepStrictEqual([late.wait, late.reason, late.resetLabel], [false, 'too-long', '09:00（10/10）']);
  assert.strictEqual(formatLine(late), 'NOWAIT too-long 09:00（10/10）');
  // 330分以内でも、待ち終わりが日付をまたぐなら待たない（ラッパーは起動時の日付の記事を作る）
  const night = parseUsageLimit("You've hit your session limit · resets 1:30am (Asia/Tokyo)", at('2026-10-09T21:00:00+09:00'), P);
  assert.deepStrictEqual([night.wait, night.reason, night.resetLabel], [false, 'next-day', '01:30（10/10）']);
  // 解除時刻が無い・午前午後も分も無い数字は時刻と決めない
  for (const s of ["You've hit your session limit", "You've hit your session limit · resets in 5 hours", 'usage limit reached, resets 5']) {
    const r = parseUsageLimit(s, at('2026-10-09T09:00:00+09:00'), P);
    assert.deepStrictEqual([r.limited, r.wait, r.reason], [true, false, 'no-reset-time'], s);
    assert.strictEqual(formatLine(r), 'NOWAIT no-reset-time -');
  }
  const tz = parseUsageLimit("You've hit your session limit · resets 11:10am (Mars/Olympus)", at('2026-10-09T09:00:00+09:00'), P);
  assert.deepStrictEqual([tz.wait, tz.reason], [false, 'unknown-time-zone']);
  // 待つ上限は設定で変わる（4時間にすると 13:10 の解除は待たない）
  const short = parseUsageLimit("You've hit your session limit · resets 1:10pm (Asia/Tokyo)", at('2026-10-09T09:00:00+09:00'), { ...P, max_wait_minutes: 240 });
  assert.deepStrictEqual([short.wait, short.reason], [false, 'too-long']);
});

test('利用上限ではない失敗（レート制限・ネットワーク・認証）は NONE', () => {
  const now = at('2026-10-09T09:00:00+09:00');
  for (const s of [
    'API Error: 429 rate limit reached',
    "API Error: Can't reach the API server — check your internet or DNS (ENOTFOUND)",
    'Invalid authentication credentials',
    'Connection closed mid-response',
    '',
  ]) {
    assert.strictEqual(formatLine(parseUsageLimit(s, now, P)), 'NONE', s);
  }
});

test('CLI はファイルを読んで1行を返し、読めないファイルは NONE', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-limit-'));
  const f = path.join(dir, 'out.txt');
  fs.writeFileSync(f, `claude 終了コード: 1\n${OBSERVED}\n`);
  const cli = path.join(ROOT, 'scripts', 'lib', 'claude_usage_limit.js');
  const run = (...a) => execFileSync(process.execPath, [cli, ...a], { encoding: 'utf8' });
  assert.strictEqual(run(f, '--now', '2026-10-09T09:00:16+09:00'), 'WAIT 7964 11:10\n');
  assert.strictEqual(run(path.join(dir, 'none.txt')), 'NONE\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('設定は data/journal_gate_policy.json の usage_limit_retry から読み、壊れていれば既定値', () => {
  const p = loadPolicy();
  assert.ok(p.max_wait_minutes >= 300, '5時間のセッション上限の窓を待てる値');
  assert.ok(p.max_waits_per_run >= 1);
  assert.ok(Intl.DateTimeFormat(undefined, { timeZone: p.default_time_zone }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-limit-'));
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{');
  assert.deepStrictEqual(loadPolicy(bad), DEFAULT_POLICY);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ラッパーの関数そのものを、時計とスリープを差し替えて動かす（実際には待たない）
function runWaitHarness({ msg, dayChangesAfter = 0 }) {
  const sh = fs.readFileSync(path.join(ROOT, 'scripts', 'run_journal_local.sh'), 'utf8');
  const s = sh.indexOf('USAGE_LIMIT_WAITS=0');
  const e = sh.indexOf('\n}\n', sh.indexOf('usage_limit_wait() {')) + 3;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-wait-'));
  fs.writeFileSync(path.join(dir, 'fn.sh'), sh.slice(s, e));
  fs.writeFileSync(path.join(dir, 'msg.txt'), msg);
  const lock = path.join(dir, 'run.lock');
  fs.writeFileSync(lock, '1');
  fs.utimesSync(lock, new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'));
  const harness = [
    'set -uo pipefail',
    'cd "$H_ROOT"',
    'LOG_DIR="$H_DIR"; LOG="$H_DIR/h.log"; : > "$LOG"; LOCKFILE="$H_LOCK"',
    'TODAY_JST="$(TZ=Asia/Tokyo command date +%Y-%m-%d)"',
    'FAKE_NOW=$(command date +%s); SLEPT=0; CALLS=0; FAKE_DAY=""',
    'log() { echo "LOG: $*"; }',
    'hold() { echo "HOLD: $1"; echo "calls=$CALLS slept=$SLEPT"; exit 3; }',
    'caffeinate() { CALLS=$((CALLS + 1)); SLEPT=$((SLEPT + $4)); FAKE_NOW=$((FAKE_NOW + $4)); if [ "$H_DAY_AFTER" -gt 0 ] && [ "$CALLS" -ge "$H_DAY_AFTER" ]; then FAKE_DAY=2099-01-01; fi; return 0; }',
    'date() { if [ "${1:-}" = "+%s" ]; then echo "$FAKE_NOW"; elif [ -n "$FAKE_DAY" ]; then echo "$FAKE_DAY"; else command date "$@"; fi; }',
    'source "$H_DIR/fn.sh"',
    'usage_limit_wait "$(cat "$H_DIR/msg.txt")" "生成の試行 1"; echo "rc=$? waits=$USAGE_LIMIT_WAITS calls=$CALLS slept=$SLEPT"',
  ].join('\n');
  const env = { ...process.env, H_ROOT: ROOT, H_DIR: dir, H_LOCK: lock, H_DAY_AFTER: String(dayChangesAfter) };
  let out = '';
  let status = 0;
  try {
    out = execFileSync('bash', ['-c', harness], { encoding: 'utf8', env });
  } catch (err) {
    out = String(err.stdout || '');
    status = err.status;
  }
  const lockTouched = fs.statSync(lock).mtime.getUTCFullYear() > 2000;
  fs.rmSync(dir, { recursive: true, force: true });
  return { out, status, lockTouched };
}

test('ラッパーは1分ずつ壁時計で待ってロックを新しく保ち、待っている間に日付が変わったら作り直さない', () => {
  // 解除は今から10分後（東京の時刻で書く）
  const reset = new Date(Date.now() + 10 * 60 * 1000);
  const label = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(reset).replace(/\s/g, '').toLowerCase();
  const msg = `You've hit your session limit · resets ${label} (Asia/Tokyo)`;
  const expect = parseUsageLimit(msg, new Date(), loadPolicy());
  if (!expect.wait) {
    // 23:47 以降に走らせたときは待ち終わりが日付をまたぐので、待たずに HOLD になる
    const r = runWaitHarness({ msg });
    assert.strictEqual(r.status, 3, r.out);
    assert.ok(r.out.includes('HOLD: Claude の利用上限（解除 '), r.out);
    return;
  }
  const a = runWaitHarness({ msg });
  assert.strictEqual(a.status, 0, a.out);
  const m = a.out.match(/rc=0 waits=1 calls=(\d+) slept=(\d+)/);
  assert.ok(m, a.out);
  // 待った合計は解除までの秒数（判定器の値。±数秒は実行の間に進んだ時計の分）、1回は60秒まで
  assert.ok(Math.abs(Number(m[2]) - expect.waitSeconds) <= 5, `${m[2]} vs ${expect.waitSeconds}`);
  assert.strictEqual(Number(m[1]), Math.ceil(Number(m[2]) / 60));
  assert.ok(a.lockTouched, '待っている間にロックの時刻を新しくする');
  assert.ok(a.out.includes(`LOG: ⏳ Claude の利用上限に達しています（生成の試行 1・解除 ${expect.resetLabel}）`), a.out);
  // 2回目の1分が終わった所で日付が変わる → 作り直さずに HOLD（理由に「利用上限」）
  const b = runWaitHarness({ msg, dayChangesAfter: 2 });
  assert.strictEqual(b.status, 3, b.out);
  assert.ok(b.out.includes(`HOLD: Claude の利用上限（解除 ${expect.resetLabel}）を待っている間に日付が変わりました（生成の試行 1）`), b.out);
  assert.ok(b.out.includes('calls=2 slept=120'), b.out);
});

test('ラッパーがプリフライトと生成の両方で利用上限を判定し、watchdog が理由で呼び分ける', () => {
  const sh = fs.readFileSync(path.join(ROOT, 'scripts', 'run_journal_local.sh'), 'utf8');
  execFileSync('bash', ['-n', path.join(ROOT, 'scripts', 'run_journal_local.sh')]);
  assert.ok(sh.includes('node scripts/lib/claude_usage_limit.js'));
  assert.ok(sh.includes('usage_limit_wait "$PREFLIGHT_OUT" "プリフライト"'));
  assert.ok(/usage_limit_wait "\$\(tail -c \+\$\(\(ATTEMPT_LOG_START \+ 1\)\) "\$LOG"\)"/.test(sh));
  // HOLD の理由に「利用上限（解除 HH:MM）」の形が入る
  assert.ok(sh.includes('hold "Claude の利用上限（解除 ${label}）で生成できませんでした'));
  // 利用上限の判定は、認証エラーで諦める判定より前に置く（上限の文で認証扱いにしない）
  assert.ok(sh.indexOf('"生成の試行 ${CLAUDE_ATTEMPT}"') < sh.indexOf('認証エラーを検出。'));
  const wd = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'journal-watchdog.yml'), 'utf8');
  assert.ok(wd.includes("holdReason.includes('利用上限') ? 'hold（Claude の利用上限）'"));
  assert.ok(wd.includes("holdReason.includes('validator') ? 'hold（品質HOLD）'"));
});
