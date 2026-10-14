'use strict';
/**
 * scripts/lib/top_picks.js — トップ（index.html）の「今日の話題店」と「よく見られている店」を、
 * 生成時に静的な HTML として描く部品（I-24・P-399）。
 *
 * 背景:
 *   - 以前の話題店の行は、ページを開いたあとに JS が全店のデータから描いていた。インラインの
 *     TOP50 には 5 件のうち 2 件しか入っておらず、最初は 2 枚→全店の読み込み後に 5 枚へ増える
 *     （レイアウトがずれ、写真が遅れて出る）。クローラーにも見えない。
 *   - 2026-10-13 の実測: 選定の 1 位「小菜一碟」が本番の行に出ていなかった。build.js の焼き込みは
 *     「店名＋エリアの完全一致」で、選定側のエリア（名古屋市東区相生町）と data/stores.json の
 *     エリア（東区・相生町）が違うため一致せず、CI のログに「マッチ失敗」と出るだけで 4 枚になっていた。
 *     → ここでは「店名が 1 件ならそれ、複数ならエリア一致、決められなければ出さずに理由を返す」にし、
 *       黙って落とさない（呼び出し側が警告に出す）。
 *
 * 決まり（CLAUDE.md 制約10・品質ゲート原則1）:
 *   - 注目の理由に書くのは、後から第三者が確かめられる事実だけ。
 *       ・出典 URL の別サイトの数（trending_stores.json / manual_stores.json の 出典URL[]）
 *       ・確認した日（選定の日 − 鮮度日数。選定器 pick_daily_trending5.js と同じ計算）
 *     「人気」「話題沸騰」のような根拠の無い語は書かない。作れない部分は出さない。
 *     選定器が数える「媒体数」（トレンド情報源のラベル数＋出典の別ホストを足した値）は検算できないので使わない。
 *   - 選び方（scripts/pick_daily_trending5.js）には触れない。ここは描くだけ。
 *   - 写真は index.html の nbImage / nbSrcset と同じ URL にする（tests/top_picks.test.js が同じ入力で突き合わせる）。
 *     ただし Google マップの写真（lh3.googleusercontent.com）だけは、保存してある 1200px の原寸（実測 100〜560KB）ではなく、
 *     カードの大きさに合わせた幅（=w480 / srcset は w320・w480）を CDN に指定する。最初の画面に出すため、5 枚で 1.58MB → 0.24MB。
 *     客が投稿した写真（写真出所=places-user）には撮影者のクレジットを出す（data/photo_policy.json の userPhotoRequiresCredit）。
 *   - 店舗ページへのリンクは、gen-store-pages.js の toSlug で候補を作り、そのページの h1 が本人の店名か確かめる。
 *     誘導ページ（古い ID）なら誘導先を辿る。確かめられなければ検索のディープリンク（#q=店名）に落とす。
 */

const { normName, isRedirectStub, stubTarget, readH1 } = require('./store_orphans');

