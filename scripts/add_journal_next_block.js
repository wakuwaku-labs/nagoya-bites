#!/usr/bin/env node
/**
 * add_journal_next_block.js
 *
 * 公開済みの日次記事の記事末に、「この記事で紹介したお店」（店舗ページへのリンク）と
 * 「あわせて読みたい特集」のブロックを後追いで入れる。中身の決め方は scripts/lib/journal_next_block.js の1本。
 * 新しい記事は scripts/refresh_journal_related.js が同じ関数で入れる（日次の生成の流れ）。
 *
 * 冪等: 何度流しても同じ結果。載せる物が無い記事は変えない。通信はしない・data/ は書き換えない。
 *   node scripts/add_journal_next_block.js            # journal/20*.html すべて
 *   node scripts/add_journal_next_block.js --check    # 書かずに、入れ直しが要る記事があれば exit 1
 *   node scripts/add_journal_next_block.js journal/2026-10-*.html   # 指定した記事だけ
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { applyToHtml } = require('./lib/journal_next_block');

const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');

function listPosts() {
  return fs.readdirSync(JOURNAL_DIR).filter(f => /^20\d\d-.*\.html$/.test(f)).sort().map(f => path.join(JOURNAL_DIR, f));
}

/** files を処理して { changed:[ファイル名], same, errored } を返す。write=false なら書かない */
function run({ files = listPosts(), write = true } = {}) {
  const changed = [];
  let same = 0, errored = 0;
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const next = applyToHtml(html);
    if (next === null) { errored++; console.error(`ERROR (</article> が無い): ${path.relative(ROOT, f)}`); continue; }
    if (next === html) { same++; continue; }
    changed.push(path.basename(f));
    if (write) fs.writeFileSync(f, next, 'utf8');
  }
  return { changed, same, errored };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const CHECK = args.includes('--check');
  const given = args.filter(a => a.endsWith('.html')).map(f => path.resolve(f));
  const r = run({ files: given.length ? given : listPosts(), write: !CHECK });
  console.log(`add_journal_next_block: ${CHECK ? `入れ直しが要る=${r.changed.length}` : `書き換え=${r.changed.length}`} 変更なし=${r.same} エラー=${r.errored}`);
  if (r.errored > 0 || (CHECK && r.changed.length > 0)) process.exit(1);
}

module.exports = { run };
