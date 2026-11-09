# 0060 SEOトリアージの採用課題は Ondine へ起票する（Linear 同期をやめる）

- 日付: 2026-11-09
- 決めた人: オーナー（「Ondine に移す」と返事・Ondine 課題 #1676）

## 背景
全体の決まりは「課題は Ondine で管理」だが、`/seo-triage`・`/seo-triage-weekly` は Step 7 で Linear へ同期する指示のままで食い違っていた。

## 決定
- SEO トリアージ（日次・週次）で採用した施策は `ondine-agent.mjs create`（repo=nagoya-bites）で起票する。
- このループのために `sync_backlog_to_linear.js`・`/sync-backlog` を実行しない。
- `agent-backlog.md` への `[SEO-NNN]` 起票（ID 採番・重複検知）は従来どおり残す。

## 影響・やらないこと
- 既存の Linear の SEO 課題は読むだけの写しとして残す。移し替えはしない。
- 消費者フィードバック（FB）・GSC ループの同期は対象外（別の決定）。
