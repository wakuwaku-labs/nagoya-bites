'use strict';

/**
 * scripts/build_pages_artifact.js の試験（判断の記録 0061）。
 *
 * 守るもの:
 *   (1) 許可リストの外（内部の文書・データ・スクリプト・テスト・workflow）を成果物に含めない
 *   (2) サイトの表示・機能に要る物を落とさない
 *       - JS が fetch する data/*.json、sitemap の URL、公開ページが参照する資産（相対・絶対パス）、
 *         manifest のアイコン、llms.txt が出典に挙げる公開 URL
 *   (3) 必須ファイルが欠けたら成果物を作らず失敗する（本番を壊さない）
 *   (4) 新しい workflow は既存の build.yml を変えず、自動の起動は変数で止まる
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const mod = require('../scripts/build_pages_artifact.js');

const ROOT = mod.ROOT;
const tracked = mod.listTracked(ROOT);
const trackedSet = new Set(tracked);
const { allowed, blocked } = mod.partition(tracked);
const allowedSet = new Set(allowed);

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

test('許可リストの判定（代表例）', () => {
  for (const p of ['index.html', '404.html', 'sw.js', 'sitemap.xml', 'sitemap-images.xml', 'llms.txt', 'robots.txt', 'manifest.json', 'CNAME',
    'googledf7b9dabc1052b56.html', 'ec3ee6876b0d465ab4f7093ba5bc42d0.txt',
    'features/banquet.html', 'journal/feed.xml', 'journal/feed.atom', 'journal/2026-04-21-x.html',
    'stores/J000015064.html', 'stores/area/chikusa-imaike/bar-budget-3000.html',
    'assets/css/nb.css', 'assets/og/J000015064.svg', 'assets/store-figures/_fallback.svg', 'icons/icon-192.png',
    'data/stores.json', 'data/crosscheck.json', 'data/area_genre_pages_manifest.json']) {
    assert.ok(mod.isAllowed(p), `公開するはず: ${p}`);
  }
  for (const p of ['HANDOFF.md', 'CLAUDE.md', 'AGENTS.md', 'agent-backlog.md', 'spec.md', 'sprint-1-report.md', 'build-report.md',
    'store-notification-template.md', 'agent-run.log', '.ig_photos_progress.json', '.qa-secret-allowlist.txt', '.ondine.json',
    'package.json', 'build.js', 'auth.sh', 'page-names.json',
    'data/site_metrics.json', 'data/x_post_log.json', 'data/feedback_log.json', 'data/journal_candidates/2026-11-11.json',
    'data/editorreason_drafts/J000028918.json', 'docs/decisions/README.md', 'docs/daily-posts/2026-05-19.md',
    'scripts/fetch_gsc_metrics.js', 'tests/pages_artifact.test.js', 'agents/builder.md',
    '.github/workflows/build.yml', '.claude/settings.json', '.codex/hooks.json', '.gas-deploy/Code.js', '.agents/skills/a/SKILL.md',
    'journal/_template.html', 'features/sub/x.html', 'features/README.md', 'stores/note.md', 'assets/notes.md', 'node_modules/x/index.js']) {
    assert.ok(!mod.isAllowed(p), `公開しないはず: ${p}`);
  }
});

test('実際のリポジトリ: 内部の文書・ディレクトリは1つも許可されない', () => {
  const internalRoots = ['docs/', 'scripts/', 'tests/', 'agents/', '.github/', '.claude/', '.codex/', '.agents/', '.gas-deploy/'];
  for (const p of allowed) {
    assert.ok(!internalRoots.some((r) => p.startsWith(r)), `内部の物が許可されている: ${p}`);
    if (!p.includes('/')) {
      assert.ok(!/\.(md|log|sh|js|json)$/.test(p) || ['manifest.json', 'sw.js'].includes(p), `ルートの内部ファイルが許可されている: ${p}`);
    }
  }
  // 診断で本番200だった物は、追跡されていれば遮断側にある
  for (const p of ['HANDOFF.md', 'CLAUDE.md', 'agent-backlog.md', 'data/site_metrics.json', 'AGENTS.md', 'spec.md', 'build-report.md']) {
    if (trackedSet.has(p)) assert.ok(!allowedSet.has(p), `${p} が成果物に入る`);
  }
});

test('data/ は許可した物だけ（暫定許可は gsc_metrics.json の1件だけ）', () => {
  const dataAllowed = allowed.filter((p) => p.startsWith('data/')).sort();
  const expected = [...mod.DATA_ALLOW, ...mod.DATA_TEMPORARY_ALLOW].sort();
  assert.deepStrictEqual(dataAllowed, expected.filter((p) => trackedSet.has(p)));
  assert.deepStrictEqual([...mod.DATA_TEMPORARY_ALLOW], ['data/gsc_metrics.json']);
});

test('GAS など外部が公開 URL で読む /data/*.json は許可されている（外すと外部の機能が壊れる）', () => {
  const code = read('.gas-deploy/Code.js');
  const urls = [...code.matchAll(/https:\/\/nagoya-bites\.com\/(data\/[A-Za-z0-9_./-]+\.json)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 1, 'GAS の参照が見つからない（Code.js が変わった。判断の記録 0061 を見直す）');
  for (const u of urls) assert.ok(mod.isAllowed(u), `GAS が読む ${u} が遮断されている`);
  const llms = read('llms.txt');
  for (const m of llms.matchAll(/https:\/\/nagoya-bites\.com\/(data\/[A-Za-z0-9_./-]+\.json)/g)) {
    assert.ok(mod.isAllowed(m[1]), `llms.txt が出典に挙げる ${m[1]} が遮断されている`);
  }
});

test('公開ページの JS が fetch する data/*.json は許可されている', () => {
  const files = tracked.filter((p) => allowedSet.has(p) && /\.(html|js)$/.test(p));
  let found = 0;
  for (const p of files) {
    const s = fs.readFileSync(path.join(ROOT, p), 'utf8');
    for (const m of s.matchAll(/fetch\(\s*['"`]([^'"`]*?data\/[^'"`?]+?)(?:['"`?])/g)) {
      const rel = m[1].replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '');
      found++;
      assert.ok(mod.isAllowed(rel), `${p} が fetch する ${rel} が遮断されている`);
    }
  }
  assert.ok(found >= 2, `fetch の data 参照を検出できていない（${found}件）`);
});

test('sitemap の URL・manifest のアイコンはすべて成果物に入る', () => {
  const toPath = (u) => {
    const x = u.replace(/^https:\/\/nagoya-bites\.com\//, '');
    return x === '' || x.endsWith('/') ? x + 'index.html' : x;
  };
  let n = 0;
  for (const f of ['sitemap.xml', 'sitemap-index.xml', 'sitemap-images.xml']) {
    for (const m of read(f).matchAll(/<(?:image:)?loc>(https:\/\/nagoya-bites\.com\/[^<]*)</g)) {
      const p = toPath(m[1]);
      n++;
      // 実在するファイルだけ見る（実在しない URL は元から404で、この変更の影響ではない）
      if (trackedSet.has(p)) assert.ok(allowedSet.has(p), `${f} の ${m[1]} が遮断されている`);
    }
  }
  assert.ok(n > 1000, `sitemap の URL を読めていない（${n}件）`);
  const manifest = JSON.parse(read('manifest.json'));
  for (const ic of manifest.icons) assert.ok(allowedSet.has(ic.src), `manifest のアイコン ${ic.src} が成果物に無い`);
});

test('公開ページが参照する資産（src/href・CSS の url）で、追跡されている物はすべて成果物に入る', () => {
  const pages = allowed.filter((p) => p.endsWith('.html'));
  const re = /(?:src|href)=["']([^"'#?\s]+)[^"']*["']/g;
  let checked = 0;
  const bad = [];
  for (const p of pages) {
    const s = fs.readFileSync(path.join(ROOT, p), 'utf8');
    const dir = path.posix.dirname(p);
    for (const m of s.matchAll(re)) {
      const ref = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\{|\$|data:)/i.test(ref)) {
        const mm = ref.match(/^https:\/\/nagoya-bites\.com\/(.+)$/);
        if (!mm) continue;
        const t = mm[1];
        if (trackedSet.has(t) && !allowedSet.has(t)) bad.push(`${p} -> ${t}`);
        continue;
      }
      const t = ref.startsWith('/') ? ref.slice(1) : path.posix.normalize(path.posix.join(dir, ref));
      checked++;
      if (trackedSet.has(t) && !allowedSet.has(t)) bad.push(`${p} -> ${t}`);
    }
  }
  assert.ok(checked > 1000, `参照を読めていない（${checked}件）`);
  assert.deepStrictEqual(bad.slice(0, 10), [], `成果物に入らない物を公開ページが参照している（${bad.length}件）`);
  // CSS の url()
  const css = read('assets/css/nb.css');
  for (const m of css.matchAll(/url\(\s*['"]?([^)'"]+)['"]?\s*\)/g)) {
    if (/^(?:[a-z]+:|data:|\/\/)/i.test(m[1])) continue;
    const t = m[1].startsWith('/') ? m[1].slice(1) : path.posix.normalize(path.posix.join('assets/css', m[1]));
    if (trackedSet.has(t)) assert.ok(allowedSet.has(t), `nb.css が参照する ${t} が成果物に無い`);
  }
});

test('必須ファイルはすべて許可されていて実在する', () => {
  for (const f of mod.REQUIRED) {
    assert.ok(allowedSet.has(f), `必須 ${f} が成果物に入らない`);
    assert.ok(fs.existsSync(path.join(ROOT, f)), `必須 ${f} が無い`);
  }
});

test('build: 一時フォルダに作ると、許可した物だけが入り、内部の物は入らない', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-art-'));
  try {
    const r = mod.build(out, ROOT);
    assert.strictEqual(r.copied, allowed.length);
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(out, path.join(d, e.name)).split(path.sep).join('/')]);
    const got = walk(out);
    assert.strictEqual(got.length, allowed.length);
    for (const p of got) assert.ok(mod.isAllowed(p), `許可外が成果物にある: ${p}`);
    for (const p of ['HANDOFF.md', 'CLAUDE.md', 'agent-backlog.md', 'data/site_metrics.json', 'docs', 'scripts', 'tests', '.github']) {
      assert.ok(!fs.existsSync(path.join(out, p)), `成果物に ${p} がある`);
    }
    assert.ok(fs.existsSync(path.join(out, 'data/stores.json')));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('build: 必須ファイルが欠けたら失敗し、出力先を作らない', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-repo-'));
  const out = path.join(os.tmpdir(), 'pages-out-' + process.pid);
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    fs.writeFileSync(path.join(repo, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(repo, 'spec.md'), 'x');
    execFileSync('git', ['add', 'index.html', 'spec.md'], { cwd: repo });
    assert.throws(() => mod.build(out, repo), /必須のファイルが無い/);
    assert.ok(!fs.existsSync(out));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('workflow: 本番を変えない作りになっている', () => {
  const wf = read('.github/workflows/pages-artifact.yml');
  assert.ok(/workflow_dispatch:/.test(wf));
  assert.ok(!/^\s*schedule:/m.test(wf), 'schedule を足さない（自動の起動は変数で止める）');
  // 自動の起動（push・workflow_run）はリポジトリ変数が 'true' のときだけ jobs を動かす
  assert.ok(/vars\.PAGES_ACTIONS_ENABLED == 'true'/.test(wf));
  const ifs = [...wf.matchAll(/^\s+if:\s*(>-\s*\n(?:\s+.+\n)+|.+)$/gm)].map((m) => m[1]);
  assert.strictEqual(ifs.length, 2, 'build と deploy の両方に if がある');
  for (const c of ifs) assert.ok(/PAGES_ACTIONS_ENABLED/.test(c) || /workflow_dispatch/.test(c));
  // 本番へ出すのは deploy job だけで、手動のときは deploy=true を明示したときだけ
  assert.ok(/inputs\.deploy == true/.test(wf));
  assert.ok(/default: false/.test(wf));
  // 既存のデプロイ（build.yml）には Pages の成果物の仕組みを足していない
  const build = read('.github/workflows/build.yml');
  assert.ok(!/upload-pages-artifact|deploy-pages/.test(build));
});

test('workflow: main へ push する既存の workflow は、すべて workflow_run の一覧にある', () => {
  const wf = read('.github/workflows/pages-artifact.yml');
  const listed = new Set([...wf.matchAll(/^\s+- '([^']+)'$/gm)].map((m) => m[1]));
  const dir = path.join(ROOT, '.github/workflows');
  let pushers = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f === 'pages-artifact.yml') continue;
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!/git push/.test(s)) continue;
    const name = (s.match(/^name:\s*(.+)$/m) || [])[1].trim().replace(/^['"]|['"]$/g, '');
    pushers++;
    assert.ok(listed.has(name), `${f}（${name}）が pages-artifact.yml の workflow_run に無い。切り替え後にこの workflow の更新が本番へ出なくなる`);
  }
  assert.ok(pushers >= 10);
});
