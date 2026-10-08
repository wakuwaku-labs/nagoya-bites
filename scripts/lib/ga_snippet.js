'use strict';
/**
 * scripts/lib/ga_snippet.js
 *
 * GA4 の head スニペットの唯一の正本（SEO-138）。
 * 使う側: gen-store-pages.js（店舗ページ）・scripts/gen_area_genre_pages.js（エリア×ジャンルハブ）・
 * scripts/gen_industry_features.js（業界特集）・scripts/generate_daily_draft.js（journal/_template.html の
 * {{GA_SNIPPET}} を埋める）。
 *
 * 背景: 同じスニペットが4か所に別々に書かれていた。gen-store-pages.js の1コピーだけが、
 * テンプレートリテラルの中の `\/\/` が生成物で `//` に化けて行末がコメントになり、
 * 店舗ページ約5,000本の GA4 が 2026-05-08 から5か月止まっていた（SEO-115）。
 *
 * 書き方の決まり:
 * - テンプレートリテラル（バッククォート）を使わない。通常の文字列をつなぐ。
 * - 正規表現のスラッシュは通常の文字列の中で `\\/` と二重に書く（生成物では `\/` になる）。
 * - 生成物の構文は tests/ga_snippet.test.js と scripts/audit_inline_js_syntax.js が確かめる。
 *
 * 動き（index.html の GA と同じ）:
 * - `?nb_owner=1` で開くと、その端末の閲覧を内部トラフィック（traffic_type=internal）にし、
 *   独自イベントも送らない（docs/ga4-internal-traffic-verification.md）。
 * - localStorage が使えない環境（サイトデータを拒否した端末など）では読み書きが例外を投げるため、
 *   try/catch で囲み、通常の計測に倒す（例外で gtag('config') まで止まらないようにする）。
 */

const GA_ID = 'G-3LCZNGZPWJ';

const LINES = [
  '<!-- Google Analytics 4 -->',
  '<script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_ID + '"></script>',
  '<script>',
  'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}' +
    "function nbInternal(){try{return localStorage.getItem('nb_internal')==='1';}catch(e){return false;}}" +
    "(function(){try{var p=new URLSearchParams(location.search);if(p.get('nb_owner')==='1'){localStorage.setItem('nb_internal','1');history.replaceState(null,'',location.pathname);}}catch(e){}" +
    "gtag('js',new Date());if(nbInternal()){gtag('config','" + GA_ID + "',{traffic_type:'internal'});}else{gtag('config','" + GA_ID + "');}})();" +
    "function trackEvent(name,params){if(nbInternal())return;if(typeof gtag==='function')gtag('event',name,params||{});}",
  "document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;" +
    "var href=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(href))return;" +
    "try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;" +
    "trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);",
  '</script>',
];

/** GA4 の head スニペット。comment:false で先頭の `<!-- Google Analytics 4 -->` を省く */
function gaSnippet(opts) {
  const withComment = !(opts && opts.comment === false);
  return (withComment ? LINES : LINES.slice(1)).join('\n');
}

module.exports = { GA_ID, gaSnippet };
