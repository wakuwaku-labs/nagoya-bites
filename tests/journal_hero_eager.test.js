const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { patchHtml } = require('../scripts/patch_journal_hero_eager.js');

const dir = path.join(__dirname, '..', 'journal');
const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-.*\.html$/.test(f));

test('日次記事の1枚目（ヒーロー枠）は遅延読み込みでなく fetchpriority=high', () => {
  let checked = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = html.match(/<(?:figure\s+class="art-hero-img"[^>]*|div\s+class="hero-image"[^>]*)>\s*(<img\b[^>]*>)/);
    if (!m) continue;
    checked++;
    assert.ok(!/loading="lazy"/.test(m[1]), `${f}: 1枚目が lazy`);
    assert.ok(/fetchpriority="high"/.test(m[1]), `${f}: fetchpriority 無し`);
  }
  assert.ok(checked > 100);
});

test('2枚目以降は変えない・変換はべき等', () => {
  const src = '<figure class="art-hero-img">\n  <img src="a.jpg" alt="x" loading="lazy" decoding="async">\n</figure><img src="b.jpg" alt="y" loading="lazy">';
  const once = patchHtml(src);
  assert.match(once, /src="a.jpg"[^>]*loading="eager"[^>]*fetchpriority="high"/);
  assert.match(once, /src="b.jpg" alt="y" loading="lazy">/);
  assert.strictEqual(patchHtml(once), once);
});

test('ヒーロー枠の外の1枚目は触らない', () => {
  const src = '<p>x</p><img src="a.jpg" alt="x" loading="lazy">';
  assert.strictEqual(patchHtml(src), src);
});

test('生成の元（日次の下書き生成）も1枚目を eager にしている', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'generate_daily_draft.js'), 'utf8');
  assert.match(js, /<figure class="art-hero-img"[\s\S]{0,80}loading="eager" decoding="async" fetchpriority="high"/);
});
