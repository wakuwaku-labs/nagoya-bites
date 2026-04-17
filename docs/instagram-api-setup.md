# Instagram Graph API 申請・統合手順

> **ステータス**: 📋 申請待ち（Phase B — 承認後に実装起動）
> **目的**: Instagram Hashtag Search API を使って、名古屋の話題店をハッシュタグ投稿量から自動検出する

---

## 背景

2026年4月時点で、Instagram Graph API の **Hashtag Search** は Facebook Developers App の Business Review 承認制。

承認されると下記が可能になる:
- `GET /ig_hashtag_search?q={hashtag}` — ハッシュタグID取得
- `GET /{hashtag-id}/top_media` — 上位投稿（人気順）
- `GET /{hashtag-id}/recent_media` — 最近の投稿

制限:
- **週30ハッシュタグまで**（1週間でリセット）
- Instagram Business Account 必須
- Facebook Page との連携必須

Phase A（現在）: 各店モーダルに「店名で Instagram ハッシュタグ検索」リンクを設置済み（API不要・`build.js` で自動生成）。

Phase B（本ドキュメント）: 承認後に Graph API から投稿数を自動取得し、`data/trending_stores.json` の `話題スコア` に反映する。

---

## 申請手順

### Step 1. Facebook Developers App 作成

1. https://developers.facebook.com/apps/ にアクセス（wakuwaku-labs 代表アカウントでログイン）
2. 「**Create App**」 → Use case: **Other** → App type: **Business**
3. App 名: `NAGOYA BITES Integration`
4. Contact email: `wakuwakulabsinc@gmail.com`（想定）
5. Business Portfolio: wakuwaku-labs の Business Portfolio を選択（なければ「Create one」）

### Step 2. Instagram Business Account の準備

1. wakuwaku-labs の Instagram 公式アカウントを「**プロアカウント**」→「**ビジネスアカウント**」に切り替え
   - Instagram モバイルアプリ → 設定 → アカウント → プロアカウントに切り替える
2. Facebook Page を作成（なければ）し、Instagram アカウントと連携
   - 連携手順: https://www.facebook.com/business/help/connect-instagram-to-page

### Step 3. App に Instagram プロダクトを追加

1. App Dashboard → 「**Add Product**」 → **Instagram Graph API** を追加
2. 「**Instagram Basic Display**」ではなく **Instagram Graph API**（Business向け）を選ぶ
3. 「Get Started」

### Step 4. 権限（Permissions）の申請

**App Review** → 以下の権限を申請:

| 権限 | 用途 |
|---|---|
| `instagram_basic` | 基本情報取得 |
| `pages_show_list` | 連携Page一覧 |
| `pages_read_engagement` | Page投稿のエンゲージメント |
| `instagram_manage_insights` | Hashtag Searchアクセス |

**Business Verification** が必要になる場合あり:
- 法人登記情報（履歴事項全部証明書 等）
- 事業ウェブサイトURL: `https://wakuwaku-labs.github.io/nagoya-bites/`
- 事業メールアドレス

### Step 5. ユースケース記述（App Review Submission）

審査員が読むので **明確に、名古屋グルメサイトでの使用目的** を書く。テンプレ:

```
Use Case Description:
---
NAGOYA BITES (https://wakuwaku-labs.github.io/nagoya-bites/) は
名古屋市内の飲食店4500件以上を掲載する発見サイトです。

We will use Instagram Hashtag Search API to:
1. Identify which restaurants are trending on Instagram by searching
   hashtags like #名古屋グルメ, #名駅ランチ, #栄カフェ
2. Count recent posts (last 7 days) for each hashtag to measure buzz
3. Rank restaurants by Instagram activity in our "今週の話題店" section
4. We will NOT store Instagram content, user data, or copyrighted media
5. We only aggregate numeric post counts and store them in our database

All data fetched will be public content already visible to anyone
with an Instagram account. We will comply with Instagram's Platform
Terms and Developer Policies.
---

Screencast Demo:
- Show: 1) Sample hashtag search request, 2) How the numeric count
  feeds into our "trending" ranking, 3) Rate-limit awareness (<=30/week)

Data Usage:
- Only post COUNT is stored, not content or user info
- Stored in our public repository's data/trending_stores.json
- Refreshed weekly, purged after 90 days (expires via 有効期限 field)
```

### Step 6. 承認後: アクセストークン取得

1. App Dashboard → Instagram Graph API → Generate Token
2. Facebook Page から **Long-lived Page Access Token** を取得（60日有効）
3. GitHub Secrets に追加:
   - Repository Settings → Secrets → Actions → `New repository secret`
   - Name: `INSTAGRAM_ACCESS_TOKEN`
   - Value: 取得したトークン

---

## 承認後の実装雛形

