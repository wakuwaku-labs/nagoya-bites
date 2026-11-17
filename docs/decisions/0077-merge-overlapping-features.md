# 0077 重なった特集を流入の多い方へ寄せる（転送ページ化）

- 日付: 2026-11-17
- 状態: 採用
- 関連: 0069 決定7／0015（同じジャンルの特集の切り分け・一部置き換え）／0075 決定8／`docs/plans/media-policy-2026-11/s5-3-candidates.md`／`data/feature_merges.json`・`scripts/lib/feature_merges.js`・`scripts/merge_features.js`・`tests/feature_merges.test.js`

## 背景
- 0069 決定7: 掲載店の半分以上が同じ特集の組は、流入の少ない方を多い方へ寄せる。2026-11-17 に対象の一覧（s5-3-candidates.md）を本人に見せ、「全て推奨で」の返事を得た。承認されたのは次の2組だけ。
  - nagoya-yakitori-guide → nagoya-yakitori（掲載店 10店中8店が同じ。流入は yakitori 2クリック／64表示、guide 0／0）
  - industry-insiders-pick → kospa-insider（5店中3店が同じ。流入は kospa 9／146、industry 0／0。題から「業界人」を外す決定4と同じ方向）
- 季節が過ぎた4本（gw-2026・mothers-day・fathers-day-2026・nagoya-summer-2026）は、推奨どおり検索に残す（noindex にしない）。注記は処理済みで、作業は無い。
- ほかの組（lunch-washoku と settai-lunch・birthday 系・フレンチとイタリアン など）は寄せない。主題が違う・流入に差が無い・店の入れ替えの偏りのため。

## 決めたこと
1. 寄せ元の URL は消さない。`features/<寄せ元>.html` を転送ページ（canonical は寄せ先・`noindex,follow`・meta refresh・JS・リンク）にする。GitHub Pages は 301 を返せないので、店舗の誘導ページ（ISSUE-102）と同じ型に noindex を足した。転送ページは HTML コメント `<!-- nb-feature-merged:<寄せ先> -->` で見分ける。
2. 先に内部リンクを寄せ先へ張り替える（サイト全体）。同じ「関連する特集」に寄せ先が既にある・寄せ先自身のページなら、リンクを外す（重複・自己リンクを作らない）。リンク文が空・寄せ元の旧い文言のときだけ寄せ先の文言に替え、本文中の言い回しは触らない。店舗ページ・ハブは生成物なので、生成元（`gen-store-pages.js` の推定の規則・`scripts/lib/journal_topics.js`・語彙表）を直して作り直した。作り直されない孤児の店舗ページだけ直接直す。
3. 寄せ先には、読者の声の区画の直前に「統合した記事から」の一文を足す（`data-nb-merged-from`）。題・URL・冒頭は変えない。一文に「N選」を入れない（掲載数の同期が拾うため）。
4. 寄せ元を、特集の一覧（features/index.html）・サイトマップ・画像サイトマップ・llms.txt・ページ名・役割表（feature_roles.json）・毎月の掲載店の入れ替え（feature_rosters.json）から外す。サイトマップ・llms.txt・ページ名・棚卸し台帳・入れ替え・計測・デザイン系の生成器と検査は、転送ページを数えない（`feature_merges.js` の `isMergedStub`／`filterLiveFeatureFiles`）。入れ替えは転送ページを書き換えない。
5. 寄せた記録の正本は `data/feature_merges.json`。実行は `node scripts/merge_features.js`（冪等）、確認は `--check`。
6. トップの「目的から探す」の語彙表（`data/journal_seo_keywords.json`）は、検索語の対応づけ（kw・aliases）を残し、行き先を寄せ先へ替えた。同じ特集を指す語は一覧に1つだけ出す（`業界人` はコスパと同じ kospa-insider を指すので出ない）。
7. 0015 の「同じジャンルの特集は統合しない」は、掲載店の半分以上が同じ組には当てはめない（焼き鳥の2本を統合）。焼肉・バーなど、選定条件で切り分けて重なりが小さい組は 0015 のまま。

## 戻し方
1. `data/feature_merges.json` から該当の組を消す。
2. 寄せ元を転送ページ化する前の姿に戻す（このPRの前のコミットの `features/<寄せ元>.html`）。
3. 寄せ先の「統合した記事から」の一文（`data-nb-merged-from`）を消す。
4. 張り替えたリンクは、このPRの差分を逆向きに当てる（git revert でまとめて戻せる）。
5. 特集の一覧のカード・サイトマップ・llms.txt・ページ名・役割表・掲載店の入れ替えの設定は、このPRの差分から戻す。翌日以降のビルドが、サイトマップ・llms.txt・店舗ページ・「掲載特集」を作り直す。
- 転送ページへ向けた検索の評価は、戻すと再び分かれる。戻す前に Search Console で寄せ先の28日の流入を見る。

## 選ばなかった案と理由
- 寄せ元の本文を残して noindex だけにする: 被リンクと検索の評価が寄せ先へ集まらない。人が開いても重なった内容が2本ある。
- 寄せ元を消す（404）: 検索・被リンク・計測に残る URL が壊れる。
- 流入の少ない方を、役割表の「主」のまま残す: 0069 決定7は流入の多い方へ寄せる。焼き鳥は役割表の「主」が guide だったが、差が小さくても決定どおり yakitori に寄せた（役割表の組は外した）。
- 季節が過ぎた4本を noindex にする: 来年同じ URL で育てる前提では、検索に残すほうが立ち上がりが早い（推奨どおり）。

## 見直す条件
- 寄せ先の検索流入が、寄せたあと28日で下がったとき（寄せ元の評価が移らなかったと見る）。
- 毎月の掲載店の入れ替えで、別の組の重なりが半分を超えたとき（候補の一覧は `s5-3-candidates.md` の方法で出し直し、本人に見せてから寄せる）。
