#!/usr/bin/env node
/**
 * add_feature_reservation_cta.js
 *
 * 特集記事（features/*.html）の店舗ブロックに、ホットペッパー予約直リンクを冪等付与する。
 *
 * 背景（2026-07-16 閲覧データ分析）:
 *   GA4 上位ランディングの特集（ひつまぶし・一人飲み・手羽先・味噌煮込み）が
 *   内部詳細リンクのみで予約導線を持たず、CTA クリック率悪化（13.5%→5.1%）の
 *   一因になっていた。他特集（banquet/date 等）は既に直リンクを持つため、
 *   サイト慣例（class="store-link" + hotpepper.jp/strJ…）に揃えて欠落分を補う。
 *
 * 対応パターン:
 *   A: <a class="store-link" href="../stores/JXXXXXXXX.html">…</a>
 *      → 直後に <a class="store-link" href="https://www.hotpepper.jp/strJ…/">予約はこちら</a>
 *      （矢印は共通CSS .store-link::after が付与するため文言に含めない）
 *   B: <a href="/stores/JXXXXXXXX.html" class="link"…>…</a>（一人飲み特集の形式）
 *      → 直後に <a href="https://www.hotpepper.jp/strJ…/" class="link">ホットペッパーで予約</a>
 *
 * 安全条件（架空店ブロック・閉店ゲートと整合）:
 *   - stores/JXXXXXXXX.html がリポジトリに実在する J コードのみ付与
 *   - data/closed_stores.json に載っている J コードには付与しない
 *   - 同一ファイル内に strJXXXXXXXX が既にあればスキップ（冪等）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const STORES_DIR = path.join(ROOT, 'stores');
const CLOSED_PATH = path.join(ROOT, 'data', 'closed_stores.json');

const closedRaw = fs.existsSync(CLOSED_PATH) ? fs.readFileSync(CLOSED_PATH, 'utf8') : '';

function isLinkable(jcode) {
  if (!fs.existsSync(path.join(STORES_DIR, jcode + '.html'))) return false;
  if (closedRaw.includes(jcode)) return false;
  return true;
}

const PATTERN_A = /<a class="store-link" href="\.\.\/stores\/(J\d+)\.html">[^<]*<\/a>/g;
const PATTERN_B = /<a href="\/stores\/(J\d+)\.html" class="link"[^>]*>[^<]*<\/a>/g;

let totalAdded = 0;
const files = fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html'));

for (const file of files) {
  const fp = path.join(FEATURES_DIR, file);
  const before = fs.readFileSync(fp, 'utf8');
  let added = 0;

  const replaced = before
    .replace(PATTERN_A, (m, jcode) => {
      if (before.includes('hotpepper.jp/str' + jcode) || !isLinkable(jcode)) return m;
      added++;
      return m + '\n  <a class="store-link" href="https://www.hotpepper.jp/str' + jcode + '/" target="_blank" rel="noopener">予約はこちら</a>';
    })
    .replace(PATTERN_B, (m, jcode) => {
      if (before.includes('hotpepper.jp/str' + jcode) || !isLinkable(jcode)) return m;
      added++;
      return m + ' <a href="https://www.hotpepper.jp/str' + jcode + '/" class="link" target="_blank" rel="noopener">ホットペッパーで予約</a>';
    });

  if (added > 0) {
    fs.writeFileSync(fp, replaced);
    console.log(`features/${file}: 予約リンク +${added}`);
    totalAdded += added;
  }
}

console.log(`done: ${totalAdded} 件の予約リンクを付与`);
