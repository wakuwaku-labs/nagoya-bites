#!/usr/bin/env node
/**
 * add_journal_engagement_tracking.js  (SEO-052)
 *
 * ジャーナル記事 HTML の </body> 直前に、内部リンク（関連記事ブロック）の
 * クリックとスクロール到達（25/50/75/100%）を計測する <script> を挿入する。
 *
 * 新規記事は journal/_template.html に直接焼き込み済み（generate_daily_draft.js が
 * このテンプレートから生成するため自動で入る）。本スクリプトは既存記事への後追い適用のみ。
 *
 * - 冪等: class="nb-engagement-tracking" が既存のファイルはスキップ
 * - 引数に複数ファイルを渡してバッチ適用可
 * - 失敗しても exit 1 にしない（run_journal_local.sh 等から非ブロッキングで呼ぶ想定）
 *
 * 使用例:
 *   node scripts/add_journal_engagement_tracking.js journal/2026-08-*.html
 *   node scripts/add_journal_engagement_tracking.js $(ls journal/*.html | grep -v _template)
 */

'use strict';
const fs = require('fs');

const MARKER = 'nb-engagement-tracking';
const ANCHOR = '</body>';
const SNIPPET =
`<!-- SEO-052: 内部リンク（関連記事ブロック）のクリックとスクロール到達を計測。
     回遊アドバイスの採否を体感でなく実データで判定できるようにする -->
<script class="${MARKER}">
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('.related-link');if(!a)return;try{trackEvent('internal_link_click',{link_url:a.getAttribute('href')||'',link_text:(a.innerText||a.textContent||'').trim().slice(0,80),block:'related'});}catch(err){}},true);
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
</script>
`;

const files = process.argv.slice(2).filter(f => f && f.endsWith('.html') && !f.endsWith('_template.html'));

if (files.length === 0) {
  console.log('add_journal_engagement_tracking: 対象ファイルなし（引数なし）');
  process.exit(0);
}

let modified = 0;
let skipped = 0;
let errored = 0;

for (const file of files) {
  try {
    if (!fs.existsSync(file)) {
      console.error(`SKIP (not found): ${file}`);
      skipped++;
      continue;
    }
    let html = fs.readFileSync(file, 'utf8');
    if (html.includes(MARKER)) {
      console.log(`SKIP (already present): ${file}`);
      skipped++;
      continue;
    }
    const idx = html.lastIndexOf(ANCHOR);
    if (idx === -1) {
      console.log(`SKIP (</body> not found): ${file}`);
      skipped++;
      continue;
    }
    html = html.slice(0, idx) + SNIPPET + html.slice(idx);
    fs.writeFileSync(file, html, 'utf8');
    console.log(`OK: ${file}`);
    modified++;
  } catch (e) {
    console.error(`ERROR: ${file}: ${e.message}`);
    errored++;
  }
}

console.log(`add_journal_engagement_tracking: modified=${modified} skipped=${skipped} errored=${errored}`);
