'use strict';
/**
 * scripts/lib/editorial_standard.js — 編集基準（data/editorial_standard.json）の読み込みと、記事の「判断材料」の部品の組み立て・検査
 * （媒体方針 計画 S3-1・S3-2・docs/plans/media-policy-2026-11 の 1-1・1-6）。
 *
 * 書き手の指示（agents/editor.md）・記事の部品（generate_daily_draft.js）・検査が同じ基準を読むための1本。
 * 無い項目は「警告」の文字列で返すだけで、止めない（段階4の承認後に条件へ・決定6）。ネットワーク不要・決定的。
 */
const fs = require('fs');
const path = require('path');

const STANDARD_PATH = path.join(__dirname, '..', '..', 'data', 'editorial_standard.json');

let cache = null;
function loadStandard(file = STANDARD_PATH) {
  if (file === STANDARD_PATH && cache) return cache;
  const std = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (file === STANDARD_PATH) cache = std;
  return std;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** 2026-11-16 → 11月16日。形式が違えば空（でたらめな日付を出さない） */
function monthDayJa(ymd) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? `${parseInt(m[1], 10)}月${parseInt(m[2], 10)}日` : '';
}

/** 定型7項目（id と label の配列） */
function checklistItems(std = loadStandard()) {
  return std.checklist.items.map((i) => ({ id: i.id, label: i.label }));
}

/**
 * 入力の checklist を定型7項目の順に並べて正規化する。
 * 入力の形: [{ item: 'お通し・席料'（label か id）, status: 'confirmed'|'unconfirmed', value, source, checked }]
 * 返り値: { rows: 定型の順（入力に無い項目は status:'missing'）, extras: 定型に無い項目 }
 */
function normalizeChecklist(list, std = loadStandard()) {
  const items = std.checklist.items;
  const byKey = new Map();
  const extras = [];
  (Array.isArray(list) ? list : []).forEach((r) => {
    if (!r || !r.item) return;
    const hit = items.find((i) => i.id === r.item || i.label === r.item);
    const status = r.status === 'confirmed' && String(r.value || '').trim() ? 'confirmed' : 'unconfirmed';
    const row = { id: hit ? hit.id : '', label: hit ? hit.label : String(r.item), status, value: String(r.value || '').trim(), source: String(r.source || '').trim(), checked: String(r.checked || '') };
    if (hit) byKey.set(hit.id, row); else extras.push(row);
  });
  const rows = items.map((i) => byKey.get(i.id) || { id: i.id, label: i.label, status: 'missing', value: '', source: '', checked: '' });
  return { rows, extras };
}

/** 状態の帯の1行。確認日が無ければ記事の日付を使う（書き手の申告・台帳と同じ扱い） */
function statusBandText(input, std = loadStandard()) {
  const sb = std.statusBand;
  const st = (input && input.status) || {};
  const md = monthDayJa(st.checked || (input && input.date));
  const visit = st.visited === true ? sb.visitedTrue : sb.visitedFalse;
  const tpl = st.pre_open ? sb.preOpenTemplate : sb.template;
  return tpl.replace('{checked}', md || '日付未確認').replace('{visit}', visit);
}

function buildStatusBand(input, std = loadStandard()) {
  return `<p class="nb-status-band" role="note">${esc(statusBandText(input, std))}</p>`;
}

/** 確認できなかった項目の数。未記入（missing）も「確認できていない」に数える */
function unknownCount(input, std = loadStandard()) {
  const { rows, extras } = normalizeChecklist(input && input.checklist, std);
  return rows.filter((r) => r.status !== 'confirmed').length + extras.filter((r) => r.status !== 'confirmed').length;
}

function liList(arr) { return (arr || []).map((s) => String(s || '').trim()).filter(Boolean).map((s) => `<li>${esc(s)}</li>`).join(''); }

/**
 * 「先に結論」（3行）。class に insider-box を残す: X（x_post.js）・note（note_draft.js）が箇条書きを引用元にしているため。
 * 入力 conclusion: { fit: 向く人, check_first: 来店前にいちばん確かめたい点 }。分からなかった点の数は checklist から数える。
 * fit も check_first も無ければ空（古い入力は従来の「知っておきたいポイント」のまま）。
 */
function buildConclusion(input, std = loadStandard()) {
  const c = (input && input.conclusion) || {};
  if (!c.fit && !c.check_first) return '';
  const unknown = unknownCount(input, std);
  const lines = [];
  if (c.fit) lines.push(`向く人: ${c.fit}`);
  if (c.check_first) lines.push(`来店前にいちばん確かめたい点: ${c.check_first}`);
  lines.push(`分からなかった点: ${unknown}点（下の「来店前に確かめたいこと」に項目ごとに書いています）`);
  return `<div class="insider-box nb-conclusion"><p class="insider-title">先に結論</p><ul>${liList(lines)}</ul></div>`;
}

