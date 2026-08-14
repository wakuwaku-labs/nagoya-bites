'use strict';
// ────────────────────────────────────────────────────
// スコア信頼度（TRUST SCORE）v3.0 — サクラチェック精度向上版
// ────────────────────────────────────────────────────
// 現状: 実装済み・テスト済み・シャドー検証済み（scripts/audit_crosscheck_v3.js）。
// 【本番未投入】build.js は引き続き scripts/lib/cross_check.js（v2.0）を require している。
//
// 活性化の前提ゲート（実装計画 Phase 3 より）:
//   (a) Phase 1 の --refresh が本番 monthly-places.yml で 1 回以上完走し、
//       textLen/incentiveHit 付き latestReviews と snapshots≥2 が蓄積開始していること
//   (b) scripts/audit_crosscheck_v3.js のシャドー比較結果を agent-backlog.md に記録済みであること
// 現時点（実装直後）でこの2つを満たせないのは、新シグナルの多くが「データが無ければ中立点」に
// フォールバックする設計のため、今 build.js に繋いでも実質 v2 のスコアを別配点に付け替えるだけで
// 終わり、Inspector の月次 ±10% ガイドラインの意味が壊れる（実データに基づかない一斉変動になる）。
//
// 活性化手順（ゲートを満たしたら）:
//   1. build.js の `require('./scripts/lib/cross_check')` を
//      `require('./scripts/lib/cross_check_v3')` に変更
//   2. agent-backlog.md に scoreVersion 3.0 切替の ISSUE 履歴を追記
//   3. features/integrity-method.html を v3.0 表記に更新（Phase 4 側で用意済み）
//   4. デプロイ後 node scripts/qa_gate.js で退行なしを確認
//
// 配点変更（合計100維持・8キー名は v2 と同一 — index.html のモーダルは無改修で動く）:
//   S1(15→12) S2(10→8) S3(15→10) S4(10・据置) S5(5・据置) S6(10・据置) S7(20→25) S8(15→20)
//
// S7 の内訳: S7a(8) 投稿ペース安定性【30日換算レートに正規化】 / S7b(6) 最新★乖離 / S7c(5) 標準偏差
//            / S7d(6・新設) 同日/短期間クラスタ検出
// S8 の内訳: S8-1(10) U字分布 / S8-2(6・新設) 本文実在性 / S8-3(4・新設) インセンティブ誘導検出
//
// フラグ再定義: mediaDiscrepancy を廃止し highRatingNoFootprint に置換（食べログ点数を
// 取得しない Strategic Skip 方針・ISSUE-048 を維持したまま、機械検証可能な事実だけで
// 「高評価なのに第三者の足跡が無い」を捉える）。
function computeCrossCheckScore(store, placesHistoryEntry) {
  const breakdown = {
    s1_googleRatingVsCount:    { score: 0, max: 12, reason: '' },
    s2_reviewCountAbs:         { score: 0, max: 8,  reason: '' },
    s3_dataCompleteness:       { score: 0, max: 10, reason: '' },
    s4_mediaCrossCheck:        { score: 0, max: 10, reason: '' },
    s5_operationContinuity:    { score: 0, max: 5,  reason: '' },
    s6_instagramPresence:      { score: 0, max: 10, reason: '' },
    s7_reviewTimeseries:       { score: 0, max: 25, reason: '' },
    s8_reviewDistribution:     { score: 0, max: 20, reason: '' }
  };

  const rating = parseFloat(store['Google評価']) || 0;
  const count = parseInt(store['口コミ数']) || 0;
  const hpId = store['ホットペッパーID'] || '';
  const mediaFeatures = Array.isArray(store.mediaFeatures) ? store.mediaFeatures : [];
  const hasIG = !!(store['Instagram'] && String(store['Instagram']).trim());

  // ─── S1: Google★ vs 件数比率（max 12） ───
  if (count > 0 && rating > 0) {
    if (rating >= 4.6 && count < 50) {
      breakdown.s1_googleRatingVsCount.score = 2;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（少件数で高評価のためガチャレビュー疑い）`;
    } else if (rating >= 4.0 && count >= 100) {
      breakdown.s1_googleRatingVsCount.score = 12;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（高評価と十分な件数で整合）`;
    } else if (rating >= 4.0 && count >= 30) {
      breakdown.s1_googleRatingVsCount.score = 9;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（評価と件数のバランス良好）`;
    } else if (rating >= 3.5 && count >= 30) {
      breakdown.s1_googleRatingVsCount.score = 6;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（標準的な評価分布）`;
    } else if (rating >= 3.0) {
      breakdown.s1_googleRatingVsCount.score = 4;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（評価は標準）`;
    } else {
      breakdown.s1_googleRatingVsCount.score = 2;
      breakdown.s1_googleRatingVsCount.reason = `★${rating}・件数${count}件（低評価）`;
    }
  } else if (rating > 0) {
    if (rating >= 4.5)      { breakdown.s1_googleRatingVsCount.score = 10; }
    else if (rating >= 4.0) { breakdown.s1_googleRatingVsCount.score = 8; }
    else if (rating >= 3.5) { breakdown.s1_googleRatingVsCount.score = 6; }
    else                    { breakdown.s1_googleRatingVsCount.score = 4; }
    breakdown.s1_googleRatingVsCount.reason = `★${rating}（件数情報なし・Places API 取得で正規化予定）`;
  } else {
    breakdown.s1_googleRatingVsCount.score = 4;
    breakdown.s1_googleRatingVsCount.reason = 'Google評価なし（Places API 取得予定）';
  }

  // ─── S2: レビュー件数絶対値（max 8） ───
  if (count >= 200)      { breakdown.s2_reviewCountAbs.score = 8; breakdown.s2_reviewCountAbs.reason = `${count}件（豊富なサンプル）`; }
  else if (count >= 100) { breakdown.s2_reviewCountAbs.score = 6; breakdown.s2_reviewCountAbs.reason = `${count}件（十分なサンプル）`; }
  else if (count >= 50)  { breakdown.s2_reviewCountAbs.score = 5; breakdown.s2_reviewCountAbs.reason = `${count}件（標準的なサンプル）`; }
  else if (count >= 30)  { breakdown.s2_reviewCountAbs.score = 3; breakdown.s2_reviewCountAbs.reason = `${count}件（最低限のサンプル）`; }
  else if (count > 0)    { breakdown.s2_reviewCountAbs.score = 2; breakdown.s2_reviewCountAbs.reason = `${count}件（サンプル不足）`; }
  else                   { breakdown.s2_reviewCountAbs.score = 5; breakdown.s2_reviewCountAbs.reason = '件数情報なし（Places API 取得予定）'; }

  // ─── S3: データ充実度（max 10） ───
  // タグ ≥3個 / Instagram URL / 食べログ URL / おすすめポイント / 写真URL の 5 要素 × 2 点
  const tagCount = (store['タグ'] || '').split(',').filter(Boolean).length;
  const hasTbl = !!(store['食べログURL'] && String(store['食べログURL']).trim());
  const hasReco = !!(store['おすすめポイント'] && String(store['おすすめポイント']).trim());
  const hasPhoto = !!(store['写真URL'] && String(store['写真URL']).trim());
  const dcParts = [];
  let dcScore = 0;
  if (tagCount >= 3) { dcScore += 2; dcParts.push(`タグ${tagCount}個`); }
  if (hasIG)         { dcScore += 2; dcParts.push('IG解決'); }
  if (hasTbl)        { dcScore += 2; dcParts.push('食べログ解決'); }
  if (hasReco)       { dcScore += 2; dcParts.push('推薦文'); }
  if (hasPhoto)      { dcScore += 2; dcParts.push('写真'); }
  breakdown.s3_dataCompleteness.score = dcScore;
  breakdown.s3_dataCompleteness.reason = dcParts.length ? dcParts.join('・') + ' あり' : 'データ拡充未着手';

  // ─── S4: 他媒体掲載クロスチェック（max 10・据え置き） ───
  const mfCount = new Set(mediaFeatures.map(m => m.name).filter(Boolean)).size;
  if (mfCount >= 4)      { breakdown.s4_mediaCrossCheck.score = 10; breakdown.s4_mediaCrossCheck.reason = `${mfCount}媒体に掲載（強い第三者検証）`; }
  else if (mfCount >= 2) { breakdown.s4_mediaCrossCheck.score = 8;  breakdown.s4_mediaCrossCheck.reason = `${mfCount}媒体に掲載`; }
  else if (mfCount === 1){ breakdown.s4_mediaCrossCheck.score = 5;  breakdown.s4_mediaCrossCheck.reason = '1媒体に掲載'; }
  else                   { breakdown.s4_mediaCrossCheck.score = 0;  breakdown.s4_mediaCrossCheck.reason = 'メディア掲載情報なし'; }

  // ─── S5: 営業実態継続（max 5・据え置き） ───
  if (hpId) { breakdown.s5_operationContinuity.score = 5; breakdown.s5_operationContinuity.reason = 'Hot Pepper 営業継続中'; }
  else      { breakdown.s5_operationContinuity.score = 2; breakdown.s5_operationContinuity.reason = '営業実態は手動キュレーションで確認'; }

  // ─── S6: Instagram 実在シグナル（max 10・据え置き） ───
  const hasIGPost = !!(store['Instagram投稿URL'] && String(store['Instagram投稿URL']).trim());
  let igScore = 0;
  const igParts = [];
  if (hasIG)     { igScore += 7; igParts.push('公式アカウント'); }
  if (hasIGPost) { igScore += 3; igParts.push('最新投稿'); }
  breakdown.s6_instagramPresence.score = igScore;
  breakdown.s6_instagramPresence.reason = igParts.length ? igParts.join('・') + ' あり' : 'Instagram 解決なし';

  // ─── S7: レビュー時系列健全性（max 25） ───
  const snapshots = (placesHistoryEntry && Array.isArray(placesHistoryEntry.snapshots)) ? placesHistoryEntry.snapshots : [];
  const latestReviews = (placesHistoryEntry && Array.isArray(placesHistoryEntry.latestReviews)) ? placesHistoryEntry.latestReviews : [];
  let s7a = 0, s7b = 0, s7c = 0, s7d = 0;
  const s7reasons = [];
  let openingBurstPattern = false;
  let reviewBurstCluster = false;

  // a: 投稿ペース安定性（30日換算レートに正規化 — --refresh の snapshot 間隔は
  //    優先度階層によって25日〜90日超と不揃いになるため、生差分ではなく日割りレートで比較する）
  let rate30Latest = null; // S7d の低ペース判定に流用
  if (snapshots.length >= 3) {
    const rates = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      if (typeof prev.total !== 'number' || typeof curr.total !== 'number' || curr.total < prev.total) continue;
      const days = (Date.parse(curr.ts) - Date.parse(prev.ts)) / 86400000;
      if (!(days > 0)) continue;
      rates.push((curr.total - prev.total) / days * 30);
    }
    if (rates.length >= 2) {
      rate30Latest = rates[rates.length - 1];
      const sum = rates.reduce((a, b) => a + b, 0);
      const mean = sum / rates.length;
      const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      const firstRate = rates[0];
      const lastRate = rates[rates.length - 1];
      if (firstRate >= 20 && lastRate <= 2) {
        s7a = 1; openingBurstPattern = true;
        s7reasons.push(`投稿急増→失速（初期${firstRate.toFixed(1)}/月・直近${lastRate.toFixed(1)}/月換算）`);
      } else if (cv <= 0.5) { s7a = 8; s7reasons.push('投稿ペース安定（30日換算）'); }
      else if (cv <= 1.0)   { s7a = 5; s7reasons.push('投稿ペース概ね安定（30日換算）'); }
      else                   { s7a = 3; s7reasons.push('投稿ペースばらつきあり（30日換算）'); }
    } else {
      s7a = 4; s7reasons.push('履歴蓄積中');
    }
  } else {
    s7a = 4; s7reasons.push('月次履歴未蓄積（refresh 蓄積待ち）');
  }

  // b: 最新レビュー★ vs 全体★ の乖離（v2 と同一ロジック）
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

  // c: 最新レビュー★の標準偏差（max 5）
  if (latestReviews.length >= 3) {
    const ratings = latestReviews.map(r => r.rating).filter(r => typeof r === 'number');
    if (ratings.length >= 3) {
      const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      const stddev = Math.sqrt(ratings.reduce((a, b) => a + (b - mean) ** 2, 0) / ratings.length);
      if (stddev >= 0.5 && stddev <= 1.5) {
        s7c = 5; s7reasons.push(`標準偏差${stddev.toFixed(2)}（自然な分布）`);
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

  // d: 同日/短期間クラスタ検出（max 6・新設）
  // latestReviews[].time（unix epoch秒）を使用。人気店の自然な集中を誤検知しないよう、
  // 「低ペース店であること」を必須ANDにする（30日換算レート<10/月、履歴不足時は口コミ数<100で代用）。
  const timedReviews = latestReviews.filter(r => typeof r.time === 'number').map(r => r.time).sort((a, b) => a - b);
  const isLowPace = rate30Latest != null ? rate30Latest < 10 : count < 100;
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
      s7d = 1; reviewBurstCluster = true;
      s7reasons.push(`最新レビュー中${maxCluster}件が7日以内に集中（低ペース店で異常）`);
    } else if (span >= 60 * 86400) {
      s7d = 6; s7reasons.push('レビュー投稿日が分散（自然）');
    } else {
      s7d = 3; s7reasons.push('レビュー投稿日はやや近接（判定保留）');
    }
  } else {
    s7d = 3; s7reasons.push('投稿日時情報が不足（判定保留）');
  }

  breakdown.s7_reviewTimeseries.score = s7a + s7b + s7c + s7d;
  breakdown.s7_reviewTimeseries.reason = s7reasons.join(' / ');

  // ─── S8: 評価分布の自然性（max 20） ───
  let uShapedDistribution = false;
  let s8_1 = 0;
  const s8reasons = [];
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
      s8_1 = 1; uShapedDistribution = true;
      s8reasons.push(`★5系${high}件・★1系${low}件・中間${mid}件（U字型疑い）`);
    } else if (mid >= 3) {
      s8_1 = 10; s8reasons.push(`★5系${high}件・★1系${low}件・中間${mid}件（自然な分布）`);
    } else if (high >= 4 && low === 0) {
      s8_1 = 7; s8reasons.push(`★5系${high}件・★1系${low}件・中間${mid}件（高評価集中）`);
    } else {
      s8_1 = 5; s8reasons.push(`★5系${high}件・★1系${low}件・中間${mid}件`);
    }
  } else if (latestReviews.length > 0) {
    s8_1 = 4; s8reasons.push(`最新${latestReviews.length}件のみ（判定保留）`);
  } else {
    s8_1 = 4; s8reasons.push('最新レビュー情報なし（中立扱い）');
  }

  // S8-2: 本文実在性（max 6・新設） — ★4.5+ かつ 本文なし(textLen===0) が3件以上でフラグ
  const withTextSignals = latestReviews.filter(r => typeof r.textLen === 'number');
  let emptyFiveStarPattern = false;
  let s8_2 = 0;
  if (withTextSignals.length === 0) {
    s8_2 = 3; s8reasons.push('本文情報なし（旧データ・中立扱い）');
  } else {
    const highRated = withTextSignals.filter(r => typeof r.rating === 'number' && r.rating >= 4.5);
    const emptyHighRated = highRated.filter(r => r.textLen === 0);
    if (emptyHighRated.length >= 3) {
      s8_2 = 1; emptyFiveStarPattern = true;
      s8reasons.push(`高評価×本文なしが${emptyHighRated.length}件`);
    } else if (highRated.length > 0) {
      const avgLen = highRated.reduce((a, r) => a + r.textLen, 0) / highRated.length;
      if (avgLen >= 30) { s8_2 = 6; s8reasons.push(`高評価レビュー平均本文${Math.round(avgLen)}文字（実在感あり）`); }
      else { s8_2 = 3; s8reasons.push(`高評価レビュー平均本文${Math.round(avgLen)}文字`); }
    } else {
      s8_2 = 4; s8reasons.push('高評価レビューなし（判定対象外）');
    }
  }

  // S8-3: インセンティブ誘導検出（max 4・新設） — 2023年景表法ステマ規制観点
  // 苦情文の誤ヒットがあり得るため減点は小さく、主目的は Inspector 目視用フラグ
  const withIncentiveSignals = latestReviews.filter(r => typeof r.incentiveHit === 'boolean');
  let incentiveReviewSuspicion = false;
  let s8_3 = 0;
  if (withIncentiveSignals.length === 0) {
    s8_3 = 2; s8reasons.push('誘導語判定データなし（旧データ・中立扱い）');
  } else if (withIncentiveSignals.some(r => r.incentiveHit === true)) {
    s8_3 = 1; incentiveReviewSuspicion = true;
    s8reasons.push('誘導語を含むレビューを検出（誤検知あり得るため目視確認対象）');
  } else {
    s8_3 = 4; s8reasons.push('誘導語の検出なし');
  }

  breakdown.s8_reviewDistribution.score = s8_1 + s8_2 + s8_3;
  breakdown.s8_reviewDistribution.reason = s8reasons.join(' / ');

  const total = Object.values(breakdown).reduce((sum, b) => sum + b.score, 0);

  // 内部フラグ（Inspector 月次レビュー用・LOCAL_STORES には焼き付けない）
  const flags = {};
  if (rating >= 4.6 && count > 0 && count < 50) flags.gachaReviewSuspicion = true;
  // mediaDiscrepancy（v2）は廃止。食べログ点数を取得しない Strategic Skip 方針（ISSUE-048）を
  // 維持したまま、機械検証可能な事実だけで代替する後継フラグ。
  if (rating >= 4.5 && count > 0 && count < 50 && mfCount === 0 && !hasIG) flags.highRatingNoFootprint = true;
  if (openingBurstPattern) flags.openingBurstPattern = true;
  if (uShapedDistribution) flags.uShapedDistribution = true;
  if (reviewBurstCluster) flags.reviewBurstCluster = true;
  if (emptyFiveStarPattern) flags.emptyFiveStarPattern = true;
  if (incentiveReviewSuspicion) flags.incentiveReviewSuspicion = true;

  return {
    crossCheckScore: total,
    crossCheckBreakdown: breakdown,
    crossCheckFlags: flags,
    crossCheckScoreVersion: '3.0'
  };
}

module.exports = { computeCrossCheckScore };
