'use strict';
/**
 * tests/index_card_compact.test.js
 *
 * 検索結果・一覧のカード（I-19・P-400・判断の記録 0036）。
 *   ・構造: 題名の本物のリンク（カード全面）・ジャンルの印・撮影者の行・リストの 96px の写真・スマホの 2 列タイルなど、
 *     index.html の組み立てを文字で確かめる
 *   ・動き: index.html から実物の関数を取り出し、偽の DOM の上で動かす
 *     （カードの HTML・最寄駅の徒歩・店舗ページの href・クリックの振り分け・表示の切り替えと保存・壊れた写真の差し替え）
 *
 * 区画（STORE-INDEX など CI が書き直す所）の中身そのものは読まない: 店舗ページの href は、店の ID と、テスト用の例外の表（NB_STORE_PAGES）で確かめる。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// index.html の関数は、行頭の `}` で閉じる（中の `}` はインデントされている）
function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `function ${name} は 1 つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}

// CSS から 1 つの規則の中身を取り出す（セレクターは行頭〜`{` の完全一致）。
// 空白は「: ; , { }」の前後を詰め、そのほかは 1 つにそろえる（例: `flex:0 0 96px;width:96px;`・`1fr !important`）
function cssBody(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = INDEX.match(new RegExp('(?:^|\\n)' + esc + '\\s*\\{([^}]*)\\}'));
  assert.ok(m, `CSS の規則が見つからない: ${selector}`);
  return m[1].replace(/\s*([:;,{}])\s*/g, '$1').replace(/\s+/g, ' ').trim();
}

// 関数のソースからコメントだけを除く（行頭の // と、空白のあとの // 。URL の :// は残る）。
// 「コメントに書いてある語」を「コードが出す語」と取り違えないための検査用
function codeOnly(src) {
  return src.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/\s.*$/, '')).join('\n');
}

const CARD_FN = fnSource('buildCardHtml');
const CARD_CODE = codeOnly(CARD_FN);

