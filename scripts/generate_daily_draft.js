'use strict';
/**
 * scripts/generate_daily_draft.js
 *
 * Editor が Claude Code セッション内で生成した記事内容を
 * journal/_template.html と docs/daily-posts/_template.md に差し込み、
 * ドラフトファイルとして出力するビルダー。
 *
 * 記事の「文章そのもの」は Editor（=Claude）がセッション内で書く。
 * 本スクリプトは差し込み・ファイル生成のみを担当する。
 *
 * 使い方:
 *   node scripts/generate_daily_draft.js <input.json>
 *
 * input.json スキーマ:
 *   {
 *     "date": "2026-04-21",
 *     "slug": "2026-04-21-some-slug",
 *     "theme": "today_one | industry_insider | weekly_digest | seasonal | flexible",
 *     "title": "記事タイトル",
 *     "title_html": "タイトル<em>強調</em>可",
 *     "description": "120字程度",
 *     "keywords": "名古屋,〇〇,...",
 *     "og_image": "https://.../og.png (任意)",
 *     "eyebrow": "🍶 今日の1軒",
 *     "lead": "リード文",
 *     "body_html": "<p>本文HTML</p>",
 *     "insider_points": ["業界人視点1", "業界人視点2", "業界人視点3"],
 *     "stores": [{ "name": "店名", "id": "", "genre": "", "area": "", "score": "★4.3", "desc": "", "link": "https://..." }],
 *     "sources": [{ "label": "情報源名", "url": "https://..." }],
 *     "photo_suggestions": [
 *       {
 *         "type": "store_instagram | google_maps | stock_keyword | shot_type",
 *         "label": "ラベル(例: 店舗Instagram検索)",
 *         "url": "https://... (任意)",
 *         "note": "使用上のメモ(例: 公式または来店客の料理写真を検索)"
 *       }
 *     ],
 *     "sns": {
 *       "note_title": "Note記事タイトル",
 *       "note_body": "Note本文(2000-5000字目安)",
 *       "instagram": "IG本文(2200字以内)",
 *       "instagram_hashtags": ["#名古屋グルメ", ...],
 *       "x_thread": ["ツイート1(280字以内)", "ツイート2", "ツイート3"]
 *     }
 *   }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_TEMPLATE = path.join(ROOT, 'journal', '_template.html');
const MD_TEMPLATE = path.join(ROOT, 'docs', 'daily-posts', '_template.md');
const DRAFTS_DIR = path.join(ROOT, 'journal', 'drafts');
const POSTS_DIR = path.join(ROOT, 'docs', 'daily-posts');

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function toDateJa(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${wd})`;
}

function buildStores(stores) {
  if (!stores || stores.length === 0) return '';
  return stores.map((s, i) => `
      <div class="store-card"${s.id ? ` data-store-id="${esc(s.id)}"` : ''}>
        <div class="store-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="store-info">
          <h3 class="store-name">${esc(s.name)}</h3>
          <div class="store-meta">
            ${s.genre ? `<span>${esc(s.genre)}</span>` : ''}
            ${s.area ? `<span>${esc(s.area)}</span>` : ''}
            ${s.score ? `<span class="score">${esc(s.score)}</span>` : ''}
          </div>
          <p class="store-desc">${esc(s.desc || '')}</p>
          ${s.link ? `<a class="store-link" href="${esc(s.link)}" target="_blank" rel="noopener">詳細を見る →</a>` : ''}
        </div>
      </div>`).join('\n');
}

function buildInsiderPoints(points) {
  if (!points || points.length === 0) return '<li>(業界人視点を記述)</li>';
  return points.map(p => `        <li>${esc(p)}</li>`).join('\n');
}

function buildSources(sources) {
  if (!sources || sources.length === 0) return '';
  const items = sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('、 ');
  return `<div class="source-note"><strong>情報源:</strong> ${items}</div>`;
}

function buildPhotoSuggestionsHtmlComment(suggestions) {
  if (!suggestions || suggestions.length === 0) return '';
  const lines = suggestions.map(s => {
    let line = `  - [${s.type || 'tip'}] ${s.label}`;
    if (s.url) line += `: ${s.url}`;
    if (s.note) line += ` — ${s.note}`;
    return line;
  });
  return `\n<!-- PHOTO SUGGESTIONS (編集メモ — 読者には非表示):\n${lines.join('\n')}\n-->`;
}

function buildPhotoSuggestionsMd(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return '*(写真候補データなし — Unsplash等で撮影テーマに合う素材を検索してください)*';
  }
  return suggestions.map(s => {
    const typeEmoji = { store_instagram: '📸', google_maps: '🗺', stock_keyword: '🔍', shot_type: '🎬' }[s.type] || '📷';
    let line = `- ${typeEmoji} **${s.label}**`;
    if (s.url) line += `\n  リンク: ${s.url}`;
    if (s.note) line += `\n  > ${s.note}`;
    return line;
  }).join('\n');
}

function renderHtml(input) {
  let html = fs.readFileSync(HTML_TEMPLATE, 'utf8');
  const themeLabel = ({
    today_one: '🍶 今日の1軒', industry_insider: '🗝 業界の裏側',
    weekly_digest: '🔥 週次話題店', seasonal: '🗓 季節短信', flexible: '🍶 今日の1軒'
  })[input.theme] || '';
  const replacements = {
    '{{TITLE}}': esc(input.title),
    '{{TITLE_HTML}}': input.title_html || esc(input.title),
    '{{DESCRIPTION}}': esc(input.description),
    '{{KEYWORDS}}': esc(input.keywords || ''),
    '{{SLUG}}': esc(input.slug),
    '{{OG_IMAGE}}': esc(input.og_image || 'https://wakuwaku-labs.github.io/nagoya-bites/icons/icon-512.png'),
    '{{DATE}}': esc(input.date),
    '{{DATE_JA}}': esc(toDateJa(input.date)),
    '{{EYEBROW}}': esc(input.eyebrow || themeLabel),
    '{{THEME_LABEL}}': esc(themeLabel),
    '{{LEAD}}': esc(input.lead),
    '{{BODY}}': input.body_html || '',
    '{{INSIDER_POINTS}}': buildInsiderPoints(input.insider_points),
    '{{STORES}}': buildStores(input.stores),
    '{{SOURCES}}': buildSources(input.sources),
    '{{PHOTO_SUGGESTIONS_HTML}}': buildPhotoSuggestionsHtmlComment(input.photo_suggestions)
  };
  Object.entries(replacements).forEach(([k, v]) => { html = html.split(k).join(v); });
  return html;
}

function renderMd(input) {
  let md;
  if (fs.existsSync(MD_TEMPLATE)) {
    md = fs.readFileSync(MD_TEMPLATE, 'utf8');
  } else {
    md = `# {{DATE}} {{TITLE}}\n\n## Note\n{{NOTE}}\n\n## Instagram\n{{INSTAGRAM}}\n\n## X\n{{X}}\n`;
  }
  const sns = input.sns || {};
  const xThread = (sns.x_thread || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
  const igBody = (sns.instagram || '') + '\n\n' + (sns.instagram_hashtags || []).join(' ');
  const replacements = {
    '{{DATE}}': input.date,
    '{{TITLE}}': input.title,
    '{{SLUG}}': input.slug,
    '{{JOURNAL_URL}}': `https://wakuwaku-labs.github.io/nagoya-bites/journal/${input.slug}.html`,
    '{{NOTE_TITLE}}': sns.note_title || input.title,
    '{{NOTE}}': sns.note_body || '(Note本文)',
    '{{INSTAGRAM}}': igBody,
    '{{X}}': xThread || '(Xスレッド)',
    '{{PHOTO_SUGGESTIONS}}': buildPhotoSuggestionsMd(input.photo_suggestions)
  };
  Object.entries(replacements).forEach(([k, v]) => { md = md.split(k).join(v); });
  return md;
}

function main() {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  const htmlPath = path.join(DRAFTS_DIR, input.slug + '.html');
  const mdPath = path.join(POSTS_DIR, input.date + '.md');
  fs.writeFileSync(htmlPath, renderHtml(input));
  fs.writeFileSync(mdPath, renderMd(input));
  console.log(`✅ Draft 生成:\n  - ${path.relative(ROOT, htmlPath)}\n  - ${path.relative(ROOT, mdPath)}`);
}

if (require.main === module) main();
module.exports = { renderHtml, renderMd };
