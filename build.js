'use strict';
/**
 * build.js
 * Google SheetsのCSVを取得してindex.htmlにデータを静的埋め込みし、
 * SEOクロール用の店舗リストHTMLも生成する
 */
const https = require('https');
const fs   = require('fs');
const path = require('path');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1VUk4bRTPoIc7pHywzIJTwZr9WyUX7ioxlZzbxQHsjCQ/export?format=csv&gid=415662614';
const HTML    = path.join(__dirname, 'index.html');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = [];
  let cur = '', inQ = false;
  for (const ch of lines[0]) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { headers.push(cur.trim().replace(/^"|"$/g,'')); cur = ''; }
    else { cur += ch; }
  }
  headers.push(cur.trim().replace(/^"|"$/g,''));

  const stores = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = []; cur = ''; inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim().replace(/^"|"$/g,'')); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim().replace(/^"|"$/g,''));
    if (!cols[0]) continue;
    const store = {};
    headers.forEach((h, j) => { store[h] = (cols[j] || '').trim(); });
    stores.push(store);
  }
  return stores;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

async function main() {
  console.log('CSVを取得中...');
  const csv = await fetchUrl(CSV_URL);
  const stores = parseCSV(csv).filter(s => s['公開フラグ'] !== 'FALSE');
  console.log(`${stores.length}件取得`);

  // 1. LOCAL_STORESを全店舗データで置き換え
  let html = fs.readFileSync(HTML, 'utf8');
  const jsonStr = JSON.stringify(stores);
  html = html.replace(
    /var LOCAL_STORES = \[[\s\S]*?\];/,
    `var LOCAL_STORES = ${jsonStr};`
  );

  // 2. SEOクロール用の隠しリスト（noscript内に店舗名・エリア・ジャンルを列挙）
  const noscriptItems = stores.map(s =>
    `<li><a href="${escapeHtml('https://wakuwaku-labs.github.io/nagoya-bites/')}">${escapeHtml(s['店名'])}（${escapeHtml(s['エリア'] || '')} ${escapeHtml(s['ジャンル'] || '')}）</a></li>`
  ).join('\n');
  const noscriptHtml = `<noscript><ul id="seo-store-list">\n${noscriptItems}\n</ul></noscript>`;

  // 既存のnoscriptブロックを置き換え or 挿入
  if (html.includes('<noscript><ul id="seo-store-list">')) {
    html = html.replace(/<noscript><ul id="seo-store-list">[\s\S]*?<\/ul><\/noscript>/, noscriptHtml);
  } else {
    html = html.replace('<div id="grid">', noscriptHtml + '\n<div id="grid">');
  }

  // 3. lastmod を今日の日付に更新
  const today = new Date().toISOString().slice(0, 10);
  html = html.replace(
    /<meta name="revised" content="[^"]*">/,
    `<meta name="revised" content="${today}">`
  );

  fs.writeFileSync(HTML, html, 'utf8');
  console.log('index.html 更新完了');

  // 4. sitemap.xmlの lastmod を更新
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://wakuwaku-labs.github.io/nagoya-bites/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
  console.log('sitemap.xml 更新完了');
}

main().catch(e => { console.error(e.message); process.exit(1); });
