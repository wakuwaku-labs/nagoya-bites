#!/usr/bin/env node
/**
 * GAS 反映状況の判定器（SEO-069）— 判定ロジックはこの1本に集約する。
 *
 * 設計（photo_policy.js / trust_display.js と同じ思想）:
 *   - このライブラリは「判断」だけを持ち、取得も通知もしない。
 *   - 記録（check_gas_deploy_health.js --record）・検査（--check）・CI（gas-deploy-watchdog.yml）が
 *     同じ判定を共有する。基準の変更は data/gas_deploy_policy.json で行い、このファイルは触らない。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ レポート本文に現れる文字列  … 誰でも同じメールを開いて目視で検算できる。
 *                                    しかも「新コードでは原理的に出力できない文字列」
 *                                    （旧 sourceToName の最終行 `s + ' / ' + m` の生出力）を
 *                                    使うので、片方向の証明になる。
 *   × 「デプロイしたはず」「たぶん反映済み」… 自己申告。一切使わない。
 *
 * 3値で返すことが肝（2値にしない）:
 *   not_deployed  … 旧コードでしか出ない痕跡が出た。**確定**
 *   deployed      … 新コードでしか出ない痕跡が出た。**確定**
 *   indeterminate … どちらも出なかった。その日のデータが分岐を通らなかっただけで、**異常ではない**。
 *                   ここを not_deployed に丸めると、GA4しきい値が効かなかった日に誤って
 *                   警報が鳴り、オオカミ少年化する（ISSUE-084 原則6）。
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(REPO, 'data', 'gas_deploy_policy.json');

function loadPolicy(p = POLICY_PATH) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * 流入元セクションの「データ行」だけを抜き出す。
 *
 * なぜここまで絞るか（2026-08-24 の実測で誤検知を1件出したため）:
 *   最初の実装はセクションの終端を「次の【…】見出し」だけで判定していた。ところが日次メールの
 *   アドバイス欄は `💡 今日のアドバイス` と【】を使わない見出しで始まるため、アドバイス本文が
 *   流入元セクションに飲み込まれ、**アドバイス文中の `(not set)` という単語だけで
 *   「旧コードで動いている」と誤判定した**。watchdog に載せれば、そのままオオカミ少年になる
 *   （ISSUE-084 原則6）。
 *
 *   そこで終端条件を増やし（空行・区切り線・別見出し）、さらに **行の形**でも絞る。
 *   ただし行の形を「順位絵文字で始まること」にしてはいけない——Gmail のプレーンテキスト変換で
 *   🥇🥈🥉 は U+FFFD に化ける（2026-08-24 実測）。絵文字を条件にすると、実運用の入力で
 *   全行が落ちて **検知が静かに死ぬ**（未反映なのに indeterminate を返し続ける）。
 *   そこで transport に影響されない「数値+単位」の形（`（16訪問 / 31%）`『（29%）』）を条件にする。
 *   散文はこの形にならないため、本文のどこに同じ語が出ても拾わない。
 */
function extractSourceLines(body, policy) {
  const headings = policy.source_section_headings || [];
  const rowRe = new RegExp(policy.source_row_pattern || '（\\s*[0-9０-９]+\\s*(?:訪問|%|％)');
  const lines = String(body || '').split(/\r?\n/);
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (headings.some((h) => line.includes(h))) { inside = true; continue; }
    if (!inside) continue;

    const t = line.trim();
    // 終端: 空行 / 区切り線 / 別の【】見出し / 【】を使わない見出し（💡📈🏁 等で始まる行）
    if (t === '' || /^[━─=\-]{3,}$/.test(t) || /^【.+】/.test(t) || /^[💡📈🏁📊]/.test(t)) { inside = false; continue; }

    // 行の形が「順位付きデータ行」でなければ拾わない
    if (!rowRe.test(line)) continue;
    out.push(line);
  }
  return out;
}

/**
 * レポート本文1通を判定する。
 * @param {string} body   メール本文（プレーンテキスト）
 * @param {object} policy data/gas_deploy_policy.json
 * @returns {{verdict:string, matched:Array, missing_fixes:Array, source_lines:Array}}
 */
function analyzeReport(body, policy = loadPolicy()) {
  const text = String(body || '');
  const sourceLines = extractSourceLines(text, policy);
  const sourceText = sourceLines.join('\n');
  const matched = [];

  for (const sig of policy.signals || []) {
    const haystack = sig.scope === 'source_lines' ? sourceText : text;
    let re;
    try {
      re = new RegExp(sig.pattern, 'i');
    } catch (e) {
      continue; // 壊れた正規表現でループ全体を落とさない
    }
    const m = haystack.match(re);
    if (m) {
      matched.push({
        key: sig.key,
        fix_id: sig.fix_id,
        verdict: sig.verdict,
        evidence: m[0],
        // 証跡として、その痕跡を含む行そのものを残す（第三者が検算できるように）
        line: (haystack.split(/\r?\n/).find((l) => re.test(l)) || '').trim().slice(0, 200),
        reason: sig.reason,
      });
    }
  }

  const notDeployed = matched.filter((m) => m.verdict === 'not_deployed');
  const deployed = matched.filter((m) => m.verdict === 'deployed');

  // 旧コードの痕跡は「新コードでは原理的に出せない文字列」なので、1つでも出れば確定。
  // 両方出た場合も not_deployed を優先する（片方は条件付きでしか出ない片側シグナルのため）。
  let verdict = 'indeterminate';
  if (notDeployed.length > 0) verdict = 'not_deployed';
  else if (deployed.length > 0) verdict = 'deployed';

  // どの修正が未反映と分かったか（Issue に原因つきで運ぶため・ISSUE-084 原則5）
  const missingFixes = [...new Set(notDeployed.map((m) => m.fix_id))];

  return { verdict, matched, missing_fixes: missingFixes, source_lines: sourceLines };
}

/** JST の YYYY-MM-DD */
function jstDate(offsetDays = 0) {
  const ms = Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(fromYmd, toYmd) {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

module.exports = { loadPolicy, analyzeReport, extractSourceLines, jstDate, daysBetween, POLICY_PATH };
