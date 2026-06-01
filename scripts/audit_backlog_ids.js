#!/usr/bin/env node
/**
 * agent-backlog.md 重複ID監査（audit_isnagoya_filter.js / audit_manual_stores_links.js と同型）
 *
 * 並列エージェント・複数 workflow が同じ番号で起票する事故（ISSUE-048 / ISSUE-059 等で実発生）を
 * CI と Stop hook で機械検知する。lib/backlog_ids.js の findDuplicateIds() を使う。
 *
 * 運用方針:
 *   - KNOWN_DUPLICATES（既知の歴史的重複）は許容（非ブロッキング）。
 *     これらは Notion page_id_map 整合を伴うため /solve-next の YES ゲート経由で1件ずつ解消する。
 *   - 新規に発生した重複だけ exit 1 で落とす（並列起票の再発を止める防壁）。
 *   - 既知IDが解消されたら stale_whitelist で検知 → KNOWN_DUPLICATES から外すよう促す（WL肥大化防止）。
 *
 * CLI:
 *   （引数なし）  新規重複があれば exit 1、なければ exit 0
 *   --json        結果を /tmp/backlog_ids_audit.json にも書き出す
 */

const fs = require('fs');
const { findDuplicateIds } = require('./lib/backlog_ids');

// 既知の重複（2026-06-02 棚卸し時点・並列起票の歴史的残骸）。解消したらこの配列から外す。
const KNOWN_DUPLICATES = ['ISSUE-007', 'ISSUE-018', 'ISSUE-048', 'STR-001'];

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const dups = findDuplicateIds(); // { id: [行番号...] }
  const allDupIds = Object.keys(dups);
  const known = allDupIds.filter((id) => KNOWN_DUPLICATES.includes(id));
  const novel = allDupIds.filter((id) => !KNOWN_DUPLICATES.includes(id));
  const stale = KNOWN_DUPLICATES.filter((id) => !allDupIds.includes(id)); // 解消済みなのにWLに残存

  const result = {
    ok: novel.length === 0,
    duplicate_total: allDupIds.length,
    known_allowed: known.map((id) => ({ id, lines: dups[id] })),
    novel_violations: novel.map((id) => ({ id, lines: dups[id] })),
    stale_whitelist: stale,
  };

  if (args.includes('--json')) {
    try {
      fs.writeFileSync('/tmp/backlog_ids_audit.json', JSON.stringify(result, null, 2) + '\n');
      result.json_path = '/tmp/backlog_ids_audit.json';
    } catch (e) {
      result._json_write_error = e.message;
    }
  }

  out(result);

  if (stale.length > 0) {
    console.error(`[audit_backlog_ids] WL掃除推奨: 既に解消済みのID ${stale.join(', ')} を KNOWN_DUPLICATES から外せます。`);
  }

  if (novel.length > 0) {
    console.error(`\n[audit_backlog_ids] 新規の重複IDを ${novel.length} 件検出: ${novel.join(', ')}`);
    console.error('→ lib/backlog_ids.js の nextId(prefix) で採番し直すか、片方を別IDにリネームしてください。');
    process.exit(1);
  }
}

main();

module.exports = { KNOWN_DUPLICATES };
