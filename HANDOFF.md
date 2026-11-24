status: done

# 11/24 の X を長いポストで出し直す（Ondine #2668）

## 目的
11/23 に決めた X の長いポスト（ADR 0082）が 11/24 の投稿に反映されなかったので、今日分を長いポストで出し直し、明日以降も反映されるようにする。

## 完了条件
11/24 の長いポストが X に出て台帳に long_post.ok=true、定型の短い投稿は削除済み、翌日から時間切れで定型に戻らない。

## できていること
- 原因: 11/23 夜に返信5件を見出しつきで書く形にしてから、文面づくりの Claude の応答が約3分（実測 176〜196秒）になり、150秒の打ち切りで定型に戻った
- 今日分: data/x_post_drafts/2026-11-24-long.json（#815）→ 長いポスト https://x.com/i/web/status/2125143037743333428（1435字・5店）→ 朝の短い投稿 2125058108787429775 を削除
- 恒久策: data/x_post_policy.json の draft.timeoutSec 150→300、run_journal_local.sh の打ち切り 360→660 秒

## 次にやること
- 11/25 朝の台帳で text_mode=draft・long_post.ok=true を確かめる（予約済み）

## 試したが駄目だったこと
- 54377cf222（時間切れで1回やり直す）だけでは、毎回3分かかるので2回とも切れる

## 守るルール・判断メモ
- 出し直しは 11/23 と同じ手順（--extra-long → x-delete.yml）

## 関連ファイル
- docs/decisions/0082-x-long-post.md・scripts/write_x_draft.js・data/x_post_policy.json・scripts/run_journal_local.sh
