'use strict';

/**
 * scripts/lib/inline_js.js
 *
 * HTML に埋め込まれたインライン <script> の構文検査（決定的・コードは実行しない）。
 *
 * なぜ要るか（2026-10-09 発覚）:
 *   gen-store-pages.js のテンプレートリテラル内で正規表現 /^https?:\/\//i と書いていたため、
 *   生成物では `\/` が `/` に解決されて /^https?:///i になり、行の残りがコメント扱いになった。
 *   その <script> ブロック（GA4 の gtag('config') と outbound_click 計測を含む）は
 *   構文エラーで丸ごと実行されず、店舗ページ約5,000本の閲覧が 2026-05-08 から GA4 に
 *   一度も届いていなかった。CI には生成ページの JS 構文を見る検査が無く、5か月気づけなかった。
 *
 * 判定は「構文が通るか」という第三者が再現できる事実だけで行う（CLAUDE.md 制約10）。
 *   - JS（type 無し / text/javascript 等）: vm.Script でコンパイルのみ（実行しない）
 *   - JSON 系（application/ld+json 等）: JSON.parse
 *   - type="module" とその他の type（テンプレート等）: 検査対象外として数だけ数える
 *   - GA の読み込み（gtag/js?id=G-…）があるページは、同じIDの gtag('config',…) を含む
 *     インライン JS が構文OKであることを要求する（読み込みだけあって設定が死んでいる状態を検知）
 *
 * 利用者: scripts/audit_inline_js_syntax.js（全ページ監査CLI）、scripts/qa_gate.js（QA-4）、
 *         tests/inline_js_syntax.test.js
 */

const vm = require('vm');
const crypto = require('crypto');

const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript']);
const JSON_TYPES = new Set(['application/ld+json', 'application/json', 'importmap', 'speculationrules']);
const GA_LOADER_RE = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/i;

function scriptType(attrs) {
  const m = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || '');
  if (!m) return '';
  return String(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]).trim().toLowerCase();
}

function kindOf(type) {
  if (JS_TYPES.has(type)) return 'js';
  if (JSON_TYPES.has(type)) return 'json';
  if (type === 'module') return 'module';
  return 'other';
}

/** HTML から src を持たない <script> を抜き出す（ブラウザと同じく最初の </script で閉じる）。 */
function extractInlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  let lastIndex = 0;
  let line = 1;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    // 行番号は前回位置からの差分だけ数える（巨大な index.html でも線形）
    for (let i = lastIndex; i < m.index; i++) if (html.charCodeAt(i) === 10) line++;
    lastIndex = m.index;
    const type = scriptType(attrs);
    out.push({ kind: kindOf(type), type, code: m[2], line });
  }
  return out;
}

function hashOf(kind, code) {
  return kind + ':' + crypto.createHash('sha1').update(code).digest('hex');
}

/** 1ブロックの構文検査。エラーが無ければ null、あればメッセージ。cache は Map（同一内容の再検査を省く）。 */
function checkBlock(block, filename, cache) {
  if (block.kind !== 'js' && block.kind !== 'json') return null;
  const key = cache ? hashOf(block.kind, block.code) : null;
  if (cache && cache.has(key)) return cache.get(key);
  let err = null;
  if (block.kind === 'js') {
    try { new vm.Script(block.code, { filename: filename || 'inline.js' }); } catch (e) { err = e && e.message ? e.message : String(e); }
  } else {
    const src = block.code.trim();
    if (src) {
      try { JSON.parse(src); } catch (e) { err = e && e.message ? e.message : String(e); }
    }
  }
  if (cache) cache.set(key, err);
  return err;
}

function gaConfigPresent(code, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`gtag\\(\\s*['"]config['"]\\s*,\\s*['"]${esc}['"]`).test(code);
}

/**
 * 1ページ分の監査。
 * @returns {{file, blocks, checked, skipped, violations: Array<{file, line, rule, detail}>}}
 *   rule: 'js-syntax' | 'json-syntax' | 'ga-config-broken'
 */
function auditHtml(html, opts) {
  opts = opts || {};
  const file = opts.filename || 'inline.html';
  const cache = opts.cache || null;
  const blocks = extractInlineScripts(html);
  const violations = [];
  let checked = 0;
  let skipped = 0;
  const okJs = [];
  for (const b of blocks) {
    if (b.kind !== 'js' && b.kind !== 'json') { skipped++; continue; }
    checked++;
    const err = checkBlock(b, file, cache);
    if (err) {
      violations.push({ file, line: b.line, rule: b.kind === 'js' ? 'js-syntax' : 'json-syntax', detail: err });
    } else if (b.kind === 'js') {
      okJs.push(b);
    }
  }
  const loader = GA_LOADER_RE.exec(html);
  if (loader) {
    const id = loader[1];
    if (!okJs.some(b => gaConfigPresent(b.code, id))) {
      violations.push({
        file,
        line: null,
        rule: 'ga-config-broken',
        detail: `gtag.js（${id}）を読み込んでいるが、gtag('config','${id}') を含む構文OKのインラインJSが無い（計測が動かない）`,
      });
    }
  }
  return { file, blocks: blocks.length, checked, skipped, violations };
}

module.exports = { extractInlineScripts, checkBlock, auditHtml, scriptType, kindOf };
