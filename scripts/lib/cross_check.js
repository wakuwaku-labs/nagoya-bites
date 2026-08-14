'use strict';
// ────────────────────────────────────────────────────
// スコア信頼度（TRUST SCORE / いわゆる「サクラチェック」の本体）
// ────────────────────────────────────────────────────
// ISSUE-049 で computeCrossCheckScore を build.js から抽出（挙動不変のリファクタ）。
// 目的: (a) tests/cross_check.test.js から単体テスト可能にする、
//       (b) scripts/audit_crosscheck_v3.js のシャドー比較から同一実装を参照する、
//       (c) build.js の肥大を抑える。
// v3.0 以降のスコアリング変更もこのファイルで行う（build.js 側は require するだけ）。
//
// V1 (ISSUE-048) の編集部手動運用依存（S3 visitStatus / S6 insiderReviews）を解消し、
// 機械的に取れる客観シグナルと、ユーザー要望「点数の変動・時系列パターン」を
// 真のサクラ判定要素として組み込んだ 8 シグナル設計。
//
//   S1: Google★ vs 件数比率           (max 15)
//   S2: レビュー件数絶対値             (max 10)
//   S3: データ充実度                   (max 15) [V3 で置換]
//   S4: 他媒体掲載クロスチェック       (max 10) [据え置き・重み減]
//   S5: 営業実態継続                   (max 5)
//   S6: Instagram 実在シグナル         (max 10) [V3 で置換]
//   S7: レビュー時系列健全性           (max 20) [新規・places_history.json 月次差分]
//   S8: 評価分布の自然性               (max 15) [新規・最新5件U字型近似]
//
// placesHistoryEntry: data/places_history.json の対応エントリ
//   { snapshots: [{ts, rating, total}, ...], latestReviews: [{rating, time}, ...] }
function computeCrossCheckScore(store, placesHistoryEntry) {
  const breakdown = {
    s1_googleRatingVsCount:    { score: 0, max: 15, reason: '' },
    s2_reviewCountAbs:         { score: 0, max: 10, reason: '' },
    s3_dataCompleteness:       { score: 0, max: 15, reason: '' },
    s4_mediaCrossCheck:        { score: 0, max: 10, reason: '' },
    s5_operationContinuity:    { score: 0, max: 5,  reason: '' },
    s6_instagramPresence:      { score: 0, max: 10, reason: '' },
    s7_reviewTimeseries:       { score: 0, max: 20, reason: '' },
    s8_reviewDistribution:     { score: 0, max: 15, reason: '' }
  };

  const rating = parseFloat(store['Google評価']) || 0;
  const count = parseInt(store['口コミ数']) || 0;
  const hpId = store['ホットペッパーID'] || '';
  const mediaFeatures = Array.isArray(store.mediaFeatures) ? store.mediaFeatures : [];

  // ─── S1: Google★ vs 件数比率（max 15） ───
  if (count > 0 && rating > 0) {
    if (rating >= 4.6 && count < 50) {
      breakdown.s1_googleRatingVsCount.score = 3;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（少件数で高評価のためガチャレビュー疑い）`;
    } else if (rating >= 4.0 && count >= 100) {
      breakdown.s1_googleRatingVsCount.score = 15;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（高評価と十分な件数で整合）`;
    } else if (rating >= 4.0 && count >= 30) {
      breakdown.s1_googleRatingVsCount.score = 11;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（評価と件数のバランス良好）`;
    } else if (rating >= 3.5 && count >= 30) {
      breakdown.s1_googleRatingVsCount.score = 8;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（標準的な評価分布）`;
    } else if (rating >= 3.0) {
      breakdown.s1_googleRatingVsCount.score = 5;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（評価は標準）`;
    } else {
      breakdown.s1_googleRatingVsCount.score = 2;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（低評価）`;
    }
  } else if (rating > 0) {
    if (rating >= 4.5)      { breakdown.s1_googleRatingVsCount.score = 12; }
    else if (rating >= 4.0) { breakdown.s1_googleRatingVsCount.score = 10; }
    else if (rating >= 3.5) { breakdown.s1_googleRatingVsCount.score = 8; }
    else                    { breakdown.s1_googleRatingVsCount.score = 6; }
    breakdown.s1_googleRatingVsCount.reason = `★${rating}（件数情報なし・Places API 取得で正規化予定）`;
  } else {
    breakdown.s1_googleRatingVsCount.score = 5;
    breakdown.s1_googleRatingVsCount.reason = 'Google評価なし（Places API 取得予定）';
  }

  // ─── S2: レビュー件数絶対値（max 10） ───
  if (count >= 200)      { breakdown.s2_reviewCountAbs.score = 10; breakdown.s2_reviewCountAbs.reason = `${count}件（豊富なサンプル）`; }
  else if (count >= 100) { breakdown.s2_reviewCountAbs.score = 8;  breakdown.s2_reviewCountAbs.reason = `${count}件（十分なサンプル）`; }
  else if (count >= 50)  { breakdown.s2_reviewCountAbs.score = 6;  breakdown.s2_reviewCountAbs.reason = `${count}件（標準的なサンプル）`; }
  else if (count >= 30)  { breakdown.s2_reviewCountAbs.score = 4;  breakdown.s2_reviewCountAbs.reason = `${count}件（最低限のサンプル）`; }
  else if (count > 0)    { breakdown.s2_reviewCountAbs.score = 2;  breakdown.s2_reviewCountAbs.reason = `${count}件（サンプル不足）`; }
  else                   { breakdown.s2_reviewCountAbs.score = 6;  breakdown.s2_reviewCountAbs.reason = '件数情報なし（Places API 取得予定）'; }

  // ─── S3: データ充実度（max 15） ───
  // タグ ≥3個 / Instagram URL / 食べログ URL / おすすめポイント / 写真URL の 5 要素 × 3 点
  const tagCount = (store['タグ'] || '').split(',').filter(Boolean).length;
  const hasIG = !!(store['Instagram'] && String(store['Instagram']).trim());
  const hasTbl = !!(store['食べログURL'] && String(store['食べログURL']).trim());
  const hasReco = !!(store['おすすめポイント'] && String(store['おすすめポイント']).trim());
  const hasPhoto = !!(store['写真URL'] && String(store['写真URL']).trim());
  const dcParts = [];
  let dcScore = 0;
  if (tagCount >= 3) { dcScore += 3; dcParts.push(`タグ${tagCount}個`); }
  if (hasIG)         { dcScore += 3; dcParts.push('IG解決'); }
  if (hasTbl)        { dcScore += 3; dcParts.push('食べログ解決'); }
  if (hasReco)       { dcScore += 3; dcParts.push('推薦文'); }
  if (hasPhoto)      { dcScore += 3; dcParts.push('写真'); }
  breakdown.s3_dataCompleteness.score = dcScore;
  breakdown.s3_dataCompleteness.reason = dcParts.length ? dcParts.join('・') + ' あり' : 'データ拡充未着手';

  // ─── S4: 他媒体掲載クロスチェック（max 10・据え置き） ───
  // 媒体数は「記事数」ではなく「異なる媒体名の数」でカウント
  // （同一 note.com 記事が複数タグに出ても 1 カウント）
  const mfCount = new Set(mediaFeatures.map(m => m.name).filter(Boolean)).size;
  if (mfCount >= 4)      { breakdown.s4_mediaCrossCheck.score = 10; breakdown.s4_mediaCrossCheck.reason = `${mfCount}媒体に掲載（強い第三者検証）`; }
  else if (mfCount >= 2) { breakdown.s4_mediaCrossCheck.score = 8;  breakdown.s4_mediaCrossCheck.reason = `${mfCount}媒体に掲載`; }
  else if (mfCount === 1){ breakdown.s4_mediaCrossCheck.score = 5;  breakdown.s4_mediaCrossCheck.reason = '1媒体に掲載'; }
  else                   { breakdown.s4_mediaCrossCheck.score = 0;  breakdown.s4_mediaCrossCheck.reason = 'メディア掲載情報なし'; }

  // ─── S5: 営業実態継続（max 5） ───
  if (hpId) { breakdown.s5_operationContinuity.score = 5; breakdown.s5_operationContinuity.reason = 'Hot Pepper 営業継続中'; }
  else      { breakdown.s5_operationContinuity.score = 2; breakdown.s5_operationContinuity.reason = '営業実態は手動キュレーションで確認'; }

  // ─── S6: Instagram 実在シグナル（max 10） ───
  // 公式 IG アカウント (+7) + 最新投稿 URL (+3) = max 10
  const hasIGPost = !!(store['Instagram投稿URL'] && String(store['Instagram投稿URL']).trim());
  let igScore = 0;
  const igParts = [];
  if (hasIG)     { igScore += 7; igParts.push('公式アカウント'); }
  if (hasIGPost) { igScore += 3; igParts.push('最新投稿'); }
  breakdown.s6_instagramPresence.score = igScore;
  breakdown.s6_instagramPresence.reason = igParts.length ? igParts.join('・') + ' あり' : 'Instagram 解決なし';

  // ─── S7: レビュー時系列健全性（max 20）／ ISSUE-049 新規 ───
  // a: 投稿ペース安定性 (max 8) — places_history.json の月次 user_ratings_total 差分
  // b: 最新レビュー★ vs 全体★ の乖離 (max 6)
  // c: 最新レビュー★の標準偏差 (max 6)
  const snapshots = (placesHistoryEntry && Array.isArray(placesHistoryEntry.snapshots)) ? placesHistoryEntry.snapshots : [];
  const latestReviews = (placesHistoryEntry && Array.isArray(placesHistoryEntry.latestReviews)) ? placesHistoryEntry.latestReviews : [];
  let s7a = 0, s7b = 0, s7c = 0;
  const s7reasons = [];
  let openingBurstPattern = false;

  // a: 投稿ペース安定性
  if (snapshots.length >= 3) {
    const deltas = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1].total;
      const curr = snapshots[i].total;
      if (typeof prev === 'number' && typeof curr === 'number' && curr >= prev) {
        deltas.push(curr - prev);
      }
    }
    if (deltas.length >= 2) {
      const sum = deltas.reduce((a, b) => a + b, 0);
      const mean = sum / deltas.length;
      const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      const firstDelta = deltas[0];
      const lastDelta = deltas[deltas.length - 1];
      if (firstDelta >= 20 && lastDelta <= 2) {
        s7a = 1; openingBurstPattern = true;
        s7reasons.push(`投稿急増→失速（初+${firstDelta}/直近+${lastDelta}）`);
      } else if (cv <= 0.5) { s7a = 8; s7reasons.push('投稿ペース安定'); }
      else if (cv <= 1.0)   { s7a = 5; s7reasons.push('投稿ペース概ね安定'); }
      else                   { s7a = 3; s7reasons.push('投稿ペースばらつきあり'); }
    } else {
      s7a = 4; s7reasons.push('履歴蓄積中');
    }
  } else {
    s7a = 4; s7reasons.push('月次履歴未蓄積（初月）');
  }

  // b: 最新レビュー★ vs 全体★ の乖離
  if (latestReviews.length >= 3 && rating > 0) {
    const validRatings = latestReviews.map(r => r.rating).filter(r => typeof r === 'number');
    if (validRatings.length >= 3) {
      const latestAvg = validRatings.reduce((a, b) => a + b, 0) / validRatings.length;
      const diff = latestAvg - rating;
      if (Math.abs(diff) <= 0.3) {
        s7b = 6; s7reasons.push(`最新★${latestAvg.toFixed(1)}≒全体★${rating}`);
      } else if (diff >= 0.8) {
        s7b = 1; s7reasons.push(`最新★が全体より+${diff.toFixed(1)}（サクラ継続投入疑い）`);
      } else if (diff <= -0.8) {
        s7b = 1; s7reasons.push(`最新★が全体より${diff.toFixed(1)}（化粧剥がれパターン）`);
      } else {
        s7b = 4; s7reasons.push(`最新★${latestAvg.toFixed(1)}・全体★${rating}（軽微な乖離）`);
      }
    } else {
      s7b = 3; s7reasons.push('最新レビュー★情報なし');
    }
  } else {
    s7b = 3; s7reasons.push('最新レビュー未取得');
  }

  // c: 最新レビュー★の標準偏差
  if (latestReviews.length >= 3) {
    const ratings = latestReviews.map(r => r.rating).filter(r => typeof r === 'number');
    if (ratings.length >= 3) {
      const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const stddev = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / ratings.length);
      if (stddev >= 0.5 && stddev <= 1.5) {
        s7c = 6; s7reasons.push(`標準偏差${stddev.toFixed(2)}（自然な分布）`);
      } else if (stddev < 0.5) {
        s7c = 2; s7reasons.push(`標準偏差${stddev.toFixed(2)}（一様すぎ・評価操作疑い）`);
      } else {
        s7c = 2; s7reasons.push(`標準偏差${stddev.toFixed(2)}（極端な分散）`);
      }
    } else {
      s7c = 3; s7reasons.push('標準偏差判定不可');
    }
  } else {
    s7c = 3; s7reasons.push('最新レビュー件数不足');
  }

  breakdown.s7_reviewTimeseries.score = s7a + s7b + s7c;
  breakdown.s7_reviewTimeseries.reason = s7reasons.join(' / ');

  // ─── S8: 評価分布の自然性（max 15・U字型近似）／ ISSUE-049 新規 ───
  let uShapedDistribution = false;
  if (latestReviews.length >= 5) {
    let high = 0, low = 0, mid = 0;
    for (const r of latestReviews) {
      const rt = r.rating;
      if (typeof rt !== 'number') continue;
      if (rt >= 4.5)      high++;
      else if (rt <= 1.5) low++;
      else                mid++;
    }
    if (high >= 2 && low >= 2 && mid <= 1) {
      breakdown.s8_reviewDistribution.score = 2;
      breakdown.s8_reviewDistribution.reason = `★5系${high}件・★1系${low}件・中間${mid}件（U字型疑い）`;
      uShapedDistribution = true;
    } else if (mid >= 3) {
      breakdown.s8_reviewDistribution.score = 15;
      breakdown.s8_reviewDistribution.reason = `★5系${high}件・★1系${low}件・中間${mid}件（自然な分布）`;
    } else if (high >= 4 && low === 0) {
      breakdown.s8_reviewDistribution.score = 11;
      breakdown.s8_reviewDistribution.reason = `★5系${high}件・★1系${low}件・中間${mid}件（高評価集中）`;
    } else {
      breakdown.s8_reviewDistribution.score = 8;
      breakdown.s8_reviewDistribution.reason = `★5系${high}件・★1系${low}件・中間${mid}件`;
    }
  } else if (latestReviews.length > 0) {
    breakdown.s8_reviewDistribution.score = 7;
    breakdown.s8_reviewDistribution.reason = `最新${latestReviews.length}件のみ（判定保留）`;
  } else {
    breakdown.s8_reviewDistribution.score = 7;
    breakdown.s8_reviewDistribution.reason = '最新レビュー情報なし（中立扱い）';
  }

  const total = Object.values(breakdown).reduce((sum, b) => sum + b.score, 0);

  // 内部フラグ（Inspector 月次レビュー用・LOCAL_STORES には焼き付けない）
  const flags = {};
  if (rating >= 4.6 && count > 0 && count < 50) flags.gachaReviewSuspicion = true;
  if (store['食べログURL'] && rating > 0 && rating <= 3.2) flags.mediaDiscrepancy = true;
  if (openingBurstPattern) flags.openingBurstPattern = true;
  if (uShapedDistribution) flags.uShapedDistribution = true;

  return {
    crossCheckScore: total,
    crossCheckBreakdown: breakdown,
    crossCheckFlags: flags,
    crossCheckScoreVersion: '2.0'
  };
}

module.exports = { computeCrossCheckScore };
