#!/usr/bin/env node
'use strict';
/**
 * 事実の検査（S4-1〜S4-3）を本番の条件にする前の検証（S4-5 の準備と測定）。
 * 計画: docs/plans/media-policy-2026-11/03-implementation-plan.md S4-5。結果は docs/plans/media-policy-2026-11/s4-5-calibration.md。
 *
 * 合格の線（動かさない）: わざと壊した記事20本のうち19本以上を検出／正しい記事30本のうち誤って「保留」になるのは3本以下。
 * 届かないときは線ではなく検査（scripts/lib/claims.js）を直す。
 *
 *   node scripts/claims_gate_calibrate.js                  # 見本（tests/fixtures/claims_calibration/cases.json）で測る
 *   node scripts/claims_gate_calibrate.js --check          # 線に届かなければ終了コード1
 *   node scripts/claims_gate_calibrate.js --build-fixtures # 見本を作り直す（決まった手順で作るので毎回同じ中身）
 *   node scripts/claims_gate_calibrate.js --live 30        # 直近の公開記事で、出典の取得の成功率・保留になる本数を測る（ネットワークを使う）
 *
 * 見本の「壊した記事」は5種類を各4本: 数字を変える／出典を別のページに差し替える／推測の目印を外して断定にする／
 * 閉業の店を足す／行ったように書く。「正しい記事」は30本（表記ゆれ・予定の書き方・計算の文・出典の1つが取得できない日を含む）。
 * 第三者のページの全文は置かない。出典の文章は、見本のために作った短い文だけ。
 */
const fs = require('fs');
const path = require('path');
const { buildLedger } = require('./verify_article_claims');
const C = require('./lib/claims');
const { decide } = require('./journal_lane');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'claims_calibration', 'cases.json');
const LINE = { detect_min: 19, broken_total: 20, false_hold_max: 3, correct_total: 30 };

// ── 見本づくり（決まった手順。乱数は使わない）──────────────────────────
const NAMES = ['炉端 そよ風', '串焼き 月あかり', '個室居酒屋 琥珀', '海鮮 波の音', '鳥料理 朝霧', '和bar 夜明け前', '焼肉 山の端', '酒場 灯り横丁', '肉バル 鉄鍋屋', '寿司 潮騒', '天ぷら 若葉', 'もつ鍋 星屑', '鉄板 夕凪', '蕎麦 風待ち', '餃子酒場 桜小路', 'ワイン食堂 銀杏', '韓国料理 青磁', '中華 紅葉亭', '創作 和み庵', '牡蠣小屋 岬', '炭火 鳳凰', '居酒屋 瑠璃', '焼鳥 白鷺', 'しゃぶしゃぶ 雲海', 'イタリアン 麦穂', '鰻 川端', '串揚げ 木漏れ日', '釜飯 竹の子', '鍋 いろは坂', '日本酒 蔵びらき'];

function fmtPrice(n, i) {
  const m = i % 4;
  if (m === 0) return `${n.toLocaleString('en-US')}円`;
  if (m === 1) return `${n}円`;
  if (m === 2) return `${String(n.toLocaleString('en-US')).replace(/[0-9,]/g, (c) => (c === ',' ? '，' : String.fromCharCode(c.charCodeAt(0) + 0xfee0)))}円`;
  return `${n.toLocaleString('en-US')}円（税込）`;
}

function base(i) {
  const price = 3000 + ((i * 137) % 2500) - (((i * 137) % 2500) % 10) + 90 + i; // 全員違う価格
  return {
    i,
    id: `FX${String(i + 1).padStart(3, '0')}`,
    name: NAMES[i % NAMES.length],
    price,
    mins: [90, 120, 150, 180][i % 4],
    seats: 18 + i * 3,
    m: 11 + (i % 2),
    d: 5 + ((i * 3) % 23),
    m2: 12,
    d2: 1 + (i % 9),
    open: 11 + (i % 3),
    close: 21 + (i % 3),
  };
}

