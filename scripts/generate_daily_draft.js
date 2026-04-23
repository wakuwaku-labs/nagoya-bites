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
 *     "og_image": "https://.../og.png (省略可 — 省略時は Unsplash から自動取得)",
 *     "hero_image_url": "https://images.unsplash.com/... (省略可 — og_image と同期)",
 *     "hero_image_credit_url": "https://unsplash.com/@photographer (省略可)",
 *     "hero_image_credit_name": "撮影者名 or Unsplash (省略可)",
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
const https = require('https');

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

// --------------- 自動画像取得（Unsplash API 優先 → ジャンル別厳選写真フォールバック）-----------

/**
 * ジャンル別に厳選した Unsplash 写真（全て実際に目視確認済み）。
 * API不要・URLが永続的。{ id, credit_name, credit_url } の配列。
 */
const GENRE_PHOTO_MAP = {
  // 居酒屋: モダンな店内照明 / 料理人の手元（板場の臨場感）
  '居酒屋': [
    { id: 'photo-1517248135467-4c7edcad34c4', credit_name: 'Nikola Johnny Mirkovic', credit_url: 'https://unsplash.com/photos/4YzrcDNcRVg' },
    { id: 'photo-1551218808-94e220e084d2',    credit_name: 'Kevin McCutcheon',        credit_url: 'https://unsplash.com/photos/APDMfLHZiRA' },
  ],
  // 和食: 美しい盛り合わせ寿司 / 料理人の手元
  '和食': [
    { id: 'photo-1514190051997-0f6f39ca5cde', credit_name: 'Mahmud Ahsan',    credit_url: 'https://unsplash.com/photos/IfGMHGlOyeQ' },
    { id: 'photo-1551218808-94e220e084d2',    credit_name: 'Kevin McCutcheon', credit_url: 'https://unsplash.com/photos/APDMfLHZiRA' },
  ],
  // 割烹: 老舗の料理 → 寿司盛り合わせ / 板場の手元
  '割烹': [
    { id: 'photo-1514190051997-0f6f39ca5cde', credit_name: 'Mahmud Ahsan',    credit_url: 'https://unsplash.com/photos/IfGMHGlOyeQ' },
    { id: 'photo-1551218808-94e220e084d2',    credit_name: 'Kevin McCutcheon', credit_url: 'https://unsplash.com/photos/APDMfLHZiRA' },
  ],
  // 寿司: 美しい盛り合わせ / サーモンロール
  '寿司': [
    { id: 'photo-1514190051997-0f6f39ca5cde', credit_name: 'Mahmud Ahsan',         credit_url: 'https://unsplash.com/photos/IfGMHGlOyeQ' },
    { id: 'photo-1579871494447-9811cf80d66c', credit_name: 'Louis Hansel',          credit_url: 'https://unsplash.com/photos/lCyMYOaEwqk' },
  ],
  // ラーメン: ラーメンボウル
  'ラーメン': [
    { id: 'photo-1553621042-f6e147245754', credit_name: 'Hana Oliver', credit_url: 'https://unsplash.com/photos/TtA9CQrxRQI' },
  ],
  // 焼き鳥: カツ系フライ / 盛り合わせ
  '焼き鳥': [
    { id: 'photo-1569050467447-ce54b3bbc37d', credit_name: 'amirali mirhashemian', credit_url: 'https://unsplash.com/photos/FBpKHMGc5FU' },
    { id: 'photo-1504674900247-0877df9cc836',  credit_name: 'Brooke Lark',          credit_url: 'https://unsplash.com/photos/08bOYnH_r_E' },
  ],
  // 焼肉・鉄板焼: フライ系 / 盛り合わせ
  '焼肉': [
    { id: 'photo-1569050467447-ce54b3bbc37d', credit_name: 'amirali mirhashemian', credit_url: 'https://unsplash.com/photos/FBpKHMGc5FU' },
  ],
  '鉄板焼': [
    { id: 'photo-1569050467447-ce54b3bbc37d', credit_name: 'amirali mirhashemian', credit_url: 'https://unsplash.com/photos/FBpKHMGc5FU' },
  ],
  // 天ぷら: 和食盛り合わせ
  '天ぷら': [
    { id: 'photo-1514190051997-0f6f39ca5cde', credit_name: 'Mahmud Ahsan', credit_url: 'https://unsplash.com/photos/IfGMHGlOyeQ' },
  ],
  // イタリアン: カフェ風内観 / 料理盛り付け
  'イタリアン': [
    { id: 'photo-1555396273-367ea4eb4db5', credit_name: 'Naomi Hébert',      credit_url: 'https://unsplash.com/photos/HP4tGnPNPzM' },
    { id: 'photo-1414235077428-338989a2e8c0', credit_name: 'Jay Wennington', credit_url: 'https://unsplash.com/photos/N_Y88TWmGwA' },
  ],
  // フレンチ
  'フレンチ': [
    { id: 'photo-1414235077428-338989a2e8c0', credit_name: 'Jay Wennington', credit_url: 'https://unsplash.com/photos/N_Y88TWmGwA' },
    { id: 'photo-1555396273-367ea4eb4db5', credit_name: 'Naomi Hébert',      credit_url: 'https://unsplash.com/photos/HP4tGnPNPzM' },
  ],
  // 中華: 複数皿の俯瞰
  '中華': [
    { id: 'photo-1504674900247-0877df9cc836', credit_name: 'Brooke Lark', credit_url: 'https://unsplash.com/photos/08bOYnH_r_E' },
  ],
  // デフォルト: 高級感のある店内 / 板場の手元 / 俯瞰の料理
  '_default': [
    { id: 'photo-1517248135467-4c7edcad34c4', credit_name: 'Nikola Johnny Mirkovic', credit_url: 'https://unsplash.com/photos/4YzrcDNcRVg' },
    { id: 'photo-1551218808-94e220e084d2',    credit_name: 'Kevin McCutcheon',        credit_url: 'https://unsplash.com/photos/APDMfLHZiRA' },
    { id: 'photo-1504674900247-0877df9cc836', credit_name: 'Brooke Lark',             credit_url: 'https://unsplash.com/photos/08bOYnH_r_E' },
  ],
};

