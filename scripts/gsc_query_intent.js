'use strict';
/**
 * scripts/gsc_query_intent.js
 *
 * GSC のクエリを「検索意図」で分類する（SEO-043）。
 *
 * ============================================================================
 * なぜ要るのか
 * ============================================================================
 * SEO-011 で日次ジャーナルにシーンKWレイヤーを入れたが、**その効果を測る器が無かった**。
 * `fetch_gsc_metrics.js` は上位25クエリしか取っておらず、そこは全件が店名の指名検索で
 * 埋まっている。シーンKW（接待/宴会/個室…）で表示が出始めても、指名検索を押しのけて
 * トップ25に入るまで数ヶ月かかる可能性が高く、それまで「効いているのか」が判別できない。
 *
 * そこで rowLimit を上げて全クエリを取得したうえで、意図別に集計する:
 *
 *   discovery    … シーン語、または「エリア語 × ジャンル語」を含む＝**我々が取りに行く面**
 *                  （CLAUDE.md の Moat「名古屋 × シーン × 業界人の目利き」に対応）
 *   navigational … 掲載店の店名そのもの＝**Strategic Skip の面**（公式サイトに譲る）
 *   brand        … サイト名の指名
 *   other        … 上記以外
 *
 * discovery の 表示回数・クリック が伸びているかどうかが SEO-011 の合否になる。
 * 順位や総クリックではなく「どの意図の検索で見つけられているか」で判定するのが要点で、
 * 総クリックは指名検索の増減で簡単に上下してしまい、施策の効果と混ざる。
 *
 * 分類の語彙は data/journal_seo_keywords.json（SEO-011 と共通）を使う。
 * 記事側と測定側で同じ辞書を見ることで、「KWを入れた面が伸びたか」が直接対応する。
 *
 * 使い方（モジュール）:
 *   const { classifyQueries } = require('./gsc_query_intent');
 *   classifyQueries(rows)   // rows = [{query, clicks, impressions, position}, ...]
 *
 * 使い方（CLI・現在の gsc_metrics.json を分類して確認）:
 *   node scripts/gsc_query_intent.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KW_PATH = path.join(ROOT, 'data', 'journal_seo_keywords.json');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const METRICS_PATH = path.join(ROOT, 'data', 'gsc_metrics.json');

// サイト名の指名検索（ブランド想起の指標。discovery とは別枠で見る）
const BRAND_TERMS = ['nagoya bites', 'nagoyabites', 'ナゴヤバイツ', '名古屋バイツ'];

// 店名マッチの最小長。「極」「華」のような短い店名は一般語に含まれてしまうため
// 指名検索の判定に使わない（誤って navigational に倒すと discovery を過小評価する）。
const MIN_STORE_TOKEN_LEN = 4;

// 店名を分割したときに、それ単体では店を特定できない業態語・一般語。
// これらをトークンとして採用すると「焼肉 接待」のような発見型クエリまで
// 指名検索に倒れてしまうため除外する。
const GENERIC_STORE_TOKENS = new Set([
  '名古屋', '名古屋駅', '名駅店', '名古屋店', '栄店', '大須店', '本店', '支店', '別邸', 'はなれ',
  '居酒屋', '焼肉', '焼鳥', '焼き鳥', '寿司', 'ラーメン', 'カフェ', 'バル', 'バー', 'ビストロ',
  'レストラン', 'ダイニング', '食堂', '酒場', '個室', '海鮮', '中華', '和食', '洋食', '鉄板焼',
  '中国料理', '韓国料理', '日本料理', '創作料理', 'イタリアン', 'フレンチ', '屋台'
]);

function loadKeywords() {
  if (!fs.existsSync(KW_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(KW_PATH, 'utf8')); } catch (_) { return null; }
}

/** 全角/半角・空白・記号の揺れを吸収する */
function norm(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s　・･]/g, '');
}

/**
 * 店名から「その店を特定できるトークン」を抽出する。
 *
 * GSC のクエリと DB の店名は長さが噛み合わない。実例:
 *   クエリ「のれんとコルク 名古屋」 vs DB「フレンチ屋台ビストロ のれんとコルク 名古屋駅店」
 * 素朴に `query.includes(storeName)` とすると DB 側が長すぎて一致せず、これらが
 * discovery 側に落ちて **効果指標を過大に見せる**（実際 2026-07-27 の実装で発生）。
 * そこで店名を分割し、業態語を除いた識別トークンを作って双方向で突き合わせる。
 */