function sourceA(b, { hedge = false, closed = false } = {}) {
  const dateTxt = b.i % 2 ? `${b.m}/${b.d}まで` : `${b.m}月${b.d}日まで`;
  return [
    `${b.name} 店舗情報。ご予約・ご来店の前にご確認ください。メニュー・料金は変更になる場合があります。`,
    `コース ${fmtPrice(b.price, b.i)} 全8品 飲み放題 ${b.mins}分 客席数 ${b.seats}席 営業時間 ${b.open}時〜${b.close}時 予約受付 ${dateTxt}`,
    hedge ? `ネット予約の受付は${b.m2}月${b.d2}日開始予定です。` : `ネット予約は随時受付中です。`,
    closed ? `${b.name}は閉店いたしました。長らくのご愛顧ありがとうございました。` : `当店は名古屋駅から徒歩5分。個室・掘りごたつあり。`,
    'お支払い方法はクレジットカード・電子マネーに対応しています。以上、店舗情報でした。',
  ].join('\n');
}

function sourceB(b) {
  return `${b.name}の紹介記事。${b.name}は名古屋の人気店として知られ、忘年会の予約が増えている。客席数は${b.seats}席。コースは${b.price}円。そのほか個室の用意もある。詳しくは店舗の案内を確認してください。`;
}

function articleHtml(b, { hedgeKept = false, hedgeDropped = false, arithmetic = false, visit = null, extraPrice = null, extraMins = null, extraSeats = null, bSource = true } = {}) {
  const price = extraPrice || b.price;
  const mins = extraMins || b.mins;
  const seats = extraSeats || b.seats;
  const paras = [
    `${b.name}のコースは${price}円で、飲み放題は${mins}分。`,
    `客席数は${seats}席で、予約受付は${b.m}月${b.d}日まで。`,
    '個室や掘りごたつもあるので、少人数の会でも使いやすい。名古屋駅から徒歩5分。',
  ];
  if (hedgeKept) paras.push(`ネット予約は${b.m2}月${b.d2}日に始まる予定だ。`);
  if (hedgeDropped) paras.push(`ネット予約は${b.m2}月${b.d2}日に始まる。`);
  if (arithmetic) paras.push(`4人で行くと1人あたり${price}円、合計${price * 4}円になる。`);
  if (visit) paras.push(visit);
  const srcs = [`<a href="https://src.example/a/${b.id}" target="_blank" rel="noopener">店舗情報 ${b.name}</a><span class="source-date">（2026-11-05掲載）</span>`];
  if (bSource) srcs.push(`<a href="https://src.example/b/${b.id}" target="_blank" rel="noopener">紹介記事 ${b.name}</a><span class="source-date">（2026-11-04掲載）</span>`);
  return [
    '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">',
    `<title>${b.name}のコースは${price}円で飲み放題${mins}分｜NAGOYA BITES Journal</title>`,
    `<meta name="description" content="${b.name}のコースと飲み放題を整理する。">`,
    '</head><body><article>',
    `<h1 class="art-title">${b.name}のコースは${price}円で飲み放題${mins}分</h1>`,
    `<p class="art-lead">${b.name}の忘年会向けコースを、料金と予約の締切で整理した。</p>`,
    '<div class="art-body">',
    ...paras.map((p) => `<p>${p}</p>`),
    `<div class="store-card"><a href="../stores/${b.id}.html">店舗ページを見る →</a></div>`,
    `<div class="source-note"><strong>情報源:</strong> ${srcs.join('、 ')}</div>`,
    '</div></article><!-- NB_X_FOLLOW_START --></body></html>',
  ].join('\n');
}

