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

// ---- Ondine #2338: ローカル main にだけある「よその」コミットを退避して記事を止めない ----
function runQuarantine(cwd) {
  const logFile = path.join(cwd, '..', 'q.log');
  // 本番（run_journal_local.sh）と同じ set -u で、macOS の /bin/bash 3.2 で動かす（2026-11-22 は空の配列の展開で落ちた）
  const script = `set -u; LOG='${logFile}'; log() { echo "$*" >>"$LOG"; }; . '${LIB}'; git fetch -q origin main;
journal_quarantine_foreign_commits; rc=$?
echo "rc=$rc"; echo "branch=$JOURNAL_QUARANTINE_BRANCH"; echo "dropped=$JOURNAL_QUARANTINE_DROPPED"
printf '%s' "$JOURNAL_QUARANTINE_FOREIGN" | sed 's/^/foreign=/'`;
  const r = spawnSync(fs.existsSync('/bin/bash') ? '/bin/bash' : 'bash', ['-c', script], { cwd, env: ENV, encoding: 'utf8' });
  const out = r.stdout;
  const get = (k) => (out.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1];
  return {
    rc: Number(get('rc')), branch: get('branch') || '', dropped: Number(get('dropped')),
    foreign: [...out.matchAll(/^foreign=(.*)$/gm)].map((m) => m[1]),
    log: fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '',
  };
}
function commitAs(cwd, msg, email) {
  git(cwd, 'add', '-A');
  const r = spawnSync('git', ['commit', '-q', '-m', msg], {
    cwd, encoding: 'utf8', env: { ...ENV, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_NAME: 'NAGOYA BITES Daily' },
  });
  assert.strictEqual(r.status, 0, r.stderr);
}

test('11/20 の型: ブランチのローカル合流と直接コミットは退避し、main は origin/main に合い、取り込みも通る', () => {
  const { L, O } = setup();
  // よその会話: 作業ブランチを main へローカル合流 + main へ直接コミット（どちらも origin に無い）
  git(L, 'checkout', '-q', '-b', 'fix/x');
  write(L, 'base.txt', 'branch edit\n'); commit(L, 'fix: branch');
  git(L, 'checkout', '-q', 'main');
  git(L, 'merge', '-q', '--no-ff', '--no-edit', 'fix/x');
  write(L, 'store.json', 'local fix\n'); commit(L, 'fix: direct on main');
  // ジャーナル自身の状態記録（作者 daily）
  fs.mkdirSync(path.join(L, 'data'), { recursive: true });
  write(L, 'data/journal_health.json', '{"status":"hold"}\n');
  commitAs(L, 'chore(journal): 状態を記録', 'daily@nagoya-bites');
  const before = git(L, 'rev-parse', 'HEAD');
  // origin 側は同じファイルを別に直している（ローカルのままだと取り込みが衝突する）
  write(O, 'base.txt', 'remote edit\n'); commit(O, 'remote edit');
  git(O, 'push', '-q', 'origin', 'main');

  const q = runQuarantine(L);
  assert.strictEqual(q.rc, 0, q.log);
  assert.match(q.branch, /^backup\/main-\d{8}-\d{6}$/);
  // 退避先は元の main の先端そのもの（何も失わない）
  assert.strictEqual(git(L, 'rev-parse', q.branch), before);
  // よその3つ（ブランチのコミット・合流・直接コミット）を数え、ジャーナル自身のものは数えない
  assert.strictEqual(q.foreign.length, 3, q.foreign.join('\n'));
  assert.ok(q.foreign.every((l) => !/状態を記録/.test(l)));
  // main は origin/main + ジャーナル自身のコミット1つ
  assert.strictEqual(git(L, 'branch', '--show-current'), 'main');
  assert.strictEqual(git(L, 'rev-list', '--count', 'origin/main..main'), '1');
  assert.strictEqual(git(L, 'log', '-1', '--format=%s'), 'chore(journal): 状態を記録');
  assert.strictEqual(fs.readFileSync(path.join(L, 'base.txt'), 'utf8'), 'remote edit\n');
  assert.ok(!fs.existsSync(path.join(L, 'store.json')));
  assert.deepStrictEqual(inProgress(L), []);
  // 続く取り込み・push が通る（HOLD にならない）
  assert.strictEqual(runSync(L).status, 0);
  git(L, 'push', '-q', 'origin', 'main');
});

