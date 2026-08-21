'use strict';
// ────────────────────────────────────────────────────
// 口コミ信頼度の採点器 v2.2（シャドー実装・2026-08-21）
// ────────────────────────────────────────────────────
// 【本番未投入】build.js は引き続き scripts/lib/cross_check.js（v2.1）を require している。
// v2.1 に対して既存 S1〜S8 のロジック・重み・observed 条件は一切変更せず（regression risk ゼロ）、
// 新規シグナルを「独立した加算専用の軸」として2つ追加しただけの差分:
//
//   S7d: 投稿タイミングの短期集中検出（max 3・当初 max6 から実測に基づき半減）
//     cross_check_v3.js の S7d 実装を移植。v3 は同時に S1〜S8 の重み配分自体を
//     作り直しており（audit_crosscheck_v3.js 実測: 移動幅4,416店 / 目安503店で
//     Phase 3 未達）、全店に影響する再配点だった。v2.2 はこの1軸だけを既存8軸に
//     加算するため、「対象店（低ペースでバースト検出された店）以外はスコア不変」
//     という低ブラスト半径の変更になる。
//
//   S9: クロス店舗レビュー指紋照合（max 4・新設）
//     scripts/lib/review_fingerprint.js が data/places_history.json 全体を
//     一括スキャンして構築するハッシュインデックスを使い、「同一の口コミ文面」
//     「同一の投稿者名で複数店舗に短期間の高評価」を検出する。本文・投稿者名は
//     一切保存せず非可逆ハッシュのみを扱う（詳細は review_fingerprint.js 冒頭コメント）。
//
// 活性化前に確認すること（v3 と同じゲート思想）:
//   (a) scripts/audit_crosscheck_v22.js のシャドー比較結果を確認し、±10%ガイドライン
//       （1階級以上の移動が全店の10%程度に収まること）を満たしていること
//   (b) S9 は textHash/authorNameHash 付きの latestReviews が蓄積されるまで
//       ほとんどの店で observed:false のまま（PLACES_DETAILS_BUDGET が 0 で
//       --refresh 停止中のため、活性化直後は実質 S7d のみが効く）
//
// 活性化手順（ゲートを満たしたら）:
//   1. build.js の require('./scripts/lib/cross_check') を
//      require('./scripts/lib/cross_check_v22') に変更し、buildFingerprintIndex /
//      evaluateStoreFingerprint の呼び出しを追加（review_fingerprint.js 参照）
//   2. data/trust_display_policy.json の checks[] に s7d・s9 を追加
//   3. agent-backlog.md に scoreVersion 2.2 切替の ISSUE 履歴を追記
//   4. デプロイ後 node scripts/audit_trust_wording.js で禁止語なしを確認

