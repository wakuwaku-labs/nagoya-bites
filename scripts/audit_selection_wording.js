#!/usr/bin/env node
'use strict';
/**
 * audit_selection_wording.js — 店の選び方の言い方の検査（I-35 ①・夜間QA の soft）
 *
 * オーナーの指示（2026-10-11）:
 *   「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者がすべての店舗を
 *    選定しているような表現は使用しないでください。」
 * 人が全店を選んだ・書いたと読める言い方（「業界人」「現役の飲食店マネージャー」「目利き」…）が、
 * 公開ページの見える文字・title・meta・JSON-LD に出てこないかを数える。
 * 語の一覧と例外の正本は data/selection_wording_policy.json（変更はそちらで行いスクリプトは触らない・CLAUDE.md 制約10）。
 *
 * 数えるだけで、ページの文は直さない。何を書き換えるか（P-237 #2）はオーナーの決定待ち。
 * 直して 0 件になったら、夜間QA の hard に上げる。
 *
 * 数え方:
 *   - コメント・<style>・JSON-LD 以外の <script> を除いた HTML を見る（title・meta・alt・JSON-LD は含む）
 *   - 例外: policy の scanScripts に載るファイル（index.html）だけは <script> の中の文字も数える
 *     （店のモーダルなどの画面の文字が JS の文字列として持たれているため）
 *   - 例外（exempt）は path・term・reason が揃っているときだけ許す。理由の無い例外は検査自体が落ちる
 *   - 強調・リンク・改行などのインラインのタグで割れた言い回し（例: 飲食の<em>プロ</em>が）も数える（P-389）。
 *     タグを外した文字列にも同じ語の一覧を当て、元の文字列でタグをまたぐ一致だけを足す（タグをまたがない一致は二重に数えない）。
 *     段落・見出し・リスト項目などの境目（ブロックのタグ）は外さないので、別の文どうしをつないで数えることはない
 *
 * 使い方:
 *   node scripts/audit_selection_wording.js            # 集計を出す（exit 0）
 *   node scripts/audit_selection_wording.js --check    # severity=error の語が 1 か所でもあれば exit 1
 *   node scripts/audit_selection_wording.js --json     # 結果を JSON で出す
 *   --root <dir>   別のリポジトリ（テスト用の小さな fixture）を見る
 *   --only <name>  root / features / journal / stores / area のどれかだけ見る
 *   --phrases <語のid> [--limit N]  その語の言い回しの一覧（例外の phrase を書くときに使う）
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_ROOT, SECTIONS, listPublishedPages } = require('./lib/published_pages');

const MAX_LISTED = 50;
const MAX_PHRASE_KEYS = 20000;
const TOP_PHRASES = 5;
const CONTEXT_CHARS = 12;

function loadPolicy(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', 'selection_wording_policy.json'), 'utf8'));
}

/** policy の検証（理由の無い例外・重複した id・書けない正規表現は、検査自体を落とす）。 */
function compilePolicy(policy) {
  const ids = new Set();
  const terms = (policy.terms || []).map((t) => {
    if (!t.id || !t.pattern) throw new Error('terms の要素に id と pattern が要ります');
    if (ids.has(t.id)) throw new Error(`terms の id が重複しています: ${t.id}`);
    ids.add(t.id);
    if (t.severity !== 'error' && t.severity !== 'info') throw new Error(`severity は error か info: ${t.id}`);
    return { ...t, re: new RegExp(t.pattern, 'g') };
  });
  if (!terms.length) throw new Error('terms が空です');
  const exempt = (policy.exempt || []).map((e) => {
    if (!e.path || !e.term || !e.reason || !String(e.reason).trim()) throw new Error('exempt には path・term・reason が要ります（理由の無い例外は許さない）');
    if (!ids.has(e.term)) throw new Error(`exempt の term が terms に無い: ${e.term}`);
    if (e.phrase !== undefined && (typeof e.phrase !== 'string' || !e.phrase)) throw new Error('exempt の phrase は空でない文字列');
    return e;
  });
  return { terms, exempt, scanScripts: new Set(policy.scanScripts || []) };
}

