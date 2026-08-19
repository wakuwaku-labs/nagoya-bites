'use strict';

/**
 * scripts/lib/gemini_extractor.js
 *
 * ISSUE-045 自動化: Gemini API（無料枠）による「引用ベースの editorReason 抽出」。
 * scripts/lib/anthropic_extractor.js と同一インターフェース・同一プロンプト設計の
 * Gemini 版（ISSUE-098: Anthropic の新規アカウント作成を避け、既存の GEMINI_API_KEY
 * を流用するために追加。scripts/daily_store_discovery.js と同じ無料枠モデルを使う）。
 *
 * 必要な環境変数（CI で GitHub Secrets に設定・既存キーを流用可）:
 *   GEMINI_API_KEY
 *
 * 設計上の安全策（捏造禁止・ISSUE-040 教訓の継承。anthropic_extractor.js と同一）:
 *   1. プロンプトで「引用元に書かれていない事実は出力するな」を明示
 *   2. 各 claim に対応する source URL を必須化
 *   3. 引用元が不十分なら "INSUFFICIENT_EVIDENCE" を返させる
 *   4. mediaFeatures（受賞・掲載歴のような検証必須情報）は自動生成 **しない**
 *   5. 出力に confidence (0.0-1.0) を含める。<0.85 は drafts キューで人手レビュー
 *
 * 使い方:
 *   const { extractEditorReason } = require('./lib/gemini_extractor');
 *   const r = await extractEditorReason(store, evidence);
 *   // r = {editorReason, insiderNote, visitStatus, confidence, sources_used, status}
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY || '';
// scripts/daily_store_discovery.js と同じ無料枠モデル候補（上から順に疎通確認）
const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
].filter(Boolean);

let cachedModelName = null;

function buildPrompt(store, evidence) {
  const evidenceBlocks = evidence
    .filter(e => e.items && e.items.length > 0)
    .map(e => {
      const lines = e.items.map((it, i) =>
        `  [${i + 1}] title: ${it.title}\n      url: ${it.link}\n      snippet: ${it.snippet}`
      ).join('\n');
      return `query: "${e.query}"\n${lines}`;
    }).join('\n\n');

  return `あなたは飲食業界の編集者です。NAGOYA BITES（名古屋飲食店ガイド）の業界視点コメント（editorReason）を、与えられた「Web 検索エビデンス」だけを根拠に書きます。

## 対象店舗
- 店名: ${store['店名'] || store.name}
- エリア: ${store['エリア'] || store.area || ''}
- ジャンル: ${store['ジャンル'] || store.genre || ''}
- 評価: ${store['Google評価'] || store.rating || ''} (口コミ ${store['口コミ数'] || store.reviews || 0}件)

## エビデンス（Google 検索 snippets）

${evidenceBlocks || '(エビデンスなし)'}

## 厳格なルール

1. **引用元にない事実は書かない**。snippet に明記されていない受賞・営業実態・店主経歴などを推測・想像で書くのは禁止。
2. **2 件以上の独立した snippet** で裏取れる事実だけを editorReason に含める。
3. editorReason は **60〜120 字**。「なぜこの店が業界視点で良いか」を平易な日本語で。
4. **mediaFeatures は出力しない**（過去に捏造事故 ISSUE-040 があり、自動生成禁止）。
5. visitStatus は必ず **"desk_automated"**（机上・自動生成の意）。
6. insiderNote（任意・40〜100字）は snippet 中の業界視点情報のみで作る。なければ空文字。
7. **エビデンス不十分**なら status="INSUFFICIENT_EVIDENCE" を返す。憶測で書かない。
8. **掲載 NG 兆候**（閉店情報・営業停止・スキャンダル）を発見した場合、status="WARN_RISK" を返し、warnings 配列に理由を書く。

## 出力（JSON のみ・他のテキスト一切なし。マークダウンのコードフェンスも付けない）

{
  "status": "OK" | "INSUFFICIENT_EVIDENCE" | "WARN_RISK",
  "editorReason": "...",
  "insiderNote": "",
  "visitStatus": "desk_automated",
  "confidence": 0.0-1.0,
  "sources_used": [
    {"url": "...", "snippet_quote": "verbatim or near-verbatim 引用", "supports": "この URL が裏付ける fact の説明"}
  ],
  "warnings": []
}`;
}

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

async function extractEditorReason(store, evidence, opts = {}) {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY 未設定。docs/editorreason-automation-setup.md 参照');
  }
  const genAI = new GoogleGenerativeAI(API_KEY);
  const modelName = await findWorkingModel(genAI);
  const model = genAI.getGenerativeModel({ model: modelName });
  const prompt = buildPrompt(store, evidence);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  });

  const response = result.response;
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('Gemini API 応答に candidates なし');
  }
  let raw = response.text().trim();
  // ```json ... ``` を剥がす
  raw = raw.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { throw new Error(`Gemini 応答が JSON ではない: ${e.message}\nraw: ${raw.slice(0, 300)}`); }

  // sources 検証: 2 件未満なら confidence を下げる（anthropic_extractor.js と同一ルール）
  const sources = obj.sources_used || [];
  if (obj.status === 'OK' && sources.length < 2) {
    obj.confidence = Math.min(obj.confidence || 0.5, 0.7);
    obj.warnings = (obj.warnings || []).concat(['sources_used が 2 件未満（人手レビュー必須）']);
  }
  return obj;
}

function isConfigured() {
  return !!API_KEY;
}

module.exports = { extractEditorReason, isConfigured };
