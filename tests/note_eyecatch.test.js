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

// ── 写真の日: 写真を全面に敷き、下部の影に題と日付を重ねる（2026-11-13 本人の指示・ADR 0065）────────
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

test('見出し画像（写真の日）: 題を重ねてよいのは PR TIMES の写真だけ', () => {
  assert.ok(E.overlayAllowed('https://prcdn.freetls.fastly.net/release_image/1/2/a.jpg'));
  assert.ok(E.overlayAllowed('https://prtimes.jp/i/1/2/a.jpg'));
  assert.ok(!E.overlayAllowed('https://imgfp.hotp.jp/IMGH/12/34/a.jpg'), 'ホットペッパー');
  assert.ok(!E.overlayAllowed('https://maps.googleapis.com/maps/api/place/photo?x=1'), 'Google');
  assert.ok(!E.overlayAllowed('https://evil-prtimes.jp/a.jpg'), '似た名前のホスト');
  assert.ok(!E.overlayAllowed('not a url'));
});

test('見出し画像（写真の日）: 全面（1280x670）に敷く。縦長・正方形より細い写真と、小さすぎる写真は写真だけ', () => {
  const cases = [['16:9', 1920, 1080, true], ['1.91:1', 1600, 837, true], ['4:3', 1600, 1200, true], ['3:2', 1500, 1000, true], ['正方形', 1200, 1200, true], ['4:5', 1200, 1500, false], ['9:16', 1080, 1920, false], ['横に細長い 4:1', 2400, 600, false], ['小さい 16:9', 600, 338, false], ['小さい 4:3', 640, 480, true]];
  for (const [name, pw, ph, overlay] of cases) {
    const g = E.photoGeometry(pw, ph);
    assert.strictEqual(!g.photoOnly, overlay, `${name}: ${overlay ? '重ねる' : '写真だけ'}（keep=${g.keep.toFixed(2)} srcW=${Math.round(g.srcW)}）`);
    if (overlay) { assert.strictEqual(g.W, 1280); assert.strictEqual(g.H, 670); assert.ok(g.keep >= 0.5 && g.keep <= 1); }
  }
  const h = E.photoHtml('栄・白川公園『圧釜うどん もちり』', '2026-11-08', 'data:image/png;base64,AA==', 48);
  assert.match(h, /<img src="data:/);
  assert.match(h, /object-fit:cover/); // 比率合わせの切り抜きだけ
  assert.match(h, /linear-gradient\(180deg/); // 下部の暗い影
  assert.match(h, /NAGOYA BITES JOURNAL/); assert.match(h, /2026-11-08 ／ 名古屋の飲食店ジャーナル/);
  assert.match(h, /Hiragino Mincho ProN/); // 題は明朝
  assert.doesNotMatch(h, /filter|mix-blend|saturate|hue-rotate|sepia|grayscale/); // 写真の色は変えない
});

test('見出し画像（写真の日）: 2行に分けるなら真ん中に近い「、」の後で折る形を先に試す', () => {
  const t = '名駅『鎌倉紅谷』クルミッ子が常設に、バターのいとこも 手土産は予算で';
  assert.strictEqual(E.commaBreak(t), t.indexOf('、') + 1);
  assert.strictEqual(E.commaBreak('読点の無い題'), -1);
  assert.strictEqual(E.commaBreak('末尾だけ、'), -1);
  const h = E.titleHtml(t, E.commaBreak(t));
  const parts = h.split('<br>').map((x) => x.replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(parts, ['名駅『鎌倉紅谷』クルミッ子が常設に、', 'バターのいとこも 手土産は予算で']);
});

test('見出し画像（写真の日）: 縦長の写真は重ねず、写真そのもの（同じファイル）を返す', { timeout: 60000 }, async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-eyecatch-tall-'));
  const rgb = Buffer.alloc(400 * 700 * 3, 120); const src = path.join(dir, 'tall.png'); fs.writeFileSync(src, pngEncode(400, 700, rgb));
  assert.strictEqual(await E.makePhotoEyecatch(src, '題', '2026-11-08', path.join(dir, 'o.png')), src);
  assert.ok(!fs.existsSync(path.join(dir, 'o.png')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('見出し画像（写真の日）: 実際に描いて、1280x670・影の無い中ほどは写真の色のまま・下部は暗く白い字が載る・長い題も2行で語を割らない', { timeout: 120000 }, async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-eyecatch-photo-'));
  const pw = 1600, ph = 900; const C = [200, 120, 60]; const rgb = Buffer.alloc(pw * ph * 3);
  for (let i = 0; i < pw * ph; i++) { rgb[i * 3] = C[0]; rgb[i * 3 + 1] = C[1]; rgb[i * 3 + 2] = C[2]; }
  const src = path.join(dir, 'src.png'); fs.writeFileSync(src, pngEncode(pw, ph, rgb));
  const out = path.join(dir, 'out.png');
  const title = '栄・白川公園『圧釜うどん もちり』一人ランチに、大盛り無料とぶっかけ1,100円から';
  assert.strictEqual(await E.makePhotoEyecatch(src, title, '2026-11-08', out), out);
  const img = pngDecode(fs.readFileSync(out));
  assert.strictEqual(img.w, 1280); assert.strictEqual(img.h, 670);
  const px = (x, y) => { const o = (y * img.w + x) * img.ch; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
  // 影の無い中ほど（高さの 24〜43%）は、写真の色そのまま（±1）
  for (let y = Math.ceil(670 * 0.24); y < Math.floor(670 * 0.43); y += 3) for (let x = 0; x < 1280; x += 7) {
    const c = px(x, y); if (c.some((v, k) => Math.abs(v - C[k]) > 1)) assert.fail(`写真の色が変わっている (${x},${y}) ${c}`);
  }
  // 下の端は影で暗い。題の行あたりに白い字がある。左右の端（56px の外）の下部に字が無い
  const bottom = px(640, 668); assert.ok(bottom[0] < C[0] * 0.4, '下部が暗い');
  let white = 0; for (let y = 430; y < 640; y++) for (let x = 56; x < 1224; x++) { const c = px(x, y); if (c[0] > 230 && c[1] > 230 && c[2] > 230) white++; }
  assert.ok(white > 3000, `題と日付が白で載っている (${white})`);
  let label = 0; for (let y = 40; y < 80; y++) for (let x = 56; x < 600; x++) { const c = px(x, y); if (c[0] > 230 && c[1] > 230 && c[2] > 230) label++; }
  assert.ok(label > 200, '上にラベルが載っている');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('見出し画像（写真の日）: 題が2行に収まらないときは例外（呼び出し側は写真そのままに落とす）', { timeout: 120000 }, async () => {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-eyecatch-long-'));
  const rgb = Buffer.alloc(1600 * 900 * 3, 90); const src = path.join(dir, 'src.png'); fs.writeFileSync(src, pngEncode(1600, 900, rgb));
  const long = '名駅・柳橋中央市場の路地裏で朝から開く海鮮丼と天ぷらの店に、仕事前の一人朝ごはんと週末の家族連れの昼ごはんで寄る理由と、行列を避ける時間帯と予約の取り方の全部';
  await assert.rejects(E.makePhotoEyecatch(src, long, '2026-11-08', path.join(dir, 'o.png')), /2行に収まらない|はみ出す|重なる/);
  assert.ok(!fs.existsSync(path.join(dir, 'o.png')));
  fs.rmSync(dir, { recursive: true, force: true });
});
