'use strict';
// ISSUE-153: 新しく作る特集にも、予約送客の計測と予約申告プロンプトが自動で入る。
// 冒頭の EDITORS' PICK を毎日作り直す生成器が計測なしで書いていたため、#417 で足した予約送客の計測が
// 同じ朝の CI の再生成で消えていた。生成器が scripts/lib/feature_tracking.js の文字列で書けば、
// 後から補う add_feature_tracking.js と行き来しない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { reserveExitOnclick, featureStoreOnclick, withReserveAsk } = require('../scripts/lib/feature_tracking');
const { EXIT_EVENTS } = require('../scripts/lib/reservation_exits');
const { BLOCK_RE } = require('../scripts/lib/reservation_ask_snippet');
const { isRedirectStub } = require('../scripts/lib/store_orphans');
const topCta = require('../scripts/add_feature_top_cta');
const { processHtml, SCROLL_DEPTH_SCRIPT } = require('../scripts/add_feature_tracking');

// 店舗ページがあり、誘導ページでも閉店でもない店を data/stores.json の順に n 店
function realStores(n) {
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const closed = fs.readFileSync(path.join(ROOT, 'data', 'closed_stores.json'), 'utf8');
  const out = [];
  for (const s of stores) {
    const id = s['ホットペッパーID'];
    if (!/^J\d+$/.test(id || '') || closed.includes(id)) continue;
    const f = path.join(ROOT, 'stores', `${id}.html`);
    if (!fs.existsSync(f) || isRedirectStub(fs.readFileSync(f, 'utf8'))) continue;
    out.push({ id, name: s['店名'] });
    if (out.length === n) break;
  }
  return out;
}

// 手で書いた新しい特集（ItemList と本文だけで、計測もプロンプトも無い）
function newFeaturePage(stores) {
  const itemListElement = stores.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `https://nagoya-bites.com/stores/${s.id}.html` }));
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement });
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>テスト特集</title>
<script type="application/ld+json">${ld}</script>
</head><body>
<article><h1>テスト特集</h1>
<section class="art-body">
<p>導入</p>
<h2>選び方</h2>
<p>本文</p>
</section></article>
${SCROLL_DEPTH_SCRIPT}
</body></html>
`;
}

test('計測の文字列は予約送客の語彙（cta_click）で、店名の引用符を逃がす', () => {
  assert.ok(EXIT_EVENTS.includes('cta_click'));
  assert.strictEqual(
    reserveExitOnclick("A'B \"C\"", 'J1', 'date'),
    "(window.nbReserveExit||trackEvent)('cta_click',{store_name:'A\\'B &quot;C&quot;',store_id:'J1',link_domain:'www.hotpepper.jp',location:'feature',feature:'date'})"
  );
  assert.strictEqual(featureStoreOnclick('J1', 'date'), "trackEvent('feature_store_click',{store:'J1',feature:'date'})");
  // 予約導線の無いページにはプロンプトを入れない
  const plain = '<html><body><p>x</p></body></html>';
  assert.strictEqual(withReserveAsk(plain), plain);
});

test('新しい特集を生成の流れに通すと、冒頭の区画に計測が付き、プロンプトが入り、後から補うものが無い', () => {
  const stores = realStores(6);
  assert.strictEqual(stores.length, 6);
  const slug = 'test-new-feature';
  const r = topCta.applyToHtml(newFeaturePage(stores), slug);
  assert.strictEqual(r.status, 'added');
  const html = r.next;
  const block = html.slice(html.indexOf(topCta.START), html.indexOf(topCta.END));
  const reserve = block.match(/<a [^>]*href="https:\/\/www\.hotpepper\.jp\/strJ\d+\/"[^>]*>/g) || [];
  const detail = block.match(/<a [^>]*href="\.\.\/stores\/J\d+\.html"[^>]*>/g) || [];
  assert.strictEqual(reserve.length, 3);
  assert.strictEqual(detail.length, 3);
  for (const a of reserve) {
    assert.match(a, /onclick="\(window\.nbReserveExit\|\|trackEvent\)\('cta_click',\{store_name:'[^']+',store_id:'J\d+',link_domain:'www\.hotpepper\.jp',location:'feature',feature:'test-new-feature'\}\)"/);
  }
  for (const a of detail) assert.match(a, /onclick="trackEvent\('feature_store_click',\{store:'J\d+',feature:'test-new-feature'\}\)"/);
  // 予約申告プロンプト（window.nbReserveExit を定義する）が </body> の前に入る
  assert.match(html, BLOCK_RE);
  assert.ok(html.search(BLOCK_RE) < html.lastIndexOf('</body>'));
  // 後から補う add_feature_tracking.js が足すものが無い（＝翌日の再生成と行き来しない）
  assert.strictEqual(processHtml(html, slug), html);
  // もう一度生成しても変わらない（冪等）
  assert.strictEqual(topCta.applyToHtml(html, slug).next, html);
});

test('誘導ページ（古い ID）の店は冒頭の区画に出さない', () => {
  const orphans = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'store_page_orphans.json'), 'utf8'));
  const stub = (orphans.redirectStubSlugs || []).find((id) => /^J\d+$/.test(id) && fs.existsSync(path.join(ROOT, 'stores', `${id}.html`)));
  assert.ok(stub, '誘導ページが1本は要る');
  const page = newFeaturePage([{ id: stub, name: '誘導ページの店' }].concat(realStores(4)));
  const r = topCta.applyToHtml(page, 'test-stub');
  assert.strictEqual(r.status, 'added');
  const block = r.next.slice(r.next.indexOf(topCta.START), r.next.indexOf(topCta.END));
  assert.ok(!block.includes(stub));
  assert.strictEqual((block.match(/topcta-item/g) || []).length, 3);
});
