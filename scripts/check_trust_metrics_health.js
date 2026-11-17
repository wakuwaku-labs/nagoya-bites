#!/usr/bin/env node
'use strict';
/**
 * scripts/check_trust_metrics_health.js — 信頼の指標が悪化していないか・数えられているかの見張り（S7-1）
 *
 * 判定は検証できる事実だけで行う（CLAUDE.md 制約10）:
 *   ○ data/trust_metrics.json の実在と generated_at の鮮度   … 動いていない数え役はファイルを更新できない
 *   ○ 前の週の記録（history）との差                          … 台帳から機械で数えた値どうしの比較
 *   ○ 事実の文の数（全記事の平均）の急な減少                  … 率を良くするために事実の文を減らしていないか
 *   ○ 公開後の見直し（data/article_recheck_log.json）の滞り   … 心拍の鮮度と、見直す日を過ぎた記事の古さ
 * 絶対値の下限は置かない（今の基線は低く、置くと毎日鳴ってオオカミ少年になる・ISSUE-084 原則6）。
 * まだ数えていない指標（value=null）は鳴らさない。復旧したら問題が0になり、workflow が Issue を自動で閉じる。
 *
 *   node scripts/check_trust_metrics_health.js          # 人が読む要約
 *   node scripts/check_trust_metrics_health.js --json   # 機械可読（workflow が読む）
 * 終了コード: 健全=0 / 悪化・停止=1
 */
const path = require('path');
const T = require('./trust_metrics');

const LABEL = {
  evidence_rate: '根拠確認率',
  unconfirmed_disclosure_rate: '未確認の明示率',
  freshness_rate: '更新鮮度',
  analysis_rate: '独自分析の充実度',
};

/** 比べる相手: 今日からみて compare_min_days 日以上前の、いちばん新しい記録 */
function pickBaseline(history, today, minDays) {
  return (history || []).filter((h) => h && h.date && T.daysBetween(h.date, today) >= minDays).pop() || null;
}

function evaluate({ metrics, recheckLog = null, policy, today }) {
  const al = (policy && policy.alert) || {};
  const rc = (policy && policy.recheck) || {};
  const problems = [];
  const warnings = [];
  if (!metrics) {
    return { ok: false, today_jst: today, problems: [{ kind: 'no_metrics', detail: 'data/trust_metrics.json がありません（数え役が一度も動いていません）' }], warnings, baseline: null };
  }
  const age = T.daysBetween(String(metrics.generated_at || '').slice(0, 10), today);
  if (age === null || age > (al.stale_days || 10)) {
    problems.push({ kind: 'stale_metrics', detail: `信頼の指標の最終更新が ${metrics.generated_at || '不明'}（${age === null ? '日付不明' : `${age}日前`}・許容 ${al.stale_days || 10}日）。数え役の workflow が止まっています` });
  }
  const base = pickBaseline(metrics.history, today, al.compare_min_days || 6);
  const ind = metrics.indicators || {};
  if (!base) warnings.push('比べる前の週の記録がまだありません（記録は7日ごとに1行たまります）');
  else {
    const minArt = al.min_measured_articles || 5;
    for (const [key, pts] of Object.entries(al.worsen_points || {})) {
      const cur = ind[key] && ind[key].value;
      const prev = base[key];
      if (cur === null || cur === undefined || prev === null || prev === undefined) continue;
      if ((ind[key].measured_articles || 0) < minArt) continue;
      const drop = Math.round((prev - cur) * 1000) / 10;
      if (drop >= pts) problems.push({ kind: `worse_${key}`, detail: `${LABEL[key]}が ${T.pct(prev)}（${base.date}）→ ${T.pct(cur)} に下がりました（${drop}ポイント減・許容 ${pts}ポイント）` });
    }
    const mis = ind.misinformation_rate;
    if (mis && mis.value !== null && base.misinformation_rate !== null && base.misinformation_rate !== undefined) {
      const rise = Math.round((mis.value - base.misinformation_rate) * 1000) / 10;
      if (rise >= (al.misinformation_rise_points || 2)) problems.push({ kind: 'worse_misinformation_rate', detail: `誤情報の発生率が ${T.pct(base.misinformation_rate)}（${base.date}）→ ${T.pct(mis.value)} に上がりました（${rise}ポイント増・許容 ${al.misinformation_rise_points || 2}ポイント）` });
    }
    const fa = metrics.fact_sentences && metrics.fact_sentences.per_article_avg;
    if (fa !== null && fa !== undefined && base.fact_per_article_avg && fa < base.fact_per_article_avg * (1 - (al.facts_drop_ratio || 0.2))) {
      problems.push({ kind: 'facts_shrinking', detail: `記事1本あたりの事実の文が ${base.fact_per_article_avg}（${base.date}）→ ${fa} に減りました（${Math.round((al.facts_drop_ratio || 0.2) * 100)}%以上の減少）。事実の文を減らすと率は良く見えるので、率の改善より先に中身を確かめてください` });
    }
  }
  // 公開後の見直しの滞り
  if (recheckLog && recheckLog.last_run) {
    const rage = T.daysBetween(recheckLog.last_run.date, today);
    if (rage !== null && rage > (rc.heartbeat_stale_days || 3)) problems.push({ kind: 'recheck_stale', detail: `公開後の鮮度の見直しが ${recheckLog.last_run.date} から動いていません（${rage}日前・許容 ${rc.heartbeat_stale_days || 3}日）` });
    const od = recheckLog.summary && recheckLog.summary.oldest_overdue_ledger_days;
    if (Number.isFinite(od) && od > (rc.overdue_alert_days || 14)) problems.push({ kind: 'recheck_backlog', detail: `事実台帳のある記事で、見直す日を過ぎて未確認のものが ${recheckLog.summary.overdue_ledger}本あり、いちばん古いもので ${od}日過ぎています（許容 ${rc.overdue_alert_days || 14}日）` });
    if (recheckLog.last_run.due > 0 && recheckLog.last_run.processed === 0) problems.push({ kind: 'recheck_zero', detail: `見直す日が来た記事が ${recheckLog.last_run.due}本あるのに、${recheckLog.last_run.date} は1本も見直せませんでした` });
  } else {
    warnings.push('公開後の鮮度の見直しの記録（data/article_recheck_log.json）がまだありません');
  }
  return { ok: problems.length === 0, today_jst: today, problems, warnings, baseline: base ? base.date : null };
}

