# 日次ジャーナルの写真ソース — セットアップ手順

> ISSUE-091（2026-08-17「記事と無関係な別店の販促バナーが記事の顔になった」）の再発防止。
> 事故の引き金は「主役2店が新店で写真を持たなかった」ことだが、真の理由は
> **CLAUDE.md が許可している写真ソースの一部が、記事を実際に生成する環境に届いていなかった**こと。
> このファイルはその配線手順の正本。手順の変更はここで行う。

---

## なぜ手順書が要るのか

日次ジャーナルは GitHub Actions ではなく、**Mac 上の launchd**（`com.nagoyabites.journal.plist`）から
`scripts/run_journal_local.sh` で生成される。launchd は最小環境でプロセスを起動するため、
ターミナルで `export` した環境変数も、`~/.zshrc` の設定も**一切引き継がない**。

その結果、`GOOGLE_PLACES_API_KEY` は GitHub Secrets には入っているのに、
ジャーナル生成時には常に未設定で、CLAUDE.md「写真ソースの優先順」の
**優先4（Google Places）は一度も発火したことがなかった**。
規約上は使ってよいのに、実装上は絶対に届かない死んだ経路になっていた。

---

## 1. Google Places API キーを journal 実行環境に通す（オーナー本人の作業）

キーはクレデンシャルなので、リポジトリには置かない。**リポジトリの外**に置く。
`.gitignore` 頼みにすると、いつか誤ってコミットされる。

```bash
mkdir -p ~/.config/nagoya-bites
```

次に `~/.config/nagoya-bites/journal.env` を作り、以下の1行を書く
（`<キー>` は GitHub の `Settings → Secrets and variables → Actions → GOOGLE_PLACES_API_KEY`
と同じ値。GitHub 上では値を再表示できないので、控えが無ければ
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) で確認・再発行する）:

```
GOOGLE_MAPS_API_KEY=<キー>
```

ファイル権限を自分だけに絞る:

```bash
chmod 600 ~/.config/nagoya-bites/journal.env
```

確認（`present` と出れば配線完了）:

```bash
JOURNAL_ENV=~/.config/nagoya-bites/journal.env bash -c 'set -a; . "$JOURNAL_ENV"; set +a; [ -n "${GOOGLE_MAPS_API_KEY:-}" ] && echo present || echo absent'
```

`run_journal_local.sh` はこのファイルがあれば自動で読み込む。無くても実行は止まらないが、
`data/journal_health.json` の `photo_sources.google_places_api_key` に `absent` と記録され、
**push されて外から見える**ようになっている（ログファイルの中だけで嘆かない＝ISSUE-084 の教訓）。

---

## 2. PR TIMES メディアユーザー登録（オーナー本人の作業）

PR TIMES 企業規約 第6条3項により、プレスリリース発行企業は報道関係者に対し
**「報道目的で利用する限り、企業コンテンツを無償で非独占的に利用」することを許諾**している
（有償目的での利用は除外。NAGOYA BITES は広告ゼロ・PR記事ゼロのため該当しない）。

新店・新メニューはほぼ必ず PR TIMES にリリースが出るため、
**新店記事の「実写が1枚も無い」問題をほぼ解消できる**唯一の合法経路になる。

メディアユーザー登録をすると、リリースごとの「プレスリリース素材ダウンロード」から
高解像度の報道用素材にアクセスできる。登録はアカウント作成を伴うため、
**エージェントは代行しない。オーナー本人が行うこと。**

- 登録: https://prtimes.jp/ のメディアユーザー登録から
- 媒体名: NAGOYA BITES / URL: https://nagoya-bites.com/

> 登録が未完でも、リリース本文に埋め込まれた画像（`prcdn.freetls.fastly.net/release_image/...`）の
> 参照自体は可能。ただし**どの経路で取得したかに関わらず、利用は報道目的に限る**。

---

## 3. 使うときのルール（全エージェント共通）

CLAUDE.md「写真ソースの優先順」に従う。PR TIMES 素材を使う場合の追加条件:

```
1. その記事が扱う店・企業のリリースであること
   → 記事の sources[] にそのリリースURLを必ず入れる（ゲートが照合する）
2. クレジットに発行企業名とリリースURLを明記する
   → 「Photo: 提供 株式会社◯◯（プレスリリースより）」＋リンク
3. 画像は self-host せず、リリースの画像URLをそのまま参照する
   → 複製保存ではなく参照に留める
4. 加工しない（トリミング・文字入れ・AI超解像はいずれも不可）
5. イメージパース（CG）は「実写」として扱わない
   → 実在保証が Moat であるため、CGを店舗写真として出さない。
     使う場合はキャプションに「イメージパース」と明記する
```

検証コマンド:

```bash
node scripts/audit_journal_photos.js --check
```
