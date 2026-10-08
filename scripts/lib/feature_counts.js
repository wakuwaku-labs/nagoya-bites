'use strict';
/**
 * 特集の「見出しの N選」と実際の掲載数の一致を検査する唯一の判定器（ISSUE-141）。
 * 判定は検証できる事実だけ（h1 の数字・JSON-LD ItemList の numberOfItems と要素数・
 * 店カード枚数）で行い、自己申告値は見ない（制約10）。
 * refresh_feature_rosters.js --check と tests/feature_counts.test.js が共有する。
 *
 * SEO-146 で「掲載数の表記をそろえる」役も持つ。掲載数は ItemList の件数＝要素数＝店カード枚数が
 * 一致したときだけ「確かめられる件数」とし（verifiedCount）、title・説明文・h1・meta 行・
 * 「本特集のN軒」などの自ページの表記と、他の特集へのリンク文の「N選」をその数に書き換える
 * （syncPage）。scripts/sync_feature_counts.js（build.yml が毎日実行）と build_featured.js・
 * gen_industry_features.js が同じ書き換えを使う。
 */
const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', '..', 'features');

function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, ''); }

// h1 の「N選」を返す（無ければ null）
function h1Count(html) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  if (!m) return null;
  const n = /(\d+)\s*選/.exec(stripTags(m[1]));
  return n ? parseInt(n[1], 10) : null;
}

// 店 ItemList（店ページへの要素を持つ、または name が「…N選」）の numberOfItems と要素数
function itemListInfo(html) {
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let j; try { j = JSON.parse(m[1]); } catch (_) { continue; }
    if (j && j['@type'] === 'ItemList') {
      const els = Array.isArray(j.itemListElement) ? j.itemListElement : [];
      return { numberOfItems: j.numberOfItems, elements: els.length, name: j.name || '' };
    }
  }
  return null;
}

// 店カード（shop-card / store-card / ひつまぶし・味噌煮込み・手羽先の store）の枚数
function cardCount(html) {
  return (html.match(/<div class="(?:shop-card|store-card|store)"[\s>]/g) || []).length;
}

// 確かめられる掲載数: ItemList の numberOfItems・要素数・店カード枚数がすべて一致したときだけ返す
function verifiedCount(html) {
  const il = itemListInfo(html);
  const cards = cardCount(html);
  if (!il || cards === 0) return null;
  return il.numberOfItems === il.elements && il.elements === cards ? cards : null;
}

// 1ページの不整合を文字列配列で返す（空＝整合）
function inspect(html) {
  const problems = [];
  const n = h1Count(html);
  const il = itemListInfo(html);
  const cards = cardCount(html);
  if (n === null || !il) return { n, il, cards, problems };
  if (il.numberOfItems !== n) problems.push(`h1 は ${n}選 だが ItemList numberOfItems=${il.numberOfItems}`);
  if (il.elements !== il.numberOfItems) problems.push(`ItemList numberOfItems=${il.numberOfItems} だが要素数=${il.elements}`);
  if (cards > 0 && cards !== n) problems.push(`h1 は ${n}選 だが店カード=${cards}枚`);
  return { n, il, cards, problems };
}

// ── 掲載数の表記をそろえる（SEO-146）──────────────────────────────
// 数字の前後で除くもの: 桁区切り・小数・範囲の片割れ（「4,559軒」「1〜2店」）、序数（「2店舗目」）、
// 「店選び」「2選択肢」のような別の語。
const BEFORE = '(?<![\\d,，.．〜~～\\-−–—])';
const SEN = '(\\s*選)(?![びぶべんだ択定抜手挙考出別])';
const TEN = '(\\s*(?:店舗|店|軒))(?![\\d〜~～目舗])';
// 言い回しから掲載数とわかるもの。本文と FAQ はこれだけを書き換える（「上位に挙げた3軒」「備長3店舗」は触らない）
const STRONG = [
  new RegExp('()' + BEFORE + '(\\d{1,3})' + SEN, 'g'),
  new RegExp('(厳選(?:した)?\\s*)(\\d{1,3})' + TEN, 'g'),
  new RegExp('((?:選んだ|選び抜いた|判断した|確認できた|本特集の|本記事の)\\s*)(\\d{1,3})' + TEN, 'g'),
  new RegExp('()' + BEFORE + '(\\d{1,3})(\\s*店舗?掲載)', 'g'),
  new RegExp('(掲載\\s*[:：]?\\s*)(\\d{1,3})' + TEN, 'g'),
];
// 「N店」「N軒」だけの表記。title・説明文・h1・meta 行・リンク文では、裏付けがあるときだけ掲載数として読む
const WEAK = new RegExp('()' + BEFORE + '(\\d{1,3})' + TEN, 'g');

