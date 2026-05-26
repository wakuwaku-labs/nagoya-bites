#!/usr/bin/env node
/**
 * scripts/daily_store_discovery.js
 *
 * 毎日 GitHub Actions から自動実行される「名古屋 厳選店舗 自動発掘スクリプト」。
 * Google Gemini API（無料枠） + Google Search グラウンディングで候補を探し、
 * 6つの選定柱 × 品質ゲート × 多様性ルールを通過した 5〜6件を
 * data/manual_stores.json に追記する。
 *
 * ── 費用 ──
 *   Gemini 2.0 Flash 無料枠: 15回/分・1,500回/日・完全無料
 *   APIキー取得: https://aistudio.google.com/apikey
 *   GitHub Secret 名: GEMINI_API_KEY
 *
 * ── 選定基準（6つの柱） ──
 *   PILLAR_A: 新店注目    — 2025年末〜2026年オープン、業界が注目する新規開業
 *   PILLAR_B: 実力の名店  — 食べログ百名店/ミシュラン/長年の実績、本物の実力店
 *   PILLAR_C: 予約困難    — 1ヶ月以上待ち、食通が認める隠れ家・予約困難店
 *   PILLAR_D: SNS話題     — Instagram/TikTok/X でバズ中、若い世代が発見
 *   PILLAR_E: メディア推薦 — ナゴレコ/Retty/地元TV・誌で特集された注目店
 *   PILLAR_F: 地元の名店  — 地元客に長年支持される老舗・街の名物店
 *
 * ── 品質ゲート ──
 *   ・実在確認: 2ソース以上（必須）
 *   ・名古屋市内住所（必須）
 *   ・食べログ評価 3.5 以上 OR 百名店/ミシュラン掲載（推奨）
 *   ・Google評価 4.0 以上（推奨）
 *   ・現在営業中（必須）
 *   ・独立系優先（大手チェーン不可）
 *
 * ── 多様性ルール（1バッチ内） ──
 *   ・同一ジャンル: 最大2件まで
 *   ・同一エリア: 最大2件まで
 *   ・価格帯: リーズナブル〜ハイエンドを混在
 *
 * 必須環境変数: GEMINI_API_KEY
 * 使い方:
 *   node scripts/daily_store_discovery.js          # 実行
 *   node scripts/daily_store_discovery.js --dry-run # 書き込みなしで確認
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs        = require('fs');
const path      = require('path');

const FILE     = path.join(__dirname, '..', 'data', 'manual_stores.json');
const DRY_RUN  = process.argv.includes('--dry-run');
const TARGET_N = 6;  // 1回あたり追加目標（6つの柱に対応）
// 利用可能なモデルを上から順に試す（APIによって廃止・移行が変わるため複数候補を持つ）
const MODEL_CANDIDATES = [
  'gemini-2.5-flash-preview-05-20', // 2025-05 リリース・最新安定版
  'gemini-2.5-flash',               // 2.5 安定版
  'gemini-2.5-pro-preview-05-06',   // 2.5 Pro preview
  'gemini-2.0-flash-lite',          // 2.0 lite（軽量版）
  'gemini-1.5-flash-latest',        // 1.5 flash 最新
  'gemini-1.5-flash-002',           // 1.5 flash 特定バージョン
];

// ── ユーティリティ ──────────────────────────────────────
function todayJST() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** JSON ブロックを複数パターンで抽出 */
function extractJSON(text) {
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\{[\s\S]*?"stores"\s*:\s*\[[\s\S]*?\]\s*\})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    try {
      const obj = JSON.parse(m[1] || m[0]);
      if (obj && Array.isArray(obj.stores)) return obj.stores;
    } catch (_) { /* 次へ */ }
  }
  return [];
}

