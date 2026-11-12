#!/usr/bin/env node
/**
 * scripts/add_hp_credit_legacy.js
 *
 * 旧形式の店舗ページ（共通フッターの印 NB-CHROME:FOOTER が無く、転送でもない stores/*.html）に、
 * ホットペッパーグルメ Webサービスの利用規約が求めるクレジットを足す（SEO 改善 項目1 の取りこぼし）。
 *   - 「Powered by ホットペッパーグルメ Webサービス」
 *   - HP の画像（imgfp.hotp.jp）を表示するページだけ「【画像提供：ホットペッパー グルメ】」
 * 文言は scripts/lib/site_chrome.js の renderCredit と同じ。べき等・通信しない。
 *
 *   node scripts/add_hp_credit_legacy.js          # 反映
 *   node scripts/add_hp_credit_legacy.js --check  # 要変更があれば終了コード 1（書かない）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { renderCredit } = require('./lib/site_chrome');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const MARK = 'webservice.recruit.co.jp';

function legacyCreditFor(html) {
  if (html.includes(MARK)) return null; // 済み
  if (html.includes('NB-CHROME:FOOTER:START')) return null; // 共通フッターのページは別の仕組み
  if (/http-equiv="refresh"/i.test(html)) return null; // 転送だけのページ
  if (html.includes('nb-orphan-notice:')) return null; // 「掲載していません」の案内だけのページ（HP のデータ・画像を使わない）
  const m = html.match(/<footer>\s*<p class="fc">[^<]*(?:<[^>]+>[^<]*)*?<\/p>/);
  if (!m) return { error: 'footer' };
  const usesImage = /imgfp\.hotp\.jp/.test(html.slice(0, m.index));
  const line = renderCredit(usesImage ? 'api+image' : 'api').trim().replace('class="nb-footer-credit"', 'class="fc"');
  return { at: m.index + m[0].length, line };
}

let changed = 0, errors = 0;
const dir = path.join(ROOT, 'stores');
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
  const p = path.join(dir, f);
  const html = fs.readFileSync(p, 'utf8');
  const r = legacyCreditFor(html);
  if (!r) continue;
  if (r.error) { errors++; console.error('footer が見つからない: stores/' + f); continue; }
  changed++;
  if (!CHECK) fs.writeFileSync(p, html.slice(0, r.at) + '\n  ' + r.line + html.slice(r.at));
}
console.log(`add_hp_credit_legacy: ${CHECK ? '要変更' : '変更'}=${changed} エラー=${errors}`);
process.exit(CHECK && changed ? 1 : errors ? 1 : 0);
