'use strict';

/**
 * scripts/fetch_ig_posts_resolved.js
 * data/instagram_resolved.json（HP ID → アカウントURL）を読み込み、
 * 各アカウントから「料理/内観」スコアが高い投稿を取得して
 * data/instagram_posts.json に書き込む。
 *
 * build.js がこのキャッシュを読み込み LOCAL_STORES に反映する。
 *
 * 環境変数:
 *   BATCH_SIZE    1起動で処理する件数（デフォルト30）
 *   MIN_SCORE     採用最低スコア（デフォルト2）
 *   MAX_CANDIDATES  候補最大数（デフォルト12）
 *   CAPTION_FETCH   キャプション取得上位N件（デフォルト3）
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs   = require('fs');
const path = require('path');

const ROOT          = path.join(__dirname, '..');
const COOKIE_FILE   = path.join(ROOT, '.ig_cookies.json');
const RESOLVED_FILE = path.join(ROOT, 'data', 'instagram_resolved.json');
const POSTS_FILE    = path.join(ROOT, 'data', 'instagram_posts.json');
const PROGRESS_FILE = path.join(ROOT, '.ig_posts_resolved_progress.json');

const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE    || '30', 10);
const MIN_SCORE      = parseInt(process.env.MIN_SCORE      || '2',  10);
const MAX_CANDIDATES = parseInt(process.env.MAX_CANDIDATES || '12', 10);
const CAPTION_FETCH  = parseInt(process.env.CAPTION_FETCH  || '3',  10);

// ── スコアリング（fetch_ig_posts.js と同一ロジック）──
const ALT_POSITIVE_EN = /\b(food|dish|cuisine|ramen|sushi|noodle|noodles|drink|beverage|cocktail|wine|beer|coffee|restaurant|indoor|table|counter|plate|bowl|glass|kitchen|chef|meal|dessert|cake|bread|meat|fish|seafood|vegetable|fruit|sake|menu)\b/i;
const ALT_NEGATIVE_EN = /\btext\b/i;
const ALT_PERSON_EN   = /\b(person|people|woman|man|child|face|portrait)\b/i;
const JP_FOOD_STRONG  = /(料理|メニュー|ランチ|ディナー|コース|寿司|鮨|天ぷら|焼肉|焼鳥|焼き鳥|ラーメン|うどん|そば|蕎麦|定食|海鮮|刺身|お造り|和食|洋食|中華|イタリアン|フレンチ|韓国料理|スイーツ|デザート|パフェ|ケーキ|パン|ピザ|パスタ|カレー|丼|鍋|もつ鍋|串|串揚げ|お好み焼き|たこ焼き|餃子|チャーハン|炒飯|ステーキ|肉|魚|野菜|名物|看板メニュー|シェフ|板前)/;
const JP_DRINK        = /(ドリンク|カクテル|ワイン|日本酒|ハイボール|ビール|焼酎|サワー|シャンパン|スパークリング|コーヒー|紅茶|お茶|抹茶)/;
const JP_INTERIOR     = /(店内|内観|カウンター|個室|テーブル席|半個室|貸切|ボックス席|座敷|テラス|店構え|空間)/;
const JP_RECRUIT      = /(求人|募集|採用|バイト|正社員|アルバイト|スタッフ募集|社員募集|オープニングスタッフ|時給)/;
const JP_NOTICE       = /(お知らせ|休業|臨時休業|定休日|営業時間変更|年末年始|お盆休み|GW|ゴールデンウィーク|お正月)/;
const JP_PROMO_ONLY   = /(クーポン|割引|キャンペーン|ポイント還元|フォロー＆|フォローして|抽選|プレゼント企画)/;

function scoreContent({ alt, caption, type }) {
  const altT = (alt || '').toLowerCase();
  const cap  = caption || '';
  let score  = type === 'reel' ? 1 : 0;
  if (ALT_POSITIVE_EN.test(altT)) score += 3;
  if (ALT_NEGATIVE_EN.test(altT)) score -= 2;
  if (ALT_PERSON_EN.test(altT) && !ALT_POSITIVE_EN.test(altT)) score -= 1;
  if (JP_FOOD_STRONG.test(alt || '')) score += 2;
  if (JP_INTERIOR.test(alt || ''))    score += 1;
  if (cap) {
    if (JP_FOOD_STRONG.test(cap)) score += 3;
    if (JP_DRINK.test(cap))       score += 2;
    if (JP_INTERIOR.test(cap))    score += 2;
    if (JP_RECRUIT.test(cap))     score -= 10;
    if (JP_NOTICE.test(cap))      score -= 5;
    if (JP_PROMO_ONLY.test(cap) && !JP_FOOD_STRONG.test(cap) && !JP_INTERIOR.test(cap)) score -= 3;
  }
  return score;
}

async function collectCandidates(page, hrefMatch, type, max) {
  return await page.evaluate((m, t, n) => {
    const seen = new Set(), out = [];
    for (const a of document.querySelectorAll(`a[href*="${m}"]`)) {
      const href = a.getAttribute('href') || '';
      if (!href.includes(m)) continue;
      const clean = href.replace(/\?.*$/, '');
      if (seen.has(clean)) continue;
      seen.add(clean);
      const img = a.querySelector('img');
      out.push({ url: 'https://www.instagram.com' + clean, alt: img ? (img.getAttribute('alt') || '') : '', type: t, caption: '' });
      if (out.length >= n) break;
    }
    return out;
  }, hrefMatch, type, max);
}

async function fetchCaption(page, postUrl) {
  await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 12000 });
  await sleep(1500);
  return await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:description"]');
    if (og && og.content) return og.content.slice(0, 500);
    const h1 = document.querySelector('article h1');
    return h1 ? h1.textContent.slice(0, 500) : '';
  });
}

async function getBestPost(page, profileUrl) {
  try {
    const reelsUrl = profileUrl.replace(/\/?$/, '/reels/');
    await page.goto(reelsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2200);
    const isLoggedIn = await page.evaluate(() => !document.querySelector('input[name="username"]'));
    if (!isLoggedIn) return null;
    let candidates = await collectCandidates(page, '/reel/', 'reel', MAX_CANDIDATES);
    if (candidates.length === 0) {
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1800);
      candidates = await collectCandidates(page, '/p/', 'post', MAX_CANDIDATES);
    }
    if (candidates.length === 0) return null;
    candidates = candidates.map(c => ({ ...c, score: scoreContent(c) }));
    candidates.sort((a, b) => b.score - a.score);
    if (CAPTION_FETCH > 0) {
      for (const c of candidates.slice(0, CAPTION_FETCH)) {
        try { c.caption = await fetchCaption(page, c.url); c.score = scoreContent(c); } catch (_) {}
      }
      candidates.sort((a, b) => b.score - a.score);
    }
    const best = candidates[0];
    return { url: best.url, score: best.score, type: best.type };
  } catch (e) { return null; }
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return {}; }
}
function saveProgress(d) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(d), 'utf8'); }
function loadPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')); } catch { return {}; }
}
function savePosts(d) { fs.writeFileSync(POSTS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!fs.existsSync(COOKIE_FILE)) { console.error('先に ig_login.js を実行してください'); process.exit(1); }

  const resolved = JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
  const posts    = loadPosts();
  const progress = loadProgress();

  // 対象: アカウントURL解決済み・失敗なし・まだ投稿URL未取得
  const targets = Object.entries(resolved)
    .filter(([id, e]) => e.instagram && !e.failed)
    .filter(([id]) => !posts[id] || !posts[id].postUrl)
    .map(([id, e]) => ({ id, store: e.store, igUrl: e.instagram }));

  const startIdx = progress.lastIdx || 0;
  console.log(`対象: ${targets.length}件 / 開始インデックス: ${startIdx}`);
  console.log(`MIN_SCORE=${MIN_SCORE} / MAX_CANDIDATES=${MAX_CANDIDATES} / CAPTION_FETCH=${CAPTION_FETCH}`);

  if (targets.length === 0) { console.log('全件取得済み'); return; }

  console.log('ブラウザ起動中...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page    = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
  await page.setCookie(...cookies);

  let processed = 0, found = 0;

  for (let i = startIdx; i < targets.length; i++) {
    if (processed >= BATCH_SIZE) {
      saveProgress({ lastIdx: i });
      savePosts(posts);
      await browser.close();
      console.log(`\n${BATCH_SIZE}件処理。次回開始: ${i}番目（取得 ${found}件）`);
      return;
    }

    const { id, store, igUrl } = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${store.slice(0, 20)} ... `);

    const result = await getBestPost(page, igUrl);
    if (result && result.score >= MIN_SCORE) {
      posts[id] = { postUrl: result.url, score: result.score, type: result.type, fetchedAt: new Date().toISOString() };
      console.log(`${result.url} (score=${result.score}, ${result.type})`);
      found++;
    } else if (result) {
      posts[id] = { postUrl: null, score: result.score, fetchedAt: new Date().toISOString() };
      console.log(`スコア不足 (best=${result.score})`);
    } else {
      posts[id] = { postUrl: null, fetchedAt: new Date().toISOString() };
      console.log('見つからず');
    }

    processed++;
    if (processed % 10 === 0) savePosts(posts); // 10件ごとに中間保存
    await sleep(4000);
  }

  await browser.close();
  savePosts(posts);
  fs.existsSync(PROGRESS_FILE) && fs.unlinkSync(PROGRESS_FILE);
  console.log(`\n完了: ${processed}件処理、${found}件取得`);
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