/** 品質バリデーション */
function validateStore(s) {
  const required = ['店名', 'エリア', '都道府県', 'ジャンル', 'アクセス', '追加日', 'おすすめポイント', '選定柱'];
  for (const f of required) {
    if (!s[f]) return `必須フィールド「${f}」が空`;
  }
  if (!/(名古屋市|愛知県)/.test((s['アクセス'] || '') + (s['エリア'] || ''))) {
    return '名古屋市/愛知県が住所に含まれない';
  }
  const sources = Array.isArray(s['出典URL']) ? s['出典URL'] : [];
  if (sources.length < 2) return `出典URL ${sources.length}件（2件以上必要）`;
  const point = (s['おすすめポイント'] || '').length;
  if (point < 120) return `おすすめポイント ${point}字（120字以上必要）`;
  if (point > 200) return `おすすめポイント ${point}字（200字以下にする）`;
  const chainPattern = /マクドナルド|ケンタッキー|スターバックス|ドトール|コメダ|サイゼリヤ|ガスト|すき家|吉野家|松屋|CoCo壱|丸亀製麺|くら寿司|スシロー|はま寿司/;
  if (chainPattern.test(s['店名'] || '')) return '大手チェーン店は選定対象外';
  const tabel = s['食べログURL'] || '';
  if (tabel && !/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{8}/i.test(tabel)) {
    s['食べログURL'] = '';
  }
  const validPillars = ['PILLAR_A', 'PILLAR_B', 'PILLAR_C', 'PILLAR_D', 'PILLAR_E', 'PILLAR_F'];
  if (!validPillars.includes(s['選定柱'])) return `選定柱「${s['選定柱']}」が無効`;
  return null;
}

/** 1バッチ内の多様性チェック */
function checkDiversity(store, accepted) {
  const genre = (store['ジャンル'] || '').split(/[・\/]/)[0];
  const area  = (store['エリア'] || '').replace(/名古屋市/, '').replace(/区.*/, '区');
  if (accepted.filter(s => (s['ジャンル'] || '').split(/[・\/]/)[0] === genre).length >= 2)
    return `ジャンル「${genre}」が既に2件`;
  if (accepted.filter(s => (s['エリア'] || '').replace(/名古屋市/, '').replace(/区.*/, '区') === area).length >= 2)
    return `エリア「${area}」が既に2件`;
  return null;
}

