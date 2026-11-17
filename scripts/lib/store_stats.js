'use strict';
/**
 * scripts/lib/store_stats.js — 掲載データの集計（店選びガイドの材料・媒体方針 計画 S3-4）
 *
 * data/stores.json の営業中の店を、エリア×ジャンルで集計する。出すのは、価格帯・平均予算（数字だけの店）・個室・喫煙・
 * 料金備考（お通し・席料／深夜料金の記載）の分布。対象件数と取得日を必ず添える。
 *
 * 守ること（data/editorial_standard.json の guide）:
 *   - 集計は「このサイトに載っている◯店のうち」であって名古屋全体の実態ではない。文面は必ずその書き出しにする
 *   - 項目に記載が無い店は「記載なし」と数え、「無い」とは書かない（個室・料金備考は空欄が多い）
 *   - 対象が minStores 店に満たなければ集計を出さない（少ない母数で相場観を作らない）
 * ネットワーク不要・決定的。
 */
const { loadStores } = require('./load_stores');
const { openStores } = require('./area_genre_pages');
const { loadStandard } = require('./editorial_standard');

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const has = (v) => v != null && String(v).trim() !== '';

/** 価格帯「3001～4000円」を並べ替え用の下限の数にする。読めなければ null */
function bandLower(label) {
  const m = /^(\d[\d,]*)/.exec(String(label || '').replace(/[,，]/g, ''));
  return m ? parseInt(m[1], 10) : null;
}

