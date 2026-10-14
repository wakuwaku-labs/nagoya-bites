'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { namesMatch } = require('../scripts/lib/hero_photo_gate');

test('core() が1文字に縮む店名が、「の」を含む無関係な店名に包含一致しない', () => {
  assert.strictEqual(namesMatch('天ぷらの浜金ハエラ栄店', 'ひものや 官兵衛 伏見駅店', 0.85), false);
  assert.strictEqual(namesMatch('天ぷらの浜金ハエラ栄店', 'ひものや 官兵衛', 0.85), false);
});

test('同じ屋号の支店表記ゆれは引き続き一致する', () => {
  assert.strictEqual(namesMatch('ひものや 官兵衛 伏見駅店', 'ひものや 官兵衛', 0.85), true);
  assert.strictEqual(namesMatch('ひものや 官兵衛', 'ひものや 官兵衛', 0.85), true);
});