// ── プロンプト ──────────────────────────────────────────
function buildPrompt(existingNames, today) {
  const listSnippet = existingNames.length <= 80
    ? existingNames.join('、')
    : existingNames.slice(0, 80).join('、') + `…（他${existingNames.length - 80}件）`;

  const SYSTEM = `あなたは名古屋の飲食業界に20年精通したフードエディターです。
単なる「話題店」だけでなく、本物の実力と価値を持つ店を厳選してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【選定の6つの柱】各柱から少なくとも1件ずつ選ぶこと
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PILLAR_A【新店注目】
  2025年末〜2026年オープン。有名シェフの独立・期待の若手・新業態など。
  根拠: 開店記事 / 公式SNS初投稿 / 業界メディアの初報

PILLAR_B【実力の名店】
  食べログ百名店・ミシュラン掲載・評価3.7以上の継続店。
  一過性の話題ではなく「本物の実力」で選ぶ。
  根拠: 食べログ百名店掲載URL / ミシュランガイド記載 / 長年の実績記事

PILLAR_C【予約困難・隠れ家】
  1ヶ月以上先まで予約が埋まっている店。完全紹介制・常連のみの隠れ家。
  根拠: 満席言及記事 / 業界人の口コミ / 食べログの予約状況

PILLAR_D【SNS・若者に人気】
  Instagram/TikTok/Xで直近3ヶ月以内にバズった店。
  料理ビジュアルが秀逸で若い世代が発信している。
  根拠: 公式Instagramフォロワー数 / バズった投稿URL

PILLAR_E【メディア・グルメ誌推薦】
  ナゴレコ・Retty・地元テレビ・東海地方グルメ誌で特集された店。
  単なるリスト掲載ではなくメイン取材として取り上げられた店。
  根拠: ナゴレコ記事URL / Rettyベスト掲載 / テレビ特集の言及

PILLAR_F【地元に愛される名店】
  地元客リピーターに長年支持される老舗・街の名物店。
  観光客向けでなく、名古屋の人間が「あそこは本物だ」と言う店。
  根拠: 食べログ口コミの地元率 / 長年の営業実績

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【品質ゲート（全て満たすこと）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ゲートA: 実在確認（以下から2ソース以上）
  食べログ個別店舗ページ / HotPepper店舗ページ / 公式Instagram（3ヶ月以内に投稿）
  公式Webサイト（名古屋市内住所） / Retty店舗ページ / ナゴレコ記事URL

✅ ゲートB: 住所に「名古屋市○○区」が明記されていること

✅ ゲートC: 品質基準（いずれか満たす）
  食べログ評価3.5以上 / 食べログ百名店またはミシュラン掲載 / Google評価4.0以上

✅ ゲートD: 現在営業中（公式SNSまたはWebで直近3ヶ月以内の更新）

❌ 除外: 大手チェーン店 / 閉業・移転の可能性 / 1ソースのみ / 情報不足で120字書けない店

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【多様性ルール（1バッチ内）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  同一ジャンル: 最大2件 / 同一エリア（区）: 最大2件
  価格帯: 〜¥3,000 / ¥3,000〜¥8,000 / ¥8,000〜 を各1件以上含む

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【おすすめポイントの書き方】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  120〜180字。業界人の目線で「なぜこの店が特別か」を言語化する。
  料理の具体的特徴（食材・産地・調理法）を入れる。
  どんなシーン・客層に最適か明示（接待・デート・女子会 等）。
  「美味しい」「おすすめ」などの抽象語を使わず具体的事実で書く。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【追加禁止（既登録店）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${listSnippet}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力フォーマット】JSONのみ出力（前後の説明文・マークダウン不要）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
食べログURLは個別店舗ページのみ。不明なら空文字（検索URLは禁止）。

{
  "stores": [
    {
      "店名": "（正式店名）",
      "エリア": "名古屋市○○区",
      "都道府県": "愛知県",
      "ジャンル": "（具体的に: 創作フレンチ / スペシャルティコーヒー 等）",
      "アクセス": "名古屋市○○区〇〇 ○○駅から徒歩○分",
      "キュレーター": "編集部",
      "追加日": "${today}",
      "おすすめポイント": "（120〜180字・業界人目線・具体的・シーン明記）",
      "選定柱": "PILLAR_A",
      "選定理由": "（なぜこの柱で選んだか・根拠1〜2文）",
      "話題フラグ": true,
      "編集部推薦": true,
      "話題スコア": 82,
      "写真URL": "",
      "Instagram": "（https://www.instagram.com/{handle}/ または空文字）",
      "食べログURL": "（個別ページURL または空文字）",
      "食べログ評価": 3.8,
      "Google評価": 4.3,
      "価格帯目安": "¥5,000〜¥10,000",
      "おすすめシーン": ["接待", "デート"],
      "出典URL": ["確認ソースURL1", "確認ソースURL2"],
      "トレンド情報源": ["食べログ百名店", "ナゴレコ"]
    }
  ]
}`;

  const USER = `名古屋の飲食店を厳選して${TARGET_N}件発掘してください。

【作業手順】
1. Google Search で各PILLAR（A〜F）の候補を1〜2件ずつ探す
2. 各候補の食べログ・Instagram・Webサイト等で実在・品質・営業中を確認する
3. 品質ゲートを全て通過した店のみを最終候補とする
4. 多様性ルール（ジャンル・エリア・価格帯）を確認する
5. 最終的に${TARGET_N}件をJSONのみで出力する（説明文は不要）

「話題性があるから」だけでなく「本物の実力・価値があるから」で選んでください。
食べログ百名店・ミシュラン・長年の地元人気など、裏付けのある実力を重視してください。`;

  return { SYSTEM, USER };
}

// ── 利用可能モデルの自動検出 ────────────────────────────
async function findWorkingModel(genAI) {
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      // 短いテスト呼び出しで疎通確認
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
        generationConfig: { maxOutputTokens: 5 },
      });
      result.response.text(); // 例外が出なければ OK
      console.log(`  ✅ 利用可能なモデル: ${modelName}`);
      return modelName;
    } catch (err) {
      const reason = err.message.includes('404') ? '404' :
                     err.message.includes('403') ? '403' : err.message.slice(0, 40);
      console.log(`  ✗ ${modelName}: ${reason}`);
    }
  }
  throw new Error('利用可能な Gemini モデルが見つかりません。GEMINI_API_KEY を確認してください。');
}