// ── 構造（文字で確かめる）──────────────────────────────────────────────
test('カードの組み立て: 題名は本物のリンク・押したときは nbCardClick・写真が無い店はジャンルの印', () => {
  assert.ok(/^function buildCardHtml\(r, ctx\) \{/.test(CARD_FN), 'buildCardHtml(r, ctx) の形（ctx は一覧の種類。索引のカードだけ違う写真の幅を渡す）');
  assert.ok(CARD_FN.includes('<a class="cn-link" href="'), '題名は a.cn-link（新しいタブ・中クリック・長押しで店舗ページを開ける）');
  assert.ok(CARD_FN.includes('onclick="nbCardClick(event,'), 'ふつうのクリックは nbCardClick が詳細を開く');
  assert.ok(CARD_FN.includes('<span class="ci-mark" aria-hidden="true">'), '写真が無い店はジャンルの印（装飾なので読み上げない）');
  assert.ok(CARD_FN.includes("' is-nophoto'"), '写真が無い店には is-nophoto');
  assert.ok(CARD_FN.includes("' has-link'"), '店舗ページへ行ける店には has-link');
  // リンクが無い店だけが、従来どおりボタンとして操作できる（リンクのある店は題名の a が操作の入り口）
  assert.ok(/\(href \? '' : ' role="button" tabindex="0" aria-label="'/.test(CARD_FN), 'role=button・tabindex・aria-label はリンクが無い店だけ');
  assert.ok(CARD_FN.includes('nbEscHtml(r[\'店名\'])'), '店名は逃がしてから属性・本文に入れる');
});

test('カードに「写真準備中」の暗い図と「ポイント紹介」の札は出さない（0036・0032 の 5）', () => {
  // コメントに書いてある語は数えない（経緯をコメントに残してよい）
  assert.ok(!CARD_CODE.includes('nbStoreFigure'), '写真が無い店に暗い代替図（「写真準備中」）を出さない');
  assert.ok(!CARD_CODE.includes('写真準備中'), '「写真準備中」の文字を出さない');
  assert.ok(!CARD_CODE.includes('ポイント紹介'), '「ポイント紹介」の札を出さない');
  assert.ok(!/flag-pro/.test(INDEX), '札のクラス flag-pro（規則）も残さない');
  assert.ok(CARD_CODE.includes("leadKicker = 'ポイント：'"), '紹介文の見出し「ポイント：」は残す');
});

test('ファイル全体の組み立て: ♡ の差し込み口 <div class="ci"> が 1 つ・ラッパーが ctx を渡す・索引でカードを描く呼び出しは無い', () => {
  assert.strictEqual(CARD_FN.split("'<div class=\"ci\">'").length - 1, 1, '<div class="ci"> のリテラルは 1 か所（♡ のラッパーが html.replace で差し込む）');
  assert.ok(INDEX.includes("html = html.replace('<div class=\"ci\">', favBtn + '<div class=\"ci\">');"), '♡ のラッパーが ci の手前に差し込む');
  assert.ok(INDEX.includes('buildCardHtml = function(r, ctx) {\n  var html = _origBuildCardHtml(r, ctx);'), 'ラッパーが ctx を元の関数へ渡す');
  // ctx=index は、エリア別の索引の中でカードを描いていた呼び出しの印だった。索引をエリア別の一覧ページへの入口に置き換えて（I-25・0039）
  // 呼び出しは無くなった。nbCardSizes('index') の枝は後始末として残してある（下のテストが見る）。索引にカードを戻すなら、この行も決め直す
  assert.ok(!INDEX.includes("buildCardHtml(s, 'index')"), '索引でカードを描く呼び出しは無い（0039）');
  assert.ok(fnSource('renderPage').includes('html += buildCardHtml(RENDER_DATA[i]);'), '一覧の描画は buildCardHtml(RENDER_DATA[i]) のまま（ctx 無し＝一覧の写真の幅）');
});

test('表示モード: 描画の前に restoreViewMode()・保存が無ければスマホはリスト（ボタンは aria-pressed を持つ）', () => {
  const a = INDEX.indexOf('loadStores = function(stores) {');
  assert.ok(a > 0, 'loadStores のラッパーが見つからない');
  const body = INDEX.slice(a, INDEX.indexOf('\n};', a));
  assert.ok(body.indexOf('restoreViewMode();') >= 0 && body.indexOf('restoreViewMode();') < body.indexOf('_origLoadStores(stores);'),
    '表示（リスト／グリッド）は描画の前に決める（描いてから切り替えると、一覧の並びも写真の幅の目安もずれる）');
  const fn = fnSource('applyViewMode');
  assert.ok(fn.includes("setAttribute('aria-pressed'"), '表示の切り替えボタンは aria-pressed で今の状態を伝える');
  assert.ok(fnSource('nbDefaultView').includes("(max-width:768px)"), 'スマホの境目は 768px（CSS の @media と同じ）');
});

test('カードの Enter / Space: role=button の共通の keydown だけが受け持つ（二重に click して modal_open が 2 回になっていた）', () => {
  assert.ok(INDEX.includes("var btn=t.closest('[role=\"button\"][tabindex=\"0\"]');"), 'role=button のカードの Enter / Space を click にする共通の処理が残っている');
  assert.ok(!/activeElement\.classList\.contains\('card'\)/.test(INDEX), 'カードの Enter をもう一度 click にする処理は無い');
  // tests/index_install_prompt.test.js が区間の終わりの目印に使っている
  assert.ok(INDEX.includes('// Keyboard support for cards (Enter key)'), '見出しのコメントは残す（別のテストの目印）');
});

test('CSS: 題名のリンクはカード全面・押せる子要素は前・札は飾り・焦点の枠は金色（0036）', () => {
  assert.ok(/(?:^|\n)\.cn-link::after\{content:"";position:absolute;inset:0;z-index:1;\}/.test(INDEX), '.cn-link::after でカード全面を覆う');
  assert.ok(/(?:^|\n)\.card \.card-cta a,\.card \.mrow a,\.card a\.card-featured\{position:relative;z-index:2;\}/.test(INDEX), '予約・地図・媒体・特集リンクは全面リンクの前に出す');
  assert.ok(/(?:^|\n)\.badge,\.card-flag\{pointer-events:none;\}/.test(INDEX), '札はクリックを通す');
  assert.strictEqual(cssBody('.cn-link:focus-visible'), 'outline:none;', 'リンク自身の枠は消し、::after に出す');
  assert.ok(cssBody('.cn-link:focus-visible::after').startsWith('outline:2px solid var(--gold);outline-offset:2px;'), '焦点の枠は 2px の金色で離れ 2px（カードの形に沿う）');
  assert.ok(/(?:^|\n)\.card\.reel-open \.cn-link::after\{display:none;\}/.test(INDEX), 'リールを再生している間は全面リンクを外す（動画の操作を邪魔しない）');
  assert.ok(cssBody('.cm-credit').includes('display:none'), '撮影者の文字の行は、リスト以外では出さない');
});

test('CSS: リストは 96px の四角の写真・1 列・押す所を残して補助の要素を出さない', () => {
  const ci = cssBody('.grid.list-mode .ci');
  for (const s of ['flex:0 0 96px', 'width:96px', 'height:96px', 'aspect-ratio:1/1']) assert.ok(ci.includes(s), `リストの写真: ${s}`);
  assert.ok(cssBody('.grid.list-mode').includes('grid-template-columns:1fr !important;'), 'リストは 1 列（スマホの 2 列の指定に負けない）');
  assert.ok(/padding-right:38px/.test(cssBody('.grid.list-mode .cn')), '題名は右上の ♡ と重ならない余白を持つ');
  for (const sel of ['.grid.list-mode .card-actions', '.grid.list-mode .card-lead', '.grid.list-mode .card-tags', '.grid.list-mode .card-featured']) {
    assert.strictEqual(cssBody(sel), 'display:none;', `リストでは出さない: ${sel}`);
  }
  assert.strictEqual(cssBody('.grid.list-mode .photo-credit'), 'display:none;', 'リストでは写真の帯の撮影者を隠す（96px では 2 文字しか読めない）');
  assert.ok(cssBody('.grid.list-mode .cm-credit').includes('display:block'), '代わりに文字の行で撮影者を全部見せる');
  assert.ok(cssBody('.grid.list-mode .cm-near').includes('display:block'), '2 行目「最寄駅 徒歩N分・ジャンル」を出す');
  assert.ok(cssBody('.grid.list-mode .cm-area').includes('display:none'), '地域名の行は出さない（2 行目と同じ情報）');
});

test('CSS: スマホ（768px 以下）のグリッドは 2 列の写真タイル・PC のカードは変えない', () => {
  assert.ok(/@media\(max-width:768px\)\{\.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);\}\}/.test(INDEX), 'スマホの一覧は 2 列');
  const a = INDEX.indexOf('/* スマホの「グリッド表示」');
  assert.ok(a > 0, 'スマホのタイルの区画が見つからない');
  const block = INDEX.slice(a, INDEX.indexOf('/* ── FAV BUTTON ── */', a));
  assert.ok(/^\/\*[^\n]*\*\/\n@media\(max-width:768px\)\{/.test(block), 'タイルの規則は @media(max-width:768px) の中だけ');
  assert.ok(block.includes('.grid:not(.list-mode) .ci{aspect-ratio:1/1;'), 'タイルの写真は 1:1');
  for (const s of ['.grid:not(.list-mode) .card-actions{display:none;}', '.grid:not(.list-mode) .card-lead{display:none;}', '.grid:not(.list-mode) .cm-price,.grid:not(.list-mode) .card-rating-n{display:none;}']) {
    assert.ok(block.includes(s), `タイルでは出さない: ${s}`);
  }
  assert.ok(cssBody('.cm-near').includes('display:none'), '2 行目（cm-near）は PC のカードでは出さない（従来の地域名の行を残す）');
});

test('CSS: 口コミ件数は割れずに折り返す（320px で「（2,170」と「件）」に割れた）', () => {
  assert.ok(cssBody('.card-rating-n').includes('white-space:nowrap'));
  assert.ok(cssBody('.card-rating').includes('flex-wrap:wrap') || /(?:^|\n)\.card-rating\{flex-wrap:wrap;\}/.test(INDEX));
});

// ── 動き（index.html の実物の関数を偽の DOM で動かす）────────────────────────
function makeEl(tag, className) {
  const e = { tagName: tag, className: className || '', attrs: {}, children: [], parentNode: null, textContent: '', style: {} };
  e.classList = {
    contains: (c) => e.className.split(/\s+/).includes(c),
    add: (c) => { if (!e.classList.contains(c)) e.className = (e.className + ' ' + c).trim(); },
    toggle: (c, force) => {
      const has = e.classList.contains(c);
      const want = force === undefined ? !has : !!force;
      if (want && !has) e.className = (e.className + ' ' + c).trim();
      if (!want && has) e.className = e.className.split(/\s+/).filter((x) => x && x !== c).join(' ');
    },
  };
  e.getAttribute = (k) => (Object.prototype.hasOwnProperty.call(e.attrs, k) ? e.attrs[k] : null);
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
  e.removeAttribute = (k) => { delete e.attrs[k]; };
  e.appendChild = (c) => { c.parentNode = e; e.children.push(c); return c; };
  e.removeChild = (c) => { e.children = e.children.filter((x) => x !== c); c.parentNode = null; return c; };
  e.replaceChild = (n, o) => { e.children = e.children.map((x) => (x === o ? n : x)); n.parentNode = e; o.parentNode = null; return o; };
  e.querySelectorAll = () => [];
  e.querySelector = (sel) => {
    const want = sel.slice(1);
    const walk = (n) => { for (const c of n.children) { if (c.classList.contains(want)) return c; const f = walk(c); if (f) return f; } return null; };
    return walk(e);
  };
  e.closest = (sel) => {
    const want = sel.slice(1);
    for (let n = e; n; n = n.parentNode) if (n.classList.contains(want)) return n;
    return null;
  };
  return e;
}

const TRUST = {
  name: '口コミ信頼度', shortName: '信頼度',
  tiers: [{ id: 'A', cssClass: 'tier-a', label: '参考にしやすい' }, { id: 'B', cssClass: 'tier-b', label: 'おおむね参考にできる' }],
  na: { id: '—', cssClass: 'tier-na', label: '判断できる口コミが少ない' },
};

// 偽の DOM と、カードが頼る周りの関数を用意して、index.html の実物の関数を読み込む
function load(opts) {
  opts = opts || {};
  const grid = makeEl('div', 'grid' + (opts.listMode ? ' list-mode' : ''));
  const calls = { queries: 0, openM: [], storage: {}, setItem: [] };
  const elements = { grid, 'vt-grid': makeEl('button', 'active'), 'vt-list': makeEl('button') };
  const document = {
    getElementById: (id) => (opts.noGrid && id === 'grid' ? null : elements[id] || null),
    querySelectorAll: () => { calls.queries++; return []; },
    createElement: (tag) => makeEl(tag),
  };
  const storage = {
    getItem: (k) => { if (opts.storageThrows) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(calls.storage, k) ? calls.storage[k] : null; },
    setItem: (k, v) => { if (opts.storageThrows) throw new Error('blocked'); calls.storage[k] = String(v); calls.setItem.push([k, String(v)]); },
  };
  if (opts.saved) calls.storage.nb_view = opts.saved;
  const ctx = {
    console, document, localStorage: storage, calls,
    window: { matchMedia: opts.noMatchMedia ? undefined : (q) => ({ matches: !!opts.narrow && q === '(max-width:768px)' }) },
    ALL_STORES: opts.stores || [],
    SORT_MODE: 'default',
    TRUST_POLICY: opts.noTrust ? undefined : TRUST,
    NB_IMG_FALLBACK: '/assets/fallback.svg',
    nbVerifiedReel: opts.reel ? () => ({ kind: 'reel', code: 'REELCODE' }) : () => null,
    hotpepperUrl: (r) => 'https://www.hotpepper.jp/str' + (r['ホットペッパーID'] || '') + '/',
    hasTabelogStorePage: () => !!opts.tabelogPage,
    tabelogSearchUrl: () => 'https://tabelog.com/search',
    instagramSearchUrl: () => 'https://www.instagram.com/explore/',
    gmap: (name) => 'https://www.google.com/maps/search/' + encodeURIComponent(name),
    nbBrandImg: (n) => '<img class="brand-fav" data-brand="' + n + '">',
    nbImage: (u, w) => u + '#w' + w,
    nbSrcset: (u, ws) => ws.map((w) => u + '#w' + w + ' ' + w + 'w').join(', '),
    nbStoreByName: (n) => (n === '既知の店' ? { '店名': n } : null),
    nbStoreFigure: (s) => 'data:figure/' + s['店名'],
    openM: (i, source) => { calls.openM.push([i, source]); },
  };
  ctx.window.localStorage = storage;
  vm.createContext(ctx);
  const names = ['nbEscHtml', 'mWalkFromAccess', 'nbStationKey', 'nbNearText', 'nbCardSizes', 'nbCardClick', 'nbPhotoCredit', 'nbPhotoCreditLine',
    'nbStoreHref', 'nbStoreKey', 'nbImgFallback', 'nbSavedView', 'nbDefaultView', 'applyViewMode', 'setViewMode', 'restoreViewMode', 'buildCardHtml'];
  // 例外の表（NB_STORE_PAGES）は、生成器が STORE-INDEX の区画に書く。渡さなければ「表が無い」状態（例外なし）で動かす
  vm.runInContext((opts.pages ? 'var NB_STORE_PAGES = ' + JSON.stringify(opts.pages) + ';\n' : '') + names.map(fnSource).join('\n'), ctx);
  return ctx;
}

const STORE = {
  '店名': '焼肉 福 錦通り店', 'エリア': '栄', 'ジャンル': '焼肉・ホルモン', '都道府県': '愛知県', '最寄駅': '栄', 'アクセス': '地下鉄栄駅 徒歩5分',
  '写真URL': 'https://example.com/photo.jpg', 'Google評価': '4.8', '口コミ数': 901, '価格帯': '4001〜5000円', 'ホットペッパーID': 'J001', reviewTrust: { t: 'A' },
};
// 店舗ページが無い店（ID はあるが現役のページが無い）。リンクを付けず、従来どおりボタンにする
const NO_PAGE = { none: { J001: 1 }, to: {} };

test('カード（実物の関数）: 写真・題名のリンク・最寄駅の徒歩・評価と口コミ件数・価格帯・信頼度・予約が出る', () => {
  const c = load({ stores: [STORE] });
  const html = c.buildCardHtml(STORE);
  assert.ok(html.startsWith('<div class="card has-link" onclick="nbCardClick(event,0)">'), 'リンクのある店はボタンの属性を持たない');
  assert.ok(!/role="button"/.test(html), 'リンクのある店に role=button は付けない（題名の a が入り口・二重に読み上げない）');
  assert.ok(html.includes('<h3 class="cn"><a class="cn-link" href="stores/J001.html">焼肉 福 錦通り店</a></h3>'), '題名のリンク');
  assert.ok(html.includes("trackEvent('cta_gmap_click',{store_name:'焼肉 福 錦通り店',location:'card',store_id:'J001',link_kind:nbMapLinkKind(this.href)})"),
    '地図の計測は店の ID とリンクの形つき（MEO-006）');
  assert.ok(html.includes('src="https://example.com/photo.jpg#w400"'), '写真は 400 幅を src に');
  assert.ok(html.includes('srcset="https://example.com/photo.jpg#w192 192w, https://example.com/photo.jpg#w288 288w, https://example.com/photo.jpg#w400 400w, https://example.com/photo.jpg#w600 600w, https://example.com/photo.jpg#w800 800w"'),
    'srcset は 192〜800（リストの 96px×DPR2〜3 から PC の大きな写真まで）');
  assert.ok(html.includes('sizes="(max-width:900px) 50vw, (max-width:1024px) 33vw, 25vw"'), '一覧の既定の写真の幅の目安');
  assert.ok(html.includes('alt="焼肉 福 錦通り店" data-genre="焼肉"'), 'alt は店名・data-genre は壊れたときの印の文字');
  assert.ok(html.includes('onerror="nbImgFallback(this)"'), '壊れた写真は nbImgFallback へ');
  assert.ok(html.includes('<span class="cm-near">栄駅 徒歩5分・焼肉</span>'), '2 行目＝最寄駅 徒歩N分・ジャンル（ジャンルは最初の 1 つ）');
  assert.ok(/<span class="cm-area">[\s\S]*?栄<\/span>/.test(html), 'PC のカードの地域名の行は残る');
  assert.ok(html.includes('<span class="cm-price">4001〜5000円</span>'), '価格帯');
  assert.ok(html.includes('<span class="gs-src">Google</span>') && html.includes('4.8<span class="card-rating-n">（901件）</span>'), 'Google ★ と口コミ件数');
  assert.ok(/<span data-l="口コミ信頼度" class="cc-cell tier-a" title="口コミ信頼度 A：参考にしやすい（タップで内訳）">[\s\S]*?<span class="cc-l">信頼度<\/span>A<\/span>/.test(html), '口コミ信頼度の段階');
  assert.ok(/<div class="card-cta"><a href="https:\/\/www\.hotpepper\.jp\/strJ001\/" target="_blank" onclick="event\.stopPropagation\(\);nbReserveExit\('cta_click',\{store_name:'焼肉 福 錦通り店',store_id:'J001',link_domain:'www\.hotpepper\.jp',location:'card'\}\)"/.test(html),
    '予約ボタンの計測（location=card）は変えない');
  assert.ok(!html.includes('card-flag'), '札は出ない');
  assert.ok(!html.includes('photo-credit') && !html.includes('cm-credit'), '店の宣材写真（既定）には撮影者を出さない');
});

test('カード: 食べログ・Instagram の媒体リンクは card_media の計測のまま・クリックはカードに伝えない', () => {
  const c = load({ stores: [STORE], tabelogPage: true });
  const html = c.buildCardHtml(STORE);
  const mrow = (html.match(/<div class="mrow">([\s\S]*?)<\/div><\/div>/) || [])[1] || '';
  assert.ok(/class="ml tb"[^>]*onclick="event\.stopPropagation\(\);nbReserveExit\('cta_click',\{store_name:'焼肉 福 錦通り店',store_id:'J001',link_domain:'tabelog\.com',location:'card_media'\}\);"/.test(mrow), '食べログ');
  assert.ok(/class="ml ig"[^>]*onclick="event\.stopPropagation\(\)"/.test(mrow), 'Instagram');
  assert.ok(!/class="ml hp"/.test(mrow), '予約ボタンがある店はホットペッパーの媒体リンクを重ねない');
});

test('カード: 写真が無い店は <img> を出さず、ジャンルの印を置く（「写真準備中」の暗い図は出さない）', () => {
  const r = Object.assign({}, STORE, { '写真URL': '', '写真出所': 'places-user', '写真クレジット': '誰か' });
  const c = load({ stores: [r] });
  const html = c.buildCardHtml(r);
  assert.ok(html.startsWith('<div class="card is-nophoto has-link"'), 'is-nophoto');
  assert.ok(!/<img src=/.test(html), '写真の <img> は無い');
  assert.ok(html.includes('<span class="ci-mark" aria-hidden="true">焼肉</span>'), 'ジャンルの印');
  assert.ok(!html.includes('写真準備中') && !html.includes('data:figure'), '暗い代替図は出さない');
  assert.ok(!html.includes('photo-credit') && !html.includes('cm-credit'), '写真が無いのに撮影者だけ残さない');
});

test('カード: 店舗ページへのリンクが無い店は、従来どおりボタン（role=button・tabindex・aria-label）', () => {
  const c = load({ pages: NO_PAGE, stores: [STORE] });
  const html = c.buildCardHtml(STORE);
  assert.ok(html.startsWith('<div class="card" onclick="nbCardClick(event,0)" role="button" tabindex="0" aria-label="焼肉 福 錦通り店の詳細を見る">'), html.slice(0, 160));
  assert.ok(html.includes('<h3 class="cn">焼肉 福 錦通り店</h3>') && !html.includes('cn-link'), '題名はリンクにしない');
});

test('カード: 客が投稿した写真の撮影者は、写真の帯と文字の行の両方に同じ文字で出す（逃がす）', () => {
  const r = Object.assign({}, STORE, { '写真出所': 'places-user', '写真クレジット': '村上 <b>&"\'' });
  const c = load({ stores: [r] });
  const html = c.buildCardHtml(r);
  const credit = '📷 村上 &lt;b&gt;&amp;&quot;&#39;';
  assert.ok(html.includes('<span class="photo-credit" title="Google マップの利用者が投稿した写真です">' + credit + '</span>'), '帯');
  assert.ok(html.includes('<span class="cm-credit" title="Google マップの利用者が投稿した写真です">' + credit + '</span>'), '文字の行');
  assert.ok(html.indexOf('photo-credit') < html.indexOf('cm-credit'), '帯は写真の中・行は本文の中');
  assert.ok(/<div class="cmeta">[\s\S]*<span class="cm-credit"/.test(html), '行は cmeta の中');
  assert.ok(!html.includes('<b>'), '撮影者の中の < は逃がしてある（タグとして出ない）');
  for (const src of ['places-owner', 'hotpepper', '']) {
    const o = Object.assign({}, STORE, { '写真出所': src, '写真クレジット': '店' });
    assert.ok(!/photo-credit|cm-credit/.test(load({ stores: [o] }).buildCardHtml(o)), `客の写真でなければ撮影者を出さない: ${src || '(無し)'}`);
  }
  const noName = Object.assign({}, STORE, { '写真出所': 'places-user', '写真クレジット': '  ' });
  assert.ok(!/photo-credit|cm-credit/.test(load({ stores: [noName] }).buildCardHtml(noName)), '撮影者名が空なら出さない');
});

test('カードの札と紹介文: 話題・編集部推薦・経験者レビューは残し、「ポイント紹介」は出さない', () => {
  const c = load({ stores: [] });
  const make = (extra) => { const r = Object.assign({}, STORE, extra); c.ALL_STORES.length = 0; c.ALL_STORES.push(r); return c.buildCardHtml(r); };
  assert.ok(make({ 'トレンドラベル': '話題沸騰' }).includes('<span class="card-flag trend-hot">話題沸騰</span>'));
  assert.ok(make({ '編集部推薦': true }).includes('<span class="card-flag flag-editor">編集部推薦</span>'));
  assert.ok(make({ insiderReviewCount: 3 }).includes('<span class="card-flag flag-insider">経験者レビュー3件</span>'));
  const point = make({ 'おすすめポイント': '炭火で焼く' });
  assert.ok(!point.includes('card-flag'), 'おすすめポイントだけの店に札は付けない');
  assert.ok(point.includes('<div class="card-lead"><span class="card-lead-kicker">ポイント：</span>炭火で焼く</div>'), '紹介文の見出しは「ポイント：」');
  assert.ok(make({ editorReason: '理由' }).includes('<span class="card-lead-kicker">編集部：</span>理由'));
  assert.ok(make({ insiderNote: 'メモ' }).includes('<span class="card-lead-kicker">知っておきたいこと：</span>メモ'));
});

test('カードの 2 行目と評価: 駅が分からない店は地域名・県外は県名・口コミ件数は 3 桁区切り・無ければ出さない', () => {
  const c = load({ pages: NO_PAGE, stores: [] });
  const make = (extra) => { const r = Object.assign({}, STORE, extra); c.ALL_STORES.length = 0; c.ALL_STORES.push(r); return c.buildCardHtml(r); };
  assert.ok(make({ '最寄駅': '', 'アクセス': '' }).includes('<span class="cm-near">栄・焼肉</span>'), '駅が分からない店は 地域・ジャンル');
  assert.ok(make({ '最寄駅': '', 'アクセス': '', '都道府県': '岐阜県', 'エリア': '多治見' }).includes('<span class="cm-near">岐阜県 多治見・焼肉</span>'), '県外は県名を付ける');
  assert.ok(make({ '口コミ数': '2170' }).includes('（2,170件）'), '文字列でも 3 桁区切り');
  assert.ok(!make({ '口コミ数': 0 }).includes('card-rating-n') && !make({ '口コミ数': undefined }).includes('card-rating-n'), '件数が無ければ出さない');
  assert.ok(!make({ 'Google評価': '' }).includes('card-rating'), '評価が無ければ評価の行ごと出さない');
  assert.ok(!make({ reviewTrust: null }).includes('cc-cell'), '口コミ信頼度が無ければ出さない');
  assert.ok(!load({ pages: NO_PAGE, stores: [STORE], noTrust: true }).buildCardHtml(STORE).includes('cc-cell'), '表示基準が注入されていなければ出さない');
  assert.ok(!make({ '価格帯': '' }).includes('cm-price'), '価格帯が無ければ出さない');
  const gmapOnly = make({ 'ホットペッパーID': '' });
  assert.ok(gmapOnly.includes('card-cta-map-only') && /class="ml hp"/.test(gmapOnly), 'ホットペッパーの無い店は地図ボタンだけ・媒体リンクにホットペッパーを出す');
});

test('カードの写真の幅の目安（sizes）: 一覧の既定・リスト（96px）・エリア別の索引', () => {
  const grid = load({ stores: [STORE] });
  assert.strictEqual(grid.nbCardSizes(), '(max-width:900px) 50vw, (max-width:1024px) 33vw, 25vw');
  assert.strictEqual(grid.nbCardSizes('index'), '(max-width:640px) 100vw, (max-width:900px) 50vw, 25vw');
  const list = load({ stores: [STORE], listMode: true });
  assert.strictEqual(list.nbCardSizes(), '96px');
  assert.ok(list.buildCardHtml(STORE).includes('sizes="96px"'), 'リストのカードは 96px を目安にする');
  assert.ok(list.buildCardHtml(STORE, 'index').includes('sizes="(max-width:640px) 100vw, (max-width:900px) 50vw, 25vw"'), '索引のカードはリストの設定に引きずられない');
  assert.strictEqual(load({ noGrid: true }).nbCardSizes(), '(max-width:900px) 50vw, (max-width:1024px) 33vw, 25vw', '一覧の要素が無くても例外を出さない');
});

test('カードに入れる文字の逃がし方: 店名・ジャンルの < > & " \' が属性や本文を破らない', () => {
  const r = Object.assign({}, STORE, { '店名': 'A&B "C" <D> \'E\'', 'ジャンル': '"焼肉"<x>' });
  const c = load({ pages: NO_PAGE, stores: [r] });
  const html = c.buildCardHtml(r);
  assert.ok(html.includes('aria-label="A&amp;B &quot;C&quot; &lt;D&gt; &#39;E&#39;の詳細を見る"'), 'aria-label');
  assert.ok(html.includes('alt="A&amp;B &quot;C&quot; &lt;D&gt; &#39;E&#39;"'), 'alt');
  assert.ok(html.includes('<h3 class="cn">A&amp;B &quot;C&quot; &lt;D&gt; &#39;E&#39;</h3>'), '題名');
  assert.ok(html.includes('data-genre="&quot;焼肉&quot;&lt;x&gt;"'), 'data-genre');
  assert.ok(html.includes('<span class="cm-near">栄駅 徒歩5分・&quot;焼肉&quot;&lt;x&gt;</span>'), '2 行目（最寄駅・ジャンル）');
  assert.ok(html.includes('<span class="ci-mark"') === false, '写真がある店に印は出ない');
  const noPhoto = Object.assign({}, r, { '写真URL': '' });
  assert.ok(load({ pages: NO_PAGE, stores: [noPhoto] }).buildCardHtml(noPhoto).includes('<span class="ci-mark" aria-hidden="true">&quot;焼肉&quot;&lt;x&gt;</span>'), '印の文字');
});

test('カードのリール: 動画のある店は再生ボタンを写真の中に置く', () => {
  const c = load({ stores: [STORE], reel: true });
  const html = c.buildCardHtml(STORE);
  assert.ok(/<div class="ci">[\s\S]*<button class="reel-play" onclick="nbPlayReel\(event,this,'REELCODE'\)"[\s\S]*<span class="reel-tag">リール<\/span><\/div>/.test(html));
});

test('店舗ページの href: 店のホットペッパーID から stores/<ID>.html と組み立てる。ID が無い・不正な形の店は出さない（I-25・0039）', () => {
  const c = load();
  const href = (r) => c.nbStoreHref(r);
  assert.strictEqual(href({ 'ホットペッパーID': 'J000017111' }), 'stores/J000017111.html');
  assert.strictEqual(href({ 'ホットペッパーID': 'J001', '店名': 'どの店名でも', 'エリア': '栄' }), 'stores/J001.html', '店名・エリア・ジャンルは見ない（ID だけ）');
  // 同じ店名・エリア・ジャンルの 2 件でも、ID が違えばそれぞれの店のページへ着く（以前は同じ表記の 2 件はボタンにしていた）
  const twin = { '店名': 'A店', 'エリア': '栄', 'ジャンル': '焼肉' };
  assert.strictEqual(href(Object.assign({ 'ホットペッパーID': 'J010' }, twin)), 'stores/J010.html');
  assert.strictEqual(href(Object.assign({ 'ホットペッパーID': 'J011' }, twin)), 'stores/J011.html');
  // ID の無い店（手動で載せた店）は、店舗ページへの対応を店のデータから引けないのでリンクにしない（カードはボタン）
  assert.strictEqual(href({ '店名': 'B店', 'エリア': '栄', 'ジャンル': '焼肉' }), '');
  assert.strictEqual(href({ 'ホットペッパーID': '' }), '');
  assert.strictEqual(href({ 'ホットペッパーID': null }), '');
  assert.strictEqual(href({}), '', '空の記録でも例外を出さない');
  assert.strictEqual(href(undefined), '', 'undefined でも例外を出さない');
  assert.strictEqual(href(null), '', 'null でも例外を出さない');
  // 属性や URL を破れる文字・パスの区切り・別のスキームは使わない
  for (const bad of ['javascript:alert(1)', 'a"b', "a'b", 'a<b', 'a b', 'a/b', '../x', 'a.b', 'a?x=1', 'a#b', 'a%2Fb', 'ＪＯ１']) {
    assert.strictEqual(href({ 'ホットペッパーID': bad }), '', `不正な形の ID は使わない: ${bad}`);
  }
  assert.strictEqual(c.calls.queries, 0, 'DOM は読まない（以前は全店の索引を読んでいた）');
});

test('店舗ページの href: 例外の表（NB_STORE_PAGES）の none はリンクにせず、to は移り先のページへ。表の形が壊れていても例外を出さない（I-25・0039）', () => {
  const pages = { none: { J020: 1 }, to: { J021: 'J099', J022: 'bad/slug', J023: '' } };
  const c = load({ pages });
  const href = (id) => c.nbStoreHref({ 'ホットペッパーID': id });
  assert.strictEqual(href('J020'), '', 'ID はあるが現役の店舗ページが無い店は、リンクにしない（検索へのリンクだけの店）');
  assert.strictEqual(href('J021'), 'stores/J099.html', '古い ID の誘導ページを経て移った店は、移り先の現役ページへ');
  assert.strictEqual(href('J022'), '', '移り先のスラグが不正な形なら使わない');
  assert.strictEqual(href('J023'), 'stores/J023.html', '移り先が空なら自分の ID のページ');
  assert.strictEqual(href('J024'), 'stores/J024.html', '表に無い ID は、自分の ID のページ（既定でリンクを付ける）');
  // オブジェクトに元からある名前（constructor・toString・__proto__ など）は、表の項目として扱わない
  for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
    assert.strictEqual(href(id), `stores/${id}.html`, `表に無い名前は例外にならない: ${id}`);
  }
  // 表の形が壊れている・空・片方だけでも動く
  for (const broken of [{}, { none: {} }, { to: {} }, { none: null, to: null }, { none: 'x', to: 'y' }, null]) {
    assert.strictEqual(load({ pages: broken }).nbStoreHref({ 'ホットペッパーID': 'J030' }), 'stores/J030.html', JSON.stringify(broken));
  }
  // 表そのものが無い（STORE-INDEX の区画が書かれなかった）ときも、ID から組み立てる
  assert.strictEqual(load().nbStoreHref({ 'ホットペッパーID': 'J031' }), 'stores/J031.html');
});

