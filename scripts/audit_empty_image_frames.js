#!/usr/bin/env node
'use strict';
/**
 * 空の画像枠と「写真なし」の割合の検査（G3・2026-11-13）。
 * デザイン監査（~/orca/_design-audit）で、画像の無いカードがベージュの空箱として出る・空の枠の上に再生ボタンが乗る、が見つかった。
 * 機械はこれまで「写真があるか」すら見ていなかった。ここで次を測り、基準値（data/image_frames_baseline.json）より悪くなったら落とす。
 *   1. 特集一覧: 写真の無いカードの数。そのカードが空の枠（3:2 の箱）にならない CSS があること
 *   2. 検索カードのひな形（index.html）: 再生ボタンを写真がある店にだけ出していること
 *   3. 店舗データ: 写真URL が無い店の割合
 *   4. 記事一覧: 画像つきの記事の割合（測定のみ。全記事が文字だけの一覧なので基準値として記録する）
 *   node scripts/audit_empty_image_frames.js            # 測って表示
 *   node scripts/audit_empty_image_frames.js --check    # 基準値より悪化していれば exit 1
 *   node scripts/audit_empty_image_frames.js --write-baseline   # 基準値を書き直す（改善したときだけ）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_REL = 'data/image_frames_baseline.json';
const read = (rel, root) => fs.readFileSync(path.join(root, rel), 'utf8');

/** 特集一覧: カードのうち img の無いものの数と、空の枠を畳む CSS の有無 */
function featureCards(html) {
  const cards = [...html.matchAll(/<a\s[^>]*class="[^"]*article-card[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  const noImg = cards.filter((c) => !/<img\b/.test(c));
  return { total: cards.length, noImage: noImg.length, collapsesEmptyFrame: /\.card-badge:not\(:has\(img\)\)\s*\{[^}]*aspect-ratio:\s*auto/.test(html) };
}

/** 検索カードのひな形: 再生ボタン（reel-play）が写真の有無で出し分けられているか */
function reelOnlyWithPhoto(indexHtml) {
  const i = indexHtml.indexOf('class="reel-play"');
  if (i < 0) return true; // ボタン自体が無い
  const before = indexHtml.slice(Math.max(0, i - 80), i);
  return /reel\s*&&\s*photo/.test(before);
}

function measure(root = ROOT) {
  const out = {};
  const fi = featureCards(read('features/index.html', root));
  out.features = { cards: fi.total, noImage: fi.noImage, collapsesEmptyFrame: fi.collapsesEmptyFrame };
  out.reelOnlyWithPhoto = reelOnlyWithPhoto(read('index.html', root));
  const stores = JSON.parse(read('data/stores.json', root));
  const noPhoto = stores.filter((r) => !r['写真URL']).length;
  out.stores = { total: stores.length, noPhoto, noPhotoRatio: Number((noPhoto / stores.length).toFixed(4)) };
  const ji = read('journal/index.html', root);
  const jCards = (ji.match(/<a\s[^>]*href="[^"]*\d{4}-\d{2}-\d{2}-[^"]*\.html"/g) || []).length;
  out.journalIndex = { entries: jCards, images: (ji.match(/<img\b/g) || []).length };
  return out;
}

/** 基準値と比べ、悪化した点の説明の配列を返す（空なら合格）。 */
function compare(m, base) {
  const p = [];
  if (!m.reelOnlyWithPhoto) p.push('検索カードの再生ボタンが、写真の無い枠にも出る');
  if (m.features.noImage > 0 && !m.features.collapsesEmptyFrame) p.push(`特集一覧に写真なしのカードが ${m.features.noImage} 枚あり、空の枠を畳む CSS が無い`);
  if (m.features.noImage > base.features.noImage) p.push(`特集一覧の写真なしカードが基準 ${base.features.noImage} 枚より増えた（${m.features.noImage} 枚）`);
  if (m.stores.noPhotoRatio > base.stores.noPhotoRatio + 0.002) p.push(`写真なしの店が基準 ${(base.stores.noPhotoRatio * 100).toFixed(1)}% より増えた（${(m.stores.noPhotoRatio * 100).toFixed(1)}%）`);
  const baseJ = base.journalIndex.entries ? base.journalIndex.images / base.journalIndex.entries : 0;
  const nowJ = m.journalIndex.entries ? m.journalIndex.images / m.journalIndex.entries : 0;
  if (nowJ + 1e-9 < baseJ) p.push('記事一覧の画像つきの割合が基準より下がった');
  return p;
}

function loadBaseline(root = ROOT) { return JSON.parse(read(BASELINE_REL, root)); }

if (require.main === module) {
  const m = measure();
  console.log(JSON.stringify(m, null, 2));
  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(path.join(ROOT, BASELINE_REL), JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), ...m }, null, 2) + '\n');
    console.log(`基準値を ${BASELINE_REL} に書きました`);
  } else if (process.argv.includes('--check')) {
    const problems = compare(m, loadBaseline());
    if (problems.length) { console.error('空の画像枠・写真なしの検査に不合格:\n- ' + problems.join('\n- ')); process.exit(1); }
    console.log('合格（基準値より悪化していない）');
  }
}

module.exports = { measure, compare, featureCards, reelOnlyWithPhoto, loadBaseline, BASELINE_REL };
