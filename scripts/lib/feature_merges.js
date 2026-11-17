'use strict';
/**
 * scripts/lib/feature_merges.js — 重なった特集を寄せた記録（data/feature_merges.json）と転送ページの部品
 * （基本方針 段階5 S5-3・決定 0069 の7・0077）
 *
 * 寄せ元（from）の features/<from>.html は、寄せ先（to）へ飛ぶ転送ページにする。URL は消さない
 * （GitHub Pages は 301 を返せないので canonical + meta refresh + JS。店舗の誘導ページ ISSUE-102 と同じ型。
 * 特集の転送ページは検索に出さない noindex を足す）。転送ページには目印の HTML コメントが入る。
 * 一覧・サイトマップ・llms.txt・掲載店の入れ替え・役割表は、この目印か merges.json で寄せ元を外す。
 */
const fs = require('fs');
const path = require('path');

const MARK = 'nb-feature-merged';
const BASE_URL = 'https://nagoya-bites.com';
const ROOT = path.join(__dirname, '..', '..');
const MERGES_FILE = path.join(ROOT, 'data', 'feature_merges.json');

function loadMerges(root = ROOT) {
  const f = path.join(root, 'data', 'feature_merges.json');
  if (!fs.existsSync(f)) return [];
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  return Array.isArray(j.merges) ? j.merges : [];
}

/** 寄せ元スラグの Set（features/<slug>.html が転送ページになる特集） */
function mergedFromSlugs(root = ROOT) {
  return new Set(loadMerges(root).map((m) => m.from));
}

/** 転送ページのファイル名（'nagoya-yakitori-guide.html'）の Set */
function mergedFromFiles(root = ROOT) {
  return new Set([...mergedFromSlugs(root)].map((s) => `${s}.html`));
}

function isMergedStub(html) {
  return typeof html === 'string' && html.includes(`<!-- ${MARK}:`);
}

function stubTarget(html) {
  const m = typeof html === 'string' && html.match(new RegExp(`<!-- ${MARK}:([^ ]+) -->`));
  return m ? m[1] : null;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 寄せ先の特集へ飛ぶ転送ページ。可視テキストは既定サイズ（13px 以上）。 */
function renderFeatureStub(toSlug, toTitle) {
  const url = `${BASE_URL}/features/${toSlug}.html`;
  const name = esc(toTitle || '特集記事');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>この特集は統合しました | NAGOYA BITES</title>
<!-- ${MARK}:${toSlug} -->
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${toSlug}.html">
<script>location.replace(${JSON.stringify(toSlug + '.html')});</script>
</head>
<body>
<p>この特集は、内容の重なる別の特集に統合しました。<a href="${toSlug}.html">${name}</a> へ移動します。</p>
</body>
</html>
`;
}

/** 寄せ先に足す「統合した記事から」の一文（冒頭ではなく関連特集の直前）。目印は data-nb-merged-from。 */
function mergedFromNote(merge) {
  const t = esc(merge.fromTitle || merge.from);
  return `<p class="nb-note" data-nb-merged-from="${esc(merge.from)}">統合した記事から: 内容の重なっていた特集「${t}」は、この記事に統合しました。</p>`;
}

/** features/ の HTML ファイル名のうち、転送ページを除いたもの（一覧・サイトマップ・llms.txt 用）。読めなければ残す */
function filterLiveFeatureFiles(dir, files) {
  return files.filter((f) => {
    try { return !isMergedStub(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { return true; }
  });
}

module.exports = {
  MARK, MERGES_FILE, loadMerges, mergedFromSlugs, mergedFromFiles, isMergedStub, stubTarget,
  renderFeatureStub, mergedFromNote, filterLiveFeatureFiles,
};