test('11/22 の型: よそのコミットだけ（ジャーナル自身のコミットが0件）でも set -u で落ちずに退避する', () => {
  const { L, O } = setup();
  write(L, 'store.json', 'local fix\n'); commit(L, 'fix: direct on main');
  write(L, 'base.txt', 'local edit 2\n'); commit(L, 'fix: another direct');
  const before = git(L, 'rev-parse', 'HEAD');
  write(O, 'base.txt', 'remote edit\n'); commit(O, 'remote edit');
  git(O, 'push', '-q', 'origin', 'main');

  const q = runQuarantine(L);
  assert.strictEqual(q.rc, 0, q.log);
  assert.match(q.branch, /^backup\/main-\d{8}-\d{6}$/);
  assert.strictEqual(git(L, 'rev-parse', q.branch), before);
  assert.strictEqual(q.foreign.length, 2, q.foreign.join('\n'));
  assert.strictEqual(git(L, 'rev-list', '--count', 'origin/main..main'), '0');
  assert.match(q.log, /ジャーナル自身のコミット 0 件/);
  assert.deepStrictEqual(inProgress(L), []);
});

test('ジャーナル自身のコミットだけなら何もしない（前日の push 失敗分は従来どおり送る）', () => {
  const { L, O } = setup();
  fs.mkdirSync(path.join(L, 'journal'), { recursive: true });
  write(L, 'journal/2026-11-21-a.html', '<p>a</p>\n'); commit(L, 'journal: 2026-11-21（Claude が生成中にコミット）');
  fs.mkdirSync(path.join(L, 'data'), { recursive: true });
  write(L, 'data/journal_health.json', '{}\n'); commitAs(L, 'chore(journal): 状態', 'daily@nagoya-bites');
  write(O, 'theirs.txt', 't\n'); commit(O, 'remote only');
  git(O, 'push', '-q', 'origin', 'main');
  const head = git(L, 'rev-parse', 'HEAD');
  const q = runQuarantine(L);
  assert.strictEqual(q.rc, 0);
  assert.strictEqual(q.branch, '');
  assert.strictEqual(git(L, 'rev-parse', 'HEAD'), head);
  assert.strictEqual(git(L, 'branch', '--list', 'backup/*'), '');
});

test('origin/main を取り込んだだけの merge はよそのコミットに数えない', () => {
  const { L, O } = setup();
  fs.mkdirSync(path.join(L, 'journal'), { recursive: true });
  write(L, 'journal/x.html', 'x\n'); commit(L, 'journal: x');
  write(O, 'theirs.txt', 't\n'); commit(O, 'remote only');
  git(O, 'push', '-q', 'origin', 'main');
  git(L, 'pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main');
  const q = runQuarantine(L);
  assert.strictEqual(q.rc, 0);
  assert.strictEqual(q.branch, '');
});

test('index.html だけを触った作者 daily 以外のコミットはよそとして退避する（PR を通らずに本番へ出さない）', () => {
  const { L } = setup();
  write(L, 'index.html', '<p>design session</p>\n'); commit(L, 'design: top');
  const q = runQuarantine(L);
  assert.strictEqual(q.rc, 0);
  assert.notStrictEqual(q.branch, '');
  assert.strictEqual(git(L, 'rev-list', '--count', 'origin/main..main'), '0');
});

test('作業ツリーの差分で main を付け替えられないときは何も変えずに失敗を返す', () => {
  const { L, O } = setup();
  write(L, 'base.txt', 'local commit\n'); commit(L, 'foreign');
  write(O, 'base.txt', 'remote\n'); commit(O, 'remote');
  git(O, 'push', '-q', 'origin', 'main');
  write(L, 'base.txt', 'uncommitted\n');
  const head = git(L, 'rev-parse', 'HEAD');
  const q = runQuarantine(L);
  assert.strictEqual(q.rc, 1);
  assert.strictEqual(git(L, 'rev-parse', 'HEAD'), head);
  assert.strictEqual(git(L, 'branch', '--list', 'backup/*'), '');
  assert.strictEqual(fs.readFileSync(path.join(L, 'base.txt'), 'utf8'), 'uncommitted\n');
});
