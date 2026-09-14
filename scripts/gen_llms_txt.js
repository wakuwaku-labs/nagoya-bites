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
 * 使い方:
 *   node scripts/gen_llms_txt.js            # 再生成して書き込み
 *   node scripts/gen_llms_txt.js --check    # 現状との差分を検査（書き込みなし・CI向け・差分があれば exit 1）
 */

const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');
const { loadPolicy, normalizeArea, normalizeGenre, openStores } = require('./lib/area_genre_pages');

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
// 集計3: エリア×ジャンルハブ（SEO-094・data/area_genre_pages_manifest.json）
//   全691本を列挙する必要はないため、件数の内訳と掲載店数上位の代表例だけを出す。
// ================================================================
function collectHubs(policy) {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
  const pages = (manifest.pages || []).filter((p) => p.status === 'active');
  const byType = {};
  for (const p of pages) byType[p.type] = (byType[p.type] || 0) + 1;

  const areaLabel = new Map(policy.areas.map((a) => [a.slug, a.label]));
  const genreLabel = new Map(policy.genres.map((g) => [g.slug, g.label]));

  const top = pages
    .filter((p) => p.type === 'genre')
    .map((p) => {
      const m = p.path.match(/^stores\/area\/([^/]+)\/([^/]+)\.html$/);
      if (!m) return null;
      const areaSlug = m[1];
      const genreSlug = m[2];
      return {
        path: p.path,
        count: p.count || 0,
        label: `${areaLabel.get(areaSlug) || areaSlug}×${genreLabel.get(genreSlug) || genreSlug}`,
      };
    })
    .filter(Boolean)
    .sort((x, y) => y.count - x.count)
    .slice(0, 5);

  return { total: pages.length, byType, top };
}

// ================================================================
// 各マーカーの新しい中身を組み立てる
// ================================================================
function buildMarkerContent() {
  const stores = loadStores();
  const policy = loadPolicy();
  const stats = computeStoreStats(stores, policy);
  const features = collectFeatures();
  const hubs = collectHubs(policy);

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

  let hubsBlock;
  if (hubs) {
    hubsBlock = [
      '',
      `SEO-094で新設したエリア×ジャンル×条件の一覧ページ（stores/area/配下）が${fmtNum(hubs.total)}本公開されている` +
        `（索引${hubs.byType.root || 0}本 + エリアハブ${hubs.byType.area || 0}本 + エリア×ジャンルハブ${hubs.byType.genre || 0}本 + 条件付きハブ${hubs.byType.condition || 0}本）。`,
      `起点: ${BASE_URL}/stores/area/index.html`,
      '',
      '代表例（掲載店舗数が多い順）:',
      ...hubs.top.map((h) => `- ${h.label}: ${BASE_URL}/${h.path}（${fmtNum(h.count)}店）`),
      '',
    ].join('\n');
  } else {
    // data/area_genre_pages_manifest.json が無いビルド（初回セットアップ等）でも
    // gen_llms_txt.js 単体が落ちないようにするフォールバック。通常運用では発生しない。
    hubsBlock = '\n（data/area_genre_pages_manifest.json が見つからないため、このセクションは次回ビルドまで前回値のまま）\n';
  }

  return {
    store_count: storeCountStr,
    feature_count: featureCountStr,
    areas: areasBlock,
    genres: genresBlock,
    features: featuresBlock,
    area_genre_hubs: hubsBlock,
  };
}

function main() {
  if (!fs.existsSync(LLMS_PATH)) {
    console.error('[gen_llms_txt] llms.txt が見つかりません（ルート直下に無い）');
    process.exit(1);
  }
  const original = fs.readFileSync(LLMS_PATH, 'utf8');
  const content = buildMarkerContent();

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

main();
