#!/usr/bin/env node
/**
 * 消費者フィードバック → 改善ループ 決定的ヘルパー
 *
 * 設計（seo_triage.js / sync_backlog_to_notion.js と同じ思想）:
 *   - このスクリプトは「判断」をしない。3分類（UX改善/店舗事実/スパム）の判断は
 *     docs/feedback-triage-runbook.md の手順に従いエージェントが CLAUDE.md と
 *     data/feedback_policy.json を根拠に行う。
 *   - ここで持つのは決定的処理だけ: ID採番 / 重複検知（fingerprint + Gmail msg_id）/
 *     PIIマスク付きログ追記 / 健診レポート / ポリシー出力。
 *
 * サブコマンド:
 *   --next-id                    次の FB-NNN を返す（agent-backlog.md + ログを走査）
 *   --check-dup "<text>" [--msg-id <gmail-message-id>]
 *                                正規化テキスト（数値保持版）と msg_id を既存ログと照合。
 *                                msg_id 一致 = 同一メールの再処理（ログ追記も不要な完全スキップ対象）
 *   --unseen-msg-ids '<json配列>'  Gmail から拾った msg_id の集合を台帳と突合し、未処理分だけ返す。
 *                                広い窓（newer_than:7d 等）で毎日引いても再処理が起きないための
 *                                差分器（ISSUE-089: Gmail検索の偽陰性を翌日以降に自動回収する）
 *   --log-append '<json>'        entry(または配列)を feedback_log.json に追記。
 *                                追記前にメールアドレスを [email] にマスクし本文を500字で切詰め
 *   --health-write '<json>'      data/feedback_health.json（心拍）を書く。**0件の日も必ず書く**。
 *                                「Gmailを引けた」ことをリポジトリ側＝Macの外に残すためのもの
 *   --report [--days N] [--source site-widget]
 *                                verdict 別サマリ＋「採用済み未done」一覧
 *   --policy                     data/feedback_policy.json をそのまま出力（runbook が毎回読む）
 *
 * 出力は常に JSON（stdout）。エラーは {"ok":false,"error":...} で返す。
 *
 * ログ: data/feedback_log.json
 *   { "version": 1, "entries": [ { id, date, source, msg_id, page, store, category,
 *                                  feedback, verdict, brand_reason, backlog_category, fingerprint } ] }
 */

const fs = require('fs');
const path = require('path');

// 正規化 / fingerprint / 採番は scripts/lib/backlog_ids.js に一元化。
// フィードバックは「電話番号が違う」等、数値が指摘の識別子になるため keepNumbers で fingerprint する。
const { fingerprint, nextId: nextIdForPrefix } = require('./lib/backlog_ids');

const ROOT = path.resolve(__dirname, '..');
const BACKLOG_PATH = path.join(ROOT, 'agent-backlog.md');
const LOG_PATH = path.join(ROOT, 'data/feedback_log.json');
const POLICY_PATH = path.join(ROOT, 'data/feedback_policy.json');
const HEALTH_PATH = path.join(ROOT, 'data/feedback_health.json');

const FP_OPTS = { keepNumbers: true };
const FEEDBACK_MAX_LEN = 500;

// ──────────────────────────────────────────────────────────
// PII スクラブ（決定的・エージェントの注意力に依存しない）
// ──────────────────────────────────────────────────────────

function scrubPII(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .slice(0, FEEDBACK_MAX_LEN);
}

// ──────────────────────────────────────────────────────────
// ログ I/O
// ──────────────────────────────────────────────────────────

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return { version: 1, entries: [] };
  try {
    const data = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
    if (!Array.isArray(data.entries)) data.entries = [];
    return data;
  } catch (e) {
    return { version: 1, entries: [], _parse_error: e.message };
  }
}

function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
}

// ──────────────────────────────────────────────────────────
// ID 採番（lib/backlog_ids に委譲。backlog に加えログの id も走査対象に含める）
// ──────────────────────────────────────────────────────────