function rowText(r, std) {
  const md = monthDayJa(r.checked);
  const tail = [r.source, md ? `${md}確認` : ''].filter(Boolean).join('・');
  if (r.status === 'confirmed') return `${r.value}${tail ? `（${tail}）` : ''}`;
  return `${std.unconfirmed.notFoundText}${tail ? `（${tail}）` : '（確認先・確認日は未記入）'}`;
}

/** 「来店前に確かめたいこと」。定型7項目を1項目1行。確認できた／確認できなかったは言葉で書く（色だけで区別しない） */
function buildChecklist(input, std = loadStandard()) {
  const has = input && ((Array.isArray(input.checklist) && input.checklist.length) || input.conclusion);
  if (!has) return '';
  const { rows, extras } = normalizeChecklist(input.checklist, std);
  const li = (r) => {
    const state = r.status === 'confirmed' ? '確認できた' : '確認できなかった';
    return `<li><span class="nb-check-name">${esc(r.label)}</span> <span class="nb-check-state">${state}</span>: ${esc(rowText(r, std))}</li>`;
  };
  return `<details class="nb-judge nb-check" open><summary>来店前に確かめたいこと</summary><ul>${rows.concat(extras).map(li).join('')}</ul></details>`;
}

/** 「向く人・向かない人」。両方空なら出さない */
function buildFit(input) {
  const yes = liList(input && input.fit_for);
  const no = liList(input && input.not_fit_for);
  if (!yes && !no) return '';
  const col = (title, list) => (list ? `<div class="nb-fit-col"><h3 class="nb-fit-title">${title}</h3><ul>${list}</ul></div>` : '');
  return `<div class="nb-judge nb-fit">${col('向く人', yes)}${col('向かない人', no)}</div>`;
}

/**
 * 訂正の履歴（S4-4 の道具が入力 corrections／出来上がりの HTML に行を足す）。{ date, text } の配列。
 * 道具が見つけられるよう、履歴が空でも data-correction-log の要素と空の ul を必ず出す。空のときは hidden（道具が行を足すとき外す）。
 */
function buildCorrections(input) {
  const list = ((input && input.corrections) || []).filter((c) => c && c.text);
  const lis = list.map((c) => `<li>${c.date ? `<span class="nb-corr-date">${esc(monthDayJa(c.date) || c.date)}</span> ` : ''}${esc(c.text)}</li>`).join('');
  return `<details class="nb-judge nb-corrections" data-correction-log${list.length ? '' : ' hidden'}><summary>訂正の履歴</summary><ul>${lis}</ul></details>`;
}

/** 写真の種類（店の提供写真・プレスリリース・完成予想図）。不明なら空 */
function photoKindLabel(input) {
  const k = (input && input.hero_image_kind) || '';
  return ({ store_provided: '店の提供写真', press_release: 'プレスリリース', rendering: '完成予想図（イメージパース）' })[k] || '';
}

/** 警告（止めない）。無い項目を文で返す */
function judgementWarnings(input, std = loadStandard()) {
  const w = [];
  if (!input) return w;
  if (!(input.conclusion && (input.conclusion.fit || input.conclusion.check_first))) w.push('「先に結論」（conclusion.fit / check_first）がありません');
  const { rows } = normalizeChecklist(input.checklist, std);
  rows.filter((r) => r.status === 'missing').forEach((r) => w.push(`「来店前に確かめたいこと」の「${r.label}」が未記入です（確認できなければ status:unconfirmed と確認先・確認日を書く）`));
  rows.filter((r) => r.status !== 'missing').forEach((r) => { if (!r.source || !monthDayJa(r.checked)) w.push(`「${r.label}」に確認先または確認日がありません`); });
  if (!(input.fit_for || []).length || !(input.not_fit_for || []).length) w.push('「向く人・向かない人」がそろっていません');
  if (!(input.sources || []).length) w.push('出典（sources）がありません');
  if (!(input.status && input.status.checked)) w.push('状態の帯の確認日（status.checked）が無いので記事の日付で代用します');
  return w;
}

module.exports = { STANDARD_PATH, loadStandard, checklistItems, normalizeChecklist, statusBandText, buildStatusBand, unknownCount, buildConclusion, buildChecklist, buildFit, buildCorrections, photoKindLabel, judgementWarnings, monthDayJa };