/** コメント・<style>・JSON-LD 以外の <script> を除いた HTML。keepScripts なら <script> の中身も残す。 */
function visibleMarkup(html, keepScripts) {
  let s = html.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    if (keepScripts) return ' ' + body + ' ';
    return /type\s*=\s*["']application\/ld\+json["']/i.test(attrs) ? ' ' + body + ' ' : ' ';
  });
  return s;
}

function cleanSide(s, side) {
  s = s.replace(/<[^>]*>/g, ' ');
  s = side === 'before' ? s.replace(/^[^<]*>/, ' ') : s.replace(/<[^>]*$/, ' ');
  return s.replace(/\s+/g, ' ');
}

/** 一致の前後を短く切り出した「言い回し」。数字は # にそろえて、同じ言い回しを 1 つに数える。 */
function contextOf(markup, idx, len) {
  const a = Math.max(0, idx - 60);
  const b = Math.min(markup.length, idx + len + 60);
  const rel = idx - a;
  const before = cleanSide(markup.slice(a, a + rel), 'before');
  const after = cleanSide(markup.slice(a + rel + len, b), 'after');
  const match = markup.slice(idx, idx + len).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
  const left = before.slice(-CONTEXT_CHARS).replace(/^\s+/, '');
  const right = after.slice(0, CONTEXT_CHARS).replace(/\s+$/, '');
  return (left + '【' + match + '】' + right).replace(/\d+/g, '#');
}

function isExempt(rel, termId, phrase, exempt) {
  return exempt.some((e) => e.term === termId
    && (e.path.endsWith('/') ? rel.startsWith(e.path) : rel === e.path)
    && (e.phrase === undefined || phrase.includes(e.phrase)));
}

// 文の途中に入るタグ。これで割れた語（飲食の<em>プロ</em>が・業界人<br>の目利き）は、タグつきの文字列では当たらない（P-389）
const INLINE_TAG = /<\/?(?:em|strong|b|i|u|s|span|a|mark|small|sub|sup|abbr|cite|code|del|ins|font|ruby|rt|rb|br|wbr)\b[^>]*>/gi;

/** インラインのタグを外した文字列と、外した後の位置 → 元の位置の対応。外すタグが無ければ null。 */
function flattenInline(markup) {
  const segs = []; // { flat: 外した後の開始位置, orig: 元の開始位置 }
  let flat = '';
  let last = 0;
  let m;
  INLINE_TAG.lastIndex = 0;
  while ((m = INLINE_TAG.exec(markup)) !== null) {
    if (m.index > last) { segs.push({ flat: flat.length, orig: last }); flat += markup.slice(last, m.index); }
    last = m.index + m[0].length;
  }
  if (!segs.length && last === 0) return null;
  if (last < markup.length) { segs.push({ flat: flat.length, orig: last }); flat += markup.slice(last); }
  const toOrig = (i) => {
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].flat <= i) lo = mid; else hi = mid - 1; }
    return segs[lo].orig + (i - segs[lo].flat);
  };
  return { flat, toOrig };
}

/**
 * 1 ページを数える（純粋な関数）。
 * @returns {{counts: Record<string,number>, phrases: {term:string, phrase:string}[], exempted: number}}
 */
