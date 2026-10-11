'use strict';
/**
 * scripts/lib/journal_store_link_tracking.js
 *
 * ジャーナルの記事から店舗ページ（stores/<ID>.html）へのクリックを計測する <script> の唯一の正本（I-08）。
 * 使う側: journal/_template.html（新しい記事。テストが同じ文字列かを見る）と
 * scripts/add_journal_store_link_tracking.js（既存の記事への後追い）。
 *
 * 背景: 記事から店舗ページへのリンクは167本あるのに、クリックは数えていなかった
 * （UI・UX改修計画 U-80）。特集の feature_store_click と同じ形で、店は ID（リンク先のスラグ）、
 * 記事はファイル名（日付つき）で送る。語彙: journal_store_click {store, journal}。
 * 店舗の一覧（stores/index.html）と、ハブ（stores/area/…）へのリンクは数えない。
 */

const MARKER = 'nb-journal-store-link';

const SNIPPET =
`<!-- I-08: 記事から店舗ページへのクリックを計測（journal_store_click）。店は ID、記事はファイル名で送る -->
<script class="${MARKER}">
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var m=(a.getAttribute('href')||'').match(/(?:^|\\/)stores\\/([A-Za-z0-9_-]+)\\.html(?:[?#]|$)/);if(!m||m[1]==='index')return;try{trackEvent('journal_store_click',{store:m[1],journal:location.pathname.replace(/^.*\\//,'').replace(/\\.html$/,'')});}catch(err){}});
</script>
`;

/** 記事に計測が入っているか */
function hasTracking(html) {
  return html.includes(MARKER);
}

/**
 * 記事の HTML に計測を入れて返す（冪等）。入れる場所は、既存の engagement 計測の </script> の直後
 * （journal/_template.html と同じ並び）。無ければ </body> の直前。どちらも無ければ null。
 */
function applyToHtml(html) {
  if (hasTracking(html)) return html;
  const m = /<script class="nb-engagement-tracking">[\s\S]*?<\/script>\s*\n/.exec(html);
  if (m) {
    const at = m.index + m[0].length;
    return html.slice(0, at) + SNIPPET + html.slice(at);
  }
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return null;
  return html.slice(0, idx) + SNIPPET + html.slice(idx);
}

module.exports = { MARKER, SNIPPET, hasTracking, applyToHtml };
