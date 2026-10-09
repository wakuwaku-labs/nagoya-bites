'use strict';
/**
 * scripts/lib/page_store_links.js
 *
 * 特集（features/）とジャーナル（journal/）の HTML に手で書かれた食べログ・ホットペッパーの店舗リンクが、
 * 別の店を指していないかを判定する（ISSUE-156）。
 *
 * リンクの照合（scripts/audit_store_link_identity.js）は店舗データ（manual_stores.json・stores.json）の
 * URL だけを見ていた。2026-09-03 に別の店と判定して店舗データから外した URL が、特集とジャーナルの HTML では
 * 2026-10-09 まで表示され続けた（ISSUE-155: 顔合わせ特集の「うなぎのしろむら」→ 栄の居酒屋 等の8件）。
 *
 * 判定は照合キャッシュ（data/store_link_identity_checked.json）の事実だけで行う（制約10）。
 * ここでは外部へ問い合わせない。ある URL について、キャッシュの判定が1件以上あり、そのすべてが
 * 「別の店」（name-mismatch で sim=0＝題名に我々の店名の痕跡が無い、または confirmed-404）のときだけ数える。
 *   - sim>0 の name-mismatch は数えない（ふりがな併記・ホットペッパーの題名の付け足しなど、同じ店のことが多い）
 *   - fetch-error・closed（同じ店が閉店）・キャッシュに無い URL は数えない（判定できない／別の店ではない）
 *   - どれか1件でも一致（ok）があれば数えない（ほかの店名では正しいページ。ページ側の使い方は正しいことがある）
 */

const fs = require('fs');
const path = require('path');

// 食べログ: https://tabelog.com/<県>/A<数字>/A<数字>/<店ID>/（以下の dtlmenu/ などは店の根に寄せる）
const TABELOG_RE = /https?:\/\/(?:s\.)?tabelog\.com\/([a-z]+)\/(A\d+)\/(A\d+)\/(\d+)/i;
// ホットペッパー: https://www.hotpepper.jp/strJ<数字>/
const HOTPEPPER_RE = /https?:\/\/(?:www\.)?hotpepper\.jp\/(strJ\d+)/i;

/** 店舗ページの URL を照合キャッシュと同じ形にそろえる。店舗ページでなければ null */
function normalizeStoreUrl(url) {
  const s = String(url || '');
  let m = s.match(TABELOG_RE);
  if (m) return `https://tabelog.com/${m[1].toLowerCase()}/${m[2]}/${m[3]}/${m[4]}/`;
  m = s.match(HOTPEPPER_RE);
  if (m) return `https://www.hotpepper.jp/${m[1]}/`;
  return null;
}

/** HTML の href から店舗ページの URL を集める（重複は1つにまとめる） */
function extractStoreLinks(html) {
  const out = new Set();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const u = normalizeStoreUrl(m[1]);
    if (u) out.add(u);
  }
  return [...out];
}

/** 照合キャッシュを URL ごとの判定の一覧にする */
function buildVerdictIndex(checked) {
  const index = new Map();
  for (const v of Object.values(checked || {})) {
    if (!v || !v.url) continue;
    const u = normalizeStoreUrl(v.url);
    if (!u) continue;
    if (!index.has(u)) index.set(u, []);
    index.get(u).push(v);
  }
  return index;
}

function isWrongStoreVerdict(v) {
  if (!v || v.ok !== false) return false;
  if (v.reason === 'confirmed-404') return true;
  return v.reason === 'name-mismatch' && v.sim === 0;
}

/** その URL を「別の店」と数えるか（判定が1件以上あり、すべてが別の店） */
function isWrongStoreUrl(verdicts) {
  return Array.isArray(verdicts) && verdicts.length > 0 && verdicts.every(isWrongStoreVerdict);
}

/**
 * ページ群を監査する。pages: [{ file, html }]。戻り値: [{ file, url, storeNames, matchedName, title, reason }]
 */
function auditPages(pages, index) {
  const findings = [];
  for (const { file, html } of pages) {
    for (const url of extractStoreLinks(html)) {
      const verdicts = index.get(url);
      if (!isWrongStoreUrl(verdicts)) continue;
      findings.push({
        file,
        url,
        storeNames: [...new Set(verdicts.map((v) => v.storeName).filter(Boolean))],
        matchedName: verdicts.map((v) => v.matchedName).find(Boolean) || '',
        title: verdicts.map((v) => v.title).find(Boolean) || '',
        reason: verdicts[0].reason,
      });
    }
  }
  return findings;
}

/** 公開ページの一覧（features/・journal/ 直下の .html。テンプレート _*.html は除く） */
function listPages(root, only) {
  const dirs = only ? [only] : ['features', 'journal'];
  const out = [];
  for (const d of dirs) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith('.html') || f.startsWith('_')) continue;
      out.push(path.join(d, f));
    }
  }
  return out;
}

module.exports = { normalizeStoreUrl, extractStoreLinks, buildVerdictIndex, isWrongStoreVerdict, isWrongStoreUrl, auditPages, listPages };
