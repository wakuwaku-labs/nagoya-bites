'use strict';
// 週の予定の題材を、記事の候補選びの同点・僅差のときの弱い加点にする（scripts/lib/journal_plan_topic.js・score_journal_candidates.js）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../scripts/lib/journal_plan_topic');
const S = require('../scripts/lib/sns_analyzer');
const W = require('../scripts/write_x_draft');
const { scoreAll } = require('../scripts/score_journal_candidates');

const cand = (id, title, extra = {}) => ({ id, title_draft: title, angle: '価格帯と席', main_store: { genre: '居酒屋' }, ...extra });

test('matchesTopic: 明確に一致するものだけ。対応表に無い題材・当たらない候補は false', () => {
  assert.ok(P.matchesTopic(cand('a', '栄の喫茶店で朝のモーニング'), '喫茶・カフェ'));
  assert.ok(P.matchesTopic(cand('a', '店', { main_store: { genre: 'カフェ' } }), '喫茶・カフェ'));
  assert.ok(P.matchesTopic(cand('a', '忘年会の幹事が見る個室'), '宴会・忘年会'));
  assert.ok(!P.matchesTopic(cand('a', '栄の居酒屋'), '喫茶・カフェ'));
  assert.ok(!P.matchesTopic(cand('a', '栄の喫茶店'), '知らない題材'));
  assert.ok(!P.matchesTopic(null, 'デート'));
  assert.deepStrictEqual(P.bonusFor(cand('a', '栄の居酒屋'), { topic: 'デート' }), { bonus: 0 });
  assert.strictEqual(P.bonusFor(cand('a', '栄のデート向け個室'), { topic: 'デート' }).bonus, P.TIEBREAK_BONUS);
  assert.deepStrictEqual(P.bonusFor(cand('a', 'デート'), null), { bonus: 0 });
});

test('pickSlot: topic と url_variant を返す（無ければ null）', () => {
  const next = { plan: { week: '2026-W42', slots: [{ slot: 3, role: 'explore', topic: '宴会・忘年会', url_variant: 'no_url', format: { nb_kind: 'number' } }] } };
  const r = S.pickSlot(next, '2026-10-15');
  assert.ok(r.ok);
  assert.strictEqual(r.plan.topic, '宴会・忘年会');
  assert.strictEqual(r.plan.url_variant, 'no_url');
  next.plan.slots[0].topic = undefined; next.plan.slots[0].url_variant = 'x';
  const r2 = S.pickSlot(next, '2026-10-15');
  assert.strictEqual(r2.plan.topic, null);
  assert.strictEqual(r2.plan.url_variant, null);
});

test('planRecord に topic を残す。planSection は題名が一致するときだけ題材を足す', () => {
  const plan = { week: 'w', slot: 3, role: 'explore', experiment_id: 'e', cell_id: 'c', topic: 'デート', url_variant: 'url', nb_kind: 'number', first_line: null, length: null };
  const rec = W.planRecord(plan, 'number');
  assert.strictEqual(rec.topic, 'デート');
  assert.strictEqual(rec.url_variant, 'url');
  assert.ok(W.planSection(plan, '池下のデート向けイタリアン').join('\n').includes('今週の予定の題材は「デート」'));
  assert.ok(!W.planSection(plan, '栄の居酒屋の昼飲み').join('\n').includes('今週の予定の題材'));
  assert.deepStrictEqual(W.planSection({ ...plan, nb_kind: null, topic: 'デート' }, '栄の居酒屋'), []);
});

function run(cands, planTopic) {
  const fakeDiv = { saturated: [] };
  return scoreAll(cands, { today: '2026-11-10', published: { entries: [] }, diversity: fakeDiv, planTopic, policy: { auto_publish_min: 0, review_publish_min: 0 } });
}

