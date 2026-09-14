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
 *     "eyebrow": "今日の1軒",
 *     "lead": "リード文",
 *     "body_html": "<p>本文HTML</p>",
 *     "insider_points": ["業界人視点1", "業界人視点2", "業界人視点3"],
 *     "stores": [{ "name": "店名", "id": "", "genre": "", "area": "", "score": "★4.3", "desc": "", "link": "https://..." }],
 *     "sources": [{ "label": "情報源名", "url": "https://...", "date": "2026-05-15 (任意 — 掲載日。表示時に併記される)" }],
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
 *     },
 *     "notebooklm_slides": [
 *       {
 *         "heading": "スライドの見出し(例: 輸送コストを受容する選択)",
 *         "body": "NotebookLMに読ませる詳しい解説文(自己完結・1スライド1テーマ)",
 *         "image_prompt": "イメージ図/図解スタイルの画像プロンプト(実写偽装・他媒体転用は禁止・文字は入れない)"
 *       }
 *     ]
 *   }
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
// ヒーロー写真の帰属判定は scripts/lib/hero_photo_gate.js に一元化（2026-08-17 の事故）
const { judgeHero } = require('./lib/hero_photo_gate');
// 図解SVG→OGP用PNG変換は scripts/lib/og_figure_png.js に一元化（ISSUE-095）
const OG = require('./lib/og_figure_png.js');

const ROOT = path.join(__dirname, '..');
const HTML_TEMPLATE = path.join(ROOT, 'journal', '_template.html');
const MD_TEMPLATE = path.join(ROOT, 'docs', 'daily-posts', '_template.md');
const DRAFTS_DIR = path.join(ROOT, 'journal', 'drafts');
const POSTS_DIR = path.join(ROOT, 'docs', 'daily-posts');
const SNS_DRAFT_POLICY_PATH = path.join(ROOT, 'data', 'journal_sns_draft_policy.json');

// SNS原稿(docs/daily-posts/*.md)の自動生成は data/journal_sns_draft_policy.json が唯一の情報源。
// ファイルが無い/壊れている場合は従来どおり生成する(フェイルセーフのデフォルトはON)。
function shouldGenerateSnsDraft() {
  try {
    const policy = JSON.parse(fs.readFileSync(SNS_DRAFT_POLICY_PATH, 'utf8'));
    return policy.generate_sns_draft !== false;
  } catch (e) {
    return true;
  }
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
// onclick="trackEvent(...)" 内の JS 文字列リテラル用エスケープ（index.html の ctaEsc と同じ簡易方式）
function jsEsc(s) { return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, ''); }

// SEO-054: 店舗カードの予約導線は実在データ（data/stores.json のホットペッパーID）由来に限る。
// s.id は入力JSONの著者（Editor）が任意入力する値で、多くは stores/{id}.html のスラグと
// 同じホットペッパーIDだが、ペンディング店などの名前スラグの場合もある（架空URL生成の防止・制約10）。
let _hpMapCache = null;
function loadHpMap() {
  if (_hpMapCache) return _hpMapCache;
  _hpMapCache = new Map();
  try {
    const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
    const list = Array.isArray(stores) ? stores : (stores.stores || []);
    for (const r of list) {
      const hpId = r['ホットペッパーID'];
      if (hpId) _hpMapCache.set(hpId, r);
    }
  } catch (e) {
    console.error('loadHpMap: data/stores.json 読み込み失敗（予約導線は付与されません）:', e.message);
  }
  return _hpMapCache;
}

// index.html の gmap() の簡易移植（アクセス文字列から住所を抽出→無ければ店名+エリアで検索）
function gmapSearchUrl(name, area, access) {
  const base = String(name || '').trim();
  const addrMatch = String(access || '').match(/(?:愛知県)?(名古屋市[^\s（）()【】「」]+)/);
  const q = addrMatch ? `${base} ${addrMatch[1]}` : `${base} ${String(area || '').split('/')[0] || '名古屋'}`;
  return 'https://maps.google.com/search?q=' + encodeURIComponent(q);
}

