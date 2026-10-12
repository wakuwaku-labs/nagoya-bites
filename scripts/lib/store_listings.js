'use strict';

/**
 * scripts/lib/store_listings.js
 *
 * 店舗ページの「この店が載っている特集・記事」のうち、記事（ジャーナル）の側の唯一の情報源（I-15）。
 *
 * 「どの店がどの記事に載っているか」は、記事の本文にその店の店舗ページへのリンクがあるか、だけで決める。
 * 誰でも記事を開いて同じ結果を検算できる事実で、ジャンル・タグ・エリアからの推定は混ぜない（制約10）。
 * 特集の側は scripts/lib/feature_store_match.js（掲載店名の照合）が持つ。ここは特集を扱わない。
 *
 * 店舗データは呼び出し側が渡す（このモジュールは data/stores.json を読まない）。
 * gen-store-pages.js が「今回生成する店舗ページのスラグ」を渡し、記事のリンクをその現役のスラグに結ぶ。
 */

const fs = require('fs');
const path = require('path');
const { isRedirectStub, stubTarget } = require('./store_orphans');

// 日次ジャーナルの記事ファイル（journal/index.html・_template.html・フィードは対象外）
const JOURNAL_FILE_RE = /^(\d{4}-\d{2}-\d{2})-.+\.html$/;

// 店舗ページ 1本が載せる記事の上限（毎日 1 本増えるので、載せる数に上限を置く。新しい順）
const MAX_JOURNAL_PER_STORE = 3;

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return String(s).replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos|nbsp));/g, (m, dec, hex, name) => {
    if (name) return NAMED[name];
    const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    return cp > 0 && cp <= 0x10FFFF ? String.fromCodePoint(cp) : m;
  });
}

/** 記事の本文（<article> から </article> まで）。ヘッダー・ナビ・フッターの共通リンクを数えない。<article> が無ければ空。 */
function articleBody(html) {
  const start = String(html).search(/<article[\s>]/);
  if (start < 0) return '';
  const end = html.lastIndexOf('</article>');
  return html.slice(start, end > start ? end : undefined);
}

/**
 * 記事の本文にある店舗ページ（stores/<slug>.html）へのリンクのスラグを、出てきた順・重複なしで返す。
 * エリア×ジャンルのハブ（stores/area/…）・店舗一覧（stores/index.html）・外部の URL は数えない。
 */
function extractStoreSlugs(html) {
  const re = /href="(?:\.\.\/|https?:\/\/nagoya-bites\.com\/)stores\/([A-Za-z0-9_-]+)\.html(?:[#?][^"]*)?"/g;
  const body = articleBody(html);
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(body))) {
    const slug = m[1];
    if (slug === 'index' || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

/**
 * 記事の見出し（表示用）。構造化データの headline → <title>（末尾のサイト名を除く）→ h1 の文字、の順に使う。
 * 実体参照を戻し、空白をそろえる。どれも取れなければ空文字（呼び出し側は出さない）。
 */
function readArticleTitle(html) {
  const clean = (s) => decodeEntities(String(s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  const ld = /"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(html);
  if (ld) {
    let raw = ld[1];
    try { raw = JSON.parse(`"${raw}"`); } catch (_) { /* JSON の逃がし方でなければそのまま */ }
    const t = clean(raw);
    if (t) return t;
  }
  const tt = /<title>([^<]*)<\/title>/.exec(html);
  if (tt) {
    const t = clean(tt[1]).replace(/\s*[｜|]\s*NAGOYA BITES(?: Journal)?\s*$/, '').trim();
    if (t) return t;
  }
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  return h1 ? clean(h1[1]) : '';
}

/**
 * 記事のリンク先のスラグを、今回生成する現役の店舗ページのスラグへ結ぶ解決器を作る。
 * 現役ならそのまま、誘導ページ（古い ID → 今の店舗ページ・store_orphans.js の目印つき）なら誘導先、
 * どちらでもなければ null（取り繕わない）。
 */
function makeSlugResolver({ root, liveSlugs }) {
  const cache = new Map();
  return (slug) => {
    if (liveSlugs.has(slug)) return slug;
    if (cache.has(slug)) return cache.get(slug);
    let live = null;
    try {
      const html = fs.readFileSync(path.join(root, 'stores', `${slug}.html`), 'utf8');
      if (isRedirectStub(html)) {
        const target = stubTarget(html);
        if (target && liveSlugs.has(target)) live = target;
      }
    } catch (_) { /* ファイルが無い＝結べない */ }
    cache.set(slug, live);
    return live;
  };
}

/**
 * 店舗ページのスラグ → その店を本文に載せているジャーナル記事（新しい順・同じ日はファイル名順）。
 * 1 記事が同じ店を何度リンクしても 1 件。表示名が取れない記事は出さない。
 *
 * @param {{root:string, resolveSlug:(slug:string)=>string|null}} opts root はリポジトリの根（journal/ と stores/ を持つ）
 * @returns {Map<string, Array<{slug:string, title:string, date:string}>>}
 */
function buildJournalStoreMap({ root, resolveSlug }) {
  const map = new Map();
  const dir = path.join(root, 'journal');
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).sort()) {
    const fm = JOURNAL_FILE_RE.exec(f);
    if (!fm) continue;
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const slugs = extractStoreSlugs(html);
    if (!slugs.length) continue;
    const title = readArticleTitle(html);
    if (!title) continue;
    const entry = { slug: f.replace(/\.html$/, ''), title, date: fm[1] };
    const done = new Set();
    for (const s of slugs) {
      const live = resolveSlug(s);
      if (!live || done.has(live)) continue;
      done.add(live);
      if (!map.has(live)) map.set(live, []);
      map.get(live).push(entry);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.date === b.date ? (a.slug < b.slug ? -1 : 1) : (a.date < b.date ? 1 : -1)));
  }
  return map;
}

module.exports = {
  MAX_JOURNAL_PER_STORE, decodeEntities, articleBody, extractStoreSlugs, readArticleTitle, makeSlugResolver, buildJournalStoreMap,
};