/**
 * コンセプトキーワード優先マップ。
 * おすすめポイント/タイトルにこれらが含まれる場合、ジャンルより優先して写真を選ぶ。
 */
const CONCEPT_PHOTO_MAP = [
  // 板場・料亭・厨房 → 料理人の手元（調理の臨場感）
  { keywords: ['板場', '料亭', '厨房', 'オープンキッチン', '職人'],
    photo: { id: 'photo-1551218808-94e220e084d2', credit_name: 'Kevin McCutcheon', credit_url: 'https://unsplash.com/photos/APDMfLHZiRA' } },
  // 寿司・鮨
  { keywords: ['寿司', '鮨', 'すし'],
    photo: { id: 'photo-1514190051997-0f6f39ca5cde', credit_name: 'Mahmud Ahsan', credit_url: 'https://unsplash.com/photos/IfGMHGlOyeQ' } },
  // ラーメン
  { keywords: ['ラーメン', '拉麺', '麺'],
    photo: { id: 'photo-1553621042-f6e147245754', credit_name: 'Hana Oliver', credit_url: 'https://unsplash.com/photos/TtA9CQrxRQI' } },
  // 店内・雰囲気重視
  { keywords: ['隠れ家', '路地', '暖簾', '一軒家'],
    photo: { id: 'photo-1517248135467-4c7edcad34c4', credit_name: 'Nikola Johnny Mirkovic', credit_url: 'https://unsplash.com/photos/4YzrcDNcRVg' } },
];

/**
 * おすすめポイント・タイトルからコンセプトキーワードで写真を選ぶ。
 * 一致しなければジャンルマップにフォールバック。
 */
function pickCuratedPhoto(input) {
  // コンセプトテキスト: おすすめポイント + タイトル + 店名
  const conceptText = [
    input.title || '',
    (input.stores || []).map(s => s.desc || '').join(' '),
    // input.json 経由で店舗の おすすめポイント が body_html に含まれる場合も検索
  ].join(' ');

  // 1. コンセプトキーワードで優先選択
  for (const rule of CONCEPT_PHOTO_MAP) {
    if (rule.keywords.some(kw => conceptText.includes(kw))) {
      const e = rule.photo;
      return {
        url: `https://images.unsplash.com/${e.id}?auto=format&fit=crop&w=1200&h=630&q=80`,
        credit_name: e.credit_name,
        credit_url: `${e.credit_url}?utm_source=nagoya_bites&utm_medium=referral`,
      };
    }
  }

  // 2. ジャンルマップ
  const genre = (input.stores || [])[0]?.genre || '';
  const key = Object.keys(GENRE_PHOTO_MAP).find(k => k !== '_default' && genre.includes(k));
  const pool = GENRE_PHOTO_MAP[key] || GENRE_PHOTO_MAP['_default'];
  const lock = parseInt(input.date.replace(/-/g, ''), 10);
  const entry = pool[lock % pool.length];
  return {
    url: `https://images.unsplash.com/${entry.id}?auto=format&fit=crop&w=1200&h=630&q=80`,
    credit_name: entry.credit_name,
    credit_url: `${entry.credit_url}?utm_source=nagoya_bites&utm_medium=referral`,
  };
}

/**
 * Unsplash API (要 UNSPLASH_ACCESS_KEY 環境変数 — 無料プランで50req/h)
 * https://unsplash.com/developers で無料取得可能
 */
