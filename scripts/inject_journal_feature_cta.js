#!/usr/bin/env node
/**
 * journal/ 記事の本文冒頭（導入段落の直後）に、関連特集への文脈リンクを冪等付与する（SEO-070）。
 *
 * 挿入位置: <div class="art-body"> 直下の最初の </p> の直後
 * 条件:     記事タイトルが TOPIC_FEATURES にマッチし、かつ features/SLUG.html が実在する場合のみ。
 *           一致なしはスキップ（汎用リンクを差し込まない）
 * 冪等:     SEO-070:FEATURE-CTA:START/END マーカーで囲む。再実行時は置き換え
 * 実在保証: features/SLUG.html が存在するものだけ参照（リンク切れゼロ維持・架空店ブロックと同じ思想）
 *
 * 使い方:
 *   node scripts/inject_journal_feature_cta.js           # 全記事に適用
 *   node scripts/inject_journal_feature_cta.js --check   # 差分を出さず現状を報告（CI向け）
 *   node scripts/inject_journal_feature_cta.js --file 2026-09-08-ikeshita-kakuozan-yakiniku-smoke-free.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, '..', 'journal');
const FEATURES_DIR = path.join(__dirname, '..', 'features');

const START = '<!-- SEO-070:FEATURE-CTA:START -->';
const END   = '<!-- SEO-070:FEATURE-CTA:END -->';

// refresh_journal_related.js と同じリスト（ジャンル・シーン → 特集スラッグのマッピング）
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

function listPosts() {
  return fs.readdirSync(JOURNAL_DIR)
    .filter(f => /^2\d{3}-\d{2}-\d{2}-.+\.html$/.test(f))
    .sort()
    .reverse();
}

function extractTitle(html) {
  const m = html.match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function matchTopicFeature(title) {
  if (!title) return null;
  for (const [re, slug, label] of TOPIC_FEATURES) {
    if (re.test(title)) {
      if (fs.existsSync(path.join(FEATURES_DIR, slug + '.html'))) {
        return { slug, label };
      }
    }
  }
  return null;
}

function buildBlock(topic) {
  const href = `../features/${topic.slug}.html`;
  const onclick = `onclick="trackEvent('internal_link_click',{block:'feature_cta_mid',link_url:'${href}'})"`;
  return [
    START,
    '<div class="tips-box" role="complementary" aria-label="関連特集">',
    '  <p style="font-family:var(--font-mono);font-size:var(--fs-xs);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--gold);margin:0 0 .5rem;">合わせて読む</p>',
    `  <a href="${href}" ${onclick}>${topic.label} →</a>`,
    '</div>',
    END,
  ].join('\n');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findInsertionAfterIntroPara(html) {
  const artBodyIdx = html.indexOf('<div class="art-body">');
  if (artBodyIdx < 0) return -1;
  const firstParaEnd = html.indexOf('</p>', artBodyIdx);
  if (firstParaEnd < 0) return -1;
  return firstParaEnd + 4; // 直後の </p> の閉じタグの後
}

function processFile(file, opts) {
  const fp = path.join(JOURNAL_DIR, file);
  const html = fs.readFileSync(fp, 'utf8');
  const title = extractTitle(html);
  const topic = matchTopicFeature(title);
  const hasBlock = html.includes(START) && html.includes(END);

  if (!topic) {
    if (hasBlock && !opts.check) {
      // タイトル変更等でマッチしなくなった → マーカーブロックを削除
      const re = new RegExp(escapeRegex(START) + '[\\s\\S]*?' + escapeRegex(END) + '\\n?');
      const updated = html.replace(re, '');
      if (updated !== html) {
        fs.writeFileSync(fp, updated);
        return { file, changed: true, status: 'removed' };
      }
    }
    return { file, changed: false, status: 'no_topic_match' };
  }

  const block = buildBlock(topic);
  let next;

  if (hasBlock) {
    const re = new RegExp(escapeRegex(START) + '[\\s\\S]*?' + escapeRegex(END));
    next = html.replace(re, block);
  } else {
    const at = findInsertionAfterIntroPara(html);
    if (at < 0) return { file, changed: false, status: 'no_art_body' };
    next = html.slice(0, at) + '\n' + block + '\n' + html.slice(at);
  }

  if (next === html) return { file, changed: false, status: 'no_diff', topic: topic.slug };
  if (!opts.check) fs.writeFileSync(fp, next);
  return {
    file,
    changed: true,
    status: hasBlock ? 'updated' : (opts.check ? 'would_add' : 'added'),
    topic: topic.slug,
  };
}

function main() {
  const args = process.argv.slice(2);
  const opts = { check: args.includes('--check') };
  const fileArg = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null;

  const posts = fileArg ? [fileArg] : listPosts();
  console.log(`Found ${posts.length} post(s)`);

  const results = posts.map(f => processFile(f, opts));
  const byStatus = {};
  results.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

  if (opts.check) {
    const missing = results.filter(r => r.status === 'would_add');
    missing.forEach(r => console.log(`MISSING ${r.file}: topic=${r.topic}`));
    console.log(`Check: ${JSON.stringify(byStatus)}`);
    if (missing.length > 0) process.exit(1);
  } else {
    const changed = results.filter(r => r.changed);
    changed.forEach(r => console.log(`${r.status.toUpperCase()} ${r.file}: topic=${r.topic || '(removed)'}`));
    console.log(`Done: ${JSON.stringify(byStatus)}`);
  }
}

if (require.main === module) main();