test('scoreAll: 加点は並べ替えだけ。total と verdict は不変、topic が無ければ今までどおり', () => {
  const cands = [cand('c1', '栄の居酒屋の相場'), cand('c2', '栄のデート向け個室')];
  const base = run(cands, null);
  const withTopic = run(cands, { topic: 'デート', week: '2026-W46', slot: 1 });
  for (const r of withTopic.ranked) assert.strictEqual(r.total, base.ranked.find((x) => x.id === r.id).total);
  assert.strictEqual(base.plan_topic, null);
  assert.strictEqual(withTopic.plan_topic.topic, 'デート');
  const c2 = withTopic.ranked.find((r) => r.id === 'c2');
  assert.strictEqual(c2.plan_topic_bonus, P.TIEBREAK_BONUS);
  assert.ok(c2.plan_topic_note);
  assert.strictEqual(withTopic.ranked.find((r) => r.id === 'c1').plan_topic_bonus, 0);
});

test('scoreAll: 同点なら一致した候補が選ばれ、点差が加点より大きければ覆らない。帯をまたがない', () => {
  // ジャンルだけが違う（点には効かない）ので同点になる
  const a = cand('a', '栄の相場'); const b = cand('b', '栄の相場', { main_store: { genre: 'カフェ' } });
  const base = run([a, b], null);
  assert.strictEqual(base.ranked[0].total, base.ranked[1].total);
  assert.strictEqual(base.selected_id, 'a');
  const r = run([a, b], { topic: '喫茶・カフェ' });
  assert.strictEqual(r.selected_id, 'b');
  assert.strictEqual(r.plan_topic_changed_selection, true);
  assert.strictEqual(run([a, b], { topic: '宴会・忘年会' }).selected_id, 'a');
  // 点差が加点より大きい: 一致候補の点を下げると覆らない
  const weak = cand('b', '栄の相場', { angle: '', main_store: { genre: 'カフェ' } });
  const r2 = run([a, weak], { topic: '喫茶・カフェ' });
  const gap = r2.ranked.find((x) => x.id === 'a').total - r2.ranked.find((x) => x.id === 'b').total;
  assert.ok(gap > P.TIEBREAK_BONUS, `gap=${gap}`);
  assert.strictEqual(r2.selected_id, 'a');
  // 帯: 一致候補が PASS_WITH_NOTE、他が PASS なら逆転しない
  const ta = base.ranked[0].total; const tw = r2.ranked.find((x) => x.id === 'b').total;
  const pol = { auto_publish_min: tw + 1, review_publish_min: 0 };
  const hi = scoreAll([a, weak], { today: '2026-11-10', published: { entries: [] }, diversity: { saturated: [] }, planTopic: { topic: '喫茶・カフェ' }, policy: pol });
  assert.ok(ta >= tw + 1);
  assert.strictEqual(hi.ranked.find((x) => x.id === 'b').verdict, 'PASS_WITH_NOTE');
  assert.strictEqual(hi.selected_id, 'a');
});

test('loadPlanTopic: オフ・無い・古い・別の週は topic なし。使えるときは題材を返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jpt-'));
  const old = process.env.SNS_ANALYZER_X_DIR;
  process.env.SNS_ANALYZER_X_DIR = dir;
  try {
    const now = new Date('2026-10-15T03:00:00Z');
    const on = { planExperiment: { enabled: true, maxAgeDays: 8 } };
    assert.strictEqual(P.loadPlanTopic('2026-10-15', { planExperiment: { enabled: false } }, now).reason, 'off');
    assert.strictEqual(P.loadPlanTopic('2026-10-15', on, now).topic, null);
    const next = { schema: 'x-next/1', generated_at: '2026-10-14T00:00:00Z', plan: { week: '2026-W42', slots: [{ slot: 3, role: 'explore', topic: 'デート', format: {} }] } };
    fs.writeFileSync(path.join(dir, 'next.json'), JSON.stringify(next));
    const r = P.loadPlanTopic('2026-10-15', on, now);
    assert.strictEqual(r.topic, 'デート');
    assert.strictEqual(P.loadPlanTopic('2026-10-22', on, new Date('2026-10-22T03:00:00Z')).topic, null);
    assert.strictEqual(P.loadPlanTopic('2026-10-15', on, new Date('2026-12-01T00:00:00Z')).reason, 'stale');
  } finally { if (old === undefined) delete process.env.SNS_ANALYZER_X_DIR; else process.env.SNS_ANALYZER_X_DIR = old; }
});
