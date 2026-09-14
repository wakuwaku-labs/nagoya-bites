'use strict';
/**
 * scripts/gen_area_genre_pages.js
 *
 * エリア×ジャンル×条件 静的一覧ページ（stores/area/配下）の生成器。
 * data/area_genre_pages_policy.json（唯一の情報源）に沿って
 * scripts/lib/area_genre_pages.js のプランナーが計算したページ一覧を
 * 決定的に HTML 化する。手書き禁止・閾値変更はポリシーJSONで行う（CLAUDE.md 制約10）。
 *
 * 使い方:
 *   node scripts/gen_area_genre_pages.js              # 生成 + sitemap.xml 更新 + manifest 出力
 *   node scripts/gen_area_genre_pages.js --dry-run     # 書き込みなし・件数のみ表示
 *   node scripts/gen_area_genre_pages.js --check       # ディスク状態が計画と一致するか検査（CI向け・exit 1）
 *   node scripts/gen_area_genre_pages.js --limit N     # 先頭N件のみ生成（テスト用）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const siteChrome = require('./lib/site_chrome');
const { loadStores } = require('./lib/load_stores');
const {
  loadPolicy, planPages, parsePriceBand, accessSummary,
} = require('./lib/area_genre_pages');
const trustDisplay = require('./lib/trust_display');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://nagoya-bites.com';
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const MANIFEST_PATH = path.join(ROOT, 'data', 'area_genre_pages_manifest.json');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
// --check は apply_site_chrome.js --check と同じ意味（純粋な読み取り専用の差分検査）。
// ディスクに書き込まずに「計画どおりか」だけを判定する。実際に生成・更新したいときは
// フラグ無し（CI の日次生成ステップ）または --dry-run（書き込まず件数だけ見る）を使う。
const DRY_RUN = args.includes('--dry-run') || CHECK;
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

function esc(s) { return siteChrome.esc(s); }

// ================================================================
// 集計ヘルパー（すべて実データからの決定的な集計。推測は含まない・制約10）
// ================================================================

function priceModeStat(stores) {
  const counts = new Map();
  for (const s of stores) {
    const p = (s['価格帯'] || '').trim();
    if (!p) continue;
    counts.set(p, (counts.get(p) || 0) + 1);
  }
  let best = null, bestN = 0;
  for (const [p, n] of counts) if (n > bestN) { best = p; bestN = n; }
  const withPrice = [...counts.values()].reduce((a, b) => a + b, 0);
  return best ? { band: best, count: bestN, coverage: withPrice } : null;
}

function topStations(stores, n) {
  const counts = new Map();
  let withAccess = 0;
  for (const s of stores) {
    const a = s['アクセス'];
    if (typeof a !== 'string' || !a) continue;
    const m = a.match(/([^\s、。]+駅)/);
    if (!m) continue;
    withAccess++;
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  if (withAccess < stores.length * 0.5) return [];
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function countHighRating(stores) {
  return stores.filter(s => {
    const score = parseFloat(s['Google評価']);
    const reviews = parseInt(s['口コミ数'], 10);
    return Number.isFinite(score) && score >= 4.0 && Number.isFinite(reviews) && reviews >= 5;
  }).length;
}

function sortForDisplay(stores) {
  return [...stores].sort((a, b) => {
    const ra = parseInt(a['口コミ数'], 10) || 0, rb = parseInt(b['口コミ数'], 10) || 0;
    const sa = parseFloat(a['Google評価']) || 0, sb = parseFloat(b['Google評価']) || 0;
    const okA = ra >= 5 ? 1 : 0, okB = rb >= 5 ? 1 : 0;
    if (okA !== okB) return okB - okA;
    if (okA && sb !== sa) return sb - sa;
    if (rb !== ra) return rb - ra;
    return (a['店名'] || '').localeCompare(b['店名'] || '', 'ja');
  });
}

function storeSlug(s) {
  if (s['ホットペッパーID']) return s['ホットペッパーID'];
  const ascii = (s['店名'] || '').replace(/[^\x00-\x7F]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii.length >= 3) return ascii;
  return 'store-' + Buffer.from(s['店名'] || '', 'utf8').toString('hex').slice(0, 16);
}

// ================================================================
// ページタイトル・要約
// ================================================================

function pageName(page) {
  if (page.type === 'root') return 'stores/area/index.html';
  return page.url;
}

function titleFor(page) {
  if (page.type === 'root') return 'エリア×ジャンルで探す｜NAGOYA BITES 店舗一覧';
  if (page.type === 'area') return `${page.area.label}の飲食店 ${page.stores.length}軒｜NAGOYA BITES`;
  const seasonal = seasonalSuffix(page);
  if (page.type === 'genre') return `${page.area.label}の${page.genre.label} ${page.stores.length}軒｜予算・個室・深夜で比較${seasonal} | NAGOYA BITES`;
  return `${page.area.label}の${page.genre.label}で${page.cond.label} ${page.stores.length}軒${seasonal} | NAGOYA BITES`;
}

function seasonalSuffix(page, policy) {
  const p = policy || GLOBAL_POLICY;
  if (!p || !p.seasonal) return '';
  const month = new Date().getMonth() + 1;
  if (!p.seasonal.months.includes(month)) return '';
  const genreOk = page.genre && p.seasonal.applyToGenres.includes(page.genre.slug);
  const condOk = page.cond && p.seasonal.applyToConditions.includes(page.cond.slug);
  if (page.type === 'genre' && genreOk) return p.seasonal.titleSuffix;
  if (page.type === 'condition' && genreOk && condOk) return p.seasonal.titleSuffix;
  return '';
}

let GLOBAL_POLICY = null;

function descriptionFor(page) {
  const n = page.stores.length;
  const priceStat = priceModeStat(page.stores);
  const priceStr = priceStat ? `予算は${priceStat.band}が最多（${priceStat.count}軒）。` : '';
  if (page.type === 'area') {
    return `${page.area.label}の飲食店${n}軒。${priceStr}現役の飲食店マネージャーがGoogle評価と口コミ信頼度を並べて整理。予約・地図は各店ページへ。`;
  }
  const condStr = page.type === 'condition' ? `${page.cond.label}の店だけを${n}軒に絞りました。` : `${n}軒を掲載。`;
  return `${page.area.label}の${page.genre.label}${condStr}${priceStr}広告掲載料ゼロ・PR記事ゼロの独立編集で選定順位を操作していません。`;
}

// ================================================================
// FAQ生成（すべて集計値から。自由記述の断定はしない）
// ================================================================

function buildFaq(page) {
  const stores = page.stores;
  const n = stores.length;
  const faqs = [];
  const priceStat = priceModeStat(stores);
  if (priceStat) {
    faqs.push({
      q: `${page.area.label}の${page.genre ? page.genre.label : '飲食店'}の予算相場は？`,
      a: `掲載${n}軒のうち最も多い価格帯は「${priceStat.band}」（${priceStat.count}軒）です。店によって幅があるため、各店ページの価格帯表示も合わせてご確認ください。`,
    });
  }
  const lateNight = stores.filter(s => require('./lib/area_genre_pages').storeMatchesCondition(s, 'lateNight')).length;
  if (lateNight > 0) {
    faqs.push({
      q: '深夜まで営業している店はありますか？',
      a: `翌1時以降まで営業している店が${lateNight}軒あります。詳しい営業時間は各店ページでご確認ください。`,
    });
  }
  const koshitsu = stores.filter(s => require('./lib/area_genre_pages').storeMatchesCondition(s, 'koshitsu')).length;
  if (koshitsu > 0) {
    faqs.push({ q: '個室のある店はありますか？', a: `個室ありの店が${koshitsu}軒あります。人数や用途に応じて各店ページで詳細をご確認ください。` });
  } else {
    const sunday = stores.filter(s => require('./lib/area_genre_pages').storeMatchesCondition(s, 'sunday')).length;
    if (sunday > 0) faqs.push({ q: '日曜に営業している店はありますか？', a: `日曜営業の店が${sunday}軒あります。定休日は店により異なるため各店ページでご確認ください。` });
  }
  return faqs.slice(0, 3);
}

// ================================================================
// 店カード
// ================================================================

function trustBadge(s, TRUST_POLICY) {
  const rt = s.reviewTrust;
  if (!rt || !rt.t) return '';
  const tierDef = rt.t === TRUST_POLICY.na.id ? TRUST_POLICY.na : (TRUST_POLICY.tiers.find(t => t.id === rt.t) || TRUST_POLICY.na);
  return `<span class="ccs-badge" title="${esc(TRUST_POLICY.name)} ${esc(rt.t)}：${esc(tierDef.label)}">${esc(TRUST_POLICY.name)}<span class="ccs-tier ${esc(tierDef.cssClass)}">${esc(rt.t)}</span></span>`;
}

function storeCard(s, idx, depth, TRUST_POLICY, applicableConditions) {
  const name = s['店名'] || '';
  const slug = storeSlug(s);
  const score = parseFloat(s['Google評価']);
  const reviews = parseInt(s['口コミ数'], 10);
  const showScore = Number.isFinite(score) && Number.isFinite(reviews) && reviews >= 5;
  const access = accessSummary(s['アクセス']);
  const price = s['価格帯'] || '';
  const summary = (s.editorReason || s['おすすめポイント'] || '').split(/[。\n]/)[0].slice(0, 80);
  const hpId = s['ホットペッパーID'];
  const hpUrl = hpId ? `https://www.hotpepper.jp/str${hpId}/` : '';
  const metaParts = [access, price].filter(Boolean);
  if (showScore) metaParts.push(`<span class="score">Google★${score}（口コミ${reviews}件）</span>`);
  const condTags = applicableConditions
    .filter(c => require('./lib/area_genre_pages').storeMatchesCondition(s, c.rule))
    .map(c => c.label).slice(0, 2);
  const prefix = siteChrome.prefix(depth);
  return `        <li class="store-card">
          <span class="store-num">${idx + 1}</span>
          <div>
            <p class="store-name"><a href="${prefix}stores/${esc(slug)}.html">${esc(name)}</a></p>
            <p class="store-meta">${metaParts.join(' ・ ')}${trustBadge(s, TRUST_POLICY)}</p>
            ${condTags.length ? `<p class="store-meta">${condTags.map(t => `<span class="hero-tag">${esc(t)}</span>`).join(' ')}</p>` : ''}
            ${summary ? `<p class="store-desc">${esc(summary)}</p>` : ''}
            <div class="store-cta-row">
              <a class="store-link" href="${prefix}stores/${esc(slug)}.html">詳細を見る</a>
              ${hpUrl ? `<a class="store-link store-link-reserve" href="${hpUrl}" target="_blank" rel="noopener noreferrer" onclick="trackEvent('hub_store_click',{store:'${esc(slug)}',hub:location.pathname})">ホットペッパーで予約</a>` : ''}
            </div>
          </div>
        </li>`;
}

// ================================================================
// HTMLテンプレート
// ================================================================

const HUB_STYLE = `
<style>
.hub-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--sp-3);margin:var(--sp-5) 0;padding:var(--sp-4);background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-md);}
.hub-stats dt{font-size:var(--fs-xs);color:var(--dim);margin-bottom:.2rem;}
.hub-stats dd{font-size:var(--fs-xl);font-family:var(--font-display);color:var(--ink);margin:0;}
.hub-more{margin:var(--sp-5) 0;}
.hub-more summary{cursor:pointer;font-size:var(--fs-sm);color:var(--gold);min-height:var(--tap-min);display:flex;align-items:center;}
.hub-more ul{list-style:none;padding:0;margin:var(--sp-3) 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.4rem .8rem;}
.hub-more li a{font-size:var(--fs-sm);color:var(--muted);text-decoration:none;}
.hub-more li a:hover{color:var(--gold);}
.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--sp-3);margin:var(--sp-5) 0;}
.hub-grid a{display:block;padding:var(--sp-4);background:var(--card);border:1px solid var(--card-border);border-radius:var(--r-md);text-decoration:none;color:inherit;}
.hub-grid a:hover{border-color:var(--gold);}
.hub-grid .hg-label{font-size:var(--fs-lg);font-weight:600;color:var(--ink);}
.hub-grid .hg-count{font-size:var(--fs-xs);color:var(--dim);}
.faq-section{max-width:880px;margin:var(--sp-6) auto var(--sp-5);}
.faq-list{margin-top:var(--sp-3);}
.faq-item{border-top:1px solid var(--border);padding:var(--sp-4) 0;}
.faq-item:last-child{border-bottom:1px solid var(--border);}
.faq-q{font-weight:600;font-size:var(--fs-md);line-height:1.6;margin:0 0 .4rem;}
.faq-q::before{content:"Q. ";color:var(--gold);font-weight:700;}
.faq-a{font-size:var(--fs-md);line-height:1.85;margin:0;color:var(--muted);}
.faq-a::before{content:"A. ";color:var(--gold);font-weight:500;}
.hub-method{font-size:var(--fs-xs);color:var(--dim);margin-top:var(--sp-2);}
</style>`;

function renderShell({ depth, active, breadcrumb, title, desc, canonicalPath, jsonLdList, bodyHtml, styleExtra }) {
  const p = siteChrome.prefix(depth);
  const canonical = `${BASE_URL}/${canonicalPath}`;
  const jsonLd = jsonLdList.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3LCZNGZPWJ"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}(function(){var p=new URLSearchParams(location.search);if(p.get('nb_owner')==='1'){localStorage.setItem('nb_internal','1');history.replaceState(null,'',location.pathname);}if(localStorage.getItem('nb_internal')==='1'){gtag('js',new Date());gtag('config','G-3LCZNGZPWJ',{traffic_type:'internal'});}else{gtag('js',new Date());gtag('config','G-3LCZNGZPWJ');}})();function trackEvent(name,params){if(localStorage.getItem('nb_internal')==='1')return;if(typeof gtag==='function')gtag('event',name,params||{});}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(href))return;try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);
</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE_URL}/icons/icon-512.png">
<link rel="icon" href="${p}icons/icon-192.png">
<link rel="manifest" href="${p}manifest.json">
<meta name="theme-color" content="#0d0d0d">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Shippori+Mincho:wght@500;600&family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${p}assets/css/nb.css">
${jsonLd}
${styleExtra || ''}
</head>
<body>
${siteChrome.renderHeader({ depth, active: 'top' })}
<div class="container">
  ${siteChrome.renderBreadcrumb(breadcrumb, { depth })}
${bodyHtml}
</div>
${siteChrome.renderFooter({ depth })}
${siteChrome.chromeScript()}
</body>
</html>`;
}

function renderRootPage(rootResult, policy) {
  const { pages } = rootResult;
  const areaPages = pages.filter(p => p.type === 'area').sort((a, b) => b.stores.length - a.stores.length);
  const genrePages = pages.filter(p => p.type === 'genre').sort((a, b) => b.stores.length - a.stores.length).slice(0, 24);

  const areaGrid = areaPages.map(p => `    <a href="${p.area.slug}/index.html">
      <div class="hg-label">${esc(p.area.label)}</div>
      <div class="hg-count">${p.stores.length}軒</div>
    </a>`).join('\n');
  const genreList = genrePages.map(p => `      <li><a href="${p.area.slug}/${p.genre.slug}.html">${esc(p.area.label)}の${esc(p.genre.label)}（${p.stores.length}軒）</a></li>`).join('\n');

  const body = `  <p class="art-eyebrow">Restaurant Database — エリア×ジャンルで探す</p>
  <h1 class="art-title">名古屋の飲食店を、<em>エリア×ジャンル</em>で絞り込む</h1>
  <div class="art-lead"><p>NAGOYA BITES 掲載店を、主要${areaPages.length}エリア×代表ジャンルの一覧に整理しました。各ページはGoogle評価・予算・営業時間などの実データだけで構成し、広告や掲載料による順位操作は一切行っていません。</p></div>
  <h2 class="nb-section-head"><span>エリアから探す</span></h2>
  <div class="hub-grid">
${areaGrid}
  </div>
  <details class="hub-more" open>
    <summary>よく見られているエリア×ジャンル一覧</summary>
    <ul>
${genreList}
    </ul>
  </details>
`;

  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: 'エリア×ジャンルで探す | NAGOYA BITES',
    url: `${BASE_URL}/stores/area/index.html`,
  }];

  return renderShell({
    depth: 2, active: 'top',
    breadcrumb: [{ href: 'index.html', label: 'TOP' }, { href: 'stores/index.html', label: '店舗一覧' }, { label: 'エリア×ジャンルで探す' }],
    title: titleFor({ type: 'root' }),
    desc: `名古屋の飲食店をエリア×ジャンルで絞り込めるページ一覧。${areaPages.length}エリア・実データのみで構成。`,
    canonicalPath: 'stores/area/index.html',
    jsonLdList: jsonLd,
    bodyHtml: body,
    styleExtra: HUB_STYLE,
  });
}

function renderAreaPage(page, allPages, policy) {
  const genrePages = allPages.filter(p => p.type === 'genre' && p.area.slug === page.area.slug).sort((a, b) => b.stores.length - a.stores.length);
  const priceStat = priceModeStat(page.stores);
  const stations = topStations(page.stores, 3);

  const grid = genrePages.map(p => `    <a href="${p.genre.slug}.html">
      <div class="hg-label">${esc(p.genre.label)}</div>
      <div class="hg-count">${p.stores.length}軒</div>
    </a>`).join('\n');

  const statCells = [
    ['掲載軒数', `${page.stores.length}軒`],
    priceStat ? ['最多価格帯', priceStat.band] : null,
    stations.length ? ['最寄り駅', stations.map(([st]) => st).join('・')] : null,
  ].filter(Boolean);

  const body = `  <p class="art-eyebrow">Restaurant Database — ${esc(page.area.label)}</p>
  <h1 class="art-title">${esc(page.area.label)}の<em>飲食店</em></h1>
  <div class="art-lead"><p>${esc(page.area.label)}に掲載中の飲食店${page.stores.length}軒をジャンル別に整理。並び順は各ジャンルページで Google評価×口コミ件数の機械的な順に統一しています。編集部推薦や広告で順位は動かしていません。</p></div>
  <dl class="hub-stats">
${statCells.map(([k, v]) => `    <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
  </dl>
  <h2 class="nb-section-head"><span>ジャンルから探す</span></h2>
  <div class="hub-grid">
${grid}
  </div>
  <div class="related-wrap">
    <p class="related-title">エリア一覧に戻る</p>
    <div class="related-links">
      <a class="related-link" href="index.html">← エリア×ジャンルで探す TOP</a>
      ${page.area.feature ? `<a class="related-link" href="${siteChrome.prefix(3)}${page.area.feature}">${esc(page.area.label)}の特集記事</a>` : ''}
    </div>
  </div>
`;

  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: titleFor(page), url: `${BASE_URL}/${page.url}` },
    breadcrumbLd([{ name: 'NAGOYA BITES', item: `${BASE_URL}/` }, { name: '店舗一覧', item: `${BASE_URL}/stores/index.html` }, { name: 'エリア×ジャンルで探す', item: `${BASE_URL}/stores/area/index.html` }, { name: page.area.label, item: `${BASE_URL}/${page.url}` }]),
  ];

  return renderShell({
    depth: 3, active: 'top',
    breadcrumb: [{ href: 'index.html', label: 'TOP' }, { href: 'stores/index.html', label: '店舗一覧' }, { href: 'stores/area/index.html', label: 'エリア×ジャンルで探す' }, { label: page.area.label }],
    title: titleFor(page), desc: descriptionFor(page), canonicalPath: page.url,
    jsonLdList: jsonLd, bodyHtml: body, styleExtra: HUB_STYLE,
  });
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.item })),
  };
}

function renderListingPage(page, siblingConditions, policy, TRUST_POLICY) {
  const isCondition = page.type === 'condition';
  const sorted = sortForDisplay(page.stores);
  const shown = sorted.slice(0, policy.maxCards);
  const rest = sorted.slice(policy.maxCards);
  const applicableConditions = siblingConditions.filter(c => c.slug !== (page.cond && page.cond.slug));

  const cardsHtml = shown.map((s, i) => storeCard(s, i, 3, TRUST_POLICY, page.type === 'genre' ? siblingConditions : [])).join('\n');
  const moreHtml = rest.length ? `  <details class="hub-more">
    <summary>ほか${rest.length}軒をすべて見る</summary>
    <ul>
${rest.map(s => `      <li><a href="${siteChrome.prefix(3)}stores/${esc(storeSlug(s))}.html">${esc(s['店名'])}</a></li>`).join('\n')}
    </ul>
  </details>` : '';

  const condChips = isCondition ? '' : siblingConditions
    .filter(c => allPagesHasCondition(policy, page, c))
    .map(c => `<a class="hero-tag" href="${page.genre.slug}-${c.slug}.html">${esc(c.label)}</a>`).join(' ');

  const faqs = buildFaq(page);
  const faqHtml = faqs.length ? `  <section class="faq-section" aria-label="よくある質問">
    <h2 class="nb-section-head"><span>よくある質問</span></h2>
    <div class="faq-list">
${faqs.map(f => `      <div class="faq-item"><p class="faq-q">${esc(f.q)}</p><p class="faq-a">${esc(f.a)}</p></div>`).join('\n')}
    </div>
  </section>` : '';

  const relatedGenres = REGISTRY.byArea.get(page.area.slug).filter(g => g.genre.slug !== page.genre.slug).sort((a, b) => b.stores.length - a.stores.length).slice(0, 6);
  const sameGenreOtherAreas = REGISTRY.byGenre.get(page.genre.slug).filter(g => g.area.slug !== page.area.slug).sort((a, b) => b.stores.length - a.stores.length).slice(0, 6);
  const featureLinks = [page.genre.feature, page.cond && page.cond.feature, page.area.feature].filter(Boolean);

  const relatedLinks = [
    ...relatedGenres.map(g => `<a class="related-link" href="${g.genre.slug}.html">${esc(page.area.label)}の${esc(g.genre.label)}</a>`),
    ...sameGenreOtherAreas.map(g => `<a class="related-link" href="${siteChrome.prefix(3)}stores/area/${g.area.slug}/${g.genre.slug}.html">${esc(g.area.label)}の${esc(page.genre.label)}</a>`),
    ...[...new Set(featureLinks)].map(f => `<a class="related-link" href="${siteChrome.prefix(3)}${f}">関連特集を見る</a>`),
    isCondition ? `<a class="related-link" href="${page.genre.slug}.html">${esc(page.area.label)}の${esc(page.genre.label)}すべて見る</a>` : '',
  ].filter(Boolean).join('\n      ');

  const wardParam = page.area.ward ? `&ward=${encodeURIComponent(page.area.ward)}` : '';
  const genreParam = policyGenreIndexName(page.genre);

  const priceStat = priceModeStat(page.stores);
  const stations = topStations(page.stores, 3);
  const highRating = countHighRating(page.stores);
  const leadFacts = [
    `${page.stores.length}軒`,
    priceStat ? `予算は「${priceStat.band}」が最多（${priceStat.count}軒）` : null,
    stations.length ? `最寄り駅は${stations.map(([st, c]) => `${st}（${c}軒）`).join('・')}` : null,
    highRating > 0 ? `Google★4.0以上・口コミ5件以上の店が${highRating}軒` : null,
  ].filter(Boolean);

  const h1 = isCondition ? `${page.area.label}の${page.genre.label} — <em>${page.cond.label}</em>` : `${page.area.label}の<em>${page.genre.label}</em>`;

  const body = `  <p class="art-eyebrow">Restaurant Database — ${esc(page.area.label)} × ${esc(page.genre.label)}${isCondition ? ' × ' + esc(page.cond.label) : ''}</p>
  <h1 class="art-title">${h1}</h1>
  <div class="art-lead"><p>${leadFacts.map(esc).join('。')}。並び順はGoogle評価×口コミ件数の機械的な順（口コミ5件未満の店は評価を出さず末尾）。編集部推薦や広告で順位は動かしていません。</p></div>
  ${condChips ? `<div class="hero-tags">${condChips}</div>` : ''}
  <ul class="store-list">
${cardsHtml}
  </ul>
${moreHtml}
${faqHtml}
  <div class="related-wrap">
    <p class="related-title">絞り込む・関連情報</p>
    <div class="related-links">
      ${relatedLinks}
      <a class="related-link" href="${siteChrome.prefix(3)}index.html#genre=${encodeURIComponent(genreParam)}${wardParam}">もっと絞る（全店検索）</a>
    </div>
  </div>
  <p class="hub-method source-note">データ更新日 ${new Date().toISOString().slice(0, 10)}・出典 HotPepper グルメ / Google Places・掲載料ゼロ。<a href="${siteChrome.prefix(3)}features/integrity-method.html">算定方法</a></p>
`;

  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: shown.slice(0, 60).map((s, i) => ({
      '@type': 'ListItem', position: i + 1, name: s['店名'],
      url: `${BASE_URL}/stores/${storeSlug(s)}.html`,
    })),
  };
  const bcItems = [
    { name: 'NAGOYA BITES', item: `${BASE_URL}/` },
    { name: '店舗一覧', item: `${BASE_URL}/stores/index.html` },
    { name: 'エリア×ジャンルで探す', item: `${BASE_URL}/stores/area/index.html` },
    { name: page.area.label, item: `${BASE_URL}/stores/area/${page.area.slug}/index.html` },
    { name: page.genre.label, item: `${BASE_URL}/stores/area/${page.area.slug}/${page.genre.slug}.html` },
  ];
  if (isCondition) bcItems.push({ name: page.cond.label, item: `${BASE_URL}/${page.url}` });
  const jsonLdList = [itemListLd, breadcrumbLd(bcItems)];
  if (faqs.length) {
    jsonLdList.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }

  const breadcrumb = [
    { href: 'index.html', label: 'TOP' }, { href: 'stores/index.html', label: '店舗一覧' },
    { href: 'stores/area/index.html', label: 'エリア×ジャンルで探す' },
    { href: `stores/area/${page.area.slug}/index.html`, label: page.area.label },
  ];
  if (isCondition) breadcrumb.push({ href: `stores/area/${page.area.slug}/${page.genre.slug}.html`, label: page.genre.label }, { label: page.cond.label });
  else breadcrumb.push({ label: page.genre.label });

  return renderShell({
    depth: 3, active: 'top', breadcrumb,
    title: titleFor(page), desc: descriptionFor(page), canonicalPath: page.url,
    jsonLdList, bodyHtml: body, styleExtra: HUB_STYLE,
  });
}

function policyGenreIndexName(genre) {
  // index.html 側の #genre= はジャンルの原文(HP表記)を使う。policy.genres[].match[0] が代表原文。
  return (genre.match && genre.match[0]) || genre.label;
}

function allPagesHasCondition(policy, genrePage, cond) {
  return REGISTRY.conditionKeys.has(`${genrePage.area.slug}::${genrePage.genre.slug}::${cond.slug}`);
}

let REGISTRY = null;

function buildRegistry(pages) {
  const byArea = new Map(); // areaSlug -> genre pages[]
  const byGenre = new Map(); // genreSlug -> genre pages[]
  const conditionKeys = new Set();
  for (const p of pages) {
    if (p.type === 'genre') {
      if (!byArea.has(p.area.slug)) byArea.set(p.area.slug, []);
      byArea.get(p.area.slug).push(p);
      if (!byGenre.has(p.genre.slug)) byGenre.set(p.genre.slug, []);
      byGenre.get(p.genre.slug).push(p);
    } else if (p.type === 'condition') {
      conditionKeys.add(`${p.area.slug}::${p.genre.slug}::${p.cond.slug}`);
    }
  }
  return { byArea, byGenre, conditionKeys };
}

// ================================================================
// sitemap.xml 冪等書き換え（既存の /stores/area/ 区間だけ差し替える）
// ================================================================
function rewriteSitemap(pages, policy) {
  if (!fs.existsSync(SITEMAP_PATH)) return { updated: false, reason: 'sitemap.xml not found' };
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const urlBlockRe = /<url>\s*<loc>[^<]*<\/loc>[\s\S]*?<\/url>\s*/g;
  xml = xml.replace(urlBlockRe, block => (/\/stores\/area\//.test(block) ? '' : block));
  const newBlocks = pages
    .filter(p => p.type !== 'root' || true)
    .map(p => {
      const priority = p.type === 'condition' ? policy.sitemap.conditionPriority : policy.sitemap.hubPriority;
      return `  <url>\n    <loc>${BASE_URL}/${p.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${policy.sitemap.changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    }).join('');
  xml = xml.replace(/<\/urlset>\s*$/, newBlocks + '</urlset>');
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  return { updated: true, added: pages.length };
}

// ================================================================
// メイン
// ================================================================
function contentHashOf(page, html) {
  // 日付（データ更新日・generatedAt相当）を除いた本文でハッシュ化し、
  // 内容が変わらない日は同一ハッシュになるようにする。
  const stripped = html.replace(/データ更新日\s*\d{4}-\d{2}-\d{2}/, 'データ更新日 DATE')
    .replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  return crypto.createHash('sha256').update(stripped).digest('hex').slice(0, 16);
}

function main() {
  const policy = loadPolicy();
  GLOBAL_POLICY = policy;
  const stores = loadStores();
  const { pages } = planPages(stores, policy);
  const limited = LIMIT ? pages.slice(0, LIMIT) : pages;
  REGISTRY = buildRegistry(pages);

  const TRUST_POLICY = trustDisplay.loadPolicy();

  const prevManifest = fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : { pages: [] };
  const prevBySlug = new Map((prevManifest.pages || []).map(p => [p.path, p]));

  const manifestPages = [];
  let written = 0, unchanged = 0;
  const onDiskExpected = new Set();

  for (const page of limited) {
    let html;
    if (page.type === 'root') html = renderRootPage({ pages }, policy);
    else if (page.type === 'area') html = renderAreaPage(page, pages, policy);
    else html = renderListingPage(page, policy.conditions, policy, TRUST_POLICY);

    const absPath = path.join(ROOT, page.url);
    onDiskExpected.add(page.url);
    const hash = contentHashOf(page, html);
    const prev = prevBySlug.get(page.url);
    const entry = {
      path: page.url, type: page.type,
      count: page.stores ? page.stores.length : null,
      contentHash: hash,
      firstPublished: (prev && prev.firstPublished) || new Date().toISOString().slice(0, 10),
      updated: (prev && prev.contentHash === hash) ? prev.updated : new Date().toISOString().slice(0, 10),
      status: 'active',
    };
    manifestPages.push(entry);

    const needsWrite = !prev || prev.contentHash !== hash || !fs.existsSync(absPath);
    if (needsWrite) {
      written++;
      if (!DRY_RUN) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, html, 'utf8');
      }
    } else {
      unchanged++;
    }
  }

  // 閾値割れ・削除対象の掃除: manifest にあったが今回のplanに無いページを stub 化 → 保持期限超過で削除
  const nowStr = new Date().toISOString().slice(0, 10);
  const stubbed = [];
  const removed = [];
  for (const prev of prevManifest.pages || []) {
    if (onDiskExpected.has(prev.path)) continue;
    const absPath = path.join(ROOT, prev.path);
    if (prev.status === 'active') {
      // 直近まで有効だったページ → stub化（初回のstub化日を記録）
      const stubEntry = { ...prev, status: 'stub', stubbedAt: nowStr };
      manifestPages.push(stubEntry);
      stubbed.push(prev.path);
      if (!DRY_RUN && fs.existsSync(absPath)) {
        const parentUrl = '../index.html'; // 条件ページ/ジャンルページはどちらも同階層に親がある前提
        const stubHtml = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${parentUrl}"><link rel="canonical" href="${BASE_URL}/${prev.path.replace(/\/[^/]+$/, '/index.html')}"><title>移動しました | NAGOYA BITES</title></head><body>このページは閉鎖されました。<a href="${parentUrl}">親ページへ</a></body></html>`;
        fs.writeFileSync(absPath, stubHtml, 'utf8');
      }
      continue;
    }
    // 既にstub → 保持期限を確認
    const stubbedAt = new Date(prev.stubbedAt || prev.updated);
    const days = (Date.now() - stubbedAt.getTime()) / 86400000;
    if (days >= policy.stubRetentionDays) {
      removed.push(prev.path);
      if (!DRY_RUN && fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } else {
      manifestPages.push(prev);
    }
  }

  const manifest = { generated: new Date().toISOString(), policyVersion: policy.version, pages: manifestPages };
  if (!DRY_RUN) fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1) + '\n', 'utf8');

  let sitemapResult = { updated: false };
  if (!DRY_RUN && !LIMIT) sitemapResult = rewriteSitemap(limited.filter(p => manifestPages.find(m => m.path === p.url && m.status === 'active')), policy);

  console.log(JSON.stringify({
    ok: true, dry_run: DRY_RUN, planned: pages.length, written, unchanged,
    stubbed: stubbed.length, removed: removed.length, sitemap: sitemapResult,
  }, null, 1));

  if (CHECK) {
    // ディスク状態が計画と一致するか（新規/更新が無ければ0のはず）
    if (written > 0) {
      console.error(`area_genre_pages --check failed: ${written}件のページが計画と一致しません（未生成/更新漏れ）`);
      process.exit(1);
    }
  }
}

main();
