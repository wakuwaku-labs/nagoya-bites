'use strict';
// I-36b（P-273）: 電話するボタンの動き。
// - 押したあとの動き（番号の取得・結果ごとの文・計測）は scripts/lib/call_button_snippet.js の1本。
//   index.html と店舗ページが同じものを持つ（ここでは、その1本を実際に動かして確かめる）
// - 番号を取れなかった理由（8つの result）を、別々の文と call_lookup の result に分ける。発信するのは ok のときだけ
// - ボタンを出すのは「電話確認」のある店だけ（トップのクイックビュー・スマホの追従バー・店舗ページ）
// - 押した回数の計測 cta_call_click は今までどおり1回。call_lookup は予約送客に数えない
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const { CALL_SCRIPT, applyToHtml, BLOCK_RE } = require(path.join(ROOT, 'scripts', 'lib', 'call_button_snippet.js'));
const { EXIT_EVENTS } = require(path.join(ROOT, 'scripts', 'lib', 'reservation_exits.js'));
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SNIPPET_JS = CALL_SCRIPT.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');

// ---------------------------------------------------------------- 実行環境（最小のDOMとGoogle Maps の模擬）

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.text = '';
    this.disabled = false;
    this.className = '';
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  get textContent() { return this.text; }
  set textContent(v) { this.text = String(v); }
  querySelector(sel) {
    const match = sel[0] === '.'
      ? (e) => e.className.split(/\s+/).includes(sel.slice(1))
      : (e) => e.tagName === sel.toUpperCase();
    for (const c of this.children) {
      if (match(c)) return c;
      const hit = c.querySelector(sel);
      if (hit) return hit;
    }
    return null;
  }
}

const STATUS = {
  OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS', NOT_FOUND: 'NOT_FOUND', INVALID_REQUEST: 'INVALID_REQUEST',
  OVER_QUERY_LIMIT: 'OVER_QUERY_LIMIT', REQUEST_DENIED: 'REQUEST_DENIED', UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// vm の中で作られたオブジェクトは Object.prototype が別物（deepStrictEqual が通らない）なので、受け取った時点で複製する
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

/**
 * @param {object} opts
 *   respond(req) → {place, status} … getDetails への Google の応答
 *   never: true … 応答が返らない
 *   mapsLoad: 'fail' … Google Maps の読み込みに失敗する
 *   taps: その日にすでに確かめた回数
 *   noReserveExit: nbReserveExit が無いページ
 */
function makeEnv(opts = {}) {
  const log = { events: [], requests: [], scriptSrcs: [] };
  const timers = [];
  let timerId = 1;
  const storage = new Map();
  if (opts.taps != null) storage.set(`nb_call_taps_${new Date().toISOString().slice(0, 10)}`, String(opts.taps));
  const sandbox = {
    NB_CALL_MAPS_KEY: 'TEST_KEY',
    location: { href: 'https://nagoya-bites.com/' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
    },
    trackEvent: (name, params) => { log.events.push({ name, params: plain(params) }); },
    setTimeout: (fn, ms) => { const id = timerId++; timers.push({ id, fn, ms, cleared: false }); return id; },
    clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.cleared = true; },
  };
  if (!opts.noReserveExit) {
    sandbox.nbReserveExit = (name, params) => { log.events.push({ name, params: plain(params), viaExit: true }); };
  }
  sandbox.window = sandbox;
  const head = new El('head');
  head.appendChild = function (c) {
    El.prototype.appendChild.call(this, c);
    if (c.tagName === 'SCRIPT') {
      log.scriptSrcs.push(c.src);
      setImmediate(() => {
        if (opts.mapsLoad === 'fail') { if (c.onerror) c.onerror(); return; }
        sandbox.google = {
          maps: {
            places: {
              PlacesServiceStatus: STATUS,
              PlacesService: class {
                getDetails(req, cb) {
                  log.requests.push(plain(req));
                  if (opts.never) { log.pendingCb = cb; return; }   // 返事が来ないまま。あとから届かせる試験用に取っておく
                  const r = opts.respond(req);
                  cb(r.place, r.status);
                }
              },
            },
          },
        };
        sandbox.window.__nbMapsReady();
      });
    }
    return c;
  };
  sandbox.document = { createElement: (t) => new El(t), head };
  vm.createContext(sandbox);
  vm.runInContext(SNIPPET_JS, sandbox);
  return {
    sandbox,
    log,
    fireTimers: () => { for (const t of timers.splice(0)) if (!t.cleared) t.fn(); },
    pendingTimers: () => timers.filter((t) => !t.cleared).length,
    storage,
    lookups: () => log.events.filter((e) => e.name === 'call_lookup').map((e) => e.params),
    clicks: () => log.events.filter((e) => e.name === 'cta_call_click'),
  };
}

