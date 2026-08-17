'use strict';

/**
 * scripts/audit_reel_ownership.js
 *
 * カードに出すリール動画の「所有者検証」の正本。
 * ── 何のための検証か ──────────────────────────────────────────
 * 投稿者が誰か（店の公式アカか、グルメインフルエンサーか）は問わない。
 * 防ぎたいのは「その店を写していない動画が、その店のカードに出ること」。
 *
 * ── 判定に使う事実（CLAUDE.md 制約10）─────────────────────────
 * 自己申告値（画質スコア・話題度など、誰も検算できない数値）は一切使わない。
 * 使うのは次の3つの、後から第三者が確認できる事実だけ:
 *   (1) 投稿URLのアカウント名
 *   (2) 店の登録 Instagram アカウント名
 *   (3) 同じ投稿アカウントが紐づく全店舗の店名
 *
 * ── 判定 ──────────────────────────────────────────────────
 *   PASS_OWN    店の登録アカウント本人の投稿
 *   PASS_BRAND  同一ブランドの支店アカ / チェーン公式アカ
 *               （例: 鳥貴族公式 → 鳥貴族 各店。撮影支店は違っても同一ブランド）
 *   BLOCK_SHARED 1つのアカウントがブランドの異なる複数店に紐づく
 *               （例: popular=25店 / yuichi5016=3店。どの店の動画か決められない）
 *   HOLD_3RD    店と紐付けを確認できない第三者アカウントの投稿
 *               → インフルエンサー投稿はここ。キャプション・@メンション・
 *                 ロケーションを保存して証跡が付いた時点で解禁する
 *   NO_ACCOUNT  店に登録アカウントが無く照合できない
 *
 * index.html の nbVerifiedReel() が同じ判定を「表示の直前」に毎回実行する。
 * 本スクリプトはその判定が退行していないことを CI で担保する。
 *
 * 使い方:
 *   node scripts/audit_reel_ownership.js            内訳レポート
 *   node scripts/audit_reel_ownership.js --check    CI用（不変条件違反で exit 1）
 *   node scripts/audit_reel_ownership.js --list-blocked  遮断された投稿の一覧
 */

const fs = require('fs');

const path = require('path');
const { loadStores, INDEX_HTML: INDEX } = require('./lib/load_stores.js');

const POSTS_JSON = path.resolve(__dirname, '..', 'data', 'instagram_posts.json');

// リールと写真投稿の両方を検証対象にする（同じ所有者問題があるため）
const POST_RE = /^https:\/\/www\.instagram\.com\/([A-Za-z0-9._]+)\/(reel|p)\/([A-Za-z0-9_-]+)/;
// index.html の NB_AREA_RE と同一（エリア語・支店語を落としてブランド部分を取り出す）
const AREA_RE = /(名古屋駅|名駅|名古屋|栄東|栄|錦|金山|伏見|大須|今池|千種|藤が丘|本山|住吉|新栄|覚王山|八事|鶴舞|黒川|池下|矢場町|東別院|柳橋|広小路|笹島|岩塚|徳重|栄生|九条|西口|東口|南口|北口|駅前|本店|支店|店|丁目|[0-9０-９]|\s|　)/g;

