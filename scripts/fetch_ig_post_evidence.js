'use strict';

/**
 * scripts/fetch_ig_post_evidence.js
 *
 * サイトが埋め込んでいる Instagram 投稿の「中身の証跡」（キャプション本文）を回収し、
 * data/ig_post_evidence.json に貯める。
 *
 * ── なぜ必要か（ISSUE-092）────────────────────────────────────
 * 掲載中の埋め込み 2,470 件は postUrl / score / type しか保存しておらず、
 * 「なぜその投稿を選んだか」の根拠が残っていない。根拠が無いものは後から第三者が
 * 検算できない＝ CLAUDE.md 制約10 に反するため、関連性の判定
 * （scripts/lib/ig_post_policy.js）にかけることすらできない。
 * そこで公開 embed から本文を回収し、判定可能な状態にする。
 *
 * ── 取得元 ────────────────────────────────────────────────
 * https://www.instagram.com/p/<shortcode>/embed/captioned/
 * サイトが実際に埋め込みに使っているのと同じ公開エンドポイント。
 * ログイン不要・画像は一切ダウンロードしない（本文テキストのみ読む）。
 * CLAUDE.md「Instagram のスクリーンショット・画像ダウンロード禁止」に抵触しない。
 *
 * ── なぜ shortcode をキーにするか ─────────────────────────────
 * 埋め込みの出所が2つある（data/instagram_posts.json のキャッシュと、Sheets 由来の
 * 「Instagram投稿URL」列）。店IDで持つと後者に証跡を付けられず、同じ投稿を複数店が
 * 参照している場合に重複取得も起きる。投稿そのものを一意に指す shortcode で持てば、
 * 出所を問わず1か所で判定できる。
 *
 * 使い方:
 *   node scripts/fetch_ig_post_evidence.js                 # 未取得のみ（再開可）
 *   node scripts/fetch_ig_post_evidence.js --limit 40      # 40件だけ
 *   node scripts/fetch_ig_post_evidence.js --refetch       # 取得済みも取り直す
 *   node scripts/fetch_ig_post_evidence.js --stale 180     # 180日より古いものを取り直す
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT          = path.join(__dirname, '..');
const POSTS_FILE    = path.join(ROOT, 'data', 'instagram_posts.json');
const EVIDENCE_FILE = path.join(ROOT, 'data', 'ig_post_evidence.json');

const argv    = process.argv.slice(2);
const hasFlag = f => argv.includes(f);
const numArg  = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1], 10) : d;
};

const LIMIT   = numArg('--limit', Infinity);
const REFETCH = hasFlag('--refetch');
const STALE   = numArg('--stale', 0);
const DELAY   = numArg('--delay', 700);      // ミリ秒。相手先に負荷をかけない
const SAVE_EVERY = 25;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 投稿URL → shortcode ───────────────────────────────────────
function shortcodeOf(postUrl) {
  const m = String(postUrl || '').match(/instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function embedUrl(shortcode) {
  // embed が本文を返すのは正規形（/p/<shortcode>/）のときだけ。
  // アカウント名込み（/<handle>/reel/<code>/）で叩くと本文ブロックごと返らない（実測・2026-08-17）
  return `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
}

// ── HTML エンティティ復号 + タグ落とし ───────────────────────────
function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, d) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 公開 embed から本文・投稿者を取り出す。
 * 素の UA（curl/8.0 等）だとサーバ側レンダリング版が返り本文が HTML に載る。
 * 最新ブラウザ UA だと JS 版が返り本文が取れないため UA は固定する（実測・2026-08-17）。
 */
