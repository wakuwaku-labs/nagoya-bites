#!/usr/bin/env node
/**
 * scripts/daily_store_discovery.js
 *
 * 毎日 GitHub Actions から自動実行される「名古屋 厳選店舗 自動発掘スクリプト」。
 * Anthropic Messages API (claude-3-5-sonnet) + web_search ツールで候補を探し、
 * 6つの選定柱 × 品質ゲート × 多様性ルールを通過した 5〜6件を
 * data/manual_stores.json に追記する。
 *
 * ── 費用目安 ──
 *   claude-3-5-sonnet 使用: 約 ¥30〜100/回 → 月 ¥900〜3,000 程度
 *   (claude-opus-4-5 の約 1/8 のコスト)
 *
 * ── 選定基準（6つの柱） ──
 *   PILLAR_A: 新店注目    — 2025年末〜2026年オープン、業界が注目する新規開業
 *   PILLAR_B: 実力の名店  — 食べログ百名店/ミシュラン/長年の実績、本物の実力店
 *   PILLAR_C: 予約困難    — 1ヶ月以上待ち、食通が認める隠れ家・予約困難店
 *   PILLAR_D: SNS話題     — Instagram/TikTok/X でバズ中、若い世代が発見
 *   PILLAR_E: メディア推薦 — ナゴレコ/Retty/地元TV・誌で特集された注目店
 *   PILLAR_F: 地元の名店  — 地元客に長年愛される老舗・街の名物店
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
 * 必須環境変数: ANTHROPIC_API_KEY
 * 使い方:
 *   node scripts/daily_store_discovery.js          # 実行
 *   node scripts/daily_store_discovery.js --dry-run # 書き込みなしで確認
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fs        = require('fs');
const path      = require('path');

const FILE     = path.join(__dirname, '..', 'data', 'manual_stores.json');
const DRY_RUN  = process.argv.includes('--dry-run');
const TARGET_N = 6;  // 1回あたり追加目標（6つの柱に対応）
const MODEL    = 'claude-3-5-sonnet-20241022';  // コスト最適化（opus の約 1/8）

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
  // 必須フィールドチェック
  const required = ['店名', 'エリア', '都道府県', 'ジャンル', 'アクセス', '追加日', 'おすすめポイント', '選定柱'];
  for (const f of required) {
    if (!s[f]) return `必須フィールド「${f}」が空`;
  }

  // ゲートB: 名古屋実在性
  if (!/(名古屋市|愛知県)/.test((s['アクセス'] || '') + (s['エリア'] || ''))) {
    return '名古屋市/愛知県が住所に含まれない';
  }

  // ゲートA: 実在確認ソース数
  const sources = Array.isArray(s['出典URL']) ? s['出典URL'] : [];
  if (sources.length < 2) {
    return `出典URL ${sources.length}件（2件以上必要）`;
  }

  // おすすめポイント品質
  const point = (s['おすすめポイント'] || '').length;
  if (point < 120) return `おすすめポイント ${point}字（120字以上必要）`;
  if (point > 200) return `おすすめポイント ${point}字（200字以下にする）`;

  // チェーン店フィルタ（大手チェーンは除外）
  const chainPattern = /マクドナルド|ケンタッキー|スターバックス|ドトール|コメダ|サイゼリヤ|ガスト|すき家|吉野家|松屋|CoCo壱|丸亀製麺|くら寿司|スシロー|はま寿司/;
  if (chainPattern.test(s['店名'] || '')) {
    return '大手チェーン店は選定対象外';
  }

  // 食べログURLの形式チェック（設定されている場合のみ）
  const tabel = s['食べログURL'] || '';
  if (tabel && !/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{8}/i.test(tabel)) {
    s['食べログURL'] = ''; // 不正URLはクリア（エラーにしない）
  }

  // 選定柱の有効チェック
  const validPillars = ['PILLAR_A', 'PILLAR_B', 'PILLAR_C', 'PILLAR_D', 'PILLAR_E', 'PILLAR_F'];
  if (!validPillars.includes(s['選定柱'])) {
    return `選定柱「${s['選定柱']}」が無効（PILLAR_A〜F のいずれかを指定）`;
  }

  return null; // OK
}

/** 1バッチ内の多様性チェック */
function checkDiversity(store, accepted) {
  const genre = (store['ジャンル'] || '').split(/[・\/]/)[0]; // 大ジャンル
  const area  = (store['エリア'] || '').replace(/名古屋市/, '').replace(/区.*/, '区');

  const genreCount = accepted.filter(s =>
    (s['ジャンル'] || '').split(/[・\/]/)[0] === genre
  ).length;
  if (genreCount >= 2) return `ジャンル「${genre}」が既に2件（多様性ルール）`;

  const areaCount = accepted.filter(s =>
    (s['エリア'] || '').replace(/名古屋市/, '').replace(/区.*/, '区') === area
  ).length;
  if (areaCount >= 2) return `エリア「${area}」が既に2件（多様性ルール）`;

  return null; // OK
}

