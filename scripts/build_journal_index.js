'use strict';
/**
 * scripts/build_journal_index.js
 *
 * journal/index.html の記事一覧と journal/feed.xml を journal_published.json から生成。
 * index.html のトップ `<section id="latest-journal">` に最新3件を静的挿入する。
 * 記事に「顔の写真」（figure.art-hero-img・写真ゲートを通したもの）があれば、その写真と出所のクレジットをカードに添える（I-24）。
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
const ATOM_FEED = path.join(ROOT, 'journal', 'feed.atom');
const SITE_URL = 'https://nagoya-bites.com';

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function themeLabel(theme) {
  return ({
    today_one: '今日の1軒',
    industry_insider: '業界の裏側',
    weekly_digest: '週次話題店',
    seasonal: '季節短信',
    flexible: '今日の1軒'
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
  <description>名古屋の新店と話題を、毎日まとめています</description>
  <language>ja</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>
`;
}

function buildAtomFeed(entries) {
  const sorted = (entries || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const updated = sorted.length > 0
    ? new Date(sorted[0].published_at || sorted[0].date).toISOString()
    : new Date().toISOString();
  const entriesXml = sorted.map(e => {
    const url = `${SITE_URL}/journal/${esc(e.slug)}.html`;
    const pub = new Date(e.published_at || e.date).toISOString();
    return `  <entry>
    <title>${esc(e.title)}</title>
    <link href="${url}"/>
    <id>${url}</id>
    <updated>${pub}</updated>
    <published>${pub}</published>
    <summary>${esc(e.description || '')}</summary>
    <category term="${esc(e.theme)}" label="${esc(themeLabel(e.theme))}"/>
  </entry>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">
  <title>NAGOYA BITES Journal</title>
  <subtitle>名古屋の新店と話題を、毎日まとめています</subtitle>
  <link href="${SITE_URL}/journal/" rel="alternate"/>
  <link href="${SITE_URL}/journal/feed.atom" rel="self"/>
  <id>${SITE_URL}/journal/</id>
  <updated>${updated}</updated>
  <author><name>NAGOYA BITES 編集部</name></author>
${entriesXml}
</feed>
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

// ── トップのカードに載せる「記事の顔の写真」（I-24・P-399）─────────────────────
// 写真は記事自身（journal/<slug>.html）の figure.art-hero-img から読む。ここで新しく選ばない:
//   ・data-hero-source（places / press / hotpepper）と data-hero-store がある＝記事の写真ゲート（scripts/lib/hero_photo_gate.js）を通した顔だけ
//   ・出所を書いたキャプション（figcaption）が無い写真は載せない（出所を書けない写真は載せない・CLAUDE.md）
//   ・URL は記事と同じものをそのまま参照する（加工・再配信しない＝プレスリリース写真の条件 d）。クレジットのリンクも記事と同じ
// 読めない・形が違う・ファイルが無いときは null（文字だけのカードに戻す）。日次ジャーナルの処理を止めないため、例外は出さない。
const HERO_SOURCES = ['places', 'press', 'hotpepper'];

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// キャプションの中身を「テキストと https のリンクだけ」に作り直す。ほかのタグが混じっていたら null
function readCredit(inner) {
  const TOKEN = /<a\s+[^>]*?href="(https?:\/\/[^"\s]+)"[^>]*>([^<]*)<\/a>|([^<]+)/g;
  const html = String(inner || '');
  let consumed = 0;
  const out = [];
  for (const m of html.matchAll(TOKEN)) {
    if (m.index !== consumed) return null;
    consumed = m.index + m[0].length;
    if (m[1]) out.push(`<a href="${esc(decodeEntities(m[1]))}" target="_blank" rel="noopener">${esc(decodeEntities(m[2]))}</a>`);
    else out.push(esc(decodeEntities(m[3])));
  }
  if (consumed !== html.length) return null;
  const credit = out.join('').replace(/\s+/g, ' ').trim();
  return credit && /写真/.test(credit) ? credit : null;
}

function readHeroPhoto(slug, journalDir) {
  try {
    const dir = journalDir || path.join(ROOT, 'journal');
    const html = fs.readFileSync(path.join(dir, `${slug}.html`), 'utf8');
    const fig = html.match(/<figure class="art-hero-img"([^>]*)>([\s\S]*?)<\/figure>/);
    if (!fig) return null;
    const source = (fig[1].match(/data-hero-source="([^"]*)"/) || [])[1] || '';
    const store = decodeEntities((fig[1].match(/data-hero-store="([^"]*)"/) || [])[1] || '').trim();
    if (!HERO_SOURCES.includes(source) || !store) return null;
    const src = (fig[2].match(/<img\b[^>]*?\bsrc="(https:\/\/[^"\s<>']+)"/) || [])[1];
    const cap = fig[2].match(/<figcaption class="art-img-credit">([\s\S]*?)<\/figcaption>/);
    if (!src || !cap) return null;
    const credit = readCredit(cap[1]);
    if (!credit) return null;
    return { src: decodeEntities(src), store, source, credit };
  } catch (_) {
    return null;
  }
}

// カード1枚。写真が無い記事は文字だけ（従来と同じ見た目）。リンクはタイトルに張り、カード全体を覆う（クレジットのリンクと入れ子にしないため）
function renderLatestCard(e, photo) {
  const figure = photo ? `
          <figure class="ljc-photo">
            <img class="ljc-img" src="${esc(photo.src)}" alt="${esc(photo.store)}" width="480" height="320" loading="lazy" decoding="async" onerror="this.parentNode.style.display='none'">
            <figcaption class="ljc-credit">${photo.credit}</figcaption>
          </figure>` : '';
  return `
        <article class="latest-journal-card${photo ? ' has-photo' : ''}">${figure}
          <div class="ljc-date">${esc(e.date)}</div>
          <h3 class="ljc-title"><a class="ljc-link" href="journal/${esc(e.slug)}.html">${esc(e.title)}</a></h3>
          <p class="ljc-desc">${esc(e.description || '')}</p>
          <span class="ljc-theme">${esc(themeLabel(e.theme))}</span>
        </article>`;
}

// journalDir / rootIndexPath はテスト用（既定は実物の journal/ と index.html）
function updateRootLatestSection(entries, journalDir, rootIndexPath) {
  const rootIndex = rootIndexPath || path.join(ROOT, 'index.html');
  const src = fs.readFileSync(rootIndex, 'utf8');
  if (!/<!-- LATEST_JOURNAL_START -->[\s\S]*?<!-- LATEST_JOURNAL_END -->/.test(src)) {
    return false; // index.html にセクション未設置ならスキップ
  }
  const latest3 = (entries || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const inner = latest3.length === 0 ? '' : latest3.map(e => renderLatestCard(e, readHeroPhoto(e.slug, journalDir))).join('\n');
  const out = src.replace(
    /<!-- LATEST_JOURNAL_START -->[\s\S]*?<!-- LATEST_JOURNAL_END -->/,
    `<!-- LATEST_JOURNAL_START -->${inner}\n      <!-- LATEST_JOURNAL_END -->`
  );
  fs.writeFileSync(rootIndex, out);
  return true;
}

function todayJST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function main() {
  const published = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const allEntries = published.entries || [];
  const today = todayJST();
  // 未来日付のエントリは掲載しない
  const entries = allEntries.filter(e => e.date <= today);
  const listHtml = buildList(entries);
  updateJournalIndex(listHtml);
  fs.writeFileSync(FEED, buildFeed(entries));
  fs.writeFileSync(ATOM_FEED, buildAtomFeed(entries));
  const rootUpdated = updateRootLatestSection(entries);
  const futureCount = allEntries.length - entries.length;
  const futureNote = futureCount > 0 ? ` (未来${futureCount}件は非表示)` : '';
  console.log(`✅ journal/index.html (${entries.length}件) + feed.xml 更新${rootUpdated ? ' + index.html 最新3件' : ''}${futureNote}`);
}

if (require.main === module) main();

// build.js から呼ぶための export — トップ Daily Journal セクションの
// 同期忘れを防ぐため、build.js 末尾でも自動実行される。
module.exports = { buildList, buildFeed, main, readHeroPhoto, readCredit, renderLatestCard, updateRootLatestSection };
