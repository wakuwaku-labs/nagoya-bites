#!/usr/bin/env node
'use strict';
/**
 * 日次ジャーナルから note 用の下書きを作って検査する（docs/decisions/0054）。
 * mode が dry-run の間は data/note_drafts/<date>.md に書くだけで、note には何も送らない。
 *
 *   node scripts/build_note_draft.js                 # 今日（JST）
 *   node scripts/build_note_draft.js --date 2026-10-21
 *   node scripts/build_note_draft.js --json
 * 終了コード: 0 = 作れて検査も通った / 1 = 記事が無い・検査に落ちた
 */
const fs = require('fs');
const path = require('path');
const N = require('./lib/note_draft');

const ROOT = path.resolve(__dirname, '..');

function main(argv) {
  let date = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date') date = argv[++i];
    else if (argv[i] === '--json') json = true;
    else throw new Error(`知らない引数: ${argv[i]}`);
  }
  const policy = N.loadPolicy(ROOT);
  if (policy.mode === 'off') return console.log('note: mode=off。何もしません');
  const pub = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/journal_published.json'), 'utf8'));
  const list = pub.entries.filter((e) => e.date === date && e.slug && e.title)
    .sort((x, y) => String(x.published_at).localeCompare(String(y.published_at)));
  const entry = list[list.length - 1];
  if (!entry) { console.error(`note: ${date} の記事がありません`); process.exitCode = 1; return; }
  const html = fs.readFileSync(path.join(ROOT, 'journal', `${entry.slug}.html`), 'utf8');
  const draft = N.buildNoteDraft(entry, html, policy);
  const failures = N.validateNoteDraft(draft, { policy, articleText: N.htmlToText(html) });
  const dir = path.join(ROOT, 'data/note_drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date}.md`);
  fs.writeFileSync(file, `# ${draft.title}\n\nタグ: ${draft.tags.join(' / ')}\n${draft.photo ? `見出し写真: ${draft.photo.src}\n` : ''}\n---\n\n${draft.body}\n`);
  const result = { date, slug: entry.slug, mode: policy.mode, ok: failures.length === 0, failures, chars: draft.body.length, photo: draft.photo ? draft.photo.src : null, file: path.relative(ROOT, file) };
  console.log(json ? JSON.stringify(result, null, 2) : `note[${policy.mode}] ${date} ${result.ok ? '通過' : '不合格 ' + failures.join(' ')} (${result.chars}字) → ${result.file}`);
  if (!result.ok) process.exitCode = 1;
}

main(process.argv.slice(2));
