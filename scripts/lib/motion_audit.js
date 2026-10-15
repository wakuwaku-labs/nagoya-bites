'use strict';

/**
 * 動き（モーション）の決まりの判定器（動きの計画 5.3 節・段階 0）。唯一の情報源。
 *
 * 純関数だけ。ファイルを読まず、通信もしない。CSS / JS / HTML の文字列を受けて違反の配列を返す。
 * 閾値・例外・禁止プロパティは data/design_system.json の `motion` の節が正本で、ここには書かない
 * （CLAUDE.md 制約10・scripts/lib/web_fonts.js と同じ型）。
 *
 * 検査 5 つ:
 *   transition-all      transition: all / transition-property: all
 *   motion-duration     transition / animation の時間が maxDurationMs を超える（var(--dur-*) は時間として読まない）
 *   motion-infinite     infinite（animation / animation-iteration-count）
 *   motion-layout-prop  transition で禁止プロパティを動かす／@keyframes の中で禁止プロパティを変える
 *   smooth-scroll-js    JS の behavior:'smooth' で、同じ行に nbScrollBehavior( が無いもの
 *
 * @media (prefers-reduced-motion: reduce) の中の規則は数えない（止めるための規則だから）。
 * 違反: { rule, file, line, selector, excerpt }
 */

const RULES = ['transition-all', 'motion-duration', 'motion-infinite', 'motion-layout-prop', 'smooth-scroll-js'];

function loadMotionPolicy(root) {
  const fs = require('fs');
  const path = require('path');
  const ds = JSON.parse(fs.readFileSync(path.join(root, 'data', 'design_system.json'), 'utf8'));
  return ds.motion || null;
}

/** コメントを同じ長さの空白（改行は残す）に置き換える。行番号がずれない。 */
function blankComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * CSS を宣言の列に平らにする。入れ子の @media / @supports は透過し、@keyframes は印を付ける。
 * @returns {{selector:string, prop:string, value:string, line:number, reduced:boolean, keyframes:boolean}[]}
 */
function parseDeclarations(css) {
  const src = blankComments(css);
  const out = [];
  let i = 0;
  let line = 1;

  function parseBlock(ctx) {
    let buf = '';
    let bufLine = line;
    let paren = 0;
    let quote = null;
    const flush = () => {
      const t = buf.trim();
      buf = '';
      if (!t) return;
      const c = t.indexOf(':');
      if (c <= 0) return;
      const prop = t.slice(0, c).trim().toLowerCase();
      if (!/^-?[a-z-]+$/.test(prop) && !/^--/.test(prop)) return;
      out.push({ selector: ctx.selector, prop, value: t.slice(c + 1).trim(), line: bufLine, reduced: ctx.reduced, keyframes: ctx.keyframes });
    };
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\n') line++;
      if (quote) {
        buf += ch; i++;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; buf += ch; i++; continue; }
      if (ch === '(') paren++;
      if (ch === ')') paren = Math.max(0, paren - 1);
      if (paren === 0 && ch === ';') { i++; flush(); bufLine = line; continue; }
      if (paren === 0 && ch === '{') {
        const prelude = buf.replace(/\s+/g, ' ').trim();
        i++;
        const child = { selector: ctx.selector, reduced: ctx.reduced, keyframes: ctx.keyframes };
        if (prelude.startsWith('@')) {
          if (/^@(-\w+-)?keyframes/i.test(prelude)) { child.keyframes = true; child.selector = prelude; }
          else if (/^@media/i.test(prelude) && /prefers-reduced-motion\s*:\s*reduce/i.test(prelude)) child.reduced = true;
          // @media / @supports / @layer などの入れ子は、選択子を引き継いで中を読む
        } else if (ctx.keyframes) {
          child.selector = ctx.selector + ' ' + prelude;
        } else {
          child.selector = prelude;
        }
        buf = '';
        parseBlock(child);
        bufLine = line;
        continue;
      }
      if (paren === 0 && ch === '}') { i++; flush(); return; }
      if (buf.trim() === '') bufLine = line;
      buf += ch; i++;
    }
    flush();
  }

  parseBlock({ selector: '', reduced: false, keyframes: false });
  return out;
}

