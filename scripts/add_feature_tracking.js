#!/usr/bin/env node
// SEO-086: 特集ページのイベント計測を補完する後処理スクリプト
//
// 対象: features/*.html のうち refresh_feature_rosters.js の管理外（feature_rosters.json 未掲載）
//       または月次再構成で消えないセクション（topcta / related-links）
//
// 付与するイベント:
//   - cta_click      : hotpepper.jp へのリンク（GASが予約行動として集計）
//   - feature_store_click : stores/J*.html への内部リンク
//   - internal_link_click : .related-links 内の特集リンク（block:'feature_related'）
//   - scroll_depth   : 25/50/75/100% 到達（特集ページで未測定）
//
// 運用: --check で違反ゼロ確認（機械検査）、引数なしで修正適用（冪等）
//   node scripts/add_feature_tracking.js [--check] [--only <slug>]

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');

const CHECK_ONLY = process.argv.includes('--check');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1] : null;
})();

// scroll_depth スクリプトブロック（journal の SEO-052 と同一パターン）
const SCROLL_DEPTH_SCRIPT = `<script class="nb-engagement-tracking">
(function(){
  var fired={},THRESH=[25,50,75,100];
  function check(){
    var doc=document.documentElement;
    var top=window.pageYOffset||doc.scrollTop;
    var max=(doc.scrollHeight-doc.clientHeight)||1;
    var pct=Math.min(100,Math.round((top/max)*100));
    THRESH.forEach(function(t){if(pct>=t&&!fired[t]){fired[t]=true;try{trackEvent('scroll_depth',{percent:t});}catch(err){}}});
  }
  var timer=null;
  window.addEventListener('scroll',function(){if(timer)return;timer=setTimeout(function(){timer=null;check();},200);},{passive:true});
  check();
})();
</script>`;

// アンカーに onclick を追加（既存がなければ）
function addOnclick(tag, eventCall) {
  // すでに onclick があれば変更しない
  if (/\bonclick=/i.test(tag)) return tag;
  // </a> より前の > を見つけて onclick を挿入
  return tag.replace(/>$/, ` onclick="${eventCall}">`);
}

// href から store ID を抽出
function extractStoreId(href) {
  const m = href.match(/stores\/(J\w+)\.html/) || href.match(/hotpepper\.jp\/str(J\w+)/);
  return m ? m[1] : '';
}

// features のスラグを得る
function slugOf(fname) {
  return path.basename(fname, '.html');
}

let issues = 0;
let fixed = 0;

function processFile(fpath) {
  const slug = slugOf(fpath);
  let html = fs.readFileSync(fpath, 'utf8');
  const original = html;

  // ── 1. hotpepper.jp リンクに cta_click を付与 ──
  html = html.replace(/<a\s+([^>]*href=["']https?:\/\/(?:www\.)?hotpepper\.jp\/str(J\w+)[^"']*["'][^>]*)>/gi, (match, attrs, id) => {
    if (/\bcta_click\b/.test(attrs)) return match; // 既存
    const storeJs = id;
    const eventCall = `trackEvent('cta_click',{store:'${storeJs}',feature:'${slug}',target:'hotpepper'})`;
    return match.replace(/>$/, ` onclick="${eventCall}">`);
  });

  // ── 2. stores/J*.html リンクに feature_store_click を付与 ──
  html = html.replace(/<a\s+([^>]*href=["'][^"']*\/stores\/(J\w+)\.html[^"']*["'][^>]*)>/gi, (match, attrs, id) => {
    if (/\bfeature_store_click\b/.test(attrs)) return match; // 既存
    const eventCall = `trackEvent('feature_store_click',{store:'${id}',feature:'${slug}'})`;
    return match.replace(/>$/, ` onclick="${eventCall}">`);
  });

  // ── 3. .related-links a に internal_link_click を付与 ──
  // .related-links ブロック内のアンカーを対象にする
  html = html.replace(/(<div class="related-links"[^>]*>)([\s\S]*?)(<\/div>)/gi, (block, open, inner, close) => {
    const newInner = inner.replace(/<a\s+([^>]*)href=["']([^"']+)["']([^>]*)>/gi, (atag, pre, href, post) => {
      const full = atag;
      if (/\binternal_link_click\b/.test(full)) return full; // 既存
      if (/\boutbound_click\b/.test(full)) return full; // 他の計測が既にある
      const linkText = href.replace(/.*\//, '').replace(/\.html$/, '');
      const eventCall = `trackEvent('internal_link_click',{feature:'${slug}',link_url:'${href}',block:'feature_related'})`;
      return `<a ${pre}href="${href}"${post} onclick="${eventCall}">`;
    });
    return open + newInner + close;
  });

  // ── 4. scroll_depth がなければ </body> 直前に挿入 ──
  if (!html.includes('scroll_depth')) {
    html = html.replace(/<\/body>/, `${SCROLL_DEPTH_SCRIPT}\n</body>`);
  }

  if (html !== original) {
    if (CHECK_ONLY) {
      console.log(`[NEEDS UPDATE] ${path.relative(ROOT, fpath)}`);
      issues++;
    } else {
      fs.writeFileSync(fpath, html, 'utf8');
      console.log(`[UPDATED] ${path.relative(ROOT, fpath)}`);
      fixed++;
    }
  }
}

// ── 機械検査: stores/J*.html または hotpepper.jp リンクを持つのに集計対象イベントが無いファイル ──
function checkMachineCheck() {
  const TARGET_EVENTS = ['cta_click', 'cta_reserve', 'modal_open', 'feature_store_click'];
  const failing = [];
  for (const fname of fs.readdirSync(FEATURES_DIR).sort()) {
    if (!fname.endsWith('.html')) continue;
    const fpath = path.join(FEATURES_DIR, fname);
    const content = fs.readFileSync(fpath, 'utf8');
    const hasStoreLink = /stores\/J\w+\.html|hotpepper\.jp\/str/.test(content);
    if (!hasStoreLink) continue;
    const hasTarget = TARGET_EVENTS.some(ev => content.includes(ev));
    if (!hasTarget) failing.push(fname);
  }
  return failing;
}

// メイン
const files = fs.readdirSync(FEATURES_DIR)
  .filter(f => f.endsWith('.html') && (!ONLY || f.startsWith(ONLY)))
  .map(f => path.join(FEATURES_DIR, f));

for (const f of files) processFile(f);

const failing = checkMachineCheck();
if (failing.length > 0) {
  console.log(`\n[機械検査] ストア/ホットペッパーリンクあり・集計対象イベントなし: ${failing.length}件`);
  for (const f of failing) console.log(`  ${f}`);
  if (CHECK_ONLY) process.exit(1);
} else {
  console.log(`\n[機械検査] OK — ストア/ホットペッパーリンクを持つ全特集に集計対象イベントあり`);
}

if (CHECK_ONLY) {
  if (issues > 0) {
    console.log(`\n要更新: ${issues}件`);
    process.exit(1);
  }
} else {
  console.log(`\n更新: ${fixed}件`);
}
