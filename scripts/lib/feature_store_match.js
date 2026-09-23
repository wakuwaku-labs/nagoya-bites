'use strict';

/**
 * scripts/lib/feature_store_match.js
 *
 * 特集記事（features/*.html）の掲載店を実在店（LOCAL_STORES）へ突き合わせる、
 * 唯一の判定ロジック（SEO-106）。`scripts/audit_feature_stores.js`（実在不明の検出）と
 * build.js（店舗カードへの「掲載特集」ラベル付与）が、この1本を共有する。
 * 判定基準を増やす・緩めるときはここだけを直す。
 *
 * 店舗データは呼び出し側が渡す（このモジュール自身はファイルを読まない）。
 * build.js は自分がビルド中の最新 stores 配列をそのまま渡し、audit 側は
 * scripts/lib/load_stores.js（data/stores.json）を渡す。両者がズレた店名を
 * 見ないよう、突き合わせ対象は常に呼び出し側の「今のデータ」にする。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const FEATURES_INDEX = path.join(FEATURES_DIR, 'index.html');

// ISSUE-061 後続: NFKC で全角→半角統一
const norm = (s) => String(s || '').normalize('NFKC').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();

// ISSUE-064: 識別力トークン照合（audit_feature_stores.js と同一の語彙）
const GENERIC_STORE_TOKENS = new Set([
  '炉端とおでん', '炉端焼き', '炉端焼', '個室居酒屋', '完全個室', '海鮮居酒屋', '創作居酒屋',
  '大衆居酒屋', '個室ダイニング', 'ダイニングバー', '鉄板焼き', '鉄板焼', '中国料理', '本格中華',
  '創作料理', '和食処', '日本料理', '焼肉ホルモン', '炭火焼鳥', '炭火焼肉', 'もつ鍋',
].map(t => t.normalize('NFKC').toLowerCase()));

const tokenizeDistinctive = (s) =>
  String(s || '')
    .normalize('NFKC').toLowerCase()
    .replace(/&amp;/g, '&')
    .split(/[\s　]+/)
    .filter(Boolean)
    .filter(t => t.length >= 3 && !/店$/.test(t) && !GENERIC_STORE_TOKENS.has(t));

/**
 * 店舗配列から「掲載店名 → 実在店」の解決器を作る。
 * audit_feature_stores.js の isReal() と同じ3段階（完全一致／内包一致／識別力トークン2つ以上共有）。
 * @param {Array<object>} stores LOCAL_STORES 相当の配列（各要素は少なくとも 店名 を持つ）
 */
function buildResolver(stores) {
  const byNorm = new Map();
  for (const s of stores) {
    const nn = norm(s['店名']);
    if (nn && !byNorm.has(nn)) byNorm.set(nn, s);
  }
  const realTokenSets = stores
    .map(s => ({ store: s, toks: new Set(tokenizeDistinctive(s['店名'])) }))
    .filter(x => x.toks.size > 0);

  function resolve(name) {
    const nn = norm(name);
    if (!nn) return null;
    if (byNorm.has(nn)) return byNorm.get(nn);
    if (nn.length >= 4) {
      for (const [rn, s] of byNorm) {
        if (rn.includes(nn) || nn.includes(rn)) return s;
      }
    }
    const toks = tokenizeDistinctive(name);
    if (toks.length >= 2) {
      for (const { store, toks: rset } of realTokenSets) {
        let shared = 0;
        for (const t of toks) if (rset.has(t)) shared++;
        if (shared >= 2) return store;
      }
    }
    return null;
  }
  return { resolve };
}

/** 特集HTML本文から掲載店名（生文字列）を抽出する。audit_feature_stores.js と同一の正規表現。 */
function extractFeatureStoreNames(html) {
  return [...html.matchAll(/class="(?:shop-name|store-name)"[^>]*>(?:<a[^>]*>)?([^<]+)/g)]
    .map(m => m[1].trim())
    .filter(Boolean);
}

/**
 * features/index.html の記事カードから slug → {title, img} を取る（build_featured.js の
 * parseFeatureCards と同じ抽出）。ラベル用の短い表示タイトルはここだけを正本にし、
 * 各特集の <title> タグ（長い・SEO用）を流用しない。
 */
function loadFeatureCardTitles() {
  const map = {};
  if (!fs.existsSync(FEATURES_INDEX)) return map;
  const src = fs.readFileSync(FEATURES_INDEX, 'utf8');
  const re = /<a class="article-card[^"]*" href="([^"]+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(src))) {
    const slug = m[1];
    const body = m[2];
    const title = (body.match(/<div class="card-title">([\s\S]*?)<\/div>/) || [])[1];
    if (title) map[slug] = title.trim();
  }
  return map;
}

/** 表示用の短いラベル（「｜」区切りの前半だけを使う）。 */
function shortLabel(title) {
  return String(title || '').split(/[｜|]/)[0].trim();
}

/**
 * 店舗 → 掲載特集一覧（重複店名は最初の1件に集約） のマップを構築する。
 * 対応が取れない特集（features/index.html にカードが無い＝表示用タイトルが無い）はスキップする
 * （取り繕わない・constraint 10）。
 *
 * @param {Array<object>} stores 突き合わせ対象の実在店配列
 * @returns {Map<object, Array<{slug:string, title:string}>>} 実在店オブジェクト(参照同一性) → 特集一覧
 */
function buildFeatureStoreMap(stores) {
  const resolver = buildResolver(stores);
  const cardTitles = loadFeatureCardTitles();
  const map = new Map(); // store(参照) -> [{slug,title}]

  if (!fs.existsSync(FEATURES_DIR)) return map;
  const files = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    const title = cardTitles[slug];
    if (!title) continue; // features/index.html に無い特集はラベル化しない（表示名の根拠が無い）
    const html = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    const names = extractFeatureStoreNames(html);
    const seenInThisFeature = new Set();
    for (const name of names) {
      const store = resolver.resolve(name);
      if (!store) continue;
      if (seenInThisFeature.has(store)) continue; // 同一特集内の重複掲載は1件に
      seenInThisFeature.add(store);
      const entry = { slug, title: shortLabel(title) };
      if (!map.has(store)) map.set(store, []);
      map.get(store).push(entry);
    }
  }
  return map;
}

module.exports = { buildResolver, buildFeatureStoreMap, extractFeatureStoreNames, loadFeatureCardTitles, shortLabel, norm, tokenizeDistinctive };
