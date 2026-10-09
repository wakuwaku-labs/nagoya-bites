'use strict';
// ISSUE-148: スプレッドシート経由の店を HotPepper の住所で検査し、県外の店を取り込まない。
// 住所が取れて「愛知県」を含まない店だけを外し、API が失敗した・返らなかった店は外さない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lookupAddressesByIds, splitByPrefecture, gateSpreadsheetRows, loadRecord, writeRecord, BATCH } = require('../scripts/lib/spreadsheet_address_gate');

const row = (id, name) => ({ 'ホットペッパーID': id, '店名': name, 'エリア': '栄', '都道府県': '愛知県' });
// 実例: 栄蔵（千葉県館山市・SEO-119）・魚々路 釧路店（北海道釧路市栄町・ISSUE-103）
const ROWS = [
  row('J000240935', '栄蔵'),
  row('J003625289', '【個室完備】炉端焼き 海鮮居酒屋 魚々路 - ととろ - 釧路店'),
  row('J000773251', '居酒屋 新九 しんく 栄本店'),
  row('J001144583', '牡蠣 貝料理居酒屋 貝しぐれ 栄泉店'),
];
const AREA_SHOPS = [{ id: 'J000773251', address: '愛知県名古屋市中区栄３－４－２８' }];
const API = {
  J000240935: '千葉県館山市八幡６２３－２０',
  J003625289: '北海道釧路市栄町５丁目４ 第2オリエンタルプラザビル 2F',
  J001144583: '愛知県名古屋市中区栄３-21-7',
};

function fakeFetch(calls, { fail = false } = {}) {
  return async (url) => {
    calls.push(url);
    if (fail) throw new Error(`connect ETIMEDOUT ${url}`);
    const ids = new URL(url).searchParams.get('id').split(',');
    return { results: { shop: ids.filter((id) => API[id]).map((id) => ({ id, address: API[id] })) } };
  };
}

test('住所が県外の行だけを外し、エリアで取った店の住所は API で引き直さない', async () => {
  const calls = [];
  const r = await gateSpreadsheetRows(ROWS, AREA_SHOPS, { fetchJson: fakeFetch(calls), apiKey: 'KEY', base: 'https://example.test/hotpepper' });
  assert.deepStrictEqual(r.excluded.map((x) => x.id), ['J000240935', 'J003625289']);
  assert.strictEqual(r.excluded[0].住所, '千葉県館山市八幡６２３－２０');
  assert.deepStrictEqual(r.kept.map((x) => x['ホットペッパーID']), ['J000773251', 'J001144583']);
  // エリアで取った店（J000773251）は引かない
  assert.strictEqual(calls.length, 1);
  assert.ok(!calls[0].includes('J000773251'));
  assert.strictEqual(r.stats.fromArea, 1);
  assert.strictEqual(r.stats.lookedUp, 3);
  assert.strictEqual(r.stats.found, 3);
  assert.strictEqual(r.stats.unknown, 0);
});

test('API が失敗したら何も外さず、エラー文に API キーを残さない', async () => {
  const calls = [];
  const r = await gateSpreadsheetRows(ROWS, [], { fetchJson: fakeFetch(calls, { fail: true }), apiKey: 'SECRETKEY', base: 'https://example.test/hotpepper' });
  assert.strictEqual(r.excluded.length, 0);
  assert.strictEqual(r.kept.length, ROWS.length);
  assert.strictEqual(r.stats.failedBatches, 1);
  assert.ok(r.stats.errors.every((e) => !e.includes('SECRETKEY')));
  // API がエラーを返したときも同じ
  const apiError = await lookupAddressesByIds(['J000240935'], { fetchJson: async () => ({ results: { error: [{ code: 2000, message: 'key' }] } }), apiKey: 'K', base: 'b' });
  assert.strictEqual(apiError.failedBatches, 1);
  assert.strictEqual(apiError.addresses.size, 0);
});

test('API キーが無い（手元の実行）ときは引かず、何も外さない', async () => {
  const calls = [];
  const r = await gateSpreadsheetRows(ROWS, [], { fetchJson: fakeFetch(calls), apiKey: '', base: 'b' });
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(r.excluded.length, 0);
  assert.strictEqual(r.stats.unknown, ROWS.length);
});

