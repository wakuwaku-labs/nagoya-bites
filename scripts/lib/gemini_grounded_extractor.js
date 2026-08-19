'use strict';

/**
 * scripts/lib/gemini_grounded_extractor.js
 *
 * ISSUE-045/098 自動化: editorReason の「引用ベース抽出」実装（第3版）。
 *
 * 経緯: 当初 Google Custom Search JSON API（CSE）+ Claude、次に CSE + Gemini で
 * 実装したが、実際に稼働させたところ全クエリが
 * "This project does not have the access to Custom Search JSON API" で失敗した。
 * 調査の結果、Google公式ドキュメント（developers.google.com/custom-search/v1/overview）に
 * 「The Custom Search JSON API is closed to new customers.」と明記されており、
 * 2025年に新規プロジェクトへの提供自体が停止されていたと判明（設定ミスではない）。
 *
 * 対応: CSE を使わず、scripts/daily_store_discovery.js と同じ「Gemini の
 * Google検索グラウンディング機能」（無料枠）で置き換えた。
 *   1. Gemini + googleSearch tool で「店の業界視点情報」を自然文で調査
 *      → groundingMetadata.groundingChunks から実際に参照したURL一覧を取得
 *   2. 同じ Gemini（tool無し）で 調査結果 + 実URL一覧 を渡し、JSON抽出
 *      → 出力の sources_used[].url が実URL一覧に含まれるかコード側で検証
 *        （含まれないURLは除外し confidence を下げる。LLMの自己申告を鵜呑みにしない。
 *         CSE版より安全策が1段強い: CSE版は「与えた snippet だけを根拠にしろ」と
 *         プロンプトで指示するのみで独立検証が無かった）
 *
 * 必要な環境変数:
 *   GEMINI_API_KEY（scripts/daily_store_discovery.js と共用可・無料枠）
 *
 * 安全策（ISSUE-040 教訓の継承・anthropic_extractor.js と同一の設計思想）:
 *   1. 調査結果にない事実は書かない（プロンプト）
 *   2. sources_used の URL は実際の groundingChunks に含まれるものだけを正とする（コード側検証）
 *   3. 引用元不十分なら INSUFFICIENT_EVIDENCE
 *   4. mediaFeatures は出力しない
 *   5. confidence < 0.85 は人手レビュー必須（呼び出し側 build_editorreason_drafts.js が判定）
 *
 * 使い方:
 *   const { extractEditorReason } = require('./lib/gemini_grounded_extractor');
 *   const r = await extractEditorReason(store);
 *   // r = {status, editorReason, insiderNote, visitStatus, confidence, sources_used, warnings}
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// build_editorreason_drafts.js のキャッシュ判定に使う版識別子。
// 抽出ロジック（プロンプト・検証方式）を変えたら値を上げること
// （CSE版など旧実装のキャッシュを誤って再利用しないための目印・ISSUE-098）
const EXTRACTOR_VERSION = 'gemini_search_grounding_v1';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
].filter(Boolean);

let cachedModelName = null;

async function findWorkingModel(genAI) {
  if (cachedModelName) return cachedModelName;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
        generationConfig: { maxOutputTokens: 5 },
      });
      result.response.text();
      cachedModelName = modelName;
      return modelName;
    } catch (err) {
      // 次の候補へ
    }
  }
  throw new Error('利用可能な Gemini モデルが見つかりません。GEMINI_API_KEY を確認してください。');
}

function storeFields(store) {
  return {
    name: store['店名'] || store.name || '',
    area: store['エリア'] || store.area || '',
    genre: store['ジャンル'] || store.genre || '',
    rating: store['Google評価'] || store.rating || '',
    reviews: store['口コミ数'] || store.reviews || 0,
  };
}

function buildResearchPrompt(store) {
  const s = storeFields(store);
  return `名古屋の飲食店「${s.name}」（${s.area}・${s.genre}）について、Google検索で調べて分かる業界視点の情報
（店主のこだわり・提供スタイルの特徴・地元グルメメディアでの紹介・料理人としての評価など）を、
検索で実際に見つかった内容だけを根拠に日本語でまとめてください。憶測や一般論は書かないでください。
検索しても関連情報が見つからない場合は「関連情報が見つかりませんでした」とだけ書いてください。`;
}

function buildExtractPrompt(store, researchText, allowedUrls) {
  const s = storeFields(store);
  const urlList = allowedUrls.length
    ? allowedUrls.map((u, i) => `  [${i + 1}] ${u.title || '(無題)'} — ${u.uri}`).join('\n')
    : '(参照可能な URL なし)';

  return `あなたは飲食業界の編集者です。NAGOYA BITES（名古屋飲食店ガイド）の業界視点コメント（editorReason）を、
下記の「調査結果」と「参照可能なURL一覧」だけを根拠に書きます。

## 対象店舗
- 店名: ${s.name}
- エリア: ${s.area}
- ジャンル: ${s.genre}
- 評価: ${s.rating} (口コミ ${s.reviews}件)

## 調査結果（Google検索グラウンディングによる自然文）

${researchText}

## 参照可能な URL 一覧（sources_used に書けるのはこの中の URL のみ）

${urlList}

## 厳格なルール

1. **調査結果にない事実は書かない**。憶測・想像で書くのは禁止。
2. **sources_used の url は必ず上記「参照可能なURL一覧」の中からそのままコピーすること**。一覧にないURLを作らない・改変しない。
3. **2件以上の独立したURL**で裏取れる事実だけを editorReason に含める。
4. editorReason は **60〜120 字**。「なぜこの店が業界視点で良いか」を平易な日本語で。
5. **mediaFeatures は出力しない**（過去に捏造事故 ISSUE-040 があり、自動生成禁止）。
6. visitStatus は必ず **"desk_automated"**。
7. insiderNote（任意・40〜100字）は調査結果中の業界視点情報のみで作る。なければ空文字。
8. **調査結果が薄い、または参照可能なURLが無い**場合は status="INSUFFICIENT_EVIDENCE" を返す。憶測で書かない。
9. **掲載NG兆候**（閉店情報・営業停止・スキャンダル）を発見した場合、status="WARN_RISK" を返し、warnings配列に理由を書く。

## 出力（JSON のみ・他のテキスト一切なし。マークダウンのコードフェンスも付けない）

{
  "status": "OK" | "INSUFFICIENT_EVIDENCE" | "WARN_RISK",
  "editorReason": "...",
  "insiderNote": "",
  "visitStatus": "desk_automated",
  "confidence": 0.0-1.0,
  "sources_used": [
    {"url": "...", "snippet_quote": "調査結果からの該当箇所", "supports": "この URL が裏付ける fact の説明"}
  ],
  "warnings": []
}`;
}

async function callGemini(genAI, modelName, prompt, useSearch, maxOutputTokens) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
  });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens },
  });
  return result.response;
}

function extractGroundingUrls(response) {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const out = [];
  for (const c of chunks) {
    if (c.web && c.web.uri && !seen.has(c.web.uri)) {
      seen.add(c.web.uri);
      out.push({ uri: c.web.uri, title: c.web.title || '' });
    }
  }
  return out;
}

async function extractEditorReason(store, opts = {}) {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY 未設定。docs/editorreason-automation-setup.md 参照');
  }
  const genAI = new GoogleGenerativeAI(API_KEY);
  const modelName = await findWorkingModel(genAI);

  // 1) 検索グラウンディングで調査
  // maxOutputTokens は 8192（scripts/daily_store_discovery.js と同じ値）。
  // gemini-2.5系は既定で「thinking」トークンが maxOutputTokens を消費するため、
  // 2048では visible な出力が思考トークンに食われて MAX_TOKENS 切断が実際に多発した（ISSUE-098実測）
  const researchResp = await callGemini(genAI, modelName, buildResearchPrompt(store), true, 8192);
  const researchText = (researchResp.text() || '').trim();
  const groundingUrls = extractGroundingUrls(researchResp);

  if (!researchText || groundingUrls.length === 0) {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      editorReason: '',
      insiderNote: '',
      visitStatus: 'desk_automated',
      confidence: 0,
      sources_used: [],
      warnings: ['検索グラウンディングで関連URLが見つからなかった'],
      extractor: EXTRACTOR_VERSION,
      _debug: { researchText, groundingUrls },
    };
  }

  // 2) JSON 抽出（tool 無し）
  const extractResp = await callGemini(
    genAI, modelName, buildExtractPrompt(store, researchText, groundingUrls), false, 8192
  );
  let raw = (extractResp.text() || '').trim();
  raw = raw.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) {
    const finishReason = extractResp.candidates?.[0]?.finishReason || '?';
    const hint = finishReason === 'MAX_TOKENS' ? '（maxOutputTokens上限に達して途中で切れた可能性）' : '';
    throw new Error(`Gemini 応答が JSON ではない: ${e.message}${hint} finishReason=${finishReason}\nraw: ${raw.slice(0, 300)}`);
  }

  // sources_used の URL がグラウンディングで実際に得られた URL かをコード側で検証
  // （LLM の自己申告を鵜呑みにしない・CSE 版より安全策を1段強化）
  const allowedUris = new Set(groundingUrls.map(u => u.uri));
  const sources = obj.sources_used || [];
  const verifiedSources = sources.filter(s => s && allowedUris.has(s.url));
  const droppedCount = sources.length - verifiedSources.length;
  obj.sources_used = verifiedSources;
  obj.warnings = obj.warnings || [];
  if (droppedCount > 0) {
    obj.warnings.push(`${droppedCount}件のURLが実際の検索結果に無いため除外（要確認）`);
    obj.confidence = Math.min(obj.confidence || 0.5, 0.6);
  }
  if (obj.status === 'OK' && verifiedSources.length === 0) {
    obj.status = 'INSUFFICIENT_EVIDENCE';
  } else if (obj.status === 'OK' && verifiedSources.length < 2) {
    obj.confidence = Math.min(obj.confidence || 0.5, 0.7);
    obj.warnings.push('sources_used が 2 件未満（人手レビュー必須）');
  }

  obj.extractor = EXTRACTOR_VERSION;
  obj._debug = { researchText, groundingUrls };
  return obj;
}

function isConfigured() {
  return !!API_KEY;
}

module.exports = { extractEditorReason, isConfigured, EXTRACTOR_VERSION };
