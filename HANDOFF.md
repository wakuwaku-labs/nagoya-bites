status: in_progress

# X 自動投稿の中身を「共有されたくなる」ものにする（2026-10-16〜）

（前のメモ「店のデータの正しさ・検索流入・送客の計画」は status: done。内容は git 履歴 3595c093b1 の HANDOFF.md。X 自動投稿の立ち上げの経緯は 2038657fa1）

## 目的
- X の自動投稿が「記事の題名＋リンク」だけで、中身がなく共有されない（オーナー 2026-10-16「ジャーナルが発信されていただけで全く中身のある、みたいとおもわれる、共有されたくなるような発信ではなかった」）。投稿そのものに読者が得をする事実を載せる

## 完了条件
- 投稿の文面が、記事の本文にある具体的な事実（意外な数字・使える知識）を投稿の中で伝える形になっている
- 既存の検査（数字が本文にあるか・言い方の検査・文字数・UTM・重複）を通る。無人の CI で止まらない（素材が無い日は今の定型に戻る）
- 直近の記事で作った例をオーナーが見て OK を出し、本番の投稿が新しい形で1件出たことを確かめた

## できていること
- 2026-10-15: 本番（mode=live・PR #599）。1件目が投稿された（data/x_post_log.json・tweet 2110523953940685146）
- 2026-10-16: 改善案の調査が済んだ。要点:
  - 中身がない理由: 題名（検索向け）を流すだけ・リンクカードと同じ文が2回・1行目が自分たちの札・130/280字しか使っていない・「得する事実が入っているか」を誰も見ていない
  - 素材は記事のリード文（art-lead）・本文・「知っておきたいポイント」（insider-box）。FAQ と JSON-LD には無い
  - 型は3つ: 型1「損しない数字」・型2「意外な仕組み」・型3「行く前の3つ」。10/13〜10/15 の3本で9本の例を作った（例は下の「投稿例」）
  - 作り方は B を採る: ジャーナル生成の Mac 側（scripts/run_journal_local.sh の OGP 整理 :799 の後・コミット :801 の前に「5i」）で2回目の claude --print に docs/x-post-prompt.md（新規）と記事を渡し、data/x_post_drafts/<date>.json（{slug,type,body,evidence[記事の原文の引用]}）を書かせて同じコミットに入れる（別に push すると先に定型が出る）。CI は「本文の数字がすべて evidence にあり、evidence が記事の原文そのまま」などを検査して使い、落ちたら定型（できれば「ポイントの1項目目＋URL」）に戻す。A（機械で抜く）は代わりの手、C（CI から Claude API）は鍵・課金・二重投稿の防ぎ方が崩れるので却下
  - 注意: 「3つ」の「3」が今の数字の照合で落ちることがある → 数を表す語を照合から外すか使わない
- 2026-10-16: 9本の例を weightedLength・数字の照合・言い方の検査にかけた → 全部通過（252〜274/280）。Mac 側の Claude は `claude --print --safe-mode --tools "" --no-session-persistence` で launchd と同じ最小の環境（HOME・USER・LOGNAME・SHELL・TMPDIR・PATH）なら3秒で JSON を返す（USER が無いと OAuth の読み込みに失敗する）。直近30本すべてに insider-box（3〜4項目・各60〜228）がある
- 方針（仮決め・最後にオーナーへ確認）: 型は記事ごとに Claude が選ぶ。CI で使うかは policy の draft.useInPost で切り替え

## 次にやること
1. オーナーに型を選んでもらう（選択肢ボタン・推奨は「記事ごとに合う型を選ぶ」）
2. 実装（触るファイル: scripts/lib/x_post.js に loadDraft・checkEvidence・buildDraftPost／post_journal_to_x.js:234 で「保存した文面→定型」の順・textMode を残す／data/x_post_policy.json に draft の設定・header を空に・utm_content=<型>／新規 docs/x-post-prompt.md・scripts/check_x_draft.js／run_journal_local.sh の 5i とコミット一覧 :813-818／ADR と CLAUDE.md の表）。テストは tests/x_post.test.js（正しい文面は使う・数字が evidence に無い・evidence が記事に無い・error 語・280字超・slug 違い・ファイル無し → 定型）
3. 試運転（dry-run）で例を確かめてから本番に入れる。字数は weightedLength で確かめる。2回目の claude --print の時間と利用上限への影響を測る

## 投稿例（10/15 QQ・型ごと。本文の下に URL とハッシュタグ2個が付く）
- 型1: 池下の新店QQは、棚のワインを奥の席で開けられる。／抜栓料は「20%・最低2,000円」。／3,000円のボトル→5,000円／6,000円→8,000円／10,000円→12,000円／1万円までは一律2,000円が乗るので、安い1本ほど割高。飲み残しは持ち帰れる。
- 型2: 池下「QQ」は、食材店の棚がそのままワインリスト。／約100本から1本選んで奥の席で開け、客席で開かなかった瓶は店頭で売れる。同じ在庫を店頭と客席の両方で売る設計だ。／奥のレストランの名前Quinteは、イタリア語で「舞台袖」。
- 型3: 池下「QQ」に行く前に知っておく3つ／・ランチは12〜14時の2時間だけ／・ディナーは月・木が休み（祝日は営業）／・棚のワインは抜栓料20%（最低2,000円）で客席へ。飲み残しは持ち帰り可／コースはランチ4,800円・ディナー7,500円（税サ別）

## 試したが駄目だったこと
- 定型「【今日の名古屋ジャーナル】＋題名＋リンク＋ハッシュタグ」: 中身がなく共有されない（上記）

## 守るルール・判断メモ
- 数字・事実は記事の本文にあるものだけ（捏造しない・既存の数字の照合を通す）。人が全店を選んだと読める言い方をしない（data/selection_wording_policy.json）
- 写真は X にアップロードしない（HotPepper 規約）。無人の CI で人の承認を待たない
- 本番の投稿は続けている（1件 0.20 ドル・無料クレジット 20 ドル）。文面の型を変えるのはオーナーの OK の後
- .claude/commands/*.md は編集できない。ジャーナル生成の手順を変えるなら scripts 側で

## 関連ファイル
- scripts/post_journal_to_x.js / scripts/lib/x_post.js / data/x_post_policy.json / .github/workflows/x-post.yml
- data/x_post_log.json（台帳）/ docs/x-auto-posting-plan-2026-10.md / docs/decisions/0027-x-auto-posting.md
- scripts/generate_daily_draft.js / scripts/run_journal_local.sh / data/journal_sns_draft_policy.json