test('最寄駅 徒歩N分: 同じ駅だと確かめられたときだけ分数を付ける（アクセスの文は複数の駅を並べる）', () => {
  const c = load();
  const near = (st, acc) => c.nbNearText({ '最寄駅': st, 'アクセス': acc });
  assert.strictEqual(near('栄', '地下鉄栄駅 徒歩5分'), '栄駅 徒歩5分');
  assert.strictEqual(near('栄駅', '栄駅から徒歩5分'), '栄駅 徒歩5分', '「駅」が付いていても同じ');
  assert.strictEqual(near('名古屋', 'JR名古屋駅から徒歩3分'), '名古屋駅 徒歩3分', '事業者名は落として比べる');
  assert.strictEqual(near('桜ケ丘', '桜ヶ丘駅 徒歩2分'), '桜ケ丘駅 徒歩2分', 'ヶ と ケ のゆれはそろえる');
  assert.strictEqual(near('栄', '伏見駅 徒歩10分'), '栄駅', '最寄駅と別の駅の分数は付けない（誤りになる）');
  assert.strictEqual(near('栄', '栄エリア'), '栄駅', '徒歩の分数が読めなければ駅名だけ');
  assert.strictEqual(near('', '名古屋駅 徒歩5分'), '名古屋駅 徒歩5分', '最寄駅が無い店は、アクセスの文から読めた駅と分数（同じ一致の組）');
  assert.strictEqual(near('近鉄名古屋', '近鉄名古屋駅 徒歩5分'), '近鉄名古屋駅 徒歩5分', '最寄駅の側に事業者名が付いていても同じ駅');
  assert.strictEqual(near('名古屋', '名古屋市営地下鉄東山線名古屋駅 徒歩3分'), '名古屋駅 徒歩3分', 'アクセスの文の路線名（○○線）と事業者名は落として比べる');
  assert.strictEqual(near('久屋大通', '桜通線〔久屋大通〕駅 徒歩2分'), '久屋大通駅', '括弧つきの表記は同じ駅と決められないので、分数は付けない');
  assert.strictEqual(near('', '桜通線〔久屋大通〕駅 徒歩2分'), '', '最寄駅が無く、駅名がきれいに読めないときは出さない');
  assert.strictEqual(near('', 'あいうえおかきくけこさ駅 徒歩5分'), '', '駅名が 11 字以上なら読み間違いの疑いがあるので出さない');
  assert.strictEqual(near('', '名古屋市中村区名駅 徒歩3分'), '', '最寄駅が無く、住所の頭（市・区の名前）が駅名のように読めるときは出さない（I-22）');
  assert.strictEqual(near('', 'バス停から徒歩3分'), '');
  assert.strictEqual(near('', ''), '');
  assert.strictEqual(c.nbNearText({}), '');
});

