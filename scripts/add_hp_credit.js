#!/usr/bin/env node
/**
 * scripts/add_hp_credit.js
 *
 * ホットペッパーグルメ Webサービスの利用規約が求める表示を、生成済みの HTML のフッターへ足す。
 *   - 「Powered by ホットペッパーグルメ Webサービス」（リンク先 https://webservice.recruit.co.jp/）
 *   - 画像を使うページだけ「【画像提供：ホットペッパー グルメ】」
 * 何をどのページに出すかの決まりは scripts/lib/site_chrome.js の creditModeFor（正本）。
 * べき等（何度流しても同じ結果）。通信しない。フッターのブロック（NB-CHROME:FOOTER）だけを書き換える。
 *
 * 毎日の生成（gen-store-pages.js・gen_area_genre_pages.js）と apply_site_chrome.js が同じ表示を出すので、
 * このスクリプトは、生成を流さずに既存のファイルへ反映したいとき・取りこぼしを直すときに使う。
 *
 *   node scripts/add_hp_credit.js            # 反映
 *   node scripts/add_hp_credit.js --check    # 変更が要るページがあれば終了コード 1（書かない）
 *   node scripts/add_hp_credit.js --count    # 種別ごとの全ページ数とクレジットのあるページ数
 */
'use strict';

const fs = require('fs');
const path = require('path');
const chrome = require('./lib/site_chrome');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const COUNT = args.includes('--count');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (f.endsWith('.html')) out.push(p);
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

function targets() {
  const root = ['index.html'].map(f => path.join(ROOT, f)).filter(fs.existsSync);
  const dirs = ['stores', 'features', 'journal'].flatMap(d => walk(path.join(ROOT, d)));
  return [...root, ...dirs].filter(f => !path.basename(f).startsWith('_') || rel(f) === 'journal/_template.html');
}

function kindOf(r) {
  if (r.startsWith('stores/area/')) return 'area';
  if (r.startsWith('stores/')) return 'stores';
  if (r.startsWith('features/')) return 'features';
  if (r.startsWith('journal/')) return 'journal';
  return 'root';
}

const stats = {};
let changed = 0;
for (const f of targets()) {
  const r = rel(f);
  const html = fs.readFileSync(f, 'utf8');
  // フッターの無いページ（移転の転送ページなど）は対象外
  if (!html.includes(chrome.MARK('FOOTER', 'START'))) continue;
  const next = chrome.applyCredit(html, r);
  const s = (stats[kindOf(r)] ||= { pages: 0, expected: 0, with_credit: 0, with_image_notice: 0 });
  s.pages++;
  if (chrome.creditModeFor(r, html) !== 'none') s.expected++;
  if (/class="nb-footer-credit"/.test(next)) s.with_credit++;
  if (next.includes('【画像提供：ホットペッパー グルメ】')) s.with_image_notice++;
  if (next !== html) {
    changed++;
    if (!CHECK && !COUNT) fs.writeFileSync(f, next, 'utf8');
  }
}
if (COUNT) console.log(JSON.stringify(stats, null, 2));
else console.log(`${CHECK ? '要変更' : '変更'}: ${changed} ページ`);
if (CHECK && changed > 0) process.exit(1);