function toDateJa(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${wd})`;
}

/**
 * 店舗の「詳細を見る」リンク先を決める。
 * 優先: サイト内の店舗ページ（stores/{id}.html — gen-store-pages.js が LOCAL_STORES から生成）
 * 次点: 外部リンク（id が無い＝まだ LOCAL_STORES / pending_stores.json に未登録の店）
 * id はあるのに外部リンクしか渡されない事故を防ぐため、id があれば無条件で内部リンクを優先する。
 */
function storeDetailLink(s) {
  if (s.id) return { href: `../stores/${s.id}.html`, internal: true };
  if (s.link) return { href: s.link, internal: false };
  return null;
}

function buildStores(stores) {
  if (!stores || stores.length === 0) return '';
  const hpMap = loadHpMap();
  return stores.map((s, i) => {
    const dl = storeDetailLink(s);
    const linkHtml = dl
      ? `<a class="store-link" href="${esc(dl.href)}"${dl.internal ? '' : ' target="_blank" rel="noopener"'}>${dl.internal ? '店舗ページを見る' : '詳細を見る'} →</a>`
      : '';
    // SEO-054: 予約・地図の行動導線。既存の store-link（詳細ページ）とは排他にせず併置する
    // （SEO-049 で判明したモーダルの排他分岐と同じ失敗を繰り返さない）
    const rec = s.id ? hpMap.get(s.id) : null;
    const reserveHtml = rec
      ? `<a class="store-link store-link-reserve" href="https://www.hotpepper.jp/str${esc(rec['ホットペッパーID'])}/" target="_blank" rel="noopener noreferrer" onclick="trackEvent('cta_reserve',{store_name:'${jsEsc(s.name)}'})">この店を予約する</a>`
      : '';
    const mapUrl = gmapSearchUrl(s.name, rec ? (rec['エリア'] || s.area) : s.area, rec ? rec['アクセス'] : '');
    const mapHtml = s.name
      ? `<a class="store-link store-link-map" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer" onclick="trackEvent('cta_gmap_click',{store_name:'${jsEsc(s.name)}',location:'journal_store_card'})">地図で確認する</a>`
      : '';
    const ctaRowHtml = (linkHtml || reserveHtml || mapHtml)
      ? `<div class="store-cta-row">${reserveHtml}${mapHtml}${linkHtml}</div>`
      : '';
    return `
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
          ${ctaRowHtml}
        </div>
      </div>`;
  }).join('\n');
}

function buildInsiderPoints(points) {
  if (!points || points.length === 0) return '<li>(業界人視点を記述)</li>';
  return points.map(p => `        <li>${esc(p)}</li>`).join('\n');
}