test('クリックの振り分け: ふつうのクリックは詳細・新しいタブ（修飾キー・中クリック）と ♡ は本来の動き', () => {
  const c = load();
  const ev = (over) => {
    const e = Object.assign({ target: { closest: () => null }, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, prevented: false }, over || {});
    e.preventDefault = () => { e.prevented = true; };
    return e;
  };
  const plain = ev(); c.nbCardClick(plain, 7);
  assert.deepStrictEqual(c.calls.openM, [[7, 'grid']], 'modal_open の source は grid のまま');
  assert.ok(plain.prevented, 'リンクの既定の動き（店舗ページへ移動）は止める');
  for (const over of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }]) {
    const before = c.calls.openM.length;
    const e = ev(over); c.nbCardClick(e, 3);
    assert.strictEqual(c.calls.openM.length, before, `詳細を開かない: ${JSON.stringify(over)}`);
    assert.ok(!e.prevented, `リンク本来の動きに任せる: ${JSON.stringify(over)}`);
  }
  const fav = ev({ target: { closest: (s) => (s === '.fav-btn' ? {} : null) } });
  const before = c.calls.openM.length; c.nbCardClick(fav, 1);
  assert.strictEqual(c.calls.openM.length, before, '♡ は詳細を開かない');
  assert.ok(!fav.prevented);
  assert.doesNotThrow(() => c.nbCardClick({ preventDefault() {}, button: 0 }, 2), 'target が無いイベントでも例外を出さない');
});

