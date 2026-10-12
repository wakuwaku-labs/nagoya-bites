'use strict';

/**
 * tests/store_page_action_bar.test.js — 店舗ページの行動バー（I-14b・予約・電話・地図をスマホの画面の下に固定する）
 *
 * 背景: 検索から着いた人の予約ボタンは、店舗ページの約 2,500px 下（「予約・情報を確認」の節）にあり、最初の画面にも
 * 画面の下にも無かった。計画 7.3 節の表のとおり、店の種類（予約先の有無×電話を出せるか）で4通りの帯を、スマホ
 * （幅 768px 以下）の画面の下に固定する。PC では出さない（本文のリンク欄の操作は変えない）。
 *
 * ここでは次を見る。読むのは生成器（gen-store-pages.js）と共通 CSS（assets/css/nb.css）だけで、日次で作り直す stores/ の
 * 生成物は見ない（build.yml は npm test を再生成より前に回すので、生成物を読むテストは前の日の生成物を見てしまう）。
 *   1. ボタンの出し分け（4通り＋食べログ）と、一番手（塗り）・並び順・行き先を書いたラベル
 *   2. 計測は本文と同じ語彙で location だけを store_page_bar にする（予約の store_id の規則は本文と同じ）
 *   3. 読み上げ: region と名前・アイコンは隠す・見える文字が名前に含まれる・結果の行はボタンと同じ親
 *   4. 置き場所: フッターの後ろ・<main> の外・1つだけ。本文のリンク欄は残る（電話は予約先の無い店だけ・これまでの規則）
 *   5. 電話の実装（共有の1本）と鍵の定義は、電話を出す店にだけ入る
 *   6. CSS: スマホだけ・sticky・ドロワーより下・押す所は 44px 以上・文字は 13px 以上のトークン・予約申告プロンプトを持ち上げる
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { renderStorePage, buildActionBar } = require(path.join(ROOT, 'gen-store-pages.js'));
const { CALL_SCRIPT } = require(path.join(ROOT, 'scripts/lib/call_button_snippet.js'));
const NB_CSS = fs.readFileSync(path.join(ROOT, 'assets/css/nb.css'), 'utf8');

const BASE_ARGS = {
  name: 'テスト酒場',
  hpId: '',
  hpUrl: '',
  tbUrl: '',
  placeId: 'ChIJtestPlace',
  callOk: false,
  gmUrl: 'https://www.google.com/maps/search/test',
};
const bar = (over) => buildActionBar({ ...BASE_ARGS, ...over });
const HP = { hpId: 'J000000001', hpUrl: 'https://www.hotpepper.jp/strJ000000001/' };
const TB = { tbUrl: 'https://tabelog.com/aichi/A2301/A230101/23000001/' };

/** 帯の中のボタン（a / button）を、出てくる順に [{tag, cls, text}] で返す */
function buttons(html) {
  const out = [];
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const cls = (m[2].match(/class="([^"]*)"/) || [])[1] || '';
    out.push({ tag: m[1], cls, attrs: m[2], text: m[3].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}
const isPrimary = (b) => /\bnb-bar-primary\b/.test(b.cls);

// ── 1. 出し分け ──

test('予約先あり（ホットペッパー）＋電話を出せる店: [予約（塗り）] [電話] [地図]', () => {
  const b = buttons(bar({ ...HP, callOk: true }));
  assert.deepEqual(b.map((x) => x.text), ['ホットペッパーで予約', '電話する', '地図']);
  assert.deepEqual(b.map(isPrimary), [true, false, false], '塗りは予約だけ');
});

test('予約先あり（ホットペッパー）＋電話を出せない店: [予約（塗り）] [地図]（押しても何も起きない電話は作らない）', () => {
  const html = bar({ ...HP, callOk: false });
  const b = buttons(html);
  assert.deepEqual(b.map((x) => x.text), ['ホットペッパーで予約', '地図']);
  assert.deepEqual(b.map(isPrimary), [true, false]);
  assert.ok(!/nbCallStore|nb-call-status/.test(html), '電話も結果の行も出さない');
});

test('予約先なし＋電話を出せる店: [電話する（塗り）] [地図]', () => {
  const b = buttons(bar({ callOk: true }));
  assert.deepEqual(b.map((x) => x.text), ['電話する', '地図']);
  assert.deepEqual(b.map(isPrimary), [true, false]);
  assert.equal(b[0].tag, 'button', '電話は button（押したときに番号を取る）');
});

test('予約先なし＋電話も出せない店: [地図を開く（塗り）] だけ', () => {
  const b = buttons(bar({}));
  assert.deepEqual(b.map((x) => x.text), ['地図を開く']);
  assert.deepEqual(b.map(isPrimary), [true]);
});

test('食べログだけの店: 予約先は食べログ。行き先を書く。ホットペッパーもあれば、ホットペッパーを先にする', () => {
  const only = buttons(bar({ ...TB, callOk: true }));
  assert.deepEqual(only.map((x) => x.text), ['食べログで予約・確認', '電話する', '地図']);
  assert.match(only[0].attrs, /href="https:\/\/tabelog\.com\//);
  const both = buttons(bar({ ...HP, ...TB }));
  assert.deepEqual(both.map((x) => x.text), ['ホットペッパーで予約', '地図'], '食べログは本文のリンク欄に残るだけで、帯には並べない');
  assert.match(both[0].attrs, /href="https:\/\/www\.hotpepper\.jp\//);
});

test('どの店でも、塗りのボタンはちょうど1つで、地図は必ずある', () => {
  for (const hp of [false, true]) for (const tb of [false, true]) for (const call of [false, true]) {
    const html = bar({ ...(hp ? HP : {}), ...(tb ? TB : {}), callOk: call });
    const b = buttons(html);
    assert.equal(b.filter(isPrimary).length, 1, `hp=${hp} tb=${tb} call=${call}`);
    assert.ok(b.some((x) => /nb-bar-map/.test(x.cls)), `hp=${hp} tb=${tb} call=${call}: 地図がある`);
    assert.ok(/href="https:\/\/www\.google\.com\/maps\//.test(html));
  }
});

// ── 2. 計測 ──

test('計測: 予約は本文と同じ cta_click の語彙で、location だけ store_page_bar。store_id の規則は本文と同じ', () => {
  const hp = bar({ ...HP });
  assert.match(hp, /nbReserveExit\('cta_click',\{store_name:'テスト酒場',store_id:'J000000001',link_domain:'www\.hotpepper\.jp',location:'store_page_bar'\}\)/);
  // 食べログだけの店の store_id は、ホットペッパーID が無いので placeId（本文のリンク欄と同じ）
  const tb = bar({ ...TB });
  assert.match(tb, /nbReserveExit\('cta_click',\{store_name:'テスト酒場',store_id:'ChIJtestPlace',link_domain:'tabelog\.com',location:'store_page_bar'\}\)/);
  const withHp = bar({ ...HP, ...TB });
  assert.ok(!/tabelog\.com'/.test(withHp), 'ホットペッパーがあれば食べログは帯に出ない');
});

test('計測: 地図は cta_gmap_click（店名と location つき）、電話は data-call-loc=store_page_bar（cta_call_click・call_lookup の location になる）', () => {
  const html = bar({ ...HP, callOk: true });
  assert.match(html, /trackEvent\('cta_gmap_click',\{link_url:this\.href,store_name:'テスト酒場',location:'store_page_bar'\}\)/);
  assert.match(html, /<button type="button" class="nb-bar-btn nb-bar-sub nb-bar-tel" data-call-loc="store_page_bar" onclick="nbCallStore\(event,'ChIJtestPlace','テスト酒場',this\)"/);
});

test('計測: 店名に \' や " や < があっても、onclick と属性が途中で切れない', () => {
  const html = bar({ ...HP, name: `O'Brien "Bar" <b>`, callOk: true });
  assert.ok(!/<b>/.test(html), '店名の < > はエスケープされる');
  assert.ok(!/store_name:'O'Brien/.test(html), "店名の ' はそのまま JS の文字列に入れない");
  assert.match(html, /aria-label="O&#39;Brien &quot;Bar&quot; &lt;b&gt;に電話する"/);
  const attrs = html.match(/ (onclick|aria-label)="[^"]*"/g) || [];
  assert.ok(attrs.length >= 5, '属性が全部閉じている');
});

// ── 3. 読み上げ ──

test('読み上げ: region に店名つきの名前。アイコンは隠す。見える文字が、読み上げの名前に含まれる（WCAG 2.5.3）', () => {
  const html = bar({ ...HP, callOk: true });
  assert.match(html, /^<div class="nb-action-bar" role="region" aria-label="テスト酒場の予約・電話・地図">/);
  assert.equal((html.match(/<svg\b/g) || []).length, (html.match(/<svg[^>]*aria-hidden="true"/g) || []).length, 'アイコンは全部 aria-hidden');
  for (const m of html.matchAll(/<(?:a|button)\b[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/(?:a|button)>/g)) {
    const visible = m[2].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
    assert.ok(m[1].includes(visible), `名前「${m[1]}」に見える文字「${visible}」を含む`);
  }
});

test('結果の行は、電話のボタンと同じ親の中に1つ（nbCallStore がそこへ書く）。電話が無い帯には置かない', () => {
  const withCall = bar({ ...HP, callOk: true });
  assert.equal((withCall.match(/<p class="nb-call-status" role="status"><\/p>/g) || []).length, 1);
  const inner = withCall.replace(/^<div[^>]*>\n/, '').replace(/\n<\/div>$/, '');
  assert.ok(!/<div|<\/div>/.test(inner), 'ボタンも結果の行も、帯の直下に並ぶ（入れ子の箱を作らない）');
  assert.ok(!/nb-call-status/.test(bar({ ...HP, callOk: false })));
});

test('電話の文字は「電話する」のまま（nbCallStore が、確認中のあとに戻す文字と同じ）', () => {
  for (const html of [bar({ ...HP, callOk: true }), bar({ callOk: true })]) {
    assert.match(html, /<span>電話する<\/span>/);
  }
});

// ── 4. 置き場所と本文のリンク欄 ──

const STORE = {
  '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', '住所': '愛知県名古屋市中区栄1-1-1',
  'おすすめポイント': '炭火の焼き鳥が看板。', placeId: 'ChIJtestPlace',
};
const render = (over) => renderStorePage({ ...STORE, ...over }, 'J-test', [], []);
const barOf = (html) => (html.match(/<div class="nb-action-bar"[\s\S]*?\n<\/div>/) || [''])[0];

test('店舗ページ: 帯は1つだけで、フッターの後ろ・<main> の外（<body> の直下。sticky が効く場所）', () => {
  const html = render({ 'ホットペッパーID': 'J000000001', '電話確認': '住所' });
  assert.equal((html.match(/class="nb-action-bar"/g) || []).length, 1);
  const iMainEnd = html.indexOf('</main>');
  const iFooterEnd = html.indexOf('</footer>');
  const iBar = html.indexOf('<div class="nb-action-bar"');
  assert.ok(iMainEnd > 0 && iFooterEnd > iMainEnd && iBar > iFooterEnd, '</main> と </footer> の後ろに置く');
  assert.ok(html.indexOf('</body>') > iBar);
  assert.ok(!/<(?:header|footer|main|section|aside)\b/.test(barOf(html)), '帯の中にランドマークを入れない');
});

test('店舗ページ: どの店にも帯がある（地図は必ずある）。本文のリンク欄（予約・情報を確認）も残る', () => {
  for (const over of [{}, { 'ホットペッパーID': 'J000000001' }, { '食べログURL': 'https://tabelog.com/aichi/A2301/A230101/23000001/' }, { '電話確認': '住所' }]) {
    const html = render(over);
    assert.ok(barOf(html), JSON.stringify(over));
    assert.match(html, /<div class="links-section">\s*<h2>予約・情報を確認<\/h2>/, '本文のリンク欄は残す');
    assert.match(html, /<a class="link-btn gm"/, '本文の Google マップのリンクも残る');
  }
});

test('店舗ページ: 本文のリンク欄の予約は location:store_page のまま（帯と分けて数えられる）', () => {
  const html = render({ 'ホットペッパーID': 'J000000001' });
  const body = html.replace(barOf(html), '');
  assert.match(body, /<a class="link-btn hp"[^>]*nbReserveExit\('cta_click',\{store_name:'テスト酒場',store_id:'J000000001',link_domain:'www\.hotpepper\.jp',location:'store_page'\}\)/);
  assert.ok(!/store_page_bar/.test(body), '帯の分は本文に出ない');
});

test('店舗ページ: 電話を本文のリンク欄に出すのは、これまでどおり予約先の無い店だけ。帯には、予約先のある店にも並ぶ', () => {
  const noRes = render({ '電話確認': '住所' });
  assert.match(noRes.replace(barOf(noRes), ''), /class="link-btn tel"/, '予約先なしの店は本文にも電話');
  assert.deepEqual(buttons(barOf(noRes)).map((x) => x.text), ['電話する', '地図']);
  const hp = render({ 'ホットペッパーID': 'J000000001', '電話確認': '住所' });
  assert.ok(!/class="link-btn tel"/.test(hp), '予約先ありの店は、本文には電話を出さない（これまでの規則）');
  assert.deepEqual(buttons(barOf(hp)).map((x) => x.text), ['ホットペッパーで予約', '電話する', '地図']);
  const unverified = render({ 'ホットペッパーID': 'J000000001' });
  assert.deepEqual(buttons(barOf(unverified)).map((x) => x.text), ['ホットペッパーで予約', '地図'], '紐付けを確かめられていない店には電話を出さない');
  const noPlace = render({ 'ホットペッパーID': 'J000000001', placeId: '', '電話確認': '店名' });
  assert.deepEqual(buttons(barOf(noPlace)).map((x) => x.text), ['ホットペッパーで予約', '地図'], 'placeId が無い店にも出さない');
});

// ── 5. 電話の実装と鍵 ──

test('電話の共有の実装と鍵の定義は、電話を出す店（帯に電話がある店）にだけ、1回入る', () => {
  const withCall = render({ 'ホットペッパーID': 'J000000001', '電話確認': '住所' });
  assert.equal(withCall.split(CALL_SCRIPT).length - 1, 1);
  assert.match(withCall, /<script>var NB_CALL_MAPS_KEY='[^']+';<\/script>/);
  for (const html of [render({ 'ホットペッパーID': 'J000000001' }), render({})]) {
    assert.ok(!html.includes('nb-call-js') && !html.includes('NB_CALL_MAPS_KEY') && !html.includes('nbCallStore'));
  }
});

// ── 6. CSS ──

/** nb.css の「店舗ページの行動バー」の節（コメントの次の行から末尾まで） */
function barCss() {
  const i = NB_CSS.indexOf('.nb-action-bar{display:none;}');
  assert.ok(i > 0, 'nb.css に行動バーの節がある');
  return NB_CSS.slice(i);
}
/** @media(max-width:768px){ … } の中身（ブレースの対応を数えて取る） */
function mediaBlock(css) {
  const start = css.indexOf('@media(max-width:768px){');
  assert.ok(start >= 0, '幅 768px 以下のメディアクエリがある');
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('ブレースが閉じていない');
}
const ruleBody = (css, selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\~]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[{};\\s])${esc}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
};

test('CSS: PC では出さない（既定は display:none。出すのは幅 768px 以下だけ）', () => {
  const css = barCss();
  assert.match(css, /^\.nb-action-bar\{display:none;\}/);
  const m = mediaBlock(css);
  const flex = ruleBody(m, '.nb-action-bar');
  assert.ok(flex && /display:flex/.test(flex));
  assert.ok(!/\.nb-action-bar\{[^}]*display:flex/.test(css.replace(m, '')), 'メディアクエリの外では flex にしない');
});

test('CSS: 画面の下に貼り付く（sticky・bottom:0）。ヘッダーのドロワー（199〜201）より下に重なる', () => {
  const body = ruleBody(mediaBlock(barCss()), '.nb-action-bar');
  assert.match(body, /position:sticky/);
  assert.match(body, /bottom:0/);
  const z = Number((body.match(/z-index:(\d+)/) || [])[1]);
  assert.ok(z > 0 && z < 199, `z-index は 1〜198（今は ${z}）`);
  assert.match(body, /env\(safe-area-inset-bottom\)/, '端末の下の余白（ホームバー）を避ける');
});

test('CSS: 押す所は 44px 以上、文字は 13px 以上のトークンだけ（font-size のリテラルを足さない）', () => {
  const css = barCss();
  const btn = ruleBody(css, '.nb-bar-btn');
  assert.ok(Number((btn.match(/min-height:(\d+)px/) || [])[1]) >= 44, 'ボタンの高さは 44px 以上（--tap-min）');
  const sizes = [...css.matchAll(/font-size:([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(sizes.length >= 3);
  for (const s of sizes) assert.match(s, /^var\(--fs-(xs|sm|md|lg)\)$/, `font-size は 13px 以上のトークン: ${s}`);
  const sub = ruleBody(css, '.nb-bar-sub');
  assert.match(sub, /flex:0 0 4\.25rem/, '電話・地図の幅は、「電話する」（13px×4字）が1行に入る幅');
});

test('CSS: 予約申告プロンプトを帯の上に持ち上げ、キーボードの焦点が帯の下に隠れない。結果の行は帯の中で上に出る', () => {
  const m = mediaBlock(barCss());
  assert.match(m, /\.nb-action-bar ~ \.nb-reserve-ask\{bottom:calc\(var\(--action-bar-h\)/);
  assert.match(m, /html:has\(\.nb-action-bar\)\{scroll-padding-bottom:calc\(var\(--action-bar-h\)/);
  assert.match(m, /\.nb-action-bar \.nb-call-status\{order:-1;\}/, '結果の行はボタンの上（ボタンが動かない）');
  const h = Number((NB_CSS.match(/--action-bar-h:(\d+)px/) || [])[1]);
  assert.ok(h >= 69, `--action-bar-h（${h}px）は帯の高さ（ボタン 52px＋上下の余白 16px＋境界線 1px＝69px）以上`);
});

test('CSS: 帯の色はトークンだけ（背景は --bg・塗りは --gold）', () => {
  const css = barCss();
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), '色のリテラルを足さない');
  assert.match(ruleBody(mediaBlock(css), '.nb-action-bar'), /background:var\(--bg\)/);
  assert.match(ruleBody(css, '.nb-bar-primary'), /background:var\(--gold\)/);
});
