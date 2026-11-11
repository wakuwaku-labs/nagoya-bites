'use strict';
// 日次記事の記事末ブロック（この記事で紹介したお店・あわせて読みたい特集）。
// 入る・二重に入らない・店舗ページと特集の URL が実在する・既にあるリンクと重ならない・日次の生成の流れから呼ばれる。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { applyToHtml, collectStores, collectFeatures, START, END } = require('../scripts/lib/journal_next_block');

const ROOT = path.join(__dirname, '..');
const JOURNAL = path.join(ROOT, 'journal');
const posts = fs.readdirSync(JOURNAL).filter(f => /^20\d\d-.*\.html$/.test(f)).sort();
const read = f => fs.readFileSync(path.join(JOURNAL, f), 'utf8');
const blockOf = h => { const s = h.indexOf(START), e = h.indexOf(END); return s === -1 ? '' : h.slice(s, e + END.length); };

const realStore = fs.readdirSync(path.join(ROOT, 'stores')).find(f => /^J\d+\.html$/.test(f)).replace(/\.html$/, '');
const sample = (title, storeId, extra = '') => `<html><body><article class="nb-article">
<h1 class="art-title">${title}</h1><div class="art-body"><p>本文</p>
<div class="store-list"><div class="store-card"><div class="store-info"><h3 class="store-name">テスト店</h3>
<div class="store-meta"><span>焼肉</span><span>栄（駅から徒歩5分）</span></div>
<div class="store-cta-row"><a class="store-link" href="../stores/${storeId}.html">店舗ページを見る →</a></div></div></div></div>${extra}</div>
</article>

<div class="related"><p class="related-title">関連記事</p></div>
</body></html>`;

test('店舗ページのある店カードから、記事末にブロックが入る（本文は変わらない）', () => {
  const html = sample('栄のラーメン', realStore);
  const out = applyToHtml(html);
  const block = blockOf(out);
  assert.ok(block.includes(`href="../stores/${realStore}.html"`));
  assert.ok(block.includes('テスト店') && block.includes('焼肉・栄'), '店名と「ジャンル・エリア（括弧の前まで）」');
  assert.ok(out.indexOf('</article>') < out.indexOf(START) && out.indexOf(END) < out.indexOf('<div class="related">'), '</article> と関連記事の間');
  assert.equal(out.split('</article>')[0], html.split('</article>')[0], '記事の本文は変えない');
});

test('何度流しても同じ（二重に入らない・空行も増えない）', () => {
  const once = applyToHtml(sample('栄のラーメン', realStore));
  assert.equal(applyToHtml(once), once);
  assert.equal(once.split(START).length, 2);
});

test('stores/ に無いリンク・店舗一覧へのリンクは載せない。載せる物が無ければ入れず、あるブロックも外す', () => {
  const none = applyToHtml(sample('題名', 'J000000000000'));
  assert.equal(none.includes(START), false);
  assert.equal(collectStores(sample('題名', 'index')).length, 0);
  const stale = sample('題名', 'J000000000000').replace('</article>', `</article>\n\n${START}\n<section>古い</section>\n${END}`);
  const gone = applyToHtml(stale);
  assert.equal(gone.includes(START), false);
});

test('特集は、記事の中でまだリンクしていないものだけ（既にあるリンクと二重にしない）', () => {
  const linked = collectFeatures(sample('栄のラーメン', realStore, '<a href="../features/nagoya-ramen.html">既存</a>'));
  assert.equal(linked.some(f => f.slug === 'nagoya-ramen'), false);
  const fresh = collectFeatures(sample('栄のラーメン', realStore));
  assert.ok(fresh.some(f => f.slug === 'nagoya-ramen'));
  assert.ok(fresh.length <= 2);
});

test('実際の記事: ブロックは最大1つ・店舗ページと特集の URL が実在する・本文の中には入らない', () => {
  let withBlock = 0;
  for (const f of posts) {
    const h = read(f);
    assert.ok(h.split(START).length <= 2, `${f}: ブロックが2つ以上`);
    const block = blockOf(h);
    if (!block) continue;
    withBlock++;
    assert.ok(h.indexOf(START) > h.indexOf('</article>'), `${f}: 記事の本文の外（</article> の後）に置く`);
    for (const m of block.matchAll(/href="\.\.\/stores\/([A-Za-z0-9_-]+)\.html"/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, 'stores', m[1] + '.html')), `${f}: stores/${m[1]}.html が無い`);
    }
    for (const m of block.matchAll(/href="\.\.\/features\/([A-Za-z0-9_-]+)\.html"/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, 'features', m[1] + '.html')), `${f}: features/${m[1]}.html が無い`);
      const rest = h.replace(block, '');
      assert.equal(rest.includes(`features/${m[1]}.html`), false, `${f}: 特集 ${m[1]} が他の場所と二重`);
    }
  }
  assert.ok(withBlock > 100, `ブロックのある記事が少なすぎる: ${withBlock}`);
});

test('実際の記事: 入れ直しが要る記事が無い（生成の元と既存の記事が一致）', () => {
  const stale = posts.filter(f => applyToHtml(read(f)) !== read(f));
  assert.deepEqual(stale, []);
});

test('実際の記事: 店舗ページへのリンクを持つ店カードがある記事には、必ずブロックが入る', () => {
  const missing = posts.filter(f => {
    const body = read(f).split('</article>')[0];
    return /class="store-card"[\s\S]*?href="\.\.\/stores\/(?!index\.)[A-Za-z0-9_-]+\.html"/.test(body) && !blockOf(read(f));
  });
  assert.deepEqual(missing, []);
});

test('日次の生成の流れ（refresh_journal_related.js）から呼ばれる', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts', 'refresh_journal_related.js'), 'utf8'), /add_journal_next_block/);
});