/** 平均予算が「3,500円」のように数字だけの店の値。文章の混じる記載は使わない（読み違えるため） */
function plainBudget(v) {
  const m = /^\s*([\d,]+)\s*円\s*$/.exec(String(v || ''));
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

function median(nums) {
  if (!nums.length) return null;
  const a = nums.slice().sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

/** エリアは「名古屋（名古屋駅/西区/中村区）」のような束ね表記なので部分一致。ジャンルは完全一致を優先し、無ければ部分一致 */
function selectStores(stores, { area, genre } = {}) {
  let list = openStores(stores);
  if (area) list = list.filter((s) => String(s['エリア'] || '').includes(area));
  if (genre) {
    const exact = list.filter((s) => s['ジャンル'] === genre);
    list = exact.length ? exact : list.filter((s) => String(s['ジャンル'] || '').includes(genre));
  }
  return list;
}

const FEE_RE = {
  otoshi: /お通し|席料|チャージ|テーブルチャージ|席代/,
  midnight: /深夜料金|深夜|23時以降|22時以降|24時以降/
};

/** 集計本体。stores は data/stores.json 相当（省略時は loadStores()） */
function aggregate(opts = {}, stores) {
  const all = stores || loadStores();
  const list = selectStores(all, opts);
  const n = list.length;

  const bandCount = new Map();
  list.forEach((s) => { const b = String(s['価格帯'] || '').trim(); if (b) bandCount.set(b, (bandCount.get(b) || 0) + 1); });
  const bands = [...bandCount.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => (bandLower(a.label) ?? 1e9) - (bandLower(b.label) ?? 1e9));
  const bandTotal = bands.reduce((t, b) => t + b.count, 0);
  // 価格帯の中央（下限の順に並べた真ん中の店が入る帯）
  let medianBand = null;
  if (bandTotal) {
    const target = (bandTotal + 1) / 2;
    let acc = 0;
    for (const b of bands) { acc += b.count; if (acc >= target) { medianBand = b.label; break; } }
  }

  const budgets = list.map((s) => plainBudget(s['平均予算'])).filter((x) => x != null);

  const privateYes = list.filter((s) => /^あり/.test(String(s['個室'] || '').trim())).length;

  const smoking = { 全面禁煙: 0, 一部禁煙: 0, 禁煙席なし: 0, 記載なし: 0 };
  list.forEach((s) => {
    const v = String(s['禁煙'] || '').trim();
    if (v === '全面禁煙' || v === '一部禁煙' || v === '禁煙席なし') smoking[v] += 1; else smoking['記載なし'] += 1;
  });

  const noteHas = list.filter((s) => has(s['料金備考']));
  const noteOtoshi = noteHas.filter((s) => FEE_RE.otoshi.test(String(s['料金備考']))).length;
  const noteMidnight = noteHas.filter((s) => FEE_RE.midnight.test(String(s['料金備考']))).length;

  const dates = list.map((s) => String(s['条件取得日'] || '')).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const asOf = dates.length ? dates[dates.length - 1] : '';

  return {
    area: opts.area || '', genre: opts.genre || '', n, asOf,
    price: { bands, withBand: bandTotal, medianBand },
    budget: { withPlain: budgets.length, median: median(budgets) },
    privateRoom: { yes: privateYes, noRecord: n - privateYes },
    smoking,
    feeNote: { withNote: noteHas.length, noNote: n - noteHas.length, otoshiMention: noteOtoshi, midnightMention: noteMidnight }
  };
}

const yen = (n) => `${Number(n).toLocaleString('en-US')}円`;
function ymdJa(ymd) { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(ymd || '')); return m ? `${parseInt(m[1], 10)}月${parseInt(m[2], 10)}日` : ''; }

/** 集計の前置き（「このサイトに載っている◯店のうち」）。文ごとには繰り返さず、箱の見出しに置く */
function scopeText(stats, std = loadStandard()) {
  return std.guide.scopeSentence.replace('{n}', String(stats.n));
}

/** 集計を、読者向けの文の配列にする。前置きは scopeText（箱の見出し）に寄せているので、文は前置きなしで始める */
function guideSentences(stats) {
  const out = [];
  const p = stats.price;
  if (p.withBand) out.push(`価格帯の記載がある${p.withBand}店では、「${p.medianBand}」が真ん中です。`);
  if (stats.budget.withPlain) out.push(`平均予算が金額だけで書かれている${stats.budget.withPlain}店の中央値は${yen(stats.budget.median)}です（文章混じりの記載は含めません）。`);
  const pr = stats.privateRoom;
  out.push(`個室ありの記載がある店は${pr.yes}店です（記載のない${pr.noRecord}店は、無いとは限りません）。`);
  const sm = stats.smoking;
  out.push(`喫煙の区分は、全面禁煙${sm['全面禁煙']}店・一部禁煙${sm['一部禁煙']}店・禁煙席なし${sm['禁煙席なし']}店・記載なし${sm['記載なし']}店です。`);
  const f = stats.feeNote;
  out.push(`料金の備考がある${f.withNote}店のうち、お通し・席料などの記載がある店は${f.otoshiMention}店、深夜料金の記載がある店は${f.midnightMention}店です（備考のない${f.noNote}店は、無料とは限りません）。`);
  return out;
}

/** 記事に差し込む HTML。対象件数と取得日・「名古屋全体の実態ではない」断りを必ず添える。母数が足りなければ例外 */
function buildGuideBlock({ area, genre, checked, stores } = {}) {
  const std = loadStandard();
  const stats = aggregate({ area, genre }, stores);
  if (stats.n < std.guide.minStores) throw new Error(`集計の対象が${stats.n}店で、基準（${std.guide.minStores}店）に満たない（${area || '全エリア'}・${genre || '全ジャンル'}）`);
  const asOf = checked || stats.asOf;
  const when = ymdJa(asOf) ? `${ymdJa(asOf)}時点` : '取得日不明';
  const lis = guideSentences(stats).map((t) => `<li>${esc(t)}</li>`).join('');
  const target = [area, genre].filter(Boolean).join('・') || '全エリア・全ジャンル';
  return `<div class="nb-guide-stats nb-jbox"><p class="nb-guide-title">${esc(scopeText(stats, std))}（${esc(target)}・${esc(when)}の掲載データ）</p><ul>${lis}</ul><p class="nb-guide-note">このサイトに載っている店の中での集計です。名古屋全体の実態を表すものではありません。営業中の店だけを数え、掲載情報は店が公開した内容にもとづきます。</p></div>`;
}

module.exports = { aggregate, selectStores, scopeText, guideSentences, buildGuideBlock, bandLower, plainBudget, median };
