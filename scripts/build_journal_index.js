'use strict';
/**
 * scripts/build_journal_index.js
 *
 * journal/index.html の記事一覧と journal/feed.xml を journal_published.json から生成。
 * index.html のトップ `<section id="latest-journal">` に最新3件を静的挿入する。
 *
 * 使い方:
 *   node scripts/build_journal_index.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const JOURNAL_INDEX = path.join(ROOT, 'journal', 'index.html');
const FEED = path.join(ROOT, 'journal', 'feed.xml');
const SITE_URL = 'https://wakuwaku-labs.github.io/nagoya-bites';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function themeLabel(theme) {
  return ({
    today_one: '🍶 今日の1軒',
    industry_insider: '🗝 業界の裏側',
    weekly_digest: '🔥 週次話題店',
    seasonal: '🗓 季節短信',
    flexible: '🍶 今日の1軒'
  })[theme] || theme;
}

function buildList(entries) {
  if (!entries || entries.length === 0) {
    return `<div class="empty-state">
    <p>最初のジャーナル記事を準備中です。</p>
    <p>すぐに毎朝1本配信が始まります。購読するなら下の RSS をご利用ください。</p>
  </div>`;
  }
  const sorted = entries.slice().sort((a, b) => b.date.localeCompare(a.date));
  return sorted.map(e => `
  <a class="journal-entry" href="${esc(e.slug)}.html">
    <div class="entry-date">${esc(e.date)}</div>
    <div class="entry-body">
      <h2>${esc(e.title)}</h2>
      <p>${esc(e.description || '')}</p>
      <span class="entry-theme">${esc(themeLabel(e.theme))}</span>
    </div>
  </a>`).join('\n');
}

function buildFeed(entries) {
  const sorted = (entries || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const items = sorted.map(e => `  <item>
    <title>${esc(e.title)}</title>
    <link>${SITE_URL}/journal/${esc(e.slug)}.html</link>
    <guid>${SITE_URL}/journal/${esc(e.slug)}.html</guid>
    <pubDate>${new Date(e.published_at || e.date).toUTCString()}</pubDate>
    <description>${esc(e.description || '')}</description>
    <category>${esc(themeLabel(e.theme))}</category>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>NAGOYA BITES Journal</title>
  <link>${SITE_URL}/journal/</link>
  <description>名古屋の飲食業界の中の人が毎日配信する目利きジャーナル</description>
  <language>ja</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>
`;
}

function updateJournalIndex(listHtml) {
  const src = fs.readFileSync(JOURNAL_INDEX, 'utf8');
  const out = src.replace(
    /<!-- ENTRIES_START -->[\s\S]*?<!-- ENTRIES_END -->/,
    `<!-- ENTRIES_START -->\n${listHtml}\n  <!-- ENTRIES_END -->`
  );
  fs.writeFileSync(JOURNAL_INDEX, out);
}

function updateRootLatestSection(entries) {
  const rootIndex = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(rootIndex, 'utf8');
  if (!/<!-- LATEST_JOURNAL_START -->[\s\S]*?<!-- LATEST_JOURNAL_END -->/.test(src)) {
    return false; // index.html にセクション未設置ならスキップ
  }
  const latest3 = (entries || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const inner = latest3.length === 0 ? '' : latest3.map(e => `
        <a class="latest-journal-card" href="journal/${esc(e.slug)}.html">
          <div class="ljc-date">${esc(e.date)}</div>
          <h3 class="ljc-title">${esc(e.title)}</h3>
          <p class="ljc-desc">${esc(e.description || '')}</p>
          <span class="ljc-theme">${esc(themeLabel(e.theme))}</span>
        </a>`).join('\n');
  const out = src.replace(
    /<!-- LATEST_JOURNAL_START -->[\s\S]*?<!-- LATEST_JOURNAL_END -->/,
    `<!-- LATEST_JOURNAL_START -->${inner}\n      <!-- LATEST_JOURNAL_END -->`
  );
  fs.writeFileSync(rootIndex, out);
  return true;
}

function main() {
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const entries = published.entries || [];
  const listHtml = buildList(entries);
  updateJournalIndex(listHtml);
  fs.writeFileSync(FEED, buildFeed(entries));
  const rootUpdated = updateRootLatestSection(entries);
  console.log(`✅ journal/index.html (${entries.length}件) + feed.xml 更新${rootUpdated ? ' + index.html 最新3件' : ''}`);
}

if (require.main === module) main();
module.exports = { buildList, buildFeed };
