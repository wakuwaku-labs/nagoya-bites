#!/usr/bin/env node
'use strict';
/**
 * rewrite_journal_wording.js — 公開済みのジャーナル記事から、人が選んだ・書いたと読める言い方を外す移行（P-332・I-03f）
 *
 * オーナーの指示（2026-10-11）:
 *   「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者がすべての店舗を
 *    選定しているような表現は使用しないでください。」
 * 新しい記事は journal/_template.html と scripts/add_journal_site_intro.js が新しい言い方で作る（P-326）。
 * このスクリプトは、すでに公開している記事（journal/20YY-MM-DD-*.html）を同じ言い方にそろえる。日次では回さない。
 * 語の一覧の正本は data/selection_wording_policy.json。確認は node scripts/audit_selection_wording.js --only journal。
 *
 * 段階（--phase）:
 *   heading      区画の見出し「Inside Perspective — 業界人の目利き」→「知っておきたいポイント」、
 *                導入の 1 行「名古屋の厳選N店を業界視点で紹介する」→「名古屋のN店を、公開情報をもとに紹介する」、
 *                meta keywords の「業界人」「業界人視点」、未記入のまま公開された箱（P-369）
 *
 * 触らないもの: 記事の題の系統（<title>・og/twitter:title・<h1>・JSON-LD の headline と name・パンくず・
 *   関連リンクの題）。題を変えると検索の見え方が変わるので、前後の数字を決めてから P-334（I-03h）で変える。
 *
 * 安全の検査: 書き換えた行は、数字の並びと「」『』の中身が前と同じでなければならない（確かめられる事実を動かさない）。
 *   違う行は書き換えずに残し、exit 2 で止める。冪等（2 回目は何も変えない）。
 *
 * 使い方:
 *   node scripts/rewrite_journal_wording.js --phase heading            # 書き換える
 *   node scripts/rewrite_journal_wording.js --phase heading --dry-run  # 件数だけ（書かない）
 *   node scripts/rewrite_journal_wording.js --phase heading --check    # 書き換えが要る記事があれば exit 1
 *   --only <名前の一部>   記事を絞る
 *   --list [N]            書き換える行の前後を N 件（既定 20）並べる
 *   --root <dir>          別のリポジトリ（テスト用の小さな fixture）を見る
 */

const fs = require('fs');
const path = require('path');

const ARTICLE_RE = /^20\d\d-\d\d-\d\d-.+\.html$/;

// 数字の並びと「」『』の中身。書き換えの前後で変わってはいけない
function signature(line) {
  return (line.match(/[0-9０-９][0-9０-９,.]*|[「『][^」』]*[」』]/g) || []).join('|');
}

// ── 段階 heading ──

// 「(業界人視点を記述)」だけが入ったまま公開された箱（下書きの仮の文が残っていた）。箱ごと外す
const PLACEHOLDER_BOX = /[ \t]*<div class="insider-box">\s*<p class="insider-title">[^<]*<\/p>\s*<ul>\s*<li>\(業界人視点を記述\)<\/li>\s*<\/ul>\s*<\/div>[ \t]*\n(?:[ \t]*\n)?/g;

function rewriteHeadingLine(line) {
  return line.replace(/(<p class="insider-title">)Inside Perspective — 業界人の(?:目利き|目線)(<\/p>)/, '$1知っておきたいポイント$2');
}

// 数（約5,000・1,100店超など）は記事の今の表記を引き継ぐ。数の更新は scripts/sync_store_count.js の担当
function rewriteIntroLine(line) {
  if (!line.includes('class="nb-site-intro"')) return line;
  return line.replace(/名古屋の厳選([^<]{1,12}?店(?:超)?)を業界視点で紹介する/, '名古屋の$1を、公開情報をもとに紹介する');
}

function rewriteKeywordsLine(line) {
  return line.replace(/(<meta name="keywords" content=")([^"]*)(")/, (m, a, content, c) => {
    const out = [];
    for (const raw of content.split(',')) {
      const t = raw.trim();
      if (t === '業界人' || t === '業界人視点') continue;
      out.push(raw.replace(/^(\s*)業界人\s+/, '$1'));
    }
    return a + out.join(',') + c;
  });
}

