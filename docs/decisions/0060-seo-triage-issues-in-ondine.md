# 0060 SEOトリアージの課題は Ondine で管理する

- 日付: 2026-11-09
- 決めた人: オーナー（「Ondine に移す」と返答・Ondine #1671）

## 背景
全体の決まり（課題は Ondine で管理）と、SEOトリアージ（`/seo-triage`・`/seo-triage-weekly`）の指示（Linear へ同期）が食い違っていた。

## 決定
採用した SEO 施策は `agent-backlog.md` に ready で起票したうえで、Linear ではなく Ondine（`ondine-agent.mjs create`）に起票する。Linear への新規起票はしない。

## 影響
- 変更: `.claude/commands/seo-triage.md`・`seo-triage-weekly.md` の Step 7、`CLAUDE.md` の SEO ループ節。
- 既存の Linear 課題は読むだけの写しとして Ondine に取り込み済みのため移し替えない。
- `scripts/sync_backlog_to_linear.js` は残すが、SEO ループからは呼ばない。
