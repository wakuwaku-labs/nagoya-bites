'use strict';

/**
 * scripts/lib/store_orphans.js
 *
 * ISSUE-102: stores/*.html の孤児ページ（data/stores.json から生成されなくなったページ）の
 * 扱いを決める判定器。gen-store-pages.js（--check-orphans / --redirect-orphans /
 * --delete-orphans）と tests が共有する。ネットワーク不要・決定的。
 *
 * 孤児は3つに分ける（判定は検証できる事実だけ・CLAUDE.md 制約10）。
 *   redirect : 現役の店ページが別スラグで存在する（重複統合で吸収された／スラグが変わった）。
 *              URL が検索インデックスや被リンクに残っているため、削除せず「軽量の誘導ページ」にする
 *              （GitHub Pages は 301 を返せない → canonical + meta refresh + JS）。
 *              根拠は (a) data/store_merge_pairs.json の absorbed→kept（kept が現役）
 *                    (b) 店名の正規化一致が現役店でちょうど1件
 *   hold     : data/manual_stores.json に同名エントリがある。写真の実在検証待ちで一時的に
 *              stores.json から外れているだけの可能性があり（ISSUE-140 で実際に復帰した例あり）、
 *              現役店を消さないために削除しない。復帰すれば生成器が通常ページで上書きする。
 *            また features/journal 等の内部リンクが残る孤児も保留（削除すると死にリンクになる）
 *   delete   : 上のどれにも当たらない（HotPepper 側の掲載終了・名古屋圏外・旧スラグ重複など）。
 */

const REDIRECT_MARK = 'nb-orphan-redirect';
const BASE_URL = 'https://nagoya-bites.com';