async function tryUnsplashApi(genre) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  return new Promise((resolve) => {
    const q = encodeURIComponent(`japanese ${genre || 'restaurant food'}`);
    const apiUrl = `https://api.unsplash.com/photos/random?query=${q}&orientation=landscape&client_id=${key}`;
    let body = '';
    const req = https.get(apiUrl, { timeout: 8000 }, (res) => {
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (!d.urls) return resolve(null);
          resolve({
            url: `${d.urls.raw}&auto=format&fit=crop&w=1200&h=630&q=80`,
            credit_name: d.user.name,
            credit_url: `${d.user.links.html}?utm_source=nagoya_bites&utm_medium=referral`
          });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/** 記事に合う写真を自動取得 */
/**
 * HotPepper写真URL (_480.jpg) からフルサイズURLへ変換し疎通確認する。
 * フルサイズが取れない場合は _480 をそのまま使う。
 */
async function tryStorePhoto(photoUrl) {
  if (!photoUrl) return null;
  // _480.jpg → サイズなし（フルサイズ）に変換して試みる
  const fullUrl = photoUrl.replace(/_\d+\.jpg$/, '.jpg');
  const targetUrl = fullUrl !== photoUrl ? fullUrl : photoUrl;
  return new Promise((resolve) => {
    const req = https.get(targetUrl, { timeout: 6000 }, (res) => {
      res.resume();
      if (res.statusCode === 200) {
        resolve({ url: targetUrl, credit_name: '店舗公式写真', credit_url: 'https://www.hotpepper.jp', is_store_photo: true });
      } else if (targetUrl !== photoUrl) {
        // フルサイズ失敗 → _480 にフォールバック
        resolve({ url: photoUrl, credit_name: '店舗公式写真', credit_url: 'https://www.hotpepper.jp', is_store_photo: true });
      } else {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function fetchPhotoForArticle(input) {
  // 0. stores[0].photo_url が明示指定されている場合（HotPepper実店舗写真）
  const storePhotoUrl = (input.stores || [])[0]?.photo_url;
  if (storePhotoUrl) {
    const storePhoto = await tryStorePhoto(storePhotoUrl);
    if (storePhoto) {
      process.stdout.write(` 📷 店舗公式写真 (HotPepper)\n`);
      return storePhoto;
    }
  }

  const genre = (input.stores || [])[0]?.genre || '';

  // 1. Unsplash API（環境変数あり時のみ）
  const unsplash = await tryUnsplashApi(genre);
  if (unsplash) {
    process.stdout.write(` 📷 Unsplash API: ${unsplash.credit_name}\n`);
    return unsplash;
  }

  // 2. ジャンル別厳選写真（API不要・Unsplash直接URL・永続的）
  const curated = pickCuratedPhoto(input);
  process.stdout.write(` 📷 Unsplash (curated): ${curated.credit_name}\n`);
  return curated;
}

function buildHeroImageSection(input) {
  const imgUrl = input.hero_image_url;
  if (!imgUrl) return '';
  const isStorePhoto = input.hero_image_is_store_photo;
  const creditUrl  = input.hero_image_credit_url  || 'https://unsplash.com';
  const creditName = input.hero_image_credit_name || 'Unsplash';
  // 店舗公式写真はHotPepperへリンク、Unsplashはunsplash.com
  const creditSite = isStorePhoto ? 'HotPepper' : (creditUrl.includes('unsplash') ? 'Unsplash' : '');
  const creditHtml = isStorePhoto
    ? `<a href="${esc(creditUrl)}" target="_blank" rel="noopener">店舗公式写真</a> / <a href="https://www.hotpepper.jp" target="_blank" rel="noopener">HotPepper</a>`
    : `<a href="${esc(creditUrl)}" target="_blank" rel="noopener">${esc(creditName)}</a> / <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>`;
  return `<figure class="art-hero-img">
  <img src="${esc(imgUrl)}" alt="${esc(input.title)}" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">Photo: ${creditHtml}</figcaption>
</figure>`;
}

// --------------- 写真候補メモ ---------------

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
    '{{HERO_IMAGE_SECTION}}': buildHeroImageSection(input),
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

async function main() {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  // --- 自動画像取得（Unsplash API → Loremflickr フォールバック）---
  if (!input.hero_image_url) {
    process.stdout.write('  📷 画像を自動取得中...');
    const photo = await fetchPhotoForArticle(input);
    if (photo) {
      input.hero_image_url           = photo.url;
      input.hero_image_credit_url    = photo.credit_url;
      input.hero_image_credit_name   = photo.credit_name;
      input.hero_image_is_store_photo = photo.is_store_photo || false;
      input.og_image = input.og_image || photo.url;
    }
  } else {
    input.og_image = input.og_image || input.hero_image_url;
  }

  const htmlPath = path.join(DRAFTS_DIR, input.slug + '.html');
  const mdPath = path.join(POSTS_DIR, input.date + '.md');
  fs.writeFileSync(htmlPath, renderHtml(input));
  fs.writeFileSync(mdPath, renderMd(input));
  console.log(`✅ Draft 生成:\n  - ${path.relative(ROOT, htmlPath)}\n  - ${path.relative(ROOT, mdPath)}`);
  if (input.hero_image_url) {
    console.log(`  🖼  ヒーロー画像: ${input.hero_image_url}`);
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { renderHtml, renderMd };