function logIdTexts() {
  return loadLog().entries.filter((e) => e.id).map((e) => e.id);
}

function nextId(offset = 0) {
  return nextIdForPrefix('FB', { offset, extraTexts: logIdTexts() });
}

// ──────────────────────────────────────────────────────────
// 重複検知（fingerprint + Gmail msg_id の二段構え）
// ──────────────────────────────────────────────────────────

function checkDup(text, msgId) {
  const fp = fingerprint(text, FP_OPTS);
  const log = loadLog();
  const msgHit = msgId ? log.entries.find((e) => e.msg_id && e.msg_id === msgId) : null;
  const fpHit = log.entries.find((e) => e.fingerprint === fp);
  return {
    fingerprint: fp,
    // same_message: 同一メールの再処理 → ログ追記も不要（完全スキップ）
    same_message: !!msgHit,
    // duplicate: 別メールだが同内容 → verdict:"duplicate" で軽量追記のみ
    duplicate: !!fpHit,
    existing: msgHit || fpHit || null,
  };
}

// ──────────────────────────────────────────────────────────
// 台帳突合（広い窓で毎日引いても再処理しないための差分器・ISSUE-089）
// ──────────────────────────────────────────────────────────

/**
 * Gmail から拾った msg_id 群を feedback_log.json の台帳と突合し、未処理分だけ返す。
 *
 * なぜ必要か: Gmail 検索は「実在するのに0件を返す」偽陰性を起こしうる（2026-08-17 に観測）。
 * 検索窓を広げて毎日引き直せば、ある日取りこぼしても翌日以降に自動で回収できる。
 * ただし広い窓は同じメールを何度も拾うため、「もう処理したか」を台帳で判定する必要がある。
 * ここは判断をせず、msg_id の集合差だけを機械的に返す（検証できる事実のみ・制約10）。
 */
function unseenMsgIds(ids) {
  const log = loadLog();
  const known = new Set(log.entries.filter((e) => e.msg_id).map((e) => e.msg_id));
  const uniq = [...new Set((ids || []).map(String).filter(Boolean))];
  return {
    total: uniq.length,
    seen: uniq.filter((id) => known.has(id)),
    unseen: uniq.filter((id) => !known.has(id)),
    ledger_size: known.size,
  };
}

// ──────────────────────────────────────────────────────────
// 心拍（data/feedback_health.json）
// ──────────────────────────────────────────────────────────

/**
 * 「今日このループが動き、Gmail を実際に引けた」ことを **リポジトリ側に** 残す。
 *
 * ISSUE-084 の教訓（警報を防音室で鳴らさない）の適用。フィードバックが0件の日は
 * コミットする成果物が何も無いため、心拍を書かないと「動いていない」と「新着が無い」が
 * 外から区別できない。0件の日こそ書く。判定側は scripts/check_feedback_health.js。
 */
function healthWrite(item) {
  const log = loadLog();
  const now = new Date();
  const jstDate = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const q = Array.isArray(item.queries) ? item.queries : [];

  const health = {
    version: 1,
    _comment:
      '消費者フィードバック改善ループの心拍。triage ルーチンが毎日（新着0件の日も）書き、' +
      'コミットで Mac の外＝GitHub へ出す。.github/workflows/feedback-watchdog.yml が鮮度を見て、' +
      '滞ったら Issue を起票する（＝オーナーにメール）。鮮度は自己申告できない（動いていない' +
      'エージェントはファイルを更新できない）ため、これが本体の検知シグナル。status/reason は' +
      '原因を人に運ぶための補助情報（ISSUE-084 原則5）。',
    last_run: {
      date: item.date || jstDate,
      recorded_at: now.toISOString(),
      // ok = Gmail を引けた（新着0件でも ok）/ gmail_error = 引けなかった（認証切れ・MCP障害等）
      status: item.status === 'gmail_error' ? 'gmail_error' : 'ok',
      reason: item.reason || null,
      queries: q.map((x) => ({ q: String(x.q || ''), matched: Number(x.matched) || 0 })),
      retried_on_empty: !!item.retried_on_empty,
      // 台帳突合の結果。late_recovered > 0 は「過去に取りこぼしたメールを今日回収した」＝偽陰性の実測
      new_processed: Number(item.new_processed) || 0,
      already_seen: Number(item.already_seen) || 0,
      late_recovered: Number(item.late_recovered) || 0,
      log_entries_total: log.entries.length,
    },
  };
  fs.writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2) + '\n');
  return health;
}