// ── 文字の逃がし ─────────────────────────────────────────────
const ENTITY_CHAR = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
function decodeEntities(s) {
  return String(s == null ? '' : s).replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ENTITY_CHAR[k]);
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── 画像の URL（index.html の nbImage / nbSrcset と同じ規則）──────────────
const NB_IMG_CDN = 'https://wsrv.nl/';
function nbImage(url, width) {
  if (!url || typeof url !== 'string') return url;
  if (url.indexOf('data:') === 0) return url;
  if (url.indexOf('wsrv.nl') !== -1) return url;
  if (url.charAt(0) === '/') return url;
  if (url.indexOf('googleusercontent.com') !== -1) return url;
  const w = width || 1200;
  const cleanUrl = url.replace(/^https?:\/\//, '');
  let primary = cleanUrl;
  let fallback = '';
  const hpMatch = cleanUrl.match(/^(imgfp\.hotp\.jp\/.+?)_(\d+)\.jpg(\?.*)?$/);
  if (hpMatch && hpMatch[2] !== '480') {
    primary = hpMatch[1] + '_480.jpg';
    fallback = cleanUrl;
  } else if (!hpMatch) {
    const hpMaster = cleanUrl.match(/^(imgfp\.hotp\.jp\/.+?)\.jpg(\?.*)?$/);
    if (hpMaster) fallback = hpMaster[1] + '_480.jpg';
  }
  let qs = '?url=' + encodeURIComponent(primary) + '&w=' + w + '&output=webp&q=82&we=1&sharp=2';
  if (fallback) qs += '&default=' + encodeURIComponent(fallback);
  return NB_IMG_CDN + qs;
}
function nbSrcset(url, widths) {
  if (!url || typeof url !== 'string' || url.indexOf('data:') === 0) return '';
  if (url.charAt(0) === '/' || url.indexOf('googleusercontent.com') !== -1) return '';
  return widths.map((w) => nbImage(url, w) + ' ' + w + 'w').join(', ');
}

// Google マップの写真の CDN（lh3.googleusercontent.com）は、末尾の =s1600-w1200 のような指定で大きさを選べる。
// 最初の画面に出す小さなカード（表示は 132〜200px 幅）に、保存してある 1200px の原寸（実測 100〜560KB）は重すぎるため、
// カードに合う幅を指定し直す。同じ CDN・同じ写真で、画像を作り変えるのではなく大きさの指定を変えるだけ（原寸のままの src は他の面が使う）。
function googleSized(url, w) {
  const m = /^(https:\/\/lh\d+\.googleusercontent\.com\/[^=\s]+)=[a-z0-9-]+$/i.exec(String(url || ''));
  return m ? `${m[1]}=w${w}` : String(url || '');
}
// カードの <img> の src / srcset。Google の写真は幅を指定し直し、ほかの写真（ホットペッパー等）は index.html と同じ規則
function cardImage(url) {
  const g480 = googleSized(url, 480);
  if (g480 !== url) return { src: g480, srcset: `${googleSized(url, 320)} 320w, ${g480} 480w` };
  return { src: nbImage(url, 560), srcset: nbSrcset(url, [280, 560]) };
}

// ── 出典の別サイト数 ─────────────────────────────────────────
// 「ssl.tabelog.com」と「tabelog.com」を同じサイトと数える（登録ドメインに丸める）。
const SECOND_LEVEL = new Set(['co', 'or', 'ne', 'ac', 'go', 'ed', 'gr', 'ad', 'lg', 'com', 'net', 'org', 'gov', 'edu']);
function siteOf(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return '';
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch (_) { return ''; }
  host = host.replace(/^www\./, '');
  if (!host || host.indexOf('.') < 0) return '';
  const labels = host.split('.');
  if (labels.length <= 2) return labels.join('.');
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  if (tld.length === 2 && SECOND_LEVEL.has(sld)) return labels.slice(-3).join('.');
  return labels.slice(-2).join('.');
}
function sourceSites(urls) {
  const seen = new Set();
  for (const u of Array.isArray(urls) ? urls : []) {
    const s = siteOf(u);
    if (s) seen.add(s);
  }
  return Array.from(seen);
}

// ── 日付 ─────────────────────────────────────────────────────
function addDays(ymd, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function shortDate(ymd) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}` : '';
}

// 注目の理由の 1 行。作れない部分は出さない（両方作れなければ空）。
function reasonFor({ siteCount, detectedOn }) {
  const parts = [];
  if (siteCount > 0) parts.push(`${siteCount}サイトで紹介`);
  const d = shortDate(detectedOn);
  if (d) parts.push(`${d}に確認`);
  return parts.join('・');
}

// ── 選定の 1 件 → 店舗レコード ───────────────────────────────
// 黙って落とさない: 決められないときは store=null と理由を返し、呼び出し側が警告に出す。
function resolvePickStore(pick, stores) {
  const name = pick && pick['店名'];
  if (!name) return { store: null, why: '店名がない' };
  const byName = (stores || []).filter((s) => s && s['店名'] === name);
  if (byName.length === 0) return { store: null, why: 'data/stores.json に同じ店名がない' };
  if (byName.length === 1) return { store: byName[0], why: '' };
  const byArea = byName.filter((s) => s['エリア'] === pick['エリア']);
  if (byArea.length === 1) return { store: byArea[0], why: '' };
  return { store: null, why: `同じ店名が ${byName.length} 件あり、エリアでも 1 件に決められない` };
}

// 出典の記録（trending_stores.json / manual_stores.json の stores[]）から、その店の 出典URL を集める。
function collectSourceUrls(name, area, recordLists) {
  const urls = [];
  for (const list of recordLists || []) {
    const same = (list || []).filter((r) => r && r['店名'] === name);
    // 同名が複数あるときはエリアが合うものだけ（合わなければ使わない＝別の店の出典を混ぜない）
    const hit = same.length <= 1 ? same : same.filter((r) => r['エリア'] === area);
    for (const r of hit) for (const u of Array.isArray(r['出典URL']) ? r['出典URL'] : []) urls.push(u);
  }
  return urls;
}

// ── 店舗ページへのリンク ─────────────────────────────────────
function resolvePageHref(store, { toSlug, readPage }) {
  const name = store['店名'];
  const want = normName(name);
  const base = toSlug(store);
  for (let i = 1; i <= 6; i++) {
    let slug = i === 1 ? base : `${base}-${i}`;
    let html = readPage(slug);
    if (html == null) continue;
    const seen = new Set([slug]);
    let hops = 0;
    while (html != null && isRedirectStub(html) && hops++ < 2) {
      const t = stubTarget(html);
      if (!t || seen.has(t)) { html = null; break; }
      seen.add(t);
      slug = t;
      html = readPage(slug);
    }
    if (html == null || isRedirectStub(html)) continue;
    if (normName(readH1(html)) === want) return `stores/${encodeURIComponent(slug)}.html`;
  }
  return `index.html#q=${encodeURIComponent(name)}`;
}

