'use strict';
// ISSUE-163・164・174・176: 日次のリンク照合の順番、取得できなかった回の扱い、照合の状況と閉店の兆しの数え方、人が確かめた組の分け方
const test = require('node:test');
const assert = require('node:assert');
const { planChecks, mergeCheckResult, summarizeHealth, judgeHealth, summarizeClosures, summarizeMismatches, isFetchFailure } = require('../scripts/audit_store_link_identity');
const { checkHotpepperId } = require('../scripts/lib/store_link_identity');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-20T00:00:00Z');
const ago = (days) => new Date(NOW - days * DAY).toISOString();
const OK_FACTS = { ok: true, reason: null, sim: 1, matchedName: '鳥開総本家 名駅西口店', matchedAddressRaw: '椿町1-1' };

test('取得できなかった照合は、前に記録した判定を上書きしない（ISSUE-163）', () => {
  const prev = { ...OK_FACTS, kind: 'tabelog', area: '名駅', checkedAt: ago(61) };
  const failed = { ok: false, reason: 'fetch-error', error: 'HTTP 403' };
  const merged = mergeCheckResult(prev, failed, { kind: 'tabelog', area: '名駅' }, ago(0));
  assert.strictEqual(merged.ok, true);
  assert.strictEqual(merged.matchedAddressRaw, '椿町1-1');
  assert.strictEqual(merged.checkedAt, prev.checkedAt);
  assert.strictEqual(merged.lastAttemptAt, ago(0));
  assert.strictEqual(merged.lastAttemptError, 'HTTP 403');
  // 不一致の判定も残す（別の店・閉店・支店違い）
  const wrong = { ok: false, reason: 'name-mismatch', sim: 0, matchedName: 'くらや', checkedAt: ago(61) };
  assert.strictEqual(mergeCheckResult(wrong, failed, {}, ago(0)).reason, 'name-mismatch');
  // 判定が出た照合は置き換え、試した記録は消す
  const again = mergeCheckResult(merged, { ok: false, reason: 'branch-address-mismatch', sim: 1 }, { kind: 'tabelog', area: '名駅' }, ago(0));
  assert.strictEqual(again.reason, 'branch-address-mismatch');
  assert.strictEqual(again.checkedAt, ago(0));
  assert.strictEqual(again.lastAttemptAt, undefined);
  // ページが無い（HTTP 404）は判定なので、前の一致を置き換える（消えたページへのリンクを一致のまま残さない）
  const gone = mergeCheckResult(prev, { ok: false, reason: 'fetch-error', error: 'HTTP 404' }, { kind: 'tabelog', area: '名駅' }, ago(0));
  assert.strictEqual(gone.ok, false);
  assert.strictEqual(gone.error, 'HTTP 404');
  assert.strictEqual(gone.checkedAt, ago(0));
  assert.strictEqual(isFetchFailure(gone), false);
  assert.strictEqual(isFetchFailure({ ok: false, reason: 'no-title' }), true);
  // 前の判定が無ければ、取得できなかったことを記録する
  assert.strictEqual(mergeCheckResult(undefined, failed, { kind: 'tabelog' }, ago(0)).reason, 'fetch-error');
});

test('照合の順番: 一度も照合していない組が先、判定が新しい組と試し直しを待つ組は飛ばす（ISSUE-163）', () => {
  const cache = {
    fresh: { ...OK_FACTS, checkedAt: ago(10) },
    freshWrong: { ok: false, reason: 'name-mismatch', sim: 0, checkedAt: ago(10) },
    stale: { ...OK_FACTS, checkedAt: ago(70) },
    staleOlder: { ...OK_FACTS, checkedAt: ago(90) },
    staleRetried: { ...OK_FACTS, checkedAt: ago(70), lastAttemptAt: ago(3) },
    staleRetriedLongAgo: { ...OK_FACTS, checkedAt: ago(80), lastAttemptAt: ago(8) },
    failedRecently: { ok: false, reason: 'fetch-error', checkedAt: ago(2) },
    failedLongAgo: { ok: false, reason: 'fetch-error', checkedAt: ago(9) },
  };
  const keys = ['fresh', 'failedRecently', 'stale', 'never1', 'freshWrong', 'staleRetried', 'failedLongAgo', 'staleOlder', 'never2', 'staleRetriedLongAgo'];
  const plan = planChecks(keys.map((key) => ({ key })), cache, NOW).map((t) => t.key);
  assert.deepStrictEqual(plan, ['never1', 'never2', 'staleOlder', 'stale', 'failedLongAgo', 'staleRetriedLongAgo']);
  // --force はすべて照合する（順番の決め方は同じ）
  assert.strictEqual(planChecks(keys.map((key) => ({ key })), cache, NOW, { force: true }).length, keys.length);
});

