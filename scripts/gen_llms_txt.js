'use strict';
/**
 * scripts/gen_llms_txt.js
 *
 * ルート直下の llms.txt（LLM向けサイト要約。ChatGPT等の生成AIがクロールする想定の
 * サイト概要ファイル）のうち、データドリブンな数値・一覧セクションだけを
 * data/stores.json / data/area_genre_pages_manifest.json / features/*.html から
 * 決定的に再生成する（SEO-097）。
 *
 * llms.txt には「静的な編集文章」（サイト紹介文・競合比較表・名古屋めし紹介・
 * 引用にあたっての注意書き等）と「データドリブンな数値・一覧」（店舗数・エリア別/
 * ジャンル別内訳・特集記事一覧・エリア×ジャンルハブ一覧）が混在している。全文を
 * ゼロから機械生成すると編集の声（CLAUDE.md 制約3の日本語文章・編集方針の言葉づかい）が
 * 消えてしまうため、<!-- AUTO-GENERATED:<name>:start/end --> マーカーで囲った区間だけを
 * 置換する（scripts/build_featured.js の FEATURED_START/END マーカーと同じ思想）。
 *
 * 背景: llms.txt は2026-09-06の手動更新を最後に build.yml から一度も再生成されておらず、
 * 店舗数（4,584店のまま・実際は約4,900店）・特集記事一覧（68本中62本が未掲載）が
 * 実データと乖離していた。ChatGPT経由セッションが減衰傾向（30日窓で134→91）にある中、
 * 生成AIへ渡す一次情報が古いままなのは機会損失なので、CIで自動再生成する。
 *
 * 集計は data/stores.json（build.js の canonical 出力）と、SEO-094 で導入済みの
 * data/area_genre_pages_policy.json / scripts/lib/area_genre_pages.js を再利用する
 * （エリア・ジャンルの区分をここで独自に作り直すと、stores/area/ 配下のハブページと
 * 定義がズレて二重管理になるため。CLAUDE.md 制約10＝検証できる事実だけで判定）。
 *
 * SEO-135（2026-10-09）: エリア → ジャンル → 条件の全階層（manifest の active だけ）と、
 * 数値の出典・更新日（data_sources マーカー）を足した。全階層はファイル末尾の area_genre_tree。
 *
 * 使い方:
 *   node scripts/gen_llms_txt.js            # 再生成して書き込み
 *   node scripts/gen_llms_txt.js --check    # 現状との差分を検査（書き込みなし・CI向け・差分があれば exit 1）
 */

const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');
const { loadPolicy, normalizeArea, normalizeGenre, openStores } = require('./lib/area_genre_pages');
const { normDate } = require('./lib/sitemap_lastmod');

const ROOT = path.resolve(__dirname, '..');
const LLMS_PATH = path.join(ROOT, 'llms.txt');
const MANIFEST_PATH = path.join(ROOT, 'data', 'area_genre_pages_manifest.json');
const FEATURES_DIR = path.join(ROOT, 'features');
const BASE_URL = 'https://nagoya-bites.com';

const CHECK = process.argv.includes('--check');

// 特集記事一覧から除外するファイル（特集記事ではなく編集ポリシー/メタページで、
// llms.txt の「サイトについて」節で個別にリンク済み＝二重掲載を避ける）
const FEATURE_EXCLUDE = new Set([
  'index.html',            // features/ の一覧ページ自体（記事ではない）
  'editorial-policy.html', // 編集規約
  'integrity-method.html', // 口コミ信頼度の計算式
  'review-trust.html',     // 口コミ信頼度の読み方
  'no-fake-reviews.html',  // サクラ口コミ問題の解説
  'become-reviewer.html',  // レビュワー募集ページ
]);

function fmtNum(n) {
  return n.toLocaleString('en-US');
}

