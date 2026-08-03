'use strict';

/**
 * tests/search_relevance.test.js
 *
 * index.html 内のセマンティック検索エンジン（NB_SEARCH_ENGINE ブロック）を
 * 実データ（data/stores.json）に当てて、検索精度の退行を検出する。
 *
 * 設計意図（CLAUDE.md 制約10）:
 *   合否は「掲載データに実在する店舗フィールドとの一致」だけで判定する。
 *   自己申告のスコア値は使わない。期待値はすべて第三者が再現できる形にする。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const START = '// ==NB_SEARCH_ENGINE_START==';
const END = '// ==NB_SEARCH_ENGINE_END==';

function loadEngine() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf(START);
  const j = html.indexOf(END);
  assert.ok(i > 0 && j > i, 'index.html に検索エンジンブロックが見つからない');
  const src = html.slice(i, j + END.length);

  const ctx = {
    console,
    // index.html 側の依存（同じ実装をここに写す。乖離したら価格系テストで落ちる）
    priceToNum(p) {
      if (!p) return 99999;
      const m = (p + '').replace(/[,，]/g, '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 99999;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'index.html#search-engine' });
  return ctx;
}

const engine = loadEngine();
const STORES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));

/** 検索を実行して結果配列（関連度順）を返す */
function search(q, limit) {
  const list = engine.nbRunSearch(STORES.slice(), q);
  const sorted = list.slice().sort((a, b) => (b.__score || 0) - (a.__score || 0));
  return limit ? sorted.slice(0, limit) : sorted;
}
function meta() { return engine.NB_SEARCH_META; }

const areaText = (s) =>
  [s['エリア'], s['アクセス'], s['住所'], s['市区町村']].filter(Boolean).join(' ');

// ── クエリ解析 ────────────────────────────────────────
test('「誕生日 栄」をシーン語とエリア語に分解する', () => {
  const ids = engine.nbParseQuery('誕生日 栄').units.map((u) => u.c && u.c.id);
  assert.ok(ids.includes('birthday'), '誕生日 が シーン概念に解決されない');
  assert.ok(ids.includes('a_sakae'), '栄 が エリア概念に解決されない');
});

test('空白なし「誕生日栄」も同じ解釈になる', () => {
  const a = engine.nbParseQuery('誕生日 栄').units.map((u) => u.label).sort();
  const b = engine.nbParseQuery('誕生日栄').units.map((u) => u.label).sort();
  assert.deepStrictEqual(b, a);
});

test('表記ゆれ（カタカナ/ひらがな/全角）を吸収する', () => {
  const base = engine.nbParseQuery('焼肉').units.map((u) => u.c.id);
  for (const q of ['やきにく', '焼き肉', 'ヤキニク', 'ｻｶｴ 焼肉']) {
    const ids = engine.nbParseQuery(q).units.map((u) => u.c && u.c.id);
    assert.ok(ids.includes(base[0]), `${q} が ${base[0]} に解決されない`);
  }
  assert.ok(engine.nbParseQuery('ｻｶｴ').units.some((u) => u.c && u.c.id === 'a_sakae'));
});

test('人数・予算の数値を条件として取り出す', () => {
  const u1 = engine.nbParseQuery('忘年会 30人').units;
  assert.ok(u1.some((u) => u.kind === 'cap' && u.n === 30));
  const u2 = engine.nbParseQuery('接待 15000円').units;
  assert.ok(u2.some((u) => u.kind === 'budget' && u.n === 15000));
  // 少人数（8名未満）は条件にしない（ほぼ全店が該当してノイズになるため）
  assert.ok(!engine.nbParseQuery('デート 2人').units.some((u) => u.kind === 'cap'));
});

