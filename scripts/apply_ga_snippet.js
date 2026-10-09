#!/usr/bin/env node
/**
 * apply_ga_snippet.js
 *
 * 既にある静的ページ（features/・journal/・ルート直下の静的ページ・stores/index.html）の GA4 スニペットを、
 * scripts/lib/ga_snippet.js の出力にそろえる（SEO-144・冪等）。
 *
 * 背景: オーナー除外つきの旧スニペット（features・journal の55本と stores/index.html 等）は localStorage の
 * 読み書きを try/catch で囲んでおらず、サイトデータを拒否した端末では例外で gtag('config') まで止まっていた。
 * 生成器は SEO-138 で ga_snippet.js の1本に寄せたが、再生成されない静的ページは古いままだった。
 * オーナー除外の無い旧スニペット（features・journal の169本とルート直下の4本）もそろえ、どのページでも
 * ?nb_owner=1 の除外が効くようにする（docs/ga4-internal-traffic-verification.md）。
 *
 * 置き換えるのは、GA の読み込みタグの直後の <script> が、下の旧スニペット2種のどちらかと完全に一致する
 * ときだけ。知らない形（ほかの処理が混ざっている等）は触らずに報告する（消してはいけない処理を巻き込まない）。
 * index.html は独自のイベント処理（NB_ENGAGEMENT_EVENTS 等）を同じ <script> に持つため対象外（手で直す）。
 *
 * 使い方:
 *   node scripts/apply_ga_snippet.js            # 置き換える
 *   node scripts/apply_ga_snippet.js --dry-run  # 置き換える本数だけ出す
 *   node scripts/apply_ga_snippet.js --check    # 旧スニペットか知らない形が残っていれば exit 1
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { GA_ID, gaSnippet } = require('./lib/ga_snippet');

const ROOT = path.join(__dirname, '..');
const LOADER = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_ID + '"></script>';
const CANON = gaSnippet({ comment: false });
const CANON_INLINE = CANON.slice(CANON.indexOf('<script>'));

// 旧スニペット（2026-10-09 時点で features・journal・ルート直下・stores/index.html にあった2種）
const LEGACY = [
  {
    name: 'オーナー除外つき（localStorage を囲んでいない）',
    inline: "<script>\nwindow.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}(function(){var p=new URLSearchParams(location.search);if(p.get('nb_owner')==='1'){localStorage.setItem('nb_internal','1');history.replaceState(null,'',location.pathname);}if(localStorage.getItem('nb_internal')==='1'){gtag('js',new Date());gtag('config','G-3LCZNGZPWJ',{traffic_type:'internal'});}else{gtag('js',new Date());gtag('config','G-3LCZNGZPWJ');}})();function trackEvent(name,params){if(localStorage.getItem('nb_internal')==='1')return;if(typeof gtag==='function')gtag('event',name,params||{});}\ndocument.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(href))return;try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);\n</script>",
  },
  {
    name: 'オーナー除外なし',
    inline: "<script>\nwindow.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-3LCZNGZPWJ');\nfunction trackEvent(name,params){if(typeof gtag==='function')gtag('event',name,params||{});}\ndocument.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(href))return;try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);\n</script>",
  },
];

/** 対象のページ（相対パス）。index.html は対象外 */
function targets(root = ROOT) {
  const out = [];
  for (const dir of ['features', 'journal']) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.html')) out.push(path.join(dir, f));
  }
  for (const f of fs.readdirSync(root).sort()) if (f.endsWith('.html') && f !== 'index.html') out.push(f);
  if (fs.existsSync(path.join(root, 'stores', 'index.html'))) out.push(path.join('stores', 'index.html'));
  return out;
}

/**
 * ページの GA スニペットを判定し、旧スニペットなら置き換えた HTML を返す（純関数・テスト対象）。
 * kind: none（GA なし）/ canonical / legacy / unknown
 */
function classify(html) {
  const i = html.indexOf(LOADER);
  if (i < 0) return { kind: 'none' };
  if (html.indexOf(LOADER, i + LOADER.length) >= 0) return { kind: 'unknown', reason: 'GA の読み込みタグが2つある' };
  const after = i + LOADER.length;
  const m = /^\s*<script>/.exec(html.slice(after));
  if (!m) return { kind: 'unknown', reason: '読み込みタグの直後に <script> が無い' };
  const s = after + m[0].length - '<script>'.length;
  const e = html.indexOf('</script>', s);
  if (e < 0) return { kind: 'unknown', reason: '<script> が閉じていない' };
  const inline = html.slice(s, e + '</script>'.length);
  if (inline === CANON_INLINE) return { kind: 'canonical' };
  const legacy = LEGACY.find((l) => l.inline === inline);
  if (!legacy) return { kind: 'unknown', reason: '知らない形の GA スニペット' };
  return { kind: 'legacy', legacy: legacy.name, next: html.slice(0, s) + CANON_INLINE + html.slice(e + '</script>'.length) };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const dry = args.includes('--dry-run');
  const count = { none: 0, canonical: 0, legacy: 0, unknown: 0 };
  const byLegacy = {};
  for (const rel of targets()) {
    const file = path.join(ROOT, rel);
    const html = fs.readFileSync(file, 'utf8');
    const r = classify(html);
    count[r.kind]++;
    if (r.kind === 'unknown') console.log(`  ? ${rel}: ${r.reason}（触っていない）`);
    if (r.kind !== 'legacy') continue;
    byLegacy[r.legacy] = (byLegacy[r.legacy] || 0) + 1;
    if (check || dry) { console.log(`  旧スニペット ${rel}（${r.legacy}）`); continue; }
    fs.writeFileSync(file, r.next);
  }
  const verb = check || dry ? '旧スニペット' : 'そろえた';
  console.log(`GA スニペット: ${verb} ${count.legacy} 本（${Object.entries(byLegacy).map(([k, n]) => `${k} ${n}`).join('・') || '—'}）/ そろっている ${count.canonical} 本 / 知らない形 ${count.unknown} 本 / GA なし ${count.none} 本`);
  if (check && (count.legacy || count.unknown)) process.exit(1);
}

if (require.main === module) main();
module.exports = { LOADER, CANON_INLINE, LEGACY, targets, classify };