function normName(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[\s・･\-－ー()（）【】\[\]'’"!！]/g, '')
    .toLowerCase();
}

function isRedirectStub(html) {
  return typeof html === 'string' && html.includes(`<!-- ${REDIRECT_MARK}:`);
}

function stubTarget(html) {
  const m = typeof html === 'string' && html.match(new RegExp(`<!-- ${REDIRECT_MARK}:([^ ]+) -->`));
  return m ? m[1] : null;
}

function readH1(html) {
  const m = typeof html === 'string' && html.match(/<h1[^>]*>([^<]*)</);
  return m ? m[1].trim() : '';
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** 現役店ページへ誘導する軽量ページ（canonical + meta refresh + JS）。可視テキストは13px以上の既定サイズ。 */
function renderRedirectStub(targetSlug, targetName) {
  const url = `${BASE_URL}/stores/${targetSlug}.html`;
  const name = escAttr(targetName || 'お店のページ');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ページを移動しました | NAGOYA BITES</title>
<!-- ${REDIRECT_MARK}:${targetSlug} -->
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${targetSlug}.html">
<script>location.replace(${JSON.stringify(targetSlug + '.html')});</script>
</head>
<body>
<p>このページは移動しました。<a href="${targetSlug}.html">${name} のページへ</a></p>
</body>
</html>
`;
}

/**
 * @param {object} p
 * @param {string[]} p.orphans            孤児スラグ（誘導ページ化済みで現役誘導先が生きているものは含めない）
 * @param {Map<string,string>} p.activeNameBySlug  現役スラグ→店名
 * @param {Object<string,string>} p.mergedKeptBySlug  absorbed スラグ→kept スラグ
 * @param {string[]} p.manualNames        manual_stores.json の店名
 * @param {(slug:string)=>string} p.readName  孤児ページの店名を返す
 * @param {Set<string>} [p.linkedSlugs]  features/journal/stores/area/index.html から href で参照されている店舗スラグ（削除すると404リンクが残るので保留）
 * @returns {{redirect:Object<string,{to:string,why:string,name:string}>, hold:string[], delete:string[]}}
 */
function classifyOrphans({ orphans, activeNameBySlug, mergedKeptBySlug, manualNames, readName, linkedSlugs }) {
  const byNorm = new Map();
  for (const [slug, name] of activeNameBySlug) {
    const k = normName(name);
    if (!k) continue;
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(slug);
  }
  const manual = new Set((manualNames || []).map(normName).filter(Boolean));
  const out = { redirect: {}, hold: [], delete: [] };
  for (const slug of orphans) {
    const kept = mergedKeptBySlug && mergedKeptBySlug[slug];
    if (kept && activeNameBySlug.has(kept)) {
      out.redirect[slug] = { to: kept, why: 'merge', name: activeNameBySlug.get(kept) };
      continue;
    }
    const name = readName(slug);
    const k = normName(name);
    const c = k ? byNorm.get(k) : null;
    if (c && c.length === 1) {
      out.redirect[slug] = { to: c[0], why: 'samename', name: activeNameBySlug.get(c[0]) };
    } else if ((k && manual.has(k)) || (linkedSlugs && linkedSlugs.has(slug))) {
      out.hold.push(slug);
    } else {
      out.delete.push(slug);
    }
  }
  return out;
}

module.exports = {
  REDIRECT_MARK, normName, isRedirectStub, stubTarget, readH1, renderRedirectStub, classifyOrphans,
};

/** 内部リンク元の走査: 他ページが参照している stores/<slug>.html のスラグ集合 */
function collectLinkedSlugs(root) {
  const fs = require('fs');
  const path = require('path');
  const linked = new Set();
  const dirs = ['features', 'journal', path.join('stores', 'area')];
  const files = [path.join(root, 'index.html')];
  for (const d of dirs) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) files.push(path.join(dir, f));
  }
  const re = /stores\/([A-Za-z0-9_-]+)\.html/g;
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(t))) linked.add(m[1]);
  }
  return linked;
}
module.exports.collectLinkedSlugs = collectLinkedSlugs;

/**
 * ISSUE-182: 特集・ジャーナル・エリア×ジャンルのページ・トップから、誘導ページ（古い ID）への
 * リンクを数える。誘導ページへのリンクは店舗ページには着くが、予約リンクと計測は古い ID のまま残る。
 * 誘導ページかどうかはリンク先のファイルそのもので確かめる（isRedirectStub・検証できる事実だけ）。
 * reviewed は人が確かめて残すと決めた組（page・slug・target）。誘導先が変わった組は数え直す。
 * 外部の URL（例: https://jouhou.nagoya/lychi-coffee/）は数えない。
 * @returns {{ pages: number, found: object[], kept: object[] }}
 */
function findStubLinks(root, { reviewed = [] } = {}) {
  const fs = require('fs');
  const path = require('path');
  const files = [];
  const rootIndex = path.join(root, 'index.html');
  if (fs.existsSync(rootIndex)) files.push(rootIndex);
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) files.push(p);
    }
  };
  for (const d of ['features', 'journal', path.join('stores', 'area')]) walk(path.join(root, d));

  const stubCache = new Map();
  const stubOf = (slug) => {
    if (!stubCache.has(slug)) {
      const f = path.join(root, 'stores', `${slug}.html`);
      let t = null;
      if (fs.existsSync(f)) {
        const h = fs.readFileSync(f, 'utf8');
        if (isRedirectStub(h)) t = stubTarget(h) || '';
      }
      stubCache.set(slug, t);
    }
    return stubCache.get(slug);
  };
  const keep = new Map(reviewed.filter((r) => r && r.decision === 'keep').map((r) => [`${r.page}|${r.slug}`, r]));
  const found = [];
  const kept = [];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const dir = path.posix.dirname(rel);
    const html = fs.readFileSync(file, 'utf8');
    const counts = new Map();
    const add = (slug) => counts.set(slug, (counts.get(slug) || 0) + 1);
    let m;
    const abs = /https?:\/\/nagoya-bites\.com\/stores\/([A-Za-z0-9_-]+)\.html/g;
    while ((m = abs.exec(html))) add(m[1]);
    const href = /href="([^"#?:]+\.html)"/g;
    while ((m = href.exec(html))) {
      const p = path.posix.normalize(path.posix.join(dir, m[1]));
      const s = p.match(/^stores\/([A-Za-z0-9_-]+)\.html$/);
      if (s) add(s[1]);
    }
    for (const [slug, count] of counts) {
      const target = stubOf(slug);
      if (target === null) continue;
      const row = { page: rel, slug, target, count };
      const r = keep.get(`${rel}|${slug}`);
      if (r && (!r.target || r.target === target)) kept.push(Object.assign(row, { reason: r.reason || '', issue: r.issue || '' }));
      else found.push(row);
    }
  }
  return { pages: files.length, found, kept };
}
module.exports.findStubLinks = findStubLinks;
