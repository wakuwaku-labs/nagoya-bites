#!/usr/bin/env node
/**
 * journal/2026-*.html の <div class="related"> を「直近3本の他journal + ナビリンク」に書き換える。
 * 各記事の <h1 class="art-title"> から <em> を剥いだ表示用タイトルを抽出して使う。
 * _template.html / index.html / feed.* は対象外。
 */
const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, '..', 'journal');

function listPosts() {
  return fs.readdirSync(JOURNAL_DIR)
    .filter(f => /^2\d{3}-\d{2}-\d{2}-.+\.html$/.test(f))
    .sort()
    .reverse(); // 新しい順
}

function extractTitle(html) {
  const m = html.match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function shortLabel(title) {
  // 表示用ラベル: 「— 」以降を落として頭の主張だけ残す（長すぎる時の保険）
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

// 回遊強化: journal タイトルから関連特集(features/)を1本マッチさせる。
// 先頭から順に最初に一致したものを採用。確信が持てない場合は付けない（汎用ハブのみ）。
const TOPIC_FEATURES = [
  [/ひつまぶし|うなぎ|鰻/, 'nagoya-unaju', 'うなぎ・ひつまぶし10選'],
  [/手羽先/, 'nagoya-tebasaki', '手羽先完全ガイド'],
  [/味噌煮込み/, 'nagoya-miso-nikomi-udon', '味噌煮込みうどんガイド'],
  [/味噌かつ|とんかつ|トンカツ/, 'nagoya-tonkatsu', 'とんかつ・味噌かつ10選'],
  [/焼肉|焼き肉|ホルモン|肉割烹|和牛|松阪牛/, 'nagoya-yakiniku', '焼肉おすすめ10選'],
  [/ステーキ/, 'nagoya-steak', 'ステーキ10選'],
  [/鉄板焼/, 'nagoya-teppanyaki', '鉄板焼き10選'],
  [/すき焼き|しゃぶしゃぶ/, 'nagoya-sukiyaki', 'すき焼き・しゃぶしゃぶ10選'],
  [/焼鳥|焼き鳥|やきとり|串焼|コーチン/, 'nagoya-yakitori', '焼き鳥10選'],
  [/寿司|鮨|すし/, 'nagoya-sushi-guide', '鮨8選'],
  [/ラーメン|まぜそば|つけ麺/, 'nagoya-ramen', 'ラーメン12選'],
  [/餃子/, 'nagoya-gyoza', '餃子10選'],
  [/海鮮|魚介|刺身|鮮魚/, 'nagoya-seafood', '海鮮・魚介10選'],
  [/イタリアン|パスタ/, 'nagoya-italian-guide', 'イタリアン10選'],
  [/フレンチ|フランス料理/, 'nagoya-french-guide', 'フレンチ8選'],
  [/中華|中国料理/, 'nagoya-chinese-guide', '中華料理10選'],
  [/韓国/, 'nagoya-korean', '韓国料理10選'],
  [/モーニング|喫茶/, 'nagoya-morning', 'モーニング・喫茶10選'],
  [/カフェ/, 'nagoya-cafe', 'カフェ10選'],
  [/スイーツ|デザート|パフェ|ケーキ/, 'nagoya-sweets', 'スイーツ10選'],
  [/バー|カクテル|ウイスキー|ワイン/, 'nagoya-bar-guide', 'バー・ワインバー10選'],
  [/居酒屋/, 'nagoya-izakaya', '居酒屋10選'],
  [/一人飲み|ひとり飲み|独り/, 'nagoya-solo-dining', '一人飲み完全ガイド'],
  [/接待|会食/, 'nagoya-settai-secret', '失敗しない接待10選'],
  [/デート/, 'date', 'デートディナー10選'],
  [/誕生日|記念日/, 'birthday', '誕生日・記念日10選'],
  [/女子会/, 'girls-party', '女子会10選'],
  [/宴会|忘年会|新年会/, 'banquet', '宴会・忘年会15選'],
  [/個室/, 'private-room', '個室グルメ10選'],
  [/大須/, 'osu-food-walk', '大須食べ歩き10選'],
  [/名駅|名古屋駅/, 'meieki', '名駅グルメ15選'],
  [/栄|錦/, 'sakae', '栄・錦グルメ15選'],
  [/夏|ビアガーデン|納涼/, 'nagoya-summer-2026', '夏グルメ10選'],
];

function matchTopicFeature(title) {
  if (!title) return null;
  for (const [re, slug, label] of TOPIC_FEATURES) {
    if (re.test(title)) return { slug, label };
  }
  return null;
}

function buildRelatedHtml(currentFile, posts, postsMeta) {
  const others = posts.filter(f => f !== currentFile).slice(0, 3);
  const lines = [];
  lines.push('<div class="related">');
  lines.push('  <p class="related-title">関連記事</p>');
  lines.push('  <div class="related-links">');
  for (const f of others) {
    const meta = postsMeta[f];
    if (!meta) continue;
    lines.push(`    <a class="related-link" href="${f}">${shortLabel(meta.title)}</a>`);
  }
  lines.push('    <a class="related-link" href="index.html" style="background:rgba(122,92,16,.08);">📰 Journal 一覧</a>');
  // タイトルにジャン/シーンが含まれれば、対応する特集へのトピックリンクを1本追加（回遊強化）
  const topic = matchTopicFeature(postsMeta[currentFile] && postsMeta[currentFile].title);
  if (topic) {
    lines.push(`    <a class="related-link" href="../features/${topic.slug}.html" style="background:rgba(122,92,16,.08);">📖 ${topic.label}</a>`);
  }
  lines.push('    <a class="related-link" href="../features/index.html">📖 特集をもっと見る</a>');
  lines.push('    <a class="related-link" href="../index.html">🍽 全店舗を検索</a>');
  lines.push('  </div>');
  lines.push('</div>');
  return lines.join('\n');
}

function refreshFile(file, posts, postsMeta) {
  const fp = path.join(JOURNAL_DIR, file);
  let html = fs.readFileSync(fp, 'utf8');
  const re = /<div class="related">\s*<p class="related-title">[^<]*<\/p>\s*<div class="related-links">[\s\S]*?<\/div>\s*<\/div>/;
  if (!re.test(html)) {
    return { file, changed: false, reason: 'related block not found' };
  }
  const next = buildRelatedHtml(file, posts, postsMeta);
  const updated = html.replace(re, next);
  if (updated === html) return { file, changed: false, reason: 'no diff' };
  fs.writeFileSync(fp, updated);
  return { file, changed: true };
}

function main() {
  const posts = listPosts();
  const postsMeta = {};
  for (const f of posts) {
    const html = fs.readFileSync(path.join(JOURNAL_DIR, f), 'utf8');
    const title = extractTitle(html);
    if (title) postsMeta[f] = { title };
  }
  console.log(`Found ${posts.length} posts`);
  let changed = 0;
  for (const f of posts) {
    const r = refreshFile(f, posts, postsMeta);
    if (r.changed) changed++;
    else console.log(`SKIP ${f}: ${r.reason}`);
  }
  console.log(`Updated ${changed}/${posts.length} files`);
}

main();