function buildSources(sources) {
  if (!sources || sources.length === 0) return '';
  const items = sources.map(s => {
    const link = `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`;
    return s.date ? `${link}<span class="source-date">（${esc(s.date)}掲載）</span>` : link;
  }).join('、 ');
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
  // ラーメン: ラーメンボウル（卵入りクローズアップ／具材豊富な俯瞰）
  'ラーメン': [
    { id: 'photo-1569718212165-3a8278d5f624', credit_name: 'Michele Blackwell', credit_url: 'https://unsplash.com/photos/rAyCBQTH7ws' },
    { id: 'photo-1638866281450-3933540af86a', credit_name: 'Marek Studzinski',  credit_url: 'https://unsplash.com/photos/NHEL1M1Cv-A' },
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
    photo: { id: 'photo-1569718212165-3a8278d5f624', credit_name: 'Michele Blackwell', credit_url: 'https://unsplash.com/photos/rAyCBQTH7ws' } },
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

/**
 * Google Places API で店舗写真を取得。
 * 要 GOOGLE_MAPS_API_KEY 環境変数。
 * 優先度: HotPepper写真なし → Google Maps写真 → Unsplash curated
 *
 * 流れ: findplacefromtext → place/details (photos) → place/photo (redirect) → CDN URL
 */
async function tryGoogleMapsPhoto(storeName, area) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  function getJson(url) {
    return new Promise((resolve) => {
      let body = '';
      const req = https.get(url, { timeout: 8000 }, (res) => {
        res.on('data', d => { body += d; });
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  // Step 1: 店名+エリアで Place ID を取得
  const query = encodeURIComponent(`${storeName} ${area} 名古屋`);
  const findRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${key}`
  );
  const placeId = findRes?.candidates?.[0]?.place_id;
  if (!placeId) return null;

  // Step 2: Place Details → photos[0].photo_reference と html_attributions
  const detailRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos,name&key=${key}`
  );
  const photo = detailRes?.result?.photos?.[0];
  if (!photo?.photo_reference) return null;
  const attribution = photo.html_attributions?.[0]
    ? photo.html_attributions[0].replace(/<[^>]+>/g, '') // HTMLタグ除去
    : 'Google Maps';

  // Step 3: place/photo → リダイレクト先の CDN URL を取得（APIキーをHTMLに埋め込まない）
  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photo.photo_reference}&key=${key}`;
  const cdnUrl = await new Promise((resolve) => {
    const req = https.get(photoApiUrl, { timeout: 8000 }, (res) => {
      res.resume();
      // Places Photo APIは302でGoogleusercontent CDNへリダイレクト
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        resolve(res.headers.location);
      } else if (res.statusCode === 200) {
        resolve(photoApiUrl); // 直接返る場合はAPIキー含むURLになるが稀
      } else {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
  if (!cdnUrl) return null;

  const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  return {
    url: cdnUrl,
    credit_name: attribution,
    credit_url: mapsUrl,
    is_store_photo: true,
    credit_source: 'Google Maps',
  };
}

/**
 * Instagram 公式 embed HTML を生成（API不要・完全無料）。
 * Instagram の利用規約上、embed.js を使った埋め込みは明示的に許可されている。
 * 参照: https://help.instagram.com/1521786464576692
 */
function buildInstagramEmbedHtml(postUrl) {
  // Instagram embed は正規パーマリンク形式（https://www.instagram.com/p/SHORTCODE/ または
  // /reel/SHORTCODE/）でないと埋め込みが描画されない。ユーザー名入りURL
  // （/tsubaki_kanayama/p/XXX/）や末尾スラッシュ無し等を正規化する。
  const m = postUrl.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  let canonicalUrl;
  if (m) {
    const kind = m[1] === 'tv' ? 'tv' : m[1]; // p / reel / tv
    canonicalUrl = `https://www.instagram.com/${kind}/${m[2]}/`;
  } else {
    // パーマリンクが抽出できない場合はそのまま（末尾スラッシュ整形のみ）
    canonicalUrl = postUrl.replace(/\?.*$/, '').replace(/\/?$/, '/');
  }
  const embedUrl = `${canonicalUrl}?utm_source=ig_embed&utm_campaign=loading`;
  // data-instgrm-captioned を省略 → 写真のみ表示（キャプション非表示）
  return `<div class="art-hero-ig">
  <blockquote class="instagram-media" data-instgrm-permalink="${esc(embedUrl)}" data-instgrm-version="14" style="background:#FFF;border:0;border-radius:3px;box-shadow:0 0 1px 0 rgba(0,0,0,.5),0 1px 10px 0 rgba(0,0,0,.15);margin:0 auto;max-width:540px;min-width:326px;padding:0;width:calc(100% - 2px);">
    <a href="${esc(embedUrl)}" target="_blank" rel="noopener">Instagramで見る</a>
  </blockquote>
  <script async src="https://www.instagram.com/embed.js"></script>
</div>`;
}

async function fetchPhotoForArticle(input) {
  const store = (input.stores || [])[0] || {};

  // 0. HotPepper 実店舗写真（stores[0].photo_url 指定時）
  if (store.photo_url) {
    const storePhoto = await tryStorePhoto(store.photo_url);
    if (storePhoto) {
      process.stdout.write(` 📷 店舗公式写真 (HotPepper)\n`);
      return { ...storePhoto, store_name: store.name || '' };
    }
  }

  // 1. Instagram 公式 embed（stores[0].instagram_post_url 指定時）
  if (store.instagram_post_url) {
    process.stdout.write(` 📷 Instagram embed\n`);
    return {
      is_instagram: true,
      url: store.instagram_post_url,
      embed_html: buildInstagramEmbedHtml(store.instagram_post_url),
    };
  }

  // 2. Google Maps写真（GOOGLE_MAPS_API_KEY 設定時）
  if (store.name) {
    const googlePhoto = await tryGoogleMapsPhoto(store.name, store.area || '');
    if (googlePhoto) {
      process.stdout.write(` 📷 Googleマップ写真: ${googlePhoto.credit_name}\n`);
      return { ...googlePhoto, store_name: store.name };
    }
  }

  // 3〜4. かつてはここで Unsplash API / ジャンル別 curated Unsplash に落ちていたが、
  //       汎用ストック写真は CLAUDE.md 制約9 で全面禁止（validator 項目15 も FAIL にする）。
  //       落ちる先を用意しておくと「とりあえず絵が出る」ため、写真が手配できていない事実が
  //       隠れる。実写が無いなら、取り繕わず記事固有のイメージ図に倒すのが正しい振る舞い。
  process.stdout.write(` ⚠️  実写を取得できませんでした\n`);
  return null;
}

function buildHeroImageSection(input) {
  // Instagram embed（blockquote をそのまま返す）
  if (input.hero_image_is_instagram && input.hero_image_embed_html) {
    return input.hero_image_embed_html;
  }

  const imgUrl = input.hero_image_url;
  if (!imgUrl) return '';
  const isStorePhoto  = input.hero_image_is_store_photo;
  const creditSource  = input.hero_image_credit_source; // 'Google Maps' | null
  const creditUrl     = input.hero_image_credit_url  || '';
  const creditName    = input.hero_image_credit_name || '';

  // クレジットは「実際の画像の出所」から決める。
  // 旧実装は else 節で無条件に「/ Unsplash」を付けており、自作イメージ図や
  // Google Places 写真にまで Unsplash と表示していた（公開済み15本が誤クレジット）。
  // 汎用ストック写真は制約9で禁止済みなので、Unsplash を既定値にすること自体が誤り。
  // 記事HTMLは journal/ 配下にあるため、自作図の参照は「../assets/…」になる。
  // 旧実装の /^\.?\/?assets\// は "assets/" "./assets/" "/assets/" しか拾えず、
  // 実際に使われている "../assets/" を取りこぼして「出所不明（要確認）」と書いていた
  // （公開済み4本が該当）。自作図なのに出所不明と表示されるのは信頼を直接損なう。
  const isSelfHosted = /(^|\/)assets\/journal-(figures|photos)\//.test(imgUrl)
                    || /^(\.{0,2}\/)*assets\//.test(imgUrl)
                    || /nagoya-bites\.com\/assets\//.test(imgUrl);
  const isGooglePhoto = /googleusercontent\.com/.test(imgUrl);
  const isHotPepper = /imgfp\.hotp\.jp|hotpepper\.jp/.test(imgUrl);
  // プレスリリースの報道用画像（CLAUDE.md 優先3・PR TIMES 企業規約 第6条3項）
  const isPressPhoto = /prcdn\.freetls\.fastly\.net|prtimes\.jp\/i\//.test(imgUrl);

  const link = (url, text) => url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`
    : esc(text);

  let creditHtml;
  if (isSelfHosted) {
    // リポジトリ内に self-host した「記事固有のイメージ図」（CLAUDE.md 写真ルールの最終手段）
    creditHtml = '編集部作成のイメージ図';
  } else if (isPressPhoto) {
    // 報道目的の利用許諾に依拠するため、提供元（発行企業）と出所（リリース）を必ず出す。
    // 出所を書かない報道用画像の利用は、許諾の前提を外れる。
    const company = input.hero_image_credit_name || '発行企業';
    const releaseUrl = input.hero_image_release_url || input.hero_image_credit_url || '';
    creditHtml = `提供 ${esc(company)}（${link(releaseUrl, 'プレスリリース')}より）`;
  } else if (creditSource === 'Google Maps' || isGooglePhoto) {
    creditHtml = `${link(creditUrl, creditName || '店舗写真')} / ${link('https://maps.google.com', 'Google Maps')}`;
  } else if (isStorePhoto || isHotPepper) {
    creditHtml = `${link(creditUrl, creditName || '店舗公式写真')} / ${link('https://www.hotpepper.jp', 'HotPepper')}`;
  } else if (creditName) {
    creditHtml = link(creditUrl, creditName);
  } else {
    // 旧実装はここで「出所不明（要確認）」と書いて公開まで通していた（公開済み4本が該当）。
    // 出所を書けない写真は載せない。取り繕わず、生成を止めて出典を替えさせる。
    throw new Error(
      `ヒーロー写真の出所を特定できません: ${imgUrl}\n` +
      `  「出所不明（要確認）」と書いて公開するのは禁止です。\n` +
      `  CLAUDE.md「写真ソースの優先順」に従い、優先1〜4 のいずれかで出典を確定させるか、\n` +
      `  その記事専用のイメージ図（/assets/journal-figures/${input.slug}.svg）に倒してください。`
    );
  }

  // 帰属の証跡を成果物自身に刻む（主張ではなく証跡・CLAUDE.md 品質ゲート原則2）。
  // Places CDN の URL からは店名を逆引きできないため、これが無いと第三者は
  // 「この写真がこの記事の店のものか」を後から検算できない。
  const heroSource = isSelfHosted ? (/journal-figures/.test(imgUrl) ? 'figure' : 'self-hosted')
                   : isPressPhoto ? 'press'
                   : isGooglePhoto ? 'places'
                   : isHotPepper ? 'hotpepper' : 'unknown';
  const heroStore = input.hero_image_store_name || '';
  const attrs = ` data-hero-source="${esc(heroSource)}"` + (heroStore ? ` data-hero-store="${esc(heroStore)}"` : '');

  return `<figure class="art-hero-img"${attrs}>
  <img src="${esc(imgUrl)}" alt="${esc(input.title)}" loading="lazy" decoding="async">
  <figcaption class="art-img-credit">Photo: ${creditHtml}</figcaption>
</figure>`;
}

// --------------- Instagram CTA（アカウントリンク）---------------

/**
 * stores[0].instagram_account_url または input.instagram_account_url があれば
 * Instagram プロフィールへのCTAブロックを生成する。
 * instagram_post_url がある場合は embed を優先するため、CTAは出力しない。
 */
function buildInstagramCta(input) {
  const store = (input.stores || [])[0] || {};
  // embedがある場合はCTA不要
  if (store.instagram_post_url || input.hero_image_is_instagram) return '';

  const accountUrl = store.instagram_account_url || input.instagram_account_url;
  if (!accountUrl) return '';

  // @handle を抽出
  const handle = accountUrl.match(/instagram\.com\/([^/?#]+)/)?.[1] || accountUrl;
  const storeName = store.name || input.title || '';
  const noteText = store.genre ? `${store.genre}の料理写真・雰囲気はこちら` : '料理写真・店内雰囲気はこちら';

  return `<div class="art-ig-cta">
      <div class="art-ig-cta-body">
        <a href="${esc(accountUrl)}" target="_blank" rel="noopener">
          <p class="art-ig-cta-label">Instagram</p>
          <p class="art-ig-cta-handle">@${esc(handle)}</p>
          <p class="art-ig-cta-note">${esc(noteText)}</p>
        </a>
      </div>
    </div>`;
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

// --------------- NotebookLM画像生成用スライド ---------------

const NOTEBOOKLM_SLIDES_HEADER =
`<!-- NotebookLM等で1枚ずつ画像を生成するための素材。各スライドに「解説文（NotebookLMに読ませる本文）」と「画像プロンプト」を用意。
     画像方針（CLAUDE.md 制約#9）: 実在の料理・店舗の写真を偽装しない。記事テーマを"説明する"図解/インフォグラフィック/抽象イラスト（イメージ図）として生成する。
     実在の料理・店内写真が必要なときは上の「## 写真候補」の公式Instagram embed・Googleマップ実写を使う（AI生成画像では代用しない）。
     画像プロンプト共通スタイル: フラットでミニマルな編集的インフォグラフィック、和モダンで落ち着いた配色、画像内に文字（特に日本語）は入れない。 -->`;

function buildNotebookLmSlidesMd(slides) {
  if (!slides || slides.length === 0) {
    return NOTEBOOKLM_SLIDES_HEADER +
      '\n\n*(NotebookLM画像生成用スライド未作成 — Editorが各スライドの「解説文＋画像プロンプト（イメージ図・図解スタイル）」を作成して埋めること)*';
  }
  const blocks = slides.map((s, i) => {
    let b = `### ${i + 1}枚目：${s.heading || ''}`;
    b += `\n\n**解説文（NotebookLMに読ませる本文）**\n${s.body || ''}`;
    b += `\n\n**画像プロンプト（イメージ図・図解スタイル）**\n${s.image_prompt || ''}`;
    return b;
  });
  return NOTEBOOKLM_SLIDES_HEADER + '\n\n' + blocks.join('\n\n---\n\n');
}

