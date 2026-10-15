'use strict';
// P-475: GA4 が受け取った URL の # の後ろを数える道具（scripts/ga4_fragment_counts.js）。件数だけを出し、URL・検索語・店の ID を出さない。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const f = require(path.join(ROOT, 'scripts', 'ga4_fragment_counts.js'));
const GEO = ['栄', '名古屋駅', '金山'];

test('エリア名: index.html の GEO_AREAS から「現在地」が選ぶエリア名を読む', () => {
  const names = f.readGeoAreas(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  assert.ok(names.includes('名古屋駅') && names.includes('栄'), names.join(','));
  assert.ok(names.length >= 10, `エリア名が少なすぎる: ${names.length}`);
});

test('分類: # なし・q がエリア名・q がそれ以外・q なし。知らないキーは「その他のキー」', () => {
  assert.deepEqual(f.classifyLocation('https://nagoya-bites.com/', GEO), { fragment: false, keys: [], q: 'none' });
  assert.deepEqual(f.classifyLocation('https://nagoya-bites.com/#q=%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%A7%85', GEO), { fragment: true, keys: ['q'], q: 'geo-area' });
  assert.deepEqual(f.classifyLocation('https://nagoya-bites.com/#area=sakae&q=%E3%83%A9%E3%83%BC%E3%83%A1%E3%83%B3&store=J001', GEO), { fragment: true, keys: ['area', 'q', 'store'], q: 'other' });
  assert.deepEqual(f.classifyLocation('https://nagoya-bites.com/#feedback', GEO), { fragment: true, keys: [], q: 'none' });
  assert.deepEqual(f.classifyLocation('https://nagoya-bites.com/#utm=x&q=', GEO), { fragment: true, keys: ['(その他のキー)', 'q'], q: 'none' });
  assert.equal(f.classifyLocation('https://nagoya-bites.com/#q=%E6%A0%84%ZZ', GEO).q, 'other', '壊れた符号でも止まらない');
});

test('集計と要約: 件数だけを出し、URL・検索語・店の ID・知らないキーの名前を出さない', () => {
  const secretQ = encodeURIComponent('秘密の検索語');
  const rows = [
    { event: 'page_view', location: 'https://nagoya-bites.com/', count: 100 },
    { event: 'modal_open', location: `https://nagoya-bites.com/#q=${encodeURIComponent('栄')}&store=J999888`, count: 3 },
    { event: 'cta_click', location: `https://nagoya-bites.com/#q=${secretQ}`, count: 2 },
    { event: 'page_view', location: 'https://nagoya-bites.com/#privatekey=abc', count: 1 },
    { event: 'page_view', location: '(other)', count: 5 },
  ];
  const counts = f.aggregate(rows, GEO);
  assert.deepEqual(counts.events, { withFragment: 6, qGeoArea: 3, qOther: 2, qNone: 1 });
  assert.equal(counts.otherBucket, 5);
  assert.deepEqual(counts.byKey, { q: 5, store: 3, '(その他のキー)': 1 });
  assert.deepEqual(counts.byEvent.modal_open, { withFragment: 3, qGeoArea: 3, qOther: 0 });
  const text = f.summarize({ start: '30daysAgo', end: 'yesterday', fetchedAt: 'T', geoAreas: GEO, truncated: false, totalEvents: 111, totalPageViews: 106, counts });
  for (const leak of ['秘密の検索語', secretQ, 'J999888', 'privatekey', 'nagoya-bites.com/#', '栄&']) {
    assert.ok(!text.includes(leak), `要約に出してはいけない値: ${leak}`);
  }
  assert.match(text, /q がエリア名.*: 3/);
  assert.match(text, /q がそれ以外.*: 2/);
});

test('期間の指定: GA4 の日付の書き方だけを受け付ける（既定は 30daysAgo〜yesterday）', () => {
  assert.deepEqual(f.parseArgs([]), { start: '30daysAgo', end: 'yesterday', json: '' });
  assert.deepEqual(f.parseArgs(['--start', '2026-10-01', '--end', 'today']), { start: '2026-10-01', end: 'today', json: '' });
  assert.throws(() => f.parseArgs(['--start', '2026-10-01;rm']), /YYYY-MM-DD/);
  assert.throws(() => f.parseArgs(['--end', 'last week']), /YYYY-MM-DD/);
});

test('取得: # を含む URL だけを問い合わせ、rowCount に届くまでページを送る。合計は全イベントから取る', async () => {
  const all = Array.from({ length: 5 }, (_, i) => ({ dimensionValues: [{ value: 'page_view' }, { value: `https://nagoya-bites.com/#store=J${i}` }], metricValues: [{ value: '1' }] }));
  const bodies = [];
  const runReport = async (body) => {
    bodies.push(body);
    if (body.dimensions.length === 1) return { data: { rows: [{ dimensionValues: [{ value: 'page_view' }], metricValues: [{ value: '40' }] }, { dimensionValues: [{ value: 'scroll' }], metricValues: [{ value: '2' }] }] } };
    const off = Number(body.offset);
    return { data: { rowCount: all.length, rows: all.slice(off, off + 2) } }; // 1 回に 2 行しか返さない
  };
  const got = await f.fetchRows(runReport, '30daysAgo', 'yesterday');
  assert.equal(got.rows.length, 5);
  assert.equal(got.truncated, false);
  assert.deepEqual(bodies.map((b) => b.offset), ['0', '2', '4']);
  assert.deepEqual(bodies[0].dimensionFilter, { filter: { fieldName: 'pageLocation', stringFilter: { matchType: 'CONTAINS', value: '#' } } });
  assert.deepEqual(await f.fetchTotals(runReport, '30daysAgo', 'yesterday'), { total: 42, pageViews: 40, control: {} });
  assert.equal(bodies[bodies.length - 1].dimensionFilter, undefined, '合計は絞り込まない');
});

test('対照: # を書いた後に送るイベントの回数を要約に並べる（filter_apply があるのに # が 0 なら、GA4 は # の後ろを受け取っていない）', async () => {
  const runReport = async () => ({ data: { rows: [['page_view', 50], ['filter_apply', 7], ['modal_open', 3], ['scroll', 9]].map(([v, n]) => ({ dimensionValues: [{ value: v }], metricValues: [{ value: String(n) }] })) } });
  const totals = await f.fetchTotals(runReport, '30daysAgo', 'yesterday');
  assert.deepEqual(totals, { total: 69, pageViews: 50, control: { filter_apply: 7, modal_open: 3 } });
  const text = f.summarize({ start: '30daysAgo', end: 'yesterday', fetchedAt: 'T', geoAreas: GEO, truncated: false, totalEvents: 69, totalPageViews: 50, controlEvents: totals.control, counts: f.aggregate([], GEO) });
  assert.match(text, /filter_apply 7・modal_open 3・search 0・geo_search 0/);
  assert.match(text, /URL に # を含むイベント: 0/);
  // 対照のイベントは index.html が今も送っている
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const e of f.CONTROL_EVENTS) assert.ok(html.includes(`'${e}'`), `index.html が ${e} を送っていない`);
  const apply = html.indexOf("function applyFilters(");
  assert.ok(apply > 0 && html.indexOf('pushHash();', apply) > apply, 'applyFilters が # を書く');
});

test('再発の防止: トップと GA のスニペットは page_location を自分で渡さない（渡すと # の後ろの検索語・エリア名が GA4 に届く）', () => {
  // 2026-10-15 の実測（30 日・全イベント 11,134 件）で、GA4 の既定は # の後ろを受け取っていなかった。location.href などで上書きすると崩れる
  for (const rel of ['index.html', path.join('scripts', 'lib', 'ga_snippet.js')]) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.doesNotMatch(text, /page_location/, `${rel} が page_location を渡している`);
  }
});
