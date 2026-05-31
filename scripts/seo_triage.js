#!/usr/bin/env node
/**
 * SEO AIアドバイス → 改善ループ 決定的ヘルパー
 *
 * 設計（sync_backlog_to_notion.js と同じ思想）:
 *   - このスクリプトは「判断」をしない。ブランドフィルター（採用/却下）の判断は
 *     /seo-triage コマンド（エージェント）が CLAUDE.md の Moat/Strategic Skip を根拠に行う。
 *   - ここで持つのは決定的処理だけ: ID採番 / 重複検知 / ログ追記 / 健診レポート。
 *
 * サブコマンド:
 *   --next-id                  次の SEO-NNN を返す（agent-backlog.md + ログを走査）
 *   --check-dup "<advice>"     正規化テキストを既存ログと照合。重複なら既存entryを返す
 *   --log-append '<json>'      entry(または配列)を seo_advice_log.json に追記
 *   --report [--days N]        採用/却下サマリ＋「採用済み未done」一覧を出力
 *
 * 出力は常に JSON（stdout）。エラーは {"ok":false,"error":...} で返す。
 *
 * ログ: data/seo_advice_log.json
 *   { "version": 1, "entries": [ { id, date, source, advice, verdict, brand_reason, category, fingerprint } ] }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BACKLOG_PATH = path.join(ROOT, 'agent-backlog.md');
const LOG_PATH = path.join(ROOT, 'data/seo_advice_log.json');

// ──────────────────────────────────────────────────────────
// 正規化 & fingerprint
// ──────────────────────────────────────────────────────────

/**
 * アドバイス文を「同種判定」用に正規化する。
 * - 絵文字 / 記号 / 数字を畳む（「流入12%」「流入15%」を同種扱いにする）
 * - 空白を畳む、小文字化
 * 数値を落とすのは意図的: SEOアドバイスは毎日数値だけ変えて同じ施策を繰り返すため。
 */
function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, ' ') // 絵文字・矢印
    .replace(/[0-9０-９]+(\.[0-9]+)?\s*[%％件人軒日週月]?/g, ' ') // 数値+単位を落とす
    .replace(/[「」『』（）()【】\[\]、。,.・:：\/／…\-—~〜!！?？\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function fingerprint(text) {
  return crypto.createHash('sha1').update(normalize(text)).digest('hex').slice(0, 16);
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
// ID 採番
// ──────────────────────────────────────────────────────────

function maxSeoNum() {
  let max = 0;
  const scan = (text) => {
    const re = /SEO-(\d+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  };
  if (fs.existsSync(BACKLOG_PATH)) scan(fs.readFileSync(BACKLOG_PATH, 'utf8'));
  const log = loadLog();
  for (const e of log.entries) if (e.id) scan(e.id);
  return max;
}

function nextId(offset = 0) {
  const n = maxSeoNum() + 1 + offset;
  return 'SEO-' + String(n).padStart(3, '0');
}

// ──────────────────────────────────────────────────────────
// 重複検知
// ──────────────────────────────────────────────────────────

function checkDup(advice) {
  const fp = fingerprint(advice);
  const log = loadLog();
  const hit = log.entries.find((e) => e.fingerprint === fp);
  return { fingerprint: fp, duplicate: !!hit, existing: hit || null };
}

// ──────────────────────────────────────────────────────────
// レポート（ループ健診）
// ──────────────────────────────────────────────────────────

/** agent-backlog.md から各 SEO-ID の status を読む（done 判定用） */
function backlogStatusById() {
  const map = {};
  if (!fs.existsSync(BACKLOG_PATH)) return map;
  const md = fs.readFileSync(BACKLOG_PATH, 'utf8');
  const lines = md.split('\n');
  let curId = null;
  for (const line of lines) {
    const h = line.match(/^###\s+\[(SEO-\d+)\]/);
    if (h) { curId = h[1]; map[curId] = map[curId] || 'unknown'; continue; }
    if (curId) {
      const st = line.match(/\*\*status\*\*\s*[:：]\s*([a-z_]+)/);
      if (st) { map[curId] = st[1]; }
      if (line.startsWith('### ') || line.startsWith('## ')) curId = null;
    }
  }
  return map;
}

function report(days) {
  const log = loadLog();
  let entries = log.entries;
  if (days && Number.isFinite(days)) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    entries = entries.filter((e) => (e.date || '') >= cutoff);
  }
  const adopted = entries.filter((e) => e.verdict === 'adopted');
  const rejected = entries.filter((e) => e.verdict === 'rejected');
  const duplicates = entries.filter((e) => e.verdict === 'duplicate');

  // 却下理由の内訳（brand_reason の先頭フレーズで粗く集計）
  const rejectReasons = {};
  for (const e of rejected) {
    const key = (e.brand_reason || '理由未記録').split(/[—\-。:：]/)[0].trim().slice(0, 40) || '理由未記録';
    rejectReasons[key] = (rejectReasons[key] || 0) + 1;
  }

  // 採用したのに未 done の課題（ループが詰まっている兆候）
  const status = backlogStatusById();
  const adoptedOpen = adopted
    .filter((e) => e.id && status[e.id] !== 'done')
    .map((e) => ({ id: e.id, date: e.date, status: status[e.id] || 'not_in_backlog', advice: e.advice }));

  return {
    ok: true,
    window: days ? `直近${days}日` : '全期間',
    totals: {
      adopted: adopted.length,
      rejected: rejected.length,
      duplicates: duplicates.length,
      total: entries.length,
    },
    reject_reasons: rejectReasons,
    adopted_open: adoptedOpen,
    adopted_done: adopted.filter((e) => e.id && status[e.id] === 'done').length,
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

  if (args.includes('--next-id')) {
    out({ ok: true, next_id: nextId() });
    return;
  }

  if (args.includes('--check-dup')) {
    const i = args.indexOf('--check-dup');
    const advice = args[i + 1];
    if (advice === undefined) { out({ ok: false, error: '--check-dup requires advice text' }); process.exit(1); }
    out({ ok: true, ...checkDup(advice) });
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
      const entry = {
        id: item.id || null,
        date: item.date || new Date().toISOString().slice(0, 10),
        source: item.source || 'line-daily',
        advice: item.advice || '',
        verdict: item.verdict || 'adopted',
        brand_reason: item.brand_reason || '',
        category: item.category || null,
        fingerprint: item.fingerprint || fingerprint(item.advice || ''),
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
    out(report(days));
    return;
  }

  out({
    ok: false,
    error: 'no subcommand',
    usage: ['--next-id', '--check-dup "<advice>"', "--log-append '<json>'", '--report [--days N]'],
  });
  process.exit(1);
}

if (require.main === module) main();

module.exports = { normalize, fingerprint, nextId, checkDup, report };
