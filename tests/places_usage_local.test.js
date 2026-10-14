'use strict';
// P-436: ローカル（日次ジャーナル）の Places 消費を、CI が書くファイルと分けて数える
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const u = require('../scripts/lib/places_usage_local');

function tmpRoot() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'places-usage-'));
  fs.mkdirSync(path.join(r, 'data'));
  return r;
}

test('ファイルが無いときはゼロ、合計は CI 分だけ', () => {
  const r = tmpRoot();
  assert.deepStrictEqual(u.readLocalMonth('2026-10', r), { textsearch: 0, details: 0, photo: 0 });
  const ci = { places: { sku_month: '2026-10', sku_calls_month: { textsearch: 156, details: 80, photo: 83 } } };
  assert.deepStrictEqual(u.totalMonth(ci, '2026-10', r), { textsearch: 156, details: 80, photo: 83 });
});

test('壊れたファイルはゼロ扱い', () => {
  const r = tmpRoot();
  fs.writeFileSync(path.join(r, u.LOCAL_FILE), '{broken');
  assert.deepStrictEqual(u.readLocalMonth('2026-10', r), { textsearch: 0, details: 0, photo: 0 });
});

test('合計 = CI 分 + ローカル分（積み重ねる）', () => {
  const r = tmpRoot();
  u.addLocalUsage({ textsearch: 2, details: 3, photo: 4 }, '2026-10', {}, r);
  u.addLocalUsage({ details: 1, photo: 1 }, '2026-10', {}, r);
  assert.deepStrictEqual(u.readLocalMonth('2026-10', r), { textsearch: 2, details: 4, photo: 5 });
  const ci = { places: { sku_month: '2026-10', sku_calls_month: { textsearch: 10, details: 10, photo: 10 } } };
  assert.deepStrictEqual(u.totalMonth(ci, '2026-10', r), { textsearch: 12, details: 14, photo: 15 });
});

test('月が替わるとローカル分も CI 分も数え直し', () => {
  const r = tmpRoot();
  u.addLocalUsage({ textsearch: 5, details: 5, photo: 5 }, '2026-10', {}, r);
  const ci = { places: { sku_month: '2026-10', sku_calls_month: { textsearch: 9, details: 9, photo: 9 } } };
  assert.deepStrictEqual(u.totalMonth(ci, '2026-11', r), { textsearch: 0, details: 0, photo: 0 });
  u.addLocalUsage({ photo: 1 }, '2026-11', {}, r);
  assert.deepStrictEqual(u.readLocalMonth('2026-11', r), { textsearch: 0, details: 0, photo: 1 });
});

test('journal_photos は CI が書く photo_pipeline_health.json へ書き込まない', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lib', 'journal_photos.js'), 'utf8');
  assert.ok(!/writeFileSync\(\s*HEALTH_PATH/.test(src));
  assert.ok(/addLocalUsage/.test(src));
});

test('ラッパーのコミット対象にローカル台帳が入り、コミット後に作業ツリーが汚れない', () => {
  const sh = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'run_journal_local.sh'), 'utf8');
  assert.ok(sh.includes('PLACES_LOCAL_USAGE_FILE="' + u.LOCAL_FILE + '"'));
  const start = sh.indexOf('TRACKED_UPDATES=(');
  assert.ok(sh.slice(start, sh.indexOf('\n)', start)).includes('$PLACES_LOCAL_USAGE_FILE'));
  assert.ok(sh.slice(sh.indexOf('push_health()'), sh.indexOf('notify()')).includes('PLACES_LOCAL_USAGE_FILE'));
  // 一時 git で、ラッパーと同じ「書く → add → commit」をしたあとの状態を確かめる
  const r = tmpRoot();
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: r, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(r, 'data/photo_pipeline_health.json'), '{}\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  u.addLocalUsage({ photo: 3 }, '2026-10', {}, r);
  git('add', u.LOCAL_FILE);
  git('commit', '-qm', 'journal');
  assert.strictEqual(git('status', '--short').trim(), '');
  assert.strictEqual(fs.readFileSync(path.join(r, 'data/photo_pipeline_health.json'), 'utf8'), '{}\n');
});
