'use strict';
/**
 * 店の「選定理由」（editorReason）を画面に出すかどうかの唯一の判定（SEO-143・SEO-124）。
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

// 「訪問済」「店主取材済」は、訪問・取材の日付の記録（visitedOn）を出せる店だけ（ADR 0069 決定8・基本方針 S1-1）。
// 記録が無い店は、実際に行ったと読めない「公開情報ベース」として扱う。
function effectiveVisitStatus(s) {
  const v = (s && s.visitStatus) || '';
  if ((v === 'visited' || v === 'interview') && !(s && s.visitedOn)) return 'desk';
  return v;
}

function visitStatusLabel(s) {
  return VISIT_STATUS_LABELS[effectiveVisitStatus(s)] || '';
}

function visitStatusRank(s) {
  const i = VISIT_STATUS_RANK.indexOf(effectiveVisitStatus(s));
  return i < 0 ? VISIT_STATUS_RANK.length : i;
}

module.exports = { effectiveVisitStatus, VISIT_STATUS_LABELS, sameSentence, editorReasonOf, visitStatusLabel, visitStatusRank };
