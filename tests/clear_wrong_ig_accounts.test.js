'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { plan, apply } = require('../scripts/clear_wrong_ig_accounts');

const reviewed = { entries: [{ id: 'J1', handle: 'kacchan_sakae', decision: 'remove' }, { id: 'J2', handle: 'x', decision: 'remove' }, { id: 'J3', handle: 'y', decision: 'keep' }] };
test('記録と同じアカウントのときだけ外す・keep は触らない', () => {
  const resolved = { J1: { instagram: 'https://www.instagram.com/kacchan_sakae/' }, J2: { instagram: 'https://www.instagram.com/changed/' }, J3: { instagram: 'https://www.instagram.com/y/' } };
  const posts = { J1: { postUrl: 'p' }, J3: { postUrl: 'q' } };
  const p = plan(resolved, reviewed);
  assert.deepStrictEqual(p.todo.map((e) => e.id), ['J1']);
  assert.strictEqual(apply(resolved, posts, reviewed, 'T'), 1);
  assert.strictEqual(resolved.J1.instagram, '');
  assert.strictEqual(resolved.J1.failed, true);
  assert.strictEqual(resolved.J1.rejectedInstagram, 'https://www.instagram.com/kacchan_sakae/');
  assert.ok(!posts.J1 && posts.J3);
  assert.strictEqual(resolved.J2.instagram, 'https://www.instagram.com/changed/');
});
test('冪等: 2回目は外す対象が無い', () => {
  const resolved = { J1: { instagram: 'https://www.instagram.com/kacchan_sakae/' } };
  apply(resolved, {}, reviewed, 'T');
  assert.strictEqual(plan(resolved, reviewed).todo.length, 0);
});
