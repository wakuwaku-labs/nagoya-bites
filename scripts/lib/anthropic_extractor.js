'use strict';

/**
 * scripts/lib/anthropic_extractor.js
 *
 * ISSUE-045 自動化: Claude API による「引用ベースの editorReason 抽出」。
 *
 * 必要な環境変数（CI で GitHub Secrets に設定）:
 *   ANTHROPIC_API_KEY
 *
 * 設計上の安全策（捏造禁止・ISSUE-040 教訓の継承）:
 *   1. プロンプトで「引用元に書かれていない事実は出力するな」を明示
 *   2. 各 claim に対応する source URL を必須化
 *   3. 引用元が不十分なら "INSUFFICIENT_EVIDENCE" を返させる
 *   4. mediaFeatures（受賞・掲載歴のような検証必須情報）は自動生成 **しない**
 *      → editorReason / insiderNote のみ生成。mediaFeatures は別途人手レビュー
 *   5. 出力に confidence (0.0-1.0) を含める。<0.85 は drafts キューで人手レビュー
 *
 * 使い方:
 *   const { extractEditorReason } = require('./lib/anthropic_extractor');
 *   const r = await extractEditorReason(store, evidence);
 *   // r = {editorReason, insiderNote, visitStatus, confidence, sources, status}
 */

const Anthropic = require('@anthropic-ai/sdk');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

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

## 出力（JSON のみ・他のテキスト一切なし）

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

async function extractEditorReason(store, evidence, opts = {}) {
  if (!API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 未設定。docs/editorreason-automation-setup.md 参照');
  }
  const client = new Anthropic({ apiKey: API_KEY });
  const prompt = buildPrompt(store, evidence);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const textBlock = resp.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Claude API 応答にテキストブロックなし');
  let raw = textBlock.text.trim();
  // ```json ... ``` を剥がす
  raw = raw.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { throw new Error(`Claude 応答が JSON ではない: ${e.message}\nraw: ${raw.slice(0, 300)}`); }

  // sources 検証: 2 件未満なら confidence を下げる
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
