#!/usr/bin/env node
/**
 * strip_ui_emojis.js
 *
 * サイト全ページの「UIラベル絵文字」を除去する（2026-07 オーナー指示:
 * 絵文字が入ると AI 生成感が強く、ブランドの編集品質を毀損するため全面撤去）。
 *
 * 対象: テンプレート/マークアップ由来のラベル絵文字のみ。
 * 店舗データ由来のテキスト（おすすめポイント・店名等のキャッチコピーに含まれる
 * ♪ や ☆ など）は店側の表現なので改変しない。
 *
 * ルール:
 *   1. 既知のラベルフレーズは絵文字プレフィックスを除去（例「🌶 ホットペッパーで予約」）
 *   2. 装飾専用の絵文字（📖 📰 🍽 🗝 🗓 — 食テキストに現れない記号）は後続スペース込みで除去
 *   3. ⭐（絵文字スター）は ★（テキストスター）へ統一
 *   4. store-meta 内の 📍/🪑 プレフィックスを除去
 *   5. Instagram CTA の ig-icon（📸）は空にせず要素ごと除去
 *
 * 冪等: 2回目以降の実行では変更ゼロ。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 1. 既知ラベルの exact フレーズ（全対象ファイル共通）
const PHRASES = [
  ['🌶 ホットペッパーで予約', 'ホットペッパーで予約'],
  ['📍 Googleマップ', 'Googleマップ'],
  ['📸 Instagram', 'Instagram'],
  ['🍶 今日の1軒', '今日の1軒'],
  ['🗝 業界の裏側', '業界の裏側'],
  ['🔍 業界の裏側', '業界の裏側'],
  ['🔥 週次話題店', '週次話題店'],
  ['🗓 季節短信', '季節短信'],
  ['📍近い順', '近い順'],
  ['<div class="ig-icon">📸</div>', ''],
  ['🎵 TikTok', 'TikTok'],
  ['🍖 今日の1軒', '今日の1軒'],
  ['🔥 週次の話題店ダイジェスト', '週次の話題店ダイジェスト'],
  ['🚫 桜ゼロ宣言', '桜ゼロ宣言'],
];

// 2. 装飾専用絵文字（trailing space ごと除去）— 食テキスト・店名には現れない記号のみ
const DECOR_PREFIX = /(?:📖|📰|🍽|🗝|🗓|🗺|📅)️?\s?/g;

// 4. store-meta / media-features 内の位置・設備・演出アイコン
//    （features/journal/index の編集部マークアップのみ。stores/ は店舗データ由来
//      テキストを含むため exact フレーズ以外は触らない）
const META_PREFIX = /(<span[^>]*>|<div class="media-features">)(?:📍|🪑|💼|🏮|🌃|🌶|🔥|🚄|🎍)️?\s?/g;

function cleanse(text, isStorePage) {
  let out = text;
  for (const [from, to] of PHRASES) out = out.split(from).join(to);
  out = out.replace(DECOR_PREFIX, '');
  if (!isStorePage) out = out.replace(META_PREFIX, '$1');
  out = out.replace(/⭐️?/g, '★');
  return out;
}

function listTargets() {
  const targets = ['index.html'];
  for (const dir of ['features', 'journal', 'stores']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith('.html')) targets.push(path.join(dir, f));
    }
  }
  return targets;
}

let changedFiles = 0;
let total = 0;
for (const rel of listTargets()) {
  const fp = path.join(ROOT, rel);
  const before = fs.readFileSync(fp, 'utf8');
  const after = cleanse(before, rel.startsWith('stores/'));
  if (after !== before) {
    fs.writeFileSync(fp, after);
    changedFiles++;
    const diff = before.length - after.length;
    total += diff;
    if (!rel.startsWith('stores/')) console.log(`${rel}: -${diff} bytes`);
  }
}
console.log(`done: ${changedFiles} ファイルからUIラベル絵文字を除去（計 ${total} bytes）`);
