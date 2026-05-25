#!/usr/bin/env node
/**
 * scripts/daily_store_discovery.js
 *
 * 毎日 GitHub Actions から自動実行される「名古屋話題店 自動発掘スクリプト」。
 * Anthropic Messages API + web_search ツールで候補を探し、実在検証ゲートを通過した
 * 5〜6件を data/manual_stores.json に追記する。
 *
 * 必須環境変数: ANTHROPIC_API_KEY
 * 使い方:
 *   node scripts/daily_store_discovery.js          # 実行
 *   node scripts/daily_store_discovery.js --dry-run # 書き込みなしで確認
 *
 * CI フロー:
 *   daily-store-add.yml → このスクリプト → (変更あれば) git push → build.yml が起動
 *   → fetch_manual_store_photos.js が実写取得 → index.html に焼き込み → デプロイ
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');

const FILE       = path.join(__dirname, '..', 'data', 'manual_stores.json');
const DRY_RUN    = process.argv.includes('--dry-run');
const TARGET_N   = 5;  // 1回あたり追加目標

// ── ユーティリティ ──────────────────────────────────────
function todayJST() {
  return new Date(Date.now() + 9 * 3600_000)
    .toISOString().slice(0, 10);
}

/** JSON ブロックを複数パターンで抽出 */
function extractJSON(text) {
  const patterns = [
    // コードブロック
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    // ベアJSON (stores キーを含む最大のブロック)
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

/** 最低限のバリデーション（ゲート B: 名古屋実在性 + ゲート A の ソース数） */
function validateStore(s) {
  const required = ['店名', 'エリア', '都道府県', 'ジャンル', 'アクセス', '追加日', 'おすすめポイント'];
  for (const f of required) {
    if (!s[f]) return `必須フィールド「${f}」が空`;
  }
  if (!/(名古屋市|愛知県)/.test((s['アクセス'] || '') + (s['エリア'] || ''))) {
    return '名古屋市/愛知県が住所に含まれない（ゲートB違反）';
  }
  const sources = Array.isArray(s['出典URL']) ? s['出典URL'] : [];
  if (sources.length < 2) {
    return `出典URLが${sources.length}件（2件以上必要・ゲートA違反）`;
  }
  const point = (s['おすすめポイント'] || '').length;
  if (point < 80) return `おすすめポイントが短すぎる（${point}字、80字以上必要）`;
  // 食べログURLが設定されている場合は個別店舗URLチェック
  const tabel = s['食べログURL'] || '';
  if (tabel && !/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{8}/i.test(tabel)) {
    // 検索URLや不正URL → フィールドをクリア（エラーにしない）
    s['食べログURL'] = '';
  }
  return null; // OK
}

// ── メイン探索ロジック ──────────────────────────────────
async function discoverStores(client, existingNames, today) {
  const listSnippet = existingNames.length <= 60
    ? existingNames.join('、')
    : existingNames.slice(0, 60).join('、') + `…（他${existingNames.length - 60}件）`;

  const SYSTEM = `あなたは名古屋の飲食業界に精通したフードエディターです。
以下のルールを厳守してください。

【実在検証ゲート（絶対遵守）】
各候補について web_search で必ず2ソース以上の実在確認を行い、通過した店だけを出力してください。
・ゲートA: 以下のうち2つ以上でヒットすること
  - HotPepper 公式（hotpepper.jp/str…）の店舗ページ
  - 食べログ（tabelog.com/aichi/）の個別店舗ページ
  - Google 検索で「店名 名古屋」が確認できる
  - Retty 公式の店舗ページ
  - 公式 Instagram（最終投稿が6ヶ月以内）
  - 公式 Web サイト（名古屋市内住所あり）
・ゲートB: アクセス欄に「名古屋市○○区」形式の住所があること
・ゲートC: 2026年内の話題性根拠（新店・予約困難・SNS急上昇・メディア掲載など）
1ソースしか確認できない店は除外し、確認できた店だけを出力すること。

【追加禁止（既登録店）】
${listSnippet}

【出力ルール】
検証完了後、以下の JSON のみを出力してください（前後の説明文は不要）。
食べログURLは tabelog.com/aichi/... 形式の個別店舗ページURLのみ。
見つからない場合は空文字にすること（検索URLは禁止）。

{
  "stores": [
    {
      "店名": "（正式店名）",
      "エリア": "名古屋市○○区",
      "都道府県": "愛知県",
      "ジャンル": "（例: 鮨・和食 / ラーメン / カフェ など）",
      "アクセス": "名古屋市○○区〇〇 ○○駅から徒歩○分",
      "キュレーター": "編集部",
      "追加日": "${today}",
      "おすすめポイント": "（130〜170字・業界視点で差別化要素・シーン適性・独自性を具体的に）",
      "話題フラグ": true,
      "編集部推薦": true,
      "話題スコア": 82,
      "写真URL": "",
      "Instagram": "（https://www.instagram.com/{handle}/ または空文字）",
      "食べログURL": "（https://tabelog.com/aichi/... 個別店舗ページのみ・なければ空文字）",
      "Google評価": 4.3,
      "出典URL": ["確認ソースURL1", "確認ソースURL2"],
      "トレンド情報源": ["ナゴレコ", "Instagram"]
    }
  ]
}`;

  const USER = `2026年5月・6月時点の名古屋で話題の飲食店を${TARGET_N}件発掘してください。
以下の4方向をバランスよくカバーしてください：
1. 2026年新規オープン（直近3〜4ヶ月以内）
2. 予約困難・隠れ家・食通が通う名店
3. Instagram・TikTok・X で急激にバズ中
4. ナゴレコ・Retty・食べログ百名店・地元メディアで掲載

各候補を web_search で検索し、2ソース以上で実在確認してから JSON を出力してください。`;

  const messages = [{ role: 'user', content: USER }];
  let finalText = '';

  // ── アジェンティックループ（web_search のため最大 30 ターン）──
  for (let round = 0; round < 30; round++) {
    console.log(`  API round ${round + 1}…`);

    let response;
    try {
      response = await client.beta.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 8000,
        system:     SYSTEM,
        tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
        betas:      ['web-search-2025-03-05'],
      });
    } catch (err) {
      // web_search beta 未対応の場合はベタなしで再試行
      if (err.status === 400 && round === 0) {
        console.warn('  web_search beta 未対応 → ツールなしで再試行');
        response = await client.messages.create({
          model:      'claude-opus-4-5',
          max_tokens: 8000,
          system:     SYSTEM,
          messages,
        });
      } else {
        throw err;
      }
    }

    // テキストブロックを収集
    const texts = (response.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    if (texts) finalText = texts;

    if (response.stop_reason === 'end_turn') break;

    // tool_use の場合はアシスタントメッセージを追加してループ継続
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      // ツール結果（web_search はサーバーサイド実行 → 空で返す）
      const toolUses = (response.content || []).filter(b => b.type === 'tool_use');
      if (toolUses.length > 0) {
        messages.push({
          role: 'user',
          content: toolUses.map(b => ({
            type:        'tool_result',
            tool_use_id: b.id,
            content:     '',
          })),
        });
      }
    } else {
      // max_tokens 等の予期しない stop_reason
      break;
    }
  }

  return finalText;
}