// ──────────────────────────────────────────────────────────
// レポート（ループ健診）
// ──────────────────────────────────────────────────────────

/** agent-backlog.md から各 FB-ID の status を読む（done 判定用） */
function backlogStatusById() {
  const map = {};
  if (!fs.existsSync(BACKLOG_PATH)) return map;
  const md = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const lines = md.split('\n');
  let curId = null;
  for (const line of lines) {
    const h = line.match(/^###\s+\[(FB-\d+)\]/);
    if (h) { curId = h[1]; map[curId] = map[curId] || 'unknown'; continue; }
    if (curId) {
      const st = line.match(/\*\*status\*\*\s*[:：]\s*([a-z_]+)/);
      if (st) { map[curId] = st[1]; }
      if (line.startsWith('### ') || line.startsWith('## ')) curId = null;
    }
  }
  return map;
}

const VERDICTS = ['adopted', 'fact_check', 'rejected', 'duplicate', 'escalated'];

function report(days, sourceFilter) {
  const log = loadLog();
  let entries = log.entries;
  if (days && Number.isFinite(days)) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    entries = entries.filter((e) => (e.date || '') >= cutoff);
  }
  if (sourceFilter) {
    entries = entries.filter((e) => (e.source || 'site-widget') === sourceFilter);
  }

  const totals = { total: entries.length };
  for (const v of VERDICTS) totals[v] = entries.filter((e) => e.verdict === v).length;

  // 却下理由の内訳（brand_reason の先頭フレーズで粗く集計）
  const rejectReasons = {};
  for (const e of entries.filter((x) => x.verdict === 'rejected')) {
    const key = (e.brand_reason || '理由未記録').split(/[—\-。:：]/)[0].trim().slice(0, 40) || '理由未記録';
    rejectReasons[key] = (rejectReasons[key] || 0) + 1;
  }

  // 起票したのに未 done の課題（ループが詰まっている兆候）。fact_check も起票されるので対象。
  const status = backlogStatusById();
  const ticketed = entries.filter((e) => e.id && (e.verdict === 'adopted' || e.verdict === 'fact_check'));
  const openTickets = ticketed
    .filter((e) => status[e.id] !== 'done' && status[e.id] !== 'wont_fix')
    .map((e) => ({ id: e.id, date: e.date, verdict: e.verdict, status: status[e.id] || 'not_in_backlog', feedback: e.feedback }));

  // カテゴリ別内訳（利用者が選んだ種類の分布 = どこが不満の集中点かの健診）
  const byCategory = {};
  for (const e of entries) {
    const c = e.category || '未分類';
    byCategory[c] = (byCategory[c] || 0) + 1;
  }

  return {
    ok: true,
    window: days ? `直近${days}日` : '全期間',
    source: sourceFilter || 'all',
    totals,
    by_category: byCategory,
    reject_reasons: rejectReasons,
    open_tickets: openTickets,
    tickets_done: ticketed.filter((e) => status[e.id] === 'done').length,
  };
}

