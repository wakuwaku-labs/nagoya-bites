'use strict';

/**
 * scripts/lib/trust_display.js
 *
 * 「口コミ信頼度」の判定器の正本。基準そのものは data/trust_display_policy.json
 * （唯一の情報源）。ここは実装だけを持つ。
 *
 * ── 何を判定するか ───────────────────────────────────────────
 * scripts/lib/cross_check.js が出した 8 軸の内訳（observed 付き）を受け取り、
 * 消費者向けの「口コミ信頼度」＝「この店の Google ★と件数は、そのまま信じてよいか」
 * への答えを、段階（A〜D／—）・0-100 の数字・助言語・検証カバー率に変換する。
 *
 * ── 採点の原則（CLAUDE.md 制約10・品質ゲート原則5）────────────
 *  - 分母に入れるのは「観測できた検証項目」だけ。中立フォールバック（データが無い
 *    ので真ん中の点を返した項目）は、得点にも分母にも入れない。
 *    → 検証できた範囲の中で何点だったかを出し、検証できた範囲の広さは coverage で
 *      別に見せる（「信じてよいか」と「どれだけ確かめたか」を混ぜない）
 *  - S3/S5/S6（掲載データの充実度）はサイト側の都合であって口コミの信用度ではない。
 *    採点に入れず meta として別枠で見せる
 *  - 観測項目が policy.minObserved 未満なら段階「—」（判定材料不足）。取り繕わない
 *  - 段階の語は店への評価ではなく読者への助言。公開文言に結論語（疑い等）は使わない
 *
 * 利用側: build.js（全店に reviewTrust を付与・index.html に TRUST_POLICY を注入）、
 *         gen-store-pages.js（店舗ページ）、index.html（カード／モーダル／ソート）、
 *         scripts/audit_trust_wording.js（CI 監査）、tests/trust_display.test.js
 */

const fs   = require('fs');
const path = require('path');

const POLICY_PATH = path.resolve(__dirname, '..', '..', 'data', 'trust_display_policy.json');

let _policy = null;
function loadPolicy(force) {
  if (!_policy || force) _policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  return _policy;
}

/** 0-100 の数字を段階へ。null は「—」 */
function tierOf(score, policy) {
  const p = policy || loadPolicy();
  if (typeof score !== 'number' || !isFinite(score)) return p.na;
  const tiers = [...p.tiers].sort((a, b) => b.min - a.min);
  for (const t of tiers) if (score >= t.min) return t;
  return tiers[tiers.length - 1];
}

/** 検証項目 1 つの {score,max,observed,reason} を breakdown から取り出す */
function pickCheck(breakdown, check) {
  const axis = breakdown && breakdown[check.axis];
  if (!axis) return null;
  if (check.part) {
    const part = Array.isArray(axis.parts) ? axis.parts.find(x => x.id === check.part) : null;
    if (!part) return null;
    return { id: check.id, observed: !!part.observed, score: part.score, max: part.max, reason: part.reason || '' };
  }
  return { id: check.id, observed: !!axis.observed, score: axis.score, max: axis.max, reason: axis.reason || '' };
}

function fmt(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
}

/**
 * 判定本体。
 * @param store   LOCAL_STORES の 1 店（Google評価 / 口コミ数 を読む）
 * @param ccResult computeCrossCheckScore() の戻り値（crossCheckBreakdown を読む）
 * @param opts    { lastChecked: 'YYYY-MM-DD'|null, policy }
 */
function evaluate(store, ccResult, opts) {
  const p = (opts && opts.policy) || loadPolicy();
  const bd = (ccResult && ccResult.crossCheckBreakdown) || (ccResult && ccResult.s1_googleRatingVsCount ? ccResult : null) || {};
  const checks = p.checks.map(c => pickCheck(bd, c)).filter(Boolean);
  const observed = checks.filter(c => c.observed);
  let earned = 0, denom = 0;
  for (const c of observed) { earned += c.score; denom += c.max; }

  let score = null;
  let tier = p.na;
  if (observed.length >= p.minObserved && denom > 0) {
    score = Math.round(earned / denom * 100);
    tier = tierOf(score, p);
  }

  const rating = parseFloat(store && store['Google評価']) || 0;
  const count = parseInt(store && store['口コミ数']) || 0;
  const advice = tier.advice;
  const headline = (rating > 0 && count > 0)
    ? fmt(p.headline, { rating, count, advice })
    : fmt(p.headlineNoRating, { advice });

  const meta = p.meta.map(m => {
    const axis = bd[m.axis];
    return axis ? { axis: m.axis, label: m.label, score: axis.score, max: axis.max, reason: axis.reason || '' } : null;
  }).filter(Boolean);

  return {
    score,
    tier: tier.id,
    tierLabel: tier.label,
    advice,
    headline,
    coverage: { observed: observed.length, total: p.checks.length },
    lastChecked: (opts && opts.lastChecked) || null,
    checks: checks.map(c => ({ id: c.id, observed: c.observed, score: c.score, max: c.max })),
    meta,
    scoreVersion: p.scoreVersion
  };
}