// ── 表示用の短い言い方 ───────────────────────────────────────
function areaLabel(store) {
  return String(store['エリア'] || '').replace(/^名古屋市/, '').trim();
}
function genreLabel(store) {
  return String(store['ジャンル'] || '').split(/[・、,，]/)[0].trim();
}

// ── 1 枚のカード ─────────────────────────────────────────────
// model: { name, area, genre, href, photo, credit, reason, eager }
// 表示幅: 最初の画面の縦の一覧（1024px 以上）は 132px、横に並べる行は min(40vw,176px)。下のほうの行は min(44vw,200px)
const IMG_SIZES = {
  trend_today: '(min-width:1024px) 132px, (min-width:440px) 176px, 40vw',
  ranking: '(min-width:455px) 200px, 44vw',
};
function renderCard(model, source) {
  const name = esc(model.name);
  const img = model.photo ? cardImage(model.photo) : null;
  const photo = img
    ? `<img class="tp-img" src="${esc(img.src)}"${img.srcset ? ` srcset="${esc(img.srcset)}" sizes="${IMG_SIZES[source] || IMG_SIZES.trend_today}"` : ''} alt="${name}" width="280" height="210"${model.eager ? '' : ' loading="lazy"'} decoding="async" onerror="nbImgFallback(this)">`
    : '<span class="tp-none" aria-hidden="true">写真準備中</span>';
  const credit = model.credit
    ? `<span class="photo-credit" title="写真: ${esc(decodeEntities(model.credit))}（Google マップの利用者が投稿した写真）">📷 ${esc(decodeEntities(model.credit))}</span>`
    : '';
  const meta = [model.area, model.genre].filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join('');
  return `    <li class="tp-item"><a class="tp-card" href="${esc(model.href)}" data-store="${name}" data-area="${esc(model.areaRaw || '')}" data-source="${esc(source)}">`
    + `<span class="tp-photo">${photo}${credit}</span>`
    + '<span class="tp-body">'
    + `<span class="tp-name">${name}</span>`
    + (meta ? `<span class="tp-meta">${meta}</span>` : '')
    + (model.reason ? `<span class="tp-reason">${model.reason.split('・').map((p) => `<span>${esc(p)}</span>`).join('・')}</span>` : '')
    + '</span></a></li>';
}