function loadStoreNames() {
  if (!fs.existsSync(STORES_PATH)) return [];
  try {
    const d = JSON.parse(fs.readFileSync(STORES_PATH, 'utf8'));
    const arr = Array.isArray(d) ? d : (d.stores || []);
    const tokens = new Map(); // token -> 代表店名（説明用）
    arr.forEach(s => {
      const raw = String(s['店名'] || '').trim();
      if (!raw) return;
      // 空白・全角括弧・中黒で分割し、業態語と短すぎる語を落とす
      raw.split(/[\s　()（）【】\[\]]+/).forEach(part => {
        const t = norm(part);
        // 英数字だけのトークンは情報量が低く誤マッチしやすい（"bake" が
        // "national bakery" に当たる等）。日本語より長さを要求する。
        const minLen = /^[\x20-\x7e]+$/.test(t) ? 6 : MIN_STORE_TOKEN_LEN;
        if (t.length < minLen) return;
        if (GENERIC_STORE_TOKENS.has(part.trim()) || GENERIC_STORE_TOKENS.has(t)) return;
        if (!tokens.has(t)) tokens.set(t, raw);
      });
      // 店名全体（正規化）も候補に入れる（クエリが店名より長いケース）
      const whole = norm(raw);
      if (whole.length >= MIN_STORE_TOKEN_LEN && !tokens.has(whole)) tokens.set(whole, raw);
    });
    return Array.from(tokens.entries()).map(([token, name]) => ({ token, name }));
  } catch (_) { return []; }
}

/** 語彙グループ（scenes/areas/genres）のうち、text に現れた最初の kw を返す */
function hitIn(group, text) {
  for (const e of group || []) {
    const all = [e.kw].concat(e.aliases || []);
    const m = all.find(a => text.includes(String(a).toLowerCase()));
    if (m) return { kw: e.kw, matched: m };
  }
  return null;
}

/**
 * 1クエリを分類する。優先順位:
 *   1. brand        … サイト名
 *   2. navigational … 掲載店を特定できるトークンを含む（＝店を名指しで探している）
 *   3. discovery    … シーン語あり、または エリア語 × ジャンル語 の組み合わせ
 *   4. other
 *
 * navigational を discovery より**先に**判定するのは意図的。
 * 「フレンチ屋台ビストロ のれんとコルク 名古屋駅店」は エリア語(名古屋駅) と
 * ジャンル語(ビストロ) を含むため、順序を逆にすると discovery に数えられてしまう。
 * discovery は SEO-011 の効果を判定する指標なので、**過大に出る方向の誤りは許容しない**。
 * 迷うケースは navigational（＝Strategic Skip 側）に倒し、discovery を過小評価する。
 */
function classifyOne(rawQuery, kw, storeNames) {
  const q = String(rawQuery || '').toLowerCase();
  const nq = norm(rawQuery);

  if (BRAND_TERMS.some(b => q.includes(b))) {
    return { intent: 'brand', signals: [] };
  }

  // 双方向マッチ: クエリが店名トークンを含む / 店名トークンがクエリを含む
  const store = (storeNames || []).find(s => nq.includes(s.token) || (nq.length >= MIN_STORE_TOKEN_LEN && s.token.includes(nq)));
  if (store) return { intent: 'navigational', signals: [`store:${store.name}`] };

  const scene = kw ? hitIn(kw.scenes, q) : null;
  const area = kw ? hitIn(kw.areas, q) : null;
  const genre = kw ? hitIn(kw.genres, q) : null;

  if (scene || (area && genre)) {
    return {
      intent: 'discovery',
      signals: [scene && `scene:${scene.kw}`, area && `area:${area.kw}`, genre && `genre:${genre.kw}`].filter(Boolean)
    };
  }

  return {
    intent: 'other',
    signals: [area && `area:${area.kw}`, genre && `genre:${genre.kw}`].filter(Boolean)
  };
}

/**
 * クエリ配列を意図別に集計する。
 * rows: [{ query, clicks, impressions, position }, ...]
 */