const stripVendor = (p) => p.replace(/^-(webkit|moz|ms|o)-/, '');

/** 括弧の外のカンマで分ける。 */
function splitTopLevel(v, sep) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of v) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** 括弧の外の空白で分ける（cubic-bezier(.2, 0, 0, 1) は 1 語）。 */
function tokens(v) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of v) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const TIME_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))(ms|s)$/i;
function toMs(tok) {
  const m = TIME_RE.exec(tok);
  if (!m) return null;
  return parseFloat(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1);
}

const TIMING_KEYWORDS = new Set(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end']);
const ANIM_KEYWORDS = new Set(['infinite', 'normal', 'reverse', 'alternate', 'alternate-reverse', 'none', 'forwards', 'backwards', 'both', 'running', 'paused']);

function isTimingToken(t) {
  return TIMING_KEYWORDS.has(t) || /^(cubic-bezier|steps|linear)\(/i.test(t);
}

/** 禁止プロパティか。一覧には末尾 * のワイルドカード（margin*）が使える。 */
function isForbiddenProp(prop, forbidden) {
  const p = stripVendor(prop.toLowerCase());
  return forbidden.some((f) => {
    const g = f.toLowerCase();
    return g.endsWith('*') ? p.startsWith(g.slice(0, -1)) : p === g;
  });
}

function selectorAllowed(selector, list) {
  if (!list || !list.length) return false;
  return list.some((sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(esc + '(?![\\w-])').test(selector);
  });
}

function excerptOf(d) {
  return (d.prop + ':' + d.value).replace(/\s+/g, ' ').slice(0, 120);
}

/**
 * CSS の文字列を検査する。
 * @param {string} css
 * @param {object} policy data/design_system.json の motion
 * @param {{file?:string, lineOffset?:number}} [opts] lineOffset は <style> が始まる前の行数
 */
function auditCss(css, policy, opts) {
  opts = opts || {};
  const file = opts.file || '';
  const off = opts.lineOffset || 0;
  const maxMs = policy.maxDurationMs;
  const forbidden = policy.forbiddenProperties || [];
  const durAllow = (policy.durationAllowlist && policy.durationAllowlist.selectors) || [];
  const infAllow = (policy.infiniteAllowlist && policy.infiniteAllowlist.selectors) || [];
  const violations = [];
  const add = (rule, d) => violations.push({ rule, file, line: d.line + off, selector: d.selector, excerpt: excerptOf(d) });

  for (const d of parseDeclarations(css)) {
    if (d.reduced) continue;
    const prop = stripVendor(d.prop);
    const isTransition = prop === 'transition' || prop === 'transition-property' || prop === 'transition-duration' || prop === 'transition-delay';
    const isAnimation = prop === 'animation' || prop === 'animation-duration' || prop === 'animation-iteration-count';

    // keyframes の中: 禁止プロパティを変えているか
    if (d.keyframes) {
      if (isForbiddenProp(prop, forbidden)) add('motion-layout-prop', d);
      continue;
    }
    if (!isTransition && !isAnimation) continue;

    if (prop === 'transition' || prop === 'transition-property') {
      const seen = {};
      for (const item of splitTopLevel(d.value, ',')) {
        const toks = tokens(item);
        let name = null;
        if (prop === 'transition-property') name = toks[0];
        else name = toks.find((t) => toMs(t) === null && !isTimingToken(t) && !/^var\(/i.test(t) && !/^(none|initial|inherit|unset)$/i.test(t));
        if (!name) continue;
        const lower = name.toLowerCase();
        // 1 つの宣言につき、同じ規則は 1 回だけ数える
        const hit = lower === 'all' ? 'transition-all' : (isForbiddenProp(lower, forbidden) ? 'motion-layout-prop' : null);
        if (hit && !seen[hit]) { seen[hit] = true; add(hit, d); }
      }
    }

    // 時間: shorthand は 1 つめの時間が duration（2 つめは delay）。-duration は全部 duration。
    if (prop === 'transition' || prop === 'animation') {
      if (!selectorAllowed(d.selector, durAllow)) {
        for (const item of splitTopLevel(d.value, ',')) {
          const first = tokens(item).map(toMs).find((n) => n !== null);
          if (first !== undefined && first > maxMs) { add('motion-duration', d); break; }
        }
      }
    } else if (prop === 'transition-duration' || prop === 'animation-duration') {
      if (!selectorAllowed(d.selector, durAllow)) {
        if (splitTopLevel(d.value, ',').some((t) => { const n = toMs(t); return n !== null && n > maxMs; })) add('motion-duration', d);
      }
    }

    if ((prop === 'animation' || prop === 'animation-iteration-count') && /(^|[\s,])infinite(?![\w-])/i.test(d.value)) {
      if (!selectorAllowed(d.selector, infAllow)) add('motion-infinite', d);
    }
  }
  return violations;
}

/** JS の文字列を検査する。behavior:'smooth' で、同じ行に nbScrollBehavior( が無いものを数える。 */
function auditJs(js, policy, opts) {
  opts = opts || {};
  const fn = policy.scrollBehaviorFunction || 'nbScrollBehavior';
  const violations = [];
  const lines = js.split('\n');
  const re = /\bbehavior\s*:\s*(['"`])smooth\1/;
  lines.forEach((ln, idx) => {
    if (!re.test(ln)) return;
    if (ln.includes(fn + '(')) return;
    violations.push({
      rule: 'smooth-scroll-js',
      file: opts.file || '',
      line: idx + 1 + (opts.lineOffset || 0),
      selector: '',
      excerpt: ln.trim().replace(/\s+/g, ' ').slice(0, 120),
    });
  });
  return violations;
}

function lineOffsetAt(text, index) {
  let n = 0;
  for (let k = text.indexOf('\n'); k !== -1 && k < index; k = text.indexOf('\n', k + 1)) n++;
  return n;
}

/** HTML の <style>、src の無い <script>（JSON-LD などの型付きは除く）、on*= 属性の JS を検査する。 */
function auditHtml(html, policy, opts) {
  opts = opts || {};
  let out = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const start = m.index + m[0].indexOf('>') + 1;
    out = out.concat(auditCss(m[1], policy, { file: opts.file, lineOffset: lineOffsetAt(html, start) }));
  }
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const type = (m[1].match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && !/javascript|module/i.test(type)) continue;
    const start = m.index + m[0].indexOf('>') + 1;
    out = out.concat(auditJs(m[2], policy, { file: opts.file, lineOffset: lineOffsetAt(html, start) }));
  }
  // onclick="window.scrollTo({top:0,behavior:'smooth'})" のような属性の中の JS
  for (const m of html.matchAll(/\bon[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const code = m[1] !== undefined ? m[1] : m[2];
    if (!/smooth/.test(code)) continue;
    out = out.concat(auditJs(code, policy, { file: opts.file, lineOffset: lineOffsetAt(html, m.index) }));
  }
  return out.sort((a, b) => a.line - b.line);
}

/** ファイルの種類（拡張子）で振り分ける。 */
function auditText(text, policy, file) {
  if (/\.css$/i.test(file)) return auditCss(text, policy, { file });
  if (/\.js$/i.test(file)) return auditJs(text, policy, { file });
  return auditHtml(text, policy, { file });
}

/** 規則ごと・ファイルごとの件数。 */
function summarize(violations) {
  const byRule = {};
  RULES.forEach((r) => { byRule[r] = 0; });
  const byFile = {};
  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] || 0) + 1;
    byFile[v.file] = byFile[v.file] || {};
    byFile[v.file][v.rule] = (byFile[v.file][v.rule] || 0) + 1;
  }
  return { total: violations.length, byRule, byFile };
}

/** enforce が true のとき、落とす対象（enforceScopes のファイルの違反）。false なら空。 */
function enforcedViolations(violations, policy) {
  if (!policy || policy.enforce !== true) return [];
  const scopes = policy.enforceScopes || [];
  return violations.filter((v) => scopes.includes(v.file));
}

module.exports = { RULES, loadMotionPolicy, parseDeclarations, auditCss, auditJs, auditHtml, auditText, summarize, enforcedViolations, isForbiddenProp };
