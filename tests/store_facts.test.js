'use strict';

/**
 * tests/store_facts.test.js — 店舗ページの基本情報に足す行（I-14c・計画書 I-14）
 *
 * 背景: 店舗ページの基本情報は、エリア・住所・価格帯・営業時間・電話・アクセスだけだった。data/stores.json が持つ
 * 定休日・席数・宴会の収容人数・禁煙・カード・駐車場を、データがある項目だけ足す（scripts/lib/store_facts.js）。
 *
 * 守ること:
 *   - 出すのは欄の事実だけ。空の欄は行ごと出さない（「不明」「なし」と書かない・制約10）
 *   - 値の意味は変えない。言い回しだけ整える（「日」→「日曜日」）。文章が混ざる定休日は、読めるものだけ出す
 *   - 駐車場の但し書き（近隣のコインパーキングなど）を落とさない
 *   - 欄が1つも無い店のページは、従来と同じ出力（余計な行・空白の枠を出さない）
 *
 * 読むのは生成器（gen-store-pages.js）が返す文字列と data/stores.json だけ。日次で作り直す stores/ の生成物は見ない
 * （build.yml は npm test を再生成より前に回すので、生成物を読むテストは前の日の生成物を見てしまう）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const facts = require(path.join(ROOT, 'scripts/lib/store_facts.js'));
const { renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const STORES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stores.json'), 'utf8'));
const table = (fn, rows) => { for (const [input, expected] of rows) assert.equal(fn(input), expected, `${JSON.stringify(input)}`); };

// ── 1. 定休日 ──

test('定休日: 曜日の並びは「○曜日」に整える。「祝日」の「日」を曜日と取り違えない', () => {
  table(facts.closedDaysText, [
    ['日', '日曜日'], ['月', '月曜日'], ['日、祝日', '日曜日、祝日'], ['月、祝前日', '月曜日、祝前日'],
    ['月、火（第２・第４）', '月曜日、火曜日（第２・第４）'], ['火（第３）、水', '火曜日（第３）、水曜日'], ['水（第1・3）', '水曜日（第1・3）'],
  ]);
  assert.ok(!facts.closedDaysText('日、祝日').includes('祝日曜'), '祝日の日を曜日にしない');
});

test('定休日: 「なし」「年中無休」「不定休」の言い回しをそろえる（意味は変えない）', () => {
  table(facts.closedDaysText, [
    ['なし', 'なし'], ['無', 'なし'], ['無し', 'なし'], ['定休日なし', 'なし'], ['定休日：なし', 'なし'], ['定休日無し', 'なし'], ['定休日はございません！', 'なし'],
    ['年中無休', '年中無休'], ['年中無休です。', '年中無休'], ['年中無休です！', '年中無休'], ['無休', '無休'],
    ['不定休', '不定休'], ['不定休です。', '不定休'], ['不定休となります', '不定休'], ['不定休日あり', '不定休'], ['※不定休', '不定休'], ['不定休。', '不定休'],
  ]);
});

test('定休日: 案内・宣伝・日付・但し書きの文章は出さない（途中で切って出すこともしない）', () => {
  for (const v of [
    '現在、営業時間を変更している可能性がございます。営業状況につきましては鳥貴族HPをご確認ください。休業：12/31、1/1',
    '施設に準ずる', '年末年始', '年末年始のお休み：12月31.1月1日', '12/31、1/1', '祝',
    '年中無休※年末年始はお休みをいただきます。', '無休（年末年始を除く）', '無し（年末年始は除く）', '不定休※年末年始',
    '無休貸切や宴会も大歓迎。お気軽にご相談ください。', '定休日無し(臨時休業日有り)',
    '', '  ', null, undefined,
  ]) assert.equal(facts.closedDaysText(v), '', `${JSON.stringify(v)} は出さない`);
});

// ── 2. 席数・宴会・禁煙・カード ──

test('席数・宴会の収容人数: 数字だけを「20席」「30名」にする。0・数字でない・桁あふれは出さない', () => {
  table(facts.seatsText, [['20', '20席'], [' 40 ', '40席'], [120, '120席'], ['0', ''], ['', ''], ['不明', ''], ['12345', ''], [null, '']]);
  table(facts.banquetText, [['30', '30名'], ['100', '100名'], ['0', ''], ['約30', ''], [undefined, '']]);
});

test('禁煙・喫煙: データの3つの言葉のまま出す。「未確認」は出さない。カードは「利用可」だけ', () => {
  table(facts.smokingText, [['全面禁煙', '全面禁煙'], ['禁煙席なし', '禁煙席なし'], ['一部禁煙', '一部禁煙'], ['未確認', ''], ['', ''], [null, '']]);
  table(facts.cardText, [['利用可', '利用可'], ['', ''], ['利用不可', ''], [null, '']]);
});

// ── 3. 駐車場 ──

test('駐車場: 「あり ：4台」の区切りを整え、店が書いた但し書きは落とさない', () => {
  table(facts.parkingText, [
    ['あり', 'あり'], ['あり ：4台', 'あり：4台'], ['あり：30台', 'あり：30台'], ['なし', 'なし'], ['あり ：', 'あり'],
    ['あり ：近くにコインパーキングあり', 'あり：近くにコインパーキングあり'],
    ['あり ：お車を運転される方へのお酒の提供はできませんのでご了承ください。', 'あり：お車を運転される方へのお酒の提供はできませんのでご了承ください'],
    ['あり ：5台(店前に3台、店裏に2台)', 'あり：5台(店前に3台、店裏に2台)'],
    ['あり ：店舗裏に　三台まで\n止めれます', 'あり：店舗裏に 三台まで 止めれます'],
    ['要確認', ''], ['', ''], [null, ''],
  ]);
});

test('駐車場: build.js が 60 文字で切った説明（文の途中で終わる）は続けず「あり」だけにする。59 文字までは続ける', () => {
  const cut = 'あり ：屋内250台 利用可能時間 24時間 30分/500円（金額に応じて優待あり）車両制限全長5.0m全幅2.1m車';
  assert.equal(cut.length, 60);
  assert.equal(facts.parkingText(cut), 'あり', '切れた説明は出さない');
  const t59 = 'あり ：' + 'あ'.repeat(55);
  assert.equal(t59.length, 59);
  assert.equal(facts.parkingText(t59), 'あり：' + 'あ'.repeat(55));
});

test('駐車場の切り詰め長は build.js の hpAvailability と同じ（60）。build.js 側を変えたらここも見直す', () => {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  const body = src.slice(src.indexOf('function hpAvailability'), src.indexOf('function hpShopToStoreRecord'));
  assert.ok(body.length > 50 && /\.slice\(0, 60\)/.test(body), 'hpAvailability が 60 文字で切っている');
  assert.equal(facts.SOURCE_CAP, 60);
});

// ── 4. 行の組み立て ──

test('basicFacts: 欄が空の店は行なし。並びは 定休日 → 席数 → 宴会 → 禁煙・喫煙 → カード → 駐車場。欄の無い項目は飛ばす', () => {
  assert.deepEqual(facts.basicFacts({}), { schedule: [], facilities: [] });
  assert.deepEqual(facts.basicFacts(null), { schedule: [], facilities: [] });
  const all = facts.basicFacts({ 定休日: '日、祝日', 席数: '30', 宴会収容: '40', 禁煙: '全面禁煙', カード可: '利用可', 駐車場: 'あり ：4台' });
  assert.deepEqual(all.schedule, [{ label: '定休日', value: '日曜日、祝日' }]);
  assert.deepEqual(all.facilities.map((r) => `${r.label}=${r.value}`), ['席数=30席', '宴会の収容人数=40名', '禁煙・喫煙=全面禁煙', 'カード=利用可', '駐車場=あり：4台']);
  const some = facts.basicFacts({ 席数: '12', 禁煙: '未確認', 定休日: '施設に準ずる' });
  assert.deepEqual(some, { schedule: [], facilities: [{ label: '席数', value: '12席' }] }, '読めない・未確認は行ごと出さない');
});

// ── 5. ページに組み込んだとき ──

const infoCells = (html) => [...html.matchAll(/<div class="info-cell"><label>([^<]*)<\/label><span>([\s\S]*?)<\/span><\/div>/g)].map((m) => ({ label: m[1], value: m[2] }));

test('renderStorePage: 実在の店で、定休日は営業時間の直後、そのほかは電話の位置（電話が無ければ営業時間・定休日の次）に並び、アクセスの前で終わる', (t) => {
  const s = STORES.find((x) => x['定休日'] && facts.closedDaysText(x['定休日']) && x['席数'] && x['宴会収容'] && x['禁煙'] === '全面禁煙' && x['カード可'] && x['駐車場'] && x['営業時間'] && x['アクセス']);
  if (!s) return t.skip('6項目と営業時間・アクセスを持つ店が data/stores.json に無い');
  const labels = infoCells(renderStorePage(s, 'J-test', [], [])).map((c) => c.label);
  const iHours = labels.indexOf('営業時間');
  assert.ok(iHours >= 0 && labels[iHours + 1] === '定休日', `定休日は営業時間の直後: ${labels.join(' / ')}`);
  assert.deepEqual(labels.slice(iHours + 2, iHours + 7), ['席数', '宴会の収容人数', '禁煙・喫煙', 'カード', '駐車場'], '電話が無い店は、定休日の次に設備が続く');
  assert.equal(labels[labels.length - 1], 'アクセス・特徴', 'アクセス・特徴は最後のまま');
  // 電話がある店では、電話が定休日と席数の間に入る
  const withTel = infoCells(renderStorePage({ ...s, 電話: '052-000-0000' }, 'J-test', [], [])).map((c) => c.label);
  assert.deepEqual(withTel.slice(withTel.indexOf('定休日'), withTel.indexOf('定休日') + 3), ['定休日', '電話', '席数']);
});

test('renderStorePage: 欄が1つも無い店は、基本情報に新しい行も空の枠も出さない', () => {
  const base = { 店名: 'テスト食堂', ジャンル: '居酒屋', エリア: '栄', 都道府県: '愛知県', 営業時間: '17:00～23:00', 価格帯: '3001～4000円' };
  const html = renderStorePage(base, 'J-test', [], []);
  for (const label of ['定休日', '席数', '宴会の収容人数', '禁煙・喫煙', 'カード', '駐車場']) assert.ok(!html.includes(`<label>${label}</label>`), `${label} の行は出さない`);
  assert.deepEqual(infoCells(html).map((c) => c.label), ['エリア', '価格帯', '営業時間']);
  assert.ok(!/undefined|\[object /.test(html.slice(html.indexOf('<div class="info-grid">'), html.indexOf('</div>', html.indexOf('営業時間</label>')) + 20)), '値が undefined のまま出ない');
});

test('renderStorePage: 値は HTML エスケープして出す（駐車場の但し書きに < & が入っていても壊さない）', () => {
  const html = renderStorePage({ 店名: 'テスト食堂', ジャンル: '居酒屋', エリア: '栄', 都道府県: '愛知県', 駐車場: 'あり ：<b>提携</b> & コイン', 定休日: '日' }, 'J-test', [], []);
  const cell = infoCells(html).find((c) => c.label === '駐車場');
  assert.ok(cell, '駐車場の行がある');
  assert.equal(cell.value, 'あり：&lt;b&gt;提携&lt;/b&gt; &amp; コイン');
  assert.ok(!html.includes('<b>提携</b>'));
  assert.equal(infoCells(html).find((c) => c.label === '定休日').value, '日曜日');
});

// ── 6. 全店 ──

test('全店: 例外を出さない。出した値は、元の欄から導ける決まった形だけ。欄が空の店には行を出さない', () => {
  const closed = /^(?:(?:[月火水木金土日]曜日(?:（[^）]*）)?|祝日|祝前日)(?:、(?:[月火水木金土日]曜日(?:（[^）]*）)?|祝日|祝前日))*|なし|年中無休|無休|不定休)$/;
  for (const s of STORES) {
    const f = facts.basicFacts(s);
    for (const r of f.schedule) { assert.ok(closed.test(r.value), `${s['店名']}: 定休日 ${r.value}`); assert.ok(String(s['定休日'] || '').trim(), '欄が空なのに定休日を出した'); }
    for (const r of f.facilities) {
      if (r.label === '席数') assert.equal(r.value, `${String(s['席数']).trim()}席`);
      else if (r.label === '宴会の収容人数') assert.equal(r.value, `${String(s['宴会収容']).trim()}名`);
      else if (r.label === '禁煙・喫煙') assert.equal(r.value, s['禁煙']);
      else if (r.label === 'カード') { assert.equal(r.value, '利用可'); assert.equal(s['カード可'], '利用可'); }
      else if (r.label === '駐車場') assert.ok(/^(あり|なし)/.test(r.value) && /^(あり|なし)/.test(String(s['駐車場'])), `${s['店名']}: 駐車場 ${r.value}`);
      else assert.fail(`知らない行: ${r.label}`);
    }
    if (!String(s['席数'] || '').trim()) assert.ok(!f.facilities.some((r) => r.label === '席数'));
    if (!String(s['駐車場'] || '').trim()) assert.ok(!f.facilities.some((r) => r.label === '駐車場'), '駐車場の欄が空の店に駐車場を出さない');
    if (!String(s['カード可'] || '').trim()) assert.ok(!f.facilities.some((r) => r.label === 'カード'), 'カードの欄が空の店にカードを出さない（「不可」にしない）');
  }
});

test('全店: 読める定休日の割合が極端に落ちていないこと（正規表現を壊すと一斉に消えるため）', () => {
  const has = STORES.filter((s) => String(s['定休日'] || '').trim());
  if (has.length < 100) return;
  const shown = has.filter((s) => facts.closedDaysText(s['定休日'])).length;
  assert.ok(shown / has.length >= 0.6, `定休日を読めた割合 ${(100 * shown / has.length).toFixed(1)}%（2026-10-12 は 83%）`);
  for (const [field, fn] of [['席数', 'seatsText'], ['宴会収容', 'banquetText'], ['カード可', 'cardText'], ['駐車場', 'parkingText']]) {
    const h = STORES.filter((s) => String(s[field] || '').trim());
    if (h.length < 50) continue;
    const n = h.filter((s) => facts[fn](s[field])).length;
    assert.ok(n / h.length >= 0.9, `${field} を読めた割合 ${(100 * n / h.length).toFixed(1)}%`);
  }
});