function makeCases() {
  const cases = [];
  const bases = Array.from({ length: 50 }, (_, i) => base(i));
  const store = (b, status = 'OPERATIONAL') => ({ 店舗ID: b.id, 店名: b.name, 営業ステータス: status });
  const mk = (b, label, type, html, srcA, srcB, stores) => cases.push({
    id: `${label}-${type}-${b.id}`, label, type, html,
    sources: {
      [`https://src.example/a/${b.id}`]: srcA === null ? { ok: false, reason: 'http_404' } : { ok: true, text: srcA },
      [`https://src.example/b/${b.id}`]: srcB === null ? { ok: false, reason: 'empty_body' } : { ok: true, text: srcB },
    },
    stores: stores || [store(b)],
  });

  // 正しい記事30本: 20 通常 + 4 予定の書き方が出典と合っている + 3 計算の文 + 3 出典の1つが取得できない
  let k = 0;
  for (let n = 0; n < 20; n++, k++) { const b = bases[k]; mk(b, 'correct', 'clean', articleHtml(b), sourceA(b), sourceB(b)); }
  for (let n = 0; n < 4; n++, k++) { const b = bases[k]; mk(b, 'correct', 'hedge_kept', articleHtml(b, { hedgeKept: true }), sourceA(b, { hedge: true }), sourceB(b)); }
  for (let n = 0; n < 3; n++, k++) { const b = bases[k]; mk(b, 'correct', 'arithmetic', articleHtml(b, { arithmetic: true }), sourceA(b), sourceB(b)); }
  for (let n = 0; n < 3; n++, k++) { const b = bases[k]; mk(b, 'correct', 'one_source_unreachable', articleHtml(b), sourceA(b), null); }

  // 壊した記事20本（各4本）
  const tam = [
    (b) => ({ html: articleHtml(b, { extraPrice: b.price + 500 }), a: sourceA(b), b: sourceB(b) }), // コースの価格
    (b) => ({ html: articleHtml(b, { extraPrice: b.price - 300 }), a: sourceA(b), b: sourceB(b) }),
    (b) => ({ html: articleHtml(b, { extraMins: b.mins + 30 }), a: sourceA(b), b: sourceB(b) }), // 飲み放題の分数
    (b) => ({ html: articleHtml(b, { extraSeats: b.seats + 12 }), a: sourceA(b), b: sourceB(b) }), // 客席数
  ];
  for (let n = 0; n < 4; n++, k++) { const b = bases[k]; const t = tam[n](b); mk(b, 'broken', 'number_changed', t.html, t.a, t.b); }
  for (let n = 0; n < 4; n++, k++) { const b = bases[k]; const o = bases[(k + 11) % 50]; mk(b, 'broken', 'source_swapped', articleHtml(b), sourceA(o), sourceB(o)); }
  for (let n = 0; n < 4; n++, k++) { const b = bases[k]; mk(b, 'broken', 'hedge_dropped', articleHtml(b, { hedgeDropped: true }), sourceA(b, { hedge: true }), sourceB(b)); }
  for (let n = 0; n < 4; n++, k++) {
    const b = bases[k];
    if (n < 2) mk(b, 'broken', 'closed_store', articleHtml(b), sourceA(b), sourceB(b), [store(b, n === 0 ? 'CLOSED_PERMANENTLY' : 'CLOSED_TEMPORARILY')]);
    else mk(b, 'broken', 'closed_store', articleHtml(b), sourceA(b, { closed: true }), sourceB(b));
  }
  const visits = ['実際に食べてみたところ、肉は柔らかく飲みやすかった。', '編集部が行ってきたが、店内は静かだった。', '昼に伺ったところ、店主が丁寧に説明してくれた。', '筆者が試したコースは量が多く、満足できた。'];
  for (let n = 0; n < 4; n++, k++) { const b = bases[k]; mk(b, 'broken', 'visit_claim', articleHtml(b, { visit: visits[n] }), sourceA(b), sourceB(b)); }
  return cases;
}

// ── 測る ──────────────────────────────────────────────────────────────
async function evalCase(c) {
  const storesMap = new Map((c.stores || []).map((s) => [String(s['店舗ID']), s]));
  const fetcher = async (url) => {
    const s = (c.sources || {})[url];
    return s && s.ok ? { ok: true, status: 200, text: s.text } : { ok: false, status: 404, reason: (s && s.reason) || 'no_fixture' };
  };
  const L = await buildLedger(c.html, { date: '2026-11-17', slug: c.id, fetcher, storesMap, cache: false, gate: { mode: 'shadow', fetchTimeoutSec: 1, maxSources: 10 } });
  const d = decide({ claims: L });
  return { id: c.id, label: c.label, type: c.type, lane: d.lane, stop: d.stop.map((x) => x.type), fixable: d.fixable.length };
}

