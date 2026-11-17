'use strict';
/**
 * scripts/journal_correct.js — 公開済みのジャーナル記事を訂正する道具（S4-4・計画 media-policy-2026-11）
 *
 *   node scripts/journal_correct.js --slug <slug> --summary "訂正の内容" \
 *        --find "誤った文" --replace "正しい文" [--find ... --replace ...] [--yes] [--no-rebuild] [--force-head]
 *
 * - 既定は予行（何をするかだけ表示。何も書かない）。--yes のときだけ書く。
 * - 本文の置き換えは、--find が記事の本文に「ちょうど1か所」あるときだけ行う（0か所・2か所以上なら何も書かずに止まる）。
 * - 検索流入のある題・URL・冒頭は変えない（足すだけ）: 題（<title>・h1）と冒頭（art-lead）の中に当たる置き換えは、
 *   --force-head を付けたときだけ許す。slug（URL）は変えられない。
 * - 記録: data/journal_published.json の該当行に corrections[] を足し、記事の「訂正の履歴」欄に1行足す。
 *   欄の目印は data-correction-log（journal/_template.html の欄）。記事に目印が無いときは本文（</article> の直前）に足す。
 * - 途中で失敗したら、書き換えたファイルを元に戻して止まる（半端な状態を残さない）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLISHED_REL = 'data/journal_published.json';
const LOG_MARK = 'data-correction-log';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function jstDate(now) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

function jaDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

const KIND_LABEL = { correction: '訂正', withdrawal: '取り下げ', restore: '公開に戻した' };

/** 記事HTMLの「訂正の履歴」欄に1行足す。返り値: 新しい html */
function addCorrectionLog(html, record) {
  const day = record.at.slice(0, 10);
  const li = `<li><time datetime="${esc(day)}">${esc(jaDate(day))}</time> ${esc(KIND_LABEL[record.kind] || record.kind)}: ${esc(record.summary)}</li>`;
  // 目印は「開始タグの属性」として探す（CSS の [data-correction-log] などは対象にしない）
  const m = new RegExp('<(\\w+)\\s[^>]*?\\b' + LOG_MARK + '(?=[\\s=/>])[^>]*>').exec(html);
  if (m) {
    const tagStart = m.index;
    const tagEnd = m.index + m[0].length - 1;
    // 空のときは hidden にしてあるテンプレートを想定。履歴が付くので見えるようにする
    const openTag = m[0].replace(/\s+hidden(?:="[^"]*")?(?=[\s>])/, '');
    const listClose = html.slice(tagEnd).search(/<\/(ul|ol)>/);
    if (listClose >= 0) {
      const at = tagEnd + listClose;
      return html.slice(0, tagStart) + openTag + html.slice(tagEnd + 1, at) + li + '\n' + html.slice(at);
    }
    // 欄はあるが一覧が無い: 欄の閉じタグの手前に一覧を作る
    const close = html.indexOf('</' + m[1] + '>', tagEnd);
    if (close >= 0) {
      return html.slice(0, tagStart) + openTag + html.slice(tagEnd + 1, close) + '<ul>' + li + '</ul>' + html.slice(close);
    }
  }
  // 目印が無い記事（欄の追加前に公開した記事）: 本文の末尾に欄ごと足す
  const block = `<aside class="correction-log" ${LOG_MARK}>\n<h2 class="correction-log-title">訂正の履歴</h2>\n<ul>${li}</ul>\n</aside>\n`;
  const end = html.lastIndexOf('</article>');
  if (end < 0) throw new Error('記事の本文（</article>）が見つかりません');
  return html.slice(0, end) + block + html.slice(end);
}

/** 置き換えが当たる範囲が、題（<title>・h1）か冒頭（art-lead）に掛かるか */
function touchesHead(html, index, length) {
  const spans = [];
  for (const re of [/<title>[\s\S]*?<\/title>/g, /<h1[\s\S]*?<\/h1>/g, /<p class="art-lead">[\s\S]*?<\/p>/g]) {
    for (const m of html.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
  }
  return spans.some(([a, b]) => index < b && index + length > a);
}

function paths(root, slug) {
  return { html: path.join(root, 'journal', `${slug}.html`), pub: path.join(root, PUBLISHED_REL) };
}

function loadTarget(root, slug) {
  if (!/^\d{4}-\d{2}-\d{2}[\w-]*$/.test(String(slug || ''))) return { error: 'bad_slug' };
  const p = paths(root, slug);
  if (!fs.existsSync(p.html)) return { error: 'no_article_file' };
  const raw = fs.readFileSync(p.pub, 'utf8');
  const pub = JSON.parse(raw);
  const entry = (pub.entries || []).find((e) => e.slug === slug);
  if (!entry) return { error: 'not_in_published' };
  return { p, pub, entry, html: fs.readFileSync(p.html, 'utf8'), rawPub: raw };
}

function writePublished(file, pub) {
  fs.writeFileSync(file, JSON.stringify(pub, null, 2) + '\n');
}

/** 書いたファイルを元に戻す共通の枠。fn の中で書き、失敗したら復元して例外を投げ直す */
function withRollback(snapshots, fn) {
  try {
    return fn();
  } catch (e) {
    for (const [file, content] of snapshots) fs.writeFileSync(file, content);
    throw e;
  }
}

function runRebuild(root, execImpl) {
  const exec = execImpl || ((cmd, args, opt) => require('child_process').execFileSync(cmd, args, opt));
  exec(process.execPath, [path.join(root, 'scripts', 'build_journal_index.js')], { cwd: root, stdio: 'pipe' });
}

function run({ slug, summary, edits = [], yes = false, forceHead = false, rebuild = true, root = ROOT, now = new Date(), exec = null, by = 'manual' }) {
  if (!summary || !String(summary).trim()) return { ok: false, code: 'no_summary' };
  const t = loadTarget(root, slug);
  if (t.error) return { ok: false, code: t.error };
  if (t.entry.status === 'withdrawn') return { ok: false, code: 'withdrawn_article' };
  let html = t.html;
  const plan = [];
  for (const ed of edits) {
    if (!ed.find) return { ok: false, code: 'empty_find' };
    const hits = [];
    for (let i = html.indexOf(ed.find); i >= 0; i = html.indexOf(ed.find, i + 1)) hits.push(i);
    if (hits.length !== 1) return { ok: false, code: hits.length === 0 ? 'find_not_found' : 'find_ambiguous', find: ed.find, hits: hits.length };
    if (!forceHead && touchesHead(html, hits[0], ed.find.length)) return { ok: false, code: 'touches_head', find: ed.find };
    html = html.slice(0, hits[0]) + (ed.replace == null ? '' : ed.replace) + html.slice(hits[0] + ed.find.length);
    plan.push({ find: ed.find, replace: ed.replace });
  }
  const record = { at: now.toISOString(), kind: 'correction', summary: String(summary).trim().slice(0, 300), by };
  html = addCorrectionLog(html, record);
  const day = jstDate(now);
  html = html.replace(/("dateModified"\s*:\s*")[^"]*(")/, `$1${day}$2`);
  if (!yes) return { ok: true, code: 'dry_run', slug, edits: plan, record };
  const snaps = [[t.p.html, t.html], [t.p.pub, t.rawPub]];
  withRollback(snaps, () => {
    fs.writeFileSync(t.p.html, html);
    t.entry.corrections = (t.entry.corrections || []).concat([record]);
    writePublished(t.p.pub, t.pub);
    if (rebuild) runRebuild(root, exec);
  });
  return { ok: true, code: 'corrected', slug, edits: plan.length, record };
}

function parseArgs(argv) {
  const a = { yes: false, rebuild: true, forceHead: false, edits: [] };
  let pendingFind = null;
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--yes') a.yes = true;
    else if (k === '--no-rebuild') a.rebuild = false;
    else if (k === '--force-head') a.forceHead = true;
    else if (k === '--slug') a.slug = argv[++i];
    else if (k === '--summary') a.summary = argv[++i];
    else if (k === '--find') { pendingFind = { find: argv[++i], replace: '' }; a.edits.push(pendingFind); }
    else if (k === '--replace') { if (pendingFind) pendingFind.replace = argv[++i]; else i++; }
  }
  return a;
}

if (require.main === module) {
  try {
    const r = run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(`失敗（書いたファイルは元に戻しました）: ${e.message}`); process.exit(1); }
}

module.exports = { run, parseArgs, addCorrectionLog, touchesHead, loadTarget, writePublished, withRollback, runRebuild, jstDate, jaDate, esc, LOG_MARK, PUBLISHED_REL };
