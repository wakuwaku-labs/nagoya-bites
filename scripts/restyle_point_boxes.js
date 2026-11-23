#!/usr/bin/env node
'use strict';
/**
 * scripts/restyle_point_boxes.js — 公開済みの日次記事の「先に結論」「来店前に確かめたいこと」を、今の形に直す（冪等・Ondine #2576）。
 *
 * 2026-11-23 本人の依頼:
 *   ①確認できない場合は表示しない ②印・文字の大きさ・色で分かりやすく ③「先に結論」ではなく「ここがポイント（印）」
 * 新しく作る記事は scripts/lib/editorial_standard.js が今の形で書く。この道具は、それより前に公開した記事を同じ形にそろえる。
 *   - 「先に結論」の箱 → pointBoxHtml（生成と同じ関数）で作り直す。「分からなかった点は◯点で…」の文は外す。
 *   - 「来店前に確かめたいこと」 → 「確認できなかった」の札のある行を外す。残った行の値に混ざった「記載なし」などの部分も外す
 *     （stripUnconfirmedText・生成と同じ関数）。行が残らなければ欄ごと外す。
 * 使い方: node scripts/restyle_point_boxes.js [--check]（--check は直す記事があれば終了コード 1・書き換えない）
 */
const fs = require('fs');
const path = require('path');
const { pointBoxHtml, stripUnconfirmedText } = require('./lib/editorial_standard');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'journal');

function decode(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

const OLD_BOX = /<div class="insider-box nb-jbox nb-jconclusion"><p class="insider-title">先に結論<\/p><ul>([\s\S]*?)<\/ul><\/div>/;
const UNKNOWN_TAIL = /分からなかった点は\d+点で、項目ごとに下の一覧に書いています。?$/;

/** 古い「先に結論」の箱を「ここがポイント」の箱にする。古い箱が無ければそのまま */
function restyleConclusion(html) {
  const m = OLD_BOX.exec(html);
  if (!m) return html;
  const parts = {};
  for (const li of m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const t = decode(li[1].replace(/<[^>]+>/g, '')).trim();
    let r;
    if ((r = /^向く人:\s*(.+)$/.exec(t))) parts.fit = r[1];
    else if ((r = /^向かない人:\s*(.+)$/.exec(t))) parts.not = r[1];
    else if ((r = /^来店前にいちばん確かめたい点:\s*(.+)$/.exec(t))) parts.check = r[1].replace(UNKNOWN_TAIL, '').trim();
    else return html; // 知らない行があれば触らない（取り違えて消さない）
  }
  const box = pointBoxHtml(parts);
  return box ? html.replace(m[0], box) : html;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 確認できた行の値から、確認できなかった部分を外す。外して何も残らなければ null（行ごと外す）。形が違う行はそのまま */
function stripRow(li) {
  const m = /^<li><span class="nb-check-name">([\s\S]*?)<\/span>: ([^<]*)<\/li>$/.exec(li);
  if (!m) return li;
  const text = stripUnconfirmedText(decode(m[2]));
  if (!text) return null;
  return `<li><span class="nb-check-name">${m[1]}</span>: ${esc(text)}</li>`;
}

/** 「来店前に確かめたいこと」から確認できなかった行と、行の中の確認できなかった部分を外す。行が残らなければ欄ごと外す */
function restyleChecklist(html) {
  return html.replace(/<details class="nb-jbox nb-check" open><summary>来店前に確かめたいこと<\/summary><ul>([\s\S]*?)<\/ul><\/details>/, (all, ul) => {
    const lis = [...ul.matchAll(/<li>[\s\S]*?<\/li>/g)].map((x) => x[0]);
    const kept = lis.filter((li) => !li.includes('class="nb-check-state"')).map(stripRow).filter(Boolean);
    if (kept.length === lis.length && kept.every((li, i) => li === lis[i])) return all;
    if (!kept.length) return '';
    return `<details class="nb-jbox nb-check" open><summary>来店前に確かめたいこと</summary><ul>${kept.join('')}</ul></details>`;
  });
}

function restyle(html) { return restyleChecklist(restyleConclusion(html)); }

function main() {
  const check = process.argv.includes('--check');
  const files = fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f)).sort();
  const changed = [];
  for (const f of files) {
    const p = path.join(DIR, f);
    const before = fs.readFileSync(p, 'utf8');
    const after = restyle(before);
    if (after === before) continue;
    changed.push(f);
    if (!check) fs.writeFileSync(p, after);
  }
  console.log(`${check ? '直す記事' : '直した記事'}: ${changed.length}本${changed.length ? `（${changed.join('・')}）` : ''}`);
  if (check && changed.length) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { restyle, restyleConclusion, restyleChecklist };
