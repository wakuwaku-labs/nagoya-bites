'use strict';
// MEO-005 の B2: 地図リンクを Google の公式の形（api=1）にし、place_id は紐付けが確認済みの店だけに付ける。
// 作り方は scripts/lib/map_link.js の nbMapUrl の1本で、店舗ページ（gen-store-pages.js）とトップ（index.html の NB-MAP-EMBED）が使う。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const map = require(path.join(ROOT, 'scripts', 'lib', 'map_link.js'));

function parts(url) {
  const u = new URL(url);
  return { origin: u.origin + u.pathname, hash: u.hash, keys: [...u.searchParams.keys()], params: Object.fromEntries(u.searchParams) };
}

test('公式の形: api=1 と query（店名＋住所）だけ。place_id は「地図確認」の欄がある店だけに付く', () => {
  const s = { '店名': '屋上酒場ホシノシタ', '住所': '愛知県名古屋市中村区名駅４丁目17‐4 あったらいいなビル４階', placeId: 'P_HINOKAMI' };
  const a = parts(map.nbMapUrl(s));
  assert.equal(a.origin, 'https://www.google.com/maps/search/');
  assert.deepEqual(a.keys, ['api', 'query'], '欄が無ければ place_id を付けない（別の店を開かないように）');
  assert.equal(a.params.api, '1');
  assert.equal(a.params.query, '屋上酒場ホシノシタ 愛知県名古屋市中村区名駅４丁目17‐4 あったらいいなビル４階');

  const b = parts(map.nbMapUrl({ ...s, [map.FIELD]: true }));
  assert.deepEqual(b.keys, ['api', 'query', 'query_place_id']);
  assert.equal(b.params.query_place_id, 'P_HINOKAMI');
  assert.deepEqual(parts(map.nbMapUrl({ '店名': '紐付けなし', [map.FIELD]: true })).keys, ['api', 'query'], 'placeId が無ければ付けない');
});