function classifyQueries(rows) {
  const kw = loadKeywords();
  const storeNames = loadStoreNames();
  const buckets = {};
  const examples = {};

  (rows || []).forEach(r => {
    const { intent, signals } = classifyOne(r.query, kw, storeNames);
    const b = buckets[intent] = buckets[intent] || { queries: 0, impressions: 0, clicks: 0, positionSum: 0 };
    b.queries += 1;
    b.impressions += r.impressions || 0;
    b.clicks += r.clicks || 0;
    b.positionSum += (r.position || 0) * (r.impressions || 0); // 表示回数で重み付けした平均順位
    (examples[intent] = examples[intent] || []).push({
      query: r.query, impressions: r.impressions || 0, clicks: r.clicks || 0,
      position: r.position || 0, signals
    });
  });

  const totalImp = Object.values(buckets).reduce((a, b) => a + b.impressions, 0);
  const summary = Object.entries(buckets).map(([intent, b]) => ({
    intent,
    queries: b.queries,
    impressions: b.impressions,
    clicks: b.clicks,
    ctr: b.impressions ? +((b.clicks / b.impressions) * 100).toFixed(2) : 0,
    avg_position: b.impressions ? +(b.positionSum / b.impressions).toFixed(1) : 0,
    impressions_share: totalImp ? +((b.impressions / totalImp) * 100).toFixed(1) : 0
  })).sort((a, b) => b.impressions - a.impressions);

  // 各意図の上位例（表示回数順）。discovery は多めに残す（施策の当たり所を見るため）
  const topExamples = {};
  Object.keys(examples).forEach(k => {
    topExamples[k] = examples[k]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, k === 'discovery' ? 30 : 10);
  });

  const disc = summary.find(s => s.intent === 'discovery');
  return {
    kw_dictionary: kw ? { source: 'data/journal_seo_keywords.json', updated: kw.updated } : null,
    store_names_used: storeNames.length,
    total_queries: (rows || []).length,
    summary,
    // SEO-011 の効果はこの2値の推移で判定する（総クリックは指名検索の増減と混ざるため使わない）
    kpi: {
      discovery_impressions: disc ? disc.impressions : 0,
      discovery_clicks: disc ? disc.clicks : 0,
      discovery_impressions_share: disc ? disc.impressions_share : 0
    },
    examples: topExamples
  };
}

// ── CLI ─────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(METRICS_PATH)) {
    console.log(JSON.stringify({ ok: false, error: 'data/gsc_metrics.json が無い' }, null, 2));
    process.exit(1);
  }
  const m = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8'));
  const rows = m.queries && m.queries.length ? m.queries : (m.topQueries || []);
  const r = classifyQueries(rows);

  console.log(`=== 検索意図の内訳（${r.total_queries}クエリ / 辞書 ${r.kw_dictionary ? r.kw_dictionary.updated : 'なし'}）===\n`);
  console.log('  意図           クエリ数  表示回数  クリック    CTR  平均順位  表示シェア');
  r.summary.forEach(s => {
    console.log(`  ${s.intent.padEnd(14)}${String(s.queries).padStart(7)}${String(s.impressions).padStart(10)}${String(s.clicks).padStart(10)}${String(s.ctr + '%').padStart(7)}${String(s.avg_position).padStart(10)}${String(s.impressions_share + '%').padStart(11)}`);
  });
  console.log(`\n  → SEO-011 の効果指標: discovery 表示 ${r.kpi.discovery_impressions} / クリック ${r.kpi.discovery_clicks} / 表示シェア ${r.kpi.discovery_impressions_share}%`);
  if (r.total_queries <= 25) {
    console.log('\n  ⚠️ 上位25クエリしか無い（fetch_gsc_metrics.js の rowLimit が小さい）。');
    console.log('     指名検索が上位を埋めるため、この範囲では discovery の推移をほぼ観測できない。');
  }
  Object.entries(r.examples).forEach(([k, v]) => {
    console.log(`\n  --- ${k} の例 ---`);
    v.slice(0, 6).forEach(e => console.log(`    表示${String(e.impressions).padStart(5)} クリック${String(e.clicks).padStart(3)} 順位${String(e.position).padStart(5)}  ${e.query}${e.signals.length ? '  [' + e.signals.join(' ') + ']' : ''}`));
  });
}

if (require.main === module) main();

module.exports = { classifyQueries, classifyOne };
