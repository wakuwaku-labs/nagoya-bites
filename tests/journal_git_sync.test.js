'use strict';
// ISSUE-187: 日次ジャーナルの「origin/main を取り込む」処理（scripts/lib/journal_git_sync.sh）。
// 2026-10-10、ローカル main が squash マージ済みの内容を別の履歴の形で抱えていて
// `git pull --rebase` が衝突し、その日の記事が出なかった。再現して、merge で取り込めること、
// 本当に衝突するときでも rebase / merge の進行中状態を残さないことを確かめる。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const LIB = path.join(__dirname, '..', 'scripts', 'lib', 'journal_git_sync.sh');
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function write(cwd, name, body) { fs.writeFileSync(path.join(cwd, name), body); }
function commit(cwd, msg) { git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', msg); }

// origin（bare）・ローカル L・もう1つの作業コピー O（origin 側の変更を作る用）
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jsync-'));
  const bare = path.join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', bare);
  const L = path.join(root, 'L');
  const O = path.join(root, 'O');
  git(root, 'clone', '-q', bare, L);
  git(L, 'checkout', '-q', '-b', 'main');
  write(L, 'base.txt', 'base\n');
  commit(L, 'base');
  git(L, 'push', '-q', 'origin', 'main');
  git(root, 'clone', '-q', bare, O);
  return { root, bare, L, O };
}

function runSync(cwd) {
  const logFile = path.join(cwd, '..', 'sync.log');
  const script = `LOG='${logFile}'; log() { echo "$*" >>"$LOG"; }; . '${LIB}'; journal_sync_origin_main`;
  const r = spawnSync('bash', ['-c', script], { cwd, env: ENV, encoding: 'utf8' });
  return { status: r.status, log: fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '' };
}
const inProgress = (cwd) => {
  const gd = path.join(cwd, '.git');
  return ['rebase-merge', 'rebase-apply', 'MERGE_HEAD'].filter((n) => fs.existsSync(path.join(gd, n)));
};

test('履歴の形が違うだけ（squash 済み）の分岐は rebase で衝突しても merge で取り込める', () => {
  const { L, O } = setup();
  // ローカル: ブランチの履歴をそのまま持つ（a.txt が A1 → A2 と育つ）
  write(L, 'a.txt', 'A1\n'); commit(L, 'feature 1');
  write(L, 'a.txt', 'A2\n'); commit(L, 'feature 2');
  // origin: 同じ内容が squash の1コミットで入っている
  write(O, 'a.txt', 'A2\n'); commit(O, 'squash: feature (#1)');
  write(O, 'other.txt', 'ci\n'); commit(O, 'chore: ci');
  git(O, 'push', '-q', 'origin', 'main');

  // 前提の確認: 素の pull --rebase はこの状況で衝突する（これが 10/10 の故障）
  const probe = spawnSync('git', ['pull', '--rebase', 'origin', 'main'], { cwd: L, env: ENV, encoding: 'utf8' });
  assert.notStrictEqual(probe.status, 0, '前提: rebase は衝突するはず');
  git(L, 'rebase', '--abort');

  const r = runSync(L);
  assert.strictEqual(r.status, 0, r.log);
  assert.deepStrictEqual(inProgress(L), []);
  assert.strictEqual(fs.readFileSync(path.join(L, 'a.txt'), 'utf8'), 'A2\n');
  assert.strictEqual(fs.readFileSync(path.join(L, 'other.txt'), 'utf8'), 'ci\n');
  assert.match(r.log, /merge で取り込み/);
  // origin の先端が取り込まれ、続けて push できる（fast-forward）
  git(L, 'push', '-q', 'origin', 'main');
});

test('通常ケース（衝突なし）は rebase で取り込み、履歴は直線のまま', () => {
  const { L, O } = setup();
  write(L, 'mine.txt', 'm\n'); commit(L, 'local only');
  write(O, 'theirs.txt', 't\n'); commit(O, 'remote only');
  git(O, 'push', '-q', 'origin', 'main');
  const r = runSync(L);
  assert.strictEqual(r.status, 0, r.log);
  assert.strictEqual(git(L, 'rev-list', '--merges', '--count', 'HEAD'), '0');
  assert.doesNotMatch(r.log, /merge で取り込み/);
});

test('本当に衝突するときは失敗を返し、rebase / merge の進行中状態を残さない', () => {
  const { L, O } = setup();
  write(L, 'base.txt', 'local edit\n'); commit(L, 'local edit');
  write(O, 'base.txt', 'remote edit\n'); commit(O, 'remote edit');
  git(O, 'push', '-q', 'origin', 'main');
  const r = runSync(L);
  assert.notStrictEqual(r.status, 0);
  assert.deepStrictEqual(inProgress(L), []);
  assert.strictEqual(git(L, 'ls-files', '--unmerged'), '');
  assert.strictEqual(fs.readFileSync(path.join(L, 'base.txt'), 'utf8'), 'local edit\n');
});