// --------------- OGP画像の解決（SNS配信用）---------------

/**
 * og:image を「SNSクローラが実際に描画できる絶対URLのラスタ画像」に確定させる。
 *
 * X / Facebook / LINE は og:image の SVG をレンダリングしない。
 * 図解（assets/*-figures/*.svg）を hero にした日は、そのままだと
 * SNS共有時にサムネイルが出ず、日次ジャーナルの主要導線（SNS手動投稿）の CTR を落とす。
 * そこで hero が図解SVGのときは 1200x630 PNG を併せて出力し、og:image はそちらを指す。
 * 記事本文の <img> は SVG のまま（ベクタで綺麗・軽い）。
 *
 * 併せて、相対パスの og:image を絶対URLにする（クローラは記事URL基準で解決しない）。
 *
 * 失敗しても記事生成は止めない（ヘッドレス実行で成果物を失わないため）。
 * 未変換は scripts/normalize_og_images.js --check / render_og_figures.js --check が拾う。
 */
function resolveOgImage(input) {
  let og = input.og_image || '';
  if (!og) return;

  const hit = OG.matchFigureUrl(og);
  if (hit) {
    const svgPath = path.join(ROOT, hit.rel);
    const pngRel = hit.rel.replace(/\.svg$/i, '.png');
    const pngPath = path.join(ROOT, pngRel);
    if (fs.existsSync(svgPath)) {
      try {
        if (!OG.isPngFresh(svgPath, pngPath)) {
          const r = OG.renderSvgToPng(svgPath, pngPath);
          console.log(`  🖼  OGP用PNGを生成: ${pngRel} (${Math.round(r.bytes / 1024)}KB / ${r.renderer})`);
        }
        input.og_image = OG.absoluteFigureUrl(pngRel);
        return;
      } catch (e) {
        console.warn(`  ⚠️  OGP用PNGの生成に失敗（og:image はSVGのまま）: ${e.message}`);
        console.warn('     → 後で node scripts/render_og_figures.js && node scripts/normalize_og_images.js');
      }
    }
  }

  // 相対パス → 絶対URL（journal/<slug>.html を基準に解決する）
  if (!/^https?:\/\//i.test(og) && !og.startsWith('data:')) {
    const abs = path.resolve(path.join(ROOT, 'journal'), og);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (!rel.startsWith('..')) input.og_image = `${OG.SITE_ORIGIN}/${rel}`;
  }
}

