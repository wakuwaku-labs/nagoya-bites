'use strict';
/**
 * scripts/search_channel_metrics.js
 *
 * 検索・AI流入を「エンジン単位」で可視化する観測レイヤー（SEO-039）。
 *
 * ============================================================================
 * なぜ要るのか（2026-07-27 実測）
 * ============================================================================
 * GA4 の 30日実測（510セッション）:
 *     Bing 175 (34%) / (direct) 131 (26%) / OpenAI+ChatGPT 121 (24%) / Google 50 (10%)
 * つまり **Google は流入の 10% にすぎず、Bing と 生成AI で 58% を占める**。
 *
 * ところが既存の改善ループは両方とも Google と「入った後」しか見ていなかった:
 *   - GSC ループ（gsc_metrics.json）          … Google のみ。Bing/AI は原理的に映らない
 *   - SEOアドバイスループ（GA4/LINE）         … 主に直帰率・回遊など到着後の行動
 *   - metrics_history.json（56日ぶんの履歴）  … organic/direct/social/referral の4分類のみで、
 *                                               **どの検索エンジンから来たかが一切残っていない**
 * その結果、流入の 58% は「今日のスナップショット（site_metrics.json）」にしか存在せず、
 * 毎日上書きされて消えていた。施策の前後比を取ろうにも、比較対象の履歴が無い状態だった。
 * agent-backlog.md:289 が 2026-05 時点で「Bing > Google は P1級の観測盲点」と書いた指摘が
 * そのまま未対応で残っていたもの。
 *
 * 本スクリプトは site_metrics.json の sourceBreakdown をエンジン単位に分類して
 * data/search_channel_metrics.json に書き出す。あわせて track_metrics.js の
 * --snapshot が metrics_history.json に search_channels を積むようになるため、
 * 明日以降は前後比が取れる（過去分は GA4 側に残っていても本リポジトリには無いので遡及しない）。
 *
 * 使い方:
 *   node scripts/search_channel_metrics.js            # data/search_channel_metrics.json を生成
 *   node scripts/search_channel_metrics.js --report   # 人間可読サマリ
 *
 * 出力は JSON（--report 時は表形式）。GA4 未取得時は 0 で正常終了する（CI を止めない）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE_METRICS = path.join(ROOT, 'data', 'site_metrics.json');
const HISTORY = path.join(ROOT, 'data', 'metrics_history.json');
const OUT_PATH = path.join(ROOT, 'data', 'search_channel_metrics.json');

// ============================================================
// エンジン分類ルール
// source（GA4 の source フィールド）を前方/部分一致で判定する。
// medium は見ない（openai が organic / (not set) / referral と揺れるため）。
// ============================================================
const ENGINE_RULES = [
  { key: 'ai_assistant', label: '生成AI（ChatGPT/Perplexity/Claude/Gemini/Copilot）',
    match: ['openai', 'chatgpt', 'perplexity', 'claude.ai', 'anthropic', 'gemini', 'bard.google', 'copilot'] },
  { key: 'bing',       label: 'Bing',       match: ['bing'] },
  { key: 'google',     label: 'Google',     match: ['google'], exclude: ['bard.google'] },
  { key: 'yahoo',      label: 'Yahoo!',     match: ['yahoo'] },
  { key: 'duckduckgo', label: 'DuckDuckGo', match: ['duckduckgo'] },
  { key: 'social',     label: 'SNS',        match: ['x.com', 'twitter', 'instagram', 'facebook', 't.co', 'tiktok', 'youtube'] },
  { key: 'direct',     label: '直接/不明',  match: ['(direct)', '(not set)'] }
];

function classify(source) {
  const s = String(source || '').toLowerCase();
  for (const r of ENGINE_RULES) {
    if ((r.exclude || []).some(x => s.includes(x))) continue;
    if (r.match.some(m => s.includes(m))) return r.key;
  }
  return 'other';
}

function labelOf(key) {
  const r = ENGINE_RULES.find(x => x.key === key);
  return r ? r.label : 'その他';
}

// ============================================================
// 集計
// ============================================================

/** site_metrics.json の sourceBreakdown をエンジン単位に畳む */
function aggregate(metrics) {
  const rows = metrics.sourceBreakdown || [];
  const byEngine = {};
  const detail = {};

  rows.forEach(r => {
    const key = classify(r.source);
    const n = Number(r.sessions) || 0;
    byEngine[key] = (byEngine[key] || 0) + n;
    (detail[key] = detail[key] || []).push({ source: r.source, medium: r.medium, sessions: n });
  });

  // SEO-055: sourceBreakdown に social が1件も無いと byEngine['social'] 自体が
  // 存在せず、後段の engines 配列から丸ごと消える。「0セッション」と「未計測」が
  // 区別できなくなるため、social は必ず明示的に0を持たせる（制約10）
  if (!('social' in byEngine)) byEngine.social = 0;

  const total = Object.values(byEngine).reduce((a, b) => a + b, 0);
  const engines = Object.entries(byEngine)
    .map(([key, sessions]) => ({
      key, label: labelOf(key), sessions,
      pct: total ? +(sessions / total * 100).toFixed(1) : 0,
      sources: (detail[key] || []).sort((a, b) => b.sessions - a.sessions)
    }))
    .sort((a, b) => b.sessions - a.sessions);

  return { total, engines };
}

/** 検索面の集計（direct/social を除いた「検索・AIで見つけられた分」） */
function searchOnly(engines) {
  const searchKeys = ['bing', 'google', 'yahoo', 'duckduckgo', 'ai_assistant'];
  const rows = engines.filter(e => searchKeys.includes(e.key));
  const total = rows.reduce((a, b) => a + b.sessions, 0);
  return {
    total,
    share: rows.map(e => ({
      key: e.key, label: e.label, sessions: e.sessions,
      pct_of_search: total ? +(e.sessions / total * 100).toFixed(1) : 0
    })).sort((a, b) => b.sessions - a.sessions)
  };
}