test('照合の順番: 食べログを先に照合し、ホットペッパーはその後（ISSUE-163）', () => {
  const cache = { tbStale: { ...OK_FACTS, checkedAt: ago(70) } };
  const targets = [{ key: 'hpNever', kind: 'hotpepper' }, { key: 'tbStale', kind: 'tabelog' }, { key: 'tbNever', kind: 'tabelog' }];
  assert.deepStrictEqual(planChecks(targets, cache, NOW).map((t) => t.key), ['tbNever', 'tbStale', 'hpNever']);
});

test('照合の状況: 一度も照合していない・取得できたことが無い・最後に取得できた日を数える（ISSUE-164）', () => {
  const cache = {
    a: { ...OK_FACTS, checkedAt: ago(30), lastAttemptAt: ago(1), lastAttemptReason: 'fetch-error' },
    b: { ok: false, reason: 'name-mismatch', sim: 0, checkedAt: ago(20) },
    c: { ok: false, reason: 'fetch-error', checkedAt: ago(1) },
    h: { ok: true, checkedAt: ago(5) },
  };
  const targets = [
    { kind: 'tabelog', key: 'a' }, { kind: 'tabelog', key: 'b' }, { kind: 'tabelog', key: 'c' }, { kind: 'tabelog', key: 'x' },
    { kind: 'hotpepper', key: 'h' },
  ];
  const h = summarizeHealth(targets, cache);
  assert.deepStrictEqual(h.tabelog, { links: 4, neverChecked: 1, unfetched: 1, lastFetchedAt: ago(20) });
  assert.deepStrictEqual(h.hotpepper, { links: 1, neverChecked: 0, unfetched: 0, lastFetchedAt: ago(5) });
});

test('照合の状況の判定: 食べログを30日より長く取得できていなければ赤、ホットペッパーは見ない（ISSUE-164）', () => {
  const tb = (days) => ({ links: 10, neverChecked: 0, unfetched: 0, lastFetchedAt: days === null ? null : ago(days) });
  assert.strictEqual(judgeHealth({ tabelog: tb(30) }, NOW).ok, true);
  const red = judgeHealth({ tabelog: tb(31), hotpepper: tb(0) }, NOW);
  assert.strictEqual(red.ok, false);
  assert.deepStrictEqual(red.stale, ['tabelog']);
  assert.strictEqual(red.kinds.tabelog.daysSinceFetched, 31);
  // 一度も取得できていなければ赤。リンクが無ければ見ない
  assert.strictEqual(judgeHealth({ tabelog: tb(null) }, NOW).ok, false);
  assert.strictEqual(judgeHealth({ tabelog: { links: 0, neverChecked: 0, unfetched: 0, lastFetchedAt: null } }, NOW).ok, true);
  // ホットペッパーが取得できていなくても赤にしない
  assert.strictEqual(judgeHealth({ tabelog: tb(1), hotpepper: tb(null) }, NOW).ok, true);
});