const normH = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function acctHandle(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (m) return normH(m[1]);
  return normH(s.replace(/^@/, '').replace(/^instagram\.com\//i, ''));
}

function reelParts(store) {
  const url = String(store['Instagram投稿URL'] || '').trim();
  const m = url.match(POST_RE);
  return m ? { handle: m[1], kind: m[2], code: m[3], url } : null;
}

// ── 証跡: 「その投稿がその店を写している」ことを示す、後から確認できる材料 ──
// 投稿者が誰かは問わない（グルメインフルエンサーの投稿もここを通れば掲載できる）。
// 材料は instagram_posts.json に保存されたキャプション / ロケーションタグ / alt。
//   mention  … キャプションが店の公式アカウントを @ でメンションしている
//   location … ロケーションタグに店名（ブランド部分）が入っている
//   caption  … キャプション本文に店名（ブランド部分）が入っている
// いずれも第三者が同じ投稿を開けば確認できる。自己申告値は使わない。
function evidenceFor(store, entry) {
  if (!entry) return '';
  const core = brandCore(store['店名'] || '');
  const acct = acctHandle(store['Instagram']);
  const caption = String(entry.caption || '');
  const location = String(entry.location || '');
  const alt = String(entry.alt || '');
  if (acct) {
    const mentions = (caption.match(/@[A-Za-z0-9._]+/g) || []).map(m => normH(m.slice(1)));
    if (mentions.includes(acct)) return 'mention';
  }
  if (core.length >= 2) {
    if (location.includes(core)) return 'location';
    if (caption.includes(core) || alt.includes(core)) return 'caption';
  }
  return '';
}

const brandCore = name => String(name || '').replace(AREA_RE, '');

// 全店名に共通して含まれる2文字以上の部分文字列があれば同一ブランドとみなす
function sameBrand(names) {
  const cores = names.map(brandCore).filter(c => c.length >= 2);
  if (cores.length !== names.length) return false;
  const base = cores[0];
  for (let len = base.length; len >= 2; len--) {
    for (let i = 0; i + len <= base.length; i++) {
      const sub = base.substr(i, len);
      if (cores.every(c => c.includes(sub))) return true;
    }
  }
  return false;
}

function loadPostEntries() {
  try { return JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8')); } catch { return {}; }
}

function audit(stores, postEntries) {
  const entries = postEntries || loadPostEntries();
  // 投稿アカウント → そのアカ由来の投稿を持つ店舗名
  const byPost = new Map();
  // 投稿URL → その1本を割り当てられている店舗名（1本の動画は1店のもの）
  const byUrl = new Map();
  for (const s of stores) {
    const p = reelParts(s);
    if (!p) continue;
    const k = normH(p.handle);
    if (!byPost.has(k)) byPost.set(k, []);
    byPost.get(k).push(s['店名'] || '');
    if (!byUrl.has(p.url)) byUrl.set(p.url, []);
    byUrl.get(p.url).push(s['店名'] || '');
  }

  const results = [];
  for (const s of stores) {
    const p = reelParts(s);
    if (!p) continue;
    const post = normH(p.handle);
    const acct = acctHandle(s['Instagram']);
    const evidence = evidenceFor(s, entries[s['ホットペッパーID']]);

    // 段1（最優先）: 同じ1本が別ブランドの複数店に割り当てられている
    //   → 1本の動画が2つの店を写していることはない。どちらが正かも決められないので全部落とす
    const urlHolders = byUrl.get(p.url) || [];
    const urlConflict = urlHolders.length > 1 && !sameBrand(urlHolders);
    // 段3の材料: 投稿アカが別ブランドの複数店に紐づいている（証跡が無いときだけ効かせる）
    const sharers = byPost.get(post) || [];
    const handleConflict = sharers.length > 1 && !sameBrand(sharers);

    let verdict;
    if (urlConflict) verdict = 'BLOCK_DUP_URL';
    // 段2: 証跡があれば投稿者が誰でも通す（インフルエンサー投稿の解禁経路）
    else if (evidence) verdict = 'PASS_EVIDENCE';
    else if (!acct) verdict = 'NO_ACCOUNT';
    // 段3: 証跡が無い場合はアカウントの紐付けだけが頼り。共有アカは落とす
    else if (handleConflict) verdict = 'BLOCK_SHARED';
    else if (post === acct) verdict = 'PASS_OWN';
    else if (post.startsWith(acct) || acct.startsWith(post)) verdict = 'PASS_BRAND';
    else verdict = 'HOLD_3RD';

    results.push({
      store: s['店名'] || '', hpId: s['ホットペッパーID'] || '',
      postHandle: p.handle, acctHandle: acct, kind: p.kind,
      sharedWith: sharers.length, urlSharedWith: urlHolders.length,
      evidence, url: p.url, verdict
    });
  }
  return { results, byPost, byUrl };
}

function main() {
  const args = process.argv.slice(2);
  const stores = loadStores();
  const { results, byPost, byUrl } = audit(stores);
  const by = v => results.filter(r => r.verdict === v);
  const passed = results.filter(r => r.verdict.startsWith('PASS'));
  const reels = results.filter(r => r.kind === 'reel');

  if (args.includes('--list-blocked')) {
    for (const r of results.filter(x => x.verdict.startsWith('BLOCK') || x.verdict === 'HOLD_3RD')) {
      console.log(`${r.verdict}\t${r.store}\t登録:${r.acctHandle || '-'}\t投稿:${r.postHandle}\t同URL${r.urlSharedWith}店/同アカ${r.sharedWith}店`);
    }
    return;
  }

  console.log('── Instagram投稿の所有者検証 ─────────────────────');
  console.log(`検証対象（リール${reels.length} + 写真${results.length - reels.length}）: ${results.length}`);
  console.log(`  PASS_OWN      本人投稿        : ${by('PASS_OWN').length}`);
  console.log(`  PASS_BRAND    同一ブランド    : ${by('PASS_BRAND').length}`);
  console.log(`  PASS_EVIDENCE 証跡あり(第三者可): ${by('PASS_EVIDENCE').length}`);
  console.log(`  BLOCK_DUP_URL 同じ1本を複数店で共有: ${by('BLOCK_DUP_URL').length}  ← 遮断`);
  console.log(`  BLOCK_SHARED  複数ブランド共有アカ : ${by('BLOCK_SHARED').length}  ← 遮断`);
  console.log(`  HOLD_3RD      第三者アカ(証跡待ち) : ${by('HOLD_3RD').length}  ← 保留`);
  console.log(`  NO_ACCOUNT    照合不能            : ${by('NO_ACCOUNT').length}  ← 保留`);
  console.log(`→ 表示される投稿 : ${passed.length}（うちリール ${passed.filter(r => r.kind === 'reel').length}）`);

  const dupUrl = [...byUrl.entries()].filter(([, n]) => n.length > 1 && !sameBrand(n));
  if (dupUrl.length) {
    console.log(`\n── 遮断: 同じ投稿が別ブランドの複数店に割り当て（${dupUrl.length}本）──`);
    for (const [u, names] of dupUrl.sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
      console.log(`  ${u.replace('https://www.instagram.com/', '')} → ${names.join(' / ')}`);
    }
  }

  const multi = [...byPost.entries()]
    .filter(([, names]) => names.length > 1 && !sameBrand(names))
    .sort((a, b) => b[1].length - a[1].length);
  if (multi.length) {
    console.log('\n── 遮断した共有アカウント（ブランドが割れている）──');
    for (const [h, names] of multi.slice(0, 10)) {
      console.log(`  ${h} (${names.length}店) 例: ${names.slice(0, 3).join(' / ')}`);
    }
    if (multi.length > 10) console.log(`  …他 ${multi.length - 10} アカウント`);
  }

  if (args.includes('--check')) {
    const errors = [];
    // 不変条件1: 同じ1本を別ブランドの複数店で共有したまま通過していないこと
    const dupLeak = passed.filter(r => {
      const names = byUrl.get(r.url) || [];
      return names.length > 1 && !sameBrand(names);
    });
    if (dupLeak.length) errors.push(`同一投稿の重複割当が ${dupLeak.length} 件通過している`);
    // 不変条件2: 証跡なしでブランドが割れた共有アカ由来が通過していないこと
    const leaked = passed.filter(r => {
      if (r.evidence) return false;   // 証跡があるものは投稿者が誰でもよい
      const names = byPost.get(normH(r.postHandle)) || [];
      return names.length > 1 && !sameBrand(names);
    });
    if (leaked.length) errors.push(`複数ブランド共有アカ由来が ${leaked.length} 件通過している`);
    // 不変条件3: ランタイム側のゲートが外されていないこと
    const html = fs.readFileSync(INDEX, 'utf8');
    for (const fn of ['function nbVerifiedReel', 'function nbSameBrand', 'nbVerifiedReel(r)']) {
      if (!html.includes(fn)) errors.push(`index.html から ${fn} が消えている（ゲートが外れた）`);
    }
    // 不変条件4: 出せる投稿が枯れていないこと（データ経路の断線検知）
    if (!passed.length) errors.push('表示できる投稿が0件（データ経路の断線を疑う）');

    if (errors.length) {
      console.error('\n✗ CHECK FAILED');
      errors.forEach(e => console.error('  - ' + e));
      process.exit(1);
    }
    console.log('\n✓ CHECK PASSED');
  }
}

if (require.main === module) main();
module.exports = { audit, sameBrand, acctHandle, reelParts, normH, evidenceFor, brandCore };
