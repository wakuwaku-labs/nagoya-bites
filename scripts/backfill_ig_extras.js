'use strict';

/**
 * scripts/backfill_ig_extras.js
 *
 * 既に主役投稿(postUrl)を持つ店に対し、extraPosts(2枚目以降・最大4枚)だけを追加取得する。
 * select_ig_posts.js --all と違い、既存の主役投稿(postUrl等)は一切変更しない
 * （主役を毎回「その時点の最新投稿」に差し替えると、既に良い主役を持つ店の写真が
 * 意図せず入れ替わってしまうため）。fetch_ig_posts_resolved.js の getBestPosts()
 * （puppeteer + .ig_cookies.json ログイン）を再利用する。
 *
 * 1店ごとに data/instagram_posts.json / data/ig_post_evidence.json へ保存するため、
 * 途中で中断しても安全（再実行すれば未処理の店から再開する）。
 *
 * 使い方:
 *   node scripts/backfill_ig_extras.js            # 対象を上限50店まで処理
 *   node scripts/backfill_ig_extras.js --limit 100 # 上限を変える
 *   node scripts/backfill_ig_extras.js --all       # 対象全店を処理（無停止で回し切る）
 *
 * 前提: 先に node ig_login.js で .ig_cookies.json を作成しておくこと。
 */

const fs = require('fs');
const path = require('path');
const { getBestPosts, COOKIE_FILE } = require('./fetch_ig_posts_resolved.js');
const { shortcodeOf } = require('./fetch_ig_post_evidence.js');
const { loadPolicy } = require('./lib/ig_post_policy.js');

const ROOT = path.join(__dirname, '..');
const RESOLVED_FILE = path.join(ROOT, 'data', 'instagram_resolved.json');
const POSTS_FILE = path.join(ROOT, 'data', 'instagram_posts.json');
const EVIDENCE_FILE = path.join(ROOT, 'data', 'ig_post_evidence.json');

const argv = process.argv.slice(2);
const limitIdx = argv.indexOf('--limit');
const ALL = argv.includes('--all');
const LIMIT = ALL ? Infinity : (limitIdx >= 0 && argv[limitIdx + 1] ? parseInt(argv[limitIdx + 1], 10) : 50);

function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }

async function main() {
  if (!fs.existsSync(COOKIE_FILE)) { console.error('先に node ig_login.js を実行してください'); process.exit(1); }

  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  const resolved = readJson(RESOLVED_FILE, {});
  const posts = readJson(POSTS_FILE, {});
  const evidence = readJson(EVIDENCE_FILE, {});
  const maxPosts = (loadPolicy().thresholds && loadPolicy().thresholds.maxPostsPerStore) || 1;

  const targets = [];
  for (const [id, r] of Object.entries(resolved)) {
    if (!r.instagram || r.failed) continue;
    const p = posts[id];
    if (!p || !p.postUrl) continue;
    if (p.extraPosts && p.extraPosts.length) continue;
    targets.push({ id, store: r.store, instagram: r.instagram });
  }
  console.log(`対象候補: ${targets.length}店 / 今回 ${LIMIT}店まで`);

  const batch = targets.slice(0, LIMIT);

  console.log('ブラウザ起動中...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
  await page.setCookie(...cookies);

  const stats = { added: 0, noExtra: 0, authFailed: 0 };
  let consecutiveAuthFail = 0;

  for (let i = 0; i < batch.length; i++) {
    const t = batch[i];
    const result = await getBestPosts(page, t.instagram, t.store, maxPosts);
    if (result === null) {
      stats.authFailed++;
      consecutiveAuthFail++;
      console.log(`[${i + 1}/${batch.length}] FAIL ${t.store.slice(0, 20)}`);
      if (consecutiveAuthFail >= 5) {
        console.error('連続失敗のため中断します。ログイン状態(.ig_cookies.json)を確認してください。');
        break;
      }
      continue;
    }
    consecutiveAuthFail = 0;
    const { picked } = result;
    const primaryCode = shortcodeOf(posts[t.id].postUrl);
    const extras = picked
      .filter(p => shortcodeOf(p.url) !== primaryCode)
      .slice(0, maxPosts - 1);

    for (const p of picked) {
      evidence[shortcodeOf(p.url)] = {
        caption: String(p.caption).slice(0, 900),
        owner: (t.instagram.match(/instagram\.com\/([^/?#]+)/i) || [])[1] || '',
        isVideo: p.type === 'reel',
        fetchedAt: new Date().toISOString()
      };
    }

    if (extras.length) {
      posts[t.id].extraPosts = extras.map(p => ({ postUrl: p.url, type: p.type }));
      stats.added++;
      console.log(`[${i + 1}/${batch.length}] +${extras.length} ${t.store.slice(0, 20)}`);
    } else {
      stats.noExtra++;
      console.log(`[${i + 1}/${batch.length}] -0 ${t.store.slice(0, 20)}`);
    }

    // 1店ごとに保存（中断しても再開できるように）
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
    fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  }

  await browser.close();
  console.log(`完了: 追加 ${stats.added}店 / 追加なし ${stats.noExtra}店 / 取得失敗 ${stats.authFailed}店`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { main };
