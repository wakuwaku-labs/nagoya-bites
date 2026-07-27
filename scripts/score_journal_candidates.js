'use strict';
/**
 * scripts/score_journal_candidates.js
 *
 * ジャーナル記事の候補アングルを 100点満点で採点する決定的スコアラ。
 * /journal-today の Step 3 で呼ばれる。LLM 呼び出しなし、純 Node.js。
 *
 * 使い方:
 *   node scripts/score_journal_candidates.js <input.json>             # 採点して JSON 出力
 *   node scripts/score_journal_candidates.js <input.json> --explain   # 加点理由を人間可読で出力
 *   node scripts/score_journal_candidates.js --history 14             # 直近 N 日の採点履歴サマリ
 *   node scripts/score_journal_candidates.js --policy                 # 現在のゲート方針を表示
 *   node scripts/score_journal_candidates.js --calibrate              # 代表ケースで分布を確認
 *
 * ============================================================================
 * 2026-07-27 改訂（ISSUE-077）— 「盛れば通る」構造の是正
 * ============================================================================
 * 旧版は 100点中 75点がエージェントの自己申告値で決まり、外部から検証できるのは
 * recency(25) だけだった。とくに `trending_signals.buzz_score` は
 * **どのデータファイルにも存在せず、どのスクリプトも算出していない**自由記入の数字で、
 * 過去にゲートを超えた候補は全て `buzz_score>=90 → +5` を積んでいた（正直に低く申告した
 * 日だけが未達になっていた）。正直な取材で到達できる上限は 94点、ゲートは 95点。
 * つまり「盛らないと通らない」設計であり、CLAUDE.md の Moat（実在保証・サクラ排除・
 * 編集独立）と正面から矛盾していた。
 *
 * そこで「検証できる事実」だけで加点する設計に改めた:
 *   - buzz_score / x_mentions（ともに自己申告・出典なし）を採点から全廃
 *   - 話題性は「話題だと主張する」のではなく **話題の証跡URLを sources に出せているか** で測る
 *   - 一次情報源（公式発表・一次報道）の有無を brand_fit の信頼性加点に組み込む
 *   - uniqueness のテーマ偏り（today_one だけ 20点満点）を解消し、テーマ別の語彙で評価
 *   - novelty が「同テーマ30日以内」判定のため恒久的に2点で死んでいた問題を修正
 *     （today_one をほぼ毎日出すため、5点が構造的に取れなくなっていた）
 *
 * 採点に使う値はすべて sources 配列・published.json・候補本文から機械的に導出される。
 * エージェントが「数字を大きく書く」ことで点を上げる経路は残っていない。
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
 *       "column_id": "COL-XXX-NNN"
 *     }
 *   ]
 *   ※ trending_signals は後方互換のため受け取るが、採点には一切使わない。
 *
 * 採点ルーブリック（合計100）:
 *   最新性 25 / 話題性 25 / 独自性 20 / ブランド整合 15 / 執筆実現性 10 / 新規性 5
 *
 * 採用判定は data/journal_gate_policy.json の段階ゲートに従う:
 *   PASS（自動公開） / PASS_WITH_NOTE（記録を残して自動公開） / HOLD（公開しない）
 *
 * 重複回避は「即失格ゲート」として採点前に通す（DISQUALIFIED）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PUBLISHED_PATH = path.join(DATA, 'journal_published.json');
const CANDIDATES_DIR = path.join(DATA, 'journal_candidates');
const GATE_POLICY_PATH = path.join(DATA, 'journal_gate_policy.json');

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

// 段階ゲートの既定値（data/journal_gate_policy.json が無い場合のフォールバック）
const DEFAULT_GATE_POLICY = {
  auto_publish_min: 95,
  review_publish_min: 85
};

function loadGatePolicy() {
  const raw = loadJSON(GATE_POLICY_PATH, null);
  if (!raw) return Object.assign({}, DEFAULT_GATE_POLICY);
  const auto = Number(raw.auto_publish_min);
  const review = Number(raw.review_publish_min);
  return {
    auto_publish_min: Number.isFinite(auto) ? auto : DEFAULT_GATE_POLICY.auto_publish_min,
    review_publish_min: Number.isFinite(review) ? review : DEFAULT_GATE_POLICY.review_publish_min
  };
}

// 後方互換: 旧 API 利用者向けに「自動公開ライン」を PASS_THRESHOLD として公開する
const PASS_THRESHOLD = loadGatePolicy().auto_publish_min;

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
// 語彙・ドメイン辞書
// ============================================================
// 独自性はテーマごとに評価語彙を分ける（旧版は today_one のみ 20点満点で、
// seasonal / industry_insider / weekly_digest は angle の文字数判定＝最大15点だった）
const UNIQUENESS_KEYWORDS = {
  today_one: ['価格帯', 'コース', '席', '予約', 'シーン', '接待', 'デート', 'アラカルト', '一人飲み', '繁忙', '回転'],
  industry_insider: ['原価', '仕入れ', 'オペ', '人件費', '回転', '歩留まり', '仕込み', '業界', '構造', '慣習', '相場', '繁忙'],
  weekly_digest: ['新店', '動向', '傾向', '比較', 'エリア', '相場', '予約', 'シーン', '価格帯', '回転'],
  seasonal: ['旬', '時期', '需要', '繁忙', '予約', 'シーン', '相場', '仕入れ', '価格帯', '回転'],
  flexible: ['価格帯', 'コース', '席', '予約', 'シーン', '接待', '相場', '仕入れ', 'オペ', '回転', '業界']
};

const STRATEGIC_SKIP_KEYWORDS = ['食べログランキング', '食べログ百名店', 'クーポン', '割引', '飲み放題特典', '印刷雑誌', '雑誌連動'];
const BRAND_FIT_BONUS_KEYWORDS = ['業界人', '編集部', '現役', '匿名', 'editorReason', 'mediaFeatures', 'insiderNote', 'オペ', '裏側', '目利き'];

// 匿名運営違反検出: 固有名 + 役職パターンを簡易検出
const ANONYMITY_VIOLATION_PATTERNS = [
  /[一-龥]{2,4}(さん|大将|シェフ|オーナー|店主|料理長|親方)/
];

// 一次情報源: 企業の公式発表 / 一次報道。「誰かのまとめ」ではなく出所そのもの。
const PRIMARY_SOURCE_DOMAINS = [
  'prtimes.jp', 'atpress.ne.jp', 'value-press.com', 'kyodonewsprwire.jp',
  'nhk.or.jp', 'asahi.com', 'yomiuri.co.jp', 'mainichi.jp', 'nikkei.com',
  'chunichi.co.jp', 'tokai-tv.com', 'nagoyatv.com', 'ctv.co.jp', 'chukyo-tv.co.jp'
];

// 話題の「証跡」として認めるソーシャル系ドメイン
const SOCIAL_DOMAIN_RE = /(^|\.)(x\.com|twitter\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|note\.com)$/i;

// 集約・二次媒体（一次情報源としては数えない）
const AGGREGATOR_DOMAINS = ['tabelog.com', 'hotpepper.jp', 'gnavi.co.jp', 'retty.me', 'r.gnavi.co.jp'];

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

/** URL からホスト名を取り出す（www. は落とす）。不正な URL は空文字。 */
function hostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_) { return ''; }
}

