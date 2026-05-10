'use strict';
/**
 * fill_recommendations_json.js
 *
 * `index.html` の LOCAL_STORES を読み、`おすすめポイント` が空かつ HP_ID を持つ店舗を抽出し、
 * `data/recommendations.json`（HP_ID → 推薦文 マップ）に未登録のものをルールベースで生成して追記する。
 *
 * 既存 `gen_recommendations_text.js` のルールロジックを移植。Google Sheets / Anthropic API の
 * 認証情報を必要としないため CI でも動かせる。
 *
 * 実行: node scripts/fill_recommendations_json.js [--dryrun]
 */

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const INDEX     = path.join(ROOT, 'index.html');
const RECO_PATH = path.join(ROOT, 'data', 'recommendations.json');

function loadStores() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('LOCAL_STORES が index.html に見つかりません');
  return JSON.parse(m[1]);
}

function generate(s) {
  const tags   = (s['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean);
  const genre  = s['ジャンル'] || '';
  const area   = s['エリア'] || '';
  const rating = parseFloat(s['Google評価']) || 0;

  const features = [];

  if (genre.includes('焼肉') || genre.includes('ホルモン'))   features.push('こだわり食材の焼肉が楽しめる');
  else if (genre.includes('寿司'))                             features.push('鮮度抜群のネタが揃う本格寿司');
  else if (genre.includes('天ぷら'))                           features.push('サクサク揚げたての天ぷらが絶品');
  else if (genre.includes('ラーメン'))                         features.push('名古屋ならではのスープが自慢');
  else if (genre.includes('焼き鳥'))                           features.push('備長炭で焼き上げる香ばしい焼き鳥');
  else if (genre.includes('海鮮') || genre.includes('魚介'))   features.push('新鮮な海の幸が堪能できる');
  else if (genre.includes('イタリアン') || genre.includes('イタリア')) features.push('本格イタリアンをカジュアルに楽しめる');
  else if (genre.includes('フレンチ'))                         features.push('本格フレンチをリーズナブルに');
  else if (genre.includes('中華'))                             features.push('本格中華料理が揃う');
  else if (genre.includes('鍋'))                               features.push('旬の食材をたっぷり使った鍋が自慢');
  else if (genre.includes('しゃぶしゃぶ'))                     features.push('上質な肉のしゃぶしゃぶが人気');
  else if (genre.includes('すき焼き'))                         features.push('厳選和牛のすき焼きが堪能できる');
  else if (genre.includes('居酒屋'))                           features.push('料理もドリンクも充実した居酒屋');
  else if (genre.includes('バル') || genre.includes('バー'))   features.push('こだわりのお酒と料理が楽しめる');
  else if (genre.includes('カフェ') || genre.includes('喫茶')) features.push('落ち着いた空間でひと息つける');
  else if (genre.includes('ダイニング'))                       features.push('多彩な料理が揃うダイニング');
  else if (genre.includes('カラオケ') || genre.includes('パーティ')) features.push('宴会・パーティに使える広々空間');
  else features.push(`${genre || 'グルメ'}が楽しめる人気店`);

  if (tags.includes('個室')) features.push('個室あり');
  if (tags.includes('歓送迎会') && tags.includes('忘年会・新年会')) features.push('歓送迎会・忘年会に最適');
  else if (tags.includes('歓送迎会'))                            features.push('歓送迎会にぴったり');
  else if (tags.includes('忘年会・新年会'))                      features.push('忘年会・新年会に人気');

  if (tags.some(t => t.includes('100名以上')))                                       features.push('100名以上の大宴会も対応');
  else if (tags.some(t => t.includes('70〜80名') || t.includes('80〜90名') || t.includes('90〜100名'))) features.push('大人数の宴会にも対応');
  else if (tags.some(t => t.includes('50〜60名') || t.includes('60〜70名'))) features.push('大人数の宴会OK');
  else if (tags.some(t => t.includes('10〜20名') || t.includes('20〜30名'))) features.push('少人数の会食に最適');

  if (tags.includes('女子会'))         features.push('女子会におすすめ');
  if (tags.includes('誕生日・記念日')) features.push('誕生日・記念日プランあり');

  if (rating >= 4.5)      features.push(`Google評価${rating}の高評価店`);
  else if (rating >= 4.0) features.push(`Google評価${rating}と好評`);

  // 「名古屋（名古屋駅/西区/中村区）」→「名駅」、「栄(ミナミ)/矢場町/...」→「栄」 など、最初の代表語だけ拾う
  let areaLabel = area
    .replace(/^名古屋（([^/）]+)[^）]*）$/, '$1')
    .split('/')[0]
    .replace(/[（(].*?[)）]/g, '')
    .replace('名古屋駅', '名駅')
    .trim();
  if (areaLabel) features.push(`${areaLabel}エリアで人気`);

  let text = features[0] || '名古屋で人気の一軒';
  for (let i = 1; i < features.length; i++) {
    const next = text + '。' + features[i];
    if (next.length <= 50) text = next;
    else break;
  }
  if (text.length > 50) text = text.slice(0, 49) + '。';
  return text;
}

function main() {
  const dryrun = process.argv.includes('--dryrun');
  const stores = loadStores();
  const reco   = JSON.parse(fs.readFileSync(RECO_PATH, 'utf8'));

  const targets = stores.filter(s => {
    const point = (s['おすすめポイント'] || '').trim();
    if (point) return false;
    const hp = (s['ホットペッパーID'] || '').trim();
    if (!hp) return false;
    if (reco[hp] && String(reco[hp]).trim()) return false;
    return true;
  });

  console.log(`未充足対象: ${targets.length}件`);
  if (targets.length === 0) { console.log('追加なし'); return; }

  const added = {};
  for (const s of targets) {
    const hp   = s['ホットペッパーID'].trim();
    const text = generate(s);
    added[hp]  = text;
    console.log(`  + ${hp}  ${s['店名']}  →  ${text}`);
  }

  if (dryrun) { console.log('(dryrun: 書き込みスキップ)'); return; }

  const merged = { ...reco, ...added };
  fs.writeFileSync(RECO_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`書き込み完了: ${Object.keys(added).length}件追加 → ${RECO_PATH}`);
  console.log('次に: node build.js を実行して LOCAL_STORES に反映');
}

main();
