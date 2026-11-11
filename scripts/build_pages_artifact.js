#!/usr/bin/env node
'use strict';
/**
 * scripts/build_pages_artifact.js — GitHub Pages に出す「許可リストだけ」の成果物を作る
 *
 * 背景: GitHub Pages は main の直下を丸ごと公開するため、内部の文書・データ・スクリプト
 * （HANDOFF.md・CLAUDE.md・agent-backlog.md・data/*.json・scripts/・tests/ など）も
 * 誰でも開ける状態だった。判断の記録 0061（docs/decisions/）。
 *
 * 方式: git で追跡されているファイルのうち、下の「許可リスト」に当たる物だけを出力先へコピーする。
 * 許可リストに無い物（新しく足した内部ファイルも含む）は、何もしなくても公開されない（既定は遮断）。
 * robots.txt や .htaccess 的な「お願い」ではなく、そもそも成果物に入れない。
 *
 * 使い方:
 *   node scripts/build_pages_artifact.js --out _site        成果物を作る（必須ファイルが欠ければ exit 1）
 *   node scripts/build_pages_artifact.js --list             公開する物の一覧を出す
 *   node scripts/build_pages_artifact.js --summary          公開する物・遮断する物の件数と、遮断する物の最上位の名前
 *
 * 通信しない・リポジトリの元ファイルを書き換えない（出力先にコピーするだけ）。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// ── 許可リスト（ここに無い物は公開しない）──────────────────────────────

// ルート直下の個別ファイル
const ROOT_EXACT = new Set([
  'CNAME',          // 独自ドメイン（nagoya-bites.com）
  '.nojekyll',      // 念のため残す（Actions 配信では Jekyll は動かない）
  'robots.txt',
  'llms.txt',
  'manifest.json',  // PWA
  'sw.js',          // Service Worker（ルートのスコープが要る）
]);

// ルート直下のパターン（公開ページ・サイトマップ・検索エンジンの所有確認ファイル）
const ROOT_PATTERNS = [
  /^[A-Za-z0-9][A-Za-z0-9_-]*\.html$/,       // index/about/faq/contact/privacy-policy/404/google*.html（先頭 _ は作業用なので除く）
  /^sitemap[A-Za-z0-9_-]*\.xml$/,            // sitemap.xml / sitemap-index.xml / sitemap-images.xml
  /^[0-9a-f]{32}\.txt$/,                     // IndexNow の鍵ファイル（検索エンジンが取りに来る）
];

// data/ のうち、ブラウザ・外部が実行時に取りにいく物（コードの参照で確かめた物だけ）
//  - stores.json / crosscheck.json: index.html が fetch する（店舗一覧・口コミ内訳）
//  - area_genre_pages_manifest.json: llms.txt が出典として公開 URL を示している
const DATA_ALLOW = new Set([
  'data/stores.json',
  'data/crosscheck.json',
  'data/area_genre_pages_manifest.json',
]);

// 暫定許可: 公開が要る内部データ（理由と外す手順は docs/decisions/0061 を参照）
//  - gsc_metrics.json: .gas-deploy/Code.js の fetchGscCandidateKeywords() が公開 URL を読む。
//    遮断すると GAS の日次レポートは「KW を名指ししない文言」に落ちる（失敗しても止まらない作り）。
//    GAS 側を直した後でここから外す。
const DATA_TEMPORARY_ALLOW = new Set([
  'data/gsc_metrics.json',
]);

// ディレクトリ配下の許可（拡張子と深さ）
//  stores/**.html（店舗・誘導・エリア×ジャンルのハブ）, features/*.html, journal/*.html + feed.xml/feed.atom,
//  assets/**（画像・CSS。参照されるのはこの下だけ）, assets/js/*.js（共通の計測 JS）, icons/*.png
const DIR_RULES = [
  { prefix: 'stores/', ext: /\.html$/, recursive: true },
  { prefix: 'features/', ext: /\.html$/, recursive: false },
  { prefix: 'journal/', ext: /\.(html|xml|atom)$/, recursive: false },
  // 公開ページが読み込む共通 JS（assets/js/ の .js だけ。店舗ページの計測 store-link-tracking.js など）。
  // 判定は最初に前方一致した規則で決まるので、広い 'assets/' より前に置く
  { prefix: 'assets/js/', ext: /\.js$/, recursive: false },
  { prefix: 'assets/', ext: /\.(css|jpg|jpeg|png|webp|svg|gif|ico|avif)$/i, recursive: true },
  { prefix: 'icons/', ext: /\.(png|svg|ico)$/i, recursive: false },
];

// 出力に必須のファイル（欠けたらサイトが壊れるので成果物を作らず失敗させる）
const REQUIRED = [
  'index.html', '404.html', 'sw.js', 'manifest.json', 'CNAME', 'robots.txt',
  'sitemap.xml', 'llms.txt', 'assets/css/nb.css',
  'data/stores.json', 'data/crosscheck.json',
  'icons/icon-192.png', 'icons/icon-512.png',
];

/** パス（リポジトリ直下からの / 区切り）が公開してよいか */
function isAllowed(p) {
  const parts = p.split('/');
  // 先頭が . の名前（隠しファイル）は出さない（.nojekyll だけ許可）。
  // 先頭が _ の名前（_template.html などの作業用）も出さない。ただし assets/ の画像は
  // 公開ページが参照する（_fallback.svg など）ので、この _ の除外は assets/ の外だけに掛ける。
  if (p !== '.nojekyll' && parts.some((s) => s.startsWith('.'))) return false;
  if (!p.startsWith('assets/') && parts.some((s) => s.startsWith('_'))) return false;
  if (parts.length === 1) {
    return ROOT_EXACT.has(p) || ROOT_PATTERNS.some((re) => re.test(p));
  }
  if (p.startsWith('data/')) return DATA_ALLOW.has(p) || DATA_TEMPORARY_ALLOW.has(p);
  for (const r of DIR_RULES) {
    if (!p.startsWith(r.prefix)) continue;
    const rest = p.slice(r.prefix.length);
    if (!r.recursive && rest.includes('/')) return false;
    return r.ext.test(rest);
  }
  return false;
}