test('ID は20件ずつ引き、失敗した回の分だけ分からないままにする', async () => {
  const ids = Array.from({ length: BATCH * 2 + 1 }, (_, i) => `J9${String(i).padStart(8, '0')}`);
  let n = 0;
  const r = await lookupAddressesByIds(ids.concat(ids[0]), {
    apiKey: 'K',
    base: 'b',
    fetchJson: async (url) => {
      n++;
      const chunk = new URL(`https://x/${url}`).searchParams.get('id').split(',');
      assert.ok(chunk.length <= BATCH);
      if (n === 2) throw new Error('HTTP 500');
      return { results: { shop: chunk.map((id) => ({ id, address: '大阪府大阪市' })) } };
    },
  });
  assert.strictEqual(r.batches, 3);
  assert.strictEqual(r.failedBatches, 1);
  assert.strictEqual(r.addresses.size, BATCH + 1);
  // 分からない行は残す（純関数）
  const s = splitByPrefecture(ids.map((id) => row(id, id)), r.addresses);
  assert.strictEqual(s.excluded.length, BATCH + 1);
  assert.strictEqual(s.unknown, BATCH);
});

test('住所を取れなかった回は、前の回に県外と確かめた店を前の住所で外し続ける', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-gate-'));
  const file = path.join(dir, 'gate.json');
  // 1回目: API で住所が取れ、2店を外して記録する
  const first = await gateSpreadsheetRows(ROWS, AREA_SHOPS, { fetchJson: fakeFetch([]), apiKey: 'KEY', base: 'https://example.test/hotpepper', today: '2026-10-09' });
  writeRecord(file, first, '2026-10-09');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(saved.excluded.map((e) => [e.id, e.firstExcluded, e.lastConfirmed]), [
    ['J000240935', '2026-10-09', '2026-10-09'],
    ['J003625289', '2026-10-09', '2026-10-09'],
  ]);
  assert.strictEqual(saved.lastRun, '2026-10-09');
  // 2回目: API が失敗しても、記録の2店は外したまま（その日だけ店が戻らない）
  const { remembered, error } = loadRecord(file);
  assert.strictEqual(error, null);
  const second = await gateSpreadsheetRows(ROWS, AREA_SHOPS, { fetchJson: fakeFetch([], { fail: true }), apiKey: 'KEY', base: 'b', remembered, today: '2026-10-10' });
  assert.deepStrictEqual(second.excluded.map((x) => [x.id, x.fromMemory]), [['J000240935', true], ['J003625289', true]]);
  assert.strictEqual(second.stats.fromMemory, 2);
  // 前の回の記録で外した店は「最後に確かめた日」を進めない
  assert.deepStrictEqual(second.record.map((e) => [e.firstExcluded, e.lastConfirmed]), [['2026-10-09', '2026-10-09'], ['2026-10-09', '2026-10-09']]);
  // 記録に無い店（J001144583）は住所が分からないので残す
  assert.ok(second.kept.some((r) => r['ホットペッパーID'] === 'J001144583'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('記録の店も、住所が愛知県と取れた回・スプレッドシートから消えた回には外れる', async () => {
  const remembered = new Map([
    ['J001144583', { id: 'J001144583', 店名: '貝しぐれ', 住所: '北海道札幌市', firstExcluded: '2026-10-01', lastConfirmed: '2026-10-01' }],
    ['J000000001', { id: 'J000000001', 店名: '消えた行', 住所: '大阪府大阪市', firstExcluded: '2026-10-01', lastConfirmed: '2026-10-01' }],
  ]);
  const r = await gateSpreadsheetRows(ROWS, AREA_SHOPS, { fetchJson: fakeFetch([]), apiKey: 'KEY', base: 'https://example.test/hotpepper', remembered, today: '2026-10-10' });
  assert.ok(r.kept.some((x) => x['ホットペッパーID'] === 'J001144583'));
  assert.strictEqual(r.stats.released, 1);
  assert.ok(!r.record.some((e) => e.id === 'J001144583' || e.id === 'J000000001'));
  // 引き続き県外の店は、初めて外した日を引き継がない（記録に無かった）＝その日になる
  assert.ok(r.record.every((e) => e.firstExcluded === '2026-10-10'));
});

test('記録のファイルが無いときは空、壊れているときは空にして理由を返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-gate-'));
  assert.strictEqual(loadRecord(path.join(dir, 'none.json')).remembered.size, 0);
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{');
  const r = loadRecord(bad);
  assert.strictEqual(r.remembered.size, 0);
  assert.ok(r.error);
  fs.rmSync(dir, { recursive: true, force: true });
});
