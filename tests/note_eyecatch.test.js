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
