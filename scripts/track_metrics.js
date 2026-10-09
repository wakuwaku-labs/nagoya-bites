#!/usr/bin/env node
/**
 * KPI 時系列スナップショット & 施策効果台帳（PDCA の Check 自動化・ORG-005）
 *
 * 設計（seo_triage.js / backlog_ids.js と同じ思想）:
 *   - 決定的処理だけを持つ（数値の取得・append・delta算出）。
 *   - 「この delta は施策効果か季節要因か」の解釈はエージェントが行う（数値化はここ、判断は人/AI）。
 *
 * 背景: data/site_metrics.json は build.yml が毎日「上書き」するため履歴が残らず、
 *   施策デプロイ前後の比較ができなかった。本スクリプトが append-only の時系列と
 *   施策ID単位の baseline/followup 台帳を持たせ、効果測定を仕組み化する。
 *
 * サブコマンド（出力は常に JSON / 失敗は {ok:false,error}）:
 *   --snapshot                  site_metrics.json を読み metrics_history.json に1日1行 append（同日は上書き＝冪等）
 *   --baseline <ID> [--metric K] [--target V]
 *                               現在のmetricsを effect_ledger.json に施策IDの baseline として記録
 *   --followup <ID> [--days N]  baseline から現在metricsを取得し delta 算出・記録
 *   --report [--days N]         metrics_history のトレンド要約をJSON出力（最新 vs N日前・既定7日）
 *   --north-star [--days N]     SEO の北極星4指標（発見型の表示/クリック・表示が出たハブ・生成AI・Bing）を
 *                               履歴から出す（最新 vs N日前・既定28日・docs/seo-strategy-2026-10.md §2）
 *
 * データ:
 *   data/metrics_history.json  { version, entries: [ { date, totals, channels_pct, search_channels, cta, gsc } ] }（直近120日リング）
 *                              gsc は SEO-117（2026-10-09〜）。それより前の行には無い
 *   data/effect_ledger.json    { version, ledger: { "<ID>": { baseline, target_metric, target_value, followup } } }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_METRICS = path.join(ROOT, 'data/site_metrics.json');
const GSC_METRICS = path.join(ROOT, 'data/gsc_metrics.json');
const HISTORY_PATH = path.join(ROOT, 'data/metrics_history.json');
const LEDGER_PATH = path.join(ROOT, 'data/effect_ledger.json');
const CHANGES_PATH = path.join(ROOT, 'data/measurement_changes.json');
const GA4_LOOKBACK_DAYS = 30; // site_metrics.json は30日窓（fetch_ga4_views.js の LOOKBACK）

const MAX_HISTORY_DAYS = 120;

function today() { return new Date().toISOString().slice(0, 10); }
function out(obj) { console.log(JSON.stringify(obj, null, 2)); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function loadJSON(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return Object.assign({}, fallback, { _parse_error: e.message }); }
}
function saveJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

/** site_metrics.json から記録したい中核指標だけ抜く（流入元は pct のみ・CTAは件数と率） */
function readSiteMetrics() {
  if (!fs.existsSync(SITE_METRICS)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(SITE_METRICS, 'utf8'));
    if (!m.totals) return null;
    // search_channels（エンジン単位のセッション数）は SEO-039 で追加。
    // organic/direct/social/referral の4分類だけでは Bing・生成AI が識別できず、
    // 流入の 58% が履歴に一切残らないまま site_metrics.json の日次上書きで消えていた。
    let searchChannels = null;
    try {
      const { aggregate } = require('./search_channel_metrics');
      const agg = aggregate(m);
      if (agg.total > 0) {
        searchChannels = {};
        agg.engines.forEach((e) => { searchChannels[e.key] = e.sessions; });
      }
    } catch (_) { /* 観測レイヤーが無くても既存のスナップショットは壊さない */ }

    return {
      totals: m.totals,
      gsc: readGscMetrics(),
      channels_pct: m.channels && m.channels.pct ? m.channels.pct : null,
      search_channels: searchChannels,
      cta: m.cta ? {
        outboundClicks: m.cta.outboundClicks,
        ctaClickRate: m.cta.ctaClickRate,
        ctaClickRate_organic: m.cta.ctaClickRate_organic ?? null,
        ctaClickRate_direct:  m.cta.ctaClickRate_direct  ?? null,
        ctaClickRate_social:  m.cta.ctaClickRate_social  ?? null,
      } : null,
    };
  } catch (e) { return null; }
}

/**
 * SEO-117: data/gsc_metrics.json も build.yml が毎日上書きするため、発見型（intent.kpi）と
 * ページ種別（pageTypes）の時系列が残らず、SEO-087 の効果判定では git 履歴から手で復元していた。
 * 日次スナップショットに GSC の集計値だけを足す（クエリ表・ページ表は大きいので持たない）。
 * 読めないときは null を返し、GA4 側のスナップショットは止めない。
 */