function scanHtml(html, compiled, { rel = '', keepScripts = false } = {}) {
  const markup = visibleMarkup(html, keepScripts);
  const flatInfo = flattenInline(markup);
  const counts = {};
  const phrases = [];
  let exempted = 0;
  for (const t of compiled.terms) {
    t.re.lastIndex = 0;
    let n = 0;
    let m;
    while ((m = t.re.exec(markup)) !== null) {
      if (m[0].length === 0) { t.re.lastIndex++; continue; }
      const phrase = contextOf(markup, m.index, m[0].length);
      if (isExempt(rel, t.id, phrase, compiled.exempt)) { exempted++; continue; }
      n++;
      phrases.push({ term: t.id, phrase });
    }
    // タグをまたぐ一致だけを足す（タグをまたがない一致は上で数えたので、二重に数えない）
    if (flatInfo) {
      t.re.lastIndex = 0;
      while ((m = t.re.exec(flatInfo.flat)) !== null) {
        if (m[0].length === 0) { t.re.lastIndex++; continue; }
        const from = flatInfo.toOrig(m.index);
        const to = flatInfo.toOrig(m.index + m[0].length - 1) + 1;
        if (!markup.slice(from, to).includes('<')) continue;
        const phrase = contextOf(markup, from, to - from);
        if (isExempt(rel, t.id, phrase, compiled.exempt)) { exempted++; continue; }
        n++;
        phrases.push({ term: t.id, phrase });
      }
    }
    if (n) counts[t.id] = n;
  }
  return { counts, phrases, exempted };
}

function audit({ root = DEFAULT_ROOT, policy = null, only = null } = {}) {
  policy = policy || loadPolicy(root);
  const compiled = compilePolicy(policy);
  const pages = listPublishedPages({ root, only });
  const stat = {};
  for (const t of compiled.terms) {
    stat[t.id] = { id: t.id, severity: t.severity, label: t.label || t.id, pages: 0, occurrences: 0, by_section: Object.fromEntries(SECTIONS.map((s) => [s, { pages: 0, occurrences: 0 }])) };
  }
  const phraseMap = new Map(); // `${term}\u0001${phrase}` -> { term, phrase, occurrences, pages }
  let overflow = 0;
  let exempted = 0;
  const violations = [];
  const errorBySection = Object.fromEntries(SECTIONS.map((s) => [s, { pages: 0, occurrences: 0 }]));
  let errorPages = 0;
  let errorOccurrences = 0;
  for (const p of pages) {
    const html = fs.readFileSync(p.abs, 'utf8');
    const r = scanHtml(html, compiled, { rel: p.rel, keepScripts: compiled.scanScripts.has(p.rel) });
    exempted += r.exempted;
    let pageError = 0;
    for (const [id, n] of Object.entries(r.counts)) {
      const s = stat[id];
      s.pages++;
      s.occurrences += n;
      s.by_section[p.section].pages++;
      s.by_section[p.section].occurrences += n;
      if (s.severity === 'error') pageError += n;
    }
    if (pageError) {
      errorPages++;
      errorOccurrences += pageError;
      errorBySection[p.section].pages++;
      errorBySection[p.section].occurrences += pageError;
      violations.push({ file: p.rel, section: p.section, occurrences: pageError, terms: Object.fromEntries(Object.entries(r.counts).filter(([id]) => stat[id].severity === 'error')) });
    }
    const seen = new Set();
    for (const ph of r.phrases) {
      const key = ph.term + '\u0001' + ph.phrase;
      let e = phraseMap.get(key);
      if (!e) {
        if (phraseMap.size >= MAX_PHRASE_KEYS) { overflow++; continue; }
        e = { term: ph.term, phrase: ph.phrase, occurrences: 0, pages: 0 };
        phraseMap.set(key, e);
      }
      e.occurrences++;
      if (!seen.has(key)) { seen.add(key); e.pages++; }
    }
  }
  const topByTerm = {};
  for (const e of phraseMap.values()) (topByTerm[e.term] = topByTerm[e.term] || []).push(e);
  for (const t of compiled.terms) {
    const list = (topByTerm[t.id] || []).sort((a, b) => b.pages - a.pages || b.occurrences - a.occurrences).slice(0, TOP_PHRASES);
    stat[t.id].top_phrases = list.map((e) => ({ phrase: e.phrase, pages: e.pages, occurrences: e.occurrences }));
  }
  violations.sort((a, b) => b.occurrences - a.occurrences);
  return {
    ok: errorOccurrences === 0,
    files_scanned: pages.length,
    error_pages: errorPages,
    error_occurrences: errorOccurrences,
    exempted,
    by_section: errorBySection,
    terms: compiled.terms.map((t) => stat[t.id]),
    phrase_keys_overflow: overflow,
    violations: violations.slice(0, MAX_LISTED),
    violations_truncated: Math.max(0, violations.length - MAX_LISTED),
  };
}

