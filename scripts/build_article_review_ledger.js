#!/usr/bin/env node
'use strict';
/**
 * scripts/build_article_review_ledger.js — 既存記事の棚卸し台帳（基本方針 段階5・S5-1・ADR 0069）
 *
 * 特集（features/*.html）と日次ジャーナル（journal/*.html）の全記事を 1 行ずつ台帳にする。
 * どの記事から先に直すかを機械で決めるための材料で、読み取りだけ（記事は書き換えない）。
 *
 * 1 行の中身:
 *   path / kind / title / date            … 記事の名前と日付（ジャーナルは日付つきのファイル名）
 *   searchClicks28d / searchImpressions28d / searchPosition … data/gsc_metrics.json（ページ別・直近28日）
 *   problems[]                             … 見つかった問題の型（下の PROBLEM_TYPES）
 *   lastFactCheckedDate                    … 本文に書かれた「確認日」の最新。無ければ null
 *                                            （特集の「更新日」は機械の一括更新で進むので、確認日の目安にしない）
 *   inboundArticleLinks                    … ほかの記事（特集・ジャーナル）からのリンク元ページ数
 *   inboundHubLinks                        … 店舗ページ・エリア一覧からのリンク元ページ数
 *   storeLinks                             … この記事から店舗ページへのリンク先の数
 *   priority                               … 直す順の目安（大きいほど先）= 問題の重さ × (検索クリック + 表示/20 + 1)
 *
 * 問題の型（合否ではなく並べ替えの材料。公開の条件には使わない）:
 *   wording_selection   人が選んだと読める言い方（data/selection_wording_policy.json）
 *   wording_assertion   編集部が保証できない言い切り（data/trust_display_policy.json の assertionWords）
 *   rating_no_count     件数も時点も無い Google の星（★4.2 だけ）
 *   rank_numbering      点数・評価順に見える番号つきの並び（「第1位」「No.1」「1位」）
 *   score_display       点数・段階の表示（信頼度スコア・「◯◯点」）
 *   no_confirm_date     本文に確認日が無い
 *   no_store_links      店舗ページへのリンクが 0
 *   orphan              ほかの記事からも一覧以外からもリンクされていない
 *   seasonal_expired    終わった行事の記事（題に年・行事名があり、年が過去）
 *
 * 使い方:
 *   node scripts/build_article_review_ledger.js           # data/article_review_ledger.json を書く
 *   node scripts/build_article_review_ledger.js --check   # 全記事が台帳にあるか（1 本でも欠けたら終了コード1）
 *   node scripts/build_article_review_ledger.js --top 20  # 優先度の上位を表示
 *
 * 共有ファイル registry に足す行は PR 本文にある（本線が統合時に入れる）。
 */

const fs = require('fs');
const path = require('path');
const { listPublishedPages } = require('./lib/published_pages');
const { isMergedStub } = require('./lib/feature_merges');
const { compilePolicy, loadPolicy: loadWording, scanHtml } = require('./audit_selection_wording');

const ROOT = path.join(__dirname, '..');
const OUT_REL = 'data/article_review_ledger.json';

const PROBLEM_WEIGHT = {
  wording_selection: 5, wording_assertion: 4, rating_no_count: 3, rank_numbering: 3, score_display: 2,
  no_confirm_date: 2, no_store_links: 1, orphan: 1, seasonal_expired: 2,
};

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (_) { return fallback; }
}

/** 本文の見える部分（script・style・コメント・タグを除く） */
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

function titleOf(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** 本文の確認日の最新（YYYY-MM-DD）。「◯年◯月◯日に確認」「（◯月◯日確認）」「確認日: …」の形だけ拾う */
function lastConfirmDate(text, fallbackYear) {
  const dates = [];
  const push = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return;
    dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };
  let m;
  const full = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日[^。、\n]{0,12}?確認/g;
  while ((m = full.exec(text))) push(m[1], m[2], m[3]);
  const full2 = /確認(?:日|した日)?[:：]?\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/g;
  while ((m = full2.exec(text))) push(m[1], m[2], m[3]);
  const iso = /確認(?:日)?[:：]?\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/g;
  while ((m = iso.exec(text))) push(m[1], m[2], m[3]);
  if (fallbackYear) {
    const short = /[（(]\s*(\d{1,2})月\s*(\d{1,2})日\s*確認\s*[）)]/g;
    while ((m = short.exec(text))) push(fallbackYear, m[1], m[2]);
  }
  return dates.length ? dates.sort().pop() : null;
}

