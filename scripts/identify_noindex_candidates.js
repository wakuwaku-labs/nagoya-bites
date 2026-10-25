#!/usr/bin/env node
// SEO-130: noindex,follow 候補の店舗ページを特定する。
// Criterion A: 価格帯・Google評価・写真URL のうち 2つ以上が空 かつ 編集コメントなし
// Criterion B: 追加日 ≤ 60日前 かつ GSC 表示回数 0 かつ GSC クリック数 0
// 実際の noindex 適用は SEO-140（2026-11-15）で判断する。このスクリプトは候補抽出のみ。

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const GSC_PATH = path.join(ROOT, 'data', 'gsc_metrics.json');
const OUT_PATH = path.join(ROOT, 'data', 'noindex_candidates.json');

const BASE_URL = 'https://nagoya-bites.com';
const DAYS_OLD = 60;

function toSlug(store) {
  if (store['ホットペッパーID']) return store['ホットペッパーID'];
  if (store['英語名']) {
    return store['英語名'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  const ascii = store['店名'].replace(/[^\x00-\x7F]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii.length >= 3) return ascii;
  return 'store-' + Buffer.from(store['店名'], 'utf8').toString('hex').slice(0, 16);
}

function hasEditorialComment(s) {
  return !!(s['editorReason'] || s['おすすめポイント'] || s['insiderNote']);
}

function main() {
  const stores = JSON.parse(fs.readFileSync(STORES_PATH, 'utf8'));
  const gsc = JSON.parse(fs.readFileSync(GSC_PATH, 'utf8'));

  // cutoff date: 60 days before today
  const today = new Date('2026-10-25');
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - DAYS_OLD);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // 2026-08-26

  // Build GSC page sets
  const gscPages = gsc.pages || [];
  const pagesWithImpressions = new Set();
  const pagesWithClicks = new Set();
  for (const p of gscPages) {
    if (p.impressions > 0) pagesWithImpressions.add(p.page);
    if (p.clicks > 0) pagesWithClicks.add(p.page);
  }

  const candidatesA = [];
  const candidatesB = [];
  const candidatesBoth = [];

  for (const s of stores) {
    if (!s['店名']) continue;
    const slug = toSlug(s);
    const pageUrl = `${BASE_URL}/stores/${slug}.html`;

    // Criterion A: 2+ empty from (価格帯, Google評価, 写真URL) AND no editorial comment
    const emptyCount = [s['価格帯'], s['Google評価'], s['写真URL']].filter(v => !v || String(v).trim() === '').length;
    const criterionA = emptyCount >= 2 && !hasEditorialComment(s);

    // Criterion B: 追加日 ≤ cutoff AND 0 GSC impressions AND 0 GSC clicks
    const addedDate = (s['追加日'] || '').slice(0, 10);
    const isOldEnough = addedDate && addedDate <= cutoffStr;
    const noImpressions = !pagesWithImpressions.has(pageUrl);
    const noClicks = !pagesWithClicks.has(pageUrl);
    const criterionB = isOldEnough && noImpressions && noClicks;

    if (!criterionA && !criterionB) continue;

    const entry = {
      slug,
      pageUrl,
      name: s['店名'],
      area: s['エリア'] || '',
      genre: s['ジャンル'] || '',
      addedDate,
      criterionA,
      criterionB,
      emptyInfoFields: emptyCount,
      hasEditorial: hasEditorialComment(s),
      gscImpressions: gscPages.find(p => p.page === pageUrl)?.impressions ?? 0,
      gscClicks: gscPages.find(p => p.page === pageUrl)?.clicks ?? 0,
    };

    if (criterionA && criterionB) {
      candidatesBoth.push(entry);
    } else if (criterionA) {
      candidatesA.push(entry);
    } else {
      candidatesB.push(entry);
    }
  }

  const all = [...candidatesBoth, ...candidatesA, ...candidatesB];

  const out = {
    generatedAt: new Date().toISOString(),
    cutoffDate: cutoffStr,
    summary: {
      total: all.length,
      criterionAOnly: candidatesA.length,
      criterionBOnly: candidatesB.length,
      bothCriteria: candidatesBoth.length,
    },
    note: 'このファイルは候補リストのみ。実際の noindex 適用は SEO-140（2026-11-15）で判断する。',
    candidates: all,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`生成完了: ${OUT_PATH}`);
  console.log(`  候補合計: ${all.length} 件`);
  console.log(`  A基準のみ (情報薄・コメントなし): ${candidatesA.length} 件`);
  console.log(`  B基準のみ (60日超・表示0): ${candidatesB.length} 件`);
  console.log(`  A+B両方: ${candidatesBoth.length} 件`);
  console.log(`  基準日: 追加日 ≤ ${cutoffStr}`);
}

main();
