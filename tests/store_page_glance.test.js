'use strict';

/**
 * tests/store_page_glance.test.js — 店舗ページの最初の画面の要約（I-14a・計画書 W6）
 *
 * 背景: 店舗ページの最初の画面は、ジャンルの札・店名・★・口コミ信頼度の札だけで、「どこにあって、いくらぐらいで、
 * どんな条件で使えるか」は画面を下へ進めないと分からなかった。★は何の評価で何件なのかも書かれていなかった。
 * 店名の下に、★の隣の出典と件数（「（Google・39件）」）、駅からの距離と予算を 1 行、データにある条件を最大 4 つのラベルで出す。
 *
 * 守ること（計画書 I-14・制約10）:
 *   - 出すのは data/stores.json の項目から決める事実だけ。データが無い項目は出さない（「不明」も「—」も書かない）
 *   - 条件の判定と語はハブ（stores/area/）と同じ（scripts/lib/area_genre_pages.js の述語・data/area_genre_pages_policy.json の label）
 *   - 駅名は愛知県内の駅名リスト（data/station_names.json）に載っているものだけ。間違った駅名を最初の画面に出さない
 *   - ラベルは押せない（リンクにもボタンにもしない）。行き先の無いものを押せそうに見せない
 *   - ジャンルは札で既に出ているので繰り返さない。口コミ信頼度の札・★の div は変えない（構造化データのテストと監査が頼る）
 *
 * 読むのは生成器（gen-store-pages.js）が返す文字列と、その中のページ内 CSS だけ。日次で作り直す stores/ の生成物は見ない
 * （build.yml は npm test を再生成より前に回すので、生成物を読むテストは前の日の生成物を見てしまう）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GEN_SRC = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
const { buildStoreGlance, renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const { loadPolicy, storeMatchesCondition } = require(path.join(ROOT, 'scripts/lib/area_genre_pages.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));

const LABEL = Object.fromEntries(loadPolicy().conditions.map((c) => [c.rule, c.label]));
const chipsOf = (s) => buildStoreGlance(s).chips;
const factsOf = (s) => buildStoreGlance(s).facts;
const walkOf = (access) => factsOf({ 'アクセス': access });

// ── 1. ★の隣: 出典と口コミ件数 ──

test('★の隣: 出典（Google）と口コミ件数。3 桁区切り。件数が無ければ件数は書かない', () => {
  assert.equal(buildStoreGlance({ 'Google評価': '4.3', '口コミ数': '39' }).note, '（Google・39件）');
  assert.equal(buildStoreGlance({ 'Google評価': '4.3', '口コミ数': '1234' }).note, '（Google・1,234件）');
  assert.equal(buildStoreGlance({ 'Google評価': '4.3' }).note, '（Google）', '件数を持たない店（実データに 32 店）');
  assert.equal(buildStoreGlance({ 'Google評価': '4.3', '口コミ数': '0' }).note, '（Google）', '0 件とは書かない');
  assert.equal(buildStoreGlance({ 'Google評価': '4.3', '口コミ数': '不明' }).note, '（Google）');
});

test('★の隣: 評価が無い店には何も出さない（件数だけの表示も作らない）', () => {
  assert.equal(buildStoreGlance({ '口コミ数': '39' }).note, '');
  assert.equal(buildStoreGlance({ 'Google評価': '', '口コミ数': '39' }).note, '');
  assert.equal(buildStoreGlance({}).note, '');
});

// ── 2. 駅からの距離と予算の 1 行 ──

test('駅からの距離: 県内の駅名リストにある駅だけ「○○駅から徒歩N分」。括弧つき・通称は今の駅名に', () => {
  assert.deepEqual(walkOf('名古屋市営地下鉄桜通線 丸の内駅 徒歩5分（名古屋市中区丸の内2-12-19）'), ['丸の内駅から徒歩5分']);
  assert.deepEqual(walkOf('地下鉄、名城線・桜通線〔久屋大通〕駅より徒歩5分/久屋大通駅から381m'), ['久屋大通駅から徒歩5分'], '括弧は外す');
  assert.deepEqual(walkOf('名鉄名古屋本線左京山駅より徒歩5分'), ['左京山駅から徒歩5分'], '路線名は落とす');
  assert.deepEqual(walkOf('地下鉄東山線 新栄駅より徒歩2分'), ['新栄町駅から徒歩2分'], '通称は今の駅名にそろえる（ハブの最寄り駅の表と同じ）');
  assert.deepEqual(walkOf('JR名古屋駅から徒歩約3分'), ['名古屋駅から徒歩3分']);
  assert.deepEqual(walkOf('名古屋駅徒歩15分'), ['名古屋駅から徒歩15分'], '15 分ちょうどまでは出す');
});

test('駅からの距離: 15 分を超える・駅名が取れない・リストに無い駅名は出さない（間違った駅名を最初の画面に出さない）', () => {
  const cases = {
    '徒歩が 15 分を超える': '名古屋駅徒歩16分',
    '駅名が無い': '駅から徒歩3分',
    '地名が混ざった抽出（名古屋市中村区名）': '名古屋市中村区名駅 名古屋駅から徒歩約3分',
    '8 文字で切れた駅名（ゴヤドーム前矢田）': 'ナゴヤドーム前矢田駅より徒歩3分',
    '記号つき': '｢栄駅より徒歩3分',
    '複数の駅が連なる': '栄駅・矢場町駅より徒歩3分',
    '愛知県外の駅': '東京駅より徒歩3分',
    '徒歩の表記が無い': '栄駅の近く',
    '空': '',
  };
  for (const [why, access] of Object.entries(cases)) assert.deepEqual(walkOf(access), [], why);
  assert.deepEqual(factsOf({}), [], 'アクセスの項目が無い');
});

test('予算: 価格帯の文字列をそのまま「予算○○」にする（タイトルと同じ書き方）。無ければ出さない', () => {
  assert.deepEqual(factsOf({ '価格帯': '3001～4000円' }), ['予算3001～4000円']);
  assert.deepEqual(factsOf({ '価格帯': '～999円' }), ['予算～999円'], '上限だけの表記もそのまま');
  assert.deepEqual(factsOf({ '価格帯': '  ' }), []);
  assert.deepEqual(factsOf({}), []);
});

test('1 行の事実: 距離 → 予算の順。どちらかだけでも出す', () => {
  const both = { 'アクセス': '地下鉄東山線 栄駅 徒歩3分', '価格帯': '3001～4000円' };
  assert.deepEqual(factsOf(both), ['栄駅から徒歩3分', '予算3001～4000円']);
  assert.deepEqual(factsOf({ ...both, 'アクセス': '' }), ['予算3001～4000円']);
  assert.deepEqual(factsOf({ ...both, '価格帯': '' }), ['栄駅から徒歩3分']);
});

// ── 3. 条件のラベル ──

/** 条件ごとに「その条件だけを満たす」店。ハブと同じ判定器で満たすことを確かめてから使う */
const ONLY = {
  koshitsu: { '個室': 'あり' },
  nomihodai: { '飲み放題': 'あり' },
  group30: { '宴会収容': '30' },
  lateNight: { '営業時間': '17:00〜翌1:00' },
  lunch: { 'ランチ': 'あり' },
  sunday: { '定休日': '年中無休' },
  parking: { '駐車場': 'あり' },
  nonSmoking: { '禁煙': '全面禁煙' },
  tabehodai: { '食べ放題': 'あり' },
  smokingOk: { '禁煙': '禁煙席なし' },
};