/** LOCAL_STORES / stores.json に載せる最小形（カード・ソート・JSON-LD 用） */
function toSlim(full) {
  if (!full) return null;
  return {
    s: full.score,
    t: full.tier,
    c: `${full.coverage.observed}/${full.coverage.total}`,
    d: full.lastChecked || ''
  };
}

/** data/crosscheck.json に同梱する形（モーダル・店舗ページ用）。reason 本文は軸側を参照するので持たない */
function toCompact(full) {
  if (!full) return null;
  return {
    s: full.score,
    t: full.tier,
    h: full.headline,
    c: full.coverage,
    d: full.lastChecked || '',
    k: full.checks.map(c => [c.id, c.observed ? 1 : 0, c.score, c.max]),
    v: full.scoreVersion
  };
}

/** compact → full 相当へ戻す（表示側ヘルパー。policy の語彙で補完） */
function fromCompact(compact, policy) {
  const p = policy || loadPolicy();
  if (!compact) return null;
  const tier = compact.t === p.na.id ? p.na : (p.tiers.find(t => t.id === compact.t) || p.na);
  return {
    score: compact.s, tier: tier.id, tierLabel: tier.label, advice: tier.advice,
    headline: compact.h, coverage: compact.c, lastChecked: compact.d || null,
    checks: (compact.k || []).map(k => ({ id: k[0], observed: !!k[1], score: k[2], max: k[3] })),
    scoreVersion: compact.v
  };
}

/**
 * 「Google口コミ取得日」。places_history の snapshots 末尾 ts → 無ければ buildDate。
 * 大半の店が古い日付になる（週次 100 件ローテ）のは事実なので隠さない。
 */
function lastCheckedFrom(historyEntry, buildDate) {
  const snaps = historyEntry && Array.isArray(historyEntry.snapshots) ? historyEntry.snapshots : [];
  for (let i = snaps.length - 1; i >= 0; i--) {
    const ts = snaps[i] && snaps[i].ts;
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }
  return buildDate || null;
}

// index.html への注入（LOCAL_STORES / STORES_JSON_VERSION と同じ置換方式）
const TRUST_POLICY_RE = /^var TRUST_POLICY = \{.*\};$/m;

/** 公開面に必要な部分だけを注入する（説明文・内部メモは含めない） */
function publicPolicy(policy) {
  const p = policy || loadPolicy();
  return {
    name: p.name, shortName: p.shortName, enLabel: p.enLabel, question: p.question,
    sortLabel: p.sortLabel, minObserved: p.minObserved, scoreVersion: p.scoreVersion,
    tiers: p.tiers, na: p.na,
    headline: p.headline, headlineNoRating: p.headlineNoRating,
    coverageLabel: p.coverageLabel, lastCheckedLabel: p.lastCheckedLabel,
    pendingLabel: p.pendingLabel, notObservedLabel: p.notObservedLabel,
    checks: p.checks, metaHeading: p.metaHeading, meta: p.meta, pages: p.pages
  };
}

function injectTrustPolicy(html, policy) {
  const json = JSON.stringify(publicPolicy(policy));
  if (/<\/|<!--/.test(json)) throw new Error('TRUST_POLICY に "</" または "<!--" を含められません');
  if (!TRUST_POLICY_RE.test(html)) throw new Error('index.html に var TRUST_POLICY = {...}; のプレースホルダがありません');
  return html.replace(TRUST_POLICY_RE, () => `var TRUST_POLICY = ${json};`);
}

module.exports = {
  loadPolicy, tierOf, evaluate, toSlim, toCompact, fromCompact,
  lastCheckedFrom, injectTrustPolicy, publicPolicy, TRUST_POLICY_RE, POLICY_PATH
};
