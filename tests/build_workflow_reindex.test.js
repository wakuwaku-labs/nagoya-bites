'use strict';
// P-264: トップの全店舗一覧（section#store-index）は、店舗ページとハブの再生成がすべて終わった後にも作り直す。
//
// 一覧を作る scripts/inject_store_links.js は build.js の途中でも走るが、そのとき stores/*.html は前日のまま。
// 同じ店として統合した ID の「残す側」が入れ替わった日は、gen-store-pages.js --redirect-orphans が
// 現役ページと誘導ページを入れ替えるので、一覧は誘導ページを指したままコミットされる（2026-10-11 の4組）。
// build.yml の npm test は build.js の直後に走るためこれを見つけられず、コミット後の main の先頭だけが赤になる。
// そこでワークフローの順を、ここで固定する。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'build.yml'), 'utf8');
const LINES = SRC.split('\n');

// コメント行を除いた、その run の行番号（0 始まり）。無ければ -1
function runLine(re) {
  return LINES.findIndex((l) => !/^\s*#/.test(l) && /^\s*run:\s/.test(l) && re.test(l));
}
function nameLine(re) {
  return LINES.findIndex((l) => /^\s*-\s+name:\s/.test(l) && re.test(l));
}

test('build.yml は店舗ページ・エリア×ジャンルページの再生成の後に、全店舗一覧を作り直す', () => {
  const gen = runLine(/node gen-store-pages\.js/);
  const hubs = runLine(/node scripts\/gen_area_genre_pages\.js/);
  const reindex = runLine(/node scripts\/inject_store_links\.js/);
  const commit = nameLine(/Commit & push if changed/);
  assert.ok(gen >= 0, 'gen-store-pages.js のステップが見つからない');
  assert.ok(hubs >= 0, 'gen_area_genre_pages.js のステップが見つからない');
  assert.ok(reindex >= 0, 'inject_store_links.js を回すステップが無い（一覧が誘導ページを指したまま main に入る）');
  assert.ok(commit >= 0, 'コミットのステップが見つからない');
  assert.ok(gen < reindex, '全店舗一覧の作り直しは、店舗ページの再生成（gen-store-pages.js）より後に置く');
  assert.ok(hubs < reindex, '全店舗一覧の作り直しは、エリア×ジャンルページの再生成より後に置く（導線に当日のハブが載る）');
  assert.ok(reindex < commit, '全店舗一覧の作り直しは、コミットより前に置く');
});

test('全店舗一覧の作り直しは、失敗してもデプロイを止めない（build.js が作った一覧が残る）', () => {
  const reindex = runLine(/node scripts\/inject_store_links\.js/);
  assert.ok(reindex >= 0);
  // run: の次の数行のどこかに continue-on-error: true がある（次のステップの手前まで）
  let ok = false;
  for (let i = reindex + 1; i < LINES.length && !/^\s*-\s+name:/.test(LINES[i]); i++) {
    if (/^\s*continue-on-error:\s*true\s*$/.test(LINES[i])) { ok = true; break; }
  }
  assert.ok(ok, 'inject_store_links.js のステップに continue-on-error: true が無い');
});
