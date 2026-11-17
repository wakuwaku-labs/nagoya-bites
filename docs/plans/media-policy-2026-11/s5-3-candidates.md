# S5-3 重複・季節切れ・品質不足の記事の整理 — 対象の一覧と本人の確認（2026-11-17）

この表は**案**です。記事を消す・転送ページにする操作は、本人の確認が済むまで一切していません（決定0069 の7・「削除を伴う片付けは、消す前に一覧を本人に見せる」）。流入は `data/gsc_metrics.json`（2026-10-20〜11-16 の28日・Google 検索のクリック／表示）。掲載店の重なりは、特集の掲載店の ID（ホットペッパー ID）で数えた値で、毎月1日の掲載店の入れ替え（`scripts/refresh_feature_rosters.js`）で変わります。

## A. 季節が過ぎた記事 — もう処理済み（消していない）

冒頭に「行事／季節は終わりました。同じ URL で見直します」の注記を足した（`data-nb-season-over`）。検索に出さない設定（noindex）は**入れていません**（A-2 が本人の判断）。

| 記事 | 行事 | 28日の流入 | 処理 |
|---|---|---|---|
| gw-2026 | 5月3〜6日 | 0 / 0 | 注記を追加 |
| mothers-day | 5月10日 | 0 / 0 | 同上 |
| fathers-day-2026 | 6月21日 | 0 / 0 | 同上 |
| nagoya-summer-2026 | 夏 | 0 / 0 | 同上（更新日が 11月1日 になっていた） |

- **A-2（本人の判断）**: 4本を検索に出さない設定にするか。推奨は「しない」。流入が0で失うものは無いが、来年同じ URL で育てる前提なら検索に残したままのほうが、来年の立ち上がりが早い。注記で誤解は防げている。
- nagoya-kaiseki-guide（懐石）は季節切れではなく「約束と中身がずれた記事」。下の C に回した。

## B. 重複（決定7: 掲載店の半分以上が同じ組。流入の少ない方を多い方へ寄せる）

重なりは「少ない方の掲載店のうち、何割が同じ店か」。流入は 28日の クリック／表示。

| 組（A ⇔ B） | 重なり | 流入 A | 流入 B | 決定7 の寄せ先案 | 注意 |
|---|---|---|---|---|---|
| nagoya-yakitori ⇔ nagoya-yakitori-guide | 8/10（全 ID）。同文の紹介あり | 2／64 | 0／0 | **guide → yakitori**（流入の少ない guide を多い yakitori へ） | `data/feature_roles.json` は guide を「主」にしている。流入だけで見ると逆。差は小さく（2クリック）、主は guide のままで yakitori を寄せる案もある。0015 の「同ジャンルは統合しない」を見直す件。**本人が向きを決める** |
| nagoya-lunch-washoku ⇔ nagoya-settai-lunch | 5/9 | 0／0 | 0／0 | 流入に差が無い。役割の定義で、昼の接待は lunch-washoku が主（役割表） → **settai-lunch → lunch-washoku** | settai-lunch の h1 は「接待おすすめ9選」で「ランチ」が抜け、9店中5店がうなぎ（①B1 の監査）。作り替えて別の約束にする案もある |
| industry-insiders-pick ⇔ kospa-insider | 3/5 | 0／0 | 9／146 | **industry-insiders-pick → kospa-insider** | 「業界人の推薦」系。題から語を外す決定4と同時に扱える。ヒーロー写真も同じ（①B1） |
| birthday-surprise ⇔ kospa-insider | 5/5（全部同じ） | 4／24 | 9／146 | 少ない方 birthday-surprise の掲載店5店が kospa と同一。**birthday-surprise → kospa-insider は主題が違うので寄せない**。店の入れ替えで重なりが偶然増えた疑い | 来月の入れ替えで変わる。様子見でよい |
| birthday-surprise ⇔ industry-insiders-pick | 4/6 | 4／24 | 0／0 | industry-insiders-pick を kospa-insider へ寄せる（上）と同時に解消 | |
| nagoya-french-guide ⇔ nagoya-italian-guide | 7/8 | 0／0 | 0／0 | 流入に差が無い。主題が違う（フレンチ／イタリアン）ので**寄せない**。店の入れ替えの偏り（同じ店がジャンル違いの2本に入る）を直すのは S2 の掲載条件の仕事 | |
| birthday ⇔ birthday-surprise | 3/5 | 0／0 | 4／24 | birthday → birthday-surprise | 主題が近い（誕生日）。流入は小さい |
| gw-2026 ⇔ industry-insiders-pick | 3/6 | 0／0 | 0／0 | 行事が終わった記事（A）なので対象にしない | |
| industry-insiders-pick ⇔ sakae | 3/6 | 0／0 | 1／58 | 寄せない（sakae はエリアの総合） | |

