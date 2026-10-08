'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { channelOf, aggregateStoreReferrals, isReservationDomain } = require('../scripts/lib/reservation_exits');

test('channelOf: link_domain から経路を決める', () => {
  assert.equal(channelOf('cta_click', 'www.hotpepper.jp'), 'hotpepper');
  assert.equal(channelOf('cta_click', 'tabelog.com'), 'tabelog');
  assert.equal(channelOf('cta_call_click', '(not set)'), 'tel');
  assert.equal(channelOf('cta_click', 'tel'), 'tel');
  assert.equal(channelOf('cta_click', 'www.google.com'), 'other');
});

test('channelOf: link_domain の無い旧送信はホットペッパーに寄せる', () => {
  assert.equal(channelOf('cta_click', '(not set)'), 'hotpepper');
  assert.equal(channelOf('cta_reserve', ''), 'hotpepper');
});

test('aggregateStoreReferrals: 店舗別・経路別に数え、申告は別枠にする', () => {
  const out = aggregateStoreReferrals([
    { event: 'cta_click', store: 'A店', domain: 'www.hotpepper.jp', count: '3' },
    { event: 'cta_click', store: 'A店', domain: 'tabelog.com', count: '2' },
    { event: 'cta_reserve', store: 'A店', domain: '(not set)', count: '1' },
    { event: 'cta_call_click', store: 'B店', domain: 'tel', count: '4' },
    { event: 'reserve_report_yes', store: 'A店', count: '1' },
    { event: 'reserve_report_no', store: 'B店', count: '2' },
    { event: 'cta_click', store: '(not set)', domain: '(not set)', count: '5' },
    { event: 'outbound_click', store: 'A店', domain: 'www.hotpepper.jp', count: '9' },
  ]);
  assert.deepEqual(out.totals.exits, { hotpepper: 9, tabelog: 2, tel: 4, other: 0, total: 15 });
  assert.deepEqual(out.totals.reports, { yes: 1, no: 2 });
  assert.equal(out.unattributedExits, 5);
  assert.deepEqual(out.stores.map(s => s.store_name), ['A店', 'B店']);
  assert.deepEqual(out.stores[0].exits, { hotpepper: 4, tabelog: 2, tel: 0, other: 0, total: 6 });
  assert.deepEqual(out.stores[0].reports, { yes: 1, no: 0 });
  assert.deepEqual(out.stores[1].reports, { yes: 0, no: 2 });
});

test('aggregateStoreReferrals: outbound_click は二重計上になるので数えない', () => {
  const out = aggregateStoreReferrals([{ event: 'outbound_click', store: 'A店', domain: 'tabelog.com', count: 3 }]);
  assert.equal(out.totals.exits.total, 0);
  assert.equal(out.stores.length, 0);
});

test('isReservationDomain: 予約サイトだけを真にする', () => {
  assert.equal(isReservationDomain('www.hotpepper.jp'), true);
  assert.equal(isReservationDomain('tabelog.com'), true);
  assert.equal(isReservationDomain('www.google.com'), false);
});

test('予約申告プロンプト: index.html が最新のスニペットを持ち、構文として生きている', () => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const { RESERVE_ASK_SCRIPT, applyToHtml } = require('../scripts/lib/reservation_ask_snippet');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes(RESERVE_ASK_SCRIPT), 'node scripts/lib/reservation_ask_snippet.js --apply index.html を実行する');
  assert.equal(applyToHtml(html), html, '冪等');
  const body = RESERVE_ASK_SCRIPT.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  assert.doesNotThrow(() => new vm.Script(body));
});

test('予約申告プロンプト: 戻ってきた人にだけ1回聞き、答えを GA4 に送る', () => {
  const vm = require('vm');
  const { RESERVE_ASK_SCRIPT } = require('../scripts/lib/reservation_ask_snippet');
  const body = RESERVE_ASK_SCRIPT.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  const store = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
  const listeners = {};
  const sent = [];
  const appended = [];
  const mkEl = () => ({ children: [], setAttribute() {}, appendChild(c) { this.children.push(c); c.parentNode = this; }, removeChild(c) { this.children = this.children.filter(x => x !== c); } });
  let now = 1000000;
  const ctx = {
    Date: class extends Date { static now() { return now; } },
    JSON, String, setTimeout: () => 0,
    localStorage: store(), sessionStorage: store(),
    trackEvent: (n, p) => sent.push([n, p]),
    document: {
      visibilityState: 'visible',
      addEventListener: (t, f) => { listeners[t] = f; },
      createElement: () => mkEl(),
      body: { appendChild: el => appended.push(el) },
    },
  };
  ctx.window = ctx;
  ctx.window.addEventListener = (t, f) => { listeners['w:' + t] = f; };
  vm.runInNewContext(body, ctx);
  ctx.nbReserveExit('cta_click', { store_name: 'A店', store_id: 'J1', link_domain: 'tabelog.com', location: 'modal' });
  assert.deepEqual(sent[0], ['cta_click', { store_name: 'A店', store_id: 'J1', link_domain: 'tabelog.com', location: 'modal' }]);
  now += 5000; listeners.visibilitychange();
  assert.equal(appended.length, 0, '20秒未満では聞かない');
  now += 60000; listeners.visibilitychange();
  assert.equal(appended.length, 1, '戻ってきたら1回聞く');
  const yes = appended[0].children[3].children[0];
  yes.onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(sent[1])), ['reserve_report_yes', { store_name: 'A店', store_id: 'J1', link_domain: 'tabelog.com', location: 'modal' }]);
  ctx.nbReserveExit('cta_click', { store_name: 'A店', store_id: 'J1' });
  now += 60000; listeners.visibilitychange();
  assert.equal(appended.length, 1, '同じ店は1日1回まで');
  ctx.localStorage.setItem('nb_internal', '1');
  ctx.nbReserveExit('cta_click', { store_name: 'B店', store_id: 'J2' });
  now += 60000; listeners.visibilitychange();
  assert.equal(appended.length, 1, 'オーナーの確認（内部）では聞かない');
});
