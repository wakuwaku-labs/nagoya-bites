'use strict';
// UI・UX改修計画 I-08（計測をそろえる）: 改修の効果を同じ物差しで測れるようにする。
//   1. ハブの「ホットペッパーで予約」は、予約送客の集計に入る cta_click（location=hub）を送る
//      （以前の hub_store_click は EXIT_EVENTS に入らず、ハブからの予約送客が数えられなかった）
//   2. クイックビューの modal_open に store_id が入る
//   3. 特集の feature_store_click の店の値は店名ではなく ID（リンク先のスラグ）
//   4. ジャーナルの記事から店舗ページへのクリックを journal_store_click で数える
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const { EXIT_EVENTS } = require('../scripts/lib/reservation_exits');
const hub = require('../scripts/gen_area_genre_pages.js');
const rosters = require('../scripts/refresh_feature_rosters.js');
const { processHtml } = require('../scripts/add_feature_tracking');
const jsl = require('../scripts/lib/journal_store_link_tracking');

const POLICY = { name: '口コミ信頼度', na: { id: '-', label: '', cssClass: '' }, tiers: [] };
const FAKE = { '店名': "O'Brien 名駅店", 'ホットペッパーID': 'J001234567', 'エリア': '名古屋駅', 'ジャンル': '居酒屋', '価格帯': '3001～4000円' };

// ── 1. ハブ ──
test('ハブの予約リンクは、予約送客の cta_click（location=hub）を送る', () => {
  assert.ok(EXIT_EVENTS.includes('cta_click'), '予約送客の集計が cta_click を数えている前提');
  const html = hub.storeCard(FAKE, 0, 2, POLICY, []);
  assert.ok(html.includes("'cta_click'"), 'cta_click を送る');
  assert.ok(html.includes("location:'hub'"), 'location=hub');
  assert.ok(html.includes("store_id:'J001234567'"), 'store_id はホットペッパーID');
  assert.ok(html.includes("link_domain:'www.hotpepper.jp'"), 'link_domain');
  assert.ok(html.includes('hub:location.pathname'), '押したハブのパスも送る（元の hub_store_click と同じ値）');
  assert.ok(!html.includes('hub_store_click'), '予約送客に数えられない hub_store_click は送らない');
});

test('ハブの onclick は、店名の引用符を逃がして属性を壊さない', () => {
  const html = hub.storeCard(FAKE, 0, 2, POLICY, []);
  const attr = /onclick="([^"]*)"/.exec(html);
  assert.ok(attr, 'onclick 属性が1つのまま閉じている');
  assert.ok(attr[1].includes("O\\'Brien"), "店名の ' は \\' に逃がす");
  // JS として構文が通る
  assert.doesNotThrow(() => new vm.Script(attr[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
});

test('ホットペッパーIDが無い店のハブのカードに、予約リンクは出ない', () => {
  const html = hub.storeCard({ ...FAKE, 'ホットペッパーID': '' }, 0, 2, POLICY, []);
  assert.ok(!html.includes('store-link-reserve'));
  assert.ok(!html.includes('cta_click'));
});

test('生成器は hub_store_click を残していない', () => {
  assert.ok(!read('scripts/gen_area_genre_pages.js').includes("trackEvent('hub_store_click'"));
});

// ── 2. クイックビュー ──
test('modal_open は store_id を送り、source も残っている', () => {
  const line = read('index.html').split('\n').find(l => l.includes("trackEvent('modal_open'"));
  assert.ok(line, "trackEvent('modal_open'… が1行ある");
  assert.ok(/store_id: *r\['ホットペッパーID'\] *\|\| *''/.test(line), 'store_id はホットペッパーID（無い店は空）');
  assert.ok(/source: *source *\|\| *'unknown'/.test(line), 'source は今のまま');
  assert.ok(line.includes('store_name'), 'store_name も今のまま（名前は変えない）');
});

// ── 3. 特集 ──
test('月次の掲載店の入れ替えは、feature_store_click の店の値を ID で書く', () => {
  const entry = { store: { ...FAKE, '写真URL': 'https://example.com/a.jpg', 'Google評価': '4.2' }, isNew: false };
  for (const html of [rosters.renderStoreCard(entry, 1, 'banquet'), rosters.renderShopCard(entry, 1, 'banquet')]) {
    assert.ok(html.includes("feature_store_click',{store:'J001234567',feature:'banquet'}"), 'ID で送る');
    assert.ok(!html.includes("store:'O\\'Brien"), '店名では送らない');
  }
});

test('add_feature_tracking は、店名の旧形式をリンク先の ID に書き換える（冪等）', () => {
  const old = `<a href="https://nagoya-bites.com/stores/J003785077.html" onclick="trackEvent('feature_store_click',{store:'餃子のかっちゃん 栄錦店',feature:'banquet'})">詳細</a>`;
  const out = processHtml(old, 'banquet');
  assert.ok(out.includes("feature_store_click',{store:'J003785077',feature:'banquet'}"));
  assert.strictEqual(processHtml(out, 'banquet'), out, '2回目は変わらない');
  // 店名に \' を含む旧形式
  const esc = `<a href="../stores/J000000001.html" onclick="trackEvent('feature_store_click',{store:'O\\'Brien & Co',feature:'x'})">詳細</a>`;
  assert.ok(processHtml(esc, 'x').includes("feature_store_click',{store:'J000000001',feature:'x'}"));
  // リンク先の店舗ページが分からない <a> は触らない（ID を推測しない）
  const noHref = `<a href="#" onclick="trackEvent('feature_store_click',{store:'名前だけ',feature:'x'})">x</a>`;
  assert.ok(processHtml(noHref, 'x').includes("store:'名前だけ'"));
});

test('公開中の特集の feature_store_click は、どれも店の値がリンク先のスラグと同じ', () => {
  const bad = [];
  let n = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'features')).filter(f => f.endsWith('.html'))) {
    for (const m of read('features/' + f).matchAll(/<a\s+([^>]*)>/gi)) {
      const c = /feature_store_click',\s*\{store:\s*'((?:\\'|[^'])*)'/.exec(m[1]);
      const h = /href=["'][^"']*\/stores\/([A-Za-z0-9_-]+)\.html/.exec(m[1]);
      if (!c || !h) continue;
      n++;
      if (c[1] !== h[1]) bad.push(`${f}: store:'${c[1]}' ≠ href ${h[1]}`);
    }
  }
  assert.ok(n > 500, `feature_store_click を持つリンクを十分に見ている（${n}）`);
  assert.deepStrictEqual(bad.slice(0, 5), [], `${bad.length}件で店の値がスラグと違う`);
});

