'use strict';

/**
 * scripts/lib/site_chrome.js
 *
 * DSN-003: サイト共通クローム（ヘッダー/ナビ/パンくず/フッター）の唯一の正本。
 * ナビ項目・フッター群のラベル/リンク先は必ずここで定義し、HTML に直書きしない。
 * 実際の適用（既存ページへの冪等スイープ）は scripts/apply_site_chrome.js が担う。
 * 生成器（gen-store-pages.js / scripts/gen_industry_features.js 等）もここを呼ぶ。
 */

const NAV_PRIMARY = [
  { key: 'top', href: 'index.html', label: '店舗を探す' },
  { key: 'features', href: 'features/index.html', label: '特集' },
  { key: 'journal', href: 'journal/index.html', label: 'ジャーナル' },
  { key: 'editorial', href: 'features/editorial-policy.html', label: '編集規約' },
  { key: 'about', href: 'about.html', label: '運営について' },
];

const NAV_SECONDARY = [
  { key: 'faq', href: 'faq.html', label: 'よくある質問' },
  { key: 'contact', href: 'contact.html', label: 'お問い合わせ' },
];

const FOOTER_GROUPS = [
  {
    title: '探す',
    links: [
      ['index.html', '店舗を探す'],
      ['stores/index.html', 'エリア別 店舗一覧'],
      ['index.html#scene-index', '目的から探す'],
      ['features/nagoya-gourmet-guide.html', '名古屋グルメ完全ガイド'],
    ],
  },
  {
    title: '読む',
    links: [
      ['features/index.html', '特集記事'],
      ['journal/index.html', 'Daily Journal'],
      ['features/review-trust.html', '口コミ信頼度の読み方'],
      ['features/no-fake-reviews.html', '桜ゼロ宣言'],
    ],
  },
  {
    title: '編集部',
    links: [
      ['features/editorial-policy.html', '編集規約'],
      ['about.html', '運営について'],
      ['faq.html', 'よくある質問'],
      ['contact.html', 'お問い合わせ'],
      ['privacy-policy.html', 'プライバシーポリシー'],
    ],
  },
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prefix(depth) {
  return depth > 0 ? '../'.repeat(depth) : '';
}

function MARK(name, pos) {
  return `<!-- NB-CHROME:${name}:${pos} -->`;
}

/** ファイルの相対パス（例: "journal/2026-09-07-foo.html"）から root からの深さを返す */
function depthFor(relPath) {
  const norm = String(relPath).replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = norm.split('/').filter(Boolean);
  return Math.max(0, parts.length - 1);
}

/** ファイルの相対パスから、どのナビ項目をアクティブにするかを決める */
function activeKeyFor(relPath) {
  const norm = String(relPath).replace(/\\/g, '/').replace(/^\.\//, '');
  if (norm === 'index.html') return 'top';
  if (norm === 'features/editorial-policy.html') return 'editorial';
  if (norm.startsWith('features/')) return 'features';
  if (norm.startsWith('journal/')) return 'journal';
  if (norm.startsWith('stores/')) return 'top';
  if (norm === 'about.html') return 'about';
  if (norm === 'faq.html') return 'faq';
  if (norm === 'contact.html') return 'contact';
  if (norm === 'privacy-policy.html') return null;
  return null;
}

/**
 * ヘッダー（nav-overlay + header）を描画する。
 * @param {object} opts
 * @param {number} opts.depth - root からの深さ（0 = index.html と同階層）
 * @param {string|null} opts.active - activeKeyFor() の戻り値
 * @param {boolean} [opts.withFav] - true なら index.html 用の保存済み(N) リンクを先頭に挿入
 */
function renderHeader({ depth, active, withFav = false }) {
  const p = prefix(depth);
  const favLink = withFav
    ? `    <a href="#" class="nav-fav" id="nav-fav" onclick="event.preventDefault();showFavs();closeNav()"><span class="nb-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.5-10-9.5C.5 7 3.5 3 8 3c2.5 0 3.5 1.5 4 2 .5-.5 1.5-2 4-2 4.5 0 7.5 4 6 8.5C19.5 16.5 12 21 12 21z"/></svg></span>保存済み(<span id="fav-count">0</span>)</a>\n`
    : '';
  const primaryLinks = NAV_PRIMARY.map(item => {
    const current = item.key === active ? ' aria-current="page"' : '';
    return `    <a href="${p}${item.href}"${current}>${esc(item.label)}</a>`;
  }).join('\n');
  const secondaryLinks = NAV_SECONDARY.map(item => {
    const current = item.key === active ? ' aria-current="page"' : '';
    return `    <a href="${p}${item.href}" class="nav-secondary"${current}>${esc(item.label)}</a>`;
  }).join('\n');

  return `${MARK('HEADER', 'START')}
<div class="nav-overlay" id="nav-overlay" onclick="closeNav()"></div>
<header>
  <a class="logo" href="${p}index.html">Nagoya <em>Bites</em></a>
  <button class="hamburger" id="hamburger-btn" type="button" onclick="toggleNav()" aria-label="メニューを開く" aria-expanded="false" aria-controls="main-nav">
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </button>
  <nav id="main-nav" aria-label="サイト内ナビゲーション">
${favLink}${primaryLinks}
${secondaryLinks}
  </nav>
</header>
${MARK('HEADER', 'END')}`;
}

/**
 * パンくずを描画する。items は [{label, href?}] で最後の要素だけ href を省略する。
 */
function renderBreadcrumb(items, { depth }) {
  const p = prefix(depth);
  const parts = items.map((it, i) => {
    if (i > 0) return `<span>›</span>\n    ${it.href ? `<a href="${resolveHref(it.href, p)}">${esc(it.label)}</a>` : esc(it.label)}`;
    return it.href ? `<a href="${resolveHref(it.href, p)}">${esc(it.label)}</a>` : esc(it.label);
  }).join('\n    ');
  return `${MARK('BREADCRUMB', 'START')}
<nav aria-label="パンくずリスト">
  <div class="breadcrumb">
    ${parts}
  </div>
</nav>
${MARK('BREADCRUMB', 'END')}`;
}

// href が既に相対深度込み（"../features/index.html" 等）ならそのまま、
// ルート相対の素の名前（"index.html"）なら prefix を足す。
function resolveHref(href, p) {
  if (/^https?:\/\//.test(href) || href.startsWith('#') || href.startsWith('../') || href.startsWith('/')) return href;
  return p + href;
}

function renderFooter({ depth }) {
  const p = prefix(depth);
  const groups = FOOTER_GROUPS.map(g => {
    const links = g.links.map(([href, label]) => `      <a href="${p}${href}">${esc(label)}</a>`).join('\n');
    return `    <nav class="nb-footer-group" aria-label="${esc(g.title)}">
      <p class="nb-footer-title">${esc(g.title)}</p>
${links}
    </nav>`;
  }).join('\n');

  return `${MARK('FOOTER', 'START')}
<footer class="nb-footer">
  <div class="nb-footer-inner">
    <div class="nb-footer-brand">
      <a class="logo" href="${p}index.html">Nagoya <em>Bites</em></a>
      <p class="nb-footer-tagline">現役の飲食店マネージャーが編集する、広告ゼロ・PR記事ゼロの名古屋・愛知専門グルメガイド。</p>
    </div>
${groups}
  </div>
  <div class="nb-footer-bottom">
    <p class="nb-footer-copy">© <span data-nb-year>2026</span> NAGOYA BITES</p>
    <p class="nb-footer-policy">掲載料ゼロ・PR記事ゼロ</p>
    <p class="feedback-nudge">情報の誤りやご意見は <a href="${p}index.html#feedback">こちら</a> からお寄せください。</p>
  </div>
</footer>
${MARK('FOOTER', 'END')}`;
}

function chromeScript() {
  return `${MARK('SCRIPT', 'START')}
<script>
window.toggleNav = window.toggleNav || function(){
  var nav=document.getElementById('main-nav'),ov=document.getElementById('nav-overlay'),btn=document.getElementById('hamburger-btn');
  if(!nav)return;
  var open=nav.classList.toggle('open');
  if(ov)ov.classList.toggle('open',open);
  if(btn)btn.setAttribute('aria-expanded',open?'true':'false');
};
window.closeNav = window.closeNav || function(){
  var nav=document.getElementById('main-nav'),ov=document.getElementById('nav-overlay'),btn=document.getElementById('hamburger-btn');
  if(nav)nav.classList.remove('open');
  if(ov)ov.classList.remove('open');
  if(btn)btn.setAttribute('aria-expanded','false');
};
document.querySelectorAll('[data-nb-year]').forEach(function(el){el.textContent=new Date().getFullYear();});
</script>
${MARK('SCRIPT', 'END')}`;
}

module.exports = {
  NAV_PRIMARY,
  NAV_SECONDARY,
  FOOTER_GROUPS,
  MARK,
  prefix,
  depthFor,
  activeKeyFor,
  renderHeader,
  renderBreadcrumb,
  renderFooter,
  chromeScript,
  esc,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const renderIdx = args.indexOf('--render');
  const depthIdx = args.indexOf('--depth');
  const activeIdx = args.indexOf('--active');
  const render = renderIdx >= 0 ? args[renderIdx + 1] : null;
  const depth = depthIdx >= 0 ? parseInt(args[depthIdx + 1], 10) : 0;
  const active = activeIdx >= 0 ? args[activeIdx + 1] : null;
  if (render === 'header') console.log(renderHeader({ depth, active, withFav: depth === 0 }));
  else if (render === 'footer') console.log(renderFooter({ depth }));
  else if (render === 'script') console.log(chromeScript());
  else console.log('usage: node scripts/lib/site_chrome.js --render header|footer|script --depth N [--active key]');
}
