#!/usr/bin/env node
'use strict';
/**
 * 「人が選んだ・訪れた」と読める言い方を、題・本文から外す移行（基本方針 段階1 S1-3・ADR 0069 決定4）。
 * 規則は scripts/lib/selection_wording_rules.js、語の一覧の正本は data/selection_wording_policy.json。
 * 冪等（2回目は何も変えない）。数字と「」『』の中身は前後で変えない（変わる書き換えは書かずに exit 2）。
 *
 *   node scripts/rewrite_selection_wording.js              # 書き換える（検索流入の上位2本の題は除く）
 *   node scripts/rewrite_selection_wording.js --check      # 書き換えが要るファイルがあれば exit 1
 *   node scripts/rewrite_selection_wording.js --top solo-dining   # 検索流入の上位の題を1本だけ変える（決定4）
 *   node scripts/rewrite_selection_wording.js --revert solo-dining # その1本の題を元に戻す（半減したとき・決定4）
 *   --list    変えるファイルと件数を出す
 * 対象: features/*.html・journal/20*.html・features/index.html・journal/index.html・index.html・
 *       data/journal_published.json・data/featured.json・page-names.json・llms.txt・題の元（scripts/gen_industry_features.js・scripts/lib/journal_topics.js）。
 * 店舗ページ（stores/）は元のデータと題から gen-store-pages.js が作り直すので、ここでは触らない。
 */
const fs = require('fs');
const path = require('path');
const { RULES, TOP_TITLES } = require('./lib/selection_wording_rules');

const ROOT = path.resolve(__dirname, '..');

function targets() {
  const out = ['index.html', 'features/index.html', 'journal/index.html', 'data/journal_published.json', 'data/featured.json',
    'page-names.json', 'llms.txt', 'scripts/gen_industry_features.js', 'scripts/lib/journal_topics.js'];
  for (const f of fs.readdirSync(path.join(ROOT, 'features')).filter((x) => x.endsWith('.html'))) out.push('features/' + f);
  for (const f of fs.readdirSync(path.join(ROOT, 'journal')).filter((x) => /^20.*\.html$/.test(x))) out.push('journal/' + f);
  return [...new Set(out)].filter((f) => fs.existsSync(path.join(ROOT, f)));
}

// 数字の並びと「」『』の中身。書き換えの前後で変わってはいけない
const signature = (s) => (s.match(/[0-9０-９][0-9０-９,.]*|[「『][^」』]*[」』]/g) || []).join('|');

function apply(text, { top } = {}) {
  let t = text;
  const keep = [];
  // 上位2本の題は、指定が無い限り守る
  TOP_TITLES.forEach((p, i) => {
    if (top === p.id) { t = t.split(p.old).join(p.neu); return; }
    const token = `\u0000TOP${i}\u0000`;
    if (t.includes(p.old)) { t = t.split(p.old).join(token); keep.push([token, p.old]); }
  });
  for (const [re, rep] of RULES) t = t.replace(re, rep);
  for (const [token, old] of keep) t = t.split(token).join(old);
  return t;
}

// 上位の題の変更の記録（data/top_title_changes.json）と今の data/gsc_metrics.json を並べ、戻す条件に当たるかを出す
function reportTop() {
  const led = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'top_title_changes.json'), 'utf8'));
  let gsc = null;
  try { gsc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'gsc_metrics.json'), 'utf8')); } catch (e) { /* 無ければ空 */ }
  for (const c of led.changes) {
    const row = gsc && (gsc.pages || []).find((p) => String(p.page).endsWith('/' + c.path));
    const now = row ? row.clicks : null;
    const hit = c.status === 'applied' && now != null && now <= c.stop.clicksAtOrBelow;
    console.log(`${c.id}: 変えた日 ${c.changedOn}・比較 ${c.compareOn}・基線 ${c.baseline.clicks}クリック → 今 ${now == null ? '（取得なし）' : now}（直近28日 ${gsc ? gsc.dateRange.startDate + '〜' + gsc.dateRange.endDate : '-'}）${hit ? ' ⚠ 戻す条件に当たった: --revert ' + c.id : ''}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--report')) return reportTop();
  const check = args.includes('--check');
  const list = args.includes('--list');
  const revert = args.includes('--revert') ? args[args.indexOf('--revert') + 1] : null;
  const top = revert || (args.includes('--top') ? args[args.indexOf('--top') + 1] : null);
  if ((top || revert) && !TOP_TITLES.some((p) => p.id === top)) { console.error('--top は ' + TOP_TITLES.map((p) => p.id).join(' / ')); process.exit(2); }
  const only = top ? TOP_TITLES.find((p) => p.id === top) : null;
  let changed = 0, bad = 0;
  for (const f of targets()) {
    const p = path.join(ROOT, f);
    const before = fs.readFileSync(p, 'utf8');
    let after;
    if (only) after = revert ? before.split(only.neu).join(only.old) : before.split(only.old).join(only.neu);
    else after = apply(before);
    if (after === before) continue;
    if (signature(before) !== signature(after) && !only) {
      // 数字・「」の中身が変わる書き換えは止める
      bad++; console.error(`数字・「」の中身が変わるため書かない: ${f}`); continue;
    }
    changed++;
    if (list) console.log(f);
    if (!check) fs.writeFileSync(p, after);
  }
  console.log(`言い方の書き換え（S1-3）: ${changed}ファイル${check ? '（書き込みなし）' : ''}${top ? ` / 上位の題 ${top}` : ''}`);
  if (bad) process.exit(2);
  if (check && changed) process.exit(1);
}

if (require.main === module) main();
module.exports = { apply, targets, signature };
