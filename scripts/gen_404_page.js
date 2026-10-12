'use strict';

/**
 * scripts/gen_404_page.js
 *
 * 404.html の生成器（I-33・P-316）。
 *
 * GitHub Pages は、存在しない URL に対して、サイト直下の 404.html を HTTP 404 のまま返す。
 * どの深さの URL（/features/xxx/yyy など）でも同じ文書が返るので、リンクと資産はすべて
 * 「/」で始まる絶対パスにする（共通クロームの base 指定・scripts/lib/site_chrome.js）。
 * 相対パスのままだと、深い URL で CSS もリンクも外れる。
 *
 * 作り方は他のページと同じ（制約12）:
 *   - ヘッダー・フッター・開閉スクリプトは scripts/lib/site_chrome.js（唯一の正本）
 *   - GA4 は scripts/lib/ga_snippet.js（唯一の正本）。壊れた内部リンクのアドレスが
 *     page_view に残るので、GA4 の「ページタイトル」で探せる
 *   - Web フォントは読み込まない（P-318・判断の記録 0026）。書体は nb.css のトークン（var(--font-*)）で指す
 *   - 文字サイズ・間隔・色は nb.css のトークンだけを使う
 * 検索には出さない（noindex）。sitemap.xml・llms.txt には入れない。
 *
 * 使い方:
 *   node scripts/gen_404_page.js            404.html を書く
 *   node scripts/gen_404_page.js --check    404.html が生成物と一致するか（違えば exit 1・CI 向け）
 *
 * 共通クロームや GA4 の部品、nb.css のトークンを変えたら、このスクリプトを実行して 404.html を作り直す
 * （tests/not_found_page.test.js が、生成物とのずれを npm test で止める）。
 */

const fs = require('fs');
const path = require('path');
const chrome = require('./lib/site_chrome');
const { gaSnippet } = require('./lib/ga_snippet');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '404.html');
const DS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/design_system.json'), 'utf8'));

// 戻り先。どれも根からの絶対パス。順番はそのまま画面の並び（主な行き先 → 補助の行き先）
const ACTIONS = [
  { href: '/index.html', label: '店舗を検索する', cls: 'nb-btn nb-btn--primary', to: 'search' },
  { href: '/stores/area/index.html', label: 'エリアから探す', cls: 'nb-btn nb-btn--secondary', to: 'area' },
];
const MORE = { href: '/features/index.html', label: '特集記事を読む', to: 'features' };

function track(to, href) {
  return `onclick="trackEvent('internal_link_click',{link_url:'${href}',block:'not_found',to:'${to}'})"`;
}

function render() {
  const header = chrome.renderHeader({ depth: 0, active: null, main: false, base: '/' });
  const footer = chrome.renderFooter({ depth: 0, main: false, base: '/' });
  const script = chrome.chromeScript();
  const actions = ACTIONS.map(a =>
    `    <a class="${a.cls}" href="${a.href}" ${track(a.to, a.href)}>${a.label}</a>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
${gaSnippet()}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ページが見つかりません | NAGOYA BITES</title>
<meta name="description" content="お探しのページは見つかりませんでした。店舗検索かエリア別の一覧から、お探しの店をたどれます。">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/${DS.cssPath.replace(/^\/+/, '')}">
<style>
.nb-notfound{max-width:var(--container-prose);margin:0 auto;padding:calc(var(--header-h) + var(--rhythm-md)) 1.5rem var(--rhythm-md);}
.nb-notfound h1{font-size:var(--fs-2xl);margin:var(--sp-2) 0 var(--sp-4);}
.nb-notfound-lead{font-size:var(--fs-md);color:var(--muted);line-height:1.9;margin:0 0 var(--sp-6);}
.nb-notfound-actions{display:flex;flex-wrap:wrap;gap:var(--sp-3);margin:0 0 var(--sp-5);}
</style>
</head>
<body>

${header}

<main class="nb-notfound" id="main-content">
  <p class="nb-kicker">404</p>
  <h1>ページが見つかりません</h1>
  <p class="nb-notfound-lead">アドレスが違うか、ページが移動・削除された可能性があります。お探しの店は、次のどちらかからたどれます。</p>
  <div class="nb-notfound-actions">
${actions}
  </div>
  <a class="nb-more" href="${MORE.href}" ${track(MORE.to, MORE.href)}>${MORE.label}</a>
</main>

${footer}

${script}
</body>
</html>
`;
}

module.exports = { render, OUT };

if (require.main === module) {
  const html = render();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
    if (cur === html) {
      console.log('404.html: 生成物と一致しています');
      process.exit(0);
    }
    console.error('404.html: 生成物と一致しません（node scripts/gen_404_page.js で作り直してください）');
    process.exit(1);
  }
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`404.html を書きました（${Buffer.byteLength(html, 'utf8')} バイト）`);
}
