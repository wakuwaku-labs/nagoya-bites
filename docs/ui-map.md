# 画面の地図（画面のファイル・型・ナビの定義・代表画面・代表操作）

UI/UX 計画の段階2 の6・7番（Ondine #2412・2026-11-21）。画面を作る・直す前に、どのファイルが正本かをここで引く。
書いたパスはすべて 2026-11-21 の main（59c7d2036d）で実在を確かめた（`docs/evidence/2412/README.md`）。

## 1. 画面の型と、作る元（手で直すのは「作る元」）

| 画面 | 公開ファイル | 作る元（正本） |
|------|------|------|
| トップ（店の検索） | `index.html` | `index.html` 自身（一枚）＋ `build.js`（`var LOCAL_STORES = [...]` を埋める） |
| 店ページ | `stores/<ID>.html` | `gen-store-pages.js`（手書き禁止） |
| エリア×ジャンル一覧 | `stores/area/**/index.html` | `scripts/gen_area_genre_pages.js` ＋ `data/area_genre_pages_policy.json` |
| 特集の記事・特集一覧 | `features/*.html`・`features/index.html` | 手書き＋ `scripts/gen_industry_features.js`・季節特集の欄は `scripts/build_featured.js` |
| ジャーナルの記事・一覧 | `journal/YYYY-MM-DD-*.html`・`journal/index.html` | `journal/_template.html`・`scripts/build_journal_index.js` |
| 404 | `404.html` | `scripts/gen_404_page.js` |

## 2. 型（全画面が通る共通部分）

- 見た目の判定基準: `data/design_system.json` → 共有スタイル `assets/css/nb.css` → 説明 `docs/design-system.md`（制約12）
- ヘッダー・ナビ・パンくず・フッター: `scripts/lib/site_chrome.js`（ナビの項目は `NAV_PRIMARY`・`NAV_SECONDARY`、現在地は `activeKeyFor`）。各ページへの差し込みは `scripts/apply_site_chrome.js`、トークンの書き換えは `scripts/apply_design_system.js`
- 店の行動の出口: 電話 `scripts/lib/phone_link.js`・地図 `scripts/lib/map_link.js`・予約 `scripts/lib/reservation_exits.js`・数え方 `scripts/lib/store_actions.js`
- 検査: `scripts/audit_design_system.js --check`（合否）・`scripts/audit_ui_extra.js`（数えるだけ）

## 3. 代表画面（作り直しは「重い段3」の (b)）

| key | 画面 | 代表のファイル |
|------|------|------|
| top | トップ（店の検索・絞り込み・店のモーダル） | `index.html` |
| store | 店ページ（題材 E1） | `stores/J000015064.html` |
| journal | ジャーナルの記事（題材 E2） | `journal/2026-04-21-yabamisen-nagoya-insider.html` |
| feature | 特集の記事 | `features/banquet.html` |
| features-index | 特集一覧 | `features/index.html` |
| journal-index | ジャーナル一覧 | `journal/index.html` |

一覧の正本は `scripts/measure_ui_baseline.js` の `PAGES`（替えるときはこの表も直し、基準値を測り直す）。

## 4. 代表操作（スマホ幅と PC 幅の両方で確かめる）

1. トップで絞り込む: 「絞り込み」（`#filter-toggle-btn`・`nbOpenFilterSheet`）→ シート `#filter-sheet` で条件を選ぶ → 結果の一覧（`applyFilters`）
2. トップの店のカードから店のモーダル（`#modal`・`openM`）を開き、保存（`#modal-fav-btn`）・電話・予約・地図へ進む
3. 店ページの下の行動の帯（`.nb-action-bar`）で、予約（`.nb-bar-reserve`）・地図（`.nb-bar-map`）・電話（`.nb-call-js`）を押す
4. 記事（ジャーナル・特集）の本文から店ページ（`../stores/<ID>.html`）へ移る
5. ヘッダーのメニュー（`#hamburger-btn`）を開き、特集・ジャーナルの一覧へ移る

## 5. 基準値（割合）

- 記録: `data/ui_baseline_ratio.json`（`node scripts/measure_ui_baseline.js --write`）。割合はすべて `num/den`（分母は代表画面の数か、読んだ CSS 規則の数）
- 数えるだけで、合否・既存の検査の出力・`data/design_system.json` には使わない。日時を入れないので、同じ入力で2回測ると同じになる
- 2026-11-21 の値: 既存の検査の違反がある代表画面 0/6、`audit_ui_extra` の何かがある代表画面 6/6（全6画面の viewport-fit なし）、読んだ CSS 規則あたり 16/1222