function internalTargets(html, fromRel) {
  const out = new Set();
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
  const re = /<a\b[^>]*?\bhref\s*=\s*["']([^"'#?]+)/gi;
  let m;
  while ((m = re.exec(body))) {
    let h = m[1].trim();
    if (/^(https?:)?\/\//.test(h)) {
      const mm = h.match(/^https?:\/\/(?:www\.)?nagoya-bites\.com\/(.*)$/);
      if (!mm) continue;
      h = '/' + mm[1];
    }
    if (/^(mailto|tel|javascript):/.test(h)) continue;
    let target;
    if (h.startsWith('/')) target = h.slice(1);
    else target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), h));
    if (target.endsWith('/')) target += 'index.html';
    out.add(target);
  }
  return out;
}

function seasonalExpired(title, today) {
  const y = (title.match(/(20\d{2})/) || [])[1];
  if (y && +y < today.getFullYear()) return true;
  return false;
}

function build({ root = ROOT, today = new Date() } = {}) {
  const pages = listPublishedPages({ root });
  // 統合して転送ページにした特集（S5-3・0077）は記事ではないので台帳に載せない
  const articles = pages.filter((p) => (p.type === 'feature' || p.type === 'journal') && !/\/(index)\.html$/.test(p.rel) && !isMergedStub(fs.readFileSync(p.abs, 'utf8')));
  const compiled = compilePolicy(loadWording(root));
  const trust = readJson('data/trust_display_policy.json', {});
  const assertion = trust.assertionWords || [];
  const gsc = readJson('data/gsc_metrics.json', {});
  const gscByPath = new Map();
  for (const r of gsc.pages || []) {
    const m = String(r.page).match(/^https?:\/\/[^/]+\/(.*)$/);
    if (m) gscByPath.set(m[1], r);
  }

  // リンク元の集計（全公開ページを 1 回ずつ読む）
  const articleSet = new Set(articles.map((a) => a.rel));
  const inboundArticle = new Map(); const inboundHub = new Map();
  const outboundStores = new Map();
  const htmlCache = new Map();
  for (const p of pages) {
    const html = fs.readFileSync(p.abs, 'utf8');
    if (articleSet.has(p.rel)) htmlCache.set(p.rel, html);
    const isArticleSrc = articleSet.has(p.rel);
    const isHubSrc = p.type === 'store' || p.type === 'hub';
    if (!isArticleSrc && !isHubSrc) continue;
    const targets = internalTargets(html, p.rel);
    let storeCount = 0;
    for (const t of targets) {
      if (isArticleSrc && /^stores\/[^/]+\.html$/.test(t) && t !== 'stores/index.html') storeCount++;
      if (!articleSet.has(t) || t === p.rel) continue;
      const map = isArticleSrc ? inboundArticle : inboundHub;
      map.set(t, (map.get(t) || 0) + 1);
    }
    if (isArticleSrc) outboundStores.set(p.rel, storeCount);
  }

  const rows = articles.map((a) => {
    const html = htmlCache.get(a.rel);
    const text = visibleText(html);
    const title = titleOf(html);
    const dateM = a.rel.match(/(\d{4}-\d{2}-\d{2})/);
    const year = dateM ? dateM[1].slice(0, 4) : String(today.getFullYear());
    const g = gscByPath.get(a.rel) || null;
    const wording = scanHtml(html, compiled, { rel: a.rel, keepScripts: false });
    const selHits = Object.entries(wording.counts || {}).reduce((n, [, c]) => n + c, 0);
    const problems = [];
    if (selHits > 0) problems.push('wording_selection');
    if (assertion.some((w) => html.includes(w))) problems.push('wording_assertion');
    // 件数も時点も無い星: ★4.2 の直後に（◯件）が無い
    const stars = text.match(/★\s*\d(?:\.\d)?(?![\d.])(?!\s*[（(]\s*[\d,]+\s*件)/g) || [];
    if (stars.length) problems.push('rating_no_count');
    if (/(第\s*[0-9０-９]+\s*位|No\.\s*[0-9]+|[0-9]+位[:：\s])/.test(text)) problems.push('rank_numbering');
    if (/(信頼度スコア|\d{2,3}\s*点|スコア\s*\d)/.test(text)) problems.push('score_display');
    const lastFactCheckedDate = lastConfirmDate(text, year);
    if (!lastFactCheckedDate) problems.push('no_confirm_date');
    const storeLinks = outboundStores.get(a.rel) || 0;
    if (storeLinks === 0) problems.push('no_store_links');
    const inA = inboundArticle.get(a.rel) || 0; const inH = inboundHub.get(a.rel) || 0;
    if (inA === 0 && inH === 0) problems.push('orphan');
    if (a.type === 'feature' && seasonalExpired(title, today)) problems.push('seasonal_expired');
    const weight = problems.reduce((n, p) => n + (PROBLEM_WEIGHT[p] || 1), 0);
    const clicks = g ? g.clicks : 0; const imps = g ? g.impressions : 0;
    return {
      path: a.rel, kind: a.type, title, date: dateM ? dateM[1] : null,
      searchClicks28d: clicks, searchImpressions28d: imps, searchPosition: g ? g.position : null,
      problems, lastFactCheckedDate,
      inboundArticleLinks: inA, inboundHubLinks: inH, storeLinks,
      priority: Math.round(weight * (clicks + imps / 20 + 1) * 10) / 10,
    };
  });
  rows.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));

  const byProblem = {};
  for (const r of rows) for (const p of r.problems) byProblem[p] = (byProblem[p] || 0) + 1;
  return {
    _README: '既存記事の棚卸し台帳（段階5・S5-1・ADR 0069）。scripts/build_article_review_ledger.js が作る。並べ替えの材料で、公開の条件には使わない。gsc は data/gsc_metrics.json の直近28日。確認日は本文に書かれた「◯月◯日確認」の最新（特集の「更新日」は機械の一括更新で進むので使わない）。',
    generatedFrom: { gscGeneratedAt: gsc.generatedAt || null, gscRange: gsc.dateRange || null },
    totals: { articles: rows.length, features: rows.filter((r) => r.kind === 'feature').length, journal: rows.filter((r) => r.kind === 'journal').length, byProblem },
    articles: rows,
  };
}