test('条件のラベル: 条件ごとに、ハブの判定器が満たす店にだけ、ハブと同じ語で出る', () => {
  for (const [rule, store] of Object.entries(ONLY)) {
    assert.ok(storeMatchesCondition(store, rule), `${rule}: 見本の店がハブの判定を満たす`);
    assert.deepEqual(chipsOf(store), [LABEL[rule]], `${rule}: ハブの語（${LABEL[rule]}）で 1 つだけ`);
  }
});

test('条件のラベル: 満たさない境界では出ない（宴会 29 名・翌0時・日曜休み・全席禁煙でない）', () => {
  assert.deepEqual(chipsOf({ '宴会収容': '29' }), []);
  assert.deepEqual(chipsOf({ '営業時間': '17:00〜翌0:30' }), [], '翌0時台は深夜営業に数えない');
  assert.deepEqual(chipsOf({ '定休日': '日曜日' }), []);
  assert.deepEqual(chipsOf({ '定休日': '不定休' }), [], '判定できない自由記述は載せない');
  assert.deepEqual(chipsOf({ '個室': 'なし' }), []);
  assert.deepEqual(chipsOf({ '禁煙': '' }), []);
});

test('条件のラベル: 決め手になりやすい順に最大 4 つ。多い店でも 4 つで止める', () => {
  const all = Object.assign({}, ...Object.values(ONLY).map((o) => o), { '禁煙': '全面禁煙' });
  const chips = chipsOf(all);
  assert.deepEqual(chips, ['koshitsu', 'nomihodai', 'group30', 'lateNight'].map((r) => LABEL[r]), '個室 → 飲み放題 → 30名以上 → 深夜営業');
  const rest = chipsOf({ ...all, '個室': 'なし', '飲み放題': 'なし' });
  assert.deepEqual(rest, ['group30', 'lateNight', 'lunch', 'sunday'].map((r) => LABEL[r]), '先の条件が無ければ後ろの条件が繰り上がる');
  assert.deepEqual(chipsOf({ '駐車場': 'あり', '禁煙': '禁煙席なし' }), [LABEL.parking, LABEL.smokingOk], '少なければ少ないまま');
  assert.deepEqual(chipsOf({}), [], '何も無い店には出さない');
});

