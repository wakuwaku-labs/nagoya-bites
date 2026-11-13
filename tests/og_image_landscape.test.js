'use strict';
// K5（2026-11-13）: og:image が正方形のサイトアイコンになり、X のリンクカードでロゴの丸が切れる問題の再発防止。
// 既定の画像は 1200x630（1.91:1）の icons/og-default.png。ページの og:image はアイコンではなく、寸法を宣言しているなら横長。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.claude', '.agents', '_site']);

function walkHtml(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.name.endsWith('.html') && !e.name.startsWith('_')) out.push(p);
  }
  return out;
}
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, '&') : null;
};

test('既定の og:image（icons/og-default.png）は 1200x630 の横長 PNG', () => {
  const buf = fs.readFileSync(path.join(ROOT, 'icons', 'og-default.png'));
  assert.strictEqual(buf.readUInt32BE(0), 0x89504e47);
  const w = buf.readUInt32BE(16); const h = buf.readUInt32BE(20);
  assert.deepStrictEqual([w, h], [1200, 630]);
  assert.ok(Math.abs(w / h - 1.91) < 0.02);
});

test('生成の既定の og:image はアイコンではなく横長の既定画像（日次・特集・エリア・期限切れ写真の差し替え）', () => {
  for (const f of ['scripts/generate_daily_draft.js', 'scripts/gen_industry_features.js', 'scripts/gen_area_genre_pages.js', 'scripts/lib/expired_place_photos.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(s.includes('icons/og-default.png'), `${f} が既定の横長画像を指す`);
    assert.ok(!/og:image"[^>]*icon-512\.png/.test(s), `${f} が og:image にアイコンを使わない`);
  }
});

test('全ページ: og:image / twitter:image がサイトのアイコン（icon-*.png）になっていない', () => {
  const bad = [];
  let n = 0;
  for (const f of walkHtml(ROOT)) {
    const html = fs.readFileSync(f, 'utf8');
    for (const prop of ['og:image', 'twitter:image']) {
      const u = meta(html, prop);
      if (u === null) continue;
      n++;
      if (/\/icons\/icon-\d+\.png/.test(u)) bad.push(`${path.relative(ROOT, f)} ${prop}`);
    }
  }
  assert.ok(n > 0);
  assert.deepStrictEqual(bad.slice(0, 10), [], `アイコンの og:image が ${bad.length} ページ`);
});

test('全ページ: og:image:width/height を宣言しているなら正方形・縦長ではない（横長）。トップ・一覧は 1200x630', () => {
  const bad = [];
  for (const f of walkHtml(ROOT)) {
    const html = fs.readFileSync(f, 'utf8');
    const w = Number(meta(html, 'og:image:width')); const h = Number(meta(html, 'og:image:height'));
    if (w && h && w / h < 1.3) bad.push(`${path.relative(ROOT, f)} ${w}x${h}`);
  }
  assert.deepStrictEqual(bad.slice(0, 10), [], `横長でない og:image 寸法が ${bad.length} ページ`);
  for (const f of ['index.html', 'journal/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(meta(html, 'og:image'), /og-default\.png$|\/assets\/.+\.png$/, `${f} の og:image`);
    assert.strictEqual(meta(html, 'og:image:width') + 'x' + meta(html, 'og:image:height'), '1200x630', `${f} の寸法`);
  }
});