決定7 が言う「今は2組」は、おそらく **yakitori の2本** と **「業界人の推薦」系の2本（industry-insiders-pick ⇔ kospa-insider）**。上の表はそれに加え、今日の掲載店で半分以上が重なる組を機械で拾った全件です（残りは様子見・寄せない案）。

### 寄せるときの手順（本人の確認後。このPRでは実行しない）
1. 寄せる側の記事への内部リンクを、先に寄せ先へ張り替える（転送ページへのリンクで build が止まった過去がある・`stub_links` の検査）。
2. 寄せ元を転送用ページにし、寄せ先に「統合した記事から」の一文を足す。
3. `data/feature_roles.json` と sitemap から寄せ元を外す。
4. 戻し方: 転送を外し、検索に出す設定を戻す。

## C. 約束と中身がずれた記事（作り替えか題の修正。消さない）

| 記事 | ずれ | 28日 | 案 |
|---|---|---|---|
| nagoya-kaiseki-guide | 「懐石・会席」の題だが先頭3店がうなぎ等。ヒーロー写真が掲載外の店 | 0／0 | 懐石・会席のコースがあると確認できた店に絞る（掲載条件は S2 の仕事）。確認できなければ題を実態に合わせる |
| nagoya-settai-lunch | h1「接待おすすめ9選」で「ランチ」が抜け、9店中5店がうなぎ | 0／0 | h1 を実態に合わせる、または B の寄せ先案 |
| nagoya-settai-secret | 「確認できた8軒」と言い切るが確認の跡が無い・一時休業の店・夜カフェが入る | 0／0 | 一時休業は営業の注記（S1-4）で済み。確認の言い切りは「確認できたこと／未確認」の書き方に |
| hard-to-book / nagoya-reservation-difficult | 掲載店が予約困難である根拠が無い | 4／85（hard-to-book）・0／0 | 攻略法を残し、店の一覧は「予約が取りにくいと確認できた店」だけにする |

## 本人に最後に確認したいこと
1. **B の向き（決定7の実行）**: yakitori の2本はどちらを残すか（推奨: 流入が多い `nagoya-yakitori` に寄せる。ただし役割表の「主」は guide）。「業界人の推薦」系は `kospa-insider` に寄せてよいか。実行は、内部リンクの張り替えを済ませてから別のPRで行う。
2. **A-2**: 季節切れ4本を検索に出さない設定にしない（推奨）で良いか。
3. **C**: 作り替え・絞り込みを S2 の掲載条件と一緒に進めてよいか。

## 実行済み（2026-11-17・決定 0077）
本人の返事「全て推奨で」を受け、次の2組だけを寄せた。ほかの組は寄せない。季節が過ぎた4本は検索に残したまま（A-2＝しない）。
- nagoya-yakitori-guide → nagoya-yakitori
- industry-insiders-pick → kospa-insider
手順・戻し方は `docs/decisions/0077-merge-overlapping-features.md`。記録の正本は `data/feature_merges.json`、実行は `node scripts/merge_features.js`。
