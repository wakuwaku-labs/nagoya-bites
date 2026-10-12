'use strict';

/**
 * scripts/lib/related_label.js — 関連記事のリンク文（チップ）に出す、記事の名前の唯一の決め方（I-26g・U-78）
 *
 * 日次ジャーナルの「関連記事」（scripts/refresh_journal_related.js）と、特集の
 * 「この特集の店の最新ジャーナル記事」（scripts/add_feature_journal_links.js）が同じ関数を通る。
 *
 *   - 古い題の「見出し — 副題」は、副題を落として見出しだけを出す（従来どおり）。
 *   - **文字数では切らない。** 以前は 38 字を超えると 36 字＋「…」で切っていたが、画面の読み上げは
 *     途中で終わった文を「…」まで読み、見ている人もどの記事か分かりにくい（公開ページ 362 か所）。
 *     長い題はチップの中で折り返す（390px で最大 3 行・1280px では 1 行に収まる）。
 */
function relatedLabel(title) {
  const t = String(title || '');
  const dash = t.indexOf(' — ');
  return dash > 0 ? t.slice(0, dash) : t;
}

module.exports = { relatedLabel };