async function runFixtures(cases) {
  const rows = [];
  for (const c of cases) rows.push(await evalCase(c));
  const broken = rows.filter((r) => r.label === 'broken');
  const correct = rows.filter((r) => r.label === 'correct');
  const detected = broken.filter((r) => r.lane !== 'auto_publish');
  const detectedAsHold = broken.filter((r) => r.lane === 'hold');
  const falseHold = correct.filter((r) => r.lane === 'hold');
  const correctFix = correct.filter((r) => r.lane === 'auto_fix');
  const byType = {};
  for (const r of broken) {
    byType[r.type] = byType[r.type] || { total: 0, detected: 0, hold: 0 };
    byType[r.type].total++;
    if (r.lane !== 'auto_publish') byType[r.type].detected++;
    if (r.lane === 'hold') byType[r.type].hold++;
  }
  return {
    line: LINE,
    broken: { total: broken.length, detected: detected.length, detected_as_hold: detectedAsHold.length, by_type: byType, missed: broken.filter((r) => r.lane === 'auto_publish').map((r) => r.id) },
    correct: { total: correct.length, false_hold: falseHold.length, auto_fix: correctFix.length, false_hold_ids: falseHold.map((r) => `${r.id}:${r.stop.join('+')}`) },
    pass: broken.length === LINE.broken_total && correct.length === LINE.correct_total && detected.length >= LINE.detect_min && falseHold.length <= LINE.false_hold_max,
    rows,
  };
}

async function runLive(n) {
  const pub = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'journal_published.json'), 'utf8'));
  const entries = (pub.entries || []).filter((e) => e.slug && fs.existsSync(path.join(ROOT, 'journal', `${e.slug}.html`))).slice(-n);
  const rows = [];
  let srcTotal = 0;
  let srcOk = 0;
  const failReasons = {};
  const byHost = {};
  for (const e of entries) {
    const html = fs.readFileSync(path.join(ROOT, 'journal', `${e.slug}.html`), 'utf8');
    const L = await buildLedger(html, { date: e.date, slug: e.slug, cache: false });
    const d = decide({ claims: L });
    srcTotal += L.fetch_summary.sources;
    srcOk += L.fetch_summary.ok;
    for (const s of L.sources) {
      const h = new URL(s.url).hostname.replace(/^www\./, '');
      byHost[h] = byHost[h] || { total: 0, ok: 0 };
      byHost[h].total++;
      if (s.fetch.ok) byHost[h].ok++;
    }
    for (const f of L.fetch_summary.failed) failReasons[f.reason] = (failReasons[f.reason] || 0) + 1;
    rows.push({ date: e.date, lane: d.lane, claims: L.summary.claims, verified: L.summary.verified, unverifiable: L.summary.unverifiable, stop: d.stop.map((x) => x.type), detail: d.stop.map((x) => x.detail.slice(0, 80)) });
  }
  const count = (l) => rows.filter((r) => r.lane === l).length;
  const claimsAll = rows.reduce((a, r) => a + r.claims, 0);
  const verifiedAll = rows.reduce((a, r) => a + r.verified, 0);
  const topHosts = Object.entries(byHost).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([h, v]) => `${h} ${v.ok}/${v.total}`);
  return {
    articles: rows.length,
    sources: { total: srcTotal, fetched: srcOk, rate: srcTotal ? Number((srcOk / srcTotal).toFixed(3)) : null, fail_reasons: failReasons, by_host: topHosts },
    claims: { total: claimsAll, verified: verifiedAll, rate: claimsAll ? Number((verifiedAll / claimsAll).toFixed(3)) : null },
    lanes: { auto_publish: count('auto_publish'), auto_fix: count('auto_fix'), hold: count('hold') },
    hold_rows: rows.filter((r) => r.lane === 'hold'),
    note: '過去の記事は出典のページが書き換わっていることがある（毎朝の本番は公開直後に動くので、出典が新しい分だけ誤保留は減る）',
  };
}


/**
 * 実際の公開記事に、価格を1か所だけ書き換えた改ざんを入れて、検出できるかを測る（ネットワークを使う）。
 * 見本（合成）より実態に近い「数字を変える」の測定。出典の取得は1記事1回だけ（取り直さない）。
 */
