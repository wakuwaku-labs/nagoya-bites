#!/usr/bin/env node
// 店舗写真の画質一括アップグレード（冪等・再実行安全）
//
// 背景: HotPepper API の photo.pc.l は 238px サムネイルで、店舗詳細ページの
// 800px ヒーロー等に引き伸ばされて粗く表示されていた。imgfp.hotp.jp は同一パスで
// _480.jpg も配信している（_480 不在時もフロントは wsrv.nl の default フォールバック、
// ヒーローは onerror で救済）。
//
// ⚠️ 訂正（実測にもとづく）: 以前ここには「_480 が最大サイズ」と書かれていたが、それは誤り。
//    サフィックスを外した URL（..._480.jpg → ....jpg）が投稿時の原寸を返し、実測では
//    全 4,572 件中 3,225 件（70%）で 720〜1280px が存在した。
//    → 原寸への昇格は scripts/promote_store_photos.js が担当する（実測で大きい店だけ昇格）。
//    このスクリプトは「_238 等の極小サムネを _480 まで引き上げる」下限の底上げに徹する。
//
// このスクリプトは既存資産に埋まった縮小サムネURLを最大サイズへ昇格する:
//   - data/stores.json      … canonical カタログ（JSON-LD / og:image / ヒーローの源泉）
//   - index.html            … インライン LOCAL_STORES（TOP50）ほか本文中の imgfp URL
//   - features/*.html       … 特集のカード/ヒーロー画像
//   - journal/*.html        … 日次記事内の imgfp URL
//   - stores/*.html         … gen-store-pages.js の再生成対象外の「孤児ページ」
//                             （現行カタログに居ない店の残置ページ）の救済。
//                             在カタログ店は gen-store-pages.js 再生成が正で、
//                             このテキスト置換は冪等なので二重適用しても無害。
//   - "no image" プレースホルダー(noimage.gif)は写真なし扱いにして正規フォールバックへ
//
// 恒久対策は build.js の normalizePhotoUrl()（取り込み時に昇格）。このスクリプトは
// 「build.js を通らず生成済みの資産」を一括修繕するためのもの。stores/*.html は
// このスクリプトの後に `node gen-store-pages.js` で再生成すること。
//
// 使い方:
//   node scripts/upgrade_photo_quality.js          # 実行
//   node scripts/upgrade_photo_quality.js --dry-run # 変更件数のみ表示

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const SMALL_HP_RE = /(imgfp\.hotp\.jp\/[^"'\s)]+?)_(?:58|100|168|238|320)\.jpg/g;
const NOIMAGE_RE = /https?:\/\/imgfp\.hotp\.jp\/[^"'\s)]*noimage[^"'\s)]*/gi;

function upgradeText(text) {
  let count = 0;
  const out = text.replace(SMALL_HP_RE, (m, base) => { count++; return `${base}_480.jpg`; });
  return { out, count };
}

let totalUpgraded = 0;

// ── 1) data/stores.json（構造的に処理: 写真URLフィールドのみ）──────────────
const storesPath = path.join(ROOT, 'data', 'stores.json');
if (fs.existsSync(storesPath)) {
  const stores = JSON.parse(fs.readFileSync(storesPath, 'utf8'));
  let upgraded = 0, noimageCleared = 0;
  for (const s of stores) {
    const u = String(s['写真URL'] || '').trim();
    if (!u) continue;
    if (/imgfp\.hotp\.jp\/.*noimage/i.test(u)) { s['写真URL'] = ''; noimageCleared++; continue; }
    const next = u.replace(/(imgfp\.hotp\.jp\/.+?)_(?:58|100|168|238|320)\.jpg/, '$1_480.jpg');
    if (next !== u) { s['写真URL'] = next; upgraded++; }
  }
  if (!DRY && (upgraded || noimageCleared)) {
    fs.writeFileSync(storesPath, JSON.stringify(stores), 'utf8');
  }
  totalUpgraded += upgraded;
  console.log(`data/stores.json: ${upgraded}件昇格 / noimage除去 ${noimageCleared}件`);
}

// ── 2) index.html / features/*.html / journal/*.html（テキスト置換）─────────
const targets = [path.join(ROOT, 'index.html')];
for (const dir of ['features', 'journal', 'stores']) {
  const d = path.join(ROOT, dir);
  if (fs.existsSync(d)) {
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.html')) targets.push(path.join(d, f));
    }
  }
}

let filesChanged = 0;
for (const file of targets) {
  const text = fs.readFileSync(file, 'utf8');
  const { out, count } = upgradeText(text);
  if (count > 0) {
    if (!DRY) fs.writeFileSync(file, out, 'utf8');
    totalUpgraded += count;
    filesChanged++;
    console.log(`${path.relative(ROOT, file)}: ${count}件昇格`);
  }
}

console.log(`\n合計: ${totalUpgraded}件のHotPepper縮小サムネを _480 最大サイズへ昇格（${filesChanged}ファイル${DRY ? '・dry-run 変更なし' : ''}）`);
console.log('次の手順: node gen-store-pages.js で stores/*.html を再生成してください。');
