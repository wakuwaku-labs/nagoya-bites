'use strict';
/**
 * 週の投稿の予定（SNS分析ツールの next.json・plan.slots[].topic）を、記事の候補選びの「同点・僅差のときの弱い加点」にする。
 * - 採点（total）・判定（verdict）・失格ゲートは一切変えない。並べ替えのキーにだけ足す。
 * - topic と候補が「明確に一致」するときだけ足す。対応表に無い題材・どれにも当たらない候補は加点なし。
 * - 使えない（予定が無い・古い・週が違う・オフ）ときは今までどおり。例外は投げない。
 */
const S = require('./sns_analyzer');

/** 同点・僅差のときだけ効かせる加点。満点 110 に対して 2 点（auto 95 / review 85 の差 10 点より十分小さい）。 */
const TIEBREAK_BONUS = 2;

// topic → 候補の本文（題名・切り口・ジャンル）に出る語。語が曖昧なもの（「イベント」の「祭」など）は入れない。
const TOPIC_PATTERNS = {
  '喫茶・カフェ': /喫茶|カフェ|珈琲|コーヒー/,
  '宴会・忘年会': /宴会|忘年会|新年会|歓送迎|貸切宴会/,
  'ひとり飲み・ひとりごはん': /ひとり飲み|一人飲み|ひとりごはん|一人ごはん|おひとりさま|ひとり客|一人客|ひとり席|カウンター.{0,6}ひとり/,
  'デート': /デート/,
  'イベント': /イベント|フェア|フェス|ポップアップ|周年祭/,
};

/** 候補が topic に明確に一致するか。 */
function matchesTopic(candidate, topic) {
  const re = TOPIC_PATTERNS[topic];
  if (!re || !candidate) return false;
  const g = candidate.main_store && candidate.main_store.genre;
  const text = [candidate.title_draft, candidate.angle, g].filter((x) => typeof x === 'string').join(' ');
  return re.test(text);
}

/** 並べ替えに足す点（一致なら TIEBREAK_BONUS、でなければ 0）と理由。 */
function bonusFor(candidate, planTopic) {
  if (!planTopic || !planTopic.topic) return { bonus: 0 };
  if (!matchesTopic(candidate, planTopic.topic)) return { bonus: 0 };
  return { bonus: TIEBREAK_BONUS, reason: `週の予定の題材「${planTopic.topic}」に一致 +${TIEBREAK_BONUS}（並べ替えのみ・採点と判定は不変）` };
}

/** date（JST の YYYY-MM-DD）の予定の題材。使えなければ { topic: null, reason }。 */
function loadPlanTopic(date, policy, now = new Date()) {
  const cfg = policy && policy.planExperiment;
  if (!cfg || cfg.enabled !== true) return { topic: null, reason: 'off' };
  try {
    const r = S.readFresh('next.json', { schema: 'x-next/1', maxAgeDays: Number(cfg.maxAgeDays) || 8, now });
    if (!r.ok) return { topic: null, reason: r.reason };
    const p = S.pickSlot(r.data, date);
    if (!p.ok) return { topic: null, reason: p.reason };
    if (!p.plan.topic) return { topic: null, reason: 'no_topic' };
    return { topic: p.plan.topic, week: p.plan.week, slot: p.plan.slot, role: p.plan.role };
  } catch (e) { return { topic: null, reason: `error:${e.message}` }; }
}

module.exports = { TIEBREAK_BONUS, TOPIC_PATTERNS, matchesTopic, bonusFor, loadPlanTopic };
