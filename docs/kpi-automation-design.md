# 月次 KPI 自動化 設計メモ（monthly-kpi.yml）

> **位置づけ**: ISSUE-043 の acceptance「将来の自動化に向け `.github/workflows/monthly-kpi.yml`
> の設計メモを作成（実装は別タスク）」の成果物。本ドキュメントは**設計のみ**。実装は別 ISSUE で行う。
>
> **背景**: ORG-002 で「毎月1日に Strategist が `STR-MONTHLY-YYYY-MM` を起票」する運用を確立したが、
> 値の収集が手動だと月またぎで抜ける。GA4 は既に自動取得できるため、月次集計を CI に載せて
> **「7項目のうち取れるものは自動・取れないものは手動枠を残す」**ハイブリッド設計とする。

---

## 現状の取得可否（2026-05-22 時点）

| # | 項目 | ソース | 自動取得 | 現状 |
|---|---|---|---|---|
| 1 | 月間 UU（activeUsers） | GA4 | ✅ 可 | `scripts/fetch_ga4_views.js`（ISSUE-053 拡張）→ `data/site_metrics.json` |
| 2 | 月間セッション | GA4 | ✅ 可 | 同上（`totals.sessions`） |
| 3 | CTA クリック数（outbound_click） | GA4 | ⚠️ 要拡張 | 現状は `modal_open` のみ集計。`outbound_click` イベントの runReport を追加する |
| 4 | 指名検索数（"NAGOYA BITES" 等） | GSC | ❌ 不可 | SA を GSC が受け付けず permission エラー（ISSUE-054）→ 手動継続 |
| 5 | 上位10KW の順位 | GSC | ❌ 不可 | 同上 → 手動継続（GSC 画面スクショ） |
| 6 | 掲載店舗数 | `index.html` | ✅ 可 | LOCAL_STORES 件数を grep |
| 7 | 特集/ジャーナル数 | `features/` `journal/` | ✅ 可 | ファイル数カウント |

→ **7項目中 5項目（1,2,3,6,7）は自動化可能。4・5（GSC 系）は当面手動。**

---

## 設計案: `.github/workflows/monthly-kpi.yml`

### トリガー
```yaml
on:
  schedule:
    - cron: '0 20 1 * *'   # 毎月 1 日 20:00 UTC（JST 翌 2 日 5:00）。build.yml の日次と衝突しない時刻
  workflow_dispatch:
```

### ジョブ構成（擬似）
```
1. checkout（fetch-depth: 0・コミット権限付き）
2. setup-node 20 + npm install（GA4 SDK）
3. node scripts/fetch_ga4_views.js          # site_metrics.json を最新化（既存）
   └ 既存スクリプトに outbound_click 集計を追加（#3 のため）
4. node scripts/gen_monthly_kpi.js          # ★新規実装（別タスク）
   ├ data/site_metrics.json から UU/セッション/PV/流入元/AI流入を読む
   ├ index.html から LOCAL_STORES 件数、features/ journal/ から本数をカウント
   ├ data/gsc_metrics.json があれば GSC を読む（無ければ "(手動取得待ち)" を出力）
   └ agent-backlog.md に `### [STR-MONTHLY-YYYY-MM] ...` ブロックを自動追記
5. commit & push（[skip actions] 付きで再帰起動を防ぐ）
```

### 安全策
- GSC が permission エラーの間は #4・#5 を `(取得不可: GSC SA 制約・手動記録)` と明記して埋める
  （Strategist が GSC 画面から手動補完する運用は維持）
- `gen_monthly_kpi.js` は **agent-backlog.md への追記のみ**（既存ブロックは書き換えない）。
  重複起票防止のため、同月の `STR-MONTHLY-YYYY-MM` が既にあればスキップ
- GA4 Secrets（`GA4_PROPERTY_ID` / `GA4_SERVICE_ACCOUNT_KEY`）は設定済み・追加不要

---

## 実装タスク化の単位（別 ISSUE 候補）

1. **`fetch_ga4_views.js` に `outbound_click` 集計を追加**（#3 を自動化）
2. **`scripts/gen_monthly_kpi.js` 新規作成**（site_metrics + ファイルカウント → backlog 追記）
3. **`.github/workflows/monthly-kpi.yml` 新規作成**（上記スケジュール起動）
4. （将来）GSC 自動連携 — OWNER アカウントの OAuth refresh token 経由を検討（ISSUE-054 の積み残し）

---

## GSC 自動化の積み残し（ISSUE-054 連携）

- GSC は UI 上でサービスアカウント `nagoya-bites-ga4@optimal-transit-447015-e9.iam.gserviceaccount.com` を
  「メールアドレスが見つかりません」で受け付けず、ユーザー追加できない（API は有効化済み）。
- 当面は GSC 画面のスクショから手動記録（`docs/kpi-weekly.md` Tier3）。
- 将来やるなら **OWNER アカウントの OAuth refresh token** を Secret 化し、SA ではなく OAuth で
  Search Analytics API を叩く方式に切り替える。実装コストとセキュリティ（refresh token 管理）を勘案して別途判断。

---

## 関連

- ISSUE-043（本メモの起票元・STR-MONTHLY ベースライン確定）
- ISSUE-053（`fetch_ga4_views.js` のサイト全体メトリクス拡張・GA4 自動取得の基盤）
- ISSUE-054（GSC 連携の制約と手動記録運用）
- ORG-002（月次 KPI スナップショット運用・`agents/strategist.md`）
- `docs/kpi-weekly.md`（週次の実数記録先）
