'use strict';

/**
 * scripts/select_ig_posts.js
 *
 * 店ごとに「その店の料理・内装・外観がわかる投稿」を1件選び直す（ISSUE-092）。
 *
 * ── なぜ別スクリプトなのか ────────────────────────────────────
 * 既存の選定は scripts/fetch_ig_posts_resolved.js（puppeteer + Instagram ログイン）で、
 * .ig_cookies.json が要る。認証は定期的に切れ、切れている間は選び直しが一切できない
 * （ジャーナル停止の常習原因と同じクラス）。こちらは**ログイン不要の公開エンドポイント**
 * だけを使うので、認証が切れていても選定を回せる。両者は同じ判定器を共有する。
 *
 * ── 選び方（data/photo_policy.json の写真選定と同じ考え方）────
 *   1. アカウントの最近の投稿を新しい順に取る
 *   2. 1件ずつ scripts/lib/ig_post_policy.js にかける
 *   3. 最初に基準を通った1件を採用する
 *   4. どれも通らなければ「投稿なし」にする（取り繕わない）
 *
 * ── 取得元 ────────────────────────────────────────────────
 * https://www.instagram.com/api/v1/users/web_profile_info/?username=<handle>
 * 公開プロフィールの投稿一覧（本文つき）。ログイン不要・画像は取得しない。
 * ただし**全アカウントで使えるわけではない**（実測 25件中6件・2026-08-17）。
 * 取れなかったアカウントは投稿一覧を得る手段が無いため、既存の投稿を判定するに留める
 * （＝基準を通らなければ埋め込みなし）。取れるようになった分から自動的に改善する。
 *
 * 使い方:
 *   node scripts/select_ig_posts.js --dry-run        # 何が変わるか見るだけ
 *   node scripts/select_ig_posts.js                  # 実際に選び直す
 *   node scripts/select_ig_posts.js --limit 100      # 100店だけ
 *   node scripts/select_ig_posts.js --only-rejected  # 現行の投稿が基準を通らない店だけ（既定）
 *   node scripts/select_ig_posts.js --all            # 全店を対象に選び直す
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { judgePost, shortcodeOf } = require('./lib/ig_post_policy.js');

const ROOT          = path.join(__dirname, '..');
const POSTS_FILE    = path.join(ROOT, 'data', 'instagram_posts.json');
const RESOLVED_FILE = path.join(ROOT, 'data', 'instagram_resolved.json');
const EVIDENCE_FILE = path.join(ROOT, 'data', 'ig_post_evidence.json');

const argv    = process.argv.slice(2);
const hasFlag = f => argv.includes(f);
const numArg  = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1], 10) : d;
};

const DRY    = hasFlag('--dry-run');
const ALL    = hasFlag('--all');
const LIMIT  = numArg('--limit', Infinity);
const DELAY  = numArg('--delay', 1200);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

function handleOf(igUrl) {
  const m = String(igUrl || '').match(/instagram\.com\/([^/?#]+)/i);
  return m ? m[1] : null;
}

/**
 * 公開プロフィールから最近の投稿（shortcode + 本文）を取る。
 * 取れないアカウントも多い（アカウント種別によりサーバ側が 400 を返す）。
 */
