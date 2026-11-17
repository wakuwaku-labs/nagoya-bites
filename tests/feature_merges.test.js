'use strict';
// 基本方針 段階5 S5-3（0069 決定7・0077）: 重なった特集を寄せた結果が、サイトのどこにも残っていないことを見る。
//   転送ページの形・内部リンクの張り替え漏れ・一覧／サイトマップ／llms.txt／役割表／入れ替えの設定からの除外・寄せ先の注記
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../scripts/lib/feature_merges');
const { rewriteLinks, hrefResolvesTo, removeIndexCard } = require('../scripts/merge_features');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const merges = M.loadMerges(ROOT);

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (f.endsWith('.html')) acc.push(p);
  }
  return acc;
}

test('承認された2組だけを寄せている（ほかの組は寄せない）', () => {
  assert.deepEqual(merges.map((m) => `${m.from}>${m.to}`), [
    'nagoya-yakitori-guide>nagoya-yakitori',
    'industry-insiders-pick>kospa-insider',
  ]);
  for (const m of merges) {
    assert.ok(fs.existsSync(path.join(ROOT, 'features', `${m.to}.html`)), `${m.to} が実在する`);
    assert.ok(!M.isMergedStub(read(`features/${m.to}.html`)), `${m.to} 自身は転送ページではない`);
  }
});

test('寄せ元は転送ページ: canonical は寄せ先・noindex・meta refresh・JS・リンク。URL は消さない', () => {
  for (const m of merges) {
    const h = read(`features/${m.from}.html`);
    assert.ok(M.isMergedStub(h));
    assert.equal(M.stubTarget(h), m.to);
    assert.ok(h.includes(`<link rel="canonical" href="https://nagoya-bites.com/features/${m.to}.html">`));
    assert.ok(h.includes('<meta name="robots" content="noindex,follow">'));
    assert.ok(h.includes(`<meta http-equiv="refresh" content="0; url=${m.to}.html">`));
    assert.ok(h.includes(`location.replace("${m.to}.html")`));
    assert.ok(h.includes(`<a href="${m.to}.html">`));
    assert.ok(h.length < 1200, '転送だけの最小のページ');
  }
});

