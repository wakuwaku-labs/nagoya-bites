#!/usr/bin/env node
'use strict';
/**
 * scripts/apply_confirmation_memo.js — 検索流入のある特集6本に「確認メモ」の区画を足す（基本方針 S5-2・ADR 0069）
 *
 * 各特集の掲載店を data/stores.json（ホットペッパーID で照合）の項目と1店ずつ突き合わせ、
 * 「確認できたこと／未確認」を確認日つきで出す。データに無い項目は「未確認」と書く（推測で埋めない）。
 * 題・URL・冒頭・店カードには触れず、最後の店カードの後ろにある次の見出しの直前へ、独立した区画
 * （<details class="nb-confirm-memo" data-nb-confirm-memo>）を1つだけ足す。2回当てても結果は同じ（冪等）。
 *
 * 使い方:
 *   node scripts/apply_confirmation_memo.js            # 6本を更新
 *   node scripts/apply_confirmation_memo.js --check    # 掲載店に対して確認メモが欠けている店を表示（落とさない）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES = ['nagoya-solo-dining', 'date', 'nagoya-tebasaki', 'nagoya-autumn-2026', 'nagoya-miso-nikomi-udon', 'kospa-insider'];
const START = '<!-- NB_CONFIRM_MEMO_START -->';
const END = '<!-- NB_CONFIRM_MEMO_END -->';
const UNCONFIRMED = '未確認';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '未確認';

function smoking(v) {
  if (!has(v)) return UNCONFIRMED;
  if (/全面禁煙/.test(v)) return '全面禁煙';
  if (/一部禁煙/.test(v)) return '一部の席が禁煙（喫煙できる席もあります）';
  if (/禁煙席なし/.test(v)) return '禁煙席なし（店内で喫煙できます）';
  return String(v);
}

function chargeNote(s) {
  const t = [s['料金備考'], s['店舗備考'], s['その他設備']].filter(has).join(' ');
  const hit = t.split(/[。！\n]/).map((x) => x.trim()).filter((x) => /お通し|席料|チャージ|サービス料|テーブルチャージ/.test(x));
  if (!hit.length) return UNCONFIRMED;
  return hit.slice(0, 2).join('／').slice(0, 80);
}

function openStatus(v) {
  if (v === 'OPERATIONAL') return 'Google の店舗情報では営業中';
  if (v === 'CLOSED_TEMPORARILY') return 'Google の店舗情報では一時休業中';
  return UNCONFIRMED;
}

function seats(s) {
  const parts = [];
  if (has(s['席数'])) parts.push(`${s['席数']}席`);
  const tags = String(s['タグ'] || '').split(',').map((x) => x.trim());
  if (tags.includes('カウンター')) parts.push('カウンターあり（掲載データのタグ）');
  if (has(s['個室'])) parts.push(`個室 ${String(s['個室']).replace(/^あり ：/, '')}`.replace('個室 あり', '個室あり'));
  return parts.length ? parts.join('・') : UNCONFIRMED;
}

// 掲載データの営業時間は、長い文字列が途中で切れていることがある。
// そこで「最初の曜日区分の、時間帯だけ」を完全な形で出す（ラストオーダーの括弧は出さない）。
// 時間帯どうしが区切りなしでつながっている（05:3011:30）ものは「、」で区切る。
function hours(s) {
  if (!has(s['営業時間'])) return UNCONFIRMED;
  const t = String(s['営業時間']).replace(/\s+/g, ' ').replace(/(\d{1,2}:\d{2})(?=\d{1,2}:\d{2})/g, '$1、').trim();
  const seg = t.split(/(?<=[\d）) ])(?=[月火水木金土日祝][月火水木金土日祝～、前]*[:：])/);
  const first = seg[0];
  const days = (/^([^:：]+)[:：]/.exec(first) || [])[1];
  const ranges = first.match(/\d{1,2}:\d{2}～翌?\d{1,2}:\d{2}/g);
  if (!days || !ranges) return UNCONFIRMED;
  const head = `${days.trim()} ${ranges.join('、')}`;
  return seg.length > 1 ? `${head}（ほかの曜日は異なります）` : head;
}

function rowsFor(s) {
  return [
    ['営業の状況', openStatus(s['営業ステータス'])],
    ['営業時間', hours(s)],
    ['定休日', has(s['定休日']) ? s['定休日'] : UNCONFIRMED],
    ['席', seats(s)],
    ['喫煙', smoking(s['禁煙'])],
    ['お通し・席料', chargeNote(s)],
    ['予約・混雑', UNCONFIRMED],
  ];
}

// 店リストの範囲 = 最後の店クリックの直前にある見出し（h2）から、その次の h2 まで。
// 本文中の関連リンクや「掲載外の店の写真」の店は数えない。
function listRegion(html) {
  const clicks = [...html.matchAll(/feature_store_click',\{store:'\w+'/g)];
  if (!clicks.length) return null;
  const lastPos = clicks[clicks.length - 1].index;
  const start = html.slice(0, lastPos).lastIndexOf('<h2');
  const m = /<h2[\s>]/.exec(html.slice(lastPos));
  const end = m ? lastPos + m.index : html.length;
  return { start: start < 0 ? 0 : start, end };
}

function extractIds(html) {
  const r = listRegion(html);
  if (!r) return [];
  const seg = html.slice(r.start, r.end);
  const ids = [];
  const re = /feature_store_click',\{store:'(\w+)'/g;
  let m;
  while ((m = re.exec(seg))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

function buildBlock(html, byId) {
  const ids = extractIds(html);
  const dates = ids.map((id) => byId.get(id)).filter(Boolean).map((s) => s['条件取得日']).filter(has).sort();
  const latest = dates.length ? dates[dates.length - 1] : UNCONFIRMED;
  const items = ids.map((id, i) => {
    const s = byId.get(id);
    const num = String(i + 1).padStart(2, '0');
    if (!s) return `<div class="nb-confirm-store"><p class="nb-confirm-name">${num}　（掲載データに見つかりません）</p><ul class="nb-confirm-list"><li class="nb-confirm-un"><span class="nb-confirm-k">未確認</span>この店の掲載データ</li></ul></div>`;
    const all = rowsFor(s);
    const rows = all.filter(([, v]) => v !== UNCONFIRMED).map(([k, v]) => `<li><span class="nb-confirm-k">${esc(k)}</span>${esc(v)}</li>`).join('');
    const un = all.filter(([, v]) => v === UNCONFIRMED).map(([k]) => k);
    const d = has(s['条件取得日']) ? s['条件取得日'] : UNCONFIRMED;
    const dateLi = d === UNCONFIRMED ? '' : `<li><span class="nb-confirm-k">確認日</span>${esc(d)}</li>`;
    const unLi = un.length || d === UNCONFIRMED ? `<li class="nb-confirm-un"><span class="nb-confirm-k">未確認</span>${esc(un.concat(d === UNCONFIRMED ? ['確認日'] : []).join('・'))}</li>` : '';
    return `<div class="nb-confirm-store"><p class="nb-confirm-name">${num}　${esc(s['店名'])}</p><ul class="nb-confirm-list">${rows}${dateLi}${unLi}</ul></div>`;
  }).join('\n');
  return `${START}
<details class="nb-confirm-memo" data-nb-confirm-memo>
<summary>確認メモ — 掲載店ごとの「確認できたこと」と「未確認のこと」</summary>
<p class="nb-confirm-lead">確認先は、ホットペッパーグルメの掲載情報（取得日 ${esc(latest)} 時点）と Google の店舗情報です。AIが掲載データと突き合わせた記録で、店に問い合わせたものではありません。載っていない項目は「未確認」と書き、推測では埋めていません。お通し・席料・喫煙・予約は変わることがあるので、行く前に店へ確かめてください。</p>
${items}
<p class="nb-note nb-confirm-foot">毎月の掲載店の入れ替えのあと、確認メモを作り直すまでは、入れ替わった店の分が載っていないことがあります。</p>
<style>
.nb-confirm-memo{margin:var(--sp-5) 0;border:1px solid var(--card-border);border-radius:var(--r-md);background:var(--bg2);border-left:3px solid var(--card-border);padding:var(--sp-3) var(--sp-4);}
.nb-confirm-memo summary{cursor:pointer;font-weight:500;font-size:var(--fs-sm);color:var(--ink);}
.nb-confirm-lead{font-size:var(--fs-xs);line-height:1.8;color:var(--muted);margin:var(--sp-3) 0;}
.nb-confirm-store{border-top:1px solid var(--card-border);padding:var(--sp-3) 0;}
.nb-confirm-name{font-size:var(--fs-sm);font-weight:500;color:var(--ink);margin-bottom:.3rem;}
.nb-confirm-memo .nb-confirm-list{list-style:none;padding:0;margin:0;font-size:var(--fs-xs);line-height:1.8;color:var(--muted);}
.nb-confirm-list li{display:flex;gap:.6em;}
.nb-confirm-k{flex:0 0 5.5em;color:var(--dim);}
.nb-confirm-un{color:var(--dim);}
</style>
</details>
${END}`;
}

function apply(html, byId) {
  // 既存の区画は作り直す（冪等）
  html = html.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n*`), '');
  const r = listRegion(html);
  if (!r) return html;
  return html.slice(0, r.end) + buildBlock(html, byId) + '\n\n' + html.slice(r.end);
}

function load() {
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const byId = new Map();
  for (const s of stores) if (s['ホットペッパーID']) byId.set(s['ホットペッパーID'], s);
  return byId;
}

module.exports = { FEATURES, apply, buildBlock, extractIds, START, END };

if (require.main === module) {
  const byId = load();
  const check = process.argv.includes('--check');
  for (const f of FEATURES) {
    const p = path.join(ROOT, 'features', f + '.html');
    const html = fs.readFileSync(p, 'utf8');
    if (check) {
      const ids = extractIds(html);
      const memo = (html.match(new RegExp(`${START}[\\s\\S]*?${END}`)) || [''])[0];
      const missing = ids.filter((id) => byId.get(id) && !memo.includes(esc(byId.get(id)['店名'])));
      console.log(`${f}: 掲載 ${ids.length} 店 / メモに無い ${missing.length} 店`, missing.join(','));
    } else {
      const out = apply(html, byId);
      if (out !== html) fs.writeFileSync(p, out);
      console.log(`${f}: ${extractIds(out).length} 店`);
    }
  }
}