function fetchRecentPosts(handle) {
  let raw;
  try {
    raw = execFileSync('curl', [
      '-sS', '-m', '20',
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-H', 'x-ig-app-id: 936619743392459',
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`
    ], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  } catch (e) { return null; }

  let j;
  try { j = JSON.parse(raw); } catch { return null; }
  const edges = j && j.data && j.data.user &&
                j.data.user.edge_owner_to_timeline_media &&
                j.data.user.edge_owner_to_timeline_media.edges;
  if (!Array.isArray(edges)) return null;

  return edges.map(e => {
    const n = e.node || {};
    const capEdge = n.edge_media_to_caption && n.edge_media_to_caption.edges && n.edge_media_to_caption.edges[0];
    return {
      shortcode: n.shortcode,
      caption: (capEdge && capEdge.node && capEdge.node.text) || '',
      isVideo: !!n.is_video,
      // Instagram 自身が付ける画像の説明。付いていない投稿の方が多いが、
      // 付いていれば「何が写っているか」の直接の証跡になる
      alt: n.accessibility_caption || '',
      takenAt: n.taken_at_timestamp || 0
    };
  }).filter(p => p.shortcode);
}

function main() {
  const posts    = readJson(POSTS_FILE, {});
  const resolved = readJson(RESOLVED_FILE, {});
  const evidence = readJson(EVIDENCE_FILE, {});

  // 対象を決める: 既定は「今の投稿が基準を通らない店」だけ
  const targets = [];
  for (const [id, r] of Object.entries(resolved)) {
    if (!r.instagram || r.failed) continue;
    const handle = handleOf(r.instagram);
    if (!handle) continue;
    const cur  = posts[id];
    const code = cur && cur.postUrl ? shortcodeOf(cur.postUrl) : null;
    const verdict = judgePost(code ? evidence[code] : null, { storeName: r.store });
    if (ALL || !verdict.ok) targets.push({ id, handle, store: r.store, current: verdict.verdict });
  }

  console.log(`選び直しの対象: ${targets.length}店` + (LIMIT !== Infinity ? `（今回 ${LIMIT} 店まで）` : ''));
  if (DRY) console.log('※ --dry-run のため書き込みはしません');

  const stats = { replaced: 0, stillNone: 0, noList: 0 };
  let i = 0;

  (async () => {
    for (const t of targets) {
      if (i >= LIMIT) break;
      i++;

      const list = fetchRecentPosts(t.handle);
      if (!list || !list.length) {
        stats.noList++;
        console.log(`[${i}] ${t.store.slice(0, 18).padEnd(20)} 投稿一覧を取得できず（現状維持: ${t.current}）`);
        await sleep(DELAY);
        continue;
      }

      // 新しい順に見て、最初に基準を通った1件を採る
      let picked = null;
      const tried = [];
      for (const p of list) {
        // 判定に使うのは本文だけ（判定器が見るのも本文だけ）。
        // accessibility_caption は「何が写っているか」の直接の証跡になり得るが、
        // 実測ではほぼ全ての投稿で null のため、あてにせず証跡としてのみ保存する
        const v = judgePost({ caption: p.caption }, { storeName: t.store });
        // 証跡は取れた分だけ貯める（次回以降の判定・監査で使う）
        evidence[p.shortcode] = {
          caption: String(p.caption).slice(0, 900),
          owner: t.handle,
          isVideo: p.isVideo,
          ...(p.alt ? { alt: p.alt } : {}),
          fetchedAt: new Date().toISOString()
        };
        if (v.ok) { picked = { ...p, verdict: v }; break; }
        tried.push(v.verdict);
      }

      if (picked) {
        stats.replaced++;
        const url = `https://www.instagram.com/${t.handle}/${picked.isVideo ? 'reel' : 'p'}/${picked.shortcode}/`;
        if (!DRY) {
          // 前の投稿のフィールドは引き継がない。caption / alt / location は
          // scripts/audit_reel_ownership.js の evidenceFor() が「その投稿がその店を
          // 写しているか」の判定に使うため、別の投稿の証跡が残ると所有者検証が狂う。
          posts[t.id] = {
            postUrl: url,
            type: picked.isVideo ? 'reel' : 'post',
            caption: picked.caption.slice(0, 500),
            alt: picked.alt || '',
            location: '',            // このAPIからは取得できない（推測で埋めない）
            relevance: picked.verdict.verdict,
            selectedBy: 'select_ig_posts',
            fetchedAt: new Date().toISOString()
          };
        }
        console.log(`[${i}] ${t.store.slice(0, 18).padEnd(20)} → 採用 ${picked.shortcode} (${picked.verdict.reason.slice(0, 44)})`);
      } else {
        stats.stillNone++;
        if (!DRY) {
          // 採用なしのときも、前の投稿の証跡は残さない（postUrl が null なので
          // 参照されないが、次に選び直したとき別投稿の caption が紛れるのを防ぐ）
          posts[t.id] = {
            postUrl: null,
            rejected: [...new Set(tried)],
            checkedCount: list.length,
            selectedBy: 'select_ig_posts',
            fetchedAt: new Date().toISOString()
          };
        }
        console.log(`[${i}] ${t.store.slice(0, 18).padEnd(20)} 基準を通る投稿なし（${list.length}件確認: ${[...new Set(tried)].slice(0, 3).join(',')}）`);
      }

      if (!DRY && i % 20 === 0) {
        fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
        fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
      }
      await sleep(DELAY);
    }

    if (!DRY) {
      fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
      fs.writeFileSync(EVIDENCE_FILE, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
    }
    console.log(`\n完了: 差し替え ${stats.replaced}店 / 通る投稿なし ${stats.stillNone}店 / 一覧取得不可 ${stats.noList}店`);
  })();
}

if (require.main === module) main();
module.exports = { fetchRecentPosts, handleOf };
