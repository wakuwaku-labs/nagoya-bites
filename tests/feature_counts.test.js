'use strict';
// 特集の見出し「N選」と実際の掲載数（ItemList・店カード）の一致を固定する（ISSUE-141）。
const test = require('node:test');
const assert = require('node:assert');
const { inspect, inspectAll } = require('../scripts/lib/feature_counts');

test('全特集で h1 の N選 = ItemList numberOfItems = 要素数 = 店カード枚数', () => {
  const bad = inspectAll();
  assert.deepStrictEqual(bad, [], JSON.stringify(bad, null, 1));
});

test('inspect: 不一致を検出できる', () => {
  const html = '<h1>名古屋の店10選</h1>' +
    '<script type="application/ld+json">{"@type":"ItemList","numberOfItems":2,"itemListElement":[{},{}]}</script>' +
    '<div class="shop-card"></div><div class="shop-card"></div>';
  const r = inspect(html);
  assert.strictEqual(r.n, 10);
  assert.strictEqual(r.problems.length, 2);
});

test('inspect: 一致していれば問題なし', () => {
  const html = '<h1>名古屋の店<em>2選</em></h1>' +
    '<script type="application/ld+json">{"@type":"ItemList","numberOfItems":2,"itemListElement":[{},{}]}</script>' +
    '<div class="store-card"></div><div class="store-card"></div>';
  assert.deepStrictEqual(inspect(html).problems, []);
});

// ── 掲載数の表記をそろえる（SEO-146）──
const fs = require('fs');
const path = require('path');
const {
  verifiedCount, featureSlugOf, relabelAll, relabelStrong, syncPage, syncAll,
} = require('../scripts/lib/feature_counts');

test('relabelAll: 掲載数でない数字（範囲の片割れ・桁区切り・序数・別の語）は書き換えない', () => {
  assert.strictEqual(relabelAll('予約困難店10軒を解剖。3要素で10軒を解説。', 9), '予約困難店9軒を解剖。3要素で9軒を解説。');
  assert.strictEqual(relabelAll('名駅3軒と栄5軒、計8選', 10), '名駅3軒と栄5軒、計10選');
  assert.strictEqual(relabelAll('名古屋の10店。業界人推薦10選・6店掲載', 6), '名古屋の6店。業界人推薦6選・6店掲載');
  assert.strictEqual(relabelAll('カウンター中心の1〜2店を含む9店', 8), 'カウンター中心の1〜2店を含む8店');
  assert.strictEqual(relabelAll('4,559軒から探す', 3), '4,559軒から探す');
  assert.strictEqual(relabelAll('2店舗目・店選び・2選択肢・10選', 6), '2店舗目・店選び・2選択肢・6選');
  assert.strictEqual(relabelAll('厳選10店（10店舗掲載）', 9), '厳選9店（9店舗掲載）');
});

test('relabelStrong: 本文は掲載数とわかる言い回しだけを書き換える', () => {
  const s = '編集部が上位に挙げた3軒。備長3店舗の中で。本特集の10軒は、判断した10軒、厳選10店、掲載10軒、10店舗掲載、10選。';
  assert.strictEqual(relabelStrong(s, 8),
    '編集部が上位に挙げた3軒。備長3店舗の中で。本特集の8軒は、判断した8軒、厳選8店、掲載8軒、8店舗掲載、8選。');
});

test('featureSlugOf: リンク元のディレクトリから特集ページを解決する', () => {
  assert.strictEqual(featureSlugOf('nagoya-steak.html'), 'nagoya-steak');
  assert.strictEqual(featureSlugOf('/features/date.html#a'), 'date');
  assert.strictEqual(featureSlugOf('https://nagoya-bites.com/features/birthday.html'), 'birthday');
  assert.strictEqual(featureSlugOf('features/birthday.html', ''), 'birthday');
  assert.strictEqual(featureSlugOf('../features/birthday.html', 'journal'), 'birthday');
  assert.strictEqual(featureSlugOf('index.html'), null);
  assert.strictEqual(featureSlugOf('../stores/J000000001.html'), null);
  assert.strictEqual(featureSlugOf('mailto:a@example.com'), null);
});