function makeRow({ iconOnly = false, loc = 'modal', withStatus = true } = {}) {
  const host = new El('div');
  const btn = new El('button');
  btn.setAttribute('data-call-loc', loc);
  if (!iconOnly) { const span = new El('span'); span.textContent = '電話する'; btn.appendChild(span); }
  host.appendChild(btn);
  let status = null;
  if (withStatus) {
    status = new El('p');
    status.className = 'nb-call-status';
    status.setAttribute('role', 'status');
    host.appendChild(status);
  }
  return { host, btn, status, label: () => (btn.querySelector('span') ? btn.querySelector('span').textContent : null) };
}

async function press(env, row, placeId = 'PLACE1', name = 'テスト酒場') {
  env.sandbox.nbCallStore({ stopPropagation() {} }, placeId, name, row.btn);
  await flush();
}

const MAP = 'Googleマップで確かめられます。';
const MSG = {
  no_number: `この店の電話番号は Google に登録がありません。${MAP}`,
  closed: `Google の店舗情報では閉業となっています。${MAP}`,
  device_limit: `本日はこれ以上確かめられません。${MAP}`,
  unavailable: `いまは電話番号を確かめられません。${MAP}`,
};

// ---------------------------------------------------------------- 押したあとの結果

const CASES = [
  { name: 'ok: 番号を取れた', respond: () => ({ status: STATUS.OK, place: { international_phone_number: '+81 52-123-4567', business_status: 'OPERATIONAL' } }), result: 'ok', text: '', tel: 'tel:+81521234567' },
  { name: 'ok: 営業の状態が返らなくても番号があれば発信する', respond: () => ({ status: STATUS.OK, place: { international_phone_number: '+81 52-123-4567' } }), result: 'ok', text: '', tel: 'tel:+81521234567' },
  { name: 'ok: 臨時休業の表示でも発信を止めない（止めるのは閉業だけ）', respond: () => ({ status: STATUS.OK, place: { international_phone_number: '+81 52-123-4567', business_status: 'CLOSED_TEMPORARILY' } }), result: 'ok', text: '', tel: 'tel:+81521234567' },
  { name: 'no_number: Google に番号が無い', respond: () => ({ status: STATUS.OK, place: { business_status: 'OPERATIONAL' } }), result: 'no_number', text: MSG.no_number },
  { name: 'no_number: 番号が数字を含まない文字列', respond: () => ({ status: STATUS.OK, place: { international_phone_number: '-' } }), result: 'no_number', text: MSG.no_number },
  { name: 'closed: 閉業なら番号があっても発信しない', respond: () => ({ status: STATUS.OK, place: { international_phone_number: '+81 52-123-4567', business_status: 'CLOSED_PERMANENTLY' } }), result: 'closed', text: MSG.closed },
  { name: 'closed: 閉業で番号も無い', respond: () => ({ status: STATUS.OK, place: { business_status: 'CLOSED_PERMANENTLY' } }), result: 'closed', text: MSG.closed },
  { name: 'quota: サイト全体の1日の上限', respond: () => ({ status: STATUS.OVER_QUERY_LIMIT, place: null }), result: 'quota', text: MSG.unavailable },
  { name: 'denied: Google が断った', respond: () => ({ status: STATUS.REQUEST_DENIED, place: null }), result: 'denied', text: MSG.unavailable },
  { name: 'not_found: 店の情報が無い（NOT_FOUND）', respond: () => ({ status: STATUS.NOT_FOUND, place: null }), result: 'not_found', text: MSG.unavailable },
  { name: 'not_found: 店の情報が無い（ZERO_RESULTS）', respond: () => ({ status: STATUS.ZERO_RESULTS, place: null }), result: 'not_found', text: MSG.unavailable },
  { name: 'error: 原因の分からない失敗（UNKNOWN_ERROR）', respond: () => ({ status: STATUS.UNKNOWN_ERROR, place: null }), result: 'error', text: MSG.unavailable },
  { name: 'error: リクエストの不備（INVALID_REQUEST）', respond: () => ({ status: STATUS.INVALID_REQUEST, place: null }), result: 'error', text: MSG.unavailable },
];