test('サイト全体に、寄せ元（転送ページ）へのリンクが残っていない（店舗ページ・ハブ・ジャーナル・特集・トップ）', () => {
  const pages = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
    ...walk(path.join(ROOT, 'features')).map((p) => path.relative(ROOT, p)),
    ...walk(path.join(ROOT, 'journal')).map((p) => path.relative(ROOT, p)),
    ...walk(path.join(ROOT, 'stores')).map((p) => path.relative(ROOT, p)),
  ];
  const bad = [];
  for (const rel of pages) {
    const h = read(rel);
    if (M.isMergedStub(h)) continue;
    for (const m of merges) {
      if (new RegExp(`features/${m.from}\\.html|href="${m.from}\\.html`).test(h)) bad.push(`${rel} → ${m.from}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('一覧・サイトマップ・llms.txt・ページ名・役割表・入れ替えの設定に、寄せ元が無い', () => {
  const roles = JSON.parse(read('data/feature_roles.json'));
  const rosters = JSON.parse(read('data/feature_rosters.json'));
  for (const m of merges) {
    assert.ok(!read('features/index.html').includes(`href="${m.from}.html"`), '特集の一覧にカードが無い');
    assert.ok(!read('sitemap.xml').includes(`/features/${m.from}.html`), 'サイトマップに無い');
    assert.ok(!read('sitemap-images.xml').includes(`/features/${m.from}.html`), '画像サイトマップに無い');
    assert.ok(!read('llms.txt').includes(`/features/${m.from}.html`), 'llms.txt に無い');
    assert.ok(!read('page-names.json').includes(`/features/${m.from}.html`), 'ページ名に無い');
    assert.ok(!(m.from in rosters.features), '毎月の掲載店の入れ替えに載っていない（復活しない）');
    for (const g of roles.groups) {
      assert.ok(!g.members.includes(m.from), '役割表に無い');
      assert.ok(!g.edges.some((e) => e.from === m.from || e.to === m.from), '役割表の相互リンクに無い');
    }
    // 寄せ先は残っている
    assert.ok(read('sitemap.xml').includes(`/features/${m.to}.html`));
    assert.ok(read('features/index.html').includes(`href="${m.to}.html"`));
  }
});

test('寄せ先: 「統合した記事から」の一文が1つだけあり、冒頭（最初の見出しより前）には置かない', () => {
  for (const m of merges) {
    const h = read(`features/${m.to}.html`);
    assert.equal((h.match(new RegExp(`data-nb-merged-from="${m.from}"`, 'g')) || []).length, 1);
    assert.ok(h.indexOf('data-nb-merged-from') > h.search(/<h1[\s>]/), '冒頭（h1 より前）には置かない');
    assert.ok(!/\d+選/.test(M.mergedFromNote({ from: m.from, fromTitle: m.fromTitle })), '注記に「N選」を入れない（掲載数の同期に拾われる）');
    assert.ok(!/業界人|目利き/.test(M.mergedFromNote(m)), '人が選んだと読める語を使わない');
  }
});

test('毎月の掲載店の入れ替えは、転送ページを書き換えない', () => {
  const src = read('scripts/refresh_feature_rosters.js');
  assert.match(src, /isMergedStub\(fs\.readFileSync\(file, 'utf8'\)\)/);
});

test('サイトマップ・llms.txt・特集の一覧の生成元は、転送ページを数えない', () => {
  assert.match(read('gen-store-pages.js'), /filterLiveFeatureFiles/);
  assert.match(read('scripts/gen_llms_txt.js'), /isMergedStub/);
  assert.match(read('scripts/generate_page_names.js'), /isMergedStub/);
});

test('filterLiveFeatureFiles: 転送ページだけを外す', () => {
  const dir = path.join(ROOT, 'features');
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  const live = M.filterLiveFeatureFiles(dir, all);
  for (const m of merges) assert.ok(!live.includes(`${m.from}.html`));
  assert.equal(live.length, all.length - merges.length);
});

// ── 張り替えの部品 ─────────────────────────────────────────────────────────

const mg = { from: 'old-a', to: 'new-b', toLabel: '新しい特集', oldLabels: ['', '旧い文言'], storeFromLabels: ['旧い題'], storeToLabel: '新しい題' };

test('hrefResolvesTo: 置き場所ごとの書き方を同じ特集として読む', () => {
  assert.ok(hrefResolvesTo('old-a.html', 'features', 'old-a'));
  assert.ok(hrefResolvesTo('/features/old-a.html', 'features', 'old-a'));
  assert.ok(hrefResolvesTo('../features/old-a.html', 'journal', 'old-a'));
  assert.ok(hrefResolvesTo('features/old-a.html', 'root', 'old-a'));
  assert.ok(hrefResolvesTo('https://nagoya-bites.com/features/old-a.html#x', 'root', 'old-a'));
  assert.ok(!hrefResolvesTo('old-a.html', 'journal', 'old-a'));
  assert.ok(!hrefResolvesTo('old-ab.html', 'features', 'old-a'));
});

test('rewriteLinks: href と計測の link_url を替え、空・旧い文言のときだけ文言を替える。本文中の言い回しは触らない', () => {
  const html = [
    '<div class="related">',
    '  <div class="related-links">',
    `    <a class="related-link" href="old-a.html" onclick="trackEvent('x',{link_url:'old-a.html'})">旧い文言</a>`,
    '  </div>',
    '</div>',
    '<p>詳しくは<a href="old-a.html">この特集</a>へ。</p>',
  ].join('\n');
  const r = rewriteLinks(html, { dirKind: 'features', selfSlug: 'other', merge: mg });
  assert.equal(r.rewritten, 2);
  assert.ok(r.html.includes(`href="new-b.html" onclick="trackEvent('x',{link_url:'new-b.html'})">新しい特集</a>`));
  assert.ok(r.html.includes('<a href="new-b.html">この特集</a>'));
  assert.ok(!r.html.includes('old-a'));
  assert.equal(rewriteLinks(r.html, { dirKind: 'features', selfSlug: 'other', merge: mg }).rewritten, 0, '冪等');
});

test('rewriteLinks: 寄せ先が同じ「関連する特集」にあるとき・寄せ先自身のページでは、リンクを外す（重複・自己リンクを作らない）', () => {
  const block = (extra) => `<div class="related">\n  <div class="related-links">\n    <a class="related-link" href="old-a.html">旧い文言</a>\n${extra}  </div>\n</div>\n`;
  const withTarget = block('    <a class="related-link" href="new-b.html">新しい特集</a>\n');
  const r1 = rewriteLinks(withTarget, { dirKind: 'features', selfSlug: 'other', merge: mg });
  assert.equal(r1.removed, 1);
  assert.equal((r1.html.match(/new-b\.html/g) || []).length, 1);
  assert.ok(!r1.html.includes('\n\n'), '外した行に空行を残さない');
  const r2 = rewriteLinks(block(''), { dirKind: 'features', selfSlug: 'new-b', merge: mg });
  assert.equal(r2.removed, 1);
  assert.ok(!r2.html.includes('old-a') && !r2.html.includes('new-b'));
});

test('rewriteLinks: 矢印つきの案内（journal の「◯◯ →」）は矢印を残して文言を替える。店舗ページは題の対応表を使う', () => {
  const j = '<a href="../features/old-a.html">旧い文言 →</a>';
  assert.equal(rewriteLinks(j, { dirKind: 'journal', selfSlug: null, merge: mg }).html, '<a href="../features/new-b.html">新しい特集 →</a>');
  const li = '<ul>\n      <li><a href="../features/old-a.html">旧い題</a></li>\n      <li><a href="../features/c.html">C</a></li>\n    </ul>';
  const r = rewriteLinks(li, { dirKind: 'journal', selfSlug: null, merge: mg, isStore: true });
  assert.ok(r.html.includes('<li><a href="../features/new-b.html">新しい題</a></li>'));
  const dup = '<ul>\n      <li><a href="../features/old-a.html">旧い題</a></li>\n      <li><a href="../features/new-b.html">新しい題</a></li>\n    </ul>';
  const r2 = rewriteLinks(dup, { dirKind: 'journal', selfSlug: null, merge: mg, isStore: true });
  assert.equal((r2.html.match(/<li>/g) || []).length, 1, '同じ一覧に寄せ先があれば <li> ごと外す');
});

test('rewriteLinks: トップの JavaScript の規則（u:\'features/<slug>.html\'）も替える', () => {
  const html = `<script>var r=[{u:'features/old-a.html',l:'x'}];</script>`;
  const r = rewriteLinks(html, { dirKind: 'root', selfSlug: null, merge: mg });
  assert.ok(r.html.includes(`u:'features/new-b.html'`));
});

test('removeIndexCard: 特集の一覧のカードだけを外し、空行を重ねない', () => {
  const html = '  <a class="article-card" href="a.html">\n    <div>A</div>\n  </a>\n\n  <a class="article-card" href="old-a.html">\n    <div>O</div>\n  </a>\n\n  <a class="article-card" href="c.html">\n    <div>C</div>\n  </a>\n';
  const out = removeIndexCard(html, 'old-a');
  assert.ok(!out.includes('old-a') && out.includes('a.html') && out.includes('c.html'));
  assert.ok(!out.includes('\n\n\n'));
});

test('トップ・ジャーナルの振り分け・語彙表は寄せ元を指さない', () => {
  for (const m of merges) {
    assert.ok(!require('../scripts/lib/journal_topics').TOPIC_FEATURES.some((r) => r[1] === m.from), 'journal_topics');
    assert.ok(!read('data/journal_seo_keywords.json').includes(`features/${m.from}.html`), '語彙表');
    assert.ok(!read('gen-store-pages.js').includes(`file: '${m.from}.html'`), '店舗ページの推定の規則');
  }
});