function cardModel(store, extra) {
  const photoUrl = typeof store['写真URL'] === 'string' ? store['写真URL'] : '';
  return Object.assign({
    name: store['店名'],
    area: areaLabel(store),
    areaRaw: store['エリア'] || '',
    genre: genreLabel(store),
    photo: photoUrl,
    credit: store['写真出所'] === 'places-user' ? String(store['写真クレジット'] || '').trim() : '',
  }, extra);
}

// ── 今日の話題店 ─────────────────────────────────────────────
/**
 * @param {{date:string, picks:object[], stores:object[], records:object[][], pageHref:(s:object)=>string}} input
 * @returns {{html:string, cards:object[], skipped:{name:string, why:string}[]}}
 */
function buildTrendPicks(input) {
  const { date, picks, stores, records, pageHref } = input;
  const skipped = [];
  const cards = [];
  for (const pick of picks || []) {
    const { store, why } = resolvePickStore(pick, stores);
    if (!store) { skipped.push({ name: pick && pick['店名'], why }); continue; }
    const sites = sourceSites(collectSourceUrls(store['店名'], pick['エリア'], records));
    const days = Number.isFinite(Number(pick['鮮度日数'])) ? Number(pick['鮮度日数']) : NaN;
    const detectedOn = Number.isNaN(days) ? '' : addDays(date, -days);
    cards.push(cardModel(store, {
      href: pageHref(store),
      reason: reasonFor({ siteCount: sites.length, detectedOn }),
      eager: cards.length < 3,
    }));
  }
  if (cards.length === 0) return { html: '', cards, skipped };
  const html = `<section class="trend-picks" id="trend-picks" aria-labelledby="trend-picks-title">
  <div class="trend-picks-head">
    <h2 id="trend-picks-title">今日の話題店</h2>
    <span class="trend-picks-date">${esc(shortDate(date))}更新</span>
  </div>
  <ul class="trend-picks-list">
${cards.map((c) => renderCard(c, 'trend_today')).join('\n')}
  </ul>
</section>`;
  return { html, cards, skipped };
}

// ── よく見られている店（閲覧数の下限つき）──────────────────────
/**
 * 閲覧数は GA4 の modal_open（data/view_counts.json）。件数が少ない日に「1回閲覧」の店を並べない:
 * 1 店あたりの下限 minViewsPerStore を満たす店が minStoresToShow 店そろわなければ、区画ごと出さない。
 * @returns {{html:string, cards:object[]}}
 */
function buildViewRanking(input) {
  const { stores, policy, lookbackDays, pageHref } = input;
  const minViews = Number(policy.minViewsPerStore) || 10;
  const minStores = Number(policy.minStoresToShow) || 5;
  const maxStores = Number(policy.maxStores) || 10;
  const days = Number(lookbackDays) || 30;
  const ranked = (stores || [])
    .map((s) => ({ s, n: parseInt(s['閲覧数'], 10) || 0 }))
    .filter((x) => x.n >= minViews)
    .sort((a, b) => (b.n - a.n) || String(a.s['店名']).localeCompare(String(b.s['店名']), 'ja'))
    .slice(0, maxStores);
  if (ranked.length < minStores) return { html: '', cards: [] };
  const cards = ranked.map((x, i) => cardModel(x.s, {
    href: pageHref(x.s),
    reason: `${days}日で${x.n}回閲覧`,
    eager: false,
    i,
  }));
  const html = `<section class="ranking-picks" id="ranking-picks" aria-labelledby="ranking-picks-title">
  <div class="trend-picks-head">
    <h2 id="ranking-picks-title">よく見られている店</h2>
    <span class="trend-picks-date">直近${days}日</span>
  </div>
  <ul class="trend-picks-list">
${cards.map((c) => renderCard(c, 'ranking')).join('\n')}
  </ul>
</section>`;
  return { html, cards };
}

module.exports = {
  decodeEntities, esc, nbImage, nbSrcset, googleSized, cardImage, siteOf, sourceSites, addDays, shortDate, reasonFor,
  resolvePickStore, collectSourceUrls, resolvePageHref, areaLabel, genreLabel,
  renderCard, cardModel, buildTrendPicks, buildViewRanking,
};
