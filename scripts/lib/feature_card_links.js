'use strict';

/**
 * scripts/lib/feature_card_links.js
 *
 * 特集の店カードと店舗ページ（stores/*.html）のひも付けの正本（特集→店舗のリンク漏れと、
 * 店一覧の構造化データ ItemList の url 欠けを直す）。
 * 使う側: scripts/link_feature_store_cards.js（既存の特集へ反映する冪等な変換）、
 * scripts/refresh_feature_rosters.js（月次の入れ替えで ItemList を書き直すときの tolerant な置換）。
 *
 * 決まり（推測で別の店に結びつけない）:
 *   - 店カードの店名は、scripts/lib/feature_store_match.js の buildResolver（ゆるい照合）では決めない。
 *     ゆるい照合は「旬彩」と「日本料理 旬彩」のような別の店を取り違える。
 *     ここでは「正規化した店名が完全一致」か「カードの店名が、ある1店の店名の先頭と一致し、その1店しか無い」ときだけ結ぶ
 *     （例: 「炉端焼き 燻銀 伏見店」→「炉端焼き燻銀 伏見店にかい」。同じ看板の別支店は先頭が違うので結ばれない）。
 *   - 結んだ先の stores/<slug>.html が実在し、誘導ページ（isRedirectStub）でないときだけ使う。
 *   - 結べないカードは何もしない（新店などで店舗ページが無い店に無理にリンクしない）。
 * 通信しない。入力は features/*.html・data/stores.json・stores/*.html だけ。
 */

const fs = require('fs');
const path = require('path');
const { norm } = require('./feature_store_match');
const { isRedirectStub } = require('./store_orphans');
const { featureStoreOnclick } = require('./feature_tracking');

const SITE = 'https://nagoya-bites.com';
const CARD_OPEN_RE = /<div class="(store-card|shop-card)">/g;

/** gen-store-pages.js・build_features.js の toSlug と同じ（店舗ページのファイル名） */
function storeSlug(store) {
  if (store['ホットペッパーID']) return store['ホットペッパーID'];
  if (store['英語名']) {
    return store['英語名'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  const ascii = (store['店名'] || '').replace(/[^\x00-\x7F]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii.length >= 3) return ascii;
  return 'store-' + Buffer.from(store['店名'] || '', 'utf8').toString('hex').slice(0, 16);
}

/** open の位置から、同じ深さで閉じる </div> の直後の位置（無ければ -1） */
function divEnd(html, openIdx) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = openIdx;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else depth++;
  }
  return -1;
}

const unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** 特集 HTML の店カード（store-card / shop-card）を位置つきで列挙する */
function listCards(html) {
  const cards = [];
  CARD_OPEN_RE.lastIndex = 0;
  let m;
  while ((m = CARD_OPEN_RE.exec(html))) {
    const start = m.index;
    const end = divEnd(html, start);
    if (end < 0) continue;
    const block = html.slice(start, end);
    const nm = block.match(/class="(?:shop-name|store-name)"[^>]*>(?:<a[^>]*>)?([^<]+)/);
    if (!nm) continue;
    const link = block.match(/href="(?:\.\.\/|https:\/\/nagoya-bites\.com\/|\/)?stores\/([^"#?/]+)\.html"/);
    cards.push({ kind: m[1], start, end, block, name: unesc(nm[1].trim()), linkedSlug: link ? link[1] : null });
    CARD_OPEN_RE.lastIndex = end;
  }
  return cards;
}

/** 店舗データから、カードの店名を1店に結ぶ関数を作る（完全一致、または先頭一致で1店だけ） */
function buildStrictResolver(stores) {
  const byNorm = new Map();
  for (const s of stores) {
    const k = norm(s['店名']);
    if (!k) continue;
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(s);
  }
  const entries = [...byNorm.entries()];
  return function resolve(name) {
    const k = norm(name);
    if (!k) return null;
    const exact = byNorm.get(k);
    if (exact) return exact.length === 1 ? exact[0] : null;
    if (k.length < 6) return null;
    const cands = [];
    for (const [sk, list] of entries) {
      if (sk.startsWith(k)) cands.push(...list);
    }
    return cands.length === 1 ? cands[0] : null;
  };
}

/** 店舗ページが実在し、誘導ページでないか */
function livePage(root, slug) {
  const f = path.join(root, 'stores', `${slug}.html`);
  if (!fs.existsSync(f)) return false;
  return !isRedirectStub(fs.readFileSync(f, 'utf8'));
}

/**
 * リンクの無い店カードに「詳細ページを見る」を足す（冪等）。
 * @returns {{html:string, added:Array<{name:string,slug:string}>, skipped:Array<{name:string,reason:string}>}}
 */
function linkCards(html, featureSlug, ctx) {
  const cards = listCards(html);
  const edits = [];
  const added = [];
  const skipped = [];
  for (const c of cards) {
    if (c.linkedSlug) continue;
    const store = ctx.resolve(c.name);
    if (!store) { skipped.push({ name: c.name, reason: 'no-confident-match' }); continue; }
    const slug = storeSlug(store);
    if (!livePage(ctx.root, slug)) { skipped.push({ name: c.name, reason: 'no-live-page' }); continue; }
    const track = /^J\d+$/.test(slug) ? ` onclick="${featureStoreOnclick(slug, featureSlug)}"` : '';
    let anchor;
    let at;
    if (c.kind === 'store-card') {
      // store-info の閉じる直前に置く（予約ボタンの無いカードでも、既にあるページの .store-link の見た目に合う）
      const infoOpen = c.block.indexOf('<div class="store-info">');
      if (infoOpen < 0) { skipped.push({ name: c.name, reason: 'no-store-info' }); continue; }
      const infoEnd = divEnd(c.block, infoOpen);
      at = c.start + infoEnd - '</div>'.length;
      anchor = `          <a class="store-link store-link-internal" href="${SITE}/stores/${slug}.html"${track}>詳細ページを見る</a>\n        `;
    } else {
      at = c.end - '</div>'.length;
      anchor = `    <a href="../stores/${slug}.html" class="shop-detail-link"${track}>詳細ページを見る</a>\n    `;
    }
    // 直前の空白（インデント）を保って挿入位置を行頭にそろえる
    const lineStart = html.lastIndexOf('\n', at) + 1;
    edits.push({ at: lineStart, text: anchor.replace(/\n {4,8}$/, '\n') });
    added.push({ name: c.name, slug });
  }
  let out = html;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return { html: out, added, skipped };
}

/** ItemList の script ブロック（JSON-LD）を列挙する */
function listItemListBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (!/"@type"\s*:\s*"ItemList"/.test(m[1])) continue;
    const bodyStart = m.index + m[0].indexOf(m[1]);
    out.push({ start: bodyStart, end: bodyStart + m[1].length, body: m[1] });
  }
  return out;
}

