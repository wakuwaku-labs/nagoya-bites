'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { usableImageUrl, jsonLdImageUrl, dropEmptyImageLine, addImage } = require('../scripts/lib/schema_image');

const page = (og, ld) => `<head><meta property="og:image" content="${og}"><script type="application/ld+json">${ld}</script></head>`;
const LD = '{\n  "@type": "BlogPosting",\n  "datePublished": "2026-11-01",\n  "dateModified": "2026-11-01"\n}';

test('アイコン・Places・相対パスは image に使わない', () => {
  assert.strictEqual(usableImageUrl('https://nagoya-bites.com/icons/icon-512.png'), null);
  assert.strictEqual(usableImageUrl('https://lh3.googleusercontent.com/p/abc'), null);
  assert.strictEqual(usableImageUrl('../x.png'), null);
  assert.strictEqual(usableImageUrl('https://imgfp.hotp.jp/a.jpg'), 'https://imgfp.hotp.jp/a.jpg');
});

test('addImage は og:image が使えるときだけ足し、冪等', () => {
  const r = addImage(page('https://imgfp.hotp.jp/a.jpg', LD));
  assert.ok(r.changed);
  const j = JSON.parse(r.html.match(/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(j.image, 'https://imgfp.hotp.jp/a.jpg');
  assert.strictEqual(addImage(r.html).changed, false);
  assert.strictEqual(addImage(page('https://nagoya-bites.com/icons/icon-512.png', LD)).changed, false);
});

test('日次テンプレートは JSON として正しく、画像が無い日は image の行が消える', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'journal', '_template.html'), 'utf8');
  assert.ok(t.includes('"image": "{{LD_IMAGE_URL}}",'));
  const ld = (u) => dropEmptyImageLine(t.split('{{LD_IMAGE_URL}}').join(u)).match(/ld\+json">\s*([\s\S]*?)<\/script>/)[1].replace(/\{\{[A-Z_]+\}\}/g, 'x');
  assert.strictEqual(JSON.parse(ld(jsonLdImageUrl('https://imgfp.hotp.jp/a.jpg'))).image, 'https://imgfp.hotp.jp/a.jpg');
  assert.strictEqual('image' in JSON.parse(ld(jsonLdImageUrl('https://nagoya-bites.com/icons/icon-512.png'))), false);
});