function renderHtml(input) {
  let html = fs.readFileSync(HTML_TEMPLATE, 'utf8');
  const themeLabel = ({
    today_one: '今日の1軒', industry_insider: '業界の裏側',
    weekly_digest: '週次話題店', seasonal: '季節短信', flexible: '今日の1軒'
  })[input.theme] || '';
  const replacements = {
    '{{TITLE}}': esc(input.title),
    '{{TITLE_HTML}}': input.title_html || esc(input.title),
    '{{DESCRIPTION}}': esc(input.description),
    '{{KEYWORDS}}': esc(input.keywords || ''),
    '{{SLUG}}': esc(input.slug),
    '{{OG_IMAGE}}': esc(input.og_image || 'https://nagoya-bites.com/icons/icon-512.png'),
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
    '{{INSTAGRAM_CTA}}': buildInstagramCta(input),
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
    '{{JOURNAL_URL}}': `https://nagoya-bites.com/journal/${input.slug}.html`,
    '{{NOTE_TITLE}}': sns.note_title || input.title,
    '{{NOTE}}': sns.note_body || '(Note本文)',
    '{{INSTAGRAM}}': igBody,
    '{{X}}': xThread || '(Xスレッド)',
    '{{PHOTO_SUGGESTIONS}}': buildPhotoSuggestionsMd(input.photo_suggestions),
    '{{NOTEBOOKLM_SLIDES}}': buildNotebookLmSlidesMd(input.notebooklm_slides)
  };
  Object.entries(replacements).forEach(([k, v]) => { md = md.split(k).join(v); });
  return md;
}

