'use strict';
// SEO-144: 既にある静的ページの GA スニペットを scripts/lib/ga_snippet.js の出力にそろえる。
// 旧スニペット2種だけを置き換え、知らない形は触らない。index.html の GA は localStorage の例外で止まらない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GA_ID } = require('../scripts/lib/ga_snippet');
const { LOADER, CANON_INLINE, LEGACY, classify } = require('../scripts/apply_ga_snippet');

const page = (inline, extraLoader = false) =>
  `<!DOCTYPE html>\n<html><head>\n<!-- Google Analytics 4 -->\n${LOADER}\n${inline}\n${extraLoader ? LOADER + '\n' : ''}<meta charset="utf-8"></head><body></body></html>\n`;

test('旧スニペット2種は正本に置き換わり、2回目は何も変えない', () => {
  assert.strictEqual(LEGACY.length, 2);
  for (const l of LEGACY) {
    const r = classify(page(l.inline));
    assert.strictEqual(r.kind, 'legacy', l.name);
    assert.ok(r.next.includes(CANON_INLINE));
    assert.ok(!r.next.includes(l.inline));
    // 読み込みタグとその前後は残す
    assert.ok(r.next.startsWith('<!DOCTYPE html>\n<html><head>\n<!-- Google Analytics 4 -->\n' + LOADER + '\n<script>'));
    assert.ok(r.next.endsWith('</script>\n<meta charset="utf-8"></head><body></body></html>\n'));
    assert.strictEqual(classify(r.next).kind, 'canonical');
  }
});

test('知らない形（ほかの処理が混ざっている・読み込みタグが2つ）は触らない', () => {
  const mixed = LEGACY[0].inline.replace('</script>', 'window.nbExtra=1;\n</script>');
  assert.deepStrictEqual(Object.keys(classify(page(mixed))), ['kind', 'reason']);
  assert.strictEqual(classify(page(mixed)).kind, 'unknown');
  assert.strictEqual(classify(page(CANON_INLINE, true)).kind, 'unknown');
  assert.strictEqual(classify('<html><head></head></html>').kind, 'none');
});

// index.html の GA 部分（<script> の頭から outbound_click の手前まで）を、ブラウザの最小限の代役で実行する
function runIndexGa({ search = '', storageThrows = false } = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const s = html.indexOf('<script>', html.indexOf(LOADER)) + '<script>'.length;
  const e = html.indexOf('// outbound_click:', s);
  assert.ok(s > 0 && e > s, 'index.html の GA 部分が見つからない');
  const store = new Map();
  const localStorage = {
    getItem(k) { if (storageThrows) throw new Error('SecurityError'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (storageThrows) throw new Error('SecurityError'); store.set(k, String(v)); },
  };
  const ctx = {
    location: { search, pathname: '/', href: 'https://nagoya-bites.com/', hostname: 'nagoya-bites.com' },
    localStorage,
    history: { replaceState() {} },
    URLSearchParams, Date,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e), ctx);
  const plain = () => JSON.parse(JSON.stringify(ctx.dataLayer.map((args) => Array.from(args))));
  const calls = plain();
  ctx.trackEvent('cta_click', { x: 1 });
  return { calls, events: plain().slice(calls.length), store };
}

test('index.html: localStorage が例外を投げる端末でも gtag config まで届き、イベントも送る', () => {
  const r = runIndexGa({ search: '?nb_owner=1', storageThrows: true });
  assert.deepStrictEqual(r.calls.map((c) => c[0]), ['js', 'config']);
  assert.deepStrictEqual(r.calls[1], ['config', GA_ID]);
  assert.strictEqual(r.events.length, 1);
  assert.strictEqual(r.events[0][1], 'cta_click');
  assert.ok(r.events[0][2].engagement_time_msec >= 1000, 'NB_ENGAGEMENT_EVENTS の動きは変えない');
});

test('index.html: ?nb_owner=1 は今までどおり内部トラフィックにし、独自イベントを送らない', () => {
  const r = runIndexGa({ search: '?nb_owner=1' });
  assert.strictEqual(r.store.get('nb_internal'), '1');
  assert.deepStrictEqual(r.calls[1], ['config', GA_ID, { traffic_type: 'internal' }]);
  assert.deepStrictEqual(r.events, []);
});