for (const c of CASES) {
  for (const iconOnly of [false, true]) {
    test(`${c.name}（${iconOnly ? 'アイコンだけのボタン' : '文字つきのボタン'}）`, async () => {
      const env = makeEnv({ respond: c.respond });
      const row = makeRow({ iconOnly, loc: 'store_page' });
      await press(env, row);
      // 結果が別々の result になる。cta_call_click は1回
      assert.deepEqual(env.lookups(), [{ store_name: 'テスト酒場', store_id: 'PLACE1', location: 'store_page', result: c.result }]);
      assert.equal(env.clicks().length, 1);
      assert.deepEqual(env.clicks()[0].params, { store_name: 'テスト酒場', store_id: 'PLACE1', link_domain: 'tel', location: 'store_page' });
      // 発信するのは ok のときだけ
      assert.equal(env.sandbox.location.href, c.tel || 'https://nagoya-bites.com/');
      // 目で見える形で理由を出す（アイコンだけのボタンでも同じ行に出る）
      assert.equal(row.status.textContent, c.text);
      // ボタンは元に戻る
      assert.equal(row.btn.disabled, false);
      assert.equal(row.btn.getAttribute('aria-busy'), null);
      if (!iconOnly) assert.equal(row.label(), '電話する');
      // 取る項目は番号と営業の状態の2つ（同じ1回の問い合わせ）
      assert.equal(env.log.requests.length, 1);
      assert.deepEqual(env.log.requests[0], { placeId: 'PLACE1', fields: ['international_phone_number', 'business_status'] });
    });
  }
}

test('その端末の1日の上限: Google へ問い合わせず、理由と次の手を出す。押した回数は数える', async () => {
  const env = makeEnv({ taps: 20, respond: () => { throw new Error('問い合わせてはいけない'); } });
  const row = makeRow({ iconOnly: true });
  await press(env, row);
  assert.equal(env.log.scriptSrcs.length, 0, 'Google Maps も読み込まない');
  assert.equal(env.log.requests.length, 0);
  assert.deepEqual(env.lookups().map((l) => l.result), ['device_limit']);
  assert.equal(env.clicks().length, 1);
  assert.equal(row.status.textContent, MSG.device_limit);
  assert.equal(env.sandbox.location.href, 'https://nagoya-bites.com/');
  assert.equal(row.btn.disabled, false);
});

test('上限の手前（19回）ではまだ確かめられ、確かめるたびに回数が1つ進む', async () => {
  const env = makeEnv({ taps: 19, respond: CASES[0].respond });
  const row = makeRow();
  await press(env, row);
  assert.deepEqual(env.lookups().map((l) => l.result), ['ok']);
  const key = `nb_call_taps_${new Date().toISOString().slice(0, 10)}`;
  assert.equal(env.storage.get(key), '20');
});

test('Google Maps の読み込みに失敗したら error。ボタンは元に戻る', async () => {
  const env = makeEnv({ mapsLoad: 'fail', respond: CASES[0].respond });
  const row = makeRow();
  await press(env, row);
  assert.deepEqual(env.lookups().map((l) => l.result), ['error']);
  assert.equal(row.status.textContent, MSG.unavailable);
  assert.equal(row.btn.disabled, false);
  assert.equal(env.sandbox.location.href, 'https://nagoya-bites.com/');
});

test('確かめている間: ボタンは押せず「確認中…」、目で見える反応が行にも出る。押し直しは数えない', async () => {
  const env = makeEnv({ never: true, respond: () => ({}) });
  const row = makeRow();
  await press(env, row);
  assert.equal(row.btn.disabled, true);
  assert.equal(row.btn.getAttribute('aria-busy'), 'true');
  assert.equal(row.label(), '確認中…');
  assert.equal(row.status.textContent, '電話番号を確かめています…');
  assert.equal(env.lookups().length, 0, '結果はまだ出ていない');
  await press(env, row);
  assert.equal(env.clicks().length, 1, '確かめている間の押し直しは cta_call_click に数えない');
  assert.equal(env.log.requests.length, 1);
});