/**
 * ヒーロー写真が「この記事の店」の写真であることを、生成時に確かめる。
 *
 * 公開前QA（validator 15b）と日次CI監査（audit_journal_photos.js）でも同じ判定器を通すが、
 * 生成の段階で止めた方が、間違った写真の付いたドラフトがそもそも作られない。
 * 落とすのではなく「出典を替えるか、記事固有の図に倒す」よう促す。
 */
function assertHeroBelongsToArticle(input) {
  const url = input.hero_image_url;
  if (!url) return;
  if (input.hero_image_is_instagram) return; // IG embed はアカウント照合を validator 側で行う

  const verdict = judgeHero({
    slug: input.slug,
    date: input.date,
    heroUrl: url,
    heroStore: input.hero_image_store_name || '',
    caption: '',
    storeNames: (input.stores || []).map(s => s.name).filter(Boolean),
  });

  const fails = verdict.findings.filter(f => f.level === 'fail');
  if (!fails.length) return;

  throw new Error(
    `ヒーロー写真がこの記事のものではありません。\n` +
    fails.map(f => `  [${f.code}] ${f.msg}`).join('\n') +
    `\n\n  対処（CLAUDE.md「写真ソースの優先順」）:\n` +
    `    1. 主役店の公式Instagram投稿URL → stores[0].instagram_post_url\n` +
    `    2. 主役店の HotPepper 写真URL     → stores[0].photo_url\n` +
    `    3. GOOGLE_MAPS_API_KEY を設定して Places のオーナー投稿写真を自動取得\n` +
    `    4. どれも無理なら、その記事専用のイメージ図を作る\n` +
    `       → /assets/journal-figures/${input.slug}.svg を作成し hero_image_url に指定\n` +
    `\n  他店の写真を借りるのは禁止です（読者から見て記事と写真の対応が壊れます）。`
  );
}