test('条件のラベル: 駅徒歩と予算の条件は出さない（距離と予算は 1 行の事実で出ている）', () => {
  const s = { 'アクセス': '栄駅 徒歩1分', '価格帯': '～500円', '個室': 'あり' };
  assert.ok(storeMatchesCondition(s, 'walk3') && storeMatchesCondition(s, 'budget3000'));
  assert.deepEqual(chipsOf(s), [LABEL.koshitsu]);
});

// ── 4. ページに組み込んだとき ──

const STORE = {
  '店名': 'テスト酒場', 'エリア': '栄', 'ジャンル': '居酒屋', '住所': '愛知県名古屋市中区栄1-1-1',
  'おすすめポイント': '炭火の焼き鳥が看板。', placeId: 'ChIJtestPlace',
  'Google評価': '4.3', '口コミ数': '39', '価格帯': '3001～4000円', 'アクセス': '地下鉄東山線 栄駅 徒歩3分',
  '個室': 'あり', '飲み放題': 'あり',
};
const render = (over) => renderStorePage({ ...STORE, ...over }, 'J-test', [], []);
// 要約の範囲 = 要約の div の始まりから、次の見どころの枠（.point-box）の手前まで（この見本の店は見どころを持つ）
const glanceOf = (html) => {
  const i = html.indexOf('<div class="store-glance">');
  const j = html.indexOf('<div class="point-box">', i);
  return i >= 0 && j > i ? html.slice(i, j) : '';
};

test('店舗ページ: 店名 → 要約 → 見どころ の順。★の div は従来のまま、出典と件数は別の要素', () => {
  const html = render({});
  const iH1 = html.indexOf('<h1>');
  const iGlance = html.indexOf('<div class="store-glance">');
  const iPoint = html.indexOf('<div class="point-box">');
  assert.ok(iH1 > 0 && iGlance > iH1 && iPoint > iGlance, 'h1 → .store-glance → .point-box');
  assert.match(html, /<div class="score"[^>]*>[\s\S]*?4\.3<\/div><span class="score-note">（Google・39件）<\/span>/, '★の div の直後に出典と件数');
  assert.match(html, /<p class="store-facts">栄駅から徒歩3分・予算3001～4000円<\/p>/);
  assert.match(html, /<ul class="store-chips" aria-label="この店の条件"><li>個室あり<\/li><li>飲み放題あり<\/li><\/ul>/);
});

