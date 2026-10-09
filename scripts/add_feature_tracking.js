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
//   - 予約送客の語彙統一（ISSUE-149）: 旧形式 cta_click{store,feature,target} を
//     nbReserveExit 経由の cta_click{store_name,store_id,link_domain,location,feature} に書き換え、
//     予約申告プロンプト（scripts/lib/reservation_ask_snippet.js）を </body> 直前に入れる
//
// 運用: --check で違反ゼロ確認（機械検査）、引数なしで修正適用（冪等）。build.yml が特集を書き換えるステップの
//       最後に日次で適用し、夜間QA が --check を soft で回す（ISSUE-153）
// 計測の文字列は scripts/lib/feature_tracking.js の1本。区画を作り直す生成器（add_feature_top_cta.js・
// apply_feature_conclusions.js・refresh_feature_rosters.js）も同じ部品で書くので、ここで足した計測が消えない
//   node scripts/add_feature_tracking.js [--check] [--only <slug>]

'use strict';
const { reserveExitOnclick, featureStoreOnclick, withReserveAsk } = require('./lib/feature_tracking');

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

// ホットペッパーID ⇔ 店名（旧形式は store に ID か店名のどちらかを入れていた）
const STORES = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8')); } catch (e) { return []; } })();
const NAME_BY_ID = new Map(STORES.filter(s => s['ホットペッパーID']).map(s => [s['ホットペッパーID'], s['店名'] || '']));
const ID_BY_NAME = new Map(STORES.filter(s => s['ホットペッパーID']).map(s => [s['店名'], s['ホットペッパーID']]));
// 旧形式の store:'…' の中身（\' でエスケープ済み）を素の文字列に戻す
function unq(v) { return String(v).replace(/\\'/g, "'").replace(/\\\\/g, '\\'); }

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

/** 1本の特集の HTML に足りない計測と予約申告プロンプトを足して返す（純関数・冪等） */
function processHtml(html, slug) {

  // ── 1. hotpepper.jp リンクに予約送客の cta_click を付与 ──
  html = html.replace(/<a\s+([^>]*href=["']https?:\/\/(?:www\.)?hotpepper\.jp\/str(J\w+)[^"']*["'][^>]*)>/gi, (match, attrs, id) => {
    if (/\bcta_click\b/.test(attrs)) return match; // 既存（旧形式は 1b で書き換える）
    if (/\bonclick=/i.test(attrs)) return match;
    return match.replace(/>$/, ` onclick="${reserveExitOnclick(NAME_BY_ID.get(id) || '', id, slug)}">`);
  });

  // ── 1b. 旧形式 trackEvent('cta_click',{store:'…',feature:'…',target:'hotpepper'}) を書き換え（ISSUE-149） ──
  html = html.replace(/trackEvent\('cta_click',\{store:'((?:\\'|[^'])*)',feature:'([^']*)',target:'hotpepper'\}\)/g, (m, store, feat) => {
    const v = unq(store);
    const isId = /^J\d+$/.test(v);
    const name = isId ? (NAME_BY_ID.get(v) || '') : v.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const id = isId ? v : (ID_BY_NAME.get(name) || '');
    return reserveExitOnclick(name, id, feat || slug);
  });

  // ── 2. stores/J*.html リンクに feature_store_click を付与 ──
  html = html.replace(/<a\s+([^>]*href=["'][^"']*\/stores\/(J\w+)\.html[^"']*["'][^>]*)>/gi, (match, attrs, id) => {
    if (/\bfeature_store_click\b/.test(attrs)) return match; // 既存
    const eventCall = featureStoreOnclick(id, slug);
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

  // ── 4a. 予約申告プロンプト（予約導線を持つ特集だけ） ──
  html = withReserveAsk(html);

  // ── 4. scroll_depth がなければ </body> 直前に挿入 ──
  if (!html.includes('scroll_depth')) {
    html = html.replace(/<\/body>/, `${SCROLL_DEPTH_SCRIPT}\n</body>`);
  }

  return html;
}

function processFile(fpath) {
  const slug = slugOf(fpath);
  const original = fs.readFileSync(fpath, 'utf8');
  const html = processHtml(original, slug);
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

function main() {
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
}

if (require.main === module) main();

module.exports = { processHtml, SCROLL_DEPTH_SCRIPT };