test('Google から返事が来ないまま 12 秒たったら error。あとから届いた返事では発信も二重の計測もしない', async () => {
  const env = makeEnv({ never: true, respond: () => ({}) });
  const row = makeRow();
  await press(env, row);
  assert.equal(env.pendingTimers(), 1);
  assert.equal(row.btn.disabled, true);
  env.fireTimers();
  assert.deepEqual(env.lookups().map((l) => l.result), ['error']);
  assert.equal(row.status.textContent, MSG.unavailable);
  assert.equal(row.btn.disabled, false);
  // 時間切れのあとで本物の返事が届いても、画面と計測と発信を動かさない
  env.log.pendingCb({ international_phone_number: '+81 52-123-4567' }, STATUS.OK);
  assert.deepEqual(env.lookups().map((l) => l.result), ['error']);
  assert.equal(row.status.textContent, MSG.unavailable);
  assert.equal(env.sandbox.location.href, 'https://nagoya-bites.com/');
  // 返事が来たあとは、時間切れの見張りを残さない
  const env2 = makeEnv({ respond: CASES[0].respond });
  const row2 = makeRow();
  await press(env2, row2);
  assert.equal(env2.pendingTimers(), 0);
});

test('番号を取れたら、同じページを開いている間は取り直さずに発信する（保存はしない）', async () => {
  const env = makeEnv({ respond: CASES[0].respond });
  const row = makeRow();
  await press(env, row);
  assert.equal(env.sandbox.location.href, 'tel:+81521234567');
  env.sandbox.location.href = 'https://nagoya-bites.com/';
  await press(env, row);
  assert.equal(env.log.requests.length, 1, '2回目は問い合わせない');
  assert.equal(env.sandbox.location.href, 'tel:+81521234567');
  assert.deepEqual(env.lookups().map((l) => l.result), ['ok', 'ok']);
  assert.equal(env.clicks().length, 2);
  const key = `nb_call_taps_${new Date().toISOString().slice(0, 10)}`;
  assert.equal(env.storage.get(key), '1', '1日の回数は問い合わせた回数だけ');
  assert.ok(![...env.storage.values()].some((v) => /\+?81521234567/.test(v)), '電話番号を localStorage に保存しない');
});

test('取れなかったあとに押し直すと、前の理由を消してからやり直す', async () => {
  let n = 0;
  const env = makeEnv({ respond: () => (++n === 1 ? { status: STATUS.OVER_QUERY_LIMIT, place: null } : CASES[0].respond()) });
  const row = makeRow();
  await press(env, row);
  assert.equal(row.status.textContent, MSG.unavailable);
  await press(env, row);
  assert.equal(row.status.textContent, '');
  assert.equal(env.sandbox.location.href, 'tel:+81521234567');
  assert.deepEqual(env.lookups().map((l) => l.result), ['quota', 'ok']);
});

test('結果の行が無いページでも、ボタンと同じ親の中に role="status" の行を作って出す', async () => {
  const env = makeEnv({ respond: CASES[3].respond });
  const row = makeRow({ withStatus: false });
  await press(env, row);
  const made = row.host.querySelector('.nb-call-status');
  assert.ok(made);
  assert.equal(made.getAttribute('role'), 'status');
  assert.equal(made.textContent, MSG.no_number);
});

test('nbReserveExit の無いページでは、cta_call_click を trackEvent で送る（これまでと同じ）', async () => {
  const env = makeEnv({ noReserveExit: true, respond: CASES[0].respond });
  const row = makeRow();
  await press(env, row);
  assert.equal(env.clicks().length, 1);
  assert.deepEqual(env.clicks()[0].params, { store_name: 'テスト酒場' });
});

test('押したことを、まわりのカードの押下（クイックビューを開く）に伝えない', async () => {
  const env = makeEnv({ respond: CASES[0].respond });
  const row = makeRow();
  let stopped = 0;
  env.sandbox.nbCallStore({ stopPropagation() { stopped++; } }, 'PLACE1', 'テスト酒場', row.btn);
  await flush();
  assert.equal(stopped, 1);
  // イベントが渡されなくても動く
  env.sandbox.nbCallStore(undefined, 'PLACE1', 'テスト酒場', makeRow().btn);
  await flush();
  assert.equal(env.clicks().length, 2);
});