test('閉店の兆し: ホットペッパーの【閉店】と掲載終了（HTTP 404）を分けて数え、ほかは数えない（ISSUE-174）', async () => {
  // 掲載をやめた店のページは HTTP 404「掲載情報なし」。取得の失敗ではなく判定として前の一致を置き換える
  const gone = await checkHotpepperId('J001144583', '牡蠣 貝料理居酒屋 貝しぐれ 栄泉店', { fetchHtml: async () => { throw new Error('HTTP 404'); } });
  assert.strictEqual(gone.ok, false);
  assert.strictEqual(gone.error, 'HTTP 404');
  assert.strictEqual(gone.url, 'https://www.hotpepper.jp/strJ001144583/');
  const prevOk = { ok: true, reason: null, sim: 1, matchedName: '牡蠣 貝料理居酒屋 貝しぐれ 栄泉店', kind: 'hotpepper', checkedAt: ago(70) };
  const goneEntry = mergeCheckResult(prevOk, gone, { kind: 'hotpepper', area: '栄' }, ago(0));
  assert.strictEqual(isFetchFailure(goneEntry), false);
  assert.strictEqual(goneEntry.checkedAt, ago(0));
  // 店名の上に【閉店】
  const closedHtml = '<html><head><title>STEPS(栄/居酒屋)＜ネット予約可＞ | ホットペッパーグルメ</title></head><body><p class="shopState">【閉店】</p><h1 class="shopName">STEPS</h1></body></html>';
  const closed = await checkHotpepperId('J003352001', 'STEPS', { fetchHtml: async () => closedHtml });
  assert.strictEqual(closed.reason, 'closed');
  const cache = {
    hpGone: goneEntry,
    hpClosed: mergeCheckResult(undefined, closed, { kind: 'hotpepper', area: '栄' }, ago(0)),
    hpOk: { ok: true, kind: 'hotpepper', checkedAt: ago(1) },
    hpOtherStoreClosed: { ok: false, reason: 'name-mismatch', closed: true, sim: 0, kind: 'hotpepper', checkedAt: ago(1) },
    hp403: { ok: false, reason: 'fetch-error', error: 'HTTP 403', kind: 'hotpepper', checkedAt: ago(1) },
    tbClosed: { ok: false, reason: 'closed', kind: 'tabelog', checkedAt: ago(1) },
    tbGone: { ok: false, reason: 'fetch-error', error: 'HTTP 404', kind: 'tabelog', checkedAt: ago(1) },
  };
  const hp = (key, storeName) => ({ kind: 'hotpepper', key, storeName, area: '栄', url: `https://www.hotpepper.jp/${key}/` });
  const targets = [
    hp('hpGone', '牡蠣 貝料理居酒屋 貝しぐれ 栄泉店'), hp('hpClosed', 'STEPS'), hp('hpOk', 'A'), hp('hpOtherStoreClosed', 'B'), hp('hp403', 'C'), hp('never', 'D'),
    { kind: 'tabelog', key: 'tbClosed', storeName: 'E', area: '栄', url: 'https://tabelog.com/aichi/A2301/A230102/1/' },
    { kind: 'tabelog', key: 'tbGone', storeName: 'F', area: '栄', url: 'https://tabelog.com/aichi/A2301/A230102/2/' },
  ];
  const c = summarizeClosures(targets, cache);
  assert.deepStrictEqual(c.hotpepper.closed.map((r) => r.店名), ['STEPS']);
  assert.strictEqual(c.hotpepper.closed[0].表示, '【閉店】');
  assert.strictEqual(c.hotpepper.closed[0].検証日, ago(0));
  assert.deepStrictEqual(c.hotpepper.notFound.map((r) => r.店名), ['牡蠣 貝料理居酒屋 貝しぐれ 栄泉店']);
  assert.strictEqual(c.hotpepper.notFound[0].エラー, 'HTTP 404');
  // 何も無ければ空
  assert.deepStrictEqual(summarizeClosures([hp('hpOk', 'A')], cache), { hotpepper: { closed: [], notFound: [], reviewed: [] } });
  // 人が確かめて「決められない」とした店は、30日の間は closed に数えず reviewed に分ける（ISSUE-186）
  const withId = { ...hp('hpClosed', 'STEPS'), id: 'J1' };
  const now = new Date('2026-10-10T00:00:00Z').getTime();
  const rv = (verdict, checkedAt) => [{ id: 'J1', verdict, checkedAt, issue: 'ISSUE-186' }];
  let r = summarizeClosures([withId], cache, rv('決められない', '2026-10-10'), now);
  assert.deepStrictEqual([r.hotpepper.closed.length, r.hotpepper.reviewed.length], [0, 1]);
  assert.strictEqual(r.hotpepper.reviewed[0].判定, '決められない');
  // 30日を過ぎれば closed に戻る
  r = summarizeClosures([withId], cache, rv('決められない', '2026-09-01'), now);
  assert.deepStrictEqual([r.hotpepper.closed.length, r.hotpepper.reviewed.length], [1, 0]);
  // 閉店と判定した記録は保留にしない（closed_stores.json へ入れる手順に進む）
  r = summarizeClosures([withId], cache, rv('閉店', '2026-10-10'), now);
  assert.strictEqual(r.hotpepper.closed.length, 1);
  // 別の店の記録は当たらない
  r = summarizeClosures([{ ...withId, id: 'J2' }], cache, rv('決められない', '2026-10-10'), now);
  assert.strictEqual(r.hotpepper.closed.length, 1);
});

