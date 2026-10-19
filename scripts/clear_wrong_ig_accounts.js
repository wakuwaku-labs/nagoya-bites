#!/usr/bin/env node
'use strict';
/**
 * 別の支店・別の店と確かめた Instagram アカウントを外す（ISSUE-165・P-169）。
 *   node scripts/clear_wrong_ig_accounts.js --dry-run   # 対象だけ表示
 *   node scripts/clear_wrong_ig_accounts.js             # 反映（冪等）
 *   node scripts/clear_wrong_ig_accounts.js --check     # 記録の組がまだ表示中なら exit 1（通信しない）
 * 記録: data/ig_account_reviewed.json（decision=remove の店IDごと・アカウントが記録と同じときだけ外す）。
 * instagram_resolved.json の該当を failed 化（元のURLは rejectedInstagram に残す・戻すときはそこから）、
 * instagram_posts.json の埋め込み投稿も外す。build.js が次のビルドで店舗データ・店舗ページから消す。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'data', 'instagram_resolved.json');
const POSTS = path.join(ROOT, 'data', 'instagram_posts.json');
const REV = path.join(ROOT, 'data', 'ig_account_reviewed.json');

function handleOf(url) { return String(url || '').replace(/\/+$/, '').split('/').pop().toLowerCase(); }

function plan(resolved, reviewed) {
  const todo = [], done = [];
  for (const e of reviewed.entries || []) {
    if (e.decision !== 'remove') continue;
    const r = resolved[e.id];
    if (r && r.instagram && handleOf(r.instagram) === String(e.handle).toLowerCase()) todo.push(e);
    else done.push(e);
  }
  return { todo, done };
}

function apply(resolved, posts, reviewed, nowIso) {
  const { todo } = plan(resolved, reviewed);
  for (const e of todo) {
    const r = resolved[e.id];
    r.rejectedInstagram = r.instagram;
    r.instagram = '';
    r.failed = true;
    r.failedBy = 'tabelog'; // resolve_instagram_via_tabelog.js が再試行しない印
    r.rejectReason = 'ISSUE-165: 別の支店のアカウント';
    r.rejectedAt = nowIso;
    if (posts && posts[e.id]) delete posts[e.id];
  }
  return todo.length;
}

module.exports = { plan, apply, handleOf };

if (require.main === module) {
  const args = process.argv.slice(2);
  const resolved = JSON.parse(fs.readFileSync(RES, 'utf8'));
  const posts = JSON.parse(fs.readFileSync(POSTS, 'utf8'));
  const reviewed = JSON.parse(fs.readFileSync(REV, 'utf8'));
  const { todo, done } = plan(resolved, reviewed);
  console.log(`外す対象 ${todo.length} 件 / 外し済み・変更済み ${done.length} 件`);
  if (args.includes('--check')) process.exit(todo.length ? 1 : 0);
  if (args.includes('--dry-run')) { todo.slice(0, 10).forEach((e) => console.log(`  ${e.storeName} ← ${e.handle}`)); process.exit(0); }
  const n = apply(resolved, posts, reviewed, new Date().toISOString());
  fs.writeFileSync(RES, JSON.stringify(resolved, null, 2) + '\n');
  fs.writeFileSync(POSTS, JSON.stringify(posts, null, 2) + '\n');
  console.log(`外しました: ${n} 件`);
}