function isPrimarySource(host) {
  if (!host) return false;
  if (AGGREGATOR_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return false;
  return PRIMARY_SOURCE_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

function isSocialSource(host) {
  return !!host && SOCIAL_DOMAIN_RE.test(host);
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
// 採点ロジック（すべて検証可能な入力から導出する）
// ============================================================

/**
 * 最新性: sources[].date の最新日から算出。日付は記事HTMLにも出るため検証可能。
 * 旧版にあった「X引用で +3」は topicality 側の証跡評価と二重計上になるため撤去し、
 * 代わりに段を少しなだらかにした（7日前でも良記事なら到達しうるようにする）。
 */
function scoreRecency(candidate, today) {
  const sources = candidate.sources || [];
  if (sources.length === 0) return { score: 0, reasons: ['sources が空'] };
  const dated = sources.map(s => s.date).filter(Boolean);
  if (dated.length === 0) return { score: 0, reasons: ['sources に date が無い（日付のない出典は最新性を主張できない）'] };
  const newest = dated.reduce((a, b) => a > b ? a : b);
  const diff = daysBetween(today, newest);
  let score;
  if (diff <= 3) score = 25;
  else if (diff <= 7) score = 22;
  else if (diff <= 14) score = 18;
  else if (diff <= 30) score = 12;
  else score = 0;
  return { score, reasons: [`最新ソース ${diff.toFixed(0)}日前 → ${score}`] };
}

/**
 * 話題性: 「話題だ」と主張させるのではなく、**話題の証跡を URL で出せているか**を測る。
 * 旧版の x_mentions / buzz_score（自己申告・出典なし）は全廃した。
 *   - 取材の広がり(15): sources の独立ドメイン数
 *   - 話題の証跡(10) : X / Instagram / TikTok 等、実在する言及URLの本数
 */
function scoreTopicality(candidate) {
  const sources = candidate.sources || [];
  const reasons = [];
  const hosts = sources.map(s => hostOf(s.url)).filter(Boolean);
  const domains = new Set(hosts);
  const n = domains.size;

  let breadth = 0;
  if (n >= 4) breadth = 15;
  else if (n >= 3) breadth = 12;
  else if (n >= 2) breadth = 8;
  else if (n >= 1) breadth = 4;
  reasons.push(`独立ドメイン ${n}件 → ${breadth}`);

  const socialCount = hosts.filter(isSocialSource).length;
  let socialPts = 0;
  if (socialCount >= 2) socialPts = 10;
  else if (socialCount >= 1) socialPts = 5;
  reasons.push(`話題の証跡URL ${socialCount}件 → ${socialPts}`);

  if (candidate.trending_signals && (candidate.trending_signals.buzz_score != null || candidate.trending_signals.x_mentions != null)) {
    reasons.push('※ trending_signals は採点に使用しない（自己申告値のため・ISSUE-077）');
  }

  return { score: Math.min(WEIGHTS.topicality, breadth + socialPts), reasons };
}

/**
 * 独自性: テーマ別の業界人語彙が angle にいくつ入っているか。
 * 旧版は today_one 以外を angle の文字数で判定していたため、テーマによって
 * 構造的に上限15点になっていた（メモ journal-95-gate-theme-cap の偏り）。
 */
function scoreUniqueness(candidate) {
  const angle = candidate.angle || '';
  const theme = candidate.theme || 'flexible';
  const kws = UNIQUENESS_KEYWORDS[theme] || UNIQUENESS_KEYWORDS.flexible;
  const hits = kws.filter(k => angle.includes(k));
  const score = Math.min(WEIGHTS.uniqueness, hits.length * 5);
  return {
    score,
    reasons: [`独自性キーワード(${theme}) ${hits.length}件${hits.length ? ` (${hits.join(',')})` : ''} → ${score}`]
  };
}

/**
 * ブランド整合: 業界人視点であること + **一次情報源を押さえているか**（信頼性）。
 * 一次情報源加点は、旧 buzz_score の 5点分を「検証できる事実」に置き換えたもの。
 */
function scoreBrandFit(candidate) {
  const text = `${candidate.angle || ''} ${candidate.lead_draft || ''} ${candidate.title_draft || ''}`;
  let score = 8; // ベース8
  const reasons = ['ベース8'];

  const skips = STRATEGIC_SKIP_KEYWORDS.filter(k => text.includes(k));
  if (skips.length) {
    score -= skips.length * 5;
    reasons.push(`Strategic Skip 該当 ${skips.length}件 (${skips.join(',')}) → -${skips.length * 5}`);
  }

  const bonus = BRAND_FIT_BONUS_KEYWORDS.filter(k => text.includes(k));
  if (bonus.length) {
    score += 3;
    reasons.push(`業界人視点キーワード ${bonus.length}件 → +3`);
  }

  const primaryCount = (candidate.sources || []).map(s => hostOf(s.url)).filter(isPrimarySource).length;
  if (primaryCount >= 1) {
    score += 4;
    reasons.push(`一次情報源（公式発表/一次報道） ${primaryCount}件 → +4`);
  } else {
    reasons.push('一次情報源なし → +0（公式発表・一次報道を1件でも押さえると +4）');
  }

  const violated = ANONYMITY_VIOLATION_PATTERNS.some(re => re.test(candidate.lead_draft || ''));
  if (violated) {
    score -= 15;
    reasons.push('匿名運営違反検出（固有名+役職）→ -15');
  }

  return { score: Math.max(0, Math.min(WEIGHTS.brand_fit, score)), reasons };
}

/**
 * 執筆実現性: 実際に書き切れる材料が揃っているか。
 * 旧版は sources 件数を加点していたが topicality と二重計上になるため、
 * 「リードが実際に書けているか」に置き換えた。
 */
function scoreWritability(candidate) {
  let score = 0;
  const reasons = [];

  if (candidate.main_store && candidate.main_store.name) {
    score += 3; reasons.push('main_store あり +3');
  } else if (candidate.theme !== 'today_one' && candidate.theme !== 'weekly_digest') {
    score += 3; reasons.push('店なしテーマ +3');
  } else {
    reasons.push('主役店が必要なテーマなのに main_store 未指定 → +0');
  }

  const leadLen = (candidate.lead_draft || '').length;
  if (leadLen >= 80 && leadLen <= 250) { score += 4; reasons.push(`lead ${leadLen}字 +4`); }
  else if (leadLen >= 40) { score += 2; reasons.push(`lead ${leadLen}字 +2`); }
  else { reasons.push(`lead ${leadLen}字（短すぎ）→ +0`); }

  const tlen = (candidate.title_draft || '').length;
  if (tlen >= 15 && tlen <= 35) { score += 3; reasons.push(`title ${tlen}字 +3`); }
  else if (tlen >= 10 && tlen <= 45) { score += 1; reasons.push(`title ${tlen}字 +1`); }
  else { reasons.push(`title ${tlen}字（SERP切れ/短すぎ）→ +0`); }

  return { score: Math.min(WEIGHTS.writability, score), reasons };
}

/**
 * 新規性: この店（またはコラム）を過去に扱っているか。
 * 旧版は「同テーマが直近30日にあるか」で判定していたが、today_one をほぼ毎日出す運用のため
 * 恒久的に2点となり、5点が構造的に取得不能だった（=3点が死んでいた）。
 * 90日以内の同一店は DISQUALIFIED ゲートで既に弾いているので、ここでは全期間の初出かを見る。
 */
function scoreNovelty(candidate, published) {
  const entries = published.entries || [];
  const storeName = (candidate.main_store && candidate.main_store.name) || '';
  const storeId = (candidate.main_store && candidate.main_store.id) || '';

  if (!storeName && !storeId) {
    const colId = candidate.column_id || '';
    if (!colId) return { score: 3, reasons: ['主役店・コラムIDなし → 3'] };
    const seen = entries.some(e => e.column_id === colId);
    return seen
      ? { score: 2, reasons: [`既出コラム (${colId}) → 2`] }
      : { score: 5, reasons: [`初出コラム (${colId}) → 5`] };
  }

  const seen = entries.some(e =>
    (storeId && (e.store_ids || []).includes(storeId)) ||
    (storeName && (e.pending_store_keys || []).some(k => k && k.includes(storeName))) ||
    (storeName && (e.title || '').includes(storeName))
  );

  return seen
    ? { score: 2, reasons: ['過去に掲載歴のある店（90日超） → 2'] }
    : { score: 5, reasons: ['初掲載の店 → 5'] };
}

// ============================================================
// 採点エントリポイント
// ============================================================
function verdictOf(total, policy) {
  if (total >= policy.auto_publish_min) return 'PASS';
  if (total >= policy.review_publish_min) return 'PASS_WITH_NOTE';
  return 'HOLD';
}

/** PASS_WITH_NOTE のときに published.json へ残す「何が足りなかったか」の一文を作る */
function buildGateNote(result, policy) {
  const b = result.breakdown || {};
  const gaps = Object.keys(WEIGHTS)
    .map(k => ({ k, lost: WEIGHTS[k] - (b[k] || 0) }))
    .filter(x => x.lost > 0)
    .sort((a, b2) => b2.lost - a.lost)
    .slice(0, 3)
    .map(x => `${x.k} -${x.lost}`);
  return `${result.total}点（自動公開ライン ${policy.auto_publish_min}点）。主な不足: ${gaps.join(' / ') || 'なし'}`;
}

function scoreOne(candidate, published, today, policy) {
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
  const novelty = scoreNovelty(candidate, published);
  const total = recency.score + topicality.score + uniqueness.score + brandFit.score + writability.score + novelty.score;

  const out = {
    id: candidate.id,
    title_draft: candidate.title_draft,
    verdict: verdictOf(total, policy),
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
  if (out.verdict === 'PASS_WITH_NOTE') out.gate_note = buildGateNote(out, policy);
  return out;
}

function scoreAll(candidates, opts = {}) {
  const today = opts.today || todayISO();
  const policy = opts.policy || loadGatePolicy();
  const published = opts.published || loadJSON(PUBLISHED_PATH, { entries: [] });
  const scored = candidates.map(c => scoreOne(c, published, today, policy));
  const ranked = scored.slice().sort((a, b) => b.total - a.total);
  const disqualified = scored.filter(r => r.verdict === 'DISQUALIFIED');
  const eligible = ranked.filter(r => r.verdict === 'PASS' || r.verdict === 'PASS_WITH_NOTE');
  const selected = eligible[0] || null;

  return {
    date: today,
    weights: WEIGHTS,
    gate_policy: policy,
    // 後方互換（旧フィールド名を読むコードのため）
    pass_threshold: policy.auto_publish_min,
    ranked: ranked.filter(r => r.verdict !== 'DISQUALIFIED'),
    disqualified,
    selected_id: selected ? selected.id : null,
    selected_verdict: selected ? selected.verdict : null,
    selected_gate_note: selected && selected.gate_note ? selected.gate_note : '',
    // HOLD しか無い日だけフォールバックが必要（＝当日公開ゼロを避ける工程へ進む）
    fallback_needed: !selected,
    // 後から採点を再現・監査できるよう入力も保存する（ISSUE-077）
    inputs: candidates
  };
}

function saveResult(result) {
  if (!fs.existsSync(CANDIDATES_DIR)) fs.mkdirSync(CANDIDATES_DIR, { recursive: true });
  const out = path.join(CANDIDATES_DIR, `${result.date}.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
  return out;
}

function markOf(verdict) {
  if (verdict === 'PASS') return '✅';
  if (verdict === 'PASS_WITH_NOTE') return '🟡';
  return '❌';
}

function printRanking(result, explain) {
  const p = result.gate_policy;
  console.log(`\n=== 候補採点結果 ${result.date} ===`);
  console.log(`ゲート方針: ${p.auto_publish_min}点以上=自動公開 / ${p.review_publish_min}点以上=記録を残して公開 / それ未満=HOLD`);
  console.log(`採用候補: ${result.selected_id || '(なし — HOLD のみ)'}${result.selected_verdict ? ` [${result.selected_verdict}]` : ''}`);
  if (result.selected_gate_note) console.log(`  gate_note: ${result.selected_gate_note}`);
  if (result.disqualified.length) {
    console.log(`\n[失格] ${result.disqualified.length}件`);
    result.disqualified.forEach(d => {
      console.log(`  - ${d.id} "${d.title_draft}" : ${d.disqualified_reasons.join(' / ')}`);
    });
  }
  console.log('\n[採点結果]');
  result.ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${markOf(r.verdict)} [${r.total}/100] ${r.id} "${r.title_draft}"`);
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

function cmdPolicy() {
  const policy = loadGatePolicy();
  const raw = loadJSON(GATE_POLICY_PATH, null);
  console.log('=== 日次ジャーナル 公開ゲート方針 ===');
  console.log(`設定ファイル: ${raw ? GATE_POLICY_PATH : '(未作成 — 既定値を使用)'}`);
  console.log(`  PASS           : ${policy.auto_publish_min}点以上 → 無条件で自動公開`);
  console.log(`  PASS_WITH_NOTE : ${policy.review_publish_min}〜${policy.auto_publish_min - 1}点 → 記録を残して自動公開`);
  console.log(`  HOLD           : ${policy.review_publish_min}点未満 → 公開しない`);
  if (raw && raw.rationale) console.log(`\n背景: ${raw.rationale}`);
}

/**
 * 代表ケースで分布を確認する。閾値をいじる前に必ずこれで確認すること。
 * 「数字を動かして全部通るようにする」のを防ぐための実測用コマンド。
 */
function cmdCalibrate() {
  const policy = loadGatePolicy();
  const published = loadJSON(PUBLISHED_PATH, { entries: [] });
  const today = '2026-07-27';
  const fixtures = [
    {
      note: '一次発表を押さえた新店記事（正直な取材の上限像）',
      c: {
        id: 'fx-strong', theme: 'today_one',
        title_draft: '架空検証用アングルAの見出し文字列',
        lead_draft: '採点キャリブレーション専用の合成リードです。カウンター席と個室の構成、コースのみで夜は38,000円からという価格設定、開業直後という条件を仮定し、価格帯・席構成・接待での使い方を業界人目線で読む想定の文章として十分な長さを確保しています。',
        angle: 'コースのみ38,000円という価格帯設計、カウンターと個室の席構成、予約導線、接待シーンでの使い方を業界人の目利きで裏側から読む',
        main_store: { name: '__calibrate_only__', id: '', area: '名駅', genre: '日本料理' },
        sources: [
          { label: '公式プレスリリース', url: 'https://prtimes.jp/main/html/rd/p/x.html', date: '2026-07-24' },
          { label: 'X 告知', url: 'https://x.com/example/status/1', date: '2026-07-24' },
          { label: 'メディア報道', url: 'https://mantan-web.jp/article/x.html', date: '2026-07-24' },
          { label: '食べログ', url: 'https://tabelog.com/aichi/x/', date: '2026-07-24' }
        ]
      }
    },
    {
      note: '二次媒体のみ・一次発表なしの良記事',
      c: {
        id: 'fx-mid', theme: 'today_one',
        title_draft: '架空検証用アングルBの見出し文字列',
        lead_draft: '採点キャリブレーション専用の合成リードです。価格帯の読み方、繁忙時間帯の避け方、どのシーンに向くかを整理する想定で、予算は3,000円台という条件を仮定しています。二次媒体のみで一次発表を押さえていない場合の着地点を確認します。',
        angle: '価格帯の読み方とアラカルトの頼み方、繁忙の回転、一人飲みに向くシーン設計を業界人目線で読む',
        main_store: { name: '__calibrate_only2__', id: '', area: '栄', genre: '焼肉' },
        sources: [
          { label: 'まとめ媒体', url: 'https://jouhou.nagoya/x/', date: '2026-07-26' },
          { label: 'X 紹介', url: 'https://x.com/example/status/2', date: '2026-07-26' },
          { label: 'ローカル媒体', url: 'https://nagoyajin.nagoya/x/', date: '2026-07-15' }
        ]
      }
    },
    {
      note: '証跡が薄く鮮度も落ちる記事（HOLD されるべき像）',
      c: {
        id: 'fx-weak', theme: 'seasonal',
        title_draft: '架空検証用アングルCの見出し',
        lead_draft: '合成の薄いリード。エリアごとの選び方を紹介する。',
        angle: '全天候型かどうかで選ぶ',
        main_store: { name: '', id: '', area: '', genre: '' },
        sources: [
          { label: '公式サイト', url: 'https://example-beergarden.jp/', date: '2026-07-13' }
        ]
      }
    }
  ];

  console.log('=== 代表ケースの分布（閾値変更前の確認用） ===');
  console.log(`ゲート: PASS>=${policy.auto_publish_min} / PASS_WITH_NOTE>=${policy.review_publish_min}\n`);
  fixtures.forEach(f => {
    const r = scoreOne(f.c, published, today, policy);
    console.log(`${markOf(r.verdict)} [${r.total}/100] ${r.verdict.padEnd(15)} ${f.note}`);
    if (r.breakdown) {
      console.log(`      最新性${r.breakdown.recency}/話題性${r.breakdown.topicality}/独自性${r.breakdown.uniqueness}/ブランド${r.breakdown.brand_fit}/執筆${r.breakdown.writability}/新規${r.breakdown.novelty}`);
    }
  });
  console.log('\n期待する形: 強い記事=PASS / 一次発表なしの良記事=PASS_WITH_NOTE / 薄い記事=HOLD');
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
  let totalCandidates = 0, totalPassed = 0, totalNoted = 0, totalDisqualified = 0;
  const scoreSum = { recency: 0, topicality: 0, uniqueness: 0, brand_fit: 0, writability: 0, novelty: 0 };
  let breakdownCount = 0;
  for (const f of files) {
    const r = loadJSON(path.join(CANDIDATES_DIR, f), null);
    if (!r) continue;
    const ranked = r.ranked || [];
    const n = ranked.length + (r.disqualified || []).length;
    const p = ranked.filter(x => x.verdict === 'PASS').length;
    const w = ranked.filter(x => x.verdict === 'PASS_WITH_NOTE').length;
    totalCandidates += n;
    totalPassed += p;
    totalNoted += w;
    totalDisqualified += (r.disqualified || []).length;
    console.log(`  ${r.date}: 候補${n}件 / PASS${p}件 / 記録付き${w}件 / 失格${(r.disqualified || []).length}件 / 採用=${r.selected_id || '-'}${r.selected_verdict ? ` [${r.selected_verdict}]` : ''}`);
    ranked.forEach(x => {
      if (x.breakdown) {
        Object.keys(scoreSum).forEach(k => { scoreSum[k] += x.breakdown[k] || 0; });
        breakdownCount++;
      }
    });
  }
  console.log(`\n合計: 候補${totalCandidates} / PASS${totalPassed} / 記録付き${totalNoted} / 失格${totalDisqualified}`);
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
    cmdHistory(parseInt(args[1] || '14', 10));
    process.exit(0);
  }
  if (args[0] === '--policy') {
    cmdPolicy();
    process.exit(0);
  }
  if (args[0] === '--calibrate') {
    cmdCalibrate();
    process.exit(0);
  }
  const inputFile = args[0];
  const explain = args.includes('--explain');
  if (!inputFile) {
    console.error('Usage: node scripts/score_journal_candidates.js <input.json> [--explain]');
    console.error('       node scripts/score_journal_candidates.js --history <days>');
    console.error('       node scripts/score_journal_candidates.js --policy');
    console.error('       node scripts/score_journal_candidates.js --calibrate');
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
    console.log(`\n⚠️  ${result.gate_policy.review_publish_min}点以上の候補なし（全て HOLD）— フォールバック工程に進んでください（当日公開ゼロは避ける）`);
    process.exit(2);
  }
  if (result.selected_verdict === 'PASS_WITH_NOTE') {
    console.log(`\n🟡 自動公開ライン(${result.gate_policy.auto_publish_min})未満だが公開可能な帯です。gate_note を published.json に記録して公開してください。`);
    console.log('   （数字を書き換えて点を上げるのは禁止。足りないのは取材＝一次情報源と話題の証跡URLです）');
  }
}

module.exports = { scoreAll, scoreOne, loadGatePolicy, WEIGHTS, PASS_THRESHOLD };
