# 0063 現役でない旧店舗ページは削除せず noindex にする

- 日付: 2026-11-13
- 状態: 採用
- 関連: SEO 診断の項目14 / `scripts/lib/store_orphans.js`（addOrphanNoindex・removeOrphanNoindex）/ `gen-store-pages.js --redirect-orphans` / `scripts/noindex_orphan_stores.js` / 判断記録 0052

## 背景
- `stores/*.html` のうち、今の `data/stores.json` から作られず、現役の店ページへの誘導もできないページ（孤児）が 139 本ある（sitemap の外）。閉店・掲載終了・実在検証待ち・不明が混ざっていて、検索に出せる状態のままだった。同じ店の重複が 3 組ある。
- `.github/workflows/build.yml` は「一括自動削除は sitemap・被リンク・検索への影響があるため見送り」と決めている。

## 決めたこと
1. 孤児は削除しない。現役の店ページがあるものは従来どおり誘導ページ（canonical + meta refresh）にし、それ以外は `<head>` に `<meta name="robots" content="noindex,follow">` の1行だけ足す（中身は変えない）。
2. 印は `<!-- nb-orphan-noindex -->`。印の行ごと取り除けば元に戻る（`node scripts/noindex_orphan_stores.js --revert`）。冪等。
3. 毎日の `gen-store-pages.js --redirect-orphans` が、新しく孤児になったページにも同じ印を足す。実在検証を通って現役に戻った店は、生成器が通常のページで上書きするので印も消える。
4. すでに noindex の案内ページ（M000006・M000058・判断記録 0052）には足さない。

## 選ばなかった案と理由
- 削除・301 転送の新設: 取り消しにくく、被リンクや実在検証待ちの店を失う。
- 案内ページ（0052 の形）への置き換え: 中身が失われる。noindex だけで目的は果たせる。

## 見直す条件
- 月次レビューで閉店が確かめられた孤児（独立した2つ以上の情報源）は、従来の `--delete-orphans` の手順で消すか決める。