test('符号化: & # 空白・全角の記号を含む店名でも、query がそのまま戻り、リンクが途中で切れない', () => {
  const names = [
    ['Bar & Grill #1', 'Bar & Grill #1'],
    ['酒場 ＃２　＆ ＢＡＲ', '酒場 ＃２ ＆ ＢＡＲ'],
    ['焼肉 100%?', '焼肉 100%?'],
    ['【個室】炭火焼 鳥+ 名駅店', '炭火焼 鳥+ 名駅店'],
  ];
  for (const [name, cleaned] of names) {
    const url = map.nbMapUrl({ '店名': name, '住所': '愛知県名古屋市中区栄3-1-1', placeId: 'ChIJ+/=x', [map.FIELD]: true });
    const p = parts(url);
    assert.equal(p.hash, '', `${name}: # で切れない`);
    assert.deepEqual(p.keys, ['api', 'query', 'query_place_id'], `${name}: & で欄が増えない`);
    assert.equal(p.params.query, cleaned + ' 愛知県名古屋市中区栄3-1-1');
    assert.equal(p.params.query_place_id, 'ChIJ+/=x');
    assert.doesNotMatch(url, /[\s#]/, '空白と # は符号化される');
  }
});

test('住所の順: 掲載の住所 → アクセスの中の住所 → エリア（1つ目の地名）→ 名古屋。店名は読み仮名・装飾を外す', () => {
  const q = (s) => parts(map.nbMapUrl(s)).params.query;
  assert.equal(q({ '店名': '壺中天 こちゅうてん', '住所': '愛知県名古屋市中区錦3-1-1', 'アクセス': '栄駅（名古屋市中区栄1-1）', 'エリア': '栄' }), '壺中天 愛知県名古屋市中区錦3-1-1');
  assert.equal(q({ '店名': 'Cellarr（セラー）', 'アクセス': '伏見駅 徒歩3分（愛知県名古屋市中区栄2-2-2）' }), 'Cellarr 名古屋市中区栄2-2-2');
  assert.equal(q({ '店名': '店', 'エリア': '名古屋駅ﾒｲｴｷ/栄' }), '店 名古屋駅', '1つ目の地名・半角カナは外す');
  assert.equal(q({ '店名': '店' }), '店 名古屋');
});

test('annotateMapLinks: 確認済みの紐付けだけに欄を付ける。要確認・不一致・紐付けなし・スイッチを切った設定には付けない', () => {
  const addr = (rest) => `日本、〒460-0003 愛知県名古屋市中区${rest}`;
  const entry = (name, address) => ({ fetchedAt: '2026-05-22T00:00:00.000Z', placeId: 'P_' + name, name, formatted_address: addr(address) });
  const st = (name, address, id, placeName) => ({ '店名': name, '住所': `愛知県名古屋市中区${address}`, 'ホットペッパーID': id, placeId: 'P_' + placeName });
  const stores = () => [
    st('麺屋えび蔵', '錦２-13-24', 'J1', '麺屋えび蔵'),
    st('咲夜島 さくやじま 丸の内 伏見', '錦３丁目14-3', 'J2', '咲夜島'),
    st('別館', '栄１-1-1', 'J3', '麺屋えび蔵'),
    { '店名': '紐付けなし', '住所': '愛知県名古屋市中区栄2-2-2', 'ホットペッパーID': 'J4', [map.FIELD]: true },
  ];
  const places = { J1: entry('麺屋えび蔵', '錦２丁目１３−２４'), J2: entry('咲夜島', '錦３丁目１４−３'), J3: entry('麺屋えび蔵', '錦２丁目１３−２４') };
  const policy = { features: { map: { show: true, allowReviewBands: [] } } };
  const a = stores();
  const c = map.annotateMapLinks(a, places, { policy, reviewed: { entries: [] } });
  assert.deepEqual(a.map((s) => !!s[map.FIELD]), [true, false, false, false], '古い欄は消してから付け直す');
  assert.deepEqual(c, { ok: 1, 'binding-review': 1, 'binding-mismatch': 1 });

  const b = stores();
  map.annotateMapLinks(b, places, { policy: { features: { map: { show: false } } }, reviewed: { entries: [] } });
  assert.deepEqual(b.map((s) => !!s[map.FIELD]), [false, false, false, false], 'show=false で全店から外す');
});

test('index.html: 埋め込み（NB-MAP-EMBED）が scripts/lib/map_link.js とずれていない。地図リンクは nbMapUrl だけで作る', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(map.applyToHtml(html), html, 'ずれている: node scripts/lib/map_link.js --apply index.html');
  assert.match(html, /function gmap\(name, area, accessOrFullRecord\) \{\n  if \(accessOrFullRecord && typeof accessOrFullRecord === 'object'\) return nbMapUrl\(accessOrFullRecord\);/);
  assert.equal((html.match(/function cleanStoreName\(/g) || []).length, 1, 'cleanStoreName は埋め込みの中の1つだけ');
  assert.equal((html.match(/function cleanArea\(/g) || []).length, 1);
  assert.doesNotMatch(html, /maps\.google\.com\/search/);
  const gen = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.match(gen, /const gmUrl\s+= nbMapUrl\(s\);/);
  assert.doesNotMatch(gen, /google\.com\/maps\/search\/\$\{/);
});

test('index.html の埋め込みはブラウザの ES5 のまま動き、Node と同じ URL を返す', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const block = html.match(map.EMBED_RE)[0];
  assert.doesNotMatch(block, /\b(const|let)\b|=>|`/, 'ES5 で書く（const・let・アロー関数・テンプレート文字列を使わない）');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  const samples = [
    { '店名': 'Bar & Grill #1（バー）', '住所': '愛知県名古屋市中区栄3-1-1', placeId: 'P1', [map.FIELD]: true },
    { '店名': '壺中天 こちゅうてん', 'アクセス': '（名古屋市中区錦3-1-1）', placeId: 'P2' },
    { '店名': '店', 'エリア': '栄ｷﾀ錦/伏見' },
  ];
  for (const s of samples) assert.equal(ctx.nbMapUrl(s), map.nbMapUrl(s));
});