/** git で追跡されているファイルの一覧（日本語名も正しく扱うため -z） */
function listTracked(root = ROOT) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function partition(paths) {
  const allowed = [];
  const blocked = [];
  for (const p of paths) (isAllowed(p) ? allowed : blocked).push(p);
  return { allowed, blocked };
}

function build(outDir, root = ROOT) {
  const { allowed, blocked } = partition(listTracked(root));
  const set = new Set(allowed);
  const missing = REQUIRED.filter((f) => !set.has(f) || !fs.existsSync(path.join(root, f)));
  if (missing.length) {
    throw new Error('成果物に必須のファイルが無い: ' + missing.join(', '));
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  let n = 0;
  for (const p of allowed) {
    const src = path.join(root, p);
    const st = fs.lstatSync(src);
    // Pages の成果物にシンボリックリンク・ハードリンクは入れられない（公式文書）
    if (st.isSymbolicLink() || !st.isFile()) continue;
    const dst = path.join(outDir, p);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    n++;
  }
  return { copied: n, blocked: blocked.length };
}

function topLevel(paths) {
  const m = new Map();
  for (const p of paths) {
    const k = p.includes('/') ? p.split('/')[0] + '/' : p;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  if (argv.includes('--list')) {
    console.log(partition(listTracked()).allowed.join('\n'));
    return 0;
  }
  if (argv.includes('--summary')) {
    const { allowed, blocked } = partition(listTracked());
    console.log(`公開する: ${allowed.length} 件 / 遮断する: ${blocked.length} 件`);
    for (const [k, c] of topLevel(blocked)) console.log(`  遮断 ${k} ${c}`);
    return 0;
  }
  const out = get('--out');
  if (!out) {
    console.error('使い方: node scripts/build_pages_artifact.js --out <出力先> | --list | --summary');
    return 2;
  }
  try {
    const r = build(path.resolve(out));
    console.log(`成果物を作った: ${out}（コピー ${r.copied} 件・遮断 ${r.blocked} 件）`);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

module.exports = { isAllowed, partition, listTracked, build, REQUIRED, DATA_ALLOW, DATA_TEMPORARY_ALLOW, ROOT };

if (require.main === module) process.exit(main(process.argv.slice(2)));
