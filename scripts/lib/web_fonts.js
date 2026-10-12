'use strict';

/**
 * Web フォントを使わないことの判定と書き換えの唯一の情報源（P-318・判断の記録 0026）。
 *
 * サイトは Web フォント（Google Fonts の Cormorant Garamond / Shippori Mincho / Noto Sans JP / DM Mono）を
 * やめ、端末にある書体だけを nb.css のトークン（--font-display / --font-body / --font-mono）で指す。
 * このファイルは次の 3 か所が同じ判定を共有するための部品:
 *   - scripts/apply_design_system.js   既存ページから Web フォントの <link> を外し、直書きの書体名をトークンへ書き換える
 *   - scripts/audit_design_system.js   <link> の残りと、<style> の書体名の直書きを違反として数える
 *   - tests/design_system_fonts.test.js 生成器・トークンが Web フォントを書き戻さないことを見る
 * 配信元の名前と退役した書体の名前の正本は data/design_system.json の webFonts（閾値と同じく、変更はそちらで行う）。
 *
 * 端末の書体の並び（DEVICE_STACKS）は assets/css/nb.css のトークンと同じ値で、tests/design_system_fonts.test.js が
 * 一致を見る。nb.css を読み込まない古い単独ページ（孤児ページ）にだけ、トークンの代わりに直接書く。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** nb.css の --font-display / --font-body / --font-mono と同じ値（端末にある書体だけ・Web フォントは含まない） */
const DEVICE_STACKS = {
  display: "'Hiragino Mincho ProN','Hiragino Mincho Pro','Yu Mincho','YuMincho','Noto Serif CJK JP','MS PMincho',serif",
  body: "'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans CJK JP','Yu Gothic','YuGothic','Meiryo',sans-serif",
  mono: "ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace",
};

function loadWebFontsPolicy(root) {
  const p = path.join(root || ROOT, 'data', 'design_system.json');
  const ds = JSON.parse(fs.readFileSync(p, 'utf8'));
  const wf = ds.webFonts || {};
  return {
    allowed: wf.allowed === true,
    forbiddenHosts: wf.forbiddenHosts || ['fonts.googleapis.com', 'fonts.gstatic.com'],
    retiredFamilies: wf.retiredFamilies || ['Cormorant Garamond', 'Shippori Mincho', 'Noto Sans JP', 'DM Mono'],
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 配信元（fonts.googleapis.com など）を href に持つ <link> タグ。行の前後の空白と改行も一緒に拾う */
function webFontLinkRe(hosts) {
  const alt = hosts.map(escapeRe).join('|');
  return new RegExp('[ \\t]*<link\\b[^>]*\\bhref=["\']?(?:https?:)?//(?:' + alt + ')[^>]*>[ \\t]*(?:\\r?\\n)?', 'gi');
}

/** Web フォントの <link>（preconnect・スタイルシート）を外す。外したら changed:true */
function removeWebFontLinks(html, hosts) {
  const re = webFontLinkRe(hosts || loadWebFontsPolicy().forbiddenHosts);
  const out = html.replace(re, '');
  return { html: out, changed: out !== html };
}

/**
 * 直書きの書体名を書き換える規則（長い並びを先に）。
 *   'Cormorant Garamond','Noto Sans JP',serif  見出しだが日本語はゴシックで出ていた 7 か所 → 本文の書体（今の見た目を保つ）
 *   'Cormorant Garamond',serif                 見出し → 明朝
 *   'Noto Sans JP',sans-serif                  本文 → ゴシック
 *   'DM Mono',monospace                        数字・記号・欧文 → 等幅
 */
const LITERAL_RULES = [
  { re: /font-family:\s*'Cormorant Garamond'\s*,\s*'Noto Sans JP'\s*,\s*serif/g, token: 'body' },
  { re: /font-family:\s*'Cormorant Garamond'\s*,\s*serif/g, token: 'display' },
  { re: /font-family:\s*'Noto Sans JP'\s*,\s*sans-serif/g, token: 'body' },
  { re: /font-family:\s*'DM Mono'\s*,\s*monospace/g, token: 'mono' },
];

/**
 * 直書きの書体名を、トークン参照（nb.css を読み込むページ）か端末の書体の並び（読み込まない古い単独ページ）へ。
 * @param {string} html
 * @param {{ useTokens?: boolean }} [opts] useTokens=false のとき DEVICE_STACKS を直接書く
 */
function rewriteFamilyLiterals(html, opts) {
  const useTokens = !opts || opts.useTokens !== false;
  let out = html;
  for (const { re, token } of LITERAL_RULES) {
    out = out.replace(re, useTokens ? `font-family:var(--font-${token})` : `font-family:${DEVICE_STACKS[token]}`);
  }
  return { html: out, changed: out !== html };
}

/** nb.css（正本の CSS）を読み込んでいるページか */
function loadsNbCss(html) {
  return /<link[^>]+href=["'][^"']*assets\/css\/nb\.css["']/i.test(html);
}

/** <style>…</style> の中身を取り出す（属性つきの開きタグも拾う） */
function styleBlocks(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
}

/** style="…" 属性の値 */
function styleAttrs(html) {
  const body = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  return [...body.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)].map((m) => m[2]);
}

/**
 * Web フォントの使用を数える。違反の種類:
 *   webfont-link      配信元を指す <link>（preconnect・スタイルシート・preload のどれも）
 *   webfont-import    <style> の @import で配信元を読む
 *   retired-family    <style> と style 属性の font-family / font に、退役した書体名が残っている
 * 検査するのは CSS の文脈だけ（本文の文字や店名に同じ語が出ても数えない）。
 */
function findViolations(html, policy) {
  const ws = policy || loadWebFontsPolicy();
  const out = [];
  const linkRe = webFontLinkRe(ws.forbiddenHosts);
  const links = html.match(linkRe) || [];
  for (const l of links) out.push({ rule: 'webfont-link', detail: l.trim().slice(0, 120) });

  const hostAlt = ws.forbiddenHosts.map(escapeRe).join('|');
  const importRe = new RegExp('@import[^;]*(?:' + hostAlt + ')', 'i');
  const famAlt = ws.retiredFamilies.map(escapeRe).join('|');
  const famDeclRe = new RegExp('font(?:-family)?\\s*:[^;}]*(?:' + famAlt + ')', 'i');

  const css = styleBlocks(html);
  for (const block of css) {
    const clean = block.replace(/\/\*[\s\S]*?\*\//g, '');
    if (importRe.test(clean)) out.push({ rule: 'webfont-import', detail: '@import of a Web font host' });
    const seen = new Set();
    for (const m of clean.matchAll(new RegExp('font(?:-family)?\\s*:[^;}]*(?:' + famAlt + ')[^;}]*', 'gi'))) {
      const d = m[0].replace(/\s+/g, ' ').trim().slice(0, 100);
      if (seen.has(d)) continue;
      seen.add(d);
      out.push({ rule: 'retired-family', detail: d });
    }
  }
  for (const v of styleAttrs(html)) {
    if (famDeclRe.test(v)) out.push({ rule: 'retired-family', detail: 'style="' + v.replace(/\s+/g, ' ').slice(0, 90) + '"' });
  }
  return out;
}

module.exports = {
  DEVICE_STACKS,
  LITERAL_RULES,
  loadWebFontsPolicy,
  removeWebFontLinks,
  rewriteFamilyLiterals,
  loadsNbCss,
  styleBlocks,
  styleAttrs,
  findViolations,
};