/** 1 つの語の言い回しの一覧（例外の phrase を書くとき・語を直すときに使う）。 */
function listPhrases({ root, only, termId, limit }) {
  const compiled = compilePolicy(loadPolicy(root));
  if (!compiled.terms.some((t) => t.id === termId)) { console.error(`語 ${termId} は policy に無い（${compiled.terms.map((t) => t.id).join(' / ')}）`); process.exit(2); }
  const map = new Map();
  for (const p of listPublishedPages({ root, only })) {
    const r = scanHtml(fs.readFileSync(p.abs, 'utf8'), compiled, { rel: p.rel, keepScripts: compiled.scanScripts.has(p.rel) });
    const seen = new Set();
    for (const ph of r.phrases) {
      if (ph.term !== termId) continue;
      const e = map.get(ph.phrase) || { occurrences: 0, pages: 0, example: p.rel };
      e.occurrences++;
      if (!seen.has(ph.phrase)) { seen.add(ph.phrase); e.pages++; }
      map.set(ph.phrase, e);
    }
  }
  const list = [...map.entries()].sort((a, b) => b[1].pages - a[1].pages || b[1].occurrences - a[1].occurrences);
  console.log(`${termId}: 言い回し ${list.length} 種（上位 ${Math.min(limit, list.length)}）`);
  for (const [phrase, e] of list.slice(0, limit)) console.log(`${String(e.pages).padStart(6)} ページ ${String(e.occurrences).padStart(6)} か所  ${phrase}   (${e.example})`);
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const root = arg('--root') ? path.resolve(arg('--root')) : DEFAULT_ROOT;
  const only = arg('--only');
  if (only && !SECTIONS.includes(only)) { console.error(`--only は ${SECTIONS.join(' / ')} のどれか`); process.exit(2); }
  if (arg('--phrases')) return listPhrases({ root, only, termId: arg('--phrases'), limit: parseInt(arg('--limit') || '60', 10) });
  let result;
  try {
    result = audit({ root, only });
  } catch (e) {
    console.error('選び方の言い方の検査を実行できません: ' + e.message);
    process.exit(1);
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // 夜間QA の報告は出力の最後の 30 行だけを載せる。語ごとの行を先に、合計を最後に出して、見落とさないようにする
    console.log(`店の選び方の言い方の検査（I-35 ①）: 公開ページ ${result.files_scanned} 本`);
    for (const t of result.terms) {
      if (!t.occurrences) continue;
      const mark = t.severity === 'error' ? '❌' : 'ℹ️';
      console.log(`  ${mark} ${t.label}: ${t.pages} ページ・${t.occurrences} か所`);
      for (const ph of t.top_phrases.slice(0, 1)) console.log(`       例: …${ph.phrase}…（${ph.pages} ページ）`);
    }
    if (result.phrase_keys_overflow) console.log(`  ℹ️ 言い回しの種類が多く、${result.phrase_keys_overflow} か所は例の集計から外した`);
    console.log('     セクション別（ページ数）: ' + SECTIONS.map((s) => `${s} ${result.by_section[s].pages}`).join(' / '));
    console.log(`  ${result.ok ? '✅' : '❌'} 人が選んだと読める言い方（合計）: ${result.error_pages} ページ・${result.error_occurrences} か所` + (result.exempted ? `（例外 ${result.exempted} か所は除く）` : ''));
  }
  if (argv.includes('--check') && !result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { audit, compilePolicy, contextOf, flattenInline, isExempt, listPhrases, loadPolicy, scanHtml, visibleMarkup };