test('店舗ページ: 口コミ信頼度の札は★と同じ行の中（従来と同じ並び）。ジャンルは札だけで繰り返さない', () => {
  const html = render({ 'crossCheckScore': 80, reviewTrust: { s: 80, t: 'B', c: 5, d: '2026-06-01' } });
  const g = glanceOf(html);
  const row = (g.match(/<div class="store-glance-row">[\s\S]*?\n  <\/div>/) || [''])[0];
  assert.match(row, /class="score"[\s\S]*class="score-note"[\s\S]*class="ccs-badge/, '★ → 出典 → 口コミ信頼度の札（同じ行の中）');
  assert.equal((html.match(/class="ccs-badge/g) || []).length, 1, '札は 1 つだけ');
  assert.ok(!/居酒屋/.test(g), '要約にジャンルを繰り返さない');
});

test('店舗ページ: データが無い項目は行ごと出さない（空の枠・「不明」を作らない）', () => {
  const bare = render({ 'Google評価': '', '口コミ数': '', '価格帯': '', 'アクセス': '', '個室': '', '飲み放題': '' });
  assert.ok(!/class="score-note"|class="store-facts"|class="store-chips"|class="store-glance-row"/.test(bare), '行の中身が無ければ、行の枠も出さない');
  assert.ok(!/不明|データなし/.test(glanceOf(bare)));
  const onlyChips = render({ 'Google評価': '', '価格帯': '', 'アクセス': '' });
  assert.ok(/class="store-chips"/.test(onlyChips) && !/class="store-facts"|class="score-note"/.test(onlyChips));
});

test('店舗ページ: ラベルは押せない（リンクにもボタンにもしない）。画面の読み上げには条件の一覧として伝わる', () => {
  const g = glanceOf(render({}));
  const chips = (g.match(/<ul class="store-chips"[\s\S]*?<\/ul>/) || [''])[0];
  assert.ok(chips, 'ラベルの一覧がある');
  assert.ok(!/<(a|button|input|summary)\b/.test(chips), '押せる部品を入れない');
  assert.ok(!/tabindex|onclick|role="button"/.test(chips));
  assert.match(chips, /^<ul class="store-chips" aria-label="この店の条件"><li>/);
});

test('店舗ページ: 表示用の文字は HTML として安全に出す（価格帯・ラベルの記号を壊さない）', () => {
  const html = render({ '価格帯': '<b>3001</b>～4000円', 'Google評価': '4.3' });
  const g = glanceOf(html);
  assert.ok(!/<b>3001/.test(g), '価格帯の中のタグは文字として出す');
  assert.match(g, /予算&lt;b&gt;3001&lt;\/b&gt;～4000円/);
});

test('店舗ページ: インライン JS と、構造化データ・ほかの部品を壊さない', () => {
  const html = render({ 'crossCheckScore': 80, reviewTrust: { s: 80, t: 'B', c: 5, d: '2026-06-01' } });
  assert.deepEqual(auditHtml(html, { filename: 'render:glance' }).violations, []);
  assert.match(html, /<div class="score"[^>]*>[\s\S]*?4\.3<\/div>/, '構造化データのテストが頼る★の div');
  assert.ok(!/aggregateRating/i.test(html), '見た目の件数を構造化データへ出さない');
  assert.ok(html.indexOf('class="store-glance"') < html.indexOf('class="info-grid"'), '基本情報の表より前');
  assert.equal((html.match(/class="store-glance"/g) || []).length, 1);
});

// ── 5. CSS（ページ内 CSS）: トークンだけ・13px 以上 ──

test('ページ内 CSS: 要約の文字はトークン（13px 以上）、色は既存のトークン。px の直書きをしない', () => {
  const rule = (sel) => {
    const i = GEN_SRC.indexOf(sel + '{');
    assert.ok(i >= 0, `${sel} の規則がある`);
    return GEN_SRC.slice(i, GEN_SRC.indexOf('}', i));
  };
  assert.match(rule('.score-note'), /font-size:var\(--fs-xs\)/);
  assert.match(rule('.store-facts'), /font-size:var\(--fs-sm\)/);
  assert.match(rule('.store-chips li'), /font-size:var\(--fs-xs\)/);
  for (const sel of ['.store-glance', '.store-glance-row', '.score-note', '.store-facts', '.store-chips', '.store-chips li']) {
    assert.ok(!/font-size:\s*[\d.]+(px|rem|em)/.test(rule(sel)), `${sel}: font-size の直書きをしない`);
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(rule(sel)), `${sel}: 色の直書きをしない`);
  }
  assert.match(rule('.store-chips'), /list-style:none/);
  assert.match(rule('.store-chips'), /flex-wrap:wrap/, '幅が狭ければ折り返す');
});
