/**
 * backlog の category（自由記述）→ KR ラベルの決定的な対応づけ。
 * Linear の構成は「Project = Nagoya Bites（1つ）、KR = ラベル」（docs/decisions/0003）。
 * 規則の正本は data/linear_issue_defaults.json の krLabelRules（上から順に評価）。
 *
 * category は「SEO / data-quality」のように複数語を / で並べた形が多い。先頭の語が主分類なので、
 * まず先頭の語だけで規則を引き、当たらなければ全体で引く。どれにも当たらなければ null（ラベルなし）。
 * 推測ではなく設定された規則の機械的な適用であり、結果は誰でも同じ入力から再現できる（制約10）。
 */

// 英字キーワードは語の境界で照合する（"ci" が "social" に当たらないように）。
function matches(text, rule) {
  const lower = String(text || '').toLowerCase();
  return (rule.keywords || []).some(k => {
    const key = String(k).toLowerCase();
    if (!/^[a-z0-9 -]+$/.test(key)) return lower.includes(key);
    const escaped = key.replace(/[-]/g, '\\-');
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(lower);
  });
}

function krLabelForCategory(category, defaults = {}) {
  const rules = defaults.krLabelRules || [];
  if (!category) return null;
  const primary = String(category).split(/[/／・,、]/)[0].trim();
  for (const target of [primary, category]) {
    const hit = rules.find(rule => matches(target, rule));
    if (hit) return hit.label;
  }
  return null;
}

function isKrLabel(name) {
  return /^KR:/.test(String(name || ''));
}

module.exports = { krLabelForCategory, isKrLabel };