// ── プロンプト定義 ──────────────────────────────────────
function buildPrompts(existingNames, today) {
  const listSnippet = existingNames.length <= 80
    ? existingNames.join('、')
    : existingNames.slice(0, 80).join('、') + `…（他${existingNames.length - 80}件）`;

  const SYSTEM = `あなたは名古屋の飲食業界に20年精通したフードエディターです。
単なる「話題店」だけでなく、本物の実力と価値を持つ店を厳選してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【選定の6つの柱】各柱から少なくとも1件ずつ選ぶこと
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PILLAR_A【新店注目】
  2025年末〜2026年オープン。業界が注目する新規開業。
  有名シェフの独立開業、期待の若手、注目コンセプトの新業態など。
  根拠: オープン記事・公式SNS初投稿・業界メディアの初報

PILLAR_B【実力の名店】
  食べログ百名店・ミシュラン掲載・長年の高評価継続店。
  食べログ評価3.7以上、またはミシュラン掲載、または20年以上の実績。
  一過性の話題ではなく「本物の実力」で選ぶ。
  根拠: 食べログ百名店掲載URL、ミシュランガイド記載、長年の実績記事

PILLAR_C【予約困難・隠れ家】
  1ヶ月以上先まで予約が埋まっている、または完全紹介制・常連のみ。
  食通・飲食業界人の間で知られる本物の予約困難店。
  根拠: HotPepper/食べログの満席表示言及記事、業界人の口コミ

PILLAR_D【SNS・若者に人気】
  Instagram/TikTok/Xで直近3ヶ月以内にバズった店。
  料理のビジュアルが秀逸で若い世代が発信している。
  根拠: 公式Instagramフォロワー数、バズった投稿のURL

PILLAR_E【メディア・グルメ誌推薦】
  ナゴレコ・Retty・地元テレビ・東海地方のグルメ誌で特集された店。
  単なるリスト掲載ではなく、特集・メイン取材として取り上げられた店。
  根拠: ナゴレコ記事URL、Rettyベスト掲載、テレビ特集の言及

PILLAR_F【地元に愛される名店】
  地元客リピーターに長年支持される老舗・街の名物店。
  観光客向けでなく、名古屋の人間が「あそこは本物だ」と言う店。
  根拠: 食べログ口コミの地元率・リピート言及、長年の営業実績

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【品質ゲート（全柱共通・全て満たすこと）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ゲートA: 実在確認（以下から2ソース以上）
  - 食べログ（tabelog.com/aichi/）の個別店舗ページ
  - HotPepper 公式（hotpepper.jp/str…）の店舗ページ
  - 公式Instagram（最終投稿が3ヶ月以内＝現在営業中の証拠）
  - 公式Webサイト（名古屋市内住所あり）
  - Retty公式の店舗ページ
  - ナゴレコ/地元メディアの記事URL（店名と住所が明記されているもの）

✅ ゲートB: 名古屋実在性
  - 住所に「名古屋市○○区」が明記されていること

✅ ゲートC: 品質基準（いずれか満たす）
  - 食べログ評価 3.5 以上（確認できる場合）
  - 食べログ百名店またはミシュラン掲載
  - Google評価 4.0 以上
  - 業界人・食通が推薦する明確な根拠がある

✅ ゲートD: 現在営業中
  - 公式SNSまたはWebで直近3ヶ月以内の投稿・更新があること
  - 食べログやGoogleマップで「閉業」でないこと

❌ 除外基準
  - 大手チェーン店（全国展開している店）
  - 閉業・移転の可能性がある店
  - 1ソースしか確認できない店
  - おすすめポイントを120字以上書けない店（情報不足＝掲載価値なし）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【多様性ルール（1バッチ内）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 同一ジャンル: 最大2件（ラーメン2件OK、ラーメン3件NG）
  - 同一エリア（区）: 最大2件（栄区2件OK、栄区3件NG）
  - 価格帯: 〜¥3,000 / ¥3,000〜¥8,000 / ¥8,000〜 を各1件以上含む

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【おすすめポイントの書き方（重要）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - 120〜180字
  - 「なぜこの店が特別なのか」を業界人の目線で言語化する
  - 料理の具体的な特徴（食材・産地・調理法・こだわり）を入れる
  - どんなシーン・客層に最適かを明示する（例: 接待・デート・女子会）
  - 「美味しい」「おすすめ」などの抽象語を使わず、具体的事実で書く
  - ライバル店との差別化要素を必ず含める

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【追加禁止（既登録店）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${listSnippet}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力フォーマット（JSONのみ・説明文不要）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
食べログURLは個別店舗ページ（tabelog.com/aichi/A.../rstdtl/数字/）のみ。
不明な場合は空文字（検索URLは禁止）。

{
  "stores": [
    {
      "店名": "（正式店名・屋号）",
      "エリア": "名古屋市○○区",
      "都道府県": "愛知県",
      "ジャンル": "（例: 鮨・和食 / 創作フレンチ / スペシャルティコーヒー など具体的に）",
      "アクセス": "名古屋市○○区〇〇〇〇 ○○駅から徒歩○分",
      "キュレーター": "編集部",
      "追加日": "${today}",
      "おすすめポイント": "（120〜180字・業界人目線・具体的・シーン明記）",
      "選定柱": "PILLAR_A",
      "選定理由": "（なぜこの柱で選んだか・根拠を1〜2文で。選定ゲート通過の証拠も含める）",
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
      "出典URL": ["確認ソースURL1", "確認ソースURL2", "確認ソースURL3"],
      "トレンド情報源": ["食べログ百名店", "ナゴレコ"]
    }
  ]
}`;

  const USER = `名古屋の飲食店を厳選して${TARGET_N}件発掘してください。

【作業手順】
1. まず各PILLAR（A〜F）の候補を web_search で1〜2件ずつ探す
2. 各候補について 2ソース以上で実在・品質・営業中を確認する
3. 品質ゲートを全て通過した店のみを最終候補とする
4. 多様性ルール（ジャンル・エリア・価格帯）を確認する
5. 最終的に${TARGET_N}件をJSONで出力する

「話題性があるから」だけでなく「本物の実力・価値があるから」という基準で選んでください。
食べログ百名店・ミシュラン・長年の地元人気など、裏付けのある実力を重視してください。`;

  return { SYSTEM, USER };
}