function fetchEmbed(postUrl) {
  const code = shortcodeOf(postUrl);
  if (!code) return { error: 'bad_url' };
  let html;
  try {
    html = execFileSync('curl', [
      '-sS', '-m', '25', '-A', 'curl/8.0',
      '-H', 'Accept-Language: ja-JP,ja;q=0.9',
      embedUrl(code)
    ], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  } catch (e) {
    return { error: 'fetch_failed' };
  }
  if (!html || html.length < 500) return { error: 'empty' };

  // 投稿が削除されると embed は EmbedBrokenMedia を返す。
  // ＝サイト上では「リンクが壊れています」と表示されている状態なので、掲載を外す対象
  if (/EmbedBrokenMedia|may be broken, or the post may have been removed/i.test(html)) {
    return { error: 'removed' };
  }
  const capM = html.match(/class="Caption"([\s\S]*?)<\/div>\s*<\/div>/);
  if (!capM) return { error: 'no_caption' };

  let caption = stripHtml(capM[1]);
  const ownerM = html.match(/class="UsernameText"[^>]*>([^<]+)/);
  const owner  = ownerM ? stripHtml(ownerM[1]) : '';
  // 本文は「> <ユーザー名>」で始まり「コメントを追加... Instagram」で終わる体裁
  if (owner) {
    caption = caption.replace(new RegExp('^>?\\s*' + owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '');
  }
  caption = caption
    .replace(/\s*(Add a comment\.\.\.|コメントを追加\.\.\.|コメントを追加…)\s*(Instagram)?\s*$/i, '')
    .trim();

  const isVideo = /class="[^"]*EmbedVideo|videoSpritePlayButton/i.test(html);
  return { caption, owner, isVideo };
}

/** 埋め込みが参照されている全ての投稿URLを集める（キャッシュ + 出荷済み stores） */
function collectTargets() {
  const urls = new Map();  // shortcode -> postUrl
  const add = u => { const c = shortcodeOf(u); if (c && !urls.has(c)) urls.set(c, u); };

  try {
    const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    for (const rec of Object.values(posts)) if (rec && rec.postUrl) add(rec.postUrl);
  } catch (_) {}

  // Sheets 由来（「Instagram投稿URL」列）もキャッシュに無いので拾う
  try {
    const { loadStores } = require('./lib/load_stores.js');
    for (const s of loadStores()) add((s['Instagram投稿URL'] || '').trim());
  } catch (_) {}

  return urls;
}

function loadEvidence() {
  try { return JSON.parse(fs.readFileSync(EVIDENCE_FILE, 'utf8')); } catch { return {}; }
}
function saveEvidence(d) {
  fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(d, null, 2) + '\n', 'utf8');
}

/** 旧世代（instagram_posts.json の rec.evidence）に書かれた分を引き継ぐ */
function migrateLegacy(store) {
  let n = 0;
  try {
    const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
    for (const rec of Object.values(posts)) {
      if (!rec || !rec.postUrl || !rec.evidence) continue;
      const code = shortcodeOf(rec.postUrl);
      if (code && !store[code]) { store[code] = rec.evidence; n++; }
    }
  } catch (_) {}
  return n;
}

async function main() {
  const store   = loadEvidence();
  const moved   = migrateLegacy(store);
  if (moved) console.log(`旧形式から引き継ぎ: ${moved}件`);

  const targets = collectTargets();
  const staleMs = STALE * 24 * 60 * 60 * 1000;
  const now     = Date.now();

  const todo = [...targets.entries()].filter(([code]) => {
    const e = store[code];
    if (REFETCH || !e) return true;
    if (STALE && e.fetchedAt && (now - Date.parse(e.fetchedAt)) > staleMs) return true;
    return false;
  });

  console.log(`参照されている投稿: ${targets.size}件 / 今回取得対象: ${todo.length}件`);
  if (!todo.length) { console.log('全件回収済み'); return; }

  const stats = { ok: 0, removed: 0, failed: 0 };
  let i = 0;

  for (const [code, url] of todo) {
    if (i >= LIMIT) break;
    i++;
    const res = fetchEmbed(url);
    if (res.error) {
      if (res.error === 'removed') stats.removed++; else stats.failed++;
      store[code] = { error: res.error, fetchedAt: new Date().toISOString() };
      console.log(`[${i}/${Math.min(todo.length, LIMIT)}] ${code} ${res.error}`);
    } else {
      stats.ok++;
      store[code] = {
        caption: res.caption.slice(0, 900),
        owner:   res.owner,
        isVideo: !!res.isVideo,
        fetchedAt: new Date().toISOString()
      };
      console.log(`[${i}/${Math.min(todo.length, LIMIT)}] ${code} ${res.owner} :: ${res.caption.slice(0, 80)}`);
    }
    if (i % SAVE_EVERY === 0) saveEvidence(store);
    await sleep(DELAY);
  }

  saveEvidence(store);
  console.log(`\n完了: 取得 ${stats.ok} / 削除済み ${stats.removed} / 失敗 ${stats.failed}`);
}

if (require.main === module) main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
module.exports = { fetchEmbed, stripHtml, shortcodeOf, embedUrl, loadEvidence, EVIDENCE_FILE };
