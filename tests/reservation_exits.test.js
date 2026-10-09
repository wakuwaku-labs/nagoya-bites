'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lib = require('../scripts/lib/reservation_exits');
const { channelOf, aggregateStoreReferrals, isReservationDomain, dedupeReservationClicks } = lib;

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

// ISSUE-152: 予約ボタンは cta_click と outbound_click の両方に同じ1回が届く
const DEDUPE_FIXTURES = [
  // トップのホットペッパーのボタン3回（両方に届く）＋ 同じページのマップ（情報ドメインは数えない）
  [
    { event: 'cta_click', path: '/', domain: 'www.hotpepper.jp', count: '3' },
    { event: 'outbound_click', path: '/', domain: 'www.hotpepper.jp', count: '3' },
    { event: 'outbound_click', path: '/', domain: 'maps.google.com', count: '9' },
  ],
  // 特集の食べログの店名リンク（cta_click の無いリンク）は outbound_click だけで数える
  [
    { event: 'cta_click', path: '/features/a.html', domain: 'www.hotpepper.jp', count: '2' },
    { event: 'outbound_click', path: '/features/a.html', domain: 'www.hotpepper.jp', count: '2' },
    { event: 'outbound_click', path: '/features/a.html', domain: 'tabelog.com', count: '4' },
  ],
  // link_domain の無い旧送信（ジャーナルの cta_reserve）はホットペッパーとして組にする
  [
    { event: 'cta_reserve', path: '/journal/b.html', domain: '(not set)', count: '2' },
    { event: 'outbound_click', path: '/journal/b.html', domain: 'www.hotpepper.jp', count: '2' },
  ],
  // ページが違えば組にしない・0件と壊れた件数は飛ばす・予約サイト以外への cta_click はそのまま1回
  [
    { event: 'cta_click', path: '/x.html', domain: 'tabelog.com', count: '1' },
    { event: 'outbound_click', path: '/y.html', domain: 'tabelog.com', count: '1' },
    { event: 'outbound_click', path: '/y.html', domain: 'www.hotpepper.jp', count: '0' },
    { event: 'cta_click', path: '/y.html', domain: 'www.hotpepper.jp', count: 'abc' },
    { event: 'cta_click', path: '/z.html', domain: 'www.instagram.com', count: '1' },
    { event: 'cta_call_click', path: '/z.html', domain: 'tel', count: '5' },
    { event: 'page_view', path: '/z.html', domain: '(not set)', count: '50' },
  ],
];

test('dedupeReservationClicks: 予約ボタンの1回を1回として数え、足し算との差を重なりとして返す', () => {
  const top = dedupeReservationClicks(DEDUPE_FIXTURES[0]);
  assert.deepEqual(
    { cta: top.ctaEvents, out: top.reservationOutbound, naive: top.naiveSum, deduped: top.deduped, overlap: top.overlap },
    { cta: 3, out: 3, naive: 6, deduped: 3, overlap: 3 });

  const feature = dedupeReservationClicks(DEDUPE_FIXTURES[1]);
  assert.equal(feature.deduped, 6);
  assert.equal(feature.overlap, 2);
  assert.deepEqual(feature.bySite, [
    { site: 'tabelog.com', cta: 0, outbound: 4, deduped: 4 },
    { site: 'hotpepper.jp', cta: 2, outbound: 2, deduped: 2 },
  ]);

  const legacy = dedupeReservationClicks(DEDUPE_FIXTURES[2]);
  assert.equal(legacy.deduped, 2);
  assert.equal(legacy.overlap, 2);

  const mixed = dedupeReservationClicks(DEDUPE_FIXTURES[3]);
  assert.equal(mixed.ctaEvents, 2);
  assert.equal(mixed.reservationOutbound, 1);
  assert.equal(mixed.deduped, 3);
  assert.equal(mixed.overlap, 0);
  assert.deepEqual(mixed.bySite.map((b) => b.site), ['tabelog.com', 'www.instagram.com']);

  assert.deepEqual(dedupeReservationClicks([]), { ctaEvents: 0, reservationOutbound: 0, naiveSum: 0, deduped: 0, overlap: 0, bySite: [] });
  assert.equal(dedupeReservationClicks(undefined).deduped, 0);
});

test('GAS の複製（予約ボタンの数え方）が lib と同じ文面・同じ予約サイト・同じ結果になる', () => {
  const marker = (t) => t.slice(t.indexOf('// ── 予約ボタンの回数（ISSUE-152）──'), t.indexOf('// ── ここまで（.gas-deploy/Code.js に複製）──'));
  const gas = fs.readFileSync(path.join(__dirname, '..', '.gas-deploy', 'Code.js'), 'utf8');
  const libSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lib', 'reservation_exits.js'), 'utf8');
  assert.ok(marker(gas).length > 100, 'GAS に複製が無い');
  assert.equal(marker(gas), marker(libSrc));
  const start = gas.indexOf('const RESERVATION_DOMAINS = [');
  const end = gas.indexOf('// ── ここまで（.gas-deploy/Code.js に複製）──');
  assert.ok(start !== -1 && end > start);
  const ctx = {};
  vm.runInNewContext(gas.slice(start, end) + '\nthis.domains = RESERVATION_DOMAINS; this.dedupe = dedupeReservationClicks;', ctx);
  assert.deepEqual(Array.from(ctx.domains), lib.RESERVATION_DOMAINS);
  for (const rows of DEDUPE_FIXTURES) {
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.dedupe(rows))), dedupeReservationClicks(rows));
  }
  // GAS の予約ボタンの回数は足し算をやめている（旧: sumEvt(RESERVE_EVENTS) + reserveOutboundCount）
  assert.ok(!/reserveOutboundCount|RESERVE_DOMAINS/.test(gas));
  assert.match(gas, /const ctaCount\s*=\s*reserveClicks\.deduped;/);
});
