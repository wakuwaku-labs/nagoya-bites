#!/usr/bin/env node
/**
 * journal_title_experiment.js
 *
 * SEO-137 の効果比較。data/journal_title_experiment.json（title を書き換えた記事と基線）と、
 * その日の data/gsc_metrics.json（build.yml が日次で更新）を突き合わせる。
 *   changed      … title を規則（agents/editor.md「title の前30字…」）どおりに直した過去記事
 *   reference    … 上位20本のうち、書き換えなかった記事（比較の参照）
 *   new_articles … changedOn より後に公開した記事（生成の規則が効いているか）
 *   journal      … ジャーナル全体（pageTypes.journal）
 * それぞれの表示・クリック・CTR・平均順位（表示で加重）を、基線と今で並べる。
 * gsc_metrics.json の pages は上位500ページだけなので、表示の少ない記事は数に入らないことがある（missing に出す）。
 *
 * 使い方:
 *   node scripts/journal_title_experiment.js --report   # 比較（2026-11-06 に実行する）
 *   node scripts/journal_title_experiment.js --check    # 書き換えた title が今もそのままか（違えば exit 1）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { titleBody } = require('./journal_seo_kw');

const ROOT = path.join(__dirname, '..');
const EXP = path.join(ROOT, 'data', 'journal_title_experiment.json');
const GSC = path.join(ROOT, 'data', 'gsc_metrics.json');

const pathOf = (url) => String(url || '').replace(/^https?:\/\/[^/]+\//, '');

function aggregate(rows) {
  const impressions = rows.reduce((a, r) => a + (r.impressions || 0), 0);
  const clicks = rows.reduce((a, r) => a + (r.clicks || 0), 0);
  const position = impressions ? rows.reduce((a, r) => a + (r.position || 0) * (r.impressions || 0), 0) / impressions : null;
  return { pages: rows.length, impressions, clicks, ctr: impressions ? +(clicks / impressions).toFixed(4) : null, position: position == null ? null : +position.toFixed(2) };
}

/** 比較の表（純関数・テスト対象） */
function report(exp, gsc) {
  const now = new Map((gsc.pages || []).map(p => [pathOf(p.page), p]));
  const group = (entries) => {
    const found = entries.filter(e => now.has(e.path));
    return {
      before: aggregate(entries.map(e => e.baseline)),
      now: aggregate(found.map(e => now.get(e.path))),
      missing: entries.filter(e => !now.has(e.path)).map(e => e.path),
    };
  };
  const newRows = [...now.entries()]
    .filter(([p]) => { const m = p.match(/^journal\/(\d{4}-\d{2}-\d{2})-/); return m && m[1] > exp.changedOn; })
    .map(([, r]) => r);
  return {
    baselineRange: exp.baseline.dateRange,
    currentRange: gsc.dateRange,
    changed: group(exp.pages.filter(e => e.changed)),
    reference: group(exp.pages.filter(e => !e.changed)),
    new_articles: { now: aggregate(newRows) },
    journal: { before: exp.baseline.journal, now: (gsc.pageTypes || {}).journal || null },
  };
}

/** 台帳の title が今のページの <title> と一致するか（一致しなければ比較が濁る） */
function checkTitles(exp, root = ROOT) {
  const problems = [];
  for (const e of exp.pages) {
    const file = path.join(root, e.path);
    if (!fs.existsSync(file)) { problems.push(`${e.path}: ファイルが無い`); continue; }
    const t = (fs.readFileSync(file, 'utf8').match(/<title>([^<]*)<\/title>/) || [, ''])[1].replace(/&amp;/g, '&');
    if (titleBody(t) !== e.after) problems.push(`${e.path}: title が台帳と違う（今「${titleBody(t)}」）`);
  }
  return problems;
}

function main() {
  const exp = JSON.parse(fs.readFileSync(EXP, 'utf8'));
  if (process.argv.includes('--check')) {
    const problems = checkTitles(exp);
    problems.forEach(p => console.log(`  ${p}`));
    console.log(`title の台帳との一致: ${exp.pages.length - problems.length}/${exp.pages.length}`);
    process.exit(problems.length ? 1 : 0);
  }
  console.log(JSON.stringify(report(exp, JSON.parse(fs.readFileSync(GSC, 'utf8'))), null, 2));
}

if (require.main === module) main();

module.exports = { aggregate, report, checkTitles };
