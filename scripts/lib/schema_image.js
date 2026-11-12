'use strict';
/**
 * 日次(BlogPosting)・特集(Article)の JSON-LD の image を、そのページの og:image から決める部品（項目20）。
 *
 * 決まり（CLAUDE.md の写真の優先順・判断記録 0045）:
 *  - og:image が、サイトのアイコン(/icons/)以外のときだけ image に入れる（無い画像を作らない）
 *  - Google Places の写真 URL は失効するので入れない
 *  - すでに image があるページは触らない（冪等）
 * 生成元（scripts/generate_daily_draft.js）と、既存ページへの反映（scripts/apply_schema_image.js・
 * 日次の build.yml）が、この1本を共有する。
 */

const ARTICLE_TYPE_RE = /"@type"\s*:\s*"(?:BlogPosting|Article)"/;
const LD_RE = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g;

/** JSON-LD に入れてよい画像 URL か。入れられなければ null を返す */
function usableImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim().replace(/&amp;/g, '&');
  if (!/^https?:\/\//i.test(u)) return null;
  if (/\/icons\//.test(u)) return null; // サイトのアイコン
  if (/googleusercontent\.com|maps\.googleapis\.com|places\.googleapis\.com/i.test(u)) return null; // Places は失効する
  if (/\{\{/.test(u)) return null;
  return u;
}

function ogImageOf(html) {
  const m = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/);
  return m ? m[1] : null;
}

/** 生成用: 日次テンプレートの {{LD_IMAGE_URL}} に入れる URL（JSON 文字列の中身。使えなければ空文字） */
function jsonLdImageUrl(ogUrl) {
  const u = usableImageUrl(ogUrl);
  return u ? u.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
}

/** 生成用: 画像が空の image 行を外す */
function dropEmptyImageLine(html) {
  return html.replace(/^[ \t]*"image":\s*"",?\n/m, '');
}

/**
 * 既存ページ用: Article/BlogPosting ブロックに image が無く、og:image が使えるときだけ足す。
 * 戻り値 { html, changed }
 */
function addImage(html) {
  const u = usableImageUrl(ogImageOf(html));
  if (!u) return { html, changed: false };
  let changed = false;
  const out = html.replace(LD_RE, (all, open, body, close) => {
    if (changed || !ARTICLE_TYPE_RE.test(body) || /"image"\s*:/.test(body)) return all;
    const re = /(\n?)([ \t]*)("datePublished")(\s*:\s*)/;
    if (!re.test(body)) return all;
    const nb = body.replace(re, (m, nl, ind, key, sep) => {
      const kv = `"image"${sep}${JSON.stringify(u)},`;
      return `${nl}${ind}${kv}${nl}${ind}${key}${sep}`;
    });
    try { JSON.parse(nb); } catch (e) { return all; }
    changed = true;
    return open + nb + close;
  });
  return { html: out, changed };
}

module.exports = { usableImageUrl, ogImageOf, jsonLdImageUrl, dropEmptyImageLine, addImage };
