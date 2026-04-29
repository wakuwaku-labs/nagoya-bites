'use strict';

/**
 * fetch_ig_posts.js
 * 各店舗の Instagram プロフィールから「料理 / 内観」っぽい投稿・リールを
 * スコアリングして1件選び、Sheets S列（Instagram投稿URL）に書き込む。
 *
 * 環境変数:
 *   RESCORE=1   既存のS列値も再評価して上書きする（既存683件を一括見直し用）
 *   MIN_SCORE=2 採用する最低スコア（デフォルト2）
 *   BATCH_SIZE  1回の起動で処理する店舗数（デフォルト20）
 *   MAX_CANDIDATES  各プロフィールから取得する候補数（デフォルト12）
 *   CAPTION_FETCH   候補上位N件のキャプションを取りに行く（デフォルト3、0で無効）
 *
 * 動作:
 *   1. /reels/ タブから候補（href + alt）を最大 MAX_CANDIDATES 件採取
 *   2. リール候補が無い場合のみプロフィールから /p/ 投稿を採取
 *   3. alt テキストで一次スコアリング → 上位 CAPTION_FETCH 件のみ
 *      投稿ページに飛んでキャプションを取得し再スコアリング
 *   4. 最高得点の URL を採用。最高点が MIN_SCORE 未満なら「見つからず」扱い
 */

const { google } = require('googleapis');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ';
const COOKIE_FILE    = path.join(__dirname, '.ig_cookies.json');
const PROGRESS_FILE  = path.join(__dirname, '.ig_posts_progress.json');
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE || '20', 10);
const DELAY_MS       = 4000;
const MAX_CANDIDATES = parseInt(process.env.MAX_CANDIDATES || '12', 10);
const CAPTION_FETCH  = parseInt(process.env.CAPTION_FETCH || '3', 10);
const MIN_SCORE      = parseInt(process.env.MIN_SCORE || '2', 10);
const RESCORE        = process.env.RESCORE === '1';

// ───── スコアリング辞書 ─────
// Meta 自動 alt は英語の場合が多い（"may be an image of food and indoor"）
const ALT_POSITIVE_EN = /\b(food|dish|cuisine|ramen|sushi|noodle|noodles|drink|beverage|cocktail|wine|beer|coffee|restaurant|indoor|table|counter|plate|bowl|glass|kitchen|chef|meal|dessert|cake|bread|meat|fish|seafood|vegetable|fruit|sake|menu)\b/i;
const ALT_NEGATIVE_EN = /\btext\b/i;
const ALT_PERSON_EN   = /\b(person|people|woman|man|child|face|portrait)\b/i;

// 日本語キャプション
const JP_FOOD_STRONG = /(料理|メニュー|ランチ|ディナー|コース|寿司|鮨|天ぷら|焼肉|焼鳥|焼き鳥|ラーメン|うどん|そば|蕎麦|定食|海鮮|刺身|お造り|和食|洋食|中華|イタリアン|フレンチ|韓国料理|スイーツ|デザート|パフェ|ケーキ|パン|ピザ|パスタ|カレー|丼|鍋|もつ鍋|串|串揚げ|お好み焼き|たこ焼き|餃子|チャーハン|炒飯|ステーキ|肉|魚|野菜|名物|看板メニュー|シェフ|板前)/;
const JP_DRINK       = /(ドリンク|カクテル|ワイン|日本酒|ハイボール|ビール|焼酎|サワー|シャンパン|スパークリング|コーヒー|紅茶|お茶|抹茶)/;
const JP_INTERIOR    = /(店内|内観|カウンター|個室|テーブル席|半個室|貸切|ボックス席|座敷|テラス|店構え|空間)/;
const JP_NOTICE      = /(お知らせ|休業|臨時休業|定休日|営業時間変更|年末年始|お盆休み|GW|ゴールデンウィーク|お正月)/;
const JP_RECRUIT     = /(求人|募集|採用|バイト|正社員|アルバイト|スタッフ募集|社員募集|オープニングスタッフ|時給)/;
const JP_PROMO_ONLY  = /(クーポン|割引|キャンペーン|ポイント還元|フォロー＆|フォローして|抽選|プレゼント企画)/;