const LINE_RULES = {
  heading: [
    ['headings', rewriteHeadingLine],
    ['intros', rewriteIntroLine],
    ['keywords', rewriteKeywordsLine],
  ],
};

const PHASES = Object.keys(LINE_RULES);

// 行ごとに規則を当てる。前後の署名が違う行は書き換えず、violations に残す
function applyLineRules(text, rules, stats, violations, changes) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [key, fn] of rules) {
      const before = lines[i];
      const after = fn(before);
      if (after === before) continue;
      if (signature(before) !== signature(after)) {
        violations.push({ n: i + 1, key, before, after });
        continue;
      }
      lines[i] = after;
      stats[key] = (stats[key] || 0) + 1;
      changes.push({ n: i + 1, key, before: before.trim(), after: after.trim() });
    }
  }
  return lines.join('\n');
}

function rewriteText(text, phases) {
  const stats = {};
  const violations = [];
  const changes = [];
  let t = text;
  if (phases.includes('heading')) {
    t = t.replace(PLACEHOLDER_BOX, () => { stats.boxes = (stats.boxes || 0) + 1; return ''; });
  }
  const rules = phases.flatMap((p) => LINE_RULES[p] || []);
  t = applyLineRules(t, rules, stats, violations, changes);
  return { text: t, stats, violations, changes };
}

function listArticles(root, only) {
  const dir = path.join(root, 'journal');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => ARTICLE_RE.test(f) && (!only || f.includes(only))).sort().map((f) => path.join(dir, f));
}

function parseArgs(argv) {
  const a = { phases: [], dryRun: false, check: false, only: '', list: 0, root: path.join(__dirname, '..') };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--phase') a.phases.push(argv[++i]);
    else if (v === '--dry-run') a.dryRun = true;
    else if (v === '--check') a.check = true;
    else if (v === '--only') a.only = argv[++i] || '';
    else if (v === '--root') a.root = path.resolve(argv[++i]);
    else if (v === '--list') a.list = /^\d+$/.test(argv[i + 1] || '') ? Number(argv[++i]) : 20;
    else throw new Error(`知らない引数: ${v}`);
  }
  if (!a.phases.length) throw new Error(`--phase が要る（${PHASES.join(' / ')}）`);
  for (const p of a.phases) if (!PHASES.includes(p)) throw new Error(`知らない段階: ${p}（${PHASES.join(' / ')}）`);
  return a;
}

function main(argv, out = console.log) {
  const args = parseArgs(argv);
  const files = listArticles(args.root, args.only);
  const total = {};
  let changedFiles = 0;
  let bad = 0;
  const sample = [];
  const writes = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const r = rewriteText(text, args.phases);
    for (const v of r.violations) { bad++; out(`NG ${path.basename(f)}:${v.n} [${v.key}] 数字か「」『』の中身が変わるので書き換えない`); }
    if (r.text === text) continue;
    changedFiles++;
    for (const [k, n] of Object.entries(r.stats)) total[k] = (total[k] || 0) + n;
    for (const c of r.changes) if (sample.length < args.list) sample.push(`${path.basename(f)}:${c.n} [${c.key}]\n  前: ${c.before.slice(0, 200)}\n  後: ${c.after.slice(0, 200)}`);
    writes.push([f, r.text]);
  }
  if (!bad && !args.dryRun && !args.check) for (const [f, t] of writes) fs.writeFileSync(f, t);
  const detail = Object.entries(total).map(([k, n]) => `${k} ${n}`).join('・') || '変更なし';
  out(`ジャーナルの言い方の移行（${args.phases.join('+')}）: 記事 ${files.length} 本 / 書き換え ${changedFiles} 本（${detail}）${args.dryRun ? ' [dry-run]' : ''}${args.check ? ' [check]' : ''}`);
  for (const s of sample) out(s);
  if (bad) return 2;
  if (args.check && changedFiles) return 1;
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`rewrite_journal_wording: ${e.message}`);
    process.exit(2);
  }
}

module.exports = { rewriteText, rewriteHeadingLine, rewriteIntroLine, rewriteKeywordsLine, applyLineRules, signature, main, PHASES, PLACEHOLDER_BOX };
