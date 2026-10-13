'use strict';
/**
 * 日次ジャーナルの採点: 「語を入れると点が上がる」加点をやめた（P-333・判断の記録 0030）
 *
 * brand_fit には、候補の本文に特定の10語（運営の立場や「誰の目線か」を名乗る語）が1語でも入っていれば +3、
 * という加点があった。語の有無は中身の検証ではなく、書き手にその語を書かせる動機になる。
 * 2026-10-11 のオーナー指示（人の飲食業界関係者が店を選んでいるような表現を使わない）の語を、
 * 書く前の段階で報酬にしてしまうので、加点をやめ、同じ3点をベースへ畳み込んだ（8 → 11）。
 * ここでは、語の有無で点が動かないこと・ほかの加減点（一次情報源・Strategic Skip・匿名運営違反）が
 * 変わっていないことを見る。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scoreBrandFit, scoreOne, WEIGHTS } = require('../scripts/score_journal_candidates');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'score_journal_candidates.js'), 'utf8');

// 旧い加点の語（BRAND_FIT_BONUS_KEYWORDS）。ここに残すのは、入れても点が動かないことを確かめるため
const FORMER_BONUS_WORDS = ['業界人', '編集部', '現役', '匿名', 'editorReason', 'mediaFeatures', 'insiderNote', 'オペ', '裏側', '目利き'];

const PRIMARY = { label: '公式プレスリリース', url: 'https://prtimes.jp/main/html/rd/p/x.html', date: '2026-10-01' };
const SECONDARY = { label: 'まとめ媒体', url: 'https://jouhou.nagoya/x/', date: '2026-10-01' };

function cand(over = {}) {
  return Object.assign({
    id: 't1',
    theme: 'today_one',
    title_draft: '名駅の個室で使う接待の予約の読み方',
    lead_draft: 'カウンター席と個室の構成、コースの価格帯、予約の取り方を整理します。',
    angle: '価格帯と席の構成、予約の取り方、接待での使い方を読む',
    sources: [SECONDARY],
  }, over);
}

test('ブランド整合の満点は15のまま。ベースは11、一次情報源を押さえると +4', () => {
  assert.equal(WEIGHTS.brand_fit, 15);
  assert.equal(scoreBrandFit(cand()).score, 11);
  assert.equal(scoreBrandFit(cand({ sources: [SECONDARY, PRIMARY] })).score, 15);
});

for (const word of FORMER_BONUS_WORDS) {
  test(`旧い加点の語「${word}」を、angle・リード・タイトルのどこに入れても、点も理由も変わらない`, () => {
    const base = scoreBrandFit(cand());
    for (const field of ['angle', 'lead_draft', 'title_draft']) {
      const c = cand();
      c[field] = `${c[field]} ${word}`;
      const r = scoreBrandFit(c);
      assert.equal(r.score, base.score, `${field} に ${word} を入れると点が動いた`);
      assert.deepEqual(r.reasons, base.reasons, `${field} に ${word} を入れると理由の行が変わった`);
    }
  });
}

test('総合の採点でも、旧い加点の語を全部入れて同じブランド点になる（理由に語の加点が出ない）', () => {
  const policy = { auto_publish_min: 100, review_publish_min: 85 };
  const published = { entries: [] };
  const plain = scoreOne(cand({ sources: [SECONDARY, PRIMARY] }), published, '2026-10-13', policy);
  const worded = scoreOne(
    cand({ sources: [SECONDARY, PRIMARY], angle: `${cand().angle} ${FORMER_BONUS_WORDS.join(' ')}` }),
    published, '2026-10-13', policy,
  );
  assert.equal(plain.breakdown.brand_fit, 15);
  assert.equal(worded.breakdown.brand_fit, 15);
  assert.equal(worded.explain.brand_fit.some((l) => /キーワード/.test(l)), false);
});

test('Strategic Skip に当たる語は1件ごとに -5（語を入れても相殺されない）', () => {
  assert.equal(scoreBrandFit(cand({ title_draft: '名駅の個室、クーポンで使う' })).score, 6);
  assert.equal(scoreBrandFit(cand({ title_draft: '名駅の個室、クーポンと割引で使う' })).score, 1);
  assert.equal(scoreBrandFit(cand({ title_draft: `名駅の個室、クーポンで使う ${FORMER_BONUS_WORDS.join(' ')}` })).score, 6);
});

test('匿名運営違反（固有名＋役職）は -15 で、0 未満にはならない', () => {
  const r = scoreBrandFit(cand({ lead_draft: '山田大将が語る、カウンター席の予約の取り方です。', sources: [PRIMARY] }));
  assert.equal(r.score, 0);
  assert.ok(r.reasons.some((l) => /匿名運営違反/.test(l)));
});

test('採点器の元に、語を入れると点が上がる加点の定数も説明も残っていない', () => {
  assert.equal(SRC.includes('BRAND_FIT_BONUS_KEYWORDS'), false);
  assert.equal(SRC.includes('業界人視点キーワード'), false);
});
