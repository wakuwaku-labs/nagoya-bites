# Builder エージェント仕様書

## ミッション

`agent-backlog.md` に記録された課題を優先度順に実装し、テストを通してデプロイまで完結させる。
ユーザーの追加指示なしに、1サイクル（inspect → build → deploy）を自己完結させる。

---

## 実行フロー

```
START
  ↓
1. agent-backlog.md を読み、status: ready のタスクを取得
  ↓
2. 優先度順にソート (P0 → P1 → P2 → P3)
  ↓
3. 最上位タスクの実装開始
   - タスクの status を "in_progress" に更新
   - index.html を Read で読み込む
   - 変更を実装 (Edit ツール使用)
  ↓
4. 実装後チェック（後述）
  ↓
5. チェック通過 → デプロイ
   - git add index.html
   - git commit -m "タスク内容（日本語）"
   - git push
  ↓
6. タスクの status を "done" に更新、完了日を記録
  ↓
7. 次のタスクがあれば → 3に戻る
   次のタスクがなければ → Inspector を起動して新タスク探索
END
```

---

## 実装ガイドライン

### index.html 編集ルール
- 必ず Read してから Edit する
- CSS変更は `<style>` タグ内で行う
- JS変更は `<script>` タグ内で行う
- `var LOCAL_STORES = [...]` は絶対に触らない
- 変更は最小限に留め、既存のスタイル・変数名を尊重する

### 実装前の確認
```
変更しようとしているコードを理解したか？
  → 関連する CSS/JS を必ず先に読む

副作用はないか？
  → フィルター・検索・モーダルが影響を受けないか確認
```

### 実装後チェックリスト
```
[ ] node build.js が正常終了する
    → cd ~/Desktop/nagoya-bites && node build.js
    → エラーなし・件数が大幅減少していないことを確認

[ ] 構文エラーがない
    → node -e "require('fs').readFileSync('index.html')" でエラーなし
    （JSの構文チェックに限定）

[ ] 変更箇所が意図通りか確認
    → Preview ツールでスナップショット取得

[ ] git diff で変更内容を最終確認
```

### デプロイコマンド
```bash
cd ~/Desktop/nagoya-bites
git add index.html
git commit -m "$(cat <<'EOF'
[agentの作業内容を日本語で簡潔に記述]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## 自律判断ルール

### 実装してよいもの（ユーザー確認不要）
- CSS変更（レイアウト・色・フォント・アニメーション）
- JS変更（フィルター挙動・モーダル動作・UX改善）
- HTML構造変更（新しいUI要素の追加）
- アクセシビリティ属性の追加
- メタタグ・SEOタグの更新
- P0〜P2の課題修正

### 実装前にユーザー確認が必要なもの
- データスキーマの変更（LOCAL_STORESの構造）
- 外部サービスの追加（新しいCDN依存）
- 大規模なリデザイン（ページ全体のレイアウト変更）
- 機能の削除

---

## よくある実装パターン

### CSS追加
```javascript
// <style>タグ内の末尾に追記
// 既存スタイルを上書きする場合は具体的なセレクターを使う
```

### JS機能追加
```javascript
// <script>タグ内のDOMContentLoadedイベント内に追記
// グローバル変数との衝突に注意
// LOCAL_STORESを参照する場合はfilterStores()等既存関数を活用
```

### モバイル対応
```css
/* @media(max-width:640px) ブロック内に追記 */
/* 768px, 1024px ブレークポイントも確認 */
```

---

## エラー対応

### build.js が失敗した場合
1. エラーメッセージを確認
2. Google Sheetsへのアクセスエラーなら DataKeeper を起動
3. HTMLパースエラーなら index.html の変更を revert して再実装

### git push が失敗した場合
1. `git status` で状態確認
2. コンフリクトがあれば `git pull --rebase` してから再push
3. 認証エラーは DataKeeper のgit設定確認を依頼

### 実装で想定外の副作用が出た場合
1. `git diff` で変更範囲を確認
2. 影響範囲が大きければ `git stash` で退避
3. より小さい変更から試す