test('placeId も押す先のボタンも無ければ何もしない', async () => {
  const env = makeEnv({ respond: CASES[0].respond });
  env.sandbox.nbCallStore({ stopPropagation() {} }, '', 'x', makeRow().btn);
  env.sandbox.nbCallStore({ stopPropagation() {} }, 'P', 'x', null);
  await flush();
  assert.equal(env.log.events.length, 0);
});

test('計測: call_lookup は予約送客に数えない（EXIT_EVENTS に入れない）。cta_call_click はこれまでどおり入っている', () => {
  assert.ok(!EXIT_EVENTS.includes('call_lookup'));
  assert.ok(EXIT_EVENTS.includes('cta_call_click'));
});

// ---------------------------------------------------------------- 実装は1本（index.html と店舗ページが同じものを持つ）

test('index.html: 共有の実装がそのまま入っていて、自前の電話の実装は残っていない', () => {
  assert.equal(applyToHtml(INDEX_HTML), INDEX_HTML, 'node scripts/lib/call_button_snippet.js --apply index.html を実行する');
  assert.equal(INDEX_HTML.split(CALL_SCRIPT).length - 1, 1);
  assert.ok(!/function nbCallStore\b|NB_PHONE_MEM|function nbLoadMapsJs|function nbCallTapAllowed|function nbCallBtnMsg/.test(INDEX_HTML), '古い実装を残さない');
  assert.match(INDEX_HTML, /var NB_CALL_MAPS_KEY = '/, '鍵はページ側で定義する');
  assert.ok(!SNIPPET_JS.includes('AIza'), '共有の実装に鍵を書かない');
});

test('applyToHtml: コメントなどにマーカーの文字が出ても、広い範囲を巻き込まない。冪等', () => {
  const html = '<body><script>\n// 末尾の <script class="nb-call-js"> に入る\nvar x = 1;\n</script>\n</body>';
  const once = applyToHtml(html);
  assert.ok(once.includes('var x = 1;'));
  assert.equal(once.split('class="nb-call-js"').length - 1, 2);
  assert.equal(applyToHtml(once), once);
  assert.ok(BLOCK_RE.multiline);
});

test('index.html: 追従バーで結果の行が下に回れる（flex-wrap）', () => {
  assert.match(INDEX_HTML, /\.m-sticky-cta\{position:sticky;[^}]*flex-wrap:wrap;/);
});

test('nb.css: 結果の行は 13px 以上のトークンで、空のときは場所を取らない', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'nb.css'), 'utf8');
  assert.match(css, /\.nb-call-status\{[^}]*font-size:var\(--fs-xs\)/);
  assert.match(css, /\.nb-call-status:empty\{position:absolute;/);
  assert.match(css, /\.nb-call-status:not\(:empty\)\{[^}]*grid-column:1\/-1/);
});

// ---------------------------------------------------------------- ボタンを出す店（電話確認）