// ================================================================
// マーカー置換（scripts/build_featured.js の replaceBetween と同じ方式。
// 'g' フラグで同名マーカーの複数箇所（例: 店舗数はサイト紹介文/データ規模/
// 競合比較表/引用にあたって の4箇所に出現）を一括置換する）
// ================================================================
function replaceMarker(src, name, newInner) {
  const startTag = `<!-- AUTO-GENERATED:${name}:start -->`;
  const endTag = `<!-- AUTO-GENERATED:${name}:end -->`;
  const re = new RegExp(`${startTag}[\\s\\S]*?${endTag}`, 'g');
  if (!re.test(src)) {
    throw new Error(`llms.txt にマーカーが見つかりません: ${name}（${startTag} 〜 ${endTag}）`);
  }
  re.lastIndex = 0;
  return src.replace(re, `${startTag}${newInner}${endTag}`);
}

// ================================================================
// 集計1: 総店舗数・エリア別/ジャンル別内訳
//   区分の正本は data/area_genre_pages_policy.json（SEO-094 と同一）。
//   閉店（一時休業・完全閉店）は openStores() で除外し「今アクセス可能な店」だけを数える。
// ================================================================
function computeStoreStats(stores, policy) {
  const active = openStores(stores);
  const areaCounts = new Map();
  const genreCounts = new Map();
  let mappedToArea = 0;

  for (const s of active) {
    const area = normalizeArea(s['エリア'], policy);
    if (area) {
      areaCounts.set(area.slug, (areaCounts.get(area.slug) || 0) + 1);
      mappedToArea++;
    }
    const genre = normalizeGenre(s['ジャンル'], policy);
    if (genre) genreCounts.set(genre.slug, (genreCounts.get(genre.slug) || 0) + 1);
  }

  const areas = policy.areas
    .map((a) => ({ label: a.label, count: areaCounts.get(a.slug) || 0 }))
    .filter((a) => a.count > 0)
    .sort((x, y) => y.count - x.count);

  const genres = policy.genres
    .map((g) => ({ label: g.label, count: genreCounts.get(g.slug) || 0 }))
    .filter((g) => g.count > 0)
    .sort((x, y) => y.count - x.count);

  return { total: active.length, mappedToArea, areaGroupCount: policy.areas.length, areas, genres };
}

// meta description の中から、タイトルと中身が被らない最初の1文を短い紹介文として選ぶ。
// 一部の特集は description の1文目がタイトルの言い換えに過ぎない
// （例: title「名古屋カフェ おすすめ10選」/ description「名古屋カフェおすすめ10選。ス
// ペシャルティコーヒー…」）ため、そのまま1文目を機械的に採用すると「タイトルの繰り返し」に
// なる。記号・空白を除いて比較し、タイトルと重複する文はスキップして次の文を採用する。
function pickDescriptionSentence(fullDesc, title) {
  const sentences = fullDesc.split('。').map((s) => s.trim()).filter(Boolean);
  const normalize = (s) => s.replace(/[【】\[\]（）()｜|・,、\s0-9]/g, '');
  const nTitle = normalize(title);
  for (const s of sentences) {
    const nS = normalize(s);
    if (nS && (nTitle.includes(nS) || nS.includes(nTitle))) continue; // タイトルと実質同じ→スキップ
    return `${s}。`;
  }
  return '';
}

// ================================================================
// 集計2: 特集記事一覧（features/*.html を走査。タイトル/descriptionは
// <title> / <meta name="description"> から機械抽出、静的な編集文章は書かない）
// ================================================================
function collectFeatures() {
  const files = fs.readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.html') && !FEATURE_EXCLUDE.has(f))
    .sort(); // アルファベット順=決定的（mtimeはCIチェックアウトのたびにリセットされ非決定的になるため使わない）

  const items = [];
  for (const f of files) {
    const html = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    const titleM = html.match(/<title>([^<]*)<\/title>/);
    if (!titleM) continue; // タイトル無しページは一覧に出しようがないためスキップ
    const title = titleM[1].replace(/\s*[｜|]\s*NAGOYA BITES\s*$/, '').trim();

    const descM = html.match(/name="description"\s+content="([^"]*)"/);
    const desc = descM ? pickDescriptionSentence(descM[1].trim(), title) : '';
    items.push({ file: f, title, desc });
  }
  return items;
}

