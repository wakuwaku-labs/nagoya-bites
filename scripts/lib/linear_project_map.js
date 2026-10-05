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

/**
 * backlog の owner（「Builder + DataKeeper」「片桐 ← Editor」等の自由記述）→ 役割ラベル（docs/decisions/0005）。
 * Linear の担当者はLinearユーザーしかなれないため、AIエージェントの役割はラベルで表す。
 * 役割名は語の境界で照合し、owner に現れた順に並べる。オーナー本人の操作が要る課題には
 * ownerActionLabel を先頭に付ける。どれにも当たらなければ空配列（ラベルなし）。
 */
function roleLabelsForOwner(owner, defaults = {}) {
  const cfg = defaults.roleLabels;
  if (!cfg || !owner) return [];
  const text = String(owner);
  const labels = [];
  if ((cfg.ownerActionKeywords || []).some(k => text.includes(k))) labels.push(cfg.ownerActionLabel);
  const found = (cfg.roles || [])
    .map(role => ({ role, at: text.search(new RegExp(`(^|[^A-Za-z])${role}($|[^A-Za-z])`)) }))
    .filter(x => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  for (const { role } of found) labels.push(`${cfg.prefix}${role}`);
  return labels;
}

function isRoleLabel(name, defaults = {}) {
  const prefix = defaults.roleLabels?.prefix;
  return Boolean(prefix) && String(name || '').startsWith(prefix);
}

/**
 * 課題1件に付けるラベル（KR＋役割）。新規起票の全経路（backlog同期・夜間QA）と既存補完が共有する。
 */
function labelsForTask({ category, owner } = {}, defaults = {}) {
  return [krLabelForCategory(category, defaults), ...roleLabelsForOwner(owner, defaults)].filter(Boolean);
}

/** backlog の課題ブロック（Markdown）から category / owner を読む。Linear が付ける \\ エスケープにも耐える。 */
function fieldsFromBlock(block) {
  const text = String(block || '').replace(/\\([\[\]_*])/g, '$1');
  const field = name => (text.match(new RegExp(`\\*\\*${name}\\*\\*\\s*[:：]\\s*([^\\n（(]+)`)) || [])[1]?.trim() || null;
  return { category: field('category'), owner: field('owner') };
}

module.exports = { krLabelForCategory, isKrLabel, roleLabelsForOwner, isRoleLabel, labelsForTask, fieldsFromBlock };
