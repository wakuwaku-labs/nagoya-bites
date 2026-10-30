'use strict';
// 検索のクリック率を上げる title と説明文の書き直し（Ondine #1066）の台帳と道具の検査
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readTag, rewritePage, rewriteBatch, checkBatch, report } = require('../scripts/search_ctr_rewrite');
const { checkTitleFront, titleBody } = require('../scripts/journal_seo_kw');
const { report: expReport } = require('../scripts/journal_title_experiment');

const ROOT = path.resolve(__dirname, '..');
const LEDGER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/search_ctr_rewrites.json'), 'utf8'));
const WORDING = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/selection_wording_policy.json'), 'utf8'));
const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const HTML = [
  '<html><head><title>栄の店「A」を読む｜NAGOYA BITES Journal</title>',
  '<meta name="description" content="古い説明。">',
  '<meta property="og:title" content="栄の店「A」を読む｜NAGOYA BITES">',
  '</head><body><h1>栄の店「A」を読む</h1></body></html>',
].join('\n');
const PAGE = {
  path: 'journal/x.html',
  fields: [
    { tag: 'title', before: '栄の店「A」を読む｜NAGOYA BITES Journal', after: 'A（栄）の席と価格｜NAGOYA BITES Journal' },
    { tag: 'meta:description', before: '古い説明。', after: '新しい説明。' },
    { tag: 'og:title', before: '栄の店「A」を読む｜NAGOYA BITES', after: 'A（栄）の席と価格｜NAGOYA BITES' },
  ],
};

test('反映と取り消し: head の文字だけを替え、往復で元に戻る。h1 は変えない', () => {
  const a = rewritePage(HTML, PAGE, 'before', 'after');
  assert.deepEqual(a.problems, []);
  assert.equal(a.changed, 3);
  assert.equal(readTag(a.html, 'title'), 'A（栄）の席と価格｜NAGOYA BITES Journal');
  assert.match(a.html, /<h1>栄の店「A」を読む<\/h1>/);
  const again = rewritePage(a.html, PAGE, 'before', 'after');
  assert.equal(again.changed, 0, '済みの所は飛ばす');
  const r = rewritePage(a.html, PAGE, 'after', 'before');
  assert.equal(r.html, HTML);
});

test('台帳と合わない値があれば、そのファイルもほかのファイルも書き換えない', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctr-rewrite-'));
  fs.mkdirSync(path.join(dir, 'journal'));
  fs.writeFileSync(path.join(dir, 'journal/x.html'), HTML);
  fs.writeFileSync(path.join(dir, 'journal/y.html'), HTML.replace('古い説明。', '誰かが直した説明。'));
  const batch = { pages: [PAGE, { ...PAGE, path: 'journal/y.html' }] };
  const r = rewriteBatch(batch, 'apply', { root: dir });
  assert.equal(r.problems.length, 1);
  assert.equal(r.written, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'journal/x.html'), 'utf8'), HTML);
  assert.throws(() => rewritePage(HTML, { path: 'p', fields: [{ tag: 'title', before: readTag(HTML, 'title'), after: 'A & B' }] }, 'before', 'after'));
});

test('比較: 書き直した記事のクリック率（表示で加重）が下がるか、全体が下限を下回れば止める', () => {
  const batch = { id: 't', stop: { siteClicksBelow: 850 }, baselineSite: { clicks: 886 },
    pages: [{ path: 'journal/x.html', baseline: { impressions: 1000, clicks: 20 } }, { path: 'journal/y.html', baseline: { impressions: 500, clicks: 5 } }] };
  const up = report(batch, { totals: { clicks: 960 }, pages: [
    { page: 'https://nagoya-bites.com/journal/x.html', impressions: 1000, clicks: 40, position: 7 },
    { page: 'https://nagoya-bites.com/journal/y.html', impressions: 500, clicks: 6, position: 8 }] });
  assert.equal(up.stop.hit, false);
  assert.equal(up.rewrittenPages.now.clicks, 46);
  const down = report(batch, { totals: { clicks: 840 }, pages: [
    { page: 'https://nagoya-bites.com/journal/x.html', impressions: 1000, clicks: 10, position: 7 }] });
  assert.equal(down.stop.hit, true);
  assert.equal(down.stop.reasons.length, 2);
  assert.deepEqual(down.missing, ['journal/y.html']);
});