test('表示モード: 保存が無ければスマホはリスト・それ以外はグリッド・選んだ表示は保存され既定に勝つ', () => {
  const narrow = load({ narrow: true });
  assert.strictEqual(narrow.nbDefaultView(), 'list');
  assert.strictEqual(load({ narrow: false }).nbDefaultView(), 'grid');
  assert.strictEqual(load({ noMatchMedia: true }).nbDefaultView(), 'grid', 'matchMedia が無い環境はグリッド');
  assert.strictEqual(narrow.nbSavedView(), '');
  assert.strictEqual(load({ saved: 'list' }).nbSavedView(), 'list');
  assert.strictEqual(load({ saved: 'grid' }).nbSavedView(), 'grid');
  assert.strictEqual(load({ saved: 'tile' }).nbSavedView(), '', '知らない値は無いものとして扱う');
  assert.strictEqual(load({ storageThrows: true }).nbSavedView(), '', '保存領域が使えなくても例外を出さない');
  const state = (c) => ({
    list: c.document.getElementById('grid').classList.contains('list-mode'),
    gridBtn: [c.document.getElementById('vt-grid').classList.contains('active'), c.document.getElementById('vt-grid').getAttribute('aria-pressed')],
    listBtn: [c.document.getElementById('vt-list').classList.contains('active'), c.document.getElementById('vt-list').getAttribute('aria-pressed')],
  });
  narrow.restoreViewMode();
  assert.deepStrictEqual(state(narrow), { list: true, gridBtn: [false, 'false'], listBtn: [true, 'true'] }, 'スマホで保存が無い → リスト');
  assert.strictEqual(narrow.calls.setItem.length, 0, '既定は保存しない（あとで画面の幅が変わっても追従できる）');
  const savedGrid = load({ narrow: true, saved: 'grid' });
  savedGrid.restoreViewMode();
  assert.deepStrictEqual(state(savedGrid), { list: false, gridBtn: [true, 'true'], listBtn: [false, 'false'] }, '保存された選択は既定に勝つ');
  const pc = load({ narrow: false });
  pc.restoreViewMode();
  assert.strictEqual(state(pc).list, false, 'PC は写真のグリッド');
  pc.setViewMode('list');
  assert.deepStrictEqual(pc.calls.setItem, [['nb_view', 'list']], '選んだ表示を保存する');
  assert.strictEqual(state(pc).list, true);
  assert.doesNotThrow(() => load({ storageThrows: true }).setViewMode('list'), '保存できなくても表示は切り替わる');
  const blocked = load({ storageThrows: true }); blocked.setViewMode('list');
  assert.strictEqual(state(blocked).list, true);
});