function computeCrossCheckScore(store, placesHistoryEntry, fingerprintResult) {
  const breakdown = {
    s1_googleRatingVsCount:    { score: 0, max: 15, reason: '', observed: false },
    s2_reviewCountAbs:         { score: 0, max: 10, reason: '', observed: false },
    s3_dataCompleteness:       { score: 0, max: 15, reason: '', observed: true },
    s4_mediaCrossCheck:        { score: 0, max: 10, reason: '', observed: false },
    s5_operationContinuity:    { score: 0, max: 5,  reason: '', observed: true },
    s6_instagramPresence:      { score: 0, max: 10, reason: '', observed: true },
    s7_reviewTimeseries:       { score: 0, max: 20, reason: '', observed: false, parts: [] },
    s7d_reviewBurstCluster:    { score: 0, max: 3,  reason: '', observed: false },
    s8_reviewDistribution:     { score: 0, max: 15, reason: '', observed: false },
    s9_crossStoreFingerprint:  { score: 0, max: 4,  reason: '', observed: false }
  };

  const rating = parseFloat(store['Google評価']) || 0;
  const count = parseInt(store['口コミ数']) || 0;
  const hpId = store['ホットペッパーID'] || '';
  const mediaFeatures = Array.isArray(store.mediaFeatures) ? store.mediaFeatures : [];

  // ─── S1: Google★ vs 件数比率（max 15） ─── ※v2.1と同一
  if (count > 0 && rating > 0) {
    breakdown.s1_googleRatingVsCount.observed = true;
    if (rating >= 4.6 && count < 50) {
      breakdown.s1_googleRatingVsCount.score = 3;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（件数が少なく、高評価の裏付けが弱い）`;
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
    breakdown.s1_googleRatingVsCount.reason = `★${rating}（件数情報は未取得）`;
  } else {
    breakdown.s1_googleRatingVsCount.score = 5;
    breakdown.s1_googleRatingVsCount.reason = 'Google評価は未取得';
  }

  // ─── S2: レビュー件数絶対値（max 10） ─── ※v2.1と同一
  if (count >= 200)      { breakdown.s2_reviewCountAbs.score = 10; breakdown.s2_reviewCountAbs.reason = `${count}件（豊富なサンプル）`; }
  else if (count >= 100) { breakdown.s2_reviewCountAbs.score = 8;  breakdown.s2_reviewCountAbs.reason = `${count}件（十分なサンプル）`; }
  else if (count >= 50)  { breakdown.s2_reviewCountAbs.score = 6;  breakdown.s2_reviewCountAbs.reason = `${count}件（標準的なサンプル）`; }
  else if (count >= 30)  { breakdown.s2_reviewCountAbs.score = 4;  breakdown.s2_reviewCountAbs.reason = `${count}件（最低限のサンプル）`; }
  else if (count > 0)    { breakdown.s2_reviewCountAbs.score = 2;  breakdown.s2_reviewCountAbs.reason = `${count}件（サンプル不足）`; }
  else                   { breakdown.s2_reviewCountAbs.score = 6;  breakdown.s2_reviewCountAbs.reason = '件数情報は未取得'; }
  breakdown.s2_reviewCountAbs.observed = count > 0;

  // ─── S3: データ充実度（max 15） ─── ※v2.1と同一
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

  // ─── S4: 他媒体掲載クロスチェック（max 10） ─── ※v2.1と同一
  const mfCount = new Set(mediaFeatures.map(m => m.name).filter(Boolean)).size;
  breakdown.s4_mediaCrossCheck.observed = mfCount > 0;
  if (mfCount >= 4)      { breakdown.s4_mediaCrossCheck.score = 10; breakdown.s4_mediaCrossCheck.reason = `${mfCount}媒体に掲載（強い第三者検証）`; }
  else if (mfCount >= 2) { breakdown.s4_mediaCrossCheck.score = 8;  breakdown.s4_mediaCrossCheck.reason = `${mfCount}媒体に掲載`; }
  else if (mfCount === 1){ breakdown.s4_mediaCrossCheck.score = 5;  breakdown.s4_mediaCrossCheck.reason = '1媒体に掲載'; }
  else {
    breakdown.s4_mediaCrossCheck.score = 3;
    breakdown.s4_mediaCrossCheck.reason = 'メディア掲載情報なし（多くの正当な店舗も同様）';
  }

  // ─── S5: 営業実態継続（max 5） ─── ※v2.1と同一
  if (hpId) { breakdown.s5_operationContinuity.score = 5; breakdown.s5_operationContinuity.reason = 'Hot Pepper 営業継続中'; }
  else      { breakdown.s5_operationContinuity.score = 2; breakdown.s5_operationContinuity.reason = '営業実態は手動キュレーションで確認'; }

  // ─── S6: Instagram 実在シグナル（max 10） ─── ※v2.1と同一
  const hasIGPost = !!(store['Instagram投稿URL'] && String(store['Instagram投稿URL']).trim());
  let igScore = 0;
  const igParts = [];
  if (hasIG)     { igScore += 7; igParts.push('公式アカウント'); }
  if (hasIGPost) { igScore += 3; igParts.push('最新投稿'); }
  breakdown.s6_instagramPresence.score = igScore;
  breakdown.s6_instagramPresence.reason = igParts.length ? igParts.join('・') + ' あり' : 'Instagram 解決なし';

  // ─── S7: レビュー時系列健全性（max 20） ─── ※v2.1と同一（a/b/cロジック不変）
  const snapshots = (placesHistoryEntry && Array.isArray(placesHistoryEntry.snapshots)) ? placesHistoryEntry.snapshots : [];
  const latestReviews = (placesHistoryEntry && Array.isArray(placesHistoryEntry.latestReviews)) ? placesHistoryEntry.latestReviews : [];
  let s7a = 0, s7b = 0, s7c = 0;
  let s7aObs = false, s7bObs = false, s7cObs = false;
  const s7reasons = [];
  let openingBurstPattern = false;

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
      s7aObs = true;
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
      s7a = 4; s7reasons.push('履歴蓄積中（取得履歴が揃うまで保留）');
    }
  } else {
    s7a = 4; s7reasons.push('月次履歴未蓄積（取得履歴が3回に達するまで保留）');
  }

  if (latestReviews.length >= 3 && rating > 0) {
    const validRatings = latestReviews.map(r => r.rating).filter(r => typeof r === 'number');
    if (validRatings.length >= 3) {
      s7bObs = true;
      const latestAvg = validRatings.reduce((a, b) => a + b, 0) / validRatings.length;
      const diff = latestAvg - rating;
      if (Math.abs(diff) <= 0.3) {
        s7b = 6; s7reasons.push(`最新★${latestAvg.toFixed(1)}≒全体★${rating}`);
      } else if (diff >= 0.8) {
        s7b = 1; s7reasons.push(`直近${validRatings.length}件の平均★${latestAvg.toFixed(1)}が全体★${rating}より+${diff.toFixed(1)}高い`);
      } else if (diff <= -0.8) {
        s7b = 1; s7reasons.push(`直近${validRatings.length}件の平均★${latestAvg.toFixed(1)}が全体★${rating}より${diff.toFixed(1)}低い`);
      } else {
        s7b = 4; s7reasons.push(`最新★${latestAvg.toFixed(1)}・全体★${rating}（軽微な乖離）`);
      }
    } else {
      s7b = 3; s7reasons.push('最新レビュー★情報なし');
    }
  } else {
    s7b = 3; s7reasons.push('最新レビュー未取得');
  }

  if (latestReviews.length >= 3) {
    const ratings = latestReviews.map(r => r.rating).filter(r => typeof r === 'number');
    if (ratings.length >= 3) {
      const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const stddev = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / ratings.length);
      if (stddev >= 0.5 && stddev <= 1.5) {
        s7cObs = true;
        s7c = 6; s7reasons.push(`標準偏差${stddev.toFixed(2)}（自然な分布）`);
      } else if (stddev < 0.5) {
        s7c = 3; s7reasons.push(`直近${ratings.length}件の★が揃っています（件数が少なく、ばらつきは評価できません）`);
      } else {
        s7cObs = true;
        s7c = 2; s7reasons.push(`標準偏差${stddev.toFixed(2)}（評価が大きく割れています）`);
      }
    } else {
      s7c = 3; s7reasons.push('標準偏差判定不可');
    }
  } else {
    s7c = 3; s7reasons.push('最新レビュー件数不足');
  }

  breakdown.s7_reviewTimeseries.score = s7a + s7b + s7c;
  breakdown.s7_reviewTimeseries.reason = s7reasons.join(' / ');
  breakdown.s7_reviewTimeseries.observed = s7aObs || s7bObs || s7cObs;
  breakdown.s7_reviewTimeseries.parts = [
    { id: 's7a', score: s7a, max: 8, observed: s7aObs, reason: s7reasons[0] || '' },
    { id: 's7b', score: s7b, max: 6, observed: s7bObs, reason: s7reasons[1] || '' },
    { id: 's7c', score: s7c, max: 6, observed: s7cObs, reason: s7reasons[2] || '' }
  ];

  // ─── S7d: 投稿タイミングの短期集中検出（max 6・新設） ───
  // 人気店の自然な集中を誤検知しないよう「低ペース店であること」を必須ANDにする
  // （v3 の rate30Latest 正規化は使わず、v2 に既存の count のみで簡易判定＝低ブラスト半径優先）
  let s7d = 0, s7dObs = false;
  let reviewBurstCluster = false;
  const timedReviews = latestReviews.filter(r => typeof r.time === 'number').map(r => r.time).sort((a, b) => a - b);
  const isLowPace = count < 100;
  if (timedReviews.length >= 5) {
    let maxCluster = 1;
    for (let i = 0; i < timedReviews.length; i++) {
      let c = 1;
      for (let j = i + 1; j < timedReviews.length; j++) {
        if (timedReviews[j] - timedReviews[i] <= 7 * 86400) c++;
        else break;
      }
      if (c > maxCluster) maxCluster = c;
    }
    const span = timedReviews[timedReviews.length - 1] - timedReviews[0];
    if (maxCluster >= 3 && isLowPace) {
      s7dObs = true;
      s7d = 0; reviewBurstCluster = true;
      breakdown.s7d_reviewBurstCluster.reason = `最新レビュー中${maxCluster}件が7日以内に集中（投稿頻度が低い店で発生）`;
    } else if (span >= 60 * 86400) {
      s7dObs = true;
      s7d = 3;
      breakdown.s7d_reviewBurstCluster.reason = 'レビュー投稿日が分散（自然）';
    } else {
      s7d = 3;
      breakdown.s7d_reviewBurstCluster.reason = 'レビュー投稿日はやや近接（件数が少なく判定保留）';
    }
  } else {
    breakdown.s7d_reviewBurstCluster.reason = '投稿日時情報が不足（判定保留）';
  }
  breakdown.s7d_reviewBurstCluster.score = s7d;
  breakdown.s7d_reviewBurstCluster.observed = s7dObs;

  // ─── S8: 評価分布の自然性（max 15） ─── ※v2.1と同一
  let uShapedDistribution = false;
  if (latestReviews.length >= 5) {
    breakdown.s8_reviewDistribution.observed = true;
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
      breakdown.s8_reviewDistribution.reason = `★5系${high}件・★1系${low}件・中間${mid}件（評価が両極に分かれています）`;
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
    breakdown.s8_reviewDistribution.reason = '最新レビュー情報なし（判定保留）';
  }

  // ─── S9: クロス店舗レビュー指紋照合（max 4・新設） ───
  // fingerprintResult は scripts/lib/review_fingerprint.js の evaluateStoreFingerprint() の
  // 戻り値をそのまま渡す想定（build.js が全店共通のインデックスから1店舗分を切り出して渡す）
  const fp = fingerprintResult || { observed: false, reason: '指紋データなし（判定保留）' };
  let duplicateReviewAcrossStores = false;
  let sameReviewerAcrossStores = false;
  if (fp.observed) {
    duplicateReviewAcrossStores = !!fp.duplicateReviewAcrossStores;
    sameReviewerAcrossStores = !!fp.sameReviewerAcrossStores;
    if (duplicateReviewAcrossStores || sameReviewerAcrossStores) {
      breakdown.s9_crossStoreFingerprint.score = 1;
    } else {
      breakdown.s9_crossStoreFingerprint.score = 4;
    }
    breakdown.s9_crossStoreFingerprint.observed = true;
  } else {
    breakdown.s9_crossStoreFingerprint.score = 2;
    breakdown.s9_crossStoreFingerprint.observed = false;
  }
  breakdown.s9_crossStoreFingerprint.reason = fp.reason || '';

  const total = Object.values(breakdown).reduce((sum, b) => sum + b.score, 0);

  // 内部フラグ（Inspector 月次レビュー用・LOCAL_STORES には焼き付けない）
  const flags = {};
  if (rating >= 4.6 && count > 0 && count < 50) flags.gachaReviewSuspicion = true;
  if (store['食べログURL'] && rating > 0 && rating <= 3.2) flags.mediaDiscrepancy = true;
  if (openingBurstPattern) flags.openingBurstPattern = true;
  if (uShapedDistribution) flags.uShapedDistribution = true;
  if (reviewBurstCluster) flags.reviewBurstCluster = true;
  if (duplicateReviewAcrossStores) flags.duplicateReviewAcrossStores = true;
  if (sameReviewerAcrossStores) flags.sameReviewerAcrossStores = true;

  return {
    crossCheckScore: total,
    crossCheckBreakdown: breakdown,
    crossCheckFlags: flags,
    crossCheckScoreVersion: '2.2'
  };
}

module.exports = { computeCrossCheckScore };