function relabelWith(patterns, text, n, log) {
  let out = String(text);
  for (const re of patterns) {
    out = out.replace(re, (m, pre, num, suf) => {
      const next = pre + n + suf;
      if (log && next !== m) log.push(m.trim() + ' → ' + next.trim());
      return next;
    });
  }
  return out;
}
// 短い表記用。「N店」「N軒」は、同じ文に掲載数とわかる言い回し（STRONG）があればその数と同じときだけ、
// 無ければ「N店」「N軒」が1種類の数だけのときに掲載数として読む（「厳選10軒。上位3軒の…」の 3 は触らない）
function relabelAll(text, n, log) {
  const s = String(text);
  const strongVals = new Set();
  for (const re of STRONG) for (const m of s.matchAll(re)) strongVals.add(+m[2]);
  const weakVals = new Set([...s.matchAll(WEAK)].map(m => +m[2]));
  const isCount = v => (strongVals.size ? strongVals.has(v) : weakVals.size === 1);
  return relabelWith(STRONG, s, n, log).replace(WEAK, (m, pre, num, suf) => {
    if (+num === n || !isCount(+num)) return m;
    const next = pre + n + suf;
    if (log) log.push(m.trim() + ' → ' + next.trim());
    return next;
  });
}
const relabelStrong = (text, n, log) => relabelWith(STRONG, text, n, log);

// 属性の中の > でずれないようにタグを切り出し、文字の部分だけを書き換える
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
function mapText(frag, fn) {
  let out = '';
  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(frag))) {
    out += fn(frag.slice(last, m.index)) + m[0];
    last = TAG.lastIndex;
  }
  return out + fn(frag.slice(last));
}

// リンク先が特集ページならその slug（index は除く）。dir はリンク元のディレクトリ（サイトルート相対）
function featureSlugOf(href, dir) {
  if (!href) return null;
  let h = String(href).split('#')[0].split('?')[0];
  if (!h) return null;
  h = h.replace(/^https?:\/\/(?:www\.)?nagoya-bites\.com\//, '/');
  if (/^[a-z]+:/i.test(h)) return null;
  const p = h.startsWith('/') ? h.slice(1) : path.posix.normalize(path.posix.join(dir == null ? 'features' : dir, h));
  const m = /^features\/([a-z0-9-]+)\.html$/.exec(p);
  return m && m[1] !== 'index' ? m[1] : null;
}

// 特集ごとの確かめられる掲載数 { slug: n }
function featureCounts(dir) {
  const d = dir || FEATURES_DIR;
  const out = {};
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.html') && x !== 'index.html')) {
    const n = verifiedCount(fs.readFileSync(path.join(d, f), 'utf8'));
    if (n != null) out[f.replace(/\.html$/, '')] = n;
  }
  return out;
}

// 生成器用: リンク文などの件数を、リンク先の特集の確かめられる掲載数に合わせる（数えられなければそのまま）
let liveCounts = null;
function relabelForSlug(text, slug) {
  if (!liveCounts) liveCounts = featureCounts();
  const n = liveCounts[slug];
  return n == null ? text : relabelAll(text, n);
}

const ARTICLE_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting']);
const typesOf = o => [].concat(o && o['@type'] || []);

// JSON-LD 1ブロック分。書式を保つため、変えた文字列だけを生のテキスト上で置き換える
function syncJsonLd(body, own, counts, self, log) {
  let j;
  try { j = JSON.parse(body); } catch (_) { return body; }
  const pairs = [];
  const put = (oldV, newV) => { if (typeof oldV === 'string' && newV !== oldV) pairs.push([oldV, newV]); };
  const visit = (o) => {
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (!o || typeof o !== 'object') return;
    const types = typesOf(o);
    if (own != null) {
      if (types.some(t => ARTICLE_TYPES.has(t))) {
        for (const k of ['headline', 'alternativeHeadline', 'description']) put(o[k], relabelAll(o[k] || '', own, log));
      }
      const els = Array.isArray(o.itemListElement) ? o.itemListElement : null;
      if (types.includes('ItemList') && els && o.numberOfItems === own && els.length === own) {
        for (const k of ['name', 'description']) put(o[k], relabelAll(o[k] || '', own, log));
      }
      if (types.includes('BreadcrumbList') && els && els.length) {
        const last = els[els.length - 1];
        const target = last && (typeof last.item === 'string' ? last.item : last.item && last.item['@id']);
        if (last && (!target || featureSlugOf(target) === self)) put(last.name, relabelAll(last.name || '', own, log));
      }
      if (types.includes('Question')) {
        put(o.name, relabelStrong(o.name || '', own, log));
        const a = o.acceptedAnswer;
        if (a && typeof a.text === 'string') put(a.text, relabelStrong(a.text, own, log));
      }
    }
    // 他の特集を指す要素（特集一覧の ItemList など）の名前は、指す先の掲載数に合わせる
    const link = [o.url, o.item, o['@id']].find(v => typeof v === 'string' && featureSlugOf(v));
    const slug = link && featureSlugOf(link);
    if (slug && slug !== self && counts[slug] != null && typeof o.name === 'string') put(o.name, relabelAll(o.name, counts[slug], log));
    for (const v of Object.values(o)) if (v && typeof v === 'object') visit(v);
  };
  visit(j);
  let out = body;
  for (const [a, b] of pairs) {
    const from = JSON.stringify(a).slice(1, -1);
    if (out.includes(from)) out = out.split(from).join(JSON.stringify(b).slice(1, -1));
  }
  return out;
}