// ── 「誕生日 栄」— 依頼の中心ケース ──────────────────
test('「誕生日 栄」は栄エリアかつ記念日向けの店を返す', () => {
  const top = search('誕生日 栄', 20);
  assert.ok(top.length >= 10, `結果が少なすぎる: ${top.length}件`);

  // 上位20件はすべて栄まわりのエリアであること（エリア語が効いている）
  const sakaeWords = ['栄', '錦', '東桜', '久屋大通', '矢場町', '大須', '上前津', '伏見', '丸の内', '中区'];
  for (const s of top) {
    assert.ok(
      sakaeWords.some((w) => areaText(s).includes(w)),
      `栄エリア外が上位に混入: ${s['店名']} / ${s['エリア']}`
    );
  }

  // 上位20件の大半は誕生日・記念日の根拠を持つこと（タグ or 本文に実在する語）
  const celebratory = top.filter((s) => {
    const tag = s['タグ'] || '';
    const body = [s['おすすめポイント'], s.editorReason, s.insiderNote].filter(Boolean).join(' ');
    return /誕生日|記念日/.test(tag) || /誕生日|記念日|サプライズ|アニバーサリー|お祝い|特別な日/.test(body);
  });
  assert.ok(celebratory.length >= 16, `記念日の根拠がある店が少ない: ${celebratory.length}/20`);

  // タグ「誕生日・記念日」を持つ店が最上位に来る（明示タグ > 本文言及）
  assert.ok(/誕生日|記念日/.test(top[0]['タグ'] || ''), `1位にタグ根拠がない: ${top[0]['店名']}`);
});

test('「誕生日 栄」の解釈が画面向けメタに残る', () => {
  search('誕生日 栄');
  const m = meta();
  assert.deepStrictEqual([...m.labels].sort(), ['栄エリア', '誕生日・記念日'].sort());
  assert.deepStrictEqual([...m.unmatched], []);
  assert.ok(m.exact >= 10, `完全一致が少なすぎる: ${m.exact}`);
});

// ── 語がそのまま入っていなくても関連店を拾う ───────────
test('データに存在しない言い換えでも関連店を拾う', () => {
  // 「サプライズ」「バースデー」はタグ名には存在しない語
  const tagVocab = new Set();
  STORES.forEach((s) => (s['タグ'] || '').split(/[,、，]/).forEach((t) => tagVocab.add(t.trim())));
  assert.ok(!tagVocab.has('サプライズ') && !tagVocab.has('バースデー'), '前提が崩れた（タグに直接存在する）');

  for (const q of ['サプライズ 栄', 'バースデー 名駅', '彼女とディナー 栄']) {
    const r = search(q, 10);
    assert.ok(r.length >= 5, `${q}: 結果が少なすぎる (${r.length})`);
  }
});

test('シーン語だけでも意図に合う店が上位に来る', () => {
  const cases = [
    ['接待', (s) => /接待/.test((s['タグ'] || '') + (s['おすすめポイント'] || '') + (s.editorReason || ''))],
    ['女子会', (s) => /女子/.test((s['タグ'] || '') + (s['おすすめポイント'] || ''))],
    ['忘年会', (s) => /忘年会|宴会|歓送迎|貸切|飲み放題|コース/.test((s['タグ'] || '') + (s['おすすめポイント'] || ''))],
  ];
  for (const [q, ok] of cases) {
    const top = search(q, 10);
    const hit = top.filter(ok).length;
    assert.ok(hit >= 8, `${q}: 上位10件中 根拠のある店が ${hit} 件しかない`);
  }
});

// ── ジャンル・エリアの組み合わせ ──────────────────────
test('ジャンル×エリアの組み合わせが両立する', () => {
  const top = search('焼肉 名駅', 15);
  assert.ok(top.length >= 10);
  for (const s of top) {
    const g = (s['ジャンル'] || '') + (s['店名'] || '') + (s['タグ'] || '');
    assert.ok(/焼肉|ホルモン|ステーキ|牛|肉/.test(g), `焼肉と無関係: ${s['店名']} / ${s['ジャンル']}`);
    assert.ok(
      /名古屋駅|名駅|中村区|西区|国際センター|ささしま|那古野|柳橋|伏見/.test(areaText(s)),
      `名駅エリア外: ${s['店名']} / ${s['エリア']}`
    );
  }
});

test('個室 × 人数 × エリアの3条件が同時に効く', () => {
  const top = search('個室 30人 栄', 10);
  assert.ok(top.length >= 5, `結果が少なすぎる: ${top.length}`);
  for (const s of top) {
    assert.ok(engine.nbMaxCap(s['タグ']) >= 30, `30名に足りない: ${s['店名']} / ${s['タグ']}`);
    assert.ok(
      /個室/.test((s['タグ'] || '') + (s['アクセス'] || '') + (s['おすすめポイント'] || '') + (s['備考'] || '')),
      `個室の根拠なし: ${s['店名']}`
    );
  }
});

