'use strict';
/**
 * scripts/lib/filter_policy.js — トップの絞り込み（I-20・判断の記録 0037）が使う、ハブと同じ意味のエリアと条件の表を作る。
 *
 * 材料は data/area_genre_pages_policy.json の areas と conditions だけ（エリア10群・条件13軸）。
 * ハブ（stores/area/…）と、トップの「絞り込み」のシートが、同じ言葉・同じ判定で同じ店を指すようにするため、
 * 値はこの JSON から作る（index.html に手で写さない。写すと、JSON を直したときに食い違う）。
 * 条件ごとの判定（述語）は、データの欄を読む処理なので index.html に持つ。ポリシーの全ルールにページの述語があることは
 * tests/index_filter_sheet.test.js が見る。
 */

/** @param {{areas?:object[], conditions?:object[]}} policy */
function buildFilterPolicy(policy) {
  const areas = (policy.areas || []).map((a) => ({
    slug: String(a.slug),
    label: String(a.label),
    ward: a.ward ? String(a.ward) : '',
    match: (a.match || []).map(String),
    addressMatch: (a.addressMatch || []).map(String),
  }));
  const conds = (policy.conditions || []).map((c) => ({
    slug: String(c.slug),
    label: String(c.label),
    rule: String(c.rule),
  }));
  return { areas, conds };
}

/** index.html の目印の間に入れる 1 行（`<` は < にして、`</script>` で閉じられないようにする） */
function renderFilterPolicy(obj) {
  return 'var NB_FILTER_POLICY = ' + JSON.stringify(obj).replace(/</g, '\\u003c') + ';';
}

const REGION = ['/* NB-FILTER-POLICY:START */', '/* NB-FILTER-POLICY:END */'];

module.exports = { buildFilterPolicy, renderFilterPolicy, REGION };
