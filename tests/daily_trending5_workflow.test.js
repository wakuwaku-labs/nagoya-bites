'use strict';
// P-269: 毎朝の「今日の話題店TOP5」ワークフローは、build.js の後に写真の原寸昇格を回してからコミットする。
//
// build.js は HotPepper の写真を _480 に揃えるだけで、原寸への昇格（scripts/promote_store_photos.js）は
// 1件ずつの実測に基づいて別に行う。daily-trending5.yml が昇格をしないと、毎朝 約3,400店の写真を
// _480 に戻した data/stores.json と index.html をコミットする（直近3回の実測: 3,349〜3,421店）。
// このコミットは GITHUB_TOKEN の push なので build.yml を起動せず、次の push か 03:00 JST の定期実行まで
// 本番の写真が小さいまま残る。ワークフローの順を、ここで固定する。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'daily-trending5.yml'), 'utf8');
const LINES = SRC.split('\n');

// コメント行を除いた、その run の行番号（0 始まり）。無ければ -1
function runLine(re) {
  return LINES.findIndex((l) => !/^\s*#/.test(l) && /^\s*run:\s/.test(l) && re.test(l));
}
function nameLine(re) {
  return LINES.findIndex((l) => /^\s*-\s+name:\s/.test(l) && re.test(l));
}

test('写真の原寸昇格は、build.js の後・コミットの前に回す', () => {
  const build = runLine(/node build\.js/);
  const promote = runLine(/node scripts\/promote_store_photos\.js/);
  const commit = nameLine(/変更をコミット/);
  assert.ok(build >= 0, 'build.js のステップが見つからない');
  assert.ok(promote >= 0, 'promote_store_photos.js のステップが無い（写真を _480 に戻したままコミットする）');
  assert.ok(commit >= 0, 'コミットのステップが見つからない');
  assert.ok(build < promote, '昇格は build.js より後に置く（build.js が写真を _480 に揃えるため）');
  assert.ok(promote < commit, '昇格はコミットより前に置く（昇格の結果をコミットに載せる）');
});

test('昇格は失敗しても話題店の更新を止めない（build.yml と同じ continue-on-error）', () => {
  const promote = runLine(/node scripts\/promote_store_photos\.js/);
  assert.ok(promote >= 0);
  let ok = false;
  for (let i = promote + 1; i < LINES.length && !/^\s*-\s+name:/.test(LINES[i]); i++) {
    if (/^\s*continue-on-error:\s*true\s*$/.test(LINES[i])) { ok = true; break; }
  }
  assert.ok(ok, 'promote_store_photos.js のステップに continue-on-error: true が無い（通信失敗で TOP5 の更新まで止まる）');
});

test('昇格が書き換えるファイル（data/stores.json・index.html）は、コミットの対象に入っている', () => {
  // promote_store_photos.js が書くのは data/stores.json と index.html。ここが外れると昇格が空振りになる
  const add = LINES.filter((l) => !/^\s*#/.test(l)).join('\n');
  const gitAdd = add.slice(add.indexOf('git add'));
  assert.ok(/data\/stores\.json/.test(gitAdd), 'git add に data/stores.json が無い');
  assert.ok(/(^|\s)index\.html(\s|\\|$)/m.test(gitAdd), 'git add に index.html が無い');
});

test('build.yml の昇格のステップと同じスクリプトを、引数なしで回している', () => {
  // build.yml と違う引数（--dry-run / --check）にすると、書き換えない・落ちるだけで昇格にならない
  const promote = runLine(/node scripts\/promote_store_photos\.js/);
  assert.ok(promote >= 0);
  assert.match(LINES[promote], /run:\s*node scripts\/promote_store_photos\.js\s*$/, '引数なしで回す');
  const build = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build.yml'), 'utf8');
  assert.match(build, /run:\s*node scripts\/promote_store_photos\.js\s*$/m, 'build.yml の昇格が変わっているなら、ここも見直す');
});