/** metrics_history.json に積まれた search_channels から前後比を出す（無ければ null） */
function trendFrom(history, todayEngines) {
  const entries = (history.entries || []).filter(e => e.search_channels);
  if (entries.length < 2) return null;
  const latest = entries[entries.length - 1];
  const prior = entries[entries.length - 2];
  const delta = {};
  Object.keys(todayEngines).forEach(k => {
    const a = (latest.search_channels || {})[k] || 0;
    const b = (prior.search_channels || {})[k] || 0;
    delta[k] = a - b;
  });
  return { from: prior.date, to: latest.date, delta };
}

// ============================================================
// 本体
// ============================================================

function build() {
  if (!fs.existsSync(SITE_METRICS)) {
    return { ok: false, ready: false, note: 'data/site_metrics.json が無い（GA4 未取得）' };
  }
  const metrics = JSON.parse(fs.readFileSync(SITE_METRICS, 'utf8'));
  if (!metrics.sourceBreakdown || metrics.sourceBreakdown.length === 0) {
    return { ok: false, ready: false, note: 'sourceBreakdown が空（GA4 未取得の可能性）' };
  }

  const { total, engines } = aggregate(metrics);
  const search = searchOnly(engines);
  const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : { entries: [] };
  const engineMap = {};
  engines.forEach(e => { engineMap[e.key] = e.sessions; });

  // 観測されているのに改善ループが見ていないチャネルを明示する
  const blindSpots = [];
  const gscCovered = engineMap.google || 0;
  const uncovered = total - gscCovered - (engineMap.direct || 0);
  if (uncovered > gscCovered) {
    blindSpots.push({
      issue: 'gsc_only_covers_google',
      detail: `GSC が見えるのは Google の ${gscCovered} セッションのみ。` +
              `Bing(${engineMap.bing || 0}) + 生成AI(${engineMap.ai_assistant || 0}) の ` +
              `${(engineMap.bing || 0) + (engineMap.ai_assistant || 0)} セッションは既存の改善ループの外側にある。`,
      action: 'Bing Webmaster Tools の登録（要オーナー操作）と IndexNow 送信の有効化、AI引用面は llms.txt の維持で対応する'
    });
  }
  if (!(history.entries || []).some(e => e.search_channels)) {
    blindSpots.push({
      issue: 'no_engine_level_history',
      detail: 'metrics_history.json にエンジン単位の履歴がまだ無い（organic/direct/social/referral の4分類のみ）。' +
              '施策の前後比はスナップショット蓄積後に判定できるようになる。',
      action: 'scripts/track_metrics.js --snapshot が今後 search_channels を積む（過去分は遡及不可）'
    });
  }

  return {
    ok: true,
    ready: true,
    generatedAt: new Date().toISOString(),
    source: 'data/site_metrics.json',
    lookbackDays: metrics.lookbackDays || null,
    total_sessions: total,
    engines,
    search_only: search,
    trend: trendFrom(history, engineMap),
    blind_spots: blindSpots,
    howto: 'engines=エンジン単位の実測。search_only=検索・AIで発見された分の内訳。' +
           'GSC(gsc_metrics.json) は google の分しか映さないため、bing/ai_assistant の改善はこのファイルで測る。'
  };
}

function report(r) {
  if (!r.ready) { console.log('未取得: ' + r.note); return; }
  console.log(`=== 検索・AI流入のエンジン別内訳（直近${r.lookbackDays || '?'}日 / 全${r.total_sessions}セッション）===\n`);
  r.engines.forEach(e => {
    const bar = '#'.repeat(Math.round(e.pct / 2));
    console.log(`  ${String(e.pct).padStart(5)}%  ${String(e.sessions).padStart(4)}  ${bar}  ${e.label}`);
  });
  console.log(`\n--- 検索・AIで発見された分（${r.search_only.total}セッション）の内訳 ---`);
  r.search_only.share.forEach(s => {
    console.log(`  ${String(s.pct_of_search).padStart(5)}%  ${String(s.sessions).padStart(4)}  ${s.label}`);
  });
  if (r.trend) {
    console.log(`\n--- 前回スナップショット比 (${r.trend.from} → ${r.trend.to}) ---`);
    Object.entries(r.trend.delta).forEach(([k, v]) => {
      if (v !== 0) console.log(`  ${labelOf(k)}: ${v > 0 ? '+' : ''}${v}`);
    });
  } else {
    console.log('\n--- 前後比: エンジン単位の履歴がまだ2日分ありません（蓄積待ち）---');
  }
  if (r.blind_spots.length) {
    console.log('\n--- 観測の盲点 ---');
    r.blind_spots.forEach(b => console.log(`  ⚠️  ${b.detail}\n      → ${b.action}`));
  }
}

function main() {
  const args = process.argv.slice(2);
  const r = build();
  if (args.includes('--report')) { report(r); return; }
  fs.writeFileSync(OUT_PATH, JSON.stringify(r, null, 2) + '\n');
  console.log(JSON.stringify({
    ok: r.ok, ready: r.ready, written: path.relative(ROOT, OUT_PATH),
    total_sessions: r.total_sessions || 0,
    engines: (r.engines || []).map(e => `${e.key}:${e.sessions}`).join(' / '),
    blind_spots: (r.blind_spots || []).length
  }, null, 2));
}

if (require.main === module) main();

module.exports = { classify, aggregate, searchOnly };