async function main() {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  // --- ヒーロー画像の決定 ---
  // 優先順位:
  //   1. stores[0].instagram_post_url → Instagram 公式 embed（実投稿が記事内に表示される）
  //   2. stores[0].photo_url（HotPepper / 許諾済み）/ Google Maps Places 写真
  //   3. 明示的に指定された hero_image_url（手動指定のストック等）
  //   4. ジャンル別 curated Unsplash（フォールバック）
  // instagram_post_url は手動指定の hero_image_url より優先する（実店舗写真を最優先）。
  const store0 = (input.stores || [])[0] || {};
  const hasRealPhotoSource = store0.instagram_post_url || store0.photo_url || process.env.GOOGLE_MAPS_API_KEY;

  if (store0.instagram_post_url) {
    // 実投稿の embed を最優先（手動 hero_image_url があっても上書き）
    process.stdout.write('  📷 Instagram embed（公式投稿）\n');
    input.hero_image_is_instagram = true;
    input.hero_image_embed_html   = buildInstagramEmbedHtml(store0.instagram_post_url);
    input.hero_image_url          = store0.instagram_post_url; // ログ用のみ
    // Instagram embed は og:image に使えないので og_image は維持（未指定なら空）
  } else if (!input.hero_image_url || hasRealPhotoSource) {
    // hero_image_url 未指定、または実写真ソース（photo_url/Maps）がある場合は自動取得
    process.stdout.write('  📷 画像を自動取得中...');
    const photo = await fetchPhotoForArticle(input);
    if (photo) {
      if (photo.is_instagram) {
        input.hero_image_is_instagram = true;
        input.hero_image_embed_html   = photo.embed_html;
        input.hero_image_url          = photo.url;
      } else {
        input.hero_image_url            = photo.url;
        input.hero_image_credit_url     = photo.credit_url;
        input.hero_image_credit_name    = photo.credit_name;
        input.hero_image_is_store_photo = photo.is_store_photo || false;
        input.hero_image_credit_source  = photo.credit_source || null;
        input.hero_image_store_name     = photo.store_name || '';
        input.og_image = input.og_image || photo.url;
      }
    }
  } else {
    input.og_image = input.og_image || input.hero_image_url;
  }

  // --- ヒーロー写真の帰属チェック（2026-08-17 の事故の再発防止）---
  // 手書きの hero_image_url は、記事の主役店と無関係な写真でも通ってしまう経路だった。
  // 実際、主役2店に写真が無かった日に、記事へ一行触れただけの別店の販促バナーが顔になった。
  // 判定器は scripts/lib/hero_photo_gate.js の1本（生成時・公開前QA・日次CI監査が共有）。
  assertHeroBelongsToArticle(input);

  // og:image を SNS が描画できる形（絶対URL・ラスタ画像）に確定させる（ISSUE-095）
  // 帰属チェックの「後」に置くこと。先に置くと、記事に載せてはいけない画像の
  // PNG を生成してしまう（不採用になる画像をリポジトリに残さない）。
  resolveOgImage(input);

  const htmlPath = path.join(DRAFTS_DIR, input.slug + '.html');
  const mdPath = path.join(POSTS_DIR, input.date + '.md');
  fs.writeFileSync(htmlPath, renderHtml(input));

  const generateSns = shouldGenerateSnsDraft();
  if (generateSns) {
    fs.writeFileSync(mdPath, renderMd(input));
  }

  console.log(`✅ Draft 生成:\n  - ${path.relative(ROOT, htmlPath)}` +
    (generateSns
      ? `\n  - ${path.relative(ROOT, mdPath)}`
      : `\n  - (SNS原稿は data/journal_sns_draft_policy.json の設定により生成をスキップ)`));
  if (input.hero_image_url) {
    console.log(`  🖼  ヒーロー画像: ${input.hero_image_url}`);
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { renderHtml, renderMd };
