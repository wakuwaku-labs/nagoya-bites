'use strict';
/**
 * scripts/lib/journal_source_diversity.js
 *
 * 日次ジャーナルの出典の偏り（同じ二次媒体の後追い）を測る唯一の判定器。
 * 基準は data/journal_source_diversity_policy.json。
 *
 * 判定根拠は公開済み記事HTMLの情報源欄（<div class="source-note">）の href だけ
 * ＝誰でも記事を開いて検算できる事実（制約10）。
 *
 * 使う側:
 *   - scripts/fetch_trending_articles.js suggest-queries … 飽和媒体を除外したクエリと代替媒体クエリを出す
 *   - scripts/score_journal_candidates.js              … 飽和媒体を「独立ドメイン数」に数えない
 *
 * CLI: node scripts/lib/journal_source_diversity.js [YYYY-MM-DD]   # 直近の媒体別シェアを表示
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'data', 'journal_source_diversity_policy.json');
const JOURNAL_DIR = path.join(ROOT, 'journal');

function loadPolicy() {
  try { return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8')); }
  catch (_) { return null; }
}

function hostOf(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./i, '').toLowerCase(); }
  catch (_) { return ''; }
}

function matchDomain(host, domains) {
  return (domains || []).some(d => host === d || host.endsWith('.' + d));
}

/** 偏りの計測対象（二次媒体）か。一次発表・店舗ページ・SNS は対象外 */
function isMeasured(host, policy) {
  if (!host || !policy) return false;
  const ex = policy.exempt_domains || {};
  return !['primary', 'listing', 'social'].some(k => matchDomain(host, ex[k]));
}

/** 記事HTMLの情報源欄から出典ホストを取り出す（重複なし・出現順） */
function extractSourceHosts(html) {
  const m = String(html).match(/<div class="source-note">([\s\S]*?)<\/div>/);
  if (!m) return [];
  const hosts = [...m[1].matchAll(/href="(https?:[^"]+)"/g)].map(x => hostOf(x[1])).filter(Boolean);
  return [...new Set(hosts)];
}

/**
 * 直近 window_days の公開記事で、二次媒体ごとの「出典に含んだ記事の割合」を測る。
 * @returns {{ today, window_days, articles, shares: {host,count,share}[], saturated: string[] }}
 */
function measure(opts = {}) {
  const policy = opts.policy || loadPolicy();
  const today = opts.today || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const empty = { today, window_days: 0, articles: 0, shares: [], saturated: [] };
  if (!policy) return empty;

  const dir = opts.journalDir || JOURNAL_DIR;
  const since = new Date(new Date(today + 'T00:00:00+09:00').getTime() - policy.window_days * 86400000)
    .toISOString().slice(0, 10);
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f)); } catch (_) {}
  files = files.filter(f => f.slice(0, 10) >= since && f.slice(0, 10) < today);

  const counts = {};
  let articles = 0;
  for (const f of files) {
    const hosts = extractSourceHosts(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!hosts.length) continue;
    articles++;
    hosts.filter(h => isMeasured(h, policy)).forEach(h => { counts[h] = (counts[h] || 0) + 1; });
  }

  const shares = Object.entries(counts)
    .map(([host, count]) => ({ host, count, share: articles ? count / articles : 0 }))
    .sort((a, b) => b.count - a.count);
  // 記事数が少ないうちは割合がぶれるので判定しない（オオカミ少年化させない）
  const saturated = articles >= policy.min_articles
    ? shares.filter(s => s.share > policy.saturation_share).map(s => s.host)
    : [];
  return { today, window_days: policy.window_days, articles, shares, saturated };
}

function isSaturated(host, saturated) {
  return matchDomain(host, saturated);
}

module.exports = { loadPolicy, measure, extractSourceHosts, isMeasured, isSaturated, hostOf };

if (require.main === module) {
  const r = measure({ today: process.argv[2] });
  const p = loadPolicy();
  console.log(`直近${r.window_days}日の公開記事 ${r.articles}本（二次媒体のみ・閾値 ${Math.round(p.saturation_share * 100)}%）`);
  r.shares.slice(0, 10).forEach(s => {
    const mark = r.saturated.includes(s.host) ? '⚠️ 飽和' : '';
    console.log(`  ${s.host.padEnd(36)} ${String(s.count).padStart(3)}本 ${String(Math.round(s.share * 100)).padStart(3)}% ${mark}`);
  });
  if (!r.saturated.length) console.log('飽和している媒体はありません');
}
