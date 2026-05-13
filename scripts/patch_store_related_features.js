'use strict';
/**
 * patch_store_related_features.js
 *
 * 既存の stores/*.html の `<div class="related-features">` 内の `<ul>...</ul>` を、
 * gen-store-pages.js の新 TAG_TO_FEATURES ルール（タグ → ジャンル → エリア → 最後の砦）
 * で再計算した内容で in-place 置換する。
 *
 * gen-store-pages.js の完全再実行を回避し、関連特集の充足率を 68% → 95%+ に引き上げる。
 *
 * 実行: node scripts/patch_store_related_features.js [--limit=N] [--dryrun]
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const STORES_DIR = path.join(ROOT, 'stores');
const INDEX      = path.join(ROOT, 'index.html');

// gen-store-pages.js と同一の TAG_TO_FEATURES ルール（ISSUE-047 拡張版）
const TAG_TO_FEATURES = [
  { match: s => (s['タグ']||'').includes('個室'),           file: 'private-room.html', label: '個室のある名古屋グルメ10選' },
  { match: s => (s['タグ']||'').includes('接待'),           file: 'private-room.html', label: '個室のある名古屋グルメ10選' },
  { match: s => /30〜|40〜|50〜|60〜|70〜|80〜|90〜|100名/.test(s['タグ']||'') || (s['タグ']||'').includes('忘年会') || (s['タグ']||'').includes('歓送迎会') || (s['タグ']||'').includes('飲み放題'), file: 'banquet.html', label: '名古屋の宴会・忘年会15選' },
  { match: s => (s['タグ']||'').includes('100名') || /70〜|80〜|90〜/.test(s['タグ']||''), file: 'large-group.html', label: '名古屋・大人数宴会20人以上10選' },
  { match: s => (s['タグ']||'').includes('誕生日・記念日') || /誕生日|記念日|サプライズ/.test(s['おすすめポイント']||''), file: 'birthday.html', label: '名古屋・誕生日/記念日ディナー10選' },
  { match: s => (s['タグ']||'').includes('女子会'),         file: 'girls-party.html', label: '名古屋・女子会ランチ&ディナー10選' },
  { match: s => /イタリアン|フレンチ|ダイニングバー|バル|創作料理/.test(s['ジャンル']||''), file: 'date.html', label: '名古屋・デートディナー10選' },
  { match: s => /居酒屋/.test(s['ジャンル']||''),            file: 'banquet.html', label: '名古屋の宴会・忘年会15選' },
  { match: s => /カフェ・スイーツ|カフェ|喫茶/.test(s['ジャンル']||''), file: 'girls-party.html', label: '名古屋・女子会ランチ&ディナー10選' },
  { match: s => /和食|寿司|割烹|料亭/.test(s['ジャンル']||''), file: 'settai-guide.html', label: '名古屋・接待ガイド' },
  { match: s => /うどん|そば|ラーメン|麺/.test(s['ジャンル']||''), file: 'kospa-insider.html', label: '名古屋・コスパで選ぶ業界人推薦' },
  { match: s => /焼肉|ホルモン/.test(s['ジャンル']||''),      file: 'industry-insiders-pick.html', label: '業界人が本気で選ぶ名古屋の名店' },
  { match: s => /名古屋駅|名駅|中村区/.test(s['エリア']||''), file: 'meieki.html', label: '名駅グルメ15選' },
  { match: s => /栄|錦|矢場町|東桜|新栄/.test(s['エリア']||''), file: 'sakae.html', label: '栄グルメ15選' },
  { match: s => /大須|上前津/.test(s['エリア']||''),         file: 'osu-food-walk.html', label: '大須食べ歩きガイド' },
  { match: s => true,                                        file: 'industry-insiders-pick.html', label: '業界人が本気で選ぶ名古屋の名店' },
];

function buildRelatedFeatures(store) {
  const hits = [];
  const seen = new Set();
  for (const entry of TAG_TO_FEATURES) {
    if (seen.has(entry.file)) continue;
    if (entry.match(store)) {
      hits.push(entry);
      seen.add(entry.file);
    }
    if (hits.length >= 3) break;
  }
  return hits;
}

function loadStores() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('LOCAL_STORES が見つかりません');
  return JSON.parse(m[1]);
}

function buildUlInner(features) {
  return features.map(f => `      <li><a href="../features/${f.file}">${f.label}</a></li>`).join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const dryrun = args.includes('--dryrun');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const stores = loadStores();
  // HP_ID → store map
  const byHpId = new Map();
  for (const s of stores) {
    const hp = (s['ホットペッパーID'] || '').trim();
    if (hp) byHpId.set(hp, s);
  }
  console.log(`LOCAL_STORES: ${stores.length}件 (HP_ID indexed: ${byHpId.size})`);

  const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  const subset = LIMIT ? files.slice(0, LIMIT) : files;

  let patched = 0;
  let skippedSameContent = 0;
  let skippedNoStore = 0;
  let beforeFilled = 0;
  let afterFilled = 0;

  for (const f of subset) {
    const slug = f.replace(/\.html$/, '');
    const store = byHpId.get(slug);
    if (!store) {
      skippedNoStore++;
      continue;
    }

    const fp = path.join(STORES_DIR, f);
    const html = fs.readFileSync(fp, 'utf8');

    const features = buildRelatedFeatures(store);
    const newInner = buildUlInner(features);

    // 既存の <ul> 中身を抽出
    const ulMatch = html.match(/(<div class="related-features">[\s\S]*?<ul>)([\s\S]*?)(<\/ul>)/);
    if (ulMatch) {
      const beforeInner = ulMatch[2].trim();
      if (beforeInner.length > 0) beforeFilled++;
      if (newInner) afterFilled++;

      const newBlock = `${ulMatch[1]}\n${newInner}\n    ${ulMatch[3]}`;
      if (newBlock === ulMatch[0]) { skippedSameContent++; continue; }

      const newHtml = html.replace(ulMatch[0], newBlock);
      if (!dryrun) fs.writeFileSync(fp, newHtml, 'utf8');
      patched++;
    } else {
      // related-features セクションそのものが存在しない場合は新規挿入
      // <div class="back-section"> の直前に差し込む
      const insertRe = /(  )(<div class="back-section">)/;
      const insertMatch = html.match(insertRe);
      if (!insertMatch) continue;  // back-section も無い → スキップ
      if (newInner) afterFilled++;

      const newDiv =
`  <div class="related-features">
    <h2>この店舗が登場する特集</h2>
    <ul>
${newInner}
    </ul>
  </div>

  `;
      const newHtml = html.replace(insertRe, `${newDiv}$2`);
      if (!dryrun) fs.writeFileSync(fp, newHtml, 'utf8');
      patched++;
    }
    if (patched <= 3 && dryrun) {
      console.log(`(dryrun) ${f}:\n${newInner}\n---`);
    }
  }

  const total = subset.length - skippedNoStore;
  console.log(`patched=${patched} skippedSame=${skippedSameContent} skippedNoStore=${skippedNoStore}${dryrun ? ' (dryrun)' : ''}`);
  if (total > 0) {
    console.log(`before filled rate: ${beforeFilled}/${total} (${(beforeFilled*100/total).toFixed(1)}%)`);
    console.log(`after  filled rate: ${afterFilled}/${total} (${(afterFilled*100/total).toFixed(1)}%)`);
  }
}

main();