// ================================================================
// 集計3: エリア×ジャンル×条件の一覧ページ（SEO-094・data/area_genre_pages_manifest.json）
//   公開中（status=active）のページだけを、エリア → ジャンル → 条件の階層にまとめる（SEO-135）。
//   ページの区分は URL から読み取る。URL の作り方の正本は scripts/lib/area_genre_pages.js の
//   planPages（`<エリア>/index.html`・`<エリア>/<ジャンル>.html`・`<エリア>/<ジャンル>-<条件>.html`）。
//   ジャンルと条件の記号はどちらもハイフンを含む（dining-bar・late-night 等）ため、先頭の
//   ハイフンで割らず、ポリシーの全組み合わせから URL を引く表を作って照合する。
//   条件ページの URL を全部（約600本）書くとファイルの前半（編集方針・特集一覧）が読まれにくく
//   なるため、エリアとジャンルのページは URL を書き、条件ページは記号と掲載店数だけを書いて
//   URL の作り方を1回だけ示す。全階層はファイル末尾に置く。
// ================================================================
function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function hubUrlIndex(policy) {
  const base = policy.baseDir || 'stores/area';
  const index = new Map([[`${base}/index.html`, { type: 'root' }]]);
  for (const area of policy.areas) {
    index.set(`${base}/${area.slug}/index.html`, { type: 'area', area });
    for (const genre of policy.genres) {
      index.set(`${base}/${area.slug}/${genre.slug}.html`, { type: 'genre', area, genre });
      for (const cond of policy.conditions) {
        index.set(`${base}/${area.slug}/${genre.slug}-${cond.slug}.html`, { type: 'condition', area, genre, cond });
      }
    }
  }
  return index;
}

function collectHubs(policy, manifest) {
  if (!manifest) return null;
  const pages = (manifest.pages || []).filter((p) => p.status === 'active');
  const byType = {};
  for (const p of pages) byType[p.type] = (byType[p.type] || 0) + 1;

  const areaOrder = new Map(policy.areas.map((a, i) => [a.slug, i]));
  const genreOrder = new Map(policy.genres.map((g, i) => [g.slug, i]));
  const condOrder = new Map(policy.conditions.map((c, i) => [c.slug, i]));
  const index = hubUrlIndex(policy);
  const areas = new Map();
  const unknown = [];
  let lastUpdated = null;

  for (const p of pages) {
    const updated = normDate(p.updated);
    if (updated && (!lastUpdated || updated > lastUpdated)) lastUpdated = updated;
    const hit = index.get(p.path);
    if (!hit || hit.type !== p.type) {
      unknown.push(p.path);
      continue;
    }
    if (hit.type === 'root') continue;
    if (!areas.has(hit.area.slug)) {
      areas.set(hit.area.slug, { slug: hit.area.slug, label: hit.area.label, url: null, count: null, genres: new Map() });
    }
    const a = areas.get(hit.area.slug);
    if (hit.type === 'area') {
      a.url = p.path;
      a.count = p.count || 0;
      continue;
    }
    if (!a.genres.has(hit.genre.slug)) {
      a.genres.set(hit.genre.slug, { slug: hit.genre.slug, label: hit.genre.label, url: null, count: null, conditions: [] });
    }
    const g = a.genres.get(hit.genre.slug);
    if (hit.type === 'genre') {
      g.url = p.path;
      g.count = p.count || 0;
      continue;
    }
    g.conditions.push({ slug: hit.cond.slug, label: hit.cond.label, url: p.path, count: p.count || 0 });
  }

  // 掲載店数の多い順。同数はポリシーの並び順（決定的）。条件はポリシーの並び順で固定する
  const byCount = (order) => (x, y) => (y.count || 0) - (x.count || 0) || order.get(x.slug) - order.get(y.slug);
  const tree = [...areas.values()]
    .map((a) => ({
      ...a,
      genres: [...a.genres.values()]
        .map((g) => ({ ...g, conditions: g.conditions.sort((x, y) => condOrder.get(x.slug) - condOrder.get(y.slug)) }))
        .sort(byCount(genreOrder)),
    }))
    .sort(byCount(areaOrder));

  const top = tree
    .flatMap((a) => a.genres.filter((g) => g.url).map((g) => ({ path: g.url, count: g.count, label: `${a.label}×${g.label}` })))
    .sort((x, y) => y.count - x.count)
    .slice(0, 5);

  return { total: pages.length, byType, top, tree, lastUpdated, unknown };
}

