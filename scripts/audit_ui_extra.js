#!/usr/bin/env node
/**
 * audit_ui_extra.js — デザインの監査の「別の出力」（UI/UX 計画 段階2・Ondine #2411）
 *
 * scripts/audit_design_system.js は (a)〜(g) を見るが、明暗差・押せる大きさ・入力欄 16px・safe-area・100vh・
 * viewport-fit は見ない。そのスクリプトと data/design_system.json は変えず（CLAUDE.md 制約10）、
 * ここで静的に HTML・CSS を読んで数えるだけの別の出力を作る。合否は決めない（終了コードは常に 0。
 * 読めなかったときだけ 2）。(g) 動きの motion.enforce=false と同じく「数えるだけ」。
 *
 * 数える項目（rule）。判定できない所（var() が解けない・半透明の背景・グラデーション・片方しか無い など）は数えない:
 *   low-contrast          同じ規則の color と background(-color) が両方とも色として読め、WCAG 比が 4.5:1 未満
 *   tap-target-24 / -44   ボタン・リンク・入力欄らしいセレクタで、height/min-height が px で読め 24px・44px 未満
 *   input-font-16         input/select/textarea の font-size が px で読め 16px 未満（iOS の拡大）
 *   vh-100                height/min-height/max-height の 100vh（同じ規則に 100dvh/100svh/100lvh の指定があれば数えない）
 *   safe-area-bottom      position:fixed で bottom が 0〜16px の規則に、safe-area-inset-bottom の指定が無い
 *   safe-area-no-viewport-fit  ページ（<style> か nb.css）が env(safe-area-inset-*) を使うのに viewport-fit=cover が無い
 *   viewport-zoom-locked  viewport の user-scalable=no / maximum-scale<2
 * 目安の値の出どころ: WCAG 1.4.3（4.5:1）・2.5.5/2.5.8（44px・24px）・iOS Safari の入力欄 16px・
 *   /Users/katagirijakutou/orca/_uiux-audit/data2/C-devices.md 1 節（iOS の落とし穴）。
 *
 * 使い方:
 *   node scripts/audit_ui_extra.js [--root <dir>] [--sample N] [--file <html>...]
 *   出力: JSON { files_scanned, total, byRule, byFile, violations[ {file,rule,line,selector,detail} ] }
 *   --file を使うと、その HTML だけ（nb.css も含めない）。既定は audit_design_system.js と同じ範囲＋nb.css。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LISTED = 300;
const RULES = ['low-contrast', 'tap-target-24', 'tap-target-44', 'input-font-16', 'vh-100', 'safe-area-bottom', 'safe-area-no-viewport-fit', 'viewport-zoom-locked'];

const blank = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** CSS → [{selector, decls:[[prop,value]], line}]。@media 等は中身を展開し、@keyframes・@font-face は読まない */
function parseCss(css) {
  css = blank(css);
  const out = [];
  let i = 0;
  const lineAt = (pos) => css.slice(0, pos).split('\n').length;
  function block(end) {
    while (i < end) {
      const open = css.indexOf('{', i);
      if (open < 0 || open >= end) { i = end; return; }
      const head = css.slice(i, open).trim();
      const start = i;
      // 対応する } を探す
      let depth = 1, j = open + 1;
      while (j < end && depth > 0) { const c = css[j]; if (c === '{') depth++; else if (c === '}') depth--; j++; }
      const bodyEnd = depth === 0 ? j - 1 : j;
      if (/^@(media|supports|layer|container)/i.test(head)) {
        const save = i; i = open + 1; block(bodyEnd); i = save;
      } else if (!head.startsWith('@')) {
        const decls = [];
        for (const d of css.slice(open + 1, bodyEnd).split(';')) {
          const k = d.indexOf(':');
          if (k > 0) decls.push([d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()]);
        }
        out.push({ selector: head.replace(/\s+/g, ' '), decls, line: lineAt(start + (css.slice(start, open).length - css.slice(start, open).trimStart().length)) });
      }
      i = j;
    }
  }
  block(css.length);
  return out;
}

function tokensOf(rules) {
  const t = {};
  for (const r of rules) if (r.selector === ':root') for (const [p, v] of r.decls) if (p.startsWith('--')) t[p] = v;
  return t;
}

function resolve(v, tokens, depth) {
  depth = depth || 0;
  v = v.replace(/!important/i, '').trim();
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (m) return depth < 5 && tokens[m[1]] !== undefined ? resolve(tokens[m[1]], tokens, depth + 1) : null;
  return v;
}

