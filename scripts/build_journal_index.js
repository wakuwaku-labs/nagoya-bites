'use strict';
/**
 * scripts/build_journal_index.js
 *
 * journal/index.html の記事一覧と journal/feed.xml を journal_published.json から生成。
 * index.html のトップ `<section id="latest-journal">` に最新3件を、最初の画面に分類ごとの最新1本（TOP_ARTICLES 区画・S6-1）を静的挿入する。
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
const { CATEGORIES, categoryOf, isPublic } = require('./lib/journal_category');

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

// 一覧の分類切り替え（S3-3）。JS が無い環境では隠れたまま（hidden）で、全記事がそのまま並ぶ。
// 切り替えは journal/index.html 側のスクリプトが data-category を見て行う。URL（記事・一覧）は変えない。
function buildFilterBar(entries) {
  const counts = { topic: 0, guide: 0, compare: 0 };
  entries.forEach(e => { counts[categoryOf(e)]++; });
  const chip = (key, label, n, pressed) =>
    `<button type="button" class="jf-chip" data-filter="${key}" aria-pressed="${pressed ? 'true' : 'false'}">${esc(label)}<span class="jf-count">${n}</span></button>`;
  const chips = [chip('all', 'すべて', entries.length, true)]
    .concat(Object.keys(CATEGORIES).map(k => chip(k, CATEGORIES[k].label, counts[k], false)));
  return `<div class="journal-filter" id="journal-filter" role="group" aria-label="記事の分類で絞り込む" hidden>
    ${chips.join('\n    ')}
  </div>`;
}

function buildList(entries) {
  if (!entries || entries.length === 0) {
    return `<div class="empty-state">
    <p>最初のジャーナル記事を準備中です。</p>
    <p>すぐに毎朝1本配信が始まります。購読するなら下の RSS をご利用ください。</p>
  </div>`;
  }
  const sorted = entries.slice().sort((a, b) => b.date.localeCompare(a.date));
  return buildFilterBar(sorted) + '\n' + sorted.map(e => `
  <a class="journal-entry" href="${esc(e.slug)}.html" data-category="${categoryOf(e)}">
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

// ── トップの最初の画面に置く「3分類の新しい記事」（S6-1・判断の記録 0072／写真つき・Ondine #2097）─────────────────
// 分類（scripts/lib/journal_category.js の3つ）ごとに、公開中の最新1本。分類が空ならその行は出さない。
// 並びは日付の新しい順（その日の記事を必ず先頭に置く・同じ日は CATEGORIES の順）。
// 写真は、記事自身の「顔の写真」（readHeroPhoto・写真ゲートを通し出所を書けるもの）だけを小さく添える。ここで新しく選ばない。
//   ・ホットペッパー公式写真だけ（配信元は imgfp.hotp.jp の小さな画像）。プレスリリース写真は原寸が1MB を超えることがあり、
//     最初の画面を重くするので載せない（その行は文字だけ）。Places の写真は URL が失効しうるので載せない（CLAUDE.md の優先4の注意）
//   ・出所は文字で添える（行全体が1つのリンクなので、入れ子のリンクにしない）
const TOP_PHOTO_SOURCES = ['hotpepper'];

function latestPerCategory(entries) {
  const sorted = (entries || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const out = [];
  for (const key of Object.keys(CATEGORIES)) {
    const hit = sorted.find(e => categoryOf(e) === key);
    if (hit) out.push({ key, entry: hit });
  }
  return out;
}

function plainCredit(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function topPhotoOf(entry, journalDir) {
  const p = readHeroPhoto(entry.slug, journalDir);
  return p && TOP_PHOTO_SOURCES.includes(p.source) ? p : null;
}

function renderTopArticles(entries, journalDir) {
  const rows = latestPerCategory(entries)
    .map((r, i) => Object.assign({ order: i }, r))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || a.order - b.order);
  if (rows.length === 0) return '';
  const items = rows.map(({ key, entry: e }, i) => {
    const photo = topPhotoOf(e, journalDir);
    const meta = `<span class="ta-meta"><span class="ta-cat">${esc(CATEGORIES[key].label)}</span><time datetime="${esc(e.date)}">${esc(e.date.slice(5).replace('-', '/'))}</time></span>`;
    const title = `<span class="ta-title">${esc(e.title)}</span>`;
    if (!photo) {
      return `
      <li class="ta-item"><a class="ta-link" href="journal/${esc(e.slug)}.html" data-category="${key}">${meta}${title}</a></li>`;
    }
    const fp = i === 0 ? ' fetchpriority="high"' : '';
    return `
      <li class="ta-item ta-has-photo"><a class="ta-link" href="journal/${esc(e.slug)}.html" data-category="${key}"><span class="ta-photo"><img class="ta-img" src="${esc(photo.src)}" alt="${esc(photo.store)}" width="160" height="160" decoding="async"${fp} onerror="this.parentNode.style.display='none'"></span><span class="ta-text">${meta}${title}<span class="ta-credit">${esc(plainCredit(photo.credit))}</span></span></a></li>`;
  }).join('');
  return `<ul class="top-articles-list">${items}
    </ul>`;
}

// journalDir / rootIndexPath はテスト用（既定は実物の journal/ と index.html）
function updateRootLatestSection(entries, journalDir, rootIndexPath) {
  const rootIndex = rootIndexPath || path.join(ROOT, 'index.html');
  const src = fs.readFileSync(rootIndex, 'utf8');
  if (!/<!-- LATEST_JOURNAL_START -->[\s\S]*?<!-- LATEST_JOURNAL_END -->/.test(src)) {
    return false; // index.html にセクション未設置ならスキップ
  }
  // 最初の画面の「新しい記事」（TOP_ARTICLES 区画）に出した記事は、この段の最新3件から除く（同じ記事が上下に並ばない・S6-1）
  const shownAbove = /<!-- TOP_ARTICLES_START -->/.test(src) ? new Set(latestPerCategory(entries).map(x => x.entry.slug)) : new Set();
  const latest3 = (entries || []).filter(e => !shownAbove.has(e.slug)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const inner = latest3.length === 0 ? '' : latest3.map(e => renderLatestCard(e, readHeroPhoto(e.slug, journalDir))).join('\n');
  let out = src.replace(
    /<!-- LATEST_JOURNAL_START -->[\s\S]*?<!-- LATEST_JOURNAL_END -->/,
    `<!-- LATEST_JOURNAL_START -->${inner}\n      <!-- LATEST_JOURNAL_END -->`
  );
  // 最初の画面の「3分類の新しい記事」。区画が無いページ（古い試験用の index.html など）では触らない
  if (/<!-- TOP_ARTICLES_START -->[\s\S]*?<!-- TOP_ARTICLES_END -->/.test(out)) {
    out = out.replace(
      /<!-- TOP_ARTICLES_START -->[\s\S]*?<!-- TOP_ARTICLES_END -->/,
      `<!-- TOP_ARTICLES_START -->\n    ${renderTopArticles(entries, journalDir)}\n    <!-- TOP_ARTICLES_END -->`
    );
  }
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
  // 未来日付のエントリと、取り下げた記事（status: withdrawn・S4-4）は一覧・フィード・トップに載せない
  const entries = allEntries.filter(e => e.date <= today && isPublic(e));
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
module.exports = { buildFilterBar, buildList, buildFeed, main, readHeroPhoto, readCredit, renderLatestCard, updateRootLatestSection, latestPerCategory, renderTopArticles };