// ── Gemini API 呼び出し ──────────────────────────────────
async function callGemini(genAI, modelName, systemPrompt, userPrompt, useSearch) {
  // 2.5系・2.0系は googleSearch / 1.5系は googleSearchRetrieval
  const toolsConfig = useSearch
    ? modelName.startsWith('gemini-2') || modelName.startsWith('gemini-1.5')
      ? modelName.includes('1.5') ? [{ googleSearchRetrieval: {} }] : [{ googleSearch: {} }]
      : []
    : [];

  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(toolsConfig.length > 0 ? { tools: toolsConfig } : {}),
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  });

  const response = result.response;
  if (!response.candidates || response.candidates.length === 0) return '';
  return response.text();
}

async function discoverStores(genAI, existingNames, today) {
  const { SYSTEM, USER } = buildPrompt(existingNames, today);

  // ① 利用可能なモデルを自動検出
  console.log('  利用可能な Gemini モデルを確認中…');
  const modelName = await findWorkingModel(genAI);

  // ② Google Search グラウンディング付きで試みる
  console.log(`  ${modelName} + Google Search で探索中…`);
  try {
    const text = await callGemini(genAI, modelName, SYSTEM, USER, true);
    if (text) return text;
  } catch (err) {
    console.warn(`  Google Search グラウンディング失敗: ${err.message.slice(0, 80)}`);
    console.warn('  フォールバック: 検索なしモードで再試行…');
  }

  // ③ 検索なしフォールバック（学習データで回答）
  return callGemini(genAI, modelName, SYSTEM, USER, false);
}

// ── エントリポイント ────────────────────────────────────
async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY が設定されていません');
    console.error('   取得先: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  const today = todayJST();
  console.log(`\n[${today}] 名古屋 厳選店舗 自動発掘 (Gemini 無料枠)${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`  選定: 6柱 × 品質ゲート × 多様性ルール`);

  const raw           = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const existingNames = (raw.stores || []).map(s => s['店名']);
  console.log(`  既存店舗数: ${existingNames.length}件`);

  const genAI = new GoogleGenerativeAI(apiKey);
  let text;
  try {
    text = await discoverStores(genAI, existingNames, today);
  } catch (err) {
    console.error('❌ Gemini API エラー:', err.message);
    // 詳細情報（APIキー・モデル名の確認用）
    if (err.message.includes('API_KEY') || err.message.includes('403') || err.message.includes('401')) {
      console.error('   → GEMINI_API_KEY が正しいか確認してください');
      console.error('   → https://aistudio.google.com/apikey で再発行できます');
    } else if (err.message.includes('404') || err.message.includes('not found')) {
      console.error(`   → 利用可能なモデルが見つかりません。GEMINI_API_KEY を確認してください`);
    }
    process.exit(1);
  }

  if (!text) {
    console.log('  有効な応答がありませんでした（追加なし）');
    process.exit(0);
  }

  const candidates = extractJSON(text);
  console.log(`  Gemini 候補: ${candidates.length}件`);

  const added    = [];
  const rejected = [];

  for (const s of candidates) {
    if (!s || typeof s !== 'object') continue;

    s['キュレーター'] = s['キュレーター'] || '編集部';
    s['追加日']       = s['追加日']       || today;

    if (existingNames.includes(s['店名'])) {
      rejected.push(`${s['店名']}: 既存店`);
      continue;
    }

    const valErr = validateStore(s);
    if (valErr) {
      rejected.push(`${s['店名'] || '(無名)'}: ${valErr}`);
      continue;
    }

    const divErr = checkDiversity(s, added);
    if (divErr) {
      rejected.push(`${s['店名']}: ${divErr}`);
      continue;
    }

    added.push(s);
    existingNames.push(s['店名']);
  }

  if (rejected.length > 0) {
    console.log(`  除外 (${rejected.length}件):`);
    rejected.forEach(r => console.log(`    ✗ ${r}`));
  }

  if (added.length === 0) {
    console.log('  追加対象なし（0件）');
    process.exit(0);
  }

  if (!DRY_RUN) {
    raw.stores.push(...added);
    fs.writeFileSync(FILE, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }

  console.log(`\n  ✅ ${added.length}件${DRY_RUN ? '（DRY RUN・未書き込み）' : '追加'}:`);
  added.forEach(s => console.log(`    + [${s['選定柱']}] ${s['店名']} (${s['エリア']}) — ${s['ジャンル']}`));

  const covered = [...new Set(added.map(s => s['選定柱']))];
  console.log(`  選定柱カバレッジ: ${covered.join(', ')} (${covered.length}/6)\n`);
}

main().catch(err => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