test('表示モード: 切り替えたら、すでにある写真の sizes も 96px とグリッドの目安を行き来する', () => {
  const c = load({ narrow: false });
  const imgs = [makeEl('img'), makeEl('img')];
  const asked = [];
  c.document.getElementById('grid').querySelectorAll = (sel) => { asked.push(sel); return imgs; };
  c.applyViewMode('list');
  assert.deepStrictEqual(asked, ['.card .ci img'], 'カードの写真だけを対象にする（索引の外・モーダルの写真には触れない）');
  assert.deepStrictEqual(imgs.map((i) => i.getAttribute('sizes')), ['96px', '96px']);
  c.applyViewMode('grid');
  assert.deepStrictEqual(imgs.map((i) => i.getAttribute('sizes')), ['(max-width:900px) 50vw, (max-width:1024px) 33vw, 25vw', '(max-width:900px) 50vw, (max-width:1024px) 33vw, 25vw']);
  assert.doesNotThrow(() => load({ noGrid: true }).applyViewMode('list'), '一覧が無いページでも例外を出さない');
});

test('壊れた写真: カードではジャンルの印に替え、撮影者の表示も一緒に外し is-nophoto を付ける', () => {
  const c = load();
  const card = makeEl('div', 'card');
  const ci = makeEl('div', 'ci'); card.appendChild(ci);
  const cb = makeEl('div', 'cb'); card.appendChild(cb);
  const img = makeEl('img'); img.setAttribute('data-genre', '焼肉'); img.setAttribute('onerror', 'nbImgFallback(this)'); img.setAttribute('srcset', 'x 1w');
  const credit = makeEl('span', 'photo-credit'); ci.appendChild(credit); ci.appendChild(img);
  const line = makeEl('span', 'cm-credit'); cb.appendChild(line);
  c.nbImgFallback(img);
  const mark = ci.children.find((x) => x.classList.contains('ci-mark'));
  assert.ok(mark && mark.textContent === '焼肉' && mark.getAttribute('aria-hidden') === 'true', 'ジャンルの印に替わる');
  assert.ok(!ci.children.includes(img) && !ci.children.includes(credit), '写真と撮影者の帯は外れる');
  assert.ok(!cb.children.includes(line), '撮影者の文字の行も外れる');
  assert.ok(card.classList.contains('is-nophoto'), 'is-nophoto');
  assert.strictEqual(img.getAttribute('onerror'), null, 'onerror は外す（二重発火の防止）');
  c.nbImgFallback(img);   // 二度目は何もしない（data-nb-fallback）。カード以外の差し替えの分岐にも入らない
  assert.strictEqual(ci.children.filter((x) => x.classList.contains('ci-mark')).length, 1, '二度目の発火で印が増えない');
  assert.strictEqual(img.src, undefined, '二度目の発火で、代替図への差し替えの分岐に入らない');
});

test('壊れた写真: カード以外（モーダルなど）は従来どおり代替図に差し替える', () => {
  const c = load();
  const wrap = makeEl('div', 'mhi-track');
  const img = makeEl('img'); img.setAttribute('alt', '既知の店'); img.setAttribute('srcset', 'x 1w'); wrap.appendChild(img);
  c.nbImgFallback(img);
  assert.strictEqual(img.src, 'data:figure/既知の店');
  assert.strictEqual(img.style.objectFit, 'cover');
  const other = makeEl('img'); other.setAttribute('alt', '知らない店'); makeEl('div', 'ci').appendChild(other);   // .ci でも .card の外なら従来どおり
  c.nbImgFallback(other);
  assert.strictEqual(other.src, '/assets/fallback.svg');
});
