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
const S = require('./lib/sns_analyzer');

const ROOT = path.resolve(__dirname, '..');

// ── SNS分析ツールの「今週試す1つ」（note-next.json・docs/decisions/0059）────────────
const SECTIONS_MAX = 4;
const TITLE_STYLES = new Set(['full', 'short']);

/**
 * iCloud の note-next.json の try を読み、使えるときだけ { knob, value, experiment_id } を返す。
 * 無い・壊れ・8日超・schema 違い・知らない knob・値が範囲外は、すべて null＝今までどおり。例外は投げない。
 * sections = 抜粋する節の数（1〜4 の整数）／ title_style = 'full'（今まで）か 'short'（最初の「、」「｜」より前。12字未満になるなら今まで）。
 */
function loadNoteTry(now = new Date()) {
  try {
    const r = S.readFresh('note-next.json', { schema: 'note-next/1', maxAgeDays: 8, now });
    if (!r.ok) return null;
    const t = r.data.try;
    if (!t || typeof t !== 'object') return null;
    const id = typeof t.experiment_id === 'string' && t.experiment_id.trim() ? t.experiment_id.trim().slice(0, 200) : null;
    if (t.knob === 'sections') {
      const n = typeof t.value === 'string' && /^\d+$/.test(t.value) ? Number(t.value) : t.value;
      return Number.isInteger(n) && n >= 1 && n <= SECTIONS_MAX ? { knob: 'sections', value: n, experiment_id: id } : null;
    }
    if (t.knob === 'title_style') return TITLE_STYLES.has(t.value) ? { knob: 'title_style', value: t.value, experiment_id: id } : null;
    return null;
  } catch (_) { return null; }
}

/** 題名の短い形。区切りが無い・短くなりすぎる（12字未満）ときは元のまま。 */
function shortTitle(title) {
  const i = String(title).search(/[、｜|]/);
  return i >= 12 ? String(title).slice(0, i) : title;
}

/** 試す1つを policy と下書きに当てる。返り値: { policy, applyTitle }。 */
function applyTry(policy, t) {
  if (!t) return { policy, applyTitle: (x) => x };
  if (t.knob === 'sections' && policy.body && policy.body.mode !== 'full') return { policy: { ...policy, body: { ...policy.body, sections: t.value } }, applyTitle: (x) => x };
  if (t.knob === 'title_style' && t.value === 'short') return { policy, applyTitle: shortTitle };
  return { policy, applyTitle: (x) => x };
}

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
  const noteTry = loadNoteTry();
  const applied = applyTry(policy, noteTry);
  const draft = N.buildNoteDraft(entry, html, applied.policy);
  draft.title = applied.applyTitle(draft.title);
  const failures = N.validateNoteDraft(draft, { policy, articleText: N.htmlToText(html) });
  const dir = path.join(ROOT, 'data/note_drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date}.md`);
  fs.writeFileSync(file, `# ${draft.title}\n\nタグ: ${draft.tags.join(' / ')}\n${draft.photo ? `見出し写真: ${draft.photo.src}\n` : ''}\n---\n\n${draft.body}\n`);
  const result = { date, slug: entry.slug, mode: policy.mode, ok: failures.length === 0, failures, chars: draft.body.length, photo: draft.photo ? draft.photo.src : null, ...(noteTry ? { try: noteTry } : {}), file: path.relative(ROOT, file) };
  console.log(json ? JSON.stringify(result, null, 2) : `note[${policy.mode}] ${date} ${result.ok ? '通過' : '不合格 ' + failures.join(' ')} (${result.chars}字) → ${result.file}`);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { loadNoteTry, applyTry, shortTitle };
