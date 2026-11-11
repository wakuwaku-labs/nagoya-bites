/*
 * 店舗ページの内部リンクのクリック計測（internal_link_click）。
 * 1つのリスナーで、店舗ページ本文の4つのブロック（この店が載っている特集・あわせて読みたい特集・似た条件のお店・一覧へ戻る）と
 * パンくずのリンクだけを拾う。ヘッダー・フッターの共通リンクと外部リンク（outbound_click が別に数える）は拾わない。
 * 送るもの: block（どのブロックか）・link_type（特集 feature / 日次 journal / エリア area / 店舗 store）・link_url（行き先のパス。店名は送らない）。
 * gtag の読み込みが止められた環境（広告ブロック等）でも例外を出さない。trackEvent は GA スニペット（scripts/lib/ga_snippet.js）が持つ。
 * 生成の元: gen-store-pages.js / scripts/lib/store_link_tracking.js
 */
(function () {
  if (window.__nbStoreLinkTracking) return;
  window.__nbStoreLinkTracking = true;
  // 上から順に最初に当たったものを採る（listed-features は related-features のクラスも持つので先に置く）
  var BLOCKS = [
    ['.listed-features', 'listed_features'],
    ['.related-features', 'related_features'],
    ['.related-stores', 'related_stores'],
    ['.back-section', 'back_to_list'],
    ['.breadcrumb', 'breadcrumb']
  ];
  function linkType(path) {
    if (/^\/features\//.test(path)) return 'feature';
    if (/^\/journal\//.test(path)) return 'journal';
    if (/^\/stores\/area\//.test(path)) return 'area';
    if (/^\/stores\/[^\/]+\.html$/.test(path)) return 'store';
    return 'other';
  }
  document.addEventListener('click', function (e) {
    try {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var block = '';
      for (var i = 0; i < BLOCKS.length; i++) {
        if (a.closest(BLOCKS[i][0])) { block = BLOCKS[i][1]; break; }
      }
      if (!block) return;
      var u = new URL(a.getAttribute('href') || '', location.href);
      if (u.hostname !== location.hostname) return;
      if (typeof trackEvent !== 'function') return;
      trackEvent('internal_link_click', { block: block, link_type: linkType(u.pathname), link_url: u.pathname });
    } catch (err) { /* 計測の失敗でリンクの動きを止めない */ }
  }, true);
})();