// ── エントリポイント ────────────────────────────────────
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY が設定されていません');
    process.exit(1);
  }

  const today = todayJST();
  console.log(`\n[${today}] 名古屋話題店 自動発掘スクリプト${DRY_RUN ? ' (DRY RUN)' : ''}`);

  // 既存店読み込み
  const raw          = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const existingNames = (raw.stores || []).map(s => s['店名']);
  console.log(`  既存店舗数: ${existingNames.length}件`);

  // Claude に探索させる
  const client = new Anthropic({ apiKey });
  let text;
  try {
    text = await discoverStores(client, existingNames, today);
  } catch (err) {
    console.error('❌ API エラー:', err.message);
    process.exit(1);
  }

  if (!text) {
    console.log('  Claude から有効な応答がありませんでした（追加なし）');
    process.exit(0);
  }

  // JSON パース
  const candidates = extractJSON(text);
  console.log(`  Claude 候補: ${candidates.length}件`);

  // 検証 & フィルタリング
  const added    = [];
  const rejected = [];

  for (const s of candidates) {
    if (!s || typeof s !== 'object') continue;

    // デフォルト補完
    s['キュレーター'] = s['キュレーター'] || '編集部';
    s['追加日']       = s['追加日']       || today;

    // 重複チェック
    if (existingNames.includes(s['店名'])) {
      rejected.push(`${s['店名']}: 既存店`);
      continue;
    }

    // バリデーション
    const err = validateStore(s);
    if (err) {
      rejected.push(`${s['店名'] || '(無名)'}: ${err}`);
      continue;
    }

    added.push(s);
    existingNames.push(s['店名']); // 同一実行内の重複防止
  }

  if (rejected.length > 0) {
    console.log(`  除外 (${rejected.length}件):`);
    rejected.forEach(r => console.log(`    ✗ ${r}`));
  }

  if (added.length === 0) {
    console.log('  追加対象なし（0件）');
    process.exit(0);
  }

  // ファイル更新
  if (!DRY_RUN) {
    raw.stores.push(...added);
    fs.writeFileSync(FILE, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }

  console.log(`\n  ✅ ${added.length}件${DRY_RUN ? '（DRY RUN・未書き込み）' : '追加'}:`);
  added.forEach(s => console.log(`    + ${s['店名']} (${s['エリア']})`));
  console.log('');
}

main().catch(err => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