function extractGsc(g) {
  if (!g || !g.totals) return null;
  return {
    generatedAt: g.generatedAt || null,
    dateRange: g.dateRange || null,
    totals: g.totals,
    intent_kpi: (g.intent && g.intent.kpi) || null,
    pageTypes: g.pageTypes || null,
  };
}

function readGscMetrics(p = GSC_METRICS) {
  if (!fs.existsSync(p)) return null;
  try { return extractGsc(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (_) { return null; }
}

/** totals 同士の数値差分（after - before）を算出 */
function deltaOf(beforeT, afterT) {
  const d = {};
  for (const k of Object.keys(afterT || {})) {
    if (typeof afterT[k] === 'number' && typeof (beforeT || {})[k] === 'number') {
      d[k] = +(afterT[k] - beforeT[k]).toFixed(4);
    }
  }
  return d;
}

/**
 * SEO-118: 計測の仕組みが変わった日（data/measurement_changes.json）が、2つの日付の比較に入るかを返す。
 * GA4 の値は30日窓の合計なので、変更日が「前の日の窓の始まり」より後で「後の日」以前なら、
 * 片方または両方の窓に変更前後の計測が混ざり、差分に施策と関係ない段差が出る。
 * source は 'ga4' か 'gsc'（affects に含む変更だけを返す）。台帳が無い・壊れているときは空配列。
 */
function measurementChangesBetween(fromDate, toDate, { source = 'ga4', lookbackDays = GA4_LOOKBACK_DAYS, changesPath = CHANGES_PATH } = {}) {
  if (!fromDate || !toDate) return [];
  const book = loadJSON(changesPath, { changes: [] });
  const list = Array.isArray(book.changes) ? book.changes : [];
  const start = new Date(new Date(fromDate) - lookbackDays * 86400000).toISOString().slice(0, 10);
  return list
    .filter((c) => c && c.date && (c.affects || []).includes(source) && c.date > start && c.date <= toDate)
    .map((c) => ({ date: c.date, id: c.id || null, summary: c.summary || '',
      note: `${c.date} に計測が変わった（${c.id || '記録なし'}）。この比較の差分には計測の段差が入るため、施策の効果としては読まない` }));
}

// ── snapshot ────────────────────────────────────────────
function snapshot() {
  const metrics = readSiteMetrics();
  if (!metrics) return { ok: false, error: 'site_metrics.json が無い/totals欠落（GA4未取得の可能性）' };
  const hist = loadJSON(HISTORY_PATH, { version: 1, entries: [] });
  if (!Array.isArray(hist.entries)) hist.entries = [];
  const date = today();
  const entry = { date, ...metrics };
  const idx = hist.entries.findIndex((e) => e.date === date);
  if (idx >= 0) hist.entries[idx] = entry; // 同日は上書き＝冪等
  else hist.entries.push(entry);
  hist.entries.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (hist.entries.length > MAX_HISTORY_DAYS) {
    hist.entries = hist.entries.slice(hist.entries.length - MAX_HISTORY_DAYS);
  }
  saveJSON(HISTORY_PATH, hist);
  return { ok: true, date, total_days: hist.entries.length, snapshot: entry };
}

// ── baseline ────────────────────────────────────────────
function baseline(id, opts = {}) {
  if (!id) return { ok: false, error: '--baseline requires an issue ID' };
  const metrics = readSiteMetrics();
  if (!metrics) return { ok: false, error: 'site_metrics.json が無い/totals欠落' };
  const ledger = loadJSON(LEDGER_PATH, { version: 1, ledger: {} });
  if (!ledger.ledger) ledger.ledger = {};
  ledger.ledger[id] = {
    baseline: { date: today(), metrics },
    target_metric: opts.metric || null,
    target_value: opts.target != null ? opts.target : null,
    followup: null,
  };
  saveJSON(LEDGER_PATH, ledger);
  return { ok: true, id, baseline: ledger.ledger[id].baseline };
}

// ── followup ────────────────────────────────────────────
function followup(id) {
  if (!id) return { ok: false, error: '--followup requires an issue ID' };
  const ledger = loadJSON(LEDGER_PATH, { version: 1, ledger: {} });
  const rec = ledger.ledger && ledger.ledger[id];
  if (!rec || !rec.baseline) return { ok: false, error: `effect_ledger に ${id} の baseline が無い（先に --baseline を）` };
  const metrics = readSiteMetrics();
  if (!metrics) return { ok: false, error: 'site_metrics.json が無い/totals欠落' };
  rec.followup = {
    date: today(),
    days_since_baseline: daysBetween(rec.baseline.date, today()),
    metrics,
    delta_totals: deltaOf(rec.baseline.metrics.totals, metrics.totals),
  };
  const changes = measurementChangesBetween(rec.baseline.date, rec.followup.date);
  if (changes.length) rec.followup.measurement_changes = changes;
  saveJSON(LEDGER_PATH, ledger);
  return { ok: true, id, baseline_date: rec.baseline.date, followup: rec.followup };
}

// ── report ──────────────────────────────────────────────
function report(days) {
  const hist = loadJSON(HISTORY_PATH, { version: 1, entries: [] });
  const entries = Array.isArray(hist.entries) ? hist.entries : [];
  if (entries.length === 0) return { ok: true, note: 'metrics_history が空（まだ snapshot がない）', total_days: 0 };
  const latest = entries[entries.length - 1];
  const n = days && Number.isFinite(days) ? days : 7;
  const targetDate = new Date(new Date(latest.date) - n * 86400000).toISOString().slice(0, 10);
  let prior = entries[0];
  for (const e of entries) { if (e.date <= targetDate) prior = e; }
  return {
    ok: true,
    window_days: n,
    latest: { date: latest.date, totals: latest.totals, cta: latest.cta },
    prior: { date: prior.date, totals: prior.totals, cta: prior.cta },
    delta_totals: deltaOf(prior.totals, latest.totals),
    measurement_changes: measurementChangesBetween(prior.date, latest.date),
    total_days: entries.length,
  };
}

// ── north-star（SEO-117）─────────────────────────────────
/** 1行から北極星4指標を取り出す（無い値は null。GSC が入る前の行は GSC 由来が null になる） */
function northStarRow(e) {
  const g = e && e.gsc;
  const kpi = g && g.intent_kpi;
  const hub = g && g.pageTypes && g.pageTypes.area_hub;
  const sc = e && e.search_channels;
  const num = v => (typeof v === 'number' ? v : null);
  return {
    date: e ? e.date : null,
    gsc_range: g && g.dateRange ? `${g.dateRange.startDate}〜${g.dateRange.endDate}` : null,
    discovery_impressions: num(kpi && kpi.discovery_impressions),
    discovery_clicks: num(kpi && kpi.discovery_clicks),
    hub_pages: num(hub && hub.pages),
    hub_impressions: num(hub && hub.impressions),
    ai_sessions: num(sc && sc.ai_assistant),
    bing_sessions: num(sc && sc.bing),
  };
}

/** 履歴の最新行と N 日前（以前で最も近い行）を比べる。純関数（テスト用に entries を受け取る） */
function northStarFrom(entries, days) {
  const list = (Array.isArray(entries) ? entries : []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  if (list.length === 0) return { ok: true, note: 'metrics_history が空（まだ snapshot がない）', total_days: 0 };
  const n = days && Number.isFinite(days) ? days : 28;
  const latest = list[list.length - 1];
  const targetDate = new Date(new Date(latest.date) - n * 86400000).toISOString().slice(0, 10);
  let prior = null;
  for (const e of list) { if (e.date <= targetDate) prior = e; }
  const a = northStarRow(latest);
  const b = prior ? northStarRow(prior) : null;
  const delta = {};
  if (b) for (const k of Object.keys(a)) {
    if (typeof a[k] === 'number' && typeof b[k] === 'number') delta[k] = +(a[k] - b[k]).toFixed(4);
  }
  const firstWithGsc = list.find(e => e.gsc);
  return {
    ok: true,
    window_days: n,
    latest: a,
    prior: b,
    delta,
    gsc_history_since: firstWithGsc ? firstWithGsc.date : null,
    // GA4 由来（ai_sessions・bing_sessions）だけに当たる。GSC 由来の値は GA4 の計測変更の影響を受けない
    measurement_changes: b ? measurementChangesBetween(prior.date, latest.date) : [],
    note: 'GSC 由来（discovery_*・hub_*）は28日窓、GA4 由来（ai_sessions・bing_sessions）は30日窓。窓が重なるため差は傾向として読む',
    total_days: list.length,
  };
}

function northStar(days) {
  const hist = loadJSON(HISTORY_PATH, { version: 1, entries: [] });
  return northStarFrom(hist.entries, days);
}

// ── CLI ─────────────────────────────────────────────────
function argVal(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--snapshot')) { out(snapshot()); return; }
  if (args.includes('--baseline')) {
    const target = argVal(args, '--target');
    const r = baseline(argVal(args, '--baseline'), { metric: argVal(args, '--metric'), target: target != null ? parseFloat(target) : null });
    out(r); if (!r.ok) process.exit(1);
    return;
  }
  if (args.includes('--followup')) {
    const r = followup(argVal(args, '--followup'));
    out(r); if (!r.ok) process.exit(1);
    return;
  }
  if (args.includes('--report')) {
    const days = argVal(args, '--days');
    out(report(days ? parseInt(days, 10) : null));
    return;
  }
  if (args.includes('--north-star')) {
    const days = argVal(args, '--days');
    out(northStar(days ? parseInt(days, 10) : null));
    return;
  }
  out({ ok: false, error: 'no subcommand', usage: ['--snapshot', '--baseline <ID> [--metric K --target V]', '--followup <ID>', '--report [--days N]', '--north-star [--days N]'] });
  process.exit(1);
}

if (require.main === module) main();

module.exports = { measurementChangesBetween, snapshot, baseline, followup, report, readSiteMetrics, readGscMetrics, extractGsc, northStarRow, northStarFrom };