function renderHubSummary(hubs) {
  return [
    '',
    `SEO-094で新設したエリア×ジャンル×条件の一覧ページ（stores/area/配下）が${fmtNum(hubs.total)}本公開されている` +
      `（索引${hubs.byType.root || 0}本 + エリアハブ${hubs.byType.area || 0}本 + エリア×ジャンルハブ${hubs.byType.genre || 0}本 + 条件付きハブ${hubs.byType.condition || 0}本）。`,
    `起点: ${BASE_URL}/stores/area/index.html`,
    `本数と掲載店数の出典: ${BASE_URL}/data/area_genre_pages_manifest.json` +
      (hubs.lastUpdated ? `（ページの内容が最後に変わった日: ${hubs.lastUpdated}）` : ''),
    '',
    '代表例（掲載店舗数が多い順）:',
    ...hubs.top.map((h) => `- ${h.label}: ${BASE_URL}/${h.path}（${fmtNum(h.count)}店）`),
    '',
    'エリア → ジャンル → 条件の全階層は、このファイル末尾の「エリア×ジャンル×条件の一覧ページ（全階層）」に載せている。',
    '',
  ].join('\n');
}

function renderHubTree(hubs, policy) {
  const used = new Set(hubs.tree.flatMap((a) => a.genres.flatMap((g) => g.conditions.map((c) => c.slug))));
  const legend = policy.conditions.filter((c) => used.has(c.slug));
  let example = null;
  for (const a of hubs.tree) {
    const g = a.genres.find((x) => x.url && x.conditions.length);
    if (g) {
      example = { label: `${a.label}×${g.label}×${g.conditions[0].label}`, url: g.conditions[0].url };
      break;
    }
  }
  const lines = [
    '',
    '公開中のページ（data/area_genre_pages_manifest.json で status が active のもの）だけを、エリア → ジャンル → 条件の順に載せている。「N店」は掲載店数。',
    '条件別のページの URL は、ジャンルのページの URL の末尾「.html」を「-条件記号.html」に替えたもの' +
      (example ? `（例: ${example.label} → ${BASE_URL}/${example.url}）` : '') +
      '。各ジャンルの行には、ページが実在する条件だけを「条件記号(掲載店数)」の形で載せている。',
    `条件記号: ${legend.map((c) => `${c.slug}=${c.label}`).join(' / ')}`,
    '',
  ];
  for (const a of hubs.tree) {
    lines.push(`### ${a.label}${a.count != null ? `・${fmtNum(a.count)}店` : ''}${a.url ? `: ${BASE_URL}/${a.url}` : ''}`);
    for (const g of a.genres) {
      const head = `- ${g.label}${g.count != null ? `・${fmtNum(g.count)}店` : ''}${g.url ? `: ${BASE_URL}/${g.url}` : ''}`;
      const conds = g.conditions.length
        ? ` ／ 条件別${g.conditions.length}本: ${g.conditions.map((c) => `${c.slug}(${fmtNum(c.count)})`).join(' ')}`
        : '';
      lines.push(head + conds);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ================================================================
// 数値の出典と更新日（SEO-135）
//   店舗の数値は「この数値に更新した日」＝店舗数・エリア別/ジャンル別の内訳が前回の llms.txt から
//   変わった日。変わらなければ前回の日付を引き継ぐ（毎日の再生成で日付だけが動いて差分になるのを避け、
//   sitemap の lastmod と同じく「内容が変わった日」を書く・SEO-121）。日付は UTC。
//   ハブの数値は manifest の updated（ページ内容が変わった日）の最大値。
// ================================================================
function readMarker(src, name) {
  const re = new RegExp(`<!-- AUTO-GENERATED:${name}:start -->([\\s\\S]*?)<!-- AUTO-GENERATED:${name}:end -->`);
  const m = src.match(re);
  return m ? m[1] : null;
}

function storesAsOf(original, content, today) {
  const prev = readMarker(original, 'data_sources');
  const m = prev && prev.match(/この数値に更新した日: (\d{4}-\d{2}-\d{2})/);
  const unchanged = ['store_count', 'areas', 'genres'].every((n) => readMarker(original, n) === content[n]);
  return unchanged && m ? m[1] : today;
}

function renderDataSources({ storesDate, hubsDate }) {
  return [
    '',
    `  - 店舗数・エリア別/ジャンル別の内訳: ${BASE_URL}/data/stores.json から営業中の店だけを数えた値（この数値に更新した日: ${storesDate}）`,
    `  - エリア×ジャンル×条件ページの本数と掲載店数: ${BASE_URL}/data/area_genre_pages_manifest.json の値` +
      (hubsDate ? `（ページの内容が最後に変わった日: ${hubsDate}）` : ''),
    `  - 特集記事の本数: ${BASE_URL}/features/ 配下の記事ページの数（一覧ページと編集規約などの案内ページを除く）`,
    '',
  ].join('\n');
}

// ================================================================
// 各マーカーの新しい中身を組み立てる
// ================================================================
function buildMarkerContent(original, today) {
  const stores = loadStores();
  const policy = loadPolicy();
  const stats = computeStoreStats(stores, policy);
  const features = collectFeatures();
  const hubs = collectHubs(policy, loadManifest());

  const storeCountStr = fmtNum(stats.total);
  const featureCountStr = `${features.length}本`;

  const areasBlock = [
    '',
    `エリア別内訳（${stats.areaGroupCount}区分・営業中${storeCountStr}店中${fmtNum(stats.mappedToArea)}店をマッピング。区分の定義は data/area_genre_pages_policy.json＝stores/area/配下のエリア×ジャンルハブと同一の正本）:`,
    '',
    ...stats.areas.map((a) => `- ${a.label}: ${fmtNum(a.count)}店`),
    '',
  ].join('\n');

  const genresBlock = stats.genres.map((g) => `${g.label} ${fmtNum(g.count)}`).join(' / ');

  const featuresBlock = [
    '',
    ...features.map((f) => `- [${f.title}](${BASE_URL}/features/${f.file})${f.desc ? `: ${f.desc}` : ''}`),
    '',
  ].join('\n');

  // data/area_genre_pages_manifest.json が無いビルド（初回セットアップ等）でも
  // gen_llms_txt.js 単体が落ちないようにするフォールバック。通常運用では発生しない。
  const missing = '\n（data/area_genre_pages_manifest.json が見つからないため、このセクションは次回ビルドまで前回値のまま）\n';

  const content = {
    store_count: storeCountStr,
    feature_count: featureCountStr,
    areas: areasBlock,
    genres: genresBlock,
    features: featuresBlock,
    area_genre_hubs: hubs ? renderHubSummary(hubs) : missing,
    area_genre_tree: hubs ? renderHubTree(hubs, policy) : missing,
  };
  content.data_sources = renderDataSources({
    storesDate: storesAsOf(original, content, today),
    hubsDate: hubs ? hubs.lastUpdated : null,
  });
  if (hubs && hubs.unknown.length) {
    console.warn(`[gen_llms_txt] ポリシーの URL 規則に当てはまらない公開中ページ ${hubs.unknown.length}本（一覧から外した）: ${hubs.unknown.slice(0, 5).join(', ')}`);
  }
  return content;
}

function main() {
  if (!fs.existsSync(LLMS_PATH)) {
    console.error('[gen_llms_txt] llms.txt が見つかりません（ルート直下に無い）');
    process.exit(1);
  }
  const original = fs.readFileSync(LLMS_PATH, 'utf8');
  const content = buildMarkerContent(original, new Date().toISOString().slice(0, 10));

  let next = original;
  for (const [name, inner] of Object.entries(content)) {
    next = replaceMarker(next, name, inner);
  }

  if (next === original) {
    console.log('[gen_llms_txt] 差分なし（llms.txt は最新）');
    return;
  }

  if (CHECK) {
    console.error('[gen_llms_txt] llms.txt が最新の集計と一致しません（node scripts/gen_llms_txt.js を実行して反映してください）');
    process.exit(1);
  }

  fs.writeFileSync(LLMS_PATH, next, 'utf8');
  console.log('[gen_llms_txt] llms.txt を再生成しました');
}

module.exports = {
  replaceMarker,
  readMarker,
  hubUrlIndex,
  collectHubs,
  renderHubSummary,
  renderHubTree,
  renderDataSources,
  storesAsOf,
  buildMarkerContent,
};

if (require.main === module) main();
