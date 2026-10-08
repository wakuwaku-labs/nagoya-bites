'use strict';
// SEO-138: GA4 のスニペットを scripts/lib/ga_snippet.js の1本にまとめたことの検査
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GA_ID, gaSnippet } = require('../scripts/lib/ga_snippet');
const { auditHtml } = require('../scripts/lib/inline_js');

const ROOT = path.resolve(__dirname, '..');
const wrap = (head) => `<!DOCTYPE html><html><head>${head}</head><body></body></html>`;

test('部品: 構文が通り、gtag config と外部リンクの正規表現が生きている', () => {
  const s = gaSnippet();
  assert.deepStrictEqual(auditHtml(wrap(s), { filename: 'ga.html' }).violations, []);
  assert.ok(s.startsWith('<!-- Google Analytics 4 -->\n'));
  assert.ok(!gaSnippet({ comment: false }).includes('<!--'));
  assert.ok(s.includes(`gtag('config','${GA_ID}')`));
  assert.ok(s.includes('if(!/^https?:\\/\\//i.test(href))return;'), '生成物の正規表現は /^https?:\\/\\//i');
});

// ブラウザの最小限の代役でスニペットを実行し、gtag に渡った引数を見る
function run({ search = '', stored = null, storageThrows = false } = {}) {
  const store = new Map(stored ? [['nb_internal', stored]] : []);
  const localStorage = {
    getItem(k) { if (storageThrows) throw new Error('SecurityError'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (storageThrows) throw new Error('SecurityError'); store.set(k, String(v)); },
  };
  let replaced = null;
  const listeners = [];
  const ctx = {
    location: { search, pathname: '/stores/x.html', href: 'https://nagoya-bites.com/stores/x.html', hostname: 'nagoya-bites.com' },
    localStorage,
    history: { replaceState(_s, _t, url) { replaced = url; } },
    document: { addEventListener(type, fn) { listeners.push(type); } },
    URLSearchParams, URL, Date,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const code = gaSnippet().match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(code, ctx);
  // vm の中で作られた配列・オブジェクトは別 realm なので、JSON で通常の値に戻して比べる
  const plain = () => JSON.parse(JSON.stringify(ctx.dataLayer.map((args) => Array.from(args))));
  const calls = plain();
  ctx.trackEvent('cta_click', { x: 1 });
  const events = plain().slice(calls.length);
  return { calls, events, store, replaced, listeners };
}

test('動き: 通常の閲覧は内部扱いにせず、独自イベントも送る', () => {
  const r = run();
  assert.deepStrictEqual(r.calls.map((c) => c[0]), ['js', 'config']);
  assert.deepStrictEqual(r.calls[1], ['config', GA_ID]);
  assert.deepStrictEqual(r.events, [['event', 'cta_click', { x: 1 }]]);
  assert.deepStrictEqual(r.listeners, ['click']);
});

test('動き: ?nb_owner=1 で内部トラフィックにし、以後の独自イベントは送らない', () => {
  const r = run({ search: '?nb_owner=1' });
  assert.strictEqual(r.store.get('nb_internal'), '1');
  assert.strictEqual(r.replaced, '/stores/x.html');
  assert.deepStrictEqual(r.calls[1], ['config', GA_ID, { traffic_type: 'internal' }]);
  assert.deepStrictEqual(r.events, []);
  const again = run({ stored: '1' });
  assert.deepStrictEqual(again.calls[1], ['config', GA_ID, { traffic_type: 'internal' }]);
});

test('動き: localStorage が例外を投げる端末でも gtag config まで届く', () => {
  const r = run({ search: '?nb_owner=1', storageThrows: true });
  assert.deepStrictEqual(r.calls.map((c) => c[0]), ['js', 'config']);
  assert.deepStrictEqual(r.calls[1], ['config', GA_ID]);
  assert.deepStrictEqual(r.events, [['event', 'cta_click', { x: 1 }]]);
});

test('使う側: 4か所とも部品を通し、スニペットを直書きしていない', () => {
  const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
  const html = renderStorePage({ '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋' }, []);
  assert.ok(html.includes(gaSnippet()), '店舗ページに部品の出力がそのまま入る');
  const { renderHtml } = require(path.join(ROOT, 'scripts', 'generate_daily_draft.js'));
  const journal = renderHtml({ title: 'テスト', description: '説明', slug: '2026-10-09-test', date: '2026-10-09', lead: 'リード', theme: 'today_one', body_html: '<p>本文</p>', stores: [], sources: [], insider_points: [] });
  assert.ok(journal.includes(gaSnippet()), 'ジャーナルは {{GA_SNIPPET}} が部品の出力で埋まる');
  assert.ok(!journal.includes('{{GA_SNIPPET}}'));
  const tpl = fs.readFileSync(path.join(ROOT, 'journal', '_template.html'), 'utf8');
  assert.ok(tpl.includes('{{GA_SNIPPET}}'));
  for (const f of ['gen-store-pages.js', 'scripts/gen_area_genre_pages.js', 'scripts/gen_industry_features.js', 'journal/_template.html']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!src.includes('googletagmanager.com/gtag/js'), `${f} に GA スニペットの直書きが残っている`);
  }
  for (const f of ['scripts/gen_area_genre_pages.js', 'scripts/gen_industry_features.js']) {
    assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /gaSnippet\(/, `${f} が部品を使っていない`);
  }
});
