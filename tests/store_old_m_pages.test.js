'use strict';
// P-445: 古い店舗ページ（stores/M0000xx.html）に、押しても開かない口コミ導線（#store=…&review=1）を残さない。
// index.html は review= を読まないため、この導線は押しても何も起きない。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'stores');
const files = fs.readdirSync(dir).filter((f) => /^M\d+\.html$/.test(f));

test('古い M ページに review=1 の導線が無い', () => {
  assert.ok(files.length > 0);
  const bad = files.filter((f) => /[?&#]review=1/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepStrictEqual(bad, []);
});

test('掲載外の案内にした M000006・M000058 は noindex で、canonical を持たない', () => {
  for (const f of ['M000006.html', 'M000058.html']) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(h, /<meta name="robots" content="noindex">/);
    assert.match(h, /nb-orphan-notice:/);
    assert.doesNotMatch(h, /canonical/);
  }
});
