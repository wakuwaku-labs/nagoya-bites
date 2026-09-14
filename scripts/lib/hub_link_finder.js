'use strict';
/**
 * scripts/lib/hub_link_finder.js
 *
 * SEO-099: 特集記事(features/*.html)・ジャーナル記事(journal/*.html)から、
 * エリア×ジャンル×条件ハブ（stores/area/配下・SEO-094・691本）への内部リンク候補を
 * 「後から第三者が確認できる事実」だけで機械的に決定する唯一の情報源（CLAUDE.md 制約10）。
 *
 * 対応関係の根拠（すべて実在ファイル。自己申告値は使わない）:
 *   - data/journal_seo_keywords.json      … どの特集ファイルが対象か（areas[]/scenes[]/genres[] の feature）
 *   - data/area_genre_pages_policy.json   … ジャンル/エリア/条件 → feature の逆引き元（唯一の情報源）
 *   - data/area_genre_pages_manifest.json … 実在するハブページの台帳（status:"active" のみ採用）
 *   - 実ファイルの存在（fs.existsSync）    … 台帳が古い場合でも壊れたリンクを張らないための二重確認
 *
 * 閾値・マッピングの変更は上記3つのJSONで行い、本ファイルのロジックは触らない。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const KW_PATH = path.join(ROOT, 'data', 'journal_seo_keywords.json');
const POLICY_PATH = path.join(ROOT, 'data', 'area_genre_pages_policy.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'area_genre_pages_manifest.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function buildManifestIndex(manifest) {
  const byPath = new Map();
  for (const p of manifest.pages || []) {
    if (p.status !== 'active') continue; // noindex化/stub化されたページはリンクしない
    byPath.set(p.path, p);
  }
  return byPath;
}

/**
 * 実在するハブページだけを候補に採用する（台帳 status:"active" ＋ 実ファイル存在の二重確認）。
 */
function resolveHub(byPath, url) {
  const rec = byPath.get(url);
  if (!rec) return null;
  if (!fs.existsSync(path.join(ROOT, url))) return null;
  return rec;
}

/**
 * journal_seo_keywords.json の areas[]/scenes[]/genres[] から、
 * 「エリア×ジャンル×条件ハブとの対応付け対象」となる特集ファイル集合を作る。
 * すでに stores/area/... 自体を指すエントリ（例: areas[].feature が既にハブページのもの）は
 * それ自体がハブなので対象から除く。
 */
function collectTargetFeatures(kw) {
  const set = new Set();
  for (const group of [kw.areas, kw.scenes, kw.genres]) {
    for (const e of group || []) {
      if (e.feature && e.feature.startsWith('features/')) set.add(e.feature);
    }
  }
  return set;
}

/**
 * feature（例: "features/nagoya-yakiniku.html"）ごとに、対応するハブページ候補を
 * count（掲載店数）降順で最大 maxLinks 件返す。
 *
 * @returns {Map<string, Array<{url:string,label:string,count:number}>>}
 */
function buildFeatureHubMap({ maxLinks = 3 } = {}) {
  const kw = loadJson(KW_PATH);
  const policy = loadJson(POLICY_PATH);
  const manifest = loadJson(MANIFEST_PATH);
  const byPath = buildManifestIndex(manifest);

  const targetFeatures = collectTargetFeatures(kw);
  const result = new Map();

  for (const feature of targetFeatures) {
    const candidates = [];

    // ① ジャンルハブ: policy.genres[].feature === feature → 各エリアの area×genre ページ
    for (const g of policy.genres) {
      if (g.feature !== feature) continue;
      for (const a of policy.areas) {
        const url = `stores/area/${a.slug}/${g.slug}.html`;
        const rec = resolveHub(byPath, url);
        if (!rec) continue;
        candidates.push({ url, label: `${a.label}の${g.label}を探す`, count: rec.count || 0 });
      }
    }

    // ② エリアハブ本体: policy.areas[].feature === feature → そのエリアの index.html
    for (const a of policy.areas) {
      if (a.feature !== feature) continue;
      const url = `stores/area/${a.slug}/index.html`;
      const rec = resolveHub(byPath, url);
      if (!rec) continue;
      candidates.push({ url, label: `${a.label}の店を探す`, count: rec.count || 0 });
    }

    // ③ 条件ハブ: policy.conditions[].feature === feature → エリア×ジャンル×条件ページ
    for (const c of policy.conditions) {
      if (c.feature !== feature) continue;
      for (const a of policy.areas) {
        for (const g of policy.genres) {
          const url = `stores/area/${a.slug}/${g.slug}-${c.slug}.html`;
          const rec = resolveHub(byPath, url);
          if (!rec) continue;
          candidates.push({ url, label: `${a.label}の${g.label}（${c.label}）`, count: rec.count || 0 });
        }
      }
    }

    if (candidates.length === 0) continue;

    const seen = new Set();
    const top = candidates
      .sort((x, y) => y.count - x.count)
      .filter(c => {
        if (seen.has(c.url)) return false;
        seen.add(c.url);
        return true;
      })
      .slice(0, maxLinks);

    result.set(feature, top);
  }

  return result;
}

module.exports = {
  buildFeatureHubMap,
  collectTargetFeatures,
  loadJson,
};
