'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const stores = fs.readdirSync(path.join(ROOT, 'stores')).filter(f => f.endsWith('.html'));

test('旧形式の店舗ページ: 転送・案内だけのページ以外は、すべてクレジットがある', () => {
  const missing = stores.filter(f => {
    const h = fs.readFileSync(path.join(ROOT, 'stores', f), 'utf8');
    return !h.includes('webservice.recruit.co.jp') && !/http-equiv="refresh"/i.test(h) && !h.includes('nb-orphan-notice:');
  });
  assert.deepStrictEqual(missing, []);
});

test('旧形式: HP の画像を表示するページだけ画像提供の表記がある', () => {
  for (const f of stores) {
    const h = fs.readFileSync(path.join(ROOT, 'stores', f), 'utf8');
    if (!h.includes('webservice.recruit.co.jp') || h.includes('NB-CHROME:FOOTER:START')) continue;
    const foot = h.indexOf('<footer>');
    const usesImage = /imgfp\.hotp\.jp/.test(h.slice(0, foot));
    assert.strictEqual(h.includes('【画像提供：ホットペッパー グルメ】'), usesImage, f);
  }
});

test('add_hp_credit_legacy: 再実行しても変更なし（べき等）・エラーなし', () => {
  const out = execFileSync('node', [path.join(ROOT, 'scripts/add_hp_credit_legacy.js'), '--check'], { encoding: 'utf8' });
  assert.match(out, /要変更=0 エラー=0/);
});