test('人が同じ店と確かめた組は不一致に数えず分けて出す。閉店・別の URL・別の店は数える（ISSUE-176）', () => {
  const URL_A = 'https://tabelog.com/aichi/A2301/A230108/23078054/';
  const URL_B = 'https://tabelog.com/aichi/A2301/A230102/23071690/';
  const cache = {
    keptName: { ok: false, reason: 'name-mismatch', sim: 0.29, matchedName: '個室 肉寿司と牛タンしゃぶしゃぶ 金肉 名古屋駅前店', kind: 'tabelog', checkedAt: ago(5) },
    keptBranch: { ok: false, reason: 'branch-address-mismatch', sim: 1, kind: 'tabelog', checkedAt: ago(5) },
    keptButClosed: { ok: false, reason: 'closed', sim: 1, kind: 'tabelog', checkedAt: ago(5) },
    keptUnfetched: { ok: false, reason: 'fetch-error', error: 'HTTP 403', kind: 'tabelog', checkedAt: ago(5) },
    otherStore: { ok: false, reason: 'name-mismatch', sim: 0.53, matchedName: 'SALON 雪月花', kind: 'tabelog', checkedAt: ago(5) },
    hpMismatch: { ok: false, reason: 'name-mismatch', sim: 0.2, kind: 'hotpepper', checkedAt: ago(5) },
    ok: { ok: true, reason: null, sim: 1, kind: 'tabelog', checkedAt: ago(5) },
  };
  const tb = (key, storeId, url) => ({ kind: 'tabelog', key, storeId, url, storeName: key, area: '名駅' });
  const targets = [
    tb('keptName', 'J001177131', URL_A),
    tb('keptBranch', 'J000400091', URL_A),
    tb('keptButClosed', 'J003916879', URL_A),
    tb('keptUnfetched', 'J003958538', URL_A),
    // 同じ URL でも確かめていない店（店ID が違う）は数える
    tb('otherStore', 'J000804458', URL_A),
    { kind: 'hotpepper', key: 'hpMismatch', storeName: 'hpMismatch', area: '名駅', url: 'https://www.hotpepper.jp/strJ001177131/' },
    tb('ok', 'J000000001', URL_A),
  ];
  const kept = new Set(['J001177131', 'J000400091', 'J003916879', 'J003958538'].map((id) => `${id}|${URL_A}`));
  // ホットペッパーの組は店ID が同じでも確かめた組に入らない（記録は食べログの組だけ）
  kept.add(`J001177131|https://www.hotpepper.jp/strJ001177131/`);
  const r = summarizeMismatches(targets, cache, kept);
  assert.deepStrictEqual(r.reviewedKeep.map((x) => x.店名), ['keptName', 'keptBranch']);
  assert.deepStrictEqual(r.mismatches.map((x) => x.店名), ['keptButClosed', 'otherStore', 'hpMismatch']);
  assert.deepStrictEqual(r.unfetched.map((x) => x.店名), ['keptUnfetched']);
  assert.strictEqual(r.reviewedKeep[0].検出タイトル, '個室 肉寿司と牛タンしゃぶしゃぶ 金肉 名古屋駅前店');
  // URL が変われば確かめた組から外れて、再び数える
  const moved = summarizeMismatches([tb('keptName', 'J001177131', URL_B)], cache, kept);
  assert.deepStrictEqual(moved.mismatches.map((x) => x.店名), ['keptName']);
  assert.strictEqual(moved.reviewedKeep.length, 0);
  // 記録が無ければ今までどおり全部数える
  const none = summarizeMismatches(targets, cache, new Set());
  assert.strictEqual(none.reviewedKeep.length, 0);
  assert.strictEqual(none.mismatches.length, 5);
});
