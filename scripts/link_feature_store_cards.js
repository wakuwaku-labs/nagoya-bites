#!/usr/bin/env node
/**
 * link_feature_store_cards.js — 特集の店カードと店舗ページのつながりを直す（冪等・通信しない）。
 *
 *   1. 店舗ページ（stores/*.html）が実在するのに、特集の店カードにリンクが無い店へ「詳細ページを見る」を足す。
 *      ひも付けは scripts/lib/feature_card_links.js の厳しい照合（完全一致、または先頭一致で1店だけ）。
 *      結べない店・店舗ページが無い店（新店など）には何もしない。
 *   2. 店一覧の構造化データ（ItemList）の url の無い項目に、同じページの店カードのリンク先を入れる。
 *      実在する店舗ページの URL だけ。結べない項目は url を付けない。
 *
 * 月次の店の入れ替え（refresh_feature_rosters.js）は自分で店カードも ItemList の url も書くので、この変換と行き来しない。
 * 入れ替えの対象外の手書きの特集は、build.yml が毎日この変換を通すので、後から足した店にも同じ規則で効く。
 *
 *   node scripts/link_feature_store_cards.js            # 適用
 *   node scripts/link_feature_store_cards.js --check    # 直す物があれば exit 1（書かない）
 *   node scripts/link_feature_store_cards.js --only <slug>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadStores } = require('./lib/load_stores');
const { buildStrictResolver, linkCards, addItemListUrls, rebuildItemListFromCards } = require('./lib/feature_card_links');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');

/** 1ページ分の変換（純関数。ctx = { resolve, root }） */
function processHtml(html, featureSlug, ctx) {
  const a = linkCards(html, featureSlug, ctx);
  let b = addItemListUrls(a.html, ctx);
  let rebuilt = false;
  if (b.skipped.length) {
    // 店カードが全部リンク済みで、ItemList だけが古い店のまま → 店カードから作り直す
    const r = rebuildItemListFromCards(a.html, ctx);
    if (r.rebuilt) { b = { html: r.html, added: [], skipped: [] }; rebuilt = true; }
  }
  return { html: b.html, linked: a.added, linkSkipped: a.skipped, urls: b.added, urlSkipped: b.skipped, rebuilt };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? args[oi + 1] : null;
  const ctx = { resolve: buildStrictResolver(loadStores()), root: ROOT };
  let pending = 0;
  let linked = 0;
  let urls = 0;
  const notes = [];
  for (const f of fs.readdirSync(FEATURES_DIR).filter((x) => x.endsWith('.html') && x !== 'index.html').sort()) {
    const slug = f.replace(/\.html$/, '');
    if (only && only !== slug) continue;
    const file = path.join(FEATURES_DIR, f);
    const html = fs.readFileSync(file, 'utf8');
    const r = processHtml(html, slug, ctx);
    for (const s of r.linkSkipped) notes.push(`  - ${slug}: リンクなし・結ばない（${s.reason}）: ${s.name}`);
    for (const s of r.urlSkipped) notes.push(`  - ${slug}: ItemList の url なし（店カードと結べない）: ${s}`);
    if (r.html === html) continue;
    pending++;
    if (r.rebuilt) notes.push(`  - ${slug}: ItemList が画面の店と違っていたので、店カードから作り直した`);
    linked += r.linked.length;
    urls += r.urls.length;
    if (!check) fs.writeFileSync(file, r.html);
    console.log(`${check ? '要修正' : '修正'} ${f}: リンク ${r.linked.length} 件・ItemList の url ${r.urls.length} 件`);
  }
  if (notes.length) console.log(notes.join('\n'));
  console.log(`${check ? '直す物' : '直した物'}: ${pending} ページ（店カードのリンク ${linked}・ItemList の url ${urls}）`);
  if (check && pending) process.exit(1);
}

if (require.main === module) main();
module.exports = { processHtml };