// ──────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--policy')) {
    try {
      out({ ok: true, policy: JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8')) });
    } catch (e) {
      out({ ok: false, error: 'policy read failed: ' + e.message });
      process.exit(1);
    }
    return;
  }

  if (args.includes('--next-id')) {
    out({ ok: true, next_id: nextId() });
    return;
  }

  if (args.includes('--check-dup')) {
    const i = args.indexOf('--check-dup');
    const text = args[i + 1];
    if (text === undefined) { out({ ok: false, error: '--check-dup requires feedback text' }); process.exit(1); }
    let msgId = null;
    const mi = args.indexOf('--msg-id');
    if (mi >= 0 && args[mi + 1]) msgId = args[mi + 1];
    out({ ok: true, ...checkDup(text, msgId) });
    return;
  }

  if (args.includes('--unseen-msg-ids')) {
    const i = args.indexOf('--unseen-msg-ids');
    const raw = args[i + 1];
    if (raw === undefined) { out({ ok: false, error: '--unseen-msg-ids requires a JSON array' }); process.exit(1); }
    let ids;
    try { ids = JSON.parse(raw); }
    catch (e) { out({ ok: false, error: 'invalid JSON: ' + e.message }); process.exit(1); }
    if (!Array.isArray(ids)) { out({ ok: false, error: '--unseen-msg-ids expects a JSON array' }); process.exit(1); }
    out({ ok: true, ...unseenMsgIds(ids) });
    return;
  }

  if (args.includes('--health-write')) {
    const i = args.indexOf('--health-write');
    const raw = args[i + 1];
    if (raw === undefined) { out({ ok: false, error: '--health-write requires JSON' }); process.exit(1); }
    let item;
    try { item = JSON.parse(raw); }
    catch (e) { out({ ok: false, error: 'invalid JSON: ' + e.message }); process.exit(1); }
    out({ ok: true, health: healthWrite(item || {}) });
    return;
  }

  if (args.includes('--log-append')) {
    const i = args.indexOf('--log-append');
    const raw = args[i + 1];
    if (raw === undefined) { out({ ok: false, error: '--log-append requires JSON' }); process.exit(1); }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { out({ ok: false, error: 'invalid JSON: ' + e.message }); process.exit(1); }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const log = loadLog();
    const appended = [];
    for (const item of items) {
      const feedback = scrubPII(item.feedback || '');
      const entry = {
        id: item.id || null,
        date: item.date || new Date().toISOString().slice(0, 10),
        source: item.source || 'site-widget',
        msg_id: item.msg_id || null,
        page: scrubPII(item.page || '').slice(0, 200) || null,
        store: item.store ? scrubPII(item.store).slice(0, 60) : null,
        category: item.category || null,
        feedback,
        verdict: VERDICTS.includes(item.verdict) ? item.verdict : 'rejected',
        brand_reason: item.brand_reason || '',
        backlog_category: item.backlog_category || null,
        fingerprint: item.fingerprint || fingerprint(item.feedback || '', FP_OPTS),
      };
      log.entries.push(entry);
      appended.push(entry);
    }
    saveLog(log);
    out({ ok: true, appended: appended.length, entries_total: log.entries.length });
    return;
  }

  if (args.includes('--report')) {
    let days = null;
    const di = args.indexOf('--days');
    if (di >= 0 && args[di + 1]) days = parseInt(args[di + 1], 10);
    let source = null;
    const si = args.indexOf('--source');
    if (si >= 0 && args[si + 1]) source = args[si + 1];
    out(report(days, source));
    return;
  }

  out({
    ok: false,
    error: 'no subcommand',
    usage: [
      '--next-id',
      '--check-dup "<text>" [--msg-id <gmail-message-id>]',
      '--unseen-msg-ids \'["<gmail-msg-id>", ...]\'',
      "--log-append '<json>'",
      "--health-write '<json>'",
      '--report [--days N] [--source site-widget]',
      '--policy',
    ],
  });
  process.exit(1);
}

if (require.main === module) main();

module.exports = { nextId, checkDup, report, scrubPII, unseenMsgIds, healthWrite };
