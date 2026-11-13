'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const E = require('../scripts/lib/note_eyecatch');

test('見出し画像: 共通の写真（店と関係の無い写真）を持たない。写真が無い日は題と日付だけの図', () => {
  assert.strictEqual(E.pickPhoto, undefined);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'assets', 'note-eyecatch')));
  const h = E.html('栄の店で読む', '2026-10-24');
  assert.match(h, /栄の店で読む/);
  assert.match(h, /2026-10-24/);
  assert.doesNotMatch(h, /<img|url\(|写真はイメージ/);
});

test('見出し画像: PR TIMES の画像は配信元の縮小版を取る（こちらでは加工しない）', () => {
  assert.strictEqual(E.photoUrl('https://prcdn.freetls.fastly.net/release_image/1/2/a.jpg'),
    'https://prcdn.freetls.fastly.net/release_image/1/2/a.jpg?width=1920&quality=85&format=jpeg&fit=bounds');
  // 既に指定のある URL・他の配信元はそのまま
  assert.strictEqual(E.photoUrl('https://prcdn.freetls.fastly.net/a.jpg?width=800'), 'https://prcdn.freetls.fastly.net/a.jpg?width=800');
  assert.strictEqual(E.photoUrl('https://prtimes.jp/i/1/2/a.jpg'), 'https://prtimes.jp/i/1/2/a.jpg');
});