承認されたら以下のスクリプトを `scripts/fetch_instagram_hashtag.js` として新規作成する。

```javascript
'use strict';
/**
 * scripts/fetch_instagram_hashtag.js
 *
 * Instagram Graph API Hashtag Search で名古屋系ハッシュタグの投稿数を取得し、
 * data/trending_stores.json に反映する。
 *
 * 前提:
 *   - INSTAGRAM_ACCESS_TOKEN 環境変数にアクセストークン
 *   - INSTAGRAM_BUSINESS_ID 環境変数にビジネスID
 *
 * 使い方:
 *   export INSTAGRAM_ACCESS_TOKEN=xxxxx
 *   export INSTAGRAM_BUSINESS_ID=123456789
 *   node scripts/fetch_instagram_hashtag.js
 *
 * 週次制限: 30ハッシュタグ/週
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const BIZ_ID = process.env.INSTAGRAM_BUSINESS_ID || '';
const GRAPH = 'https://graph.facebook.com/v22.0';
const TRENDING_PATH = path.join(__dirname, '..', 'data', 'trending_stores.json');

// 週30件以内に収まる名古屋グルメ関連ハッシュタグ
const NAGOYA_HASHTAGS = [
  '名古屋グルメ', '名駅ランチ', '栄カフェ', '名古屋ディナー',
  '名古屋焼肉', '名古屋ラーメン', '名古屋居酒屋', '大須グルメ',
  '金山グルメ', '覚王山カフェ', '名古屋スイーツ', '名古屋イタリアン',
  '名古屋寿司', '名古屋和食', '名古屋中華', '名古屋フレンチ',
  '名古屋カレー', '名古屋パン', 'ナゴヤめし', '名古屋新店'
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function searchHashtag(tag) {
  const url = `${GRAPH}/ig_hashtag_search?user_id=${BIZ_ID}&q=${encodeURIComponent(tag)}&access_token=${TOKEN}`;
  const data = await fetchJson(url);
  return data.data && data.data[0] && data.data[0].id;
}

async function getTopMedia(hashtagId) {
  const url = `${GRAPH}/${hashtagId}/top_media?user_id=${BIZ_ID}&fields=id,caption,media_type,permalink,timestamp&access_token=${TOKEN}`;
  const data = await fetchJson(url);
  return data.data || [];
}

async function main() {
  if (!TOKEN || !BIZ_ID) {
    console.error('INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ID 未設定');
    process.exit(1);
  }

  const trending = JSON.parse(fs.readFileSync(TRENDING_PATH, 'utf8'));
  const buzzStats = {};  // 店名ごとの言及回数

  for (const tag of NAGOYA_HASHTAGS) {
    const id = await searchHashtag(tag);
    if (!id) continue;
    const media = await getTopMedia(id);
    console.log(`#${tag}: ${media.length}件取得`);

    // caption に店名が含まれる投稿を数える（fuzzy match）
    for (const m of media) {
      const caption = (m.caption || '');
      // ここで LOCAL_STORES の店名とマッチング → buzzStats 更新
      // （実装時に trending_stores.json の stores から店名リスト読込）
    }
  }

  // buzzStats を trending_stores.json の 話題スコア に反映
  // ...
  fs.writeFileSync(TRENDING_PATH, JSON.stringify(trending, null, 2), 'utf8');
  console.log('Instagram 話題度を反映しました');
}

main().catch(e => { console.error(e.message); process.exit(1); });
```

### GitHub Actions への組み込み

承認後、`.github/workflows/weekly-pipeline.yml` に以下を追加:

```yaml
- name: Step 0.2 — Instagram ハッシュタグ話題度収集（承認済み）
  run: node scripts/fetch_instagram_hashtag.js || true
  env:
    INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
    INSTAGRAM_BUSINESS_ID: ${{ secrets.INSTAGRAM_BUSINESS_ID }}
  continue-on-error: true
```

---

## 却下された場合の代替戦略

申請が却下された場合、以下の軽量な代替を検討する:

1. **OGP のみ参照**: 各店の公式 Instagram URL（Google Sheets に手動登録）から `og:title` / `og:description` メタデータのみ取得し、フォロワー数や投稿数の手掛かりとする。API 不要。
2. **インフルエンサー連携**: 名古屋グルメ系インフルエンサー（公開アカウント）の最近の投稿を人間がレビュー → 手動で `data/trending_stores.json` に追加。
3. **Phase A のまま**: ユーザーがハッシュタグ検索リンクをクリックして自分で話題度を確認するのみ（現状）。

---

## 参考リンク

- [Instagram Graph API Overview](https://developers.facebook.com/docs/instagram-platform/overview/)
- [IG Hashtag Search Reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search/)
- [App Review Submission Guide](https://developers.facebook.com/docs/app-review/)
- [Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)
