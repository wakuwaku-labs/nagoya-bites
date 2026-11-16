# 削減: 消す前の一覧（本人の確認用・Ondine #2050・2026-11-16）

何も消していません。承認された行だけ消します（git の履歴から戻せます）。

## 1. 使われていないスクリプト（31本・どのファイルからも名前で呼ばれていない）
調べ方: ルート直下と scripts/ の全 .js の名前を、docs・data・backlog 以外の全ファイルで検索し、自分以外から0件のもの（sw.js は除外）。

| ファイル | 最終変更 | 推奨 |
|---|---|---|
| _extract_stores.js | 2026-05-23 | 消す |
| cleanup_ig.js | 2026-04-21 | 消す |
| debug_bing.js | 2026-04-21 | 消す |
| debug_bing2.js | 2026-04-21 | 消す |
| debug_bing3.js | 2026-04-21 | 消す |
| debug_ddg2.js | 2026-04-21 | 消す |
| debug_google.js | 2026-04-21 | 消す |
| debug_ig.js | 2026-04-21 | 消す |
| debug_ig2.js | 2026-04-21 | 消す |
| debug_scrape.js | 2026-04-21 | 消す |
| debug_yahoo.js | 2026-04-21 | 消す |
| fetch_ig_photos.js | 2026-04-21 | 消す |
| fix_tags.js | 2026-04-21 | 消す |
| scripts/add_noopener.js | 2026-05-06 | 消す |
| scripts/apply_resolved_to_index.js | 2026-04-19 | 消す |
| scripts/apply_tabelog_to_index.js | 2026-04-22 | 消す |
| scripts/cleanup_fabricated_stores.js | 2026-05-23 | 消す |
| scripts/extract_hpid_from_sources.js | 2026-05-25 | 消す |
| scripts/fill_recommendations_json.js | 2026-05-23 | 消す |
| scripts/inject_ga.js | 2026-10-13 | 残す（10月以降の手動用の道具。消すかは本人） |
| scripts/normalize_instagram_field.js | 2026-05-25 | 消す |
| scripts/patch_image_attrs.js | 2026-05-06 | 消す |
| scripts/patch_manual_stores_addresses.js | 2026-05-25 | 消す |
| scripts/patch_og_alt.js | 2026-05-06 | 消す |
| scripts/patch_store_descriptions.js | 2026-05-23 | 消す |
| scripts/promote_manual_to_editorreason.js | 2026-05-24 | 消す |
| scripts/rebuild_feature_real_stores.js | 2026-05-23 | 消す |
| scripts/register_manual_stores.js | 2026-05-23 | 消す |
| scripts/replace_feature_hero_images.js | 2026-05-20 | 消す |
| scripts/replace_hero_svgs.js | 2026-05-28 | 消す |
| scripts/strip_ui_emojis.js | 2026-07-18 | 残す（10月以降の手動用の道具。消すかは本人） |
| scripts/sync_visible_faq_from_jsonld.js | 2026-10-13 | 残す（10月以降の手動用の道具。消すかは本人） |
| scripts/upgrade_ga_snippet.js | 2026-10-13 | 残す（10月以降の手動用の道具。消すかは本人） |

## 2. 止まっている自動実行2本
- .github/workflows/daily-journal.yml（最終実行 2026-05-20・schedule は停止済み・手動実行のみ）→ 消す
- .github/workflows/weekly-pipeline.yml（最終実行 2026-05-18・同上）→ 消す
- 注意: コメントや docs が名前に触れている（daily-trending5.yml・weekly-media.yml のコメント）。コメントだけなので動作に影響なし。

## 3. 開いたままの警報（GitHub Issue 6件。計画は4件と書いたが今は6件）
#401 ルーチンPR19件未合流 / #628 Linear 期限切れ21件 / #665 食べログ照合が止まっている / #694 GASレポートが旧コード / #704 写真の店名照合の誤一致 / #745 Linear 週次振り返り
→ それぞれ原因を調べて直すか、鳴らす条件を直します（消す操作ではないので一覧承認とは別に進められます）。

## 4. 消す前に本人に見せる物（今回は触れていない）
未合流の枝19本・同じ課題の提案PR7本（一覧は別途出します）。台帳の三重管理・Linear を読む始業案内・ビルド頻度・役割文書は、削除ではなく設定変更なので別に進めます。

---
## 実施結果（2026-11-16・本人が「推奨どおり消す」を選択）
- 消した: 1章の「消す」29本（`git rm`・残す4本は残した）＋2章の止まった自動実行2本。消す直前に docs・data・backlog 以外から名前が参照されていないか再確認し、0件（2章はコメントと agents/*.md の説明文のみで動作に影響なし）。履歴から戻せる。
- 3章（警報6件）: 6件とも原因が直っていると確かめられなかったので閉じていない。
  - #401 ルーチンPR未合流: PR は残ったまま（4章の「提案PR7本・枝19本」と同じ物。本人に見せてから）
  - #628・#745 Linear: Linear の未完了・期限切れは実在。見張り（linear-watchdog.yml）の扱いは別に決める。#745 は次の週次で自動で閉じる
  - #665 食べログ: 403 は続いている（手元での再照合が必要）
  - #694 GAS: 心拍が10-21で止まったまま（定期タスクの停止が原因）
  - #704 写真の店名照合: `namesMatch('TAKA 名古屋','…CHITAKA')` が今も true（未修正）
- 5章の小物: `scripts/session_briefing.js` が Linear を読まないようにした（`data/session_briefing_policy.json` の `linearEnabled: false`。戻すときは true）。これで始業の案内から古い Linear 期限切れが消える。
- 未着手: Unsplash 処理・SNS 原稿検査（コード変更が大きく30分を超える）／課題台帳の整理・役割文書・ビルド頻度（設定変更で別に進める）／4章（本人に見せる物）。
- npm test: 1件だけ失敗「写しは SNS分析ツールの正本と同じ」（この端末の正本との差。今回の変更と無関係・CI では正本が無くスキップされる）。ほか全て通過。
