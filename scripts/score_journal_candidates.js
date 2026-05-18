'use strict';
/**
 * scripts/score_journal_candidates.js
 *
 * ジャーナル記事の候補アングルを 100点満点で採点する決定的スコアラ。
 * /journal-today の Step 3.5 で呼ばれる。LLM 呼び出しなし、純 Node.js。
 *
 * 使い方:
 *   node scripts/score_journal_candidates.js <input.json>             # 採点して JSON 出力
 *   node scripts/score_journal_candidates.js <input.json> --explain   # 減点理由を人間可読で出力
 *   node scripts/score_journal_candidates.js --history 14             # 直近 N 日の採点履歴サマリ
 *
 * 入力スキーマ（候補配列）:
 *   [
 *     {
 *       "id": "c1",
 *       "theme": "today_one | industry_insider | weekly_digest | seasonal | flexible",
 *       "title_draft": "...",
 *       "lead_draft": "150字程度",
 *       "angle": "業界人視点の切り口を1行",
 *       "main_store": { "name": "...", "id": "", "area": "...", "genre": "..." },
 *       "sources": [{ "label": "...", "url": "...", "date": "2026-05-15" }],
 *       "trending_signals": { "x_mentions": 12, "media_count": 3, "buzz_score": 85 },
 *       "column_id": "COL-XXX-NNN"
 *     }
 *   ]
 *
 * 採点ルーブリック（先頭定数で宣言 — Inspector / Strategist が調整可能）:
 *   最新性 25 / 話題性 25 / 独自性 20 / ブランド整合 15 / 執筆実現性 10 / 新規性 5
 *
 * 採用閾値: 合計 95 点以上。
 *
 * 重複回避は「即失格ゲート」として採点前に通す（DISQUALIFIED）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PUBLISHED_PATH = path.join(DATA, 'journal_published.json');
const CANDIDATES_DIR = path.join(DATA, 'journal_candidates');

// ============================================================
// ルーブリック重み（合計100）
// ============================================================
const WEIGHTS = {
  recency: 25,
  topicality: 25,
  uniqueness: 20,
  brand_fit: 15,
  writability: 10,
  novelty: 5
};

const PASS_THRESHOLD = 95;

// ============================================================
// 重複ゲート閾値
// ============================================================
const DEDUP = {
  same_store_days: 90,
  same_column_days: 180,
  title_jaccard_3gram: 0.5,
  lead_jaccard_5gram: 0.4,
  lead_compare_chars: 100
};

// ============================================================
// 語彙辞書
// ============================================================
const UNIQUENESS_KEYWORDS = ['価格帯', 'コース', '席', '予約', 'シーン', '接待', 'デート', 'アラカルト', '一人飲み', '繁忙', '回転'];
const STRATEGIC_SKIP_KEYWORDS = ['食べログランキング', '食べログ百名店', 'クーポン', '割引', '飲み放題特典', '印刷雑誌', '雑誌連動'];
const BRAND_FIT_BONUS_KEYWORDS = ['業界人', '編集部', '現役', '匿名', 'editorReason', 'mediaFeatures', 'insiderNote', 'オペ', '裏側', '目利き'];
// 匿名運営違反検出: 「大将」「店主」「シェフ」「オーナー」など役職を表す語が単独で出るのは問題ないが、
// 固有名 + 役職パターンを正規表現で簡易検出
const ANONYMITY_VIOLATION_PATTERNS = [
  /[一-龥]{2,4}(さん|大将|シェフ|オーナー|店主|料理長|親方)/
];

// ============================================================
// ユーティリティ
// ============================================================
function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function daysBetween(a, b) {
  const ms = new Date(a + 'T00:00:00+09:00') - new Date(b + 'T00:00:00+09:00');
  return Math.abs(ms / 86400000);
}

function normalize(s) {
  return String(s || '').replace(/[\s　「」『』【】（）()\[\]、。,.!?！？:：;；'"`~・…—–\-]/g, '').toLowerCase();
}

function ngrams(s, n) {
  const arr = [];
  for (let i = 0; i <= s.length - n; i++) arr.push(s.slice(i, i + n));
  return new Set(arr);
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ============================================================
// 重複ゲート（HARD FAIL）
// ============================================================
function checkDisqualified(candidate, published, today) {
  const reasons = [];
  const entries = published.entries || [];

  // 1. 同一店舗の再掲（90日）
  const storeName = (candidate.main_store && candidate.main_store.name) || '';
  const storeId = (candidate.main_store && candidate.main_store.id) || '';
  if (storeName || storeId) {
    for (const e of entries) {
      if (daysBetween(e.date, today) > DEDUP.same_store_days) continue;
      if (storeId && (e.store_ids || []).includes(storeId)) {
        reasons.push(`同一店舗の再掲 (${storeId}, ${e.date})`);
        break;
      }
      if (storeName && (e.pending_store_keys || []).some(k => k && k.includes(storeName))) {
        reasons.push(`同一店舗の再掲 (${storeName} in pending, ${e.date})`);
        break;
      }
      // タイトルに店名が含まれていれば同一店舗扱い
      if (storeName && e.title && e.title.includes(storeName)) {
        reasons.push(`同一店舗の再掲 (${storeName} in past title, ${e.date})`);
        break;
      }
    }
  }

  // 2. 同一コラムの再掲（180日）
  if (candidate.column_id) {
    for (const e of entries) {
      if (daysBetween(e.date, today) > DEDUP.same_column_days) continue;
      if (e.column_id === candidate.column_id) {
        reasons.push(`同一コラムの再掲 (${candidate.column_id}, ${e.date})`);
        break;
      }
    }
  }

  // 3. タイトル類似（3-gram Jaccard >= 0.5、全期間）
  const titleNorm = normalize(candidate.title_draft);
  if (titleNorm.length >= 6) {
    const tGrams = ngrams(titleNorm, 3);
    for (const e of entries) {
      const past = normalize(e.title);
      if (past.length < 6) continue;
      const sim = jaccard(tGrams, ngrams(past, 3));
      if (sim >= DEDUP.title_jaccard_3gram) {
        reasons.push(`タイトル類似 (sim=${sim.toFixed(2)} vs ${e.date} "${e.title}")`);
        break;
      }
    }
  }

  // 4. リード類似（冒頭100字、5-gram Jaccard >= 0.4、全期間）
  const leadHead = normalize((candidate.lead_draft || '').slice(0, DEDUP.lead_compare_chars));
  if (leadHead.length >= 10) {
    const lGrams = ngrams(leadHead, 5);
    for (const e of entries) {
      const past = normalize((e.description || '').slice(0, DEDUP.lead_compare_chars));
      if (past.length < 10) continue;
      const sim = jaccard(lGrams, ngrams(past, 5));
      if (sim >= DEDUP.lead_jaccard_5gram) {
        reasons.push(`リード類似 (sim=${sim.toFixed(2)} vs ${e.date})`);
        break;
      }
    }
  }

  // 5. テーマ・主役店・angle の3点完全一致
  for (const e of entries) {
    if (e.theme === candidate.theme &&
        storeName && (e.title || '').includes(storeName) &&
        candidate.angle && (e.description || '').includes(candidate.angle.slice(0, 20))) {
      reasons.push(`theme+店+angle 完全一致 (${e.date})`);
      break;
    }
  }

  return reasons;
}

// ============================================================
// 採点ロジック
// ============================================================
function scoreRecency(candidate, today) {
  const sources = candidate.sources || [];
  if (sources.length === 0) return { score: 0, reasons: ['sources が空'] };
  const dated = sources.map(s => s.date).filter(Boolean);
  if (dated.length === 0) return { score: 0, reasons: ['sources に date が無い'] };
  const newest = dated.reduce((a, b) => a > b ? a : b);
  const diff = daysBetween(today, newest);
  let score;
  if (diff <= 3) score = 25;
  else if (diff <= 7) score = 20;
  else if (diff <= 14) score = 15;
  else if (diff <= 30) score = 10;
  else score = 0;
  // X 投稿があれば +3（上限 25）
  const hasX = sources.some(s => /(x\.com|twitter\.com)/i.test(s.url || ''));
  if (hasX) score = Math.min(25, score + 3);
  return { score, reasons: [`最新ソース ${diff.toFixed(0)}日前${hasX ? ' / X引用 +3' : ''}`] };
}

function scoreTopicality(candidate) {
  const sig = candidate.trending_signals || {};
  let score = 0;
  const reasons = [];
  const mediaPts = Math.min(15, (sig.media_count || 0) * 5);
  score += mediaPts;
  reasons.push(`media_count=${sig.media_count || 0} → ${mediaPts}`);
  const xm = sig.x_mentions || 0;
  let xPts = 0;
  if (xm >= 50) xPts = 10;
  else if (xm >= 10) xPts = 7;
  else if (xm >= 1) xPts = 4;
  score += xPts;
  reasons.push(`x_mentions=${xm} → ${xPts}`);
  if ((sig.buzz_score || 0) >= 90) { score += 5; reasons.push('buzz_score≥90 → +5'); }
  return { score: Math.min(25, score), reasons };
}

function scoreUniqueness(candidate) {
  const angle = candidate.angle || '';
  if (candidate.theme === 'today_one') {
    const hits = UNIQUENESS_KEYWORDS.filter(k => angle.includes(k));
    const score = Math.min(20, hits.length * 5);
    return { score, reasons: [`独自性キーワード ${hits.length}件 (${hits.join(',')})`] };
  }
  // 他テーマは angle の長さで判定
  const len = angle.length;
  if (len >= 50 && len <= 200) return { score: 15, reasons: ['angle 50-200字 → 15'] };
  if (len >= 20 && len < 50) return { score: 10, reasons: ['angle 20-49字 → 10'] };
  if (len >= 200) return { score: 12, reasons: ['angle 過長 → 12'] };
  return { score: 5, reasons: ['angle 短すぎ → 5'] };
}

function scoreBrandFit(candidate) {
  const text = `${candidate.angle || ''} ${candidate.lead_draft || ''} ${candidate.title_draft || ''}`;
  let score = 10; // ベース10点
  const reasons = ['ベース10'];
  const skips = STRATEGIC_SKIP_KEYWORDS.filter(k => text.includes(k));
  if (skips.length) {
    score -= skips.length * 5;
    reasons.push(`Strategic Skip 該当 ${skips.length}件 (${skips.join(',')}) → -${skips.length * 5}`);
  }
  const bonus = BRAND_FIT_BONUS_KEYWORDS.filter(k => text.includes(k));
  if (bonus.length) {
    score += 5;
    reasons.push(`業界人視点キーワード ${bonus.length}件 → +5`);
  }
  // 匿名運営違反
  const violated = ANONYMITY_VIOLATION_PATTERNS.some(re => re.test(candidate.lead_draft || ''));
  if (violated) {
    score -= 15;
    reasons.push('匿名運営違反検出（固有名+役職）→ -15');
  }
  return { score: Math.max(0, Math.min(15, score)), reasons };
}

function scoreWritability(candidate) {
  let score = 0;
  const reasons = [];
  if (candidate.main_store && candidate.main_store.name) { score += 3; reasons.push('main_store あり +3'); }
  else if (candidate.theme !== 'today_one' && candidate.theme !== 'weekly_digest') { score += 3; reasons.push('店なしテーマ +3'); }
  const srcCount = (candidate.sources || []).length;
  if (srcCount >= 3) { score += 4; reasons.push(`sources ${srcCount}件 +4`); }
  else if (srcCount >= 1) { score += 2; reasons.push(`sources ${srcCount}件 +2`); }
  const tlen = (candidate.title_draft || '').length;
  if (tlen >= 15 && tlen <= 35) { score += 3; reasons.push(`title ${tlen}字 +3`); }
  else if (tlen >= 10 && tlen <= 45) { score += 1; reasons.push(`title ${tlen}字 +1`); }
  return { score: Math.min(10, score), reasons };
}

function scoreNovelty(candidate, published, today) {
  const entries = published.entries || [];
  const storeName = (candidate.main_store && candidate.main_store.name) || '';
  const recentSameTheme = entries.filter(e => e.theme === candidate.theme && daysBetween(e.date, today) <= 30);
  // テーマ × 店 × angle 完全新規
  const exactDup = recentSameTheme.some(e => storeName && (e.title || '').includes(storeName));
  if (!exactDup && recentSameTheme.length === 0) return { score: 5, reasons: ['同テーマ過去30日内ゼロ → 5'] };
  if (!exactDup) return { score: 2, reasons: ['同テーマあり / 同店なし → 2'] };
  return { score: 0, reasons: ['同店再掲傾向 → 0'] };
}

// ============================================================
// 採点エントリポイント
// ============================================================
function scoreOne(candidate, published, today) {
  const disqual = checkDisqualified(candidate, published, today);
  if (disqual.length > 0) {
    return {
      id: candidate.id,
      title_draft: candidate.title_draft,
      verdict: 'DISQUALIFIED',
      total: 0,
      disqualified_reasons: disqual,
      breakdown: null
    };
  }
  const recency = scoreRecency(candidate, today);
  const topicality = scoreTopicality(candidate);
  const uniqueness = scoreUniqueness(candidate);
  const brandFit = scoreBrandFit(candidate);
  const writability = scoreWritability(candidate);
  const novelty = scoreNovelty(candidate, published, today);
  const total = recency.score + topicality.score + uniqueness.score + brandFit.score + writability.score + novelty.score;
  return {
    id: candidate.id,
    title_draft: candidate.title_draft,
    verdict: total >= PASS_THRESHOLD ? 'PASS' : 'FAIL',
    total,
    breakdown: {
      recency: recency.score,
      topicality: topicality.score,
      uniqueness: uniqueness.score,
      brand_fit: brandFit.score,
      writability: writability.score,
      novelty: novelty.score
    },
    explain: {
      recency: recency.reasons,
      topicality: topicality.reasons,
      uniqueness: uniqueness.reasons,
      brand_fit: brandFit.reasons,
      writability: writability.reasons,
      novelty: novelty.reasons
    }
  };
}

function scoreAll(candidates, opts = {}) {
  const today = opts.today || todayISO();
  const published = loadJSON(PUBLISHED_PATH, { entries: [] });
  const scored = candidates.map(c => scoreOne(c, published, today));
  const ranked = scored.slice().sort((a, b) => b.total - a.total);
  const passed = ranked.filter(r => r.verdict === 'PASS');
  const disqualified = scored.filter(r => r.verdict === 'DISQUALIFIED');
  const selected = passed[0] || null;
  return {
    date: today,
    weights: WEIGHTS,
    pass_threshold: PASS_THRESHOLD,
    ranked: ranked.filter(r => r.verdict !== 'DISQUALIFIED'),
    disqualified,
    selected_id: selected ? selected.id : null,
    fallback_needed: !selected
  };
}

function saveResult(result) {
  if (!fs.existsSync(CANDIDATES_DIR)) fs.mkdirSync(CANDIDATES_DIR, { recursive: true });
  const out = path.join(CANDIDATES_DIR, `${result.date}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
  return out;
}

function printRanking(result, explain) {
  console.log(`\n=== 候補採点結果 ${result.date} ===`);
  console.log(`採用閾値: ${result.pass_threshold}点 / 採用候補: ${result.selected_id || '(なし — フォールバック必要)'}`);
  if (result.disqualified.length) {
    console.log(`\n[失格] ${result.disqualified.length}件`);
    result.disqualified.forEach(d => {
      console.log(`  - ${d.id} "${d.title_draft}" : ${d.disqualified_reasons.join(' / ')}`);
    });
  }
  console.log('\n[採点結果]');
  result.ranked.forEach((r, i) => {
    const mark = r.verdict === 'PASS' ? '✅' : '❌';
    console.log(`  ${i + 1}. ${mark} [${r.total}/100] ${r.id} "${r.title_draft}"`);
    if (r.breakdown) {
      console.log(`     最新性${r.breakdown.recency}/話題性${r.breakdown.topicality}/独自性${r.breakdown.uniqueness}/ブランド${r.breakdown.brand_fit}/執筆${r.breakdown.writability}/新規${r.breakdown.novelty}`);
    }
    if (explain && r.explain) {
      Object.entries(r.explain).forEach(([k, lines]) => {
        lines.forEach(line => console.log(`       [${k}] ${line}`));
      });
    }
  });
}

function cmdHistory(days) {
  if (!fs.existsSync(CANDIDATES_DIR)) {
    console.log('採点履歴ディレクトリが存在しません');
    return;
  }
  const files = fs.readdirSync(CANDIDATES_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-days);
  console.log(`=== 直近${days}日の採点履歴 ===`);
  let totalCandidates = 0, totalPassed = 0, totalDisqualified = 0;
  const scoreSum = { recency: 0, topicality: 0, uniqueness: 0, brand_fit: 0, writability: 0, novelty: 0 };
  let breakdownCount = 0;
  for (const f of files) {
    const r = loadJSON(path.join(CANDIDATES_DIR, f), null);
    if (!r) continue;
    const n = r.ranked.length + r.disqualified.length;
    const p = r.ranked.filter(x => x.verdict === 'PASS').length;
    totalCandidates += n;
    totalPassed += p;
    totalDisqualified += r.disqualified.length;
    console.log(`  ${r.date}: 候補${n}件 / PASS${p}件 / 失格${r.disqualified.length}件 / 採用=${r.selected_id || '-'}`);
    r.ranked.forEach(x => {
      if (x.breakdown) {
        Object.keys(scoreSum).forEach(k => { scoreSum[k] += x.breakdown[k] || 0; });
        breakdownCount++;
      }
    });
  }
  console.log(`\n合計: 候補${totalCandidates} / PASS${totalPassed} / 失格${totalDisqualified}`);
  if (breakdownCount > 0) {
    console.log(`平均スコア内訳 (${breakdownCount}件):`);
    Object.entries(scoreSum).forEach(([k, v]) => {
      console.log(`  ${k}: ${(v / breakdownCount).toFixed(1)} / ${WEIGHTS[k]}`);
    });
  }
}

// ============================================================
// CLI
// ============================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--history') {
    const days = parseInt(args[1] || '14', 10);
    cmdHistory(days);
    process.exit(0);
  }
  const inputFile = args[0];
  const explain = args.includes('--explain');
  if (!inputFile) {
    console.error('Usage: node scripts/score_journal_candidates.js <input.json> [--explain]');
    console.error('       node scripts/score_journal_candidates.js --history <days>');
    process.exit(1);
  }
  if (!fs.existsSync(inputFile)) {
    console.error('入力ファイルが見つかりません: ' + inputFile);
    process.exit(1);
  }
  const candidates = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  if (!Array.isArray(candidates)) {
    console.error('入力は候補配列である必要があります');
    process.exit(1);
  }
  const result = scoreAll(candidates);
  const out = saveResult(result);
  printRanking(result, explain);
  console.log(`\n採点結果を保存: ${out}`);
  if (result.fallback_needed) {
    console.log('\n⚠️  95点以上の候補なし — フォールバック工程に進んでください（公開スキップは禁止）');
    process.exit(2);
  }
}

module.exports = { scoreAll, scoreOne, WEIGHTS, PASS_THRESHOLD };