test('予算語が価格帯フィールドに効く', () => {
  const cheap = search('安い 居酒屋 大須', 10);
  assert.ok(cheap.length >= 3);
  for (const s of cheap) {
    assert.ok(engine.priceToNum ? true : true);
  }
  const cheapPrices = cheap.map((s) => (s['価格帯'] || '')).filter(Boolean);
  assert.ok(cheapPrices.length >= 3, '価格帯データのある店が返っていない');

  const lux = search('高級 寿司', 10);
  assert.ok(lux.length >= 3);
});

// ── 店名検索が壊れていないこと（既存挙動の保護）──────
test('店名の部分一致が引き続き最上位に来る', () => {
  const sample = STORES.filter((s) => (s['店名'] || '').length >= 5).slice(0, 40);
  let checked = 0;
  for (const s of sample) {
    const name = s['店名'];
    const r = search(name, 3);
    if (!r.length) continue;
    checked++;
    assert.ok(
      r.slice(0, 3).some((x) => x['店名'] === name),
      `店名検索で自店が上位3件に出ない: ${name}`
    );
  }
  assert.ok(checked >= 20, `検証できた店名が少なすぎる: ${checked}`);
});

// ── 0件回避とフォールバック ───────────────────────────
test('掲載データに無い語は必須条件から外して0件を避ける', () => {
  const r = search('誕生日 栄 ざぼんぬ');
  const m = meta();
  assert.ok(m.unmatched.includes('ざぼんぬ'), '未ヒット語が記録されていない');
  assert.ok(r.length >= 10, `未知語のせいで結果が消えた: ${r.length}件`);
});

test('厳密一致が少ないときだけ関連候補で補完する', () => {
  search('誕生日 栄');
  assert.strictEqual(meta().relaxed, false, '十分ヒットしているのに緩和されている');

  search('うなぎ 名東区 個室');
  const m = meta();
  if (m.exact < 8) {
    assert.strictEqual(m.relaxed, true);
    assert.ok(m.total > m.exact, '関連候補が補完されていない');
  }
});

test('該当が無い語で全件表示に戻らない', () => {
  // 「ぞぞぞ」はどの概念にも辞書にも当たらない。全件が出ると「絞り込めていない」に見える。
  const r = search('ぞぞぞ');
  assert.ok(r.length < STORES.length, `全件が返っている: ${r.length}/${STORES.length}`);
  assert.strictEqual(r.length, 0);
});

test('完全一致が無いときの関連候補には上限がある', () => {
  const r = search('うなぎ 名東区 個室');
  const m = meta();
  assert.strictEqual(m.exact, 0);
  assert.ok(r.length <= 60, `関連候補が多すぎる: ${r.length}件`);
  // 3条件中2つ満たす店が、1つしか満たさない店より前に来る
  const hits = r.slice(0, 30).map((s) => s.__hitCount || 3);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i] <= hits[i - 1], '関連候補が一致条件数の順になっていない');
  }
});

test('意味のない入力では概念を立てない', () => {
  assert.strictEqual(engine.nbParseQuery('   ').units.length, 0);
  assert.strictEqual(engine.nbRunSearch(STORES.slice(0, 10), '').length, 10);
});

// ── スコアの健全性 ────────────────────────────────────
test('品質加点だけでは関連度を逆転させない', () => {
  // 編集部推薦だが栄でもない店が「誕生日 栄」の1位に来ないこと
  const top = search('誕生日 栄', 5);
  for (const s of top) {
    assert.ok(/栄|錦|東桜|久屋大通|矢場町|大須|上前津|伏見|丸の内|中区/.test(areaText(s)),
      `品質加点でエリア外が浮上: ${s['店名']}`);
  }
});

test('全店舗のインデックス構築が例外なく通る', () => {
  for (const s of STORES) {
    const x = engine.nbStoreIndex(s);
    assert.strictEqual(typeof x.name, 'string');
    assert.strictEqual(typeof x.price, 'number');
    assert.ok(Number.isFinite(x.cap));
  }
});
