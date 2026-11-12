#!/usr/bin/env node
'use strict';
/**
 * 日次・特集の JSON-LD dateModified を、「本文が実際に変わった最後の日」まで進める一回限りの変換（項目20・冪等）。
 *
 * 根拠は git の履歴だけ。次のコミットは「本文の変更」に数えない（機械的な一括変更のため）:
 *   - 日次・特集を 6 ファイル以上まとめて触ったコミット（クレジット・導線・計測・書体など全ページ共通の変換）
 *   - "chore: auto-update"（店舗データの自動更新）と Merge
 * 残りのコミットは、タグ・属性・script/style・head を除いた「文字」が前の版から変わったときだけ数える。
 * dateModified は進める方向にしか動かさない（datePublished より前・現在値より前にはしない）。
 * 出せない（履歴が無い・本文の変更が無い）ページは今のまま。今日の日付を一律に入れることはしない。
 *   node scripts/backfill_date_modified.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const dry = process.argv.includes('--dry');
const BULK = 6;

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function bodyText(html) {
  return (html || '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(figcaption|footer|nav)[\s\S]*?<\/\1>/gi, '') // 写真の出所・クレジット・共通部品は本文に数えない
    .replace(/<(\w+)[^>]*class="[^"]*(?:credit|photo-source)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '');
}

function listFiles() {
  const out = [];
  for (const dir of ['journal', 'features']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
      if (f.endsWith('.html') && f !== '_template.html' && f !== 'index.html') out.push(`${dir}/${f}`);
    }
  }
  return out;
}

// コミットごとの「日次・特集で触ったファイル数」と日付・件名
function commitIndex() {
  const raw = git(['log', '--no-merges', '--name-only', '--format=@@%H\t%ad\t%s', '--date=short', '--', 'journal', 'features']);
  const info = new Map();
  let cur = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const [h, d, ...s] = line.slice(2).split('\t');
      cur = { date: d, subject: s.join('\t'), files: 0 };
      info.set(h, cur);
    } else if (line.trim() && cur && /^(journal|features)\/[^/]+\.html$/.test(line.trim())) cur.files++;
  }
  return info;
}

function lastBodyChange(file, info) {
  const log = git(['log', '--no-merges', '--format=%H', '--', file]).trim().split('\n').filter(Boolean); // 新しい順
  for (let i = 0; i < log.length; i++) {
    const h = log[i];
    const c = info.get(h);
    if (!c || c.files >= BULK || /^chore: auto-update/.test(c.subject)) continue;
    const prev = log[i + 1];
    if (!prev) return null; // 最初の版（公開そのもの）
    let a; let b;
    try { a = git(['show', `${prev}:${file}`]); b = git(['show', `${h}:${file}`]); } catch (e) { continue; }
    if (bodyText(a) !== bodyText(b)) return { date: c.date, hash: h, subject: c.subject };
  }
  return null;
}

function main() {
  const info = commitIndex();
  const rows = [];
  let changed = 0;
  for (const file of listFiles()) {
    const p = path.join(ROOT, file);
    const html = fs.readFileSync(p, 'utf8');
    const pub = (html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1];
    const modM = html.match(/("dateModified"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/);
    if (!pub || !modM) continue;
    const cur = modM[2];
    const r = lastBodyChange(file, info);
    if (!r || r.date <= cur || r.date < pub) continue;
    rows.push(`${file}\t${cur} -> ${r.date}\t${r.hash.slice(0, 10)}\t${r.subject.slice(0, 50)}`);
    changed++;
    if (!dry) {
      fs.writeFileSync(p, html.replace(/("dateModified"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/, `$1${r.date}$3`));
    }
  }
  console.log(rows.join('\n'));
  console.log(`${dry ? '進められる' : '進めた'}: ${changed} 本`);
}
main();
