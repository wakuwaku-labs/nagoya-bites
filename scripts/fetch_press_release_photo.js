#!/usr/bin/env node
'use strict';
/**
 * プレスリリースの報道用画像を取得する（CLAUDE.md 写真ソースの優先順・優先3）
 *
 * 【なぜ存在するか】
 *   新店記事は「実写が1枚も無い」状態になりやすい。開店直後の店は HotPepper に写真がなく、
 *   Google Places にも口コミ写真しか無いことが多い。2026-08-17 はまさにこれで、
 *   実写が取れなかった結果、記事に一行触れただけの別店の販促バナーが記事の顔になった。
 *   一方で新店・新メニューはほぼ必ずプレスリリースが出ており、そこには
 *   プロが撮った外観・料理の高解像度写真がある。
 *
 * 【規約上の根拠】
 *   PR TIMES 企業規約 第6条3項:
 *     ご利用企業は、パートナーメディアと報道関係者に対し、報道目的で利用する限り、
 *     企業コンテンツを無償で非独占的に利用することを許諾する
 *     （パートナーメディア以外において有償目的で利用する行為を除く）
 *   NAGOYA BITES は広告ゼロ・PR記事ゼロのため「有償目的」に当たらない。
 *   利用は報道目的に限り、加工せず、self-host せず参照に留める（docs/journal-photo-sources-setup.md）。
 *
 * 使い方:
 *   node scripts/fetch_press_release_photo.js <リリースURL>
 *   node scripts/fetch_press_release_photo.js <リリースURL> --json
 *
 * 出力: 画像候補（URL・実寸・種別の推定）。generate_daily_draft.js から呼ばれる。
 */

const https = require('https');

/** 対応する配信元。ここに無いドメインは「規約未確認」として扱い、採用しない。 */
const SUPPORTED = [
  {
    id: 'prtimes',
    host: /(^|\.)prtimes\.jp$/,
    label: 'PR TIMES',
    // 規約で報道目的の無償利用が明示的に許諾されている（企業規約 第6条3項）
    reportingUseGranted: true,
    imageHost: /prcdn\.freetls\.fastly\.net|prtimes\.jp\/i\//,
  },
];

function providerFor(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  return SUPPORTED.find(p => p.host.test(host)) || null;
}

function get(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 4) return reject(new Error('リダイレクトが多すぎます'));
    https.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'NAGOYA-BITES-editorial/1.0 (+https://nagoya-bites.com)' },
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return get(new URL(res.headers.location, url).href, depth + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; });
      res.on('end', () => resolve(body));
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

/**
 * リリース本文から画像候補を抜き出す。
 *
 * PR TIMES の本文画像は `.../release_image/<company>/<release>/<hash>-<W>x<H>.jpg` の形で、
 * ファイル名に実寸が入っている。ここから「大きいものほど本編の写真（＝小さいものはロゴや
 * アイコン）」という当たりを付ける。実寸は URL に書かれた事実なので、後から検算できる。
 */
function extractImages(html, provider) {
  const found = new Map(); // url -> {w,h}
  const re = /https?:\/\/[^"'\s)]+?\.(?:jpe?g|png)/gi;
  for (const raw of html.match(re) || []) {
    const url = raw.replace(/&amp;/g, '&');
    if (!provider.imageHost.test(url)) continue;
    const m = url.match(/-(\d{2,5})x(\d{2,5})\.(?:jpe?g|png)$/i);
    const w = m ? parseInt(m[1], 10) : null;
    const h = m ? parseInt(m[2], 10) : null;
    if (!found.has(url)) found.set(url, { w, h });
  }
  return Array.from(found, ([url, d]) => ({ url, width: d.w, height: d.h }));
}

/** 発行企業名（クレジット表記に使う。出所を書けない写真は載せないため必須） */
function extractCompany(html) {
  const patterns = [
    /<meta[^>]+property="article:author"[^>]+content="([^"]+)"/i,
    /"author"\s*:\s*{[^}]*"name"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+name="author"[^>]+content="([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

/**
 * ヒーローに向く1枚を選ぶ。
 *
 * 「目を引く写真」を機械で判定することは断念済み（2026-08-17 に実店舗写真46枚で実測し、
 * 料理写真とバナーを画素特徴で分離できないことを確認。data/journal_photo_policy.json 参照）。
 * よってここでも中身の良し悪しは判定しない。**URL に書かれた実寸という事実**だけで、
 * 明らかにヒーローに使えないもの（ロゴ・アイコン・バナー帯）を外し、残りを大きい順に返す。
 * どれを使うかの最終判断は Editor の目に委ねる（CLAUDE.md 制約10）。
 */
function rankForHero(images) {
  return images
    .filter(im => {
      if (!im.width || !im.height) return false;          // 実寸が読めないものは採らない
      if (im.width < 800) return false;                    // ヒーローは全幅表示のため
      const ratio = im.width / im.height;
      if (ratio < 0.9) return false;                       // 縦長はヒーロー枠に合わない
      if (ratio > 3.2) return false;                       // 極端な横長＝バナー帯の可能性が高い
      return true;
    })
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));
}

async function fetchPressReleasePhotos(releaseUrl) {
  const provider = providerFor(releaseUrl);
  if (!provider) {
    throw new Error(
      `対応していない配信元です: ${releaseUrl}\n` +
      `  報道用画像として使えるのは、報道目的の利用が規約で明示的に許諾されている配信元だけです。\n` +
      `  現在の対応: ${SUPPORTED.map(p => p.label).join(' / ')}\n` +
      `  （規約を確認していない配信元の画像を「報道だから使える」と推定して使わないこと）`
    );
  }
  const html = await get(releaseUrl);
  const images = extractImages(html, provider);
  const ranked = rankForHero(images);
  return {
    provider: provider.id,
    providerLabel: provider.label,
    releaseUrl,
    company: extractCompany(html),
    all: images,
    heroCandidates: ranked,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(a => !a.startsWith('--'));
  if (!url) {
    console.error('使い方: node scripts/fetch_press_release_photo.js <リリースURL> [--json]');
    process.exit(2);
  }
  const result = await fetchPressReleasePhotos(url);

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`配信元: ${result.providerLabel}（報道目的の無償利用が規約で許諾済み）`);
  console.log(`発行企業: ${result.company || '(取得できず — クレジットに書く企業名を手で確認すること)'}`);
  console.log(`リリース: ${result.releaseUrl}`);
  console.log(`\n画像 ${result.all.length}件 / ヒーロー候補 ${result.heroCandidates.length}件\n`);
  result.heroCandidates.forEach((im, i) => {
    console.log(`  ${i + 1}. ${im.width}x${im.height}`);
    console.log(`     ${im.url}`);
  });
  if (!result.heroCandidates.length) {
    console.log('  ヒーローに使える大きさの画像がありません（ロゴ・バナー帯のみの可能性）。');
    console.log('  → 他の優先順を試すか、記事固有のイメージ図に倒してください。');
  }
  console.log(`\n使うときの条件（docs/journal-photo-sources-setup.md）:`);
  console.log(`  ・記事の sources[] にこのリリースURLを必ず入れる（ゲートが照合します）`);
  console.log(`  ・クレジットに発行企業名とリリースURLを明記する`);
  console.log(`  ・加工しない / self-host しない（参照に留める）`);
  console.log(`  ・CGパースは実写として扱わない（キャプションに「イメージパース」と明記）`);
}

if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { fetchPressReleasePhotos, providerFor, extractImages, rankForHero };