function parseColor(v) {
  if (!v) return null;
  let m;
  if ((m = /^#([0-9a-f]{3})$/i.exec(v))) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  if ((m = /^#([0-9a-f]{6})$/i.exec(v))) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v))) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  if (/^white$/i.test(v)) return { r: 255, g: 255, b: 255, a: 1 };
  if (/^black$/i.test(v)) return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}
const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
function contrast(fg, bg) {
  const f = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
  const a = lum(f), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** px に直せる長さだけ返す（rem・em は 16px 換算。% や calc・clamp は null＝判定しない） */
function toPx(v, tokens) {
  v = resolve(v, tokens);
  if (!v) return null;
  let m;
  if ((m = /^(-?[\d.]+)px$/.exec(v))) return +m[1];
  if ((m = /^(-?[\d.]+)r?em$/.exec(v))) return +m[1] * 16;
  if (/^0$/.test(v)) return 0;
  return null;
}

const INTERACTIVE = /(^|[\s>+~,(])(button|a|input|select|textarea|summary)([.:#\[\s>+~,)]|$)|\.(btn|button|chip|tab|pill)\b|\[role=["']?button/i;
const FORM = /(^|[\s>+~,(])(input|select|textarea)([.:#\[\s>+~,)]|$)/i;

/** CSS 1本（nb.css か <style> の中身）を数える。ctx.tokens は nb.css の :root。 */
function auditCss(css, ctx) {
  const rules = parseCss(css);
  const tokens = Object.assign({}, ctx.tokens || {}, tokensOf(rules));
  const hasSafeBottomFor = new Set();
  for (const r of rules) if (r.decls.some(([, v]) => /safe-area-inset-bottom/.test(v))) hasSafeBottomFor.add(r.selector);
  const vs = [];
  const push = (r, rule, detail) => vs.push({ rule, line: r.line, selector: r.selector.slice(0, 80), detail });
  let usesSafeEnv = false;
  for (const r of rules) {
    const d = Object.fromEntries(r.decls);
    if (r.decls.some(([, v]) => /env\(\s*safe-area-inset/.test(v))) usesSafeEnv = true;
    // 明暗差
    const fgRaw = d.color, bgRaw = d['background-color'] || (d.background && !/gradient|url\(/i.test(d.background) && /^[#\w(),.\s%-]+$/.test(d.background) ? d.background : null);
    if (fgRaw && bgRaw && r.selector !== ':root' && !r.selector.includes('::selection')) {
      const fg = parseColor(resolve(fgRaw, tokens)), bg = parseColor(resolve(bgRaw, tokens));
      if (fg && bg && bg.a === 1) {
        const c = contrast(fg, bg);
        if (c < 4.5) push(r, 'low-contrast', `${c.toFixed(2)}:1（${fgRaw} on ${bgRaw}）`);
      }
    }
    // 押せる大きさ
    if (INTERACTIVE.test(r.selector) && !/:(disabled)/.test(r.selector)) {
      const hs = ['height', 'min-height'].map((p) => (d[p] !== undefined ? toPx(d[p], tokens) : null)).filter((x) => x !== null);
      if (hs.length) {
        const h = Math.max(...hs);
        if (h > 0 && h < 24) push(r, 'tap-target-24', `高さ ${h}px`);
        if (h > 0 && h < 44) push(r, 'tap-target-44', `高さ ${h}px`);
      }
    }
    // 入力欄の文字
    if (FORM.test(r.selector) && d['font-size'] !== undefined) {
      const px = toPx(d['font-size'], tokens);
      if (px !== null && px < 16) push(r, 'input-font-16', `font-size ${px}px`);
    }
    // 100vh
    for (const p of ['height', 'min-height', 'max-height']) {
      if (d[p] !== undefined && /(^|[^\d.])100vh\b/.test(d[p]) && !r.decls.some(([, v]) => /100[dsl]vh/.test(v))) push(r, 'vh-100', `${p}:${d[p]}`);
    }
    // 下に固定 + safe-area
    if (/^fixed$/i.test((d.position || '').trim()) && d.bottom !== undefined) {
      const b = toPx(d.bottom, tokens);
      if (b !== null && b >= 0 && b <= 16 && !r.decls.some(([, v]) => /safe-area-inset-bottom/.test(v)) && !hasSafeBottomFor.has(r.selector)) {
        push(r, 'safe-area-bottom', `bottom:${d.bottom}`);
      }
    }
  }
  return { violations: vs, usesSafeEnv };
}

/** HTML 1本。<style> と viewport を見る。tokens は nb.css の :root */
function auditHtml(html, ctx) {
  const vs = [];
  let usesSafeEnv = !!ctx.cssUsesSafeEnv;
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const m of styles) {
    const before = html.slice(0, m.index).split('\n').length - 1;
    const r = auditCss(m[1], ctx);
    if (r.usesSafeEnv) usesSafeEnv = true;
    for (const v of r.violations) vs.push(Object.assign({}, v, { line: v.line + before }));
  }
  const vp = /<meta\b[^>]*name=["']viewport["'][^>]*>/i.exec(html);
  if (vp) {
    const line = html.slice(0, vp.index).split('\n').length;
    const content = (/content=["']([^"']*)["']/i.exec(vp[0]) || [])[1] || '';
    if (usesSafeEnv && !/viewport-fit\s*=\s*cover/i.test(content)) vs.push({ rule: 'safe-area-no-viewport-fit', line, selector: 'meta viewport', detail: content });
    const mx = /maximum-scale\s*=\s*([\d.]+)/i.exec(content);
    if (/user-scalable\s*=\s*(no|0)/i.test(content) || (mx && +mx[1] < 2)) vs.push({ rule: 'viewport-zoom-locked', line, selector: 'meta viewport', detail: content });
  }
  return vs;
}

function summarize(vs) {
  const byRule = Object.fromEntries(RULES.map((r) => [r, 0]));
  const byFile = {};
  for (const v of vs) { byRule[v.rule]++; byFile[v.file] = (byFile[v.file] || 0) + 1; }
  const sorted = Object.fromEntries(Object.entries(byFile).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 50));
  return { byRule, byFile: sorted };
}

function listHtml(dir, recursive) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (recursive) out = out.concat(listHtml(p, true)); }
    else if (f.endsWith('.html') && !f.startsWith('_')) out.push(p);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const ri = args.indexOf('--root');
  const ROOT = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(__dirname, '..');
  const fi = args.indexOf('--file');
  const si = args.indexOf('--sample');
  const sampleN = si >= 0 ? parseInt(args[si + 1], 10) : null;
  const dsPath = path.join(ROOT, 'data/design_system.json');
  const cssRel = fs.existsSync(dsPath) ? (JSON.parse(fs.readFileSync(dsPath, 'utf8')).cssPath || 'assets/css/nb.css') : 'assets/css/nb.css';
  const cssFile = path.join(ROOT, cssRel);
  let nbCss = '';
  if (fs.existsSync(cssFile)) nbCss = fs.readFileSync(cssFile, 'utf8');
  const tokens = tokensOf(parseCss(nbCss));

  let files;
  const all = [];
  if (fi >= 0) {
    files = args.slice(fi + 1).filter((a) => !a.startsWith('--')).map((f) => path.resolve(f));
  } else {
    const rootFiles = ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html', '404.html'].map((f) => path.join(ROOT, f)).filter(fs.existsSync);
    let stores = listHtml(path.join(ROOT, 'stores'), false);
    if (sampleN) stores = stores.filter((_, i) => i % Math.max(1, Math.floor(stores.length / sampleN)) === 0).slice(0, sampleN);
    files = [...rootFiles, ...listHtml(path.join(ROOT, 'features'), false), ...listHtml(path.join(ROOT, 'journal'), false), ...stores, ...listHtml(path.join(ROOT, 'stores/area'), true)];
  }
  const cssRes = fi >= 0 ? { violations: [], usesSafeEnv: false } : auditCss(nbCss, { tokens });
  for (const v of cssRes.violations) all.push(Object.assign({ file: cssRel }, v));
  for (const f of files) {
    try {
      for (const v of auditHtml(fs.readFileSync(f, 'utf8'), { tokens, cssUsesSafeEnv: cssRes.usesSafeEnv })) all.push(Object.assign({ file: path.relative(ROOT, f) }, v));
    } catch (e) { process.stderr.write(`読めない: ${f}: ${e.message}\n`); process.exitCode = 2; }
  }
  const sum = summarize(all);
  console.log(JSON.stringify({ files_scanned: files.length + (fi >= 0 ? 0 : 1), total: all.length, byRule: sum.byRule, byFile: sum.byFile, violations: all.slice(0, MAX_LISTED), violations_truncated: Math.max(0, all.length - MAX_LISTED) }, null, 2));
}

if (require.main === module) main();
module.exports = { parseCss, auditCss, auditHtml, contrast, RULES };