async function runLiveTamper(n) {
  const pub = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'journal_published.json'), 'utf8'));
  const entries = (pub.entries || []).filter((e) => e.slug && fs.existsSync(path.join(ROOT, 'journal', `${e.slug}.html`))).slice(-n);
  const out = [];
  for (const e of entries) {
    const html = fs.readFileSync(path.join(ROOT, 'journal', `${e.slug}.html`), 'utf8');
    const memo = new Map();
    const fetcher = async (u) => { if (!memo.has(u)) memo.set(u, await C.fetchSourceLive(u, { timeoutMs: 15000 })); return memo.get(u); };
    const L0 = await buildLedger(html, { date: e.date, slug: e.slug, fetcher, cache: false });
    // 照合できた文のうち、直前の言葉が3字以上ある価格（円）の数字を1つ選ぶ
    let target = null;
    for (const c of L0.claims) {
      if (c.status !== '照合できた' || c.kind !== '確認済みの事実') continue;
      for (const t of C.claimTokens(c.text)) {
        if (t.kind !== 'num' || t.key.length < 3 || C.unitAfter(c.text, t) !== '円' || C.contextWord(c.text, t).length < 3) continue;
        target = { text: c.text, tok: t };
        break;
      }
      if (target) break;
    }
    if (!target) { out.push({ date: e.date, tampered: false, reason: '改ざんできる価格が無い' }); continue; }
    const digits = target.tok.key;
    const withComma = Number(digits).toLocaleString('en-US');
    const newVal = String(Number(digits) + 500);
    const newComma = Number(newVal).toLocaleString('en-US');
    // その文を含む段落（p・li・td）の中だけで、該当の数字を書き換える（題・メタ・構造化データは触らない）
    const head = target.text.replace(/\s+/g, '').slice(0, 12);
    const numRe = new RegExp(`(${withComma}|${digits})(?=円)`);
    let tampered = html;
    let done = false;
    tampered = html.replace(/<(p|li|td)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
      if (done) return m;
      const plain = C.compact(inner.replace(/<[^>]+>/g, ''));
      if (!plain.includes(C.compact(head)) || !numRe.test(inner)) return m;
      done = true;
      return m.replace(numRe, (x) => (x.includes(',') ? newComma : newVal));
    });
    if (!done || tampered === html) { out.push({ date: e.date, tampered: false, reason: '文の位置が特定できない' }); continue; }
    const L1 = await buildLedger(tampered, { date: e.date, slug: e.slug, fetcher, cache: false });
    const d1 = decide({ claims: L1 });
    const d0 = decide({ claims: L0 });
    out.push({ date: e.date, tampered: true, changed: `${digits} → ${newVal}`, before_lane: d0.lane, after_lane: d1.lane, detected: d1.lane !== 'auto_publish' && (d1.lane === 'hold' || d0.lane !== d1.lane || d1.fixable.length > d0.fixable.length) });
  }
  const done = out.filter((r) => r.tampered);
  return { articles: out.length, tampered: done.length, detected: done.filter((r) => r.detected).length, detected_as_hold: done.filter((r) => r.after_lane === 'hold').length, rows: out };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--build-fixtures')) {
    const cases = makeCases();
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, `${JSON.stringify({ built_by: 'scripts/claims_gate_calibrate.js --build-fixtures', note: '合成の見本。出典の文章は見本のために作った短い文で、第三者のページの全文ではない', cases }, null, 1)}\n`);
    console.log(`見本を作りました: ${path.relative(ROOT, FIXTURE)}（正しい ${cases.filter((c) => c.label === 'correct').length} 本・壊した ${cases.filter((c) => c.label === 'broken').length} 本）`);
    return;
  }
  const lt = argv.indexOf('--live-tamper');
  if (lt >= 0) {
    console.log(JSON.stringify(await runLiveTamper(Math.max(1, parseInt(argv[lt + 1], 10) || 30)), null, 2));
    return;
  }
  const li = argv.indexOf('--live');
  if (li >= 0) {
    const r = await runLive(Math.max(1, parseInt(argv[li + 1], 10) || 30));
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).cases;
  const r = await runFixtures(cases);
  const { rows, ...summary } = r;
  console.log(JSON.stringify(argv.includes('--rows') ? r : summary, null, 2));
  console.log(`\n壊した記事 ${r.broken.detected}/${r.broken.total} を検出（合格線 ${LINE.detect_min} 以上）／正しい記事の誤保留 ${r.correct.false_hold}/${r.correct.total}（合格線 ${LINE.false_hold_max} 以下）→ ${r.pass ? '合格' : '届かず'}`);
  if (argv.includes('--check') && !r.pass) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { makeCases, runFixtures, runLive, runLiveTamper, LINE, FIXTURE };
