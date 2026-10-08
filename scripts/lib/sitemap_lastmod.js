'use strict';
/**
 * scripts/lib/sitemap_lastmod.js — sitemap.xml の lastmod を「実際に内容が変わった日」にする部品（SEO-121）
 *
 * 2026-10-09 時点で sitemap.xml の 5,823 URL の lastmod は全件が生成日の1値だった
 * （gen-store-pages.js と gen_area_genre_pages.js がどちらも当日を書いていた）。Google は
 * 信頼できない lastmod を無視するため、「毎日全ページが更新された」と申告し続けることになる。
 * 日付は検証できる事実だけから取る（CLAUDE.md 制約10）:
 *   店舗ページ … 生成した HTML が前回のファイルと違えば当日、同じなら前回の sitemap の lastmod
 *   ハブ       … data/area_genre_pages_manifest.json の updated（内容ハッシュが変わった日）
 *   特集・記事 … ページの JSON-LD の dateModified → datePublished（記事はファイル名の日付も可）
 *   一覧ページ … 配下のページの lastmod の最大値
 * 日付が取れないページは lastmod を書かない（推測で書かない・lastmod は省略できる）。
 * 生成器（gen-store-pages.js・scripts/gen_area_genre_pages.js）と監査
 * （scripts/audit_sitemap_health.js）が共有する。ネットワーク不要・決定的。
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD…' を日付に正規化する。暦として正しくなければ null */
function normDate(v) {
  const s = String(v == null ? '' : v).trim().slice(0, 10);
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

/** 未来の日付は当日に丸める（未来の lastmod は無効） */
function clampToday(d, today) {
  const n = normDate(d);
  if (!n) return null;
  return today && n > today ? today : n;
}

/** sitemap.xml から loc → lastmod の対応を読む（lastmod の無い URL は入れない） */
function readSitemapLastmods(xml) {
  const map = new Map();
  const re = /<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const lm = /<lastmod>([^<]+)<\/lastmod>/.exec(m[2]);
    const d = lm ? normDate(lm[1]) : null;
    if (d) map.set(m[1].trim(), d);
  }
  return map;
}

/** ページの JSON-LD・meta から更新日と公開日を取る（最初に出たもの） */
function htmlDates(html) {
  const s = String(html || '');
  const pick = re => { const m = re.exec(s); return m ? normDate(m[1]) : null; };
  return {
    dateModified: pick(/"dateModified"\s*:\s*"([^"]+)"/) || pick(/<meta[^>]+property="article:modified_time"[^>]+content="([^"]+)"/),
    datePublished: pick(/"datePublished"\s*:\s*"([^"]+)"/) || pick(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/),
  };
}

/** 特集・記事の lastmod: dateModified → datePublished → fallback（記事のファイル名の日付など） */
function articleLastmod(html, fallback) {
  const d = htmlDates(html);
  return d.dateModified || d.datePublished || normDate(fallback) || null;
}

function maxDate(dates) {
  return (dates || []).map(normDate).filter(Boolean).sort().pop() || null;
}

/** <url> の中の lastmod 行（日付が無ければ空文字＝書かない） */
function lastmodLine(d) {
  return d ? `\n    <lastmod>${d}</lastmod>` : '';
}

/**
 * 監査: 「lastmod が全件同じ日」（SEO-121 の症状）・形式不正・未来日を検出する。
 * today は 'YYYY-MM-DD'（UTC・生成器と同じ基準）。未来日は1日の猶予を置く（時差）。
 */
function lastmodHealth(xml, today) {
  const blocks = [...String(xml || '').matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)];
  const values = new Map();
  const invalid = [];
  const future = [];
  const limit = today ? new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : null;
  let withLastmod = 0;
  for (const b of blocks) {
    const lm = /<lastmod>([^<]*)<\/lastmod>/.exec(b[2]);
    if (!lm) continue;
    withLastmod++;
    const d = normDate(lm[1]);
    if (!d || lm[1].trim().length > 10 && !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(lm[1].trim())) { invalid.push(b[1]); continue; }
    if (limit && d > limit) future.push(b[1]);
    values.set(d, (values.get(d) || 0) + 1);
  }
  const top = [...values.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const singleDate = withLastmod > 10 && values.size === 1 ? top[0] : null;
  return {
    urls: blocks.length,
    withLastmod,
    distinctDates: values.size,
    mostCommon: top ? { date: top[0], count: top[1], share: +(top[1] / Math.max(1, withLastmod)).toFixed(4) } : null,
    singleDate,
    invalid,
    future,
    ok: !singleDate && invalid.length === 0 && future.length === 0,
  };
}

module.exports = { normDate, clampToday, readSitemapLastmods, htmlDates, articleLastmod, maxDate, lastmodLine, lastmodHealth };