function loadIndexCallHelpers() {
  const start = INDEX_HTML.indexOf('function nbCanCall(r)');
  const end = INDEX_HTML.indexOf('function openM(i, source) {');
  assert.ok(start > 0 && end > start);
  const sandbox = { NB_CALL_ICON_SVG: '<svg></svg>' };
  vm.createContext(sandbox);
  vm.runInContext(INDEX_HTML.slice(start, end), sandbox);
  return sandbox;
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

test('トップ: 電話確認のある店にだけボタンと結果の行を出す。placeId だけの店には出さない', () => {
  const h = loadIndexCallHelpers();
  const verified = { '店名': 'テスト酒場', placeId: 'PLACE1', '電話確認': '住所' };
  const placeOnly = { '店名': 'テスト酒場', placeId: 'PLACE1' };
  const noPlace = { '店名': 'テスト酒場', '電話確認': '店名' };
  assert.equal(h.nbCanCall(verified), true);
  assert.equal(h.nbCanCall(placeOnly), false);
  assert.equal(h.nbCanCall(noPlace), false);
  assert.equal(h.nbCallBtnHtml(placeOnly, esc, false), '');
  assert.equal(h.nbCallBtnHtml(noPlace, esc, true), '');
  assert.equal(h.nbCallStatusHtml(placeOnly), '');
  const btn = h.nbCallBtnHtml(verified, esc, false);
  assert.match(btn, /data-call-loc="modal"/);
  assert.match(btn, /nbCallStore\(event,'PLACE1','テスト酒場',this\)/);
  assert.match(btn, /<span>電話する<\/span>/);
  assert.match(btn, /aria-label="テスト酒場に電話する"/);
  const icon = h.nbCallBtnHtml(verified, esc, true);
  assert.ok(!/<span>/.test(icon), 'アイコンだけのボタンには文字を入れない');
  assert.match(icon, /aria-label="テスト酒場に電話する"/);
  assert.equal(h.nbCallStatusHtml(verified), '<p class="nb-call-status" role="status"></p>');
});

test('トップ: クイックビューの行動バーが、同じ判定（nbCanCall）で電話を並べ、結果の行を添える（I-22 で本文の行を廃し、バーだけにした）', () => {
  const open = INDEX_HTML.slice(INDEX_HTML.indexOf('function openM(i, source) {'));
  assert.match(open, /var callStatusHtml = nbCallStatusHtml\(r\);/);
  assert.ok(!/modal-cta-row|ctaRow/.test(open), '本文の中の行（modal-cta-row）は廃した。バーは1つ');
  assert.match(open, /: nbCanCall\(r\) \? \(callBtnHtml \+ mapBtnHtml\)\n\s+: mapOnlyBtnHtml\) \+ callStatusHtml;/);
  assert.ok(!/: r\.placeId \? \(callBtnHtml/.test(open), 'placeId だけで電話を並べない');
});

const STORE = {
  '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', '住所': '愛知県名古屋市中区栄1-1-1',
  'おすすめポイント': '炭火の焼き鳥が看板。', placeId: 'ChIJtestPlace',
};
const render = (over) => renderStorePage({ ...STORE, ...over }, 'J-test', [], []);

test('店舗ページ: 予約先が無く、電話確認のある店にだけ、ボタン・結果の行・共有の実装を入れる', () => {
  const html = render({ '電話確認': '住所' });
  assert.match(html, /<button type="button" class="link-btn tel" data-call-loc="store_page" onclick="nbCallStore\(event,'ChIJtestPlace','テスト酒場',this\)"/);
  assert.match(html, /<p class="nb-call-status" role="status"><\/p>/);
  assert.equal(html.split(CALL_SCRIPT).length - 1, 1, '共有の実装がそのまま1回入る（エスケープで壊れない）');
  assert.match(html, /<script>var NB_CALL_MAPS_KEY='[^']+';<\/script>/, '鍵はページ側で定義する');
  assert.ok(!/function nbCallStore|NB_PHONE_MEM/.test(html.replace(CALL_SCRIPT, '')), '店舗ページに自前の実装を残さない');
  const audit = auditHtml(html, { filename: 'stores/J-test.html' });
  assert.deepEqual(audit.violations, [], 'インラインJSが構文として生きている');
});

test('店舗ページ: 電話確認が無い店（placeId だけ）には電話を出さない', () => {
  const html = render({});
  assert.ok(!html.includes('link-btn tel'));
  assert.ok(!html.includes('nb-call-status'));
  assert.ok(!html.includes('nbCallStore'));
  assert.ok(!html.includes('NB_CALL_MAPS_KEY'));
  assert.ok(!html.includes('nb-call-js'));
});

test('店舗ページ: 予約先（ホットペッパー・食べログ）のある店は、本文のリンク欄には電話を出さない（これまでの規則のまま）。電話は行動バーに並ぶ（I-14b）', () => {
  for (const over of [{ 'ホットペッパーID': 'J000000001' }, { '食べログURL': 'https://tabelog.com/aichi/A2301/A230101/23000001/' }]) {
    const html = render({ '電話確認': '住所', ...over });
    assert.ok(!html.includes('link-btn tel'), JSON.stringify(over));
    assert.match(html, /<button type="button" class="nb-bar-btn nb-bar-sub nb-bar-tel" data-call-loc="store_page_bar" onclick="nbCallStore\(event,'ChIJtestPlace','テスト酒場',this\)"/, JSON.stringify(over));
    assert.equal(html.split(CALL_SCRIPT).length - 1, 1, '帯に電話を出す店には共有の実装が1回入る');
    assert.match(html, /<script>var NB_CALL_MAPS_KEY='[^']+';<\/script>/);
  }
});

test('店舗ページ: placeId が無い店は、電話確認があっても電話を出さない', () => {
  const html = render({ placeId: '', '電話確認': '店名' });
  assert.ok(!html.includes('link-btn tel'));
  assert.ok(!html.includes('nbCallStore'));
});
