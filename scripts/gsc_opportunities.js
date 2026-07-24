#!/usr/bin/env node
'use strict';
/**
 * gsc_opportunities.js — GSC 検索実データ → 改善機会の決定的抽出（ISSUE-072）
 *
 * `data/gsc_metrics.json`（fetch_gsc_metrics.js が日次生成）を読み、
 * 「今どこに伸びしろがあるか」を機械的に2バケットへ振り分けて
 * `data/gsc_opportunities.json` に出力する。
 *
 * これは "配信" レイヤー（GAS が LINE レポートを送るのと同じ役割）。
 * 判定＝採否は別途 LLM が CLAUDE.md の Moat / Strategic Skip を根拠に triage する
 * （＝既存の /seo-triage と同じ二段構え。エンジンは値を出すだけで施策化はしない）。
 *
 * バケット:
 *   ctr_fix   … 1ページ目(pos≤10)なのに期待CTRを大きく下回る → タイトル/メタ改善で拾える
 *   rank_push … 2〜3ページ目(pos 11〜30)で高表示 → 順位を上げれば大きく伸びる（内容/内部リンク）
 *
 * 優先度 = 取りこぼしクリック推定 = (期待CTR − 実CTR) × 表示回数（多いほど上位）。
 *
 * 実行: node scripts/gsc_opportunities.js   （未接続/データ無しなら空を書いて正常終了）
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN_PATH  = path.join(ROOT, 'data', 'gsc_metrics.json');
const OUT_PATH = path.join(ROOT, 'data', 'gsc_opportunities.json');

// 掲載順位ごとの期待CTR（業界一般のクリック率曲線・素人判断用の目安）
function expectedCtr(pos) {
  const curve = [
    [1, 0.28], [2, 0.15], [3, 0.11], [4, 0.08], [5, 0.06],
    [6, 0.05], [7, 0.04], [8, 0.032], [9, 0.028], [10, 0.025],
  ];
  if (pos <= 1) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (pos <= curve[i][0]) {
      // 線形補間
      const [p0, c0] = curve[i - 1], [p1, c1] = curve[i];
      return c0 + (c1 - c0) * (pos - p0) / (p1 - p0);
    }
  }
  return 0.02; // 10位以降はほぼ横ばいの低CTR
}

// しきい値（ノイズ除去）
const MIN_IMPRESSIONS_CTR  = 40;   // CTR改善は最低これだけ表示されているもの
const MIN_IMPRESSIONS_RANK = 80;   // 順位改善は需要（表示）が十分あるもの

function round(n, d = 1) { const m = Math.pow(10, d); return Math.round(n * m) / m; }

function classify(items, keyName) {
  const ctrFix = [], rankPush = [];
  for (const it of items) {
    const imp = it.impressions || 0;
    const pos = it.position || 0;
    const ctr = it.ctr || 0;
    if (!imp || !pos) continue;

    if (pos <= 10 && imp >= MIN_IMPRESSIONS_CTR) {
      const exp = expectedCtr(pos);
      const gap = exp - ctr;                 // 期待との差（プラスなら伸びしろ）
      if (gap > 0.01) {                       // 1pt 以上下回る時だけ機会とみなす
        const missedClicks = gap * imp;       // 取りこぼしクリック推定 = 優先度
        ctrFix.push({
          [keyName]: it[keyName], impressions: imp, clicks: it.clicks || 0,
          position: round(pos), ctr: round(ctr * 100, 2), expectedCtr: round(exp * 100, 1),
          missedClicks: round(missedClicks, 1),
        });
      }
    } else if (pos > 10 && pos <= 30 && imp >= MIN_IMPRESSIONS_RANK) {
      // 2〜3ページ目: 1ページ目に上げれば期待CTRが跳ねる分が伸びしろ
      const upside = (expectedCtr(9) - ctr) * imp;
      if (upside > 0) {   // 既に期待CTR以上のページは「順位改善候補」から除外（ノイズ排除）
        rankPush.push({
          [keyName]: it[keyName], impressions: imp, clicks: it.clicks || 0,
          position: round(pos), ctr: round(ctr * 100, 2),
          upsideClicks: round(upside, 1),
        });
      }
    }
  }
  ctrFix.sort((a, b) => b.missedClicks - a.missedClicks);
  rankPush.sort((a, b) => b.upsideClicks - a.upsideClicks);
  return { ctrFix, rankPush };
}

function main() {
  let gsc;
  try { gsc = JSON.parse(fs.readFileSync(IN_PATH, 'utf8')); }
  catch (_) { gsc = null; }

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'data/gsc_metrics.json',
    ready: !!(gsc && gsc.totals && !gsc.error),
    note: null,
    byQuery: { ctrFix: [], rankPush: [] },
    byPage:  { ctrFix: [], rankPush: [] },
    howto: 'ctrFix=1ページ目・低CTR→タイトル/メタ改善 / rankPush=2〜3ページ目・高需要→順位改善（内容/内部リンク）。採否は CLAUDE.md の Moat/Strategic Skip で triage。',
  };

  if (!out.ready) {
    out.note = gsc && gsc.error ? `GSC 未接続: ${gsc.error}` : 'gsc_metrics.json に totals がありません';
  } else {
    const q = classify(gsc.topQueries || [], 'query');
    const p = classify((gsc.topPages || []).map(r => ({ ...r, page: (r.page || '').replace('https://nagoya-bites.com', '') })), 'page');
    out.byQuery = q; out.byPage = p;
    out.summary = {
      queryCtrFix: q.ctrFix.length, queryRankPush: q.rankPush.length,
      pageCtrFix: p.ctrFix.length, pageRankPush: p.rankPush.length,
      topPageCtrFix: p.ctrFix.slice(0, 3).map(x => x.page),
    };
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  if (!out.ready) { console.log(`gsc_opportunities: ${out.note}（空で出力）`); return; }
  console.log(`gsc_opportunities 更新: CTR改善 ページ${out.byPage.ctrFix.length}/クエリ${out.byQuery.ctrFix.length} ・ 順位改善 ページ${out.byPage.rankPush.length}/クエリ${out.byQuery.rankPush.length}`);
  if (out.byPage.ctrFix[0]) {
    const t = out.byPage.ctrFix[0];
    console.log(`  最優先(ページCTR改善): ${t.page} 表示${t.impressions}/順位${t.position}/CTR${t.ctr}% → 取りこぼし推定${t.missedClicks}クリック`);
  }
}

main();