const FIXTURE = [
  '<html><head><title>名古屋の店10選｜NAGOYA BITES</title>',
  '<meta name="description" content="業界人が厳選10軒。上位3軒の理由も。">',
  '<meta property="og:title" content="名古屋の店10選">',
  '<script type="application/ld+json">{"@type":"Article","headline":"名古屋の店10選","description":"厳選10軒"}</script>',
  '<script type="application/ld+json">{"@type":"ItemList","name":"名古屋の店10選","numberOfItems":2,"itemListElement":[{"@type":"ListItem","position":1},{"@type":"ListItem","position":2}]}</script>',
  '<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"何軒？","acceptedAnswer":{"@type":"Answer","text":"本特集の10軒は個室あり。うち3軒は駅前。"}}]}</script>',
  '</head><body>',
  '<h1>名古屋の店<em>10選</em></h1>',
  '<div class="art-meta"><span>掲載10軒</span></div>',
  '<p>編集部が上位に挙げた3軒。本特集の10軒は駅から近い。</p>',
  '<div class="shop-card">A</div><div class="shop-card">B</div>',
  '<a class="related-link" href="other.html" onclick="track({link_text:\'他の特集12選\'})">他の特集12選</a>',
  '<a href="../stores/J000000001.html">3店舗目</a>',
  '<script>var x = "10選";</script>',
  '</body></html>',
].join('\n');

test('syncPage: 自ページの表記を確かめられる掲載数に、リンク文をリンク先の掲載数に合わせる（冪等）', () => {
  const { html, changes } = syncPage(FIXTURE, { self: 'me', counts: { me: 2, other: 7 } });
  assert.ok(changes.length > 0);
  assert.match(html, /<title>名古屋の店2選｜NAGOYA BITES<\/title>/);
  assert.match(html, /content="業界人が厳選2軒。上位3軒の理由も。"/, '裏付けのない「上位3軒」は掲載数として読まない');
  assert.match(html, /"headline":"名古屋の店2選","description":"厳選2軒"/);
  assert.match(html, /"name":"名古屋の店2選","numberOfItems":2/);
  assert.match(html, /本特集の2軒は個室あり。うち3軒は駅前。/, 'FAQ は言い回しで掲載数とわかる所だけ');
  assert.match(html, /<h1>名古屋の店<em>2選<\/em><\/h1>/);
  assert.match(html, /<span>掲載2軒<\/span>/);
  assert.match(html, /<p>編集部が上位に挙げた3軒。本特集の2軒は駅から近い。<\/p>/);
  assert.match(html, />他の特集7選<\/a>/);
  assert.match(html, /link_text:'他の特集12選'/, '属性の中は触らない');
  assert.match(html, />3店舗目<\/a>/, '特集でないリンクは触らない');
  assert.match(html, /var x = "10選";/, 'script の中は触らない');
  assert.strictEqual(syncPage(html, { self: 'me', counts: { me: 2, other: 7 } }).html, html);
});

test('syncPage: 自ページの掲載数を確かめられないときは自ページの表記に触らない', () => {
  const { html } = syncPage(FIXTURE, { self: 'me', counts: { other: 7 } });
  assert.match(html, /<title>名古屋の店10選｜NAGOYA BITES<\/title>/);
  assert.match(html, /本特集の10軒は駅から近い/);
  assert.match(html, />他の特集7選<\/a>/);
  assert.strictEqual(verifiedCount(FIXTURE), 2);
  assert.strictEqual(verifiedCount(FIXTURE.replace('<div class="shop-card">B</div>', '')), null);
});

test('公開中の特集: 掲載数の表記とリンク文がすべて確かめられる掲載数にそろっている', () => {
  const { changed } = syncAll({ write: false });
  assert.deepStrictEqual(changed, [], 'node scripts/sync_feature_counts.js で直す\n' + JSON.stringify(changed, null, 1));
});

test('公開中の特集: 店カードの通し番号が 1〜掲載数 をちょうど1回ずつ使っている', () => {
  const dir = path.join(__dirname, '..', 'features');
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html') && x !== 'index.html')) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const n = verifiedCount(html);
    const nums = [...html.matchAll(/<(div|span) class="(?:store-num|shop-num)">\s*(\d{1,3})\s*<\/\1>/g)].map(m => +m[2]);
    if (n == null || !nums.length) continue;
    const sorted = [...nums].sort((a, b) => a - b);
    if (sorted.length !== n || sorted.some((v, i) => v !== i + 1)) bad.push(`${f}: ${JSON.stringify(nums)}（掲載数 ${n}）`);
  }
  assert.deepStrictEqual(bad, []);
});
