#!/usr/bin/env node
'use strict';
/**
 * 3つの道と監査の履歴（S4-3・記録だけ）。
 * 計画: docs/plans/media-policy-2026-11/03-implementation-plan.md 1-4・S4-3。
 *
 * 事実台帳（data/journal_claims/<日付>.json）と独立した読み手の所見（<日付>.review.json）から、
 * 「本番の条件ならどの道を通るか」を決めて data/journal_audit/<日付>.json に残す。
 *   auto_publish … 停止条件0件。今と同じ流れで公開
 *   auto_fix     … 照合不能の文などがある。該当の文を「未確認」に書き直し／削って全部の検査をやり直す（最大2回）
 *   hold         … 核心の食い違い・閉店・行ったように見せる言い方・題の事実が照合不能 など。その日は出さない
 * 今は shadow（記録だけ）。公開は止めない。enforce は S4-5 の検証と本人の承認の後に、別の変更で配線する
 * （この道具は enforce と書かれていても shadow として動く）。
 *
 *   node scripts/journal_lane.js --date 2026-11-16
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return dflt; }
}

/** 純粋な判定。claims: 事実台帳、review: 読み手の記録（無くてよい）。 */
function decide({ claims, review = null }) {
  const reasons = [];
  if (!claims) return { lane: 'unknown', reasons: [{ type: 'no_claims_record', detail: '事実台帳が無いため判定できない' }], stop: [], fixable: [] };
  const stop = (claims.issues || []).filter((i) => i.severity === 'core').map((i) => ({ type: i.type, detail: i.detail }));
  const verifiedFindings = review && Array.isArray(review.findings) ? review.findings.filter((f) => f.verified) : [];
  for (const f of verifiedFindings) stop.push({ type: `review:${f.kind || 'other'}`, detail: `${f.sentence} ／ ${f.reason || ''}`.slice(0, 160) });
  const fixable = (claims.claims || [])
    .filter((c) => (c.status === '取得できず照合不能' || c.status === '古い') && c.kind !== '編集部の分析' && c.kind !== '未確認' && c.kind !== '口コミの数字')
    .map((c) => ({ type: c.status === '古い' ? 'stale' : 'unverifiable', detail: c.text.slice(0, 80) }));
  let lane = 'auto_publish';
  if (stop.length) lane = 'hold';
  else if (fixable.length) lane = 'auto_fix';
  reasons.push(...stop, ...fixable.slice(0, 20));
  return { lane, reasons, stop, fixable };
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--date');
  const date = i >= 0 ? argv[i + 1] : null;
  if (!date) { console.error('使い方: --date YYYY-MM-DD'); process.exit(2); }
  const policy = readJson(path.join(ROOT, 'data', 'journal_gate_policy.json'), {});
  const gate = policy.claims_gate || {};
  const mode = gate.mode || 'shadow';
  if (mode === 'off') { console.log('claims_gate=off のため記録しません'); return; }

  const claims = readJson(path.join(ROOT, 'data', 'journal_claims', `${date}.json`), null);
  const review = readJson(path.join(ROOT, 'data', 'journal_claims', `${date}.review.json`), null);
  const pub = readJson(path.join(ROOT, 'data', 'journal_published.json'), { entries: [] });
  const entry = (pub.entries || []).find((e) => e.date === date) || null;
  const d = decide({ claims, review });

  const audit = {
    date,
    slug: entry ? entry.slug : (claims && claims.slug) || null,
    recorded_at: new Date().toISOString(),
    mode,
    enforced: false,
    note: mode === 'enforce' ? 'enforce は未配線（S4-5 の承認後）。shadow として記録している' : '記録だけ。公開は止めていない',
    lane_if_enforced: d.lane,
    published: !!entry,
    published_by_lane: entry ? 'existing_gate' : null,
    reasons: d.reasons,
    checks: {
      validator: 'pass',
      claims: claims ? { ledger_by: claims.ledger_by, summary: claims.summary, fetch: claims.fetch_summary } : null,
      independent_review: review ? { ok: review.ok, reason: review.reason || null, model: review.model || null, prompt_version: review.prompt_version || null, findings: (review.findings || []).length, verified_findings: (review.findings || []).filter((f) => f.verified).length } : null,
    },
    score: entry && entry.gate_note ? entry.gate_note : null,
    sources: claims ? claims.sources : [],
    findings: review ? review.findings || [] : [],
  };
  const out = path.join(ROOT, 'data', 'journal_audit', `${date}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(`監査の履歴: 本番の条件なら「${d.lane}」（停止 ${d.stop.length}・自動修正 ${d.fixable.length}）→ ${path.relative(ROOT, out)}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(`journal_lane 失敗（公開は止めません）: ${e.message}`); process.exit(0); }
}

module.exports = { decide };