const HEAD_META = new Set(['og:title', 'twitter:title', 'description', 'og:description', 'twitter:description', 'og:image:alt', 'twitter:image:alt']);

/**
 * 1ページの掲載数の表記をそろえる。self はそのページの slug（features/index.html は null）。
 * 自ページ: title・説明文の meta・h1・meta 行・JSON-LD（Article・店の ItemList・パンくず末尾）は
 * 「N選」「N店」「N軒」すべて、本文と FAQ は掲載数とわかる言い回し（STRONG）だけ。
 * 他の特集へのリンク文と JSON-LD の名前は、リンク先の掲載数に合わせる。
 * 自ページの掲載数が確かめられないときは自ページの表記に触らない。
 */
function syncPage(html, { self = null, counts = {}, dir = 'features' } = {}) {
  const log = [];
  const own = self && counts[self] != null ? counts[self] : null;
  let out = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
    (m, open, body, close) => open + syncJsonLd(body, own, counts, self, log) + close);
  const bodyAt = out.search(/<body\b/);
  let head = bodyAt < 0 ? out : out.slice(0, bodyAt);
  let body = bodyAt < 0 ? '' : out.slice(bodyAt);
  if (own != null) {
    head = head.replace(/(<title>)([^<]*)(<\/title>)/, (m, a, t, b) => a + relabelAll(t, own, log) + b);
    head = head.replace(/<meta\b[^>]*>/g, tag => {
      const key = (/\b(?:name|property)="([^"]+)"/.exec(tag) || [])[1];
      if (!HEAD_META.has(key)) return tag;
      return tag.replace(/(\bcontent=")([^"]*)(")/, (m, a, t, b) => a + relabelAll(t, own, log) + b);
    });
  }
  const keep = [];
  const hold = s => '' + (keep.push(s) - 1) + '';
  body = body.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, hold);
  body = body.replace(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/a>/g, a => {
    const open = /^<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/.exec(a)[0];
    const slug = featureSlugOf((/\bhref="([^"]*)"/.exec(open) || [])[1], dir);
    const n = slug == null ? null : slug === self ? own : counts[slug];
    if (n == null) return hold(a);
    return hold(open + mapText(a.slice(open.length, -4), t => relabelAll(t, n, log)) + '</a>');
  });
  if (own != null) {
    body = body.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/g, h => hold(mapText(h, t => relabelAll(t, own, log))));
    body = body.replace(/<(div|p) class="(?:art-meta|hero-meta)"[^>]*>[\s\S]*?<\/\1>/g, r => hold(mapText(r, t => relabelAll(t, own, log))));
    body = mapText(body, t => relabelStrong(t, own, log));
  }
  while (/\d+/.test(body)) body = body.replace(/(\d+)/g, (m, i) => keep[+i]);
  return { html: head + body, changes: log };
}

// features/ の全ページ（features/index.html を含む）。write=false なら書き換えずに変わるページを返す
function syncAll({ dir, write = false, only = null } = {}) {
  const d = dir || FEATURES_DIR;
  const counts = featureCounts(d);
  const changed = [];
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.html')).sort()) {
    if (only && !f.includes(only)) continue;
    const file = path.join(d, f);
    const html = fs.readFileSync(file, 'utf8');
    const self = f === 'index.html' ? null : f.replace(/\.html$/, '');
    const r = syncPage(html, { self, counts });
    if (r.html !== html) {
      changed.push({ file: f, changes: r.changes });
      if (write) fs.writeFileSync(file, r.html);
    }
  }
  return { counts, changed };
}

function inspectAll(dir) {
  const d = dir || FEATURES_DIR;
  const out = [];
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.html') && x !== 'index.html')) {
    const r = inspect(fs.readFileSync(path.join(d, f), 'utf8'));
    if (r.problems.length) out.push({ file: f, problems: r.problems });
  }
  return out;
}

module.exports = {
  h1Count, itemListInfo, cardCount, inspect, inspectAll,
  verifiedCount, featureCounts, featureSlugOf, relabelAll, relabelStrong, relabelForSlug, syncPage, syncAll,
};
