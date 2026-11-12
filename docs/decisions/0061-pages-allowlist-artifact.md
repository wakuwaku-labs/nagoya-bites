# 0061 内部文書とデータの公開を止める（Pages に「許可リストだけ」を出す）

- 日付: 2026-11-12
- 状態: 採用（2026-11-13 にオーナーの「推奨で進めて」で本番を切り替えた。切り替えの操作は Claude が gh で行った）
- 関連: `scripts/build_pages_artifact.js`・`.github/workflows/pages-artifact.yml`・`tests/pages_artifact.test.js`

## 背景
- 本番（https://nagoya-bites.com/）は GitHub Pages が main の直下をそのまま公開している（公開元は「Deploy from a branch」、リポジトリは PUBLIC、`.nojekyll` あり）。
- そのため、内部の文書（`HANDOFF.md`・`CLAUDE.md`・`AGENTS.md`・`agent-backlog.md`・`spec.md`・`sprint-*.md`・`build-report.md` など）、`data/` の大半（検索・計測の数字を含む）、`docs/`・`scripts/`・`agents/`・`tests/`・`.claude/`・`.gas-deploy/` が、誰でも URL で開ける。2026-11-12 に本番へ GET して、`HANDOFF.md`・`CLAUDE.md`・`agent-backlog.md`・`AGENTS.md`・`spec.md`・`data/gsc_metrics.json`・`data/site_metrics.json`・`scripts/*.js` などが 200 で返ることを確かめた（`.github/` 配下は 404 だった）。
- 追跡ファイル 12,941 件のうち、サイトの表示・機能に要る物は約 11,490 件（店舗・特集・ジャーナルのページと画像）。残り約 1,450 件が内部の物。

## 重要な制約（履歴は消えない）
- リポジトリ自体が PUBLIC なので、公開の仕組みでファイルを外しても、**git の履歴（過去の内容）と GitHub 上のファイル表示は公開のまま**残る。この判断で止められるのは「nagoya-bites.com の URL で開ける」ことと、検索エンジンに載ることだけ。
- 過去に秘密を入れたことがあるなら、履歴の書き換えではなく、その秘密の無効化（鍵の作り直し）が確実な対処になる。履歴の書き換え（force push）は別の判断で、この記録では扱わない。
- 公式文書（GitHub Docs「GitHub のプラン」「GitHub Pages の作成」）で確かめた事実:
  - GitHub Free のアカウントは、Pages を使えるのは公開リポジトリだけ（"If the account that owns the repository uses GitHub Free or GitHub Free for organizations, the repository must be public."）。
  - 有料プラン（Pro など）では、非公開リポジトリでも Pages を使える。ただし**サイト自体は公開のまま**で、サイトを非公開にする（アクセス制御）には、GitHub Enterprise Cloud の Organization が要る。
  - したがって「リポジトリを非公開にして履歴も隠す」は、(1) 有料プランが要る（費用が発生する）、(2) 他のしくみが影響を受ける（例: Ondine が `raw.githubusercontent.com` から `data/x_metrics.json` を読んでいる。非公開にすると匿名では読めなくなる）。費用・影響があるため、この記録では選ばない（案 C）。

## 案の比較
| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| A（採用） | GitHub Actions で「許可リストだけ」を成果物にして Pages に出す（公開元を「GitHub Actions」に切り替える） | 既定が遮断なので、新しい内部ファイルを足しても自動で公開されない。URL が 404 になり検索からも消える。無料。戻せる | 切り替えの設定をオーナーが1回行う。main を更新する他の workflow の後に公開し直す設定が要る（用意済み） |
| B | 内部ファイルを別の場所へ移す／`git rm` する | 公開の仕組みに頼らない | 多数のスクリプト・workflow・試験がパスを参照している（`data/`・`docs/` 等）。移動の影響が大きく、履歴は結局残る |
| C | リポジトリを非公開にする | 履歴も隠せる | 有料プランが要る。Ondine の raw 参照などが壊れる。サイトは公開のまま |
| D | `robots.txt` で遮断する | 手軽 | 遮断にならない（URL が「内容なしで検索に載る」原因になる）。内容は誰でも読める。**採用しない** |