// ── メイン探索ロジック ──────────────────────────────────
async function discoverStores(client, existingNames, today) {
  const { SYSTEM, USER } = buildPrompts(existingNames, today);
  const messages = [{ role: 'user', content: USER }];
  let finalText  = '';

  for (let round = 0; round < 30; round++) {
    console.log(`  API round ${round + 1}…`);

    let response;
    try {
      response = await client.beta.messages.create({
        model:      MODEL,
        max_tokens: 8000,
        system:     SYSTEM,
        tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
        betas:      ['web-search-2025-03-05'],
      });
    } catch (err) {
      if (err.status === 400 && round === 0) {
        console.warn('  web_search beta 未対応 → ツールなしで再試行');
        response = await client.messages.create({
          model:      MODEL,
          max_tokens: 8000,
          system:     SYSTEM,
          messages,
        });
      } else {
        throw err;
      }
    }

    const texts = (response.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    if (texts) finalText = texts;

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
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
  console.log(`\n[${today}] 名古屋 厳選店舗 自動発掘スクリプト (${MODEL})${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`  選定基準: 6柱 × 品質ゲート × 多様性ルール`);

  const raw           = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const existingNames = (raw.stores || []).map(s => s['店名']);
  console.log(`  既存店舗数: ${existingNames.length}件`);

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

  const candidates = extractJSON(text);
  console.log(`  Claude 候補: ${candidates.length}件`);

  const added    = [];
  const rejected = [];

  for (const s of candidates) {
    if (!s || typeof s !== 'object') continue;

    s['キュレーター'] = s['キュレーター'] || '編集部';
    s['追加日']       = s['追加日']       || today;

    // 重複チェック
    if (existingNames.includes(s['店名'])) {
      rejected.push(`${s['店名']}: 既存店`);
      continue;
    }

    // 品質バリデーション
    const valErr = validateStore(s);
    if (valErr) {
      rejected.push(`${s['店名'] || '(無名)'}: ${valErr}`);
      continue;
    }

    // 多様性チェック
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

  // 選定柱カバレッジのサマリー
  const pillars = added.map(s => s['選定柱']);
  const covered = [...new Set(pillars)];
  console.log(`\n  選定柱カバレッジ: ${covered.join(', ')} (${covered.length}/6)`);
  console.log('');
}

main().catch(err => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
