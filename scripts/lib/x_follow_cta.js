'use strict';
/**
 * 記事末尾の「X をフォロー」1行の部品（Ondine #1808・設計書 x-awareness-engine §7 F「Web → X」）。
 *
 * 日次ジャーナル（journal/*.html）と特集（features/*.html の記事）の本文の最後（関連記事の下・共通フッターの直前）に
 * 1行だけ出す。リンクは UTM つき（utm_source=web・utm_medium=follow_cta・utm_campaign=journal|feature）。
 * X アカウント名の正本は SNS分析ツール（gudgeon）の config/x-accounts.json の handle（NAGOYABITES）。
 * 文言は X のプロフィール・固定ポストと同じ「行く前チェック」に合わせる（設計書 §5・§7）。
 *
 * 判定と部品はこの1本。journal/_template.html（新しい記事）と scripts/apply_x_follow_cta.js（既存記事・日次）が共有する。
 * 冪等（何度当てても同じ結果）。見た目は assets/css/nb.css の .nb-follow-cta（トークンのみ）。
 */

const START = '<!-- NB_X_FOLLOW_START -->';
const END = '<!-- NB_X_FOLLOW_END -->';
const ANCHOR = '<!-- NB-CHROME:FOOTER:START -->';
const HANDLE = 'NAGOYABITES';
const BASE = `https://x.com/${HANDLE}`;

/** @param {'journal'|'feature'} kind */
function followUrl(kind) {
  return `${BASE}?utm_source=web&utm_medium=follow_cta&utm_campaign=${kind}`;
}

function renderCta(kind) {
  return `${START}<p class="nb-follow-cta">名古屋の店探し、行く前チェックを毎日 X で。<a href="${followUrl(kind)}" target="_blank" rel="noopener noreferrer">@${HANDLE} をフォロー</a></p>${END}`;
}

/** そのページの種別。対象外（一覧・記事でないページ）は null */
function kindOf(relPath, html) {
  const rel = String(relPath).replace(/\\/g, '/');
  const m = rel.match(/(?:^|\/)(journal|features)\/([^/]+\.html)$/);
  if (!m || m[2] === 'index.html') return null;
  if (m[2] === '_template.html') return m[1] === 'journal' ? 'journal' : null;
  // 記事（</article> あり）か、<article> を使わない旧い特集（共通フッターの印あり）。どちらも無ければ記事ではない
  if (!/<\/article>/.test(html) && !html.includes(ANCHOR)) return null;
  return m[1] === 'journal' ? 'journal' : 'feature';
}

/** 記事 HTML に部品を当てて返す（冪等）。挿入点（共通フッターの印）が無ければそのまま返す */
function applyFollowCta(html, kind) {
  const s = html.indexOf(START);
  if (s >= 0) {
    const e = html.indexOf(END, s);
    if (e < 0) return html;
    return html.slice(0, s) + renderCta(kind) + html.slice(e + END.length);
  }
  const at = html.indexOf(ANCHOR);
  if (at < 0) return html;
  return html.slice(0, at) + renderCta(kind) + '\n' + html.slice(at);
}

module.exports = { START, END, HANDLE, BASE, followUrl, renderCta, kindOf, applyFollowCta };