## 決めたこと（案 A）
1. `scripts/build_pages_artifact.js` が、git で追跡されているファイルのうち**許可リストに当たる物だけ**を `_site/` へコピーする。許可リストに無い物は、何もしなくても公開されない（既定は遮断）。
   - 許可: ルート直下の公開ページ（`*.html`）・`sitemap*.xml`・`robots.txt`・`llms.txt`・`manifest.json`・`sw.js`・`CNAME`・IndexNow の鍵ファイル・Search Console の確認ファイル、`stores/**.html`、`features/*.html`、`journal/*.html` と `feed.xml`・`feed.atom`、`assets/**`（画像・CSS）、`icons/*`、`data/stores.json`・`data/crosscheck.json`（index.html が fetch する）・`data/area_genre_pages_manifest.json`（`llms.txt` が出典として URL を示す）。
   - 暫定許可: なし（2026-11-13 に `data/gsc_metrics.json` を外した。下の「決定済み」を参照）。
   - 遮断: 上以外のすべて（`HANDOFF.md`・`CLAUDE.md`・`agent-backlog.md`・`data/` の残り・`docs/`・`scripts/`・`tests/`・`agents/`・`.github/`・`.claude/`・`.gas-deploy/`・ルートの `*.js`・`*.sh`・`*.md`・ログなど。`journal/_template.html` などの先頭 `_` の作業用ページも）。
   - 必須ファイル（`index.html`・`404.html`・`sw.js`・`data/stores.json` など）が欠けたら成果物を作らず失敗する（壊れたサイトを出さない）。
2. `.github/workflows/pages-artifact.yml` を新設した。**main に合流しただけでは本番は変わらない**:
   - 既存の `build.yml`（Build & Deploy）は変更していない。
   - 自動の起動（main への push と、main へ push する既存 workflow の完了）は、リポジトリ変数 `PAGES_ACTIONS_ENABLED` が `true` のときだけ jobs が動く。
   - 手動起動（`deploy` が既定の false）は、成果物を作って検査するだけの予行演習。
3. 試験 `tests/pages_artifact.test.js` が、(a) 内部の物が許可されないこと、(b) JS が fetch する data・sitemap の URL・公開ページが参照する資産・manifest のアイコン・外部（GAS・`llms.txt`）が読む `data/*.json` がすべて成果物に入ること、(c) 必須ファイルが欠けたら失敗すること、(d) main へ push する既存 workflow が `workflow_run` の一覧に全部あること、を検査する。

## 決定済み（2026-11-13）: `data/gsc_metrics.json` はサイトから外す
- オーナーが推奨（外す）を選んだ。GAS の取得先を `https://raw.githubusercontent.com/wakuwaku-labs/nagoya-bites/main/data/gsc_metrics.json` に替え、`DATA_TEMPORARY_ALLOW` を空にした。リポジトリが PUBLIC なので raw では読めるまま（新たに公開される物は無い）。日次アドバイスの KW の名指しは落ちない。リポジトリを非公開にするときは、この取得先も見直す。

### 当時の判断材料
- `.gas-deploy/Code.js` の `fetchGscCandidateKeywords()` が、日次レポートのアドバイス用に `https://nagoya-bites.com/data/gsc_metrics.json` を読んでいる（取れなければ「KW を名指ししない文言」に落ちる作りで、止まりはしない）。
- そのため既定では**暫定許可**にしてある（遮断すると GAS の日次アドバイスの質が下がる）。リポジトリが PUBLIC のうちは、遮断しても内容は GitHub 上で読めるので、遮断の効果は「サイトの URL では開けない」ことだけ。
- 遮断したいときは、`scripts/build_pages_artifact.js` の `DATA_TEMPORARY_ALLOW` から外し、GAS 側の取得を直す（例: 取得先を変える、または KW 候補を使わない）。試験が GAS の参照と突き合わせているので、片方だけ変えると試験が落ちて気づける。

