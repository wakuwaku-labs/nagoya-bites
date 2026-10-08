'use strict';
/**
 * 店の「編集部の選定理由」（editorReason）を画面に出すかどうかの唯一の判定（SEO-143・SEO-124）。
 * 店舗ページ（gen-store-pages.js）とエリア×ジャンルのハブ（scripts/gen_area_genre_pages.js）が共有する。
 * おすすめポイントと同じ文なら出さない（同じ文を2度並べない）。選定の根拠は visitStatus をそのまま語にする。
 */
const VISIT_STATUS_LABELS = {
  visited: '訪問済',
  interview: '店主取材済',
  desk: '公開情報ベース',
  industry_known: '業界内で評判',
  desk_automated: '公開情報ベース（自動収集）',
};

// 根拠の強い順（ハブで複数の店を並べるときの順）
const VISIT_STATUS_RANK = ['visited', 'interview', 'industry_known', 'desk', 'desk_automated'];

function sameSentence(a, b) {
  const norm = v => String(v || '').trim().replace(/[。．]+$/, '');
  return norm(a) !== '' && norm(a) === norm(b);
}

// 出してよい選定理由（無ければ ''）
function editorReasonOf(s) {
  const reason = String((s && s.editorReason) || '').trim();
  if (!reason || sameSentence(reason, s['おすすめポイント'])) return '';
  return reason;
}

function visitStatusLabel(s) {
  return VISIT_STATUS_LABELS[(s && s.visitStatus) || ''] || '';
}

function visitStatusRank(s) {
  const i = VISIT_STATUS_RANK.indexOf((s && s.visitStatus) || '');
  return i < 0 ? VISIT_STATUS_RANK.length : i;
}

module.exports = { VISIT_STATUS_LABELS, sameSentence, editorReasonOf, visitStatusLabel, visitStatusRank };
