'use strict';
// SEO-131: 掲載店の入れ替えで本文が変わった日を、特集の JSON-LD の dateModified に書く
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { touchDateModified } = require(path.join(__dirname, '..', 'scripts', 'refresh_feature_rosters.js'));

const LD = (body) => `<script type="application/ld+json">${body}</script>`;

test('JSON-LD の dateModified だけを、その日の日付に進める（空白の有無どちらも）', () => {
  const html = LD('{"datePublished":"2025-04-15","dateModified":"2026-05-08"}')
    + LD('{\n  "dateModified": "2026-05-22"\n}')
    + '<p>"dateModified": "2020-01-01"</p>';
  const out = touchDateModified(html, '2026-10-09');
  assert.ok(out.includes('"dateModified":"2026-10-09"'));
  assert.ok(out.includes('"dateModified": "2026-10-09"'));
  assert.ok(out.includes('"datePublished":"2025-04-15"'), '公開日は変えない');
  assert.ok(out.includes('<p>"dateModified": "2020-01-01"</p>'), 'JSON-LD の外は変えない');
});

test('今より新しい日付は戻さない・dateModified が無ければ足さない', () => {
  const later = LD('{"dateModified":"2026-12-01"}');
  assert.equal(touchDateModified(later, '2026-10-09'), later);
  const none = LD('{"datePublished":"2025-04-15"}');
  assert.equal(touchDateModified(none, '2026-10-09'), none);
});
