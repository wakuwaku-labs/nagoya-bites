'use strict';
// 店舗ページの内部リンクのクリック計測（internal_link_click）: 付くリンク・付かないリンク・二重に入らない・gtag が無くても例外を出さない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TAG, MARKER, hasTracking, hasBlocks, applyToHtml } = require('../scripts/lib/store_link_tracking');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/js/store-link-tracking.js'), 'utf8');

// 最小限の DOM の代役: 要素は { tag, classes, href, parent }。closest は 'a[href]' と '.クラス' だけ分かる
function el(tag, classes, parent, href) {
  const e = { tag, classes: classes || [], parent: parent || null, href };
  e.getAttribute = (n) => (n === 'href' ? e.href : null);
  e.closest = (sel) => {
    for (let n = e; n; n = n.parent) {
      if (sel === 'a[href]' ? (n.tag === 'a' && n.href != null) : n.classes.includes(sel.slice(1))) return n;
    }
    return null;
  };
  return e;
}

function load({ withTrackEvent = true, throwInTrack = false } = {}) {
  const listeners = [];
  const events = [];
  const win = {};
  const ctx = {
    window: win,
    document: { addEventListener: (t, fn, cap) => listeners.push({ t, fn, cap }) },
    location: { href: 'https://nagoya-bites.com/stores/J000000001.html', hostname: 'nagoya-bites.com' },
    URL,
  };
  if (withTrackEvent) ctx.trackEvent = (n, p) => { if (throwInTrack) throw new Error('boom'); events.push([n, p]); };
  vm.runInNewContext(SRC, ctx);
  const click = (target) => listeners.forEach(l => l.t === 'click' && l.fn({ target }));
  return { listeners, events, click, ctx };
}

function page() {
  const body = el('body');
  const mk = (cls, href, extra) => { const box = el('div', cls, body); const a = el('a', [], box, href); const span = el('span', [], a); return { a, span }; };
  return {
    listed: mk(['related-features', 'listed-features'], '../features/banquet.html'),
    related: mk(['related-features'], '../features/nagoya-solo-dining.html'),
    journal: mk(['related-features', 'listed-features'], '../journal/2026-10-01-x.html'),
    similar: mk(['related-stores'], 'J003715703.html'),
    back: mk(['back-section'], '../stores/area/chikusa-imaike/izakaya.html'),
    crumb: mk(['breadcrumb'], '../index.html'),
    header: mk(['nb-header'], '../features/index.html'),
    footer: mk(['nb-footer-group'], '../about.html'),
    outbound: mk(['related-stores'], 'https://www.hotpepper.jp/strJ000/'),
    reserve: mk(['link-btn'], 'https://example.com/'),
  };
}

test('ブロック内の内部リンクだけが internal_link_click になる（block・link_type・link_url）', () => {
  const t = load(); const p = page();
  t.click(p.listed.span); t.click(p.related.a); t.click(p.journal.a); t.click(p.similar.a); t.click(p.back.a); t.click(p.crumb.a);
  assert.deepStrictEqual(t.events.map(e => e[0]), Array(6).fill('internal_link_click'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t.events.map(e => e[1]))), [
    { block: 'listed_features', link_type: 'feature', link_url: '/features/banquet.html' },
    { block: 'related_features', link_type: 'feature', link_url: '/features/nagoya-solo-dining.html' },
    { block: 'listed_features', link_type: 'journal', link_url: '/journal/2026-10-01-x.html' },
    { block: 'related_stores', link_type: 'store', link_url: '/stores/J003715703.html' },
    { block: 'back_to_list', link_type: 'area', link_url: '/stores/area/chikusa-imaike/izakaya.html' },
    { block: 'breadcrumb', link_type: 'other', link_url: '/index.html' },
  ]);
});

test('ヘッダー・フッター・ブロックの外のボタン・外部リンクは送らない（外部は outbound_click の役目）', () => {
  const t = load(); const p = page();
  t.click(p.header.a); t.click(p.footer.a); t.click(p.outbound.a); t.click(p.reserve.a); t.click(el('div', ['related-stores']));
  assert.deepStrictEqual(t.events, []);
});

test('二重に入らない: リスナーは1つで、読み込みを2回しても増えない', () => {
  const listeners = [];
  const win = {};
  const ctx = { window: win, document: { addEventListener: (t, fn) => listeners.push(fn) }, location: { href: 'https://nagoya-bites.com/stores/a.html', hostname: 'nagoya-bites.com' }, URL, trackEvent() {} };
  vm.runInNewContext(SRC, ctx); vm.runInNewContext(SRC, ctx);
  assert.strictEqual(listeners.length, 1);
  const t = load(); const p = page(); t.click(p.related.a);
  assert.strictEqual(t.events.length, 1);
});

test('gtag・trackEvent が無い環境、trackEvent が例外を投げる環境でも例外を出さない', () => {
  const p = page();
  const a = load({ withTrackEvent: false }); assert.doesNotThrow(() => a.click(p.related.a));
  const b = load({ throwInTrack: true }); assert.doesNotThrow(() => b.click(p.related.a));
  assert.strictEqual(b.events.length, 0);
});

test('タグ: 変換は冪等で、</body> の直前の1行に入る。転送ページ（ブロック無し）は対象外', () => {
  const html = '<html><body><div class="related-stores"></div>\n<script>x</script>\n</body>\n</html>';
  const once = applyToHtml(html);
  assert.strictEqual(applyToHtml(once), once);
  assert.ok(once.endsWith(`<script>x</script>\n${TAG}\n</body>\n</html>`));
  assert.ok(hasTracking(once) && !hasTracking(html));
  assert.strictEqual(applyToHtml('<p>no body</p>'), null);
  assert.ok(hasBlocks(html));
  assert.ok(!hasBlocks('<html><body><p>このページは移動しました</p></body></html>'));
});

test('生成の元（gen-store-pages.js）が同じ1行を同じ位置に出す', () => {
  const gen = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.ok(gen.includes('${RESERVE_ASK_SCRIPT}\n${storeLinkTracking.TAG}\n</body>'));
  assert.ok(TAG.includes(MARKER) && fs.existsSync(path.join(ROOT, MARKER)));
});

test('既存の店舗ページ: ブロックがあるページすべてにタグが1つだけあり、ブロックの無いページには無い', () => {
  const dir = path.join(ROOT, 'stores');
  let blocks = 0, tracked = 0;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const n = html.split(MARKER).length - 1;
    if (hasBlocks(html)) { blocks++; if (n === 1) tracked++; else assert.fail(`${f}: タグが ${n} 個`); } else assert.strictEqual(n, 0, f);
  }
  assert.ok(blocks > 5000);
  assert.strictEqual(tracked, blocks);
});