test('台帳: 今のページが台帳の状態と一致する（applied なら after）', () => {
  for (const b of LEDGER.batches) {
    assert.ok(['applied', 'reverted'].includes(b.status), `${b.id}: status`);
    assert.deepEqual(checkBatch(b), [], b.id);
    assert.ok(b.compareOn && b.stop && b.stop.siteClicksBelow, `${b.id}: 評価日と止める条件`);
    for (const p of b.pages) assert.ok(p.baseline && p.baseline.impressions > 0, `${p.path}: 基線`);
  }
});

test('台帳: 書き直した題と説明文は規則どおり（長さ・前30字・人が選んだと読める言い方なし・og と同じ）', () => {
  const errors = WORDING.terms.filter(t => t.severity === 'error').map(t => new RegExp(t.pattern));
  for (const b of LEDGER.batches) {
    for (const p of b.pages) {
      const html = fs.readFileSync(path.join(ROOT, p.path), 'utf8');
      for (const f of p.fields) {
        assert.notEqual(f.after, f.before, `${p.path} ${f.tag}: 変わっていない`);
        for (const re of errors) assert.ok(!re.test(f.after), `${p.path} ${f.tag}: ${re}`);
        if (/description/.test(f.tag)) assert.ok(f.after.length <= 160, `${p.path} ${f.tag}: ${f.after.length}字`);
      }
      const t = p.fields.find(f => f.tag === 'title');
      if (!t) continue;
      const body = titleBody(t.after);
      assert.ok(body.length <= 50, `${p.path}: 題が長い（${body.length}字）`);
      assert.equal(readTag(html, 'og:title'), `${body}｜NAGOYA BITES`, `${p.path}: og:title も同じ題`);
      if (p.path.startsWith('journal/')) {
        const names = [...html.matchAll(/class="store-name"[^>]*>([\s\S]*?)<\//g)].map(m => strip(m[1]))
          .concat([...html.matchAll(/data-hero-store="([^"]*)"/g)].map(m => m[1]));
        const h1 = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]);
        const r = checkTitleFront(body, { storeNames: names, context: `${h1}\n${readTag(html, 'meta:description')}` });
        assert.ok(r.ok, `${p.path}: ${r.missing.join('・')}`);
      }
    }
  }
});

test('特集の題の系統は ADR 0033（P-334）まで変えない: 特集は説明文だけ', () => {
  for (const b of LEDGER.batches) for (const p of b.pages.filter(x => x.path.startsWith('features/'))) {
    assert.ok(p.fields.every(f => /description/.test(f.tag)), `${p.path}: 特集の題を変えている`);
  }
});

test('SEO-137 の比較: 書き直したジャーナルは new_articles から除き、比較中の20本には触れていない', () => {
  const exp = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/journal_title_experiment.json'), 'utf8'));
  const inExp = new Set(exp.pages.map(p => p.path));
  const excluded = new Set((exp.excludeFromNewArticles || []).map(e => e.path));
  for (const b of LEDGER.batches) for (const p of b.pages.filter(x => x.path.startsWith('journal/'))) {
    assert.ok(!inExp.has(p.path), `${p.path}: SEO-137 の比較中の記事`);
    if (p.path.slice(8, 18) > exp.changedOn) assert.ok(excluded.has(p.path), `${p.path}: excludeFromNewArticles に無い`);
  }
  const row = (p, c) => ({ page: `https://nagoya-bites.com/${p}`, impressions: 100, clicks: c, position: 7 });
  const r = expReport({ ...exp, excludeFromNewArticles: [{ path: 'journal/2026-10-20-b.html' }] },
    { pages: [row('journal/2026-10-20-a.html', 5), row('journal/2026-10-20-b.html', 50)] });
  assert.equal(r.new_articles.now.clicks, 5);
});