/** Issue の本文（原因つき・人がログを読みに行かなくて済むように。ISSUE-084 原則5） */
function issueBody(r) {
  const L = [];
  L.push(`信頼の指標（NAGOYA BITES の成果の物差しの第一）に異常があります（JST ${r.today_jst} 時点）。`, '');
  L.push('## 検出内容');
  for (const p of r.problems) L.push(`- **${p.kind}** — ${p.detail}`);
  if (r.warnings.length) { L.push('', '## 注意（それ自体は異常ではない）'); for (const w of r.warnings) L.push(`- ${w}`); }
  L.push('', '## 見る場所', '- 最新の値と履歴: `data/trust_metrics.json`（`node scripts/trust_metrics.js` で今の値を数え直せる）', '- 公開後の鮮度の見直し: `data/article_recheck_log.json`（`article-recheck` ラベルの Issue も見る）',
    '- 悪化の判断の線: `data/trust_metrics_policy.json` の alert（線を下げて通すのではなく、原因の記事を直す・品質ゲート原則5）', '',
    '## 対処の目安', '- `worse_*`: 下がった指標の元になった記事（台帳の `status` が「食い違い」「取得できず照合不能」のもの）を直す。', '- `facts_shrinking`: 記事の事実の文が減っている。率を良くするために減らしていないか、書き手の指示（agents/editor.md）と最近の記事を見る。',
    '- `stale_metrics` / `recheck_stale` / `recheck_zero`: 数え役・見直し役の workflow が止まっている。Actions の実行履歴を見る。', '', '---', 'この Issue は信頼の指標が健全に戻ると自動でクローズされます（trust-metrics-watchdog.yml）。');
  return L.join('\n');
}

function main() {
  const asJson = process.argv.includes('--json');
  const root = T.ROOT;
  const policy = T.loadPolicy(root);
  const metrics = T.readJson(path.join(root, T.OUT_REL), null);
  const recheckLog = T.readJson(path.join(root, T.RECHECK_LOG_REL), null);
  const r = evaluate({ metrics, recheckLog, policy, today: T.jstDate() });
  if (!r.ok) r.issue_body = issueBody(r);
  if (asJson) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(r.ok ? '信頼の指標: 健全' : '信頼の指標: 異常あり');
    for (const p of r.problems) console.log(`  [異常] ${p.kind}: ${p.detail}`);
    for (const w of r.warnings) console.log(`  [注意] ${w}`);
  }
  process.exit(r.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { evaluate, pickBaseline, issueBody };
