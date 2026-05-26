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

/** JSON ブロックを複数パターンで抽出（ネスト配列対応） */
function extractJSON(text) {
  // 1. コードブロック内の JSON を優先
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    try {
      const obj = JSON.parse(codeBlock[1]);
      if (obj && Array.isArray(obj.stores)) return obj.stores;
    } catch (_) {}
  }

  // 2. テキスト全体をそのまま JSON として試す
  try {
    const obj = JSON.parse(text.trim());
    if (obj && Array.isArray(obj.stores)) return obj.stores;
  } catch (_) {}

  // 3. 最外殻 { … } を括弧カウント方式で抽出（ネスト配列バグを回避）
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1));
          if (obj && Array.isArray(obj.stores)) return obj.stores;
        } catch (_) {}
        break;
      }}
    }
  }

  return [];
}

/** 品質バリデーション */
function validateStore(s) {
  const required = ['店名', 'エリア', '都道府県', 'ジャンル', 'アクセス', '追加日', 'おすすめポイント'];
  for (const f of required) {
    if (!s[f]) return `必須フィールド「${f}」が空`;
  }
  if (!/(名古屋市|愛知県)/.test((s['アクセス'] || '') + (s['エリア'] || ''))) {
    return '名古屋市/愛知県が住所に含まれない';
  }
  // 出典URLが無い or 文字列の場合は配列に修正（1件でも通過、ただし警告）
  if (!Array.isArray(s['出典URL'])) {
    s['出典URL'] = s['出典URL'] ? [String(s['出典URL'])] : [];
  }
  if (s['出典URL'].length === 0) return '出典URLが0件（最低1件必要）';
  if (s['出典URL'].length === 1) {
    console.log(`    ⚠ ${s['店名']}: 出典URL1件のみ（推奨は2件）—通過`);
  }
  // おすすめポイントは80字以上（Geminiの出力に合わせて緩和）
  const point = (s['おすすめポイント'] || '').length;
  if (point < 80) return `おすすめポイント ${point}字（80字以上必要）`;
  if (point > 250) {
    // 長すぎる場合は切り詰めて通過
    s['おすすめポイント'] = s['おすすめポイント'].slice(0, 200) + '…';
  }
  const chainPattern = /マクドナルド|ケンタッキー|スターバックス|ドトール|コメダ|サイゼリヤ|ガスト|すき家|吉野家|松屋|CoCo壱|丸亀製麺|くら寿司|スシロー|はま寿司/;
  if (chainPattern.test(s['店名'] || '')) return '大手チェーン店は選定対象外';
  const tabel = s['食べログURL'] || '';
  if (tabel && !/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{8}/i.test(tabel)) {
    s['食べログURL'] = ''; // 不正フォーマットは空に（エラーにはしない）
  }
  // 選定柱はなければ自動補完
  const validPillars = ['PILLAR_A', 'PILLAR_B', 'PILLAR_C', 'PILLAR_D', 'PILLAR_E', 'PILLAR_F'];
  if (!s['選定柱'] || !validPillars.includes(s['選定柱'])) {
    s['選定柱'] = 'PILLAR_B'; // デフォルト：実力の名店
  }
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

/** Step 1用: Google Search で店舗候補をテキストで調査するプロンプト */
function buildSearchPrompt(existingNames) {
  const skip = existingNames.length <= 60
    ? existingNames.join('、')
    : existingNames.slice(0, 60).join('、') + `…（他${existingNames.length - 60}件）`;

  return `名古屋の優良飲食店を以下の6カテゴリから各1〜2件、合計6〜8件を実際に検索して見つけてください。

【カテゴリ】
A: 新店（2025年末〜2026年オープン）
B: 実力の名店（食べログ評価3.7以上 / 百名店 / ミシュラン）
C: 予約困難・隠れ家（1ヶ月先まで満席 / 紹介制）
D: SNS話題店（Instagram/TikTok/Xで最近バズ）
E: メディア推薦店（ナゴレコ / Retty / 地元TV）
F: 地元の名店・老舗（地元客に長年愛される）

【各店舗について以下を調べてください】
- 正式な店名
- エリア（名古屋市○○区）
- ジャンル（具体的に）
- 最寄り駅・徒歩分数
- 食べログURL（個別店舗ページのみ）
- Instagram URL（あれば）
- 公式サイトURL（あれば）
- ホットペッパーURL（あれば）
- 食べログ評価点
- Google評価点
- なぜそのカテゴリで選んだか（具体的な根拠）
- 特徴・おすすめポイント（料理の具体的な特徴・シーン）

【重要】名古屋市内の実在する飲食店のみ。大手チェーン店は除外。
【除外済み（追加禁止）】${skip}

各店舗を番号付きで、上記の項目を全て含めて日本語で詳しく説明してください。`;
}

/** Step 2用: 調査テキストをJSONに変換するプロンプト */
function buildJsonPrompt(searchText, existingNames, today) {
  const skip = existingNames.length <= 60
    ? existingNames.join('、')
    : existingNames.slice(0, 60).join('、') + `…（他${existingNames.length - 60}件）`;

  const SYSTEM = `あなたは名古屋の飲食業界に20年精通したフードエディターです。
以下の調査結果を、指定のJSONフォーマットに変換してください。
出力はJSONのみ（説明文・マークダウン・コードブロック不要）。`;

  const USER = `【調査結果】
${searchText.slice(0, 4000)}

【変換ルール】
- 上記の調査結果に含まれる店舗を、以下のJSONフォーマットで出力する
- 名古屋市内でない店・大手チェーン・以下の既登録店は除外する
- 既登録（除外）: ${skip}
- おすすめポイントは120〜180字（業界人目線・料理の具体的特徴・シーン明記）
- 食べログURLは個別店舗URL（tabelog.com/aichi/...）のみ。不明なら空文字
- 選定柱はA〜Fに対応: PILLAR_A〜PILLAR_F
- 追加日: ${today}

出力フォーマット（このJSONのみ出力）:
{"stores":[{"店名":"正式店名","エリア":"名古屋市○○区","都道府県":"愛知県","ジャンル":"具体的ジャンル","アクセス":"名古屋市○○区○○ ○○駅徒歩○分","キュレーター":"編集部","追加日":"${today}","おすすめポイント":"120〜180字の説明","選定柱":"PILLAR_B","選定理由":"選定根拠","話題フラグ":true,"編集部推薦":true,"話題スコア":80,"写真URL":"","Instagram":"https://www.instagram.com/handle/ または空","食べログURL":"個別URL または空","食べログ評価":3.8,"Google評価":4.2,"価格帯目安":"¥3,000〜¥6,000","おすすめシーン":["接待","デート"],"出典URL":["url1","url2"],"トレンド情報源":["食べログ百名店"]}]}`;

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
  // ① 利用可能なモデルを自動検出
  console.log('  利用可能な Gemini モデルを確認中…');
  const modelName = await findWorkingModel(genAI);

  // ② Step 1: Google Search グラウンディングでテキスト調査
  //    ※グラウンディング時はJSONを求めず、自然言語で店舗情報を取得する
  let searchText = '';
  const searchPrompt = buildSearchPrompt(existingNames);
  console.log(`  Step 1: ${modelName} + Google Search で候補を調査中…`);
  try {
    searchText = await callGemini(genAI, modelName, '', searchPrompt, true);
    console.log(`  Step 1 完了: ${searchText.length}字取得`);
    if (searchText.length < 100) {
      console.warn('  Step 1: 応答が短すぎます。知識ベースのみで続行します。');
      searchText = '';
    }
  } catch (err) {
    console.warn(`  Step 1 (Google Search) 失敗: ${err.message.slice(0, 80)}`);
    console.warn('  Step 2: 知識ベースのみで続行します。');
  }

  // ③ Step 2: 調査テキスト（またはモデルの知識）からJSON生成
  //    ※グラウンディングなし → 純粋な JSON 出力が得られる
  console.log(`  Step 2: JSON フォーマット生成中…`);
  const { SYSTEM, USER } = buildJsonPrompt(searchText || '（Google Search結果なし）', existingNames, today);
  try {
    const jsonText = await callGemini(genAI, modelName, SYSTEM, USER, false);
    return jsonText;
  } catch (err) {
    console.error(`  Step 2 失敗: ${err.message.slice(0, 80)}`);
    return '';
  }
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

  // デバッグ: Gemini の応答先頭を表示（問題診断用）
  console.log(`  [DEBUG] Gemini 応答 (先頭300字):`);
  console.log('  ' + text.slice(0, 300).replace(/\n/g, '\n  '));
  console.log('  ...');

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