test('見出し画像: 取ってきたものが画像でなければ止める（一時ファイルも残さない）', () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-eyecatch-test-'));
  const jpg = path.join(dir, 'a.jpg'); fs.writeFileSync(jpg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  const txt = path.join(dir, 'a.html'); fs.writeFileSync(txt, '<html>not found</html>');
  const got = E.downloadPhoto('file://' + jpg, 'jpg', dir);
  assert.strictEqual(path.basename(got), 'nb-note-photo-jpg.jpg');
  assert.throws(() => E.downloadPhoto('file://' + txt, 'txt', dir), /画像ではありません/);
  assert.ok(!fs.existsSync(path.join(dir, 'nb-note-photo-txt.jpg')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('見出し画像の検査: 題がラベル・フッターに重なる／はみ出すと不合格', () => {
  const canvas = { top: 0, left: 0, right: 1280, bottom: 670 };
  const label = { top: 64, bottom: 100 }; const footer = { top: 560, bottom: 606 };
  assert.deepStrictEqual(E.inspectEyecatchBoxes({ canvas, label, footer, title: { top: 180, bottom: 400, left: 80, right: 1200 } }), []);
  assert.ok(E.inspectEyecatchBoxes({ canvas, label, footer, title: { top: 180, bottom: 600, left: 80, right: 1200 } }).some((p) => /フッター/.test(p)));
  assert.ok(E.inspectEyecatchBoxes({ canvas, label, footer, title: { top: 90, bottom: 300, left: 80, right: 1200 } }).some((p) => /ラベル/.test(p)));
  assert.ok(E.inspectEyecatchBoxes({ canvas, label, footer, title: { top: 180, bottom: 400, left: 80, right: 1300 } }).some((p) => /はみ出す/.test(p)));
  assert.ok(E.inspectEyecatchBoxes({ canvas, label, footer, title: null }).length > 0);
});

// ── 写真の日: 写真の下に題と日付の帯を足す（写真の画素・フレームは変えない・2026-11-13 / Ondine #1914）────────
const zlib = require('zlib');
function crc32(buf) { let c, crc = ~0; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function pngEncode(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function pngDecode(buf) { // 8bit RGB/RGBA・非インターレース
  let pos = 8; let w, h, ch; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos); const t = buf.toString('latin1', pos + 4, pos + 8); const d = buf.subarray(pos + 8, pos + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 6 ? 4 : 3; } if (t === 'IDAT') idat.push(d); pos += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * ch; const out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) { const v = raw[y * (stride + 1) + 1 + x]; const a = x >= ch ? out[y * stride + x - ch] : 0; const b = y ? out[(y - 1) * stride + x] : 0; const c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let r; if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * stride + x] = r & 255; } }
  return { w, h, ch, data: out };
}

test('見出し画像（写真の日）: 寸法は note の比率に合い、帯は全体の約26%・上の余白あり。写真が全体の幅の60%を切る日は写真だけ', () => {
  const cases = [['横長 16:9', 1920, 1080, true], ['横長 1.91:1', 1600, 837, true], ['横長 2:1', 1600, 800, true], ['4:3', 1600, 1200, false], ['正方形', 1200, 1200, false], ['4:5', 1200, 1500, false]];
  for (const [name, pw, ph, band] of cases) {
    const g = E.photoGeometry(pw, ph);
    if (!band) { assert.strictEqual(g.photoOnly, true, `${name} は写真だけ`); assert.ok(g.fraction < 0.6, name); continue; }
    assert.ok(!g.photoOnly, `${name} は帯が付く`);
    assert.ok(g.fraction >= 0.6, `${name} の写真の幅の割合`);
    assert.ok(Math.abs(g.W / g.H - 1280 / 670) < 0.01, `${name} の比率`);
    assert.ok(Math.abs(g.bandH / g.H - 0.26) < 0.02, `${name} の帯の割合`);
    assert.ok(g.py > 0 && g.px >= 0 && g.px + pw <= g.W && g.bandTop + g.bandH <= g.H, `${name} 写真が上の端に接さず、収まる`);
  }
  assert.ok(!E.photoGeometry(1600, 837).photoOnly, '実写真（1.91:1）は帯が付く');
  const h = E.photoHtml('題', '2026-11-08', 'data:image/png;base64,AA==', E.photoGeometry(1600, 837), 36);
  assert.match(h, /<img src="data:/);
  assert.doesNotMatch(h, /gradient|opacity|filter|object-fit|rgba/); // 写真に影・色・切り抜きを足さない
});

test('見出し画像（写真の日）: 正方形の写真は帯を付けず、写真そのもの（同じファイル）を返す', { timeout: 60000 }, async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-eyecatch-sq-'));
  const rgb = Buffer.alloc(200 * 200 * 3, 120); const src = path.join(dir, 'sq.png'); fs.writeFileSync(src, pngEncode(200, 200, rgb));
  assert.strictEqual(await E.makePhotoEyecatch(src, '題', '2026-11-08', path.join(dir, 'o.png')), src);
  assert.ok(!fs.existsSync(path.join(dir, 'o.png')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('見出し画像（写真の日）: 実際に描いて、写真の領域が元と全画素一致・帯の字が帯に収まる・長い題でも語を割らない', { timeout: 120000 }, async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-eyecatch-photo-'));
  const pw = 800, ph = 420; const rgb = Buffer.alloc(pw * ph * 3);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const i = (y * pw + x) * 3; rgb[i] = (x * 7 + y) & 255; rgb[i + 1] = (y * 5) & 255; rgb[i + 2] = (x * y) & 255; }
  const src = path.join(dir, 'src.png'); fs.writeFileSync(src, pngEncode(pw, ph, rgb));
  const out = path.join(dir, 'out.png');
  const title = '栄・白川公園『圧釜うどん もちり』一人ランチに、大盛り無料とぶっかけ1,100円から';
  await E.makePhotoEyecatch(src, title, '2026-11-08', out);
  const img = pngDecode(fs.readFileSync(out)); const g = E.photoGeometry(pw, ph);
  assert.strictEqual(img.w, g.W); assert.strictEqual(img.h, g.H);
  // 写真の領域の全画素が元と一致
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const o = ((y + g.py) * img.w + x + g.px) * img.ch; const s = (y * pw + x) * 3;
    if (img.data[o] !== rgb[s] || img.data[o + 1] !== rgb[s + 1] || img.data[o + 2] !== rgb[s + 2]) assert.fail(`写真の画素が変わっている (${x},${y})`);
  }
  // 帯: 地の色と違う画素（字）があり、帯の外（写真の左右・上の余白）には字が無い
  const px = (x, y) => { const o = (y * img.w + x) * img.ch; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
  const isGround = (c) => c[0] === 0xf6 && c[1] === 0xf2 && c[2] === 0xea;
  let ink = 0; for (let y = g.bandTop; y < g.bandTop + g.bandH; y++) for (let x = g.px; x < g.px + pw; x++) if (!isGround(px(x, y))) ink++;
  assert.ok(ink > 500, '帯に題と日付が描かれている');
  let stray = 0; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const inPhoto = x >= g.px && x < g.px + pw && y >= g.py && y < g.py + ph; const inBand = y >= g.py + ph && y < g.bandTop + g.bandH; if (!inPhoto && !inBand && !isGround(px(x, y))) stray++; }
  assert.strictEqual(stray, 0, '帯の外（余白）に字がはみ出さない');
  fs.rmSync(dir, { recursive: true, force: true });
});
