#!/usr/bin/env node
/**
 * replace_type_icon_photos.js
 *
 * 特集の「業態/シーン分類カード」の絵文字アイコンを、実在掲載店の
 * HotPepper 公式写真（写真ルール優先2）＋店名クレジット＋店舗ページリンクに置換する。
 * 2026-07 オーナー指示「絵文字は AI 生成感が強いので全ページから消し、写真で分かるように」。
 *
 * 安全設計（実在検証ゲートと整合）:
 *   - 置換元の店は data/stores.json のジャンル/タグで人手検証済みのマッピング（下記 MAPPING）
 *   - 写真はリポジトリ内 stores/<Jコード>.html の hero-img から実取得
 *     （店舗ページが存在し実写を持つ場合のみ置換。取れなければカードはアイコン除去のみ）
 *   - クレジット「写真: 店名」を必ず併記し、カードから店舗ページへリンク
 *
 * 冪等: type-photo 挿入済みカードはスキップ。2回目以降は変更ゼロ。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// カテゴリカード → 実在掲載店（ジャンル一致を stores.json で確認済み）
const MAPPING = {
  'features/nagoya-solo-dining.html': [
    { label: 'カウンター割烹・和食', jcode: 'J001201978', store: '炭火割烹 魚炭 うおずみ' },
    { label: '焼き鳥・鳥料理専門', jcode: 'J001147583', store: '鳥心 名駅本店' },
    { label: '立ち飲み・スタンディングバー', jcode: 'J003851717', store: '立ち飲み酒場 カレーうどん住吉' },
    { label: 'バー・クラフトビール', jcode: 'J001134166', store: 'バームーンウォーク bar moon walk 錦通り店' },
    { label: 'ラーメン・麺系', jcode: 'J001192997', store: '麺屋えび蔵' },
    { label: 'おでん・居酒屋カウンター', jcode: 'J004559388', store: 'おでん 拍子木' },
  ],
  'features/nagoya-korean.html': [
    { label: 'サムギョプサル専門', jcode: 'J004509217', store: 'イオ 生サムギョプサル専門店' },
    { label: '炭火カルビ専門', jcode: 'J004049936', store: '骨付きカルビ専門店 ダムラ 栄店' },
    { label: 'スープ系韓国料理', jcode: 'J001258642', store: 'ソウルキッチン' },
    { label: '韓国居酒屋（ポチャ）', jcode: 'J004537264', store: '韓国屋台 ハルハル' },
    { label: '個室完備・宴会向け', jcode: 'J003721004', store: '韓国居酒屋 MYONDON 金山店' },
    { label: '百貨店・SC内韓国料理', jcode: 'J003941147', store: '韓国サムギョプサル 栄 パルコ 矢場町店' },
  ],
  'features/nagoya-seafood.html': [
    { label: '海鮮居酒屋', jcode: 'J003737452', store: 'サカナのハチベエ 金山店' },
    { label: 'くずし割烹', jcode: 'J004445386', store: '大衆割烹 八べゑ 錦３丁目店' },
    { label: '本格割烹・日本料理', jcode: 'J004067963', store: '割烹嘉とう' },
    { label: '藁焼き・炙り系', jcode: 'J003736999', store: '藁焼き小屋またふく 九条店' },
    { label: '鮨・寿司業態', jcode: 'J004470380', store: '寿司処 昴 栄店' },
    { label: '産地直送専門', jcode: 'J001179548', store: '産直鮮魚の海鮮酒場をかし' },
  ],
  'features/nagoya-yakitori-guide.html': [
    { label: '大衆炭火系', jcode: 'J003611005', store: '焼き鳥 大五郎' },
    { label: '地鶏専門', jcode: 'J003873028', store: '地鶏坊主 大曽根駅前店' },
    { label: '個室焼き鳥', jcode: 'J003649255', store: '炭火焼き鳥 けんしろう 栄本店' },
    { label: '串カツ併設', jcode: 'J004559309', store: '焼き鳥と串カツ 大衆居酒屋 治兵衛 金山駅店' },
    { label: '焼き鳥×おでん', jcode: 'J003649537', store: '炭火焼き鳥と鶏白湯おでん 尊 みこと 栄駅店' },
    { label: '地鶏×鮮魚', jcode: 'J003649259', store: '地鶏と鮮魚 焼き鳥職人 鳳 栄本店' },
  ],
  'features/private-room.html': [
    { label: '完全個室', jcode: 'J003942392', store: '完全個室 千賀牛園 栄本館' },
    { label: '半個室', jcode: 'J001187588', store: '九州料理 椿 金山店' },
    { label: '掘りごたつ個室', jcode: 'J004068058', store: '手羽先むつみ 住吉店' },
    { label: 'ソファ個室', jcode: 'J000763525', store: '焼肉くまちゃん' },
  ],
};

const CSS_BLOCK = `/* type-photo: 分類カードの絵文字アイコンを実在店舗写真へ置換（2026-07 絵文字全面撤去） */
.type-photo{display:block;margin-bottom:.75rem;text-decoration:none;}
.type-photo img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:4px;display:block;}
.type-photo-credit{display:block;font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.06em;color:#8b8578;margin-top:.35rem;}
`;

function heroPhoto(jcode) {
  const fp = path.join(ROOT, 'stores', jcode + '.html');
  if (!fs.existsSync(fp)) return null;
  const m = fs.readFileSync(fp, 'utf8')
    .match(/<img class="hero-img" src="(https:\/\/imgfp\.hotp\.jp[^"]+)"/);
  // カード表示は 340px 幅程度 — retina 対応のため 238px 版は 480px 版へ引き上げる
  return m ? m[1].replace(/_238\.jpg$/, '_480.jpg') : null;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

let totalPhotos = 0;
for (const [rel, cards] of Object.entries(MAPPING)) {
  const fp = path.join(ROOT, rel);
  let t = fs.readFileSync(fp, 'utf8');
  const before = t;
  for (const { label, jcode, store } of cards) {
    const img = heroPhoto(jcode);
    // アイコン div（<div class="icon">絵文字</div> or type-icon）＋直後のカード見出し
    const re = new RegExp(
      '<div class="(?:type-)?icon">[^<]*<\\/div>(\\s*)((?:<h4>|<div class="type-name">)' + esc(label) + ')'
    );
    if (!re.test(t)) continue; // 置換済み or カードなし
    if (img) {
      const block = `<a class="type-photo" href="../stores/${jcode}.html">` +
        `<img src="${img}" alt="${label}の掲載店 ${store}" loading="lazy" decoding="async">` +
        `<span class="type-photo-credit">写真: ${store}</span></a>`;
      t = t.replace(re, block + '$1$2');
      totalPhotos++;
    } else {
      t = t.replace(re, '$2'); // 実写が取れない場合はアイコン除去のみ
    }
  }
  if (t !== before) {
    if (!t.includes('type-photo:')) t = t.replace('</style>', CSS_BLOCK + '</style>');
    fs.writeFileSync(fp, t);
    console.log(`${rel}: 写真カード適用`);
  }
}

// birthday のシーンカード: 抽象シーン（サプライズ/プロポーズ等）は特定店舗写真と
// 不一致になるため、アイコン除去のみ（クリーンなタイポグラフィカード）
{
  const fp = path.join(ROOT, 'features/birthday.html');
  let t = fs.readFileSync(fp, 'utf8');
  const before = t;
  t = t.replace(/<div class="scene-icon">[^<]*<\/div>\s*/g, '');
  if (t !== before) { fs.writeFileSync(fp, t); console.log('features/birthday.html: scene-icon 除去'); }
}

// features/index の夏特集カード: 兄弟カードと同じ「特集ヒーロー写真」形式へ
{
  const fp = path.join(ROOT, 'features/index.html');
  let t = fs.readFileSync(fp, 'utf8');
  const before = t;
  t = t.replace(
    '<div class="card-icon">🍺</div>',
    '<img class="card-img" src="https://imgfp.hotp.jp/IMGH/34/86/P045733486/P045733486_480.jpg" alt="名古屋 夏グルメ 2026" loading="lazy">'
  );
  if (t !== before) { fs.writeFileSync(fp, t); console.log('features/index.html: 夏特集カードに写真適用'); }
}

console.log(`done: ${totalPhotos} カードに実在店舗写真を適用`);
