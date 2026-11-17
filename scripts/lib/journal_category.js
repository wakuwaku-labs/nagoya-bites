'use strict';
/**
 * scripts/lib/journal_category.js
 *
 * ジャーナル記事の3分類（S3-3・計画 media-policy-2026-11）。
 *   topic   = 話題のお店紹介（今日の1軒・季節短信・flexible）
 *   guide   = 店選びガイド（選び方・業界の裏側コラム・集計から書くガイド）
 *   compare = 比較・特集（複数店を並べる週次ダイジェストなど）
 * 台帳 data/journal_published.json の entries[].category に持つ。無い行は theme から導く
 * （generate_daily_draft.js はまだ category を書かないため、読む側が必ず補う）。
 * 目安の配分は data/journal_queue.json の categories に置く。ここは判定だけ。
 */

const CATEGORIES = {
  topic: { label: '話題のお店紹介', short: '話題のお店' },
  guide: { label: '店選びガイド', short: '店選びガイド' },
  compare: { label: '比較・特集', short: '比較・特集' },
};

const THEME_TO_CATEGORY = {
  today_one: 'topic',
  flexible: 'topic',
  seasonal: 'topic',
  industry_insider: 'guide',
  weekly_digest: 'compare',
};

// theme が未知のときだけ題から推す
function guessFromTitle(title) {
  const t = String(title || '');
  if (/比較|ランキング|まとめ|ダイジェスト/.test(t)) return 'compare';
  if (/選び方|ガイド|見分け方|頼み方/.test(t)) return 'guide';
  return 'topic';
}

/** entry から分類キーを返す。明示の category が正しければそれ、無ければ theme から。必ず3つのどれかを返す */
function categoryOf(entry) {
  const e = entry || {};
  if (CATEGORIES[e.category]) return e.category;
  if (THEME_TO_CATEGORY[e.theme]) return THEME_TO_CATEGORY[e.theme];
  return guessFromTitle(e.title);
}

function categoryLabel(key) {
  return (CATEGORIES[key] || CATEGORIES.topic).label;
}

/** 公開中（取り下げていない）か。status 未設定は公開中 */
function isPublic(entry) {
  const s = (entry && entry.status) || 'published';
  return s !== 'withdrawn';
}

/** 記事 HTML が取り下げ済みか（journal_withdraw.js が入れる noindex の印 data-withdrawn を見る） */
function isWithdrawnHtml(html) {
  return /<meta[^>]*name="robots"[^>]*data-withdrawn/.test(String(html || ''));
}

/** ファイル名の一覧から、取り下げ済みの記事を除く（サイトマップ用）。読めないファイルは残す */
function filterPublicArticleFiles(dir, files) {
  const fs = require('fs');
  const path = require('path');
  return files.filter(f => {
    try { return !isWithdrawnHtml(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { return true; }
  });
}

module.exports = { CATEGORIES, THEME_TO_CATEGORY, categoryOf, categoryLabel, isPublic, isWithdrawnHtml, filterPublicArticleFiles };
