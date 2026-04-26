'use strict';
/**
 * patch_store_descriptions.js
 * stores/*.html の meta description / og:description / twitter:description を
 * buildDescription() のロジックで再生成し上書きする。
 * LOCAL_STORES を index.html から抽出して店舗データを取得するため
 * Google Sheets への再フェッチは不要。
 *
 * 実行: node scripts/patch_store_descriptions.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const STORES_DIR = path.join(ROOT, 'stores');

// ================================================================
// 説明文ビルダー（gen-store-pages.js と同一ロジック）
// ================================================================
function buildDescription(s) {
  const point = (s['おすすめポイント'] || '').trim();
  const genre = s['ジャンル'] || '';
  const area  = s['エリア'] || '';
  const price = s['価格帯'] || '';
  const score = s['Google評価'] || '';
  const tags  = (s['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean);
  const parts = [];

  if (point) parts.push(point.length > 80 ? point.slice(0, 79) + '…' : point);

  const ctx = area && genre ? `${area}の${genre}` : (area + genre);
  if (ctx) parts.push(ctx + (price ? `（${price}）` : ''));

  if (score) parts.push(`Googleで${score}評価`);

  const usefulTags = ['個室', '貸切', '飲み放題', '食べ放題', '女子会', '接待', 'テラス'].filter(t => tags.includes(t));
  if (usefulTags.length) parts.push(usefulTags[0] + '対応');

  let desc = parts.join('。') + (parts.length ? '。' : '');

  const cta = 'ホットペッパー・食べログ・Googleマップをまとめてチェック。NAGOYA BITES掲載。';
  if (desc.length < 100) desc += cta;

  if (desc.length > 155) desc = desc.slice(0, 154) + '…';
  return desc;
}

// ================================================================
// index.html から LOCAL_STORES を抽出
// ================================================================
function extractLocalStores(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);\s*\n/);
  if (!m) throw new Error('LOCAL_STORES not found in index.html');
  return JSON.parse(m[1]);
}

// ================================================================
// HTML内の meta description を置換
// ================================================================
function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function patchHtml(html, newDesc) {
  const escaped = escAttr(newDesc);
  // meta name="description"
  html = html.replace(/<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escaped}">`);
  // og:description
  html = html.replace(/<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escaped}">`);
  // twitter:description
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${escaped}">`);
  return html;
}

// ================================================================
// メイン
// ================================================================
function main() {
  console.log('LOCAL_STORES を index.html から抽出中…');
  const stores = extractLocalStores(INDEX_HTML);
  console.log(`${stores.length} 件のデータを取得`);

  // ホットペッパーID → store のマップを構築
  const byHpId = new Map();
  const byName = new Map();
  for (const s of stores) {
    const hpId = s['ホットペッパーID'] || '';
    if (hpId) byHpId.set(hpId, s);
    const key = `${s['店名']}__${s['エリア']}`;
    byName.set(key, s);
  }

  const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.html'));
  console.log(`${files.length} 件のストアページを処理中…`);

  let updated = 0, notFound = 0, tooShort = 0, longEnough = 0;

  for (const file of files) {
    const fp = path.join(STORES_DIR, file);
    const html = fs.readFileSync(fp, 'utf8');

    // 既存の説明文を確認
    const curDescM = html.match(/<meta name="description" content="([^"]*)"/);
    const curDesc = curDescM ? curDescM[1] : '';

    // ホットペッパーIDをファイル名から取得
    const hpId = file.replace('.html', '');
    let store = byHpId.get(hpId);

    // IDで見つからない場合は title からパース
    if (!store) {
      const titleM = html.match(/<title>([^（]+)（([^・]+)・[^）]+）/);
      if (titleM) {
        const name = titleM[1].trim();
        const area = titleM[2].trim();
        store = byName.get(`${name}__${area}`) || stores.find(s => s['店名'] === name);
      }
    }

    if (!store) {
      notFound++;
      continue;
    }

    const newDesc = buildDescription(store);

    // 既に十分な長さなら必要に応じてスキップ（--force で全件上書き）
    const force = process.argv.includes('--force');
    if (!force && curDesc.length >= 100) {
      longEnough++;
      continue;
    }

    if (newDesc.length < 100) { tooShort++; }

    const patched = patchHtml(html, newDesc);
    fs.writeFileSync(fp, patched, 'utf8');
    updated++;
  }

  console.log(`完了: updated=${updated} / notFound=${notFound} / alreadyLong=${longEnough} / tooShort=${tooShort}`);
  console.log(`ヒント: --force フラグで全件強制上書き`);
}

main();