## 本人がやる設定（順番どおり。画面名は公式文書の表記）
目的: 公開元を「ブランチの直下をそのまま」から「許可リストだけの成果物」に替える。費用: 無料（GitHub Actions の分数を毎回数分使うが、公開リポジトリでは無料枠内）。
1. この変更を main に合流する（別途承認）。この時点では本番は変わらない。
2. 予行演習: GitHub のリポジトリで **Actions** タブ → 左の一覧の「Pages Artifact (許可リストだけを公開)」→ **Run workflow** → `deploy` は false のまま → **Run workflow**。緑になれば、成果物の検査（内部の物が入っていない・必須ファイルがある）まで通っている。
3. 切り替え（アクセスの少ない時間帯に。切り替えから最初の公開までの数分、表示が途切れる可能性がある。公式文書に途切れない旨の記載は見つからなかったので、安全側で書く）: **Settings** タブ → 左の「Code and automation」の **Pages** → 「Build and deployment」の **Source** を **GitHub Actions** にする。
4. すぐ **Actions** タブ → 「Pages Artifact (許可リストだけを公開)」→ **Run workflow** → `deploy` を true にして実行。緑になれば本番が成果物に替わる。
5. 下の「確かめる URL」で、遮断する物が 404、必要な物が 200 であることを確かめる。
6. 自動で公開し直す設定: **Settings** → **Secrets and variables** → **Actions** → **Variables** タブ → **New repository variable** → Name に `PAGES_ACTIONS_ENABLED`、Value に `true` → **Add variable**。以後、main の更新（毎日の自動処理を含む）のたびに成果物が公開し直される。**この変数を入れ忘れると、切り替え後は毎日の更新が本番に出なくなる**（4 で出した版のまま止まる）。
7. カスタムドメイン: **Settings** → **Pages** の「Custom domain」が `nagoya-bites.com` のままで、「Enforce HTTPS」にチェックが入っていることを確かめる（Actions 配信では `CNAME` ファイルでなくこの設定が使われる）。

## 戻し方
1. **Settings** → **Pages** → 「Build and deployment」の **Source** を **Deploy from a branch** に戻し、ブランチ `main`・フォルダ `/(root)` を選んで **Save**。数分で元の配信（main の直下を丸ごと）に戻る。
2. リポジトリ変数 `PAGES_ACTIONS_ENABLED` を削除するか `false` にする（自動の公開し直しを止める）。
3. コードの戻しは `git revert`（`pages-artifact.yml`・`build_pages_artifact.js`・試験・この記録）。

## 切り替え後に確かめる URL（前に `https://nagoya-bites.com` を付ける）
- 404 になるはず（内部）: `/data/gsc_metrics.json`・`/HANDOFF.md`・`/CLAUDE.md`・`/AGENTS.md`・`/agent-backlog.md`・`/spec.md`・`/build-report.md`・`/sprint-1-report.md`・`/store-notification-template.md`・`/data/site_metrics.json`・`/data/x_post_log.json`・`/data/feedback_log.json`・`/data/editor_picks.json`・`/docs/decisions/README.md`・`/scripts/fetch_gsc_metrics.js`・`/tests/pages_artifact.test.js`・`/agents/builder.md`・`/.claude/settings.json`・`/package.json`・`/build.js`・`/journal/_template.html`
- 200 になるはず（必要）: `/`・`/about.html`・`/faq.html`・`/contact.html`・`/privacy-policy.html`・`/features/`・`/stores/J000015064.html`・`/stores/area/chikusa-imaike/bar-budget-3000.html`・`/journal/feed.xml`・`/sitemap.xml`・`/sitemap-images.xml`・`/robots.txt`・`/llms.txt`・`/manifest.json`・`/sw.js`・`/assets/css/nb.css`・`/icons/icon-192.png`・`/data/stores.json`・`/data/crosscheck.json`・`/data/area_genre_pages_manifest.json`・`/googledf7b9dabc1052b56.html`・`/ec3ee6876b0d465ab4f7093ba5bc42d0.txt`
- 存在しない URL（例 `/no-such-page`）が `404.html` の中身を HTTP 404 で返すこと。
- トップページを開き、店舗の一覧が出て、店舗カードの口コミ内訳（`data/crosscheck.json`）が開くこと（スマホ幅で1往復）。

## 見直す条件
- 公開してよい新しい種類のファイル（新しい `data/*.json` を JS が fetch する・新しいディレクトリの資産など）を足すときは、許可リストに足す（試験が、足し忘れて壊れる典型を止める）。
- リポジトリを非公開にする判断をしたら、この記録の「重要な制約」と案 C を見直す。