/**
 * ItemList の url の無い項目に、同じページの店カードのリンク先を入れる（冪等）。
 * 項目とカードは「店名が完全一致」か「項目の名前がカードの店名＋区切りで始まる」ときだけ結ぶ。
 * 結べない項目は url を付けない（位置だけで結ばない）。
 */
function addItemListUrls(html, ctx) {
  const cards = listCards(html);
  const byName = new Map();
  for (const c of cards) {
    const slug = c.linkedSlug;
    if (!slug || !livePage(ctx.root, slug)) continue;
    const k = norm(c.name);
    if (!byName.has(k)) byName.set(k, slug);
  }
  const blocks = listItemListBlocks(html);
  const added = [];
  const skipped = [];
  let out = html;
  for (const b of blocks.slice().reverse()) {
    const re = /("@type"\s*:\s*"ListItem"[^{}]*?"name"\s*:\s*")((?:[^"\\]|\\.)*)(")(\s*)(\})/g;
    const body = b.body.replace(re, (all, head, rawName, q, sp, close) => {
      if (/"url"\s*:/.test(all)) return all;
      const name = JSON.parse('"' + rawName + '"');
      const k = norm(name);
      let slug = byName.get(k);
      if (!slug) {
        // 「COFFEE KAJITA（覚王山）— スペシャルティ」のように、店名の後ろに区切りで補足が付く形
        const hits = [...byName.entries()].filter(([ck]) => ck.length >= 2 && k.startsWith(ck) && /^[(—–\-・/]/.test(restAfter(name, ck)));
        if (hits.length === 1) slug = hits[0][1];
      }
      if (!slug) { skipped.push(name); return all; }
      const spaced = /"@type":\s+"ListItem"/.test(all);
      added.push({ name, slug });
      return `${head}${rawName}${q},${spaced ? ' ' : ''}"url"${spaced ? ': ' : ':'}"${SITE}/stores/${slug}.html"${sp}${close}`;
    });
    out = out.slice(0, b.start) + body + out.slice(b.end);
  }
  return { html: out, added, skipped };
}

// name を NFKC・空白除去・小文字にしたとき、先頭 ckey 文字（正規化済み）の後ろに残る文字列を返す
function restAfter(name, ckey) {
  const n = norm(name);
  return n.startsWith(ckey) ? n.slice(ckey.length) : '';
}

/**
 * 店カードが全部リンク済みなのに ItemList の項目と結べないとき（月次の入れ替えで店カードだけ変わり、
 * ItemList が古い店のまま残った特集）、ItemList の項目を店カードから作り直す。
 * 載せるのは、画面に出ている店と、そのリンク先の実在する店舗ページだけ。
 */
function rebuildItemListFromCards(html, ctx) {
  const cards = listCards(html);
  if (!cards.length || !cards.every((c) => c.linkedSlug && livePage(ctx.root, c.linkedSlug))) return { html, rebuilt: false };
  const items = cards.map((c, i) => `{"@type":"ListItem","position":${i + 1},"name":${JSON.stringify(c.name)},"url":"${SITE}/stores/${c.linkedSlug}.html"}`).join(',');
  const next = replaceItemListElements(html, items, cards.length);
  return { html: next, rebuilt: next !== html };
}

/** ItemList の itemListElement を差し替える（空白・改行の入った書き方も扱う。numberOfItems も合わせる） */
function replaceItemListElements(html, itemsText, count) {
  const re = /(\{\s*"@context"\s*:\s*"https:\/\/schema\.org"\s*,\s*"@type"\s*:\s*"ItemList"[^]*?"itemListElement"\s*:\s*)\[[^]*?\](\s*\})/;
  if (!re.test(html)) return html;
  return html.replace(re, (full, head, tail) => `${head.replace(/("numberOfItems"\s*:\s*)\d+/, `$1${count}`)}[${itemsText}]${tail}`);
}

module.exports = { rebuildItemListFromCards, replaceItemListElements, storeSlug, divEnd, listCards, buildStrictResolver, livePage, linkCards, addItemListUrls, listItemListBlocks, SITE };