function scoreContent({ alt, caption, type }) {
  const altT = (alt || '').toLowerCase();
  const cap  = caption || '';
  let score  = type === 'reel' ? 1 : 0; // リールは少しだけ優遇

  // ── alt（英語自動キャプション）──
  if (ALT_POSITIVE_EN.test(altT)) score += 3;
  if (ALT_NEGATIVE_EN.test(altT)) score -= 2;
  if (ALT_PERSON_EN.test(altT) && !ALT_POSITIVE_EN.test(altT)) score -= 1;

  // ── alt 内に日本語キーワードが入ることもある ──
  if (JP_FOOD_STRONG.test(alt || '')) score += 2;
  if (JP_INTERIOR.test(alt || ''))    score += 1;

  // ── キャプション本文（取得していれば最も信頼）──
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

async function main() {
  if (!fs.existsSync(COOKIE_FILE)) {
    console.error('先に ig_login.js を実行してください');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:S',
  });
  const rows = res.data.values || [];
  console.log(`総行数: ${rows.length}`);
  console.log(`モード: ${RESCORE ? 'RESCORE（既存値も再評価）' : '通常（空欄および/p/のみ対象）'}`);
  console.log(`MIN_SCORE=${MIN_SCORE} / MAX_CANDIDATES=${MAX_CANDIDATES} / CAPTION_FETCH=${CAPTION_FETCH}`);

  console.log('ブラウザ起動中...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
  await page.setCookie(...cookies);

  let progress = loadProgress();
  let startRow = progress.lastRow || 1;
  console.log(`開始行: ${startRow + 1}`);

  let processed = 0;
  let found = 0;
  let replaced = 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const storeName = (row[0] || '').trim();
    const igProfile = (row[10] || '').trim();
    const currentPost = (row[18] || '').trim();

    if (!storeName) continue;
    if (!igProfile || !igProfile.match(/instagram\.com\/[a-zA-Z0-9_.]+\/?$/) || igProfile.includes('search')) {
      continue;
    }

    // 通常モード: リールが既にあればスキップ。/p/ のみは再試行。空欄も対象
    // RESCORE モード: 既存値も含めて全件再評価
    if (!RESCORE && currentPost && currentPost.includes('/reel/')) {
      continue;
    }

    if (processed >= BATCH_SIZE) {
      saveProgress({ lastRow: i });
      await browser.close();
      console.log(`\n${BATCH_SIZE}件処理しました。`);
      console.log(`次回開始: ${i + 1}行目（取得 ${found}件 / 差し替え ${replaced}件）`);
      return;
    }

    process.stdout.write(`[${i + 1}] ${storeName.slice(0, 20)} ... `);

    const result = await getBestPost(page, igProfile);
    if (result && result.url && result.score >= MIN_SCORE) {
      // RESCORE モードで、新しい URL が現状と同じなら Sheets 書き込みをスキップ（API節約）
      if (currentPost === result.url) {
        console.log(`変化なし (score=${result.score})`);
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `S${i + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[result.url]] },
        });
        console.log(`${result.url} (score=${result.score}, ${result.type}${currentPost ? ', 差替' : ''})`);
        found++;
        if (currentPost) replaced++;
      }
    } else if (result && result.url) {
      console.log(`スコア不足 (best=${result.score} < ${MIN_SCORE}) → 採用見送り`);
    } else {
      console.log('見つからず');
    }

    processed++;
    await sleep(DELAY_MS);
  }

  await browser.close();
  fs.existsSync(PROGRESS_FILE) && fs.unlinkSync(PROGRESS_FILE);
  console.log(`\n完了: ${processed}件処理、${found}件採用（うち差替 ${replaced}件）`);
}

async function getBestPost(page, profileUrl) {
  try {
    // 1. リールタブから候補収集
    const reelsUrl = profileUrl.replace(/\/?$/, '/reels/');
    await page.goto(reelsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2200);

    const isLoggedIn = await page.evaluate(() => !document.querySelector('input[name="username"]'));
    if (!isLoggedIn) return null;

    let candidates = await collectCandidates(page, '/reel/', 'reel', MAX_CANDIDATES);

    // 2. リール候補ゼロならプロフィールから /p/ を取る
    if (candidates.length === 0) {
      await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1800);
      candidates = await collectCandidates(page, '/p/', 'post', MAX_CANDIDATES);
    }

    if (candidates.length === 0) return null;

    // 3. 一次スコアリング（alt のみ）
    candidates = candidates.map(c => ({ ...c, score: scoreContent(c) }));
    candidates.sort((a, b) => b.score - a.score);

    // 4. 上位 CAPTION_FETCH 件のみキャプションを取りに行く（コスト削減）
    if (CAPTION_FETCH > 0) {
      const top = candidates.slice(0, CAPTION_FETCH);
      for (const c of top) {
        try {
          const cap = await fetchCaption(page, c.url);
          c.caption = cap;
          c.score = scoreContent(c);
        } catch (_) {
          // キャプション取れなければ alt スコアのまま
        }
      }
      candidates.sort((a, b) => b.score - a.score);
    }

    const best = candidates[0];
    return { url: best.url, score: best.score, type: best.type };
  } catch (e) {
    return null;
  }
}

async function collectCandidates(page, hrefMatch, type, max) {
  return await page.evaluate((m, t, n) => {
    const seen = new Set();
    const out = [];
    const anchors = document.querySelectorAll(`a[href*="${m}"]`);
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (!href.includes(m)) continue;
      const clean = href.replace(/\?.*$/, '');
      if (seen.has(clean)) continue;
      seen.add(clean);
      const img = a.querySelector('img');
      const alt = img ? (img.getAttribute('alt') || '') : '';
      out.push({ url: 'https://www.instagram.com' + clean, alt, type: t, caption: '' });
      if (out.length >= n) break;
    }
    return out;
  }, hrefMatch, type, max);
}

async function fetchCaption(page, postUrl) {
  await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 12000 });
  await sleep(1500);
  return await page.evaluate(() => {
    // <meta property="og:description"> が一番手堅い
    const og = document.querySelector('meta[property="og:description"]');
    if (og && og.content) return og.content.slice(0, 500);
    // フォールバック: 投稿本文の <h1> や article 内テキスト
    const h1 = document.querySelector('article h1');
    if (h1 && h1.textContent) return h1.textContent.slice(0, 500);
    return '';
  });
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
}
function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data), 'utf8');
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