function missingFrom(ledger, root = ROOT) {
  const have = new Set(ledger.articles.map((a) => a.path));
  return listPublishedPages({ root })
    .filter((p) => (p.type === 'feature' || p.type === 'journal') && !/\/index\.html$/.test(p.rel) && !isMergedStub(fs.readFileSync(p.abs, 'utf8')))
    .map((p) => p.rel).filter((r) => !have.has(r));
}

function main() {
  const argv = process.argv.slice(2);
  const ledger = build();
  if (argv.includes('--check')) {
    const cur = readJson(OUT_REL, null);
    if (!cur) { console.error('台帳がありません: ' + OUT_REL); process.exit(1); }
    const miss = missingFrom(cur);
    if (miss.length) { console.error(`台帳に無い記事 ${miss.length} 本: ${miss.slice(0, 5).join(', ')}`); process.exit(1); }
    console.log(`台帳 OK: ${cur.articles.length} 本すべてが台帳にある`);
    return;
  }
  const ti = argv.indexOf('--top');
  if (ti >= 0) {
    const n = parseInt(argv[ti + 1] || '20', 10);
    for (const r of ledger.articles.slice(0, n)) console.log(`${String(r.priority).padStart(7)}  クリック${String(r.searchClicks28d).padStart(4)}  ${r.path}  [${r.problems.join(',')}]`);
    return;
  }
  fs.writeFileSync(path.join(ROOT, OUT_REL), JSON.stringify(ledger, null, 1) + '\n');
  console.log(`台帳を書きました: ${OUT_REL}（${ledger.totals.articles} 本・特集 ${ledger.totals.features / 1}・ジャーナル ${ledger.totals.journal}）`);
  console.log(JSON.stringify(ledger.totals.byProblem));
}

if (require.main === module) main();

module.exports = { build, missingFrom, lastConfirmDate, visibleText };
