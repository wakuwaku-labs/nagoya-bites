#!/usr/bin/env node
/**
 * 外部リンク（食べログURL / ホットペッパーID）の店名一致判定 — 唯一の判定器
 *
 * 既存の scripts/audit_manual_stores_links.js は URL の「形式」だけを見ており、
 * 「形式は個別店舗ページなのに、実際には別の店（閉店店舗を含む）を指しているURL」
 * を検出できなかった（2026-09-03・サラマンジェドゥカジノの食べログURLが、来店とは
 * 無関係な別の閉店店舗のページを指していた事故で発覚。ユーザー報告により発覚し、
 * 事前に検知する仕組みが無かった）。
 *
 * このモジュールは「そのURLが実際にその店を指しているか」を、URLを実際に取得して
 * ページの <title> に現れる店名と我々の店名を突き合わせることで検証する。
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力: 実際に fetch したページの <title> テキストだけ。
 *   使わない入力: 「たぶん合っている」等の自己申告。
 *
 * 同一性判定そのものは scripts/lib/store_name_match.js の namesMatch()
 * （架空店ブロックの名前ゲートと同じ判定器）を使う。「同じ店かどうか」を判定する
 * ロジックをこの用途向けにもう1本作らない。
 *
 * 追加の工夫: 我々の 店名 が「英語名（かな併記）」形式（例:
 * 「SALLE A MANGER DE KAJINO（サラマンジェ ドゥ カジノ）」）の場合、丸括弧の中身
 * だけを取り出した候補でも照合する。namesMatch() は日本語同士の表記ゆれ用に
 * 作られており、英語名 vs 外部サイトの日本語タイトルはそのままでは Dice 係数が
 * 低く出て誤って「不一致」判定になるため（2026-09-03 実測: 素の比較だと sim=0.5
 * で閾値 0.85 を割るが、丸括弧の中身だけを使うと sim=1 で一致する）。
 */
'use strict';

const https = require('https');
const { namesMatch } = require('./store_name_match');

// ─── HTTP ────────────────────────────────────────────────────────────
function fetchHtml(url, { timeoutMs = 20000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        res.resume();
        return fetchHtml(next, { timeoutMs, redirects: redirects + 1 }).then(resolve, reject);
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!m) return '';
  // HTML実体参照の主要なものだけ最低限デコード（&amp; 等）
  return m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// ─── サイトごとのタイトル → 店名 抽出 ───────────────────────────────
function tabelogNameFromTitle(title) {
  let t = title.replace(/\s*\|\s*食べログ\s*$/, '');
  // 末尾の " - エリア/ジャンル" を落とす（店名自体にハイフンを含むケースは稀なので許容）
  t = t.replace(/\s-\s[^-]+\/[^/]+$/, '');
  const closed = /^【閉店】/.test(t);
  t = t.replace(/^【閉店】/, '').trim();
  return { name: t, closed };
}

function hotpepperNameFromTitle(title) {
  let t = title.replace(/\s*\|\s*ホットペッパーグルメ\s*$/, '');
  t = t.replace(/\([^)]*\)\s*$/, '').replace(/（[^）]*）\s*$/, '');
  return { name: t.trim() };
}

// ─── 我々の店名の照合候補（丸括弧の中身も候補に足す） ───────────────
function candidateNames(storeName) {
  const out = [storeName];
  const re = /[（(]([^）)]+)[）)]/g;
  let m;
  while ((m = re.exec(storeName))) {
    if (m[1] && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

function bestMatch(storeName, matchedName) {
  let best = { ok: false, sim: 0, via: storeName };
  for (const cand of candidateNames(storeName)) {
    const r = namesMatch(cand, matchedName);
    if (r.ok) return { ...r, via: cand };
    if (r.sim > best.sim) best = { ...r, via: cand };
  }
  return best;
}

// ─── 検証本体 ────────────────────────────────────────────────────────
async function checkTabelogUrl(url, storeName, opts) {
  let html;
  try {
    html = await fetchHtml(url, opts);
  } catch (e) {
    return { ok: false, reason: 'fetch-error', error: e.message, url, storeName };
  }
  const title = extractTitle(html);
  if (!title) return { ok: false, reason: 'no-title', url, storeName };
  const { name: matchedName, closed } = tabelogNameFromTitle(title);
  const match = bestMatch(storeName, matchedName);
  return {
    ok: match.ok && !closed,
    reason: !match.ok ? 'name-mismatch' : (closed ? 'closed' : null),
    sim: match.sim,
    matchedName,
    closed,
    url,
    storeName,
    title,
  };
}

async function checkHotpepperId(id, storeName, opts) {
  const url = `https://www.hotpepper.jp/str${id}/`;
  let html;
  try {
    html = await fetchHtml(url, opts);
  } catch (e) {
    return { ok: false, reason: 'fetch-error', error: e.message, url, storeName };
  }
  const title = extractTitle(html);
  if (!title) return { ok: false, reason: 'no-title', url, storeName };
  const { name: matchedName } = hotpepperNameFromTitle(title);
  const match = bestMatch(storeName, matchedName);
  return {
    ok: match.ok,
    reason: !match.ok ? 'name-mismatch' : null,
    sim: match.sim,
    matchedName,
    url,
    storeName,
    title,
  };
}

module.exports = {
  fetchHtml,
  extractTitle,
  tabelogNameFromTitle,
  hotpepperNameFromTitle,
  candidateNames,
  bestMatch,
  checkTabelogUrl,
  checkHotpepperId,
};