// ── 4. ジャーナル ──
function runSnippet(pathname) {
  const m = /<script class="[^"]*">([\s\S]*?)<\/script>/.exec(jsl.SNIPPET);
  const sent = [];
  let handler = null;
  // vm の中で作られたオブジェクトは prototype が別なので、JSON に通して比べられる形にする
  const ctx = { document: { addEventListener: (t, fn) => { if (t === 'click') handler = fn; } }, location: { pathname }, trackEvent: (n, p) => sent.push(JSON.parse(JSON.stringify([n, p]))) };
  vm.runInNewContext(m[1], ctx);
  const click = href => handler({ target: { closest: sel => (sel === 'a[href]' ? { getAttribute: () => href } : null) } });
  return { sent, click };
}

test('ジャーナルの計測: 記事から店舗ページへのクリックを journal_store_click で送る', () => {
  const { sent, click } = runSnippet('/journal/2026-10-11-hoshigaoka-afros-bbq-enkai.html');
  click('../stores/J004660861.html');
  click('https://nagoya-bites.com/stores/J000000002.html?utm_source=x');
  click('../stores/awayuki.html#top');
  assert.deepStrictEqual(sent, [
    ['journal_store_click', { store: 'J004660861', journal: '2026-10-11-hoshigaoka-afros-bbq-enkai' }],
    ['journal_store_click', { store: 'J000000002', journal: '2026-10-11-hoshigaoka-afros-bbq-enkai' }],
    ['journal_store_click', { store: 'awayuki', journal: '2026-10-11-hoshigaoka-afros-bbq-enkai' }],
  ]);
});

test('ジャーナルの計測: 店舗の一覧・ハブ・外部リンクは数えない', () => {
  const { sent, click } = runSnippet('/journal/2026-10-11-x.html');
  for (const href of ['../stores/index.html', '../stores/area/nishiki/izakaya.html', 'https://www.hotpepper.jp/strJ001/', '../features/banquet.html', '#', '']) click(href);
  assert.deepStrictEqual(sent, []);
});

test('ジャーナルの計測: 入れ方は冪等で、記事の他の部分を変えない', () => {
  const page = '<html><body><p>本文</p>\n<script class="nb-engagement-tracking">\nvar a=1;\n</script>\n<script>var b=2;</script>\n</body></html>';
  const once = jsl.applyToHtml(page);
  assert.ok(once.includes(jsl.MARKER));
  assert.strictEqual(jsl.applyToHtml(once), once);
  assert.strictEqual(once.replace(jsl.SNIPPET, ''), page, 'SNIPPET を除くと元のまま');
  assert.ok(once.indexOf(jsl.SNIPPET) > once.indexOf('nb-engagement-tracking'), 'engagement 計測の後に入る');
  assert.strictEqual(jsl.applyToHtml('<html><p>body が無い</p></html>'), null);
});

test('ジャーナルの計測: テンプレートと公開済みのすべての記事に入っている', () => {
  const tpl = read('journal/_template.html');
  assert.ok(tpl.includes(jsl.SNIPPET), 'テンプレートは SNIPPET と同じ文字列を持つ（新しい記事に自動で入る）');
  assert.strictEqual(tpl.split(jsl.MARKER).length - 1, 1, 'テンプレートに1つだけ');
  const missing = fs.readdirSync(path.join(ROOT, 'journal'))
    .filter(f => /^20\d\d-.*\.html$/.test(f))
    .filter(f => !read('journal/' + f).includes(jsl.SNIPPET));
  assert.deepStrictEqual(missing.slice(0, 5), [], `${missing.length}本の記事に入っていない（node scripts/add_journal_store_link_tracking.js で入れる）`);
});
