'use strict';
/**
 * tests/filter_policy.test.js — 絞り込みのエリア・条件の表の生成器（I-20・P-401）
 *
 * トップの「絞り込み」のエリア（10 群）と条件（13 軸）の表は、ハブ（stores/area/）の判定基準
 * data/area_genre_pages_policy.json から作り、index.html の NB-FILTER-POLICY 区画へ書く。
 * 対象:
 *   ・scripts/lib/filter_policy.js … buildFilterPolicy（ポリシー → ページが使う表）・renderFilterPolicy（1 行の var 文）・REGION（区画の印）
 *   ・scripts/build_filter_policy.js … index.html の区画だけをポリシーから書く（main・patchRegion・コマンド）
 *
 * 守ること:
 *   ・ポリシーを増減すれば表も増減する（エリアの数・条件の数をテストに書かない）。ガイド文などの重い欄は表に入れない
 *   ・ポリシーの全 rule にハブの判定がある（無いと、ハブは落ち、ページでは選ぶと必ず 0 軒になる）
 *   ・書き出した 1 行は決まった形で、ラベルに < があっても </script> でページを閉じない
 *   ・生成器は印の間だけを書き、外は 1 バイトも変えない。2 回続けても同じ。印が無ければ作り直さず、理由を出す
 *   ・--check は差があれば失敗、--dry-run は書かない
 *
 * やらないこと: コミット済みの index.html の区画が「今のポリシーと一致するか」は見ない。区画は build.js が毎回書き直す生成物で、
 *   build を通さずに npm test を回す経路（定期ルーチンの自動マージ）では鮮度が合わないため。
 *   ここで見るのは「生成器が正しい区画を正しく書くこと」。実物の index.html は一時ディレクトリに複製して流し、実物は書き換えない。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FP = require('../scripts/lib/filter_policy.js');
const BFP = require('../scripts/build_filter_policy.js');
const HUB = require('../scripts/lib/area_genre_pages.js');
const POLICY = HUB.loadPolicy();
const REAL_INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const [START, END] = FP.REGION;

// 小さなポリシー（本物と同じ欄を持つが、件数・中身は自由に動かせる）
const MINI = {
  areas: [
    { slug: 'aa', label: 'エリアA', ward: '中区', feature: 'features/a.html', match: ['甲', '乙'] },
    { slug: 'bb', label: 'エリアB', ward: null, feature: 'features/b.html', match: ['丙'] },
  ],
  conditions: [
    { slug: 'c1', label: '条件1', rule: 'koshitsu', feature: 'features/x.html', guide: '長い案内文（ページには入れない）' },
    { slug: 'c2', label: '条件2', rule: 'lunch', guide: 'もう一つの案内文（ページには入れない）' },
  ],
};
const MINI_TABLE = {
  areas: [
    { slug: 'aa', label: 'エリアA', ward: '中区', match: ['甲', '乙'] },
    { slug: 'bb', label: 'エリアB', ward: '', match: ['丙'] },
  ],
  conds: [
    { slug: 'c1', label: '条件1', rule: 'koshitsu' },
    { slug: 'c2', label: '条件2', rule: 'lunch' },
  ],
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const quiet = { log: () => {}, warn: () => {} };

// 区画（印の間）の中身を、JS として評価して表を取り出す
function evalRegion(html) {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  assert.ok(a >= 0 && b > a, '印が START → END の順にある');
  const body = html.slice(a + START.length, b).trim();
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(body, ctx);
  return JSON.parse(JSON.stringify(ctx.NB_FILTER_POLICY));
}
const outside = (html) => [html.slice(0, html.indexOf(START) + START.length), html.slice(html.indexOf(END))];

function skeleton(body) {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n<script>\nvar BEFORE = 1;\n${START}\n${body}\n${END}\nvar AFTER = 2;\n</script>\n</body></html>\n`;
}
// 一時ディレクトリ（index.html とポリシーを置く）。後始末は finally で
function tmpRoot(indexHtml, policy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-policy-'));
  fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'index.html'), indexHtml);
  if (policy !== null) fs.writeFileSync(path.join(dir, 'data', 'area_genre_pages_policy.json'), typeof policy === 'string' ? policy : JSON.stringify(policy));
  return dir;
}
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const readIndex = (dir) => fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// ── 1. buildFilterPolicy ───────────────────────────────────────────────
test('buildFilterPolicy: 実物のポリシーから、ページが使う欄だけの表を作る（案内文・特集のリンクは入れない）', () => {
  const frozen = (function deepFreeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; })(clone(POLICY));
  const out = FP.buildFilterPolicy(frozen);                     // 凍らせた入力でも落ちない（入力を書き換えない）
  assert.deepStrictEqual(Object.keys(out), ['areas', 'conds']);
  assert.strictEqual(out.areas.length, POLICY.areas.length, 'エリアの数はポリシーと同じ（数を固定しない）');
  assert.strictEqual(out.conds.length, POLICY.conditions.length, '条件の数はポリシーと同じ');
  assert.ok(out.areas.length > 0 && out.conds.length > 0, '空ではない');
  out.areas.forEach((a, i) => {
    const src = POLICY.areas[i];
    assert.deepStrictEqual(Object.keys(a), ['slug', 'label', 'ward', 'match'], `エリア ${src.slug} の欄`);
    assert.strictEqual(a.slug, src.slug, '並びはポリシーのまま');
    assert.strictEqual(a.label, src.label);
    assert.strictEqual(a.ward, src.ward || '', '区の無い群は空文字');
    assert.deepStrictEqual(a.match, src.match);
    assert.notStrictEqual(a.match, src.match, '配列は入力と共有しない');
  });
  out.conds.forEach((c, i) => {
    const src = POLICY.conditions[i];
    assert.deepStrictEqual(Object.keys(c), ['slug', 'label', 'rule'], `条件 ${src.slug} の欄`);
    assert.strictEqual(c.slug, src.slug);
    assert.strictEqual(c.label, src.label);
    assert.strictEqual(c.rule, src.rule);
  });
  // ページを重くする欄（案内文・特集へのリンク）は表に入れない
  const text = JSON.stringify(out);
  POLICY.conditions.forEach((c) => { if (c.guide) assert.ok(!text.includes(c.guide), `${c.slug}: 案内文はページに入れない`); });
  assert.ok(!/"feature"|"guide"/.test(text), 'feature・guide の欄が無い');
});

test('buildFilterPolicy: ポリシーを増減・並べ替えれば表も追随する（件数や中身を固定しない）', () => {
  assert.deepStrictEqual(FP.buildFilterPolicy(MINI), MINI_TABLE);
  // 足す
  const more = clone(MINI);
  more.areas.push({ slug: 'cc', label: 'エリアC', ward: '熱田区', match: ['丁'] });
  more.conditions.push({ slug: 'c3', label: '条件3', rule: 'parking' });
  const t = FP.buildFilterPolicy(more);
  assert.deepStrictEqual(t.areas.map((a) => a.slug), ['aa', 'bb', 'cc']);
  assert.deepStrictEqual(t.conds.map((c) => c.slug), ['c1', 'c2', 'c3']);
  assert.deepStrictEqual(t.areas[2], { slug: 'cc', label: 'エリアC', ward: '熱田区', match: ['丁'] });
  // 消す・並べ替える
  const less = clone(MINI);
  less.areas.shift();
  less.conditions.reverse();
  const u = FP.buildFilterPolicy(less);
  assert.deepStrictEqual(u.areas.map((a) => a.slug), ['bb']);
  assert.deepStrictEqual(u.conds.map((c) => c.slug), ['c2', 'c1'], '並びはポリシーのまま（ハッシュの並びの元になる）');
  // 実物のポリシーを 1 つ増やしても、1 つだけ増える
  const real = clone(POLICY);
  real.areas.push({ slug: 'zz-test', label: 'テスト群', ward: '', match: ['テスト'] });
  assert.strictEqual(FP.buildFilterPolicy(real).areas.length, POLICY.areas.length + 1);
});

test('buildFilterPolicy: 欠けた値・数の値でも落ちず、文字列にそろえる（区の無い群は空文字）', () => {
  assert.deepStrictEqual(FP.buildFilterPolicy({}), { areas: [], conds: [] });
  assert.deepStrictEqual(FP.buildFilterPolicy({ areas: [], conditions: [] }), { areas: [], conds: [] });
  const t = FP.buildFilterPolicy({
    areas: [{ slug: 1, label: 2, match: [3, 'x'] }, { slug: 'b', label: 'B', ward: null }, { slug: 'c', label: 'C', ward: '', match: null }, { slug: 'd', label: 'D', ward: 0 }],
    conditions: [{ slug: 'k', label: 4, rule: 5 }],
  });
  assert.deepStrictEqual(t.areas[0], { slug: '1', label: '2', ward: '', match: ['3', 'x'] }, '数は文字列にそろえる');
  assert.deepStrictEqual(t.areas[1], { slug: 'b', label: 'B', ward: '', match: [] }, 'ward が null・match が無い');
  assert.deepStrictEqual(t.areas[2].match, [], 'match が null');
  assert.strictEqual(t.areas[3].ward, '');
  assert.deepStrictEqual(t.conds[0], { slug: 'k', label: '4', rule: '5' });
});

test('ポリシーの整合: slug・ラベル・rule が重ならず、slug はハッシュにそのまま書ける文字。エリアの原文は群をまたいで重ならない', () => {
  const t = FP.buildFilterPolicy(POLICY);
  const uniq = (arr, what) => assert.strictEqual(new Set(arr).size, arr.length, `${what}が重なっている: ${arr.join(' / ')}`);
  uniq(t.areas.map((a) => a.slug), 'エリアの slug');
  uniq(t.areas.map((a) => a.label), 'エリアのラベル');
  uniq(t.conds.map((c) => c.slug), '条件の slug');
  uniq(t.conds.map((c) => c.label), '条件のラベル');
  uniq(t.conds.map((c) => c.rule), '条件の rule（1 つの rule を 2 つの札に割り当てない）');
  t.areas.concat(t.conds).forEach((x) => {
    assert.ok(/^[a-z0-9-]+$/.test(x.slug), `slug は a-z・数字・ハイフンだけ（ハッシュ #area=… にそのまま書ける）: ${x.slug}`);
    assert.ok(x.label.trim() !== '', `${x.slug}: ラベルが空`);
  });
  t.conds.forEach((c) => assert.ok(c.rule.trim() !== '', `${c.slug}: rule が空`));
  t.areas.forEach((a) => {
    assert.ok(a.match.length > 0 && a.match.every((m) => m.trim() !== ''), `${a.slug}: 原文の表記（match）が 1 つ以上あり、空ではない`);
  });
  // 同じ原文が 2 つの群に入ると、どちらの群として数えるかが決まらない
  const owner = new Map();
  t.areas.forEach((a) => a.match.forEach((m) => {
    assert.ok(!owner.has(m) || owner.get(m) === a.slug, `原文「${m}」が ${owner.get(m)} と ${a.slug} の両方に入っている`);
    owner.set(m, a.slug);
  }));
});

test('ポリシーの全 rule にハブの判定がある（無いとハブは落ち、ページでは選ぶと必ず 0 軒になる）', () => {
  const t = FP.buildFilterPolicy(POLICY);
  assert.ok(t.conds.length > 0);
  t.conds.forEach((c) => {
    assert.strictEqual(typeof HUB.CONDITION_RULES[c.rule], 'function', `条件 ${c.slug} の rule「${c.rule}」の判定がハブに無い`);
    assert.doesNotThrow(() => HUB.storeMatchesCondition({}, c.rule), `${c.rule}: 空の店でも判定できる`);
  });
  assert.throws(() => HUB.storeMatchesCondition({}, 'このruleは無い'), /unknown condition rule/, '知らない rule はハブが例外にする（黙って偽にしない）');
});

// ── 2. renderFilterPolicy・REGION ───────────────────────────────────────
test('renderFilterPolicy: 同じ入力なら同じ 1 行。評価すると元の表に戻る。< は \\u003c にして </script> でページを閉じない', () => {
  [MINI_TABLE, FP.buildFilterPolicy(POLICY)].forEach((t, i) => {
    const line = FP.renderFilterPolicy(t);
    assert.strictEqual(FP.renderFilterPolicy(t), line, `決定的（${i}）`);
    assert.strictEqual(FP.renderFilterPolicy(clone(t)), line, '複製でも同じ（入力の並びで決まる）');
    assert.ok(/^var NB_FILTER_POLICY = \{.*\};$/.test(line), '決まった形の 1 行');
    assert.ok(!line.includes('\n'), '改行を含まない');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(line, ctx);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.NB_FILTER_POLICY)), t, '評価すると元の表');
  });
  // ラベルに < があっても、ページの <script> を閉じない・コメントを始めない
  const evil = { areas: [{ slug: 'x', label: '</script><script>alert(1)</script><!--', ward: '', match: ['a<b'] }], conds: [{ slug: 'y', label: '<img src=x onerror=1>', rule: 'koshitsu' }] };
  const line = FP.renderFilterPolicy(evil);
  assert.ok(!line.includes('<'), '< は 1 文字も生で残さない');
  assert.ok(line.includes('\\u003c/script>'), '</script> は \\u003c/script> になる');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(line, ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.NB_FILTER_POLICY)), evil, '評価すると < は元に戻る');
  // ページの HTML に入れても、スクリプトが途中で終わらない
  const page = `<script>\n${line}\n</script>`;
  assert.strictEqual(page.split('</script>').length - 1, 1, 'ページの中の </script> は閉じる 1 つだけ');
});

test('REGION: 開始と終了は別々の 1 行コメント。実物の index.html に 1 組だけ、開始が先にある（中身は見ない）', () => {
  assert.ok(Array.isArray(FP.REGION) && FP.REGION.length === 2);
  assert.notStrictEqual(START, END);
  assert.ok(/^\/\* NB-FILTER-POLICY:START \*\/$/.test(START) && /^\/\* NB-FILTER-POLICY:END \*\/$/.test(END), `印の形: ${START} / ${END}`);
  assert.ok(!START.includes('\n') && !END.includes('\n'));
  assert.strictEqual(REAL_INDEX.split(START).length - 1, 1, 'index.html の開始の印は 1 つだけ');
  assert.strictEqual(REAL_INDEX.split(END).length - 1, 1, 'index.html の終了の印は 1 つだけ');
  assert.ok(REAL_INDEX.indexOf(START) < REAL_INDEX.indexOf(END), '開始が終了より前');
});

// ── 3. patchRegion ─────────────────────────────────────────────────────
test('patchRegion: 印の間だけを置き換え、外は変えない。置き換える文字の中の $ を特別扱いしない。同じ内容なら同じ結果', () => {
  const html = `head\n${START}\nOLD\nsecond line\n\n   third\n${END}\ntail\n`;
  const out = BFP.patchRegion(html, 'NEW');
  assert.strictEqual(out, `head\n${START}\nNEW\n${END}\ntail\n`, '古い中身（複数行・空行・字下げ）は全部消えて 1 行になる');
  assert.strictEqual(BFP.patchRegion(out, 'NEW'), out, '冪等');
  assert.strictEqual(BFP.patchRegion(html, 'NEW'), out, '決定的');
  // 外側は 1 バイトも変えない
  const [pre, post] = [out.slice(0, out.indexOf(START) + START.length), out.slice(out.indexOf(END))];
  assert.strictEqual(pre, html.slice(0, html.indexOf(START) + START.length));
  assert.strictEqual(post, html.slice(html.indexOf(END)));
  // $& や $1 を含む文字をそのまま書く（String#replace の置換パターンにしない）
  const tricky = 'var x = "$& $1 $` $\' $$";';
  const t = BFP.patchRegion(html, tricky);
  assert.strictEqual(t, `head\n${START}\n${tricky}\n${END}\ntail\n`);
  // 空の中身でも印は残る
  assert.strictEqual(BFP.patchRegion(html, ''), `head\n${START}\n\n${END}\ntail\n`);
});

test('patchRegion: 印が無い・片方だけ・逆順なら null（作り直さない）', () => {
  assert.strictEqual(BFP.patchRegion('印なし', 'x'), null);
  assert.strictEqual(BFP.patchRegion(`a ${START} b`, 'x'), null, '終了の印だけ無い');
  assert.strictEqual(BFP.patchRegion(`a ${END} b`, 'x'), null, '開始の印だけ無い');
  assert.strictEqual(BFP.patchRegion(`a ${END} b ${START} c`, 'x'), null, '終了が開始より前（逆順）');
  assert.strictEqual(BFP.patchRegion('', 'x'), null);
  // 印が隣り合っていても、置き換えられる（中身が空の区画）
  assert.strictEqual(BFP.patchRegion(`${START}${END}`, 'x'), `${START}\nx\n${END}`);
});

// ── 4. main（一時ディレクトリで） ────────────────────────────────────────
test('main: 印の間だけを書き、外は 1 バイトも変えない。区画は評価するとポリシーから作った表。2 回続けても同じ', () => {
  const stale = skeleton('var NB_FILTER_POLICY = {"areas":[],"conds":[]};');
  const dir = tmpRoot(stale, MINI);
  try {
    const r1 = BFP.main(Object.assign({ root: dir }, quiet));
    assert.strictEqual(r1.changed, true, '古い表は書き換わる');
    assert.strictEqual(r1.missing, false);
    assert.deepStrictEqual(r1.policy, MINI_TABLE, '戻り値の表');
    const out = readIndex(dir);
    assert.strictEqual(out, r1.html, '戻り値の html がファイルと同じ');
    assert.deepStrictEqual(outside(out), outside(stale), '印と、その外側は 1 バイトも変わらない');
    assert.strictEqual(out.slice(out.indexOf(START) + START.length, out.indexOf(END)), '\n' + FP.renderFilterPolicy(MINI_TABLE) + '\n', '区画の中身は renderFilterPolicy の 1 行だけ');
    assert.deepStrictEqual(evalRegion(out), MINI_TABLE);
    const r2 = BFP.main(Object.assign({ root: dir }, quiet));
    assert.strictEqual(r2.changed, false, '2 回目は何も変えない（冪等）');
    assert.strictEqual(readIndex(dir), out);
  } finally { rm(dir); }
});

test('main: write:false なら index.html を書かない（--check・--dry-run の元）。ポリシーを変えると区画が追随する', () => {
  const stale = skeleton('var NB_FILTER_POLICY = {"stale":true};');
  const dir = tmpRoot(stale, MINI);
  try {
    const r = BFP.main(Object.assign({ root: dir, write: false }, quiet));
    assert.strictEqual(r.changed, true, '差があることは分かる');
    assert.strictEqual(readIndex(dir), stale, '書かない');
    assert.deepStrictEqual(evalRegion(r.html), MINI_TABLE, 'もし書いたらこうなる、の html を返す');
    BFP.main(Object.assign({ root: dir }, quiet));
    assert.deepStrictEqual(evalRegion(readIndex(dir)), MINI_TABLE);
    // ポリシーを変える（エリアを足し・条件を消す）と、次の実行で区画が変わる。外側は変わらない
    const next = clone(MINI);
    next.areas.push({ slug: 'cc', label: 'エリアC', ward: '熱田区', match: ['丁'] });
    next.conditions.shift();
    fs.writeFileSync(path.join(dir, 'data', 'area_genre_pages_policy.json'), JSON.stringify(next));
    const r2 = BFP.main(Object.assign({ root: dir }, quiet));
    assert.strictEqual(r2.changed, true);
    const t = evalRegion(readIndex(dir));
    assert.deepStrictEqual(t.areas.map((a) => a.slug), ['aa', 'bb', 'cc']);
    assert.deepStrictEqual(t.conds.map((c) => c.slug), ['c2']);
    assert.deepStrictEqual(outside(readIndex(dir)), outside(stale));
  } finally { rm(dir); }
});

test('main: 印が無い index.html は作り直さず（missing:true・ファイルは不変）、無いと分かる警告を出す。ポリシーが読めなければ書かずに落ちる', () => {
  const cases = [
    ['印なし', '<html>印なし</html>'],
    ['開始だけ', `<html>${START}\nx</html>`],
    ['終了だけ', `<html>x\n${END}</html>`],
    ['逆順', `<html>${END}\nx\n${START}</html>`],
  ];
  cases.forEach(([label, html]) => {
    const dir = tmpRoot(html, MINI);
    const warns = [];
    try {
      const r = BFP.main({ root: dir, log: () => {}, warn: (m) => warns.push(m) });
      assert.strictEqual(r.missing, true, `${label}: missing`);
      assert.strictEqual(r.changed, false, `${label}: changed`);
      assert.strictEqual(readIndex(dir), html, `${label}: ファイルは変わらない`);
      assert.strictEqual(r.html, html);
      assert.strictEqual(warns.length, 1, `${label}: 警告は 1 つ`);
      assert.ok(warns[0].includes('NB-FILTER-POLICY:START') && warns[0].includes('index.html'), `${label}: 何が無いかが分かる: ${warns[0]}`);
    } finally { rm(dir); }
  });
  // ポリシーが壊れている・無いときは、黙って空の表を書かず、例外にする（index.html は不変）
  const stale = skeleton('var NB_FILTER_POLICY = {"stale":true};');
  [['壊れた JSON', '{ not json'], ['ポリシー無し', null]].forEach(([label, policy]) => {
    const dir = tmpRoot(stale, policy);
    try {
      assert.throws(() => BFP.main(Object.assign({ root: dir }, quiet)), undefined, label);
      assert.strictEqual(readIndex(dir), stale, `${label}: index.html は変わらない`);
    } finally { rm(dir); }
  });
});

test('main: 実物の index.html と実物のポリシーの複製に流すと、区画は見つかり、外は 1 バイトも変わらず、2 回目は何も変えない（実物は書かない）', () => {
  const realBefore = REAL_INDEX;
  const dir = tmpRoot(REAL_INDEX, POLICY);
  try {
    const r1 = BFP.main(Object.assign({ root: dir }, quiet));
    assert.strictEqual(r1.missing, false, 'index.html に区画の印がある（印を消すと、ポリシーを直してもトップに届かない）');
    const out = readIndex(dir);
    assert.deepStrictEqual(outside(out), outside(REAL_INDEX), '区画の外（1.3MB 近い本体）は 1 バイトも変わらない');
    assert.deepStrictEqual(evalRegion(out), FP.buildFilterPolicy(POLICY), '区画はポリシーから作った表');
    const r2 = BFP.main(Object.assign({ root: dir }, quiet));
    assert.strictEqual(r2.changed, false, '冪等');
    assert.strictEqual(readIndex(dir), out);
  } finally { rm(dir); }
  assert.strictEqual(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), realBefore, '実物の index.html は書き換えない');
});

// ── 5. コマンド（--check・--dry-run・既定） ──────────────────────────────
// 実物に触れないよう、スクリプトと lib を一時ディレクトリの scripts/ に複製し、その上位に index.html とポリシーを置いて実行する
function cliRoot(indexHtml) {
  const dir = tmpRoot(indexHtml, MINI);
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', 'build_filter_policy.js'), path.join(dir, 'scripts', 'build_filter_policy.js'));
  fs.copyFileSync(path.join(ROOT, 'scripts', 'lib', 'filter_policy.js'), path.join(dir, 'scripts', 'lib', 'filter_policy.js'));
  return dir;
}
function runCli(dir, args) {
  const env = Object.assign({}, process.env);
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'build_filter_policy.js')].concat(args), { encoding: 'utf8', env, timeout: 30000 });
  assert.strictEqual(r.error, undefined, String(r.error));
  return r;
}

test('コマンド: --check は区画が古ければ exit 1（書かない）・そろっていれば exit 0。--dry-run は書かない。何も付けなければ書く', () => {
  const stale = skeleton('var NB_FILTER_POLICY = {"stale":true};');
  const dir = cliRoot(stale);
  try {
    let r = runCli(dir, ['--check']);
    assert.strictEqual(r.status, 1, `古い区画を --check: ${r.stdout}${r.stderr}`);
    assert.ok(r.stderr.includes('NB_FILTER_POLICY'), '失敗の理由を出す: ' + r.stderr);
    assert.ok(r.stderr.includes('build_filter_policy.js'), '直し方（コマンド）を出す');
    assert.strictEqual(readIndex(dir), stale, '--check は書かない');
    r = runCli(dir, ['--dry-run']);
    assert.strictEqual(r.status, 0, `--dry-run: ${r.stderr}`);
    assert.ok(r.stdout.includes('更新'), '更新になることを出す: ' + r.stdout);
    assert.strictEqual(readIndex(dir), stale, '--dry-run は書かない');
    r = runCli(dir, []);
    assert.strictEqual(r.status, 0, `既定: ${r.stderr}`);
    assert.ok(r.stdout.includes('更新') && !r.stdout.includes('変更なし'));
    const written = readIndex(dir);
    assert.notStrictEqual(written, stale, '既定は書く');
    assert.deepStrictEqual(evalRegion(written), MINI_TABLE);
    assert.deepStrictEqual(outside(written), outside(stale));
    r = runCli(dir, ['--check']);
    assert.strictEqual(r.status, 0, `そろったあとの --check: ${r.stderr}`);
    r = runCli(dir, []);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('変更なし'), '2 回目は変更なし: ' + r.stdout);
    assert.strictEqual(readIndex(dir), written, '冪等');
  } finally { rm(dir); }
});

test('コマンド: 区画の印が無い index.html は、--check で exit 1 になり、書き込みでもファイルを作り直さず、無いと分かる警告を出す', () => {
  const html = '<html>印なし</html>';
  const dir = cliRoot(html);
  try {
    const c = runCli(dir, ['--check']);
    assert.strictEqual(c.status, 1, `--check: ${c.stdout}${c.stderr}`);
    assert.ok(c.stderr.includes('NB-FILTER-POLICY:START'), '区画が無いと分かる: ' + c.stderr);
    const w = runCli(dir, []);
    assert.ok(w.stderr.includes('NB-FILTER-POLICY:START'), '書き込みでも、黙らない（警告を出す）: ' + w.stderr);
    assert.strictEqual(readIndex(dir), html, '作り直さない');
    const d = runCli(dir, ['--dry-run']);
    assert.ok(d.stderr.includes('NB-FILTER-POLICY:START'));
    assert.strictEqual(readIndex(dir), html);
  } finally { rm(dir); }
});

// ── 6. build.js のつなぎ ───────────────────────────────────────────────
test('build.js が毎回の build で生成器を呼ぶ（呼ばなくなると、ポリシーを直してもトップの絞り込みの表が古いまま残る）', () => {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  const calls = src.match(/require\(['"]\.\/scripts\/build_filter_policy(?:\.js)?['"]\)\s*\.main\(/g) || [];
  assert.strictEqual(calls.length, 1, 'build.js から build_filter_policy.main() を 1 回呼ぶ');
  // 呼び出しが失敗しても build を止めない try/catch の中にある（表が古いまま残るだけにする）
  const at = src.indexOf(calls[0]);
  const around = src.slice(Math.max(0, at - 200), at + 400);
  assert.ok(/try\s*\{[^}]*$/.test(src.slice(Math.max(0, at - 200), at)), '呼び出しの直前に try { がある');
  assert.ok(/catch\s*\(/.test(around), '呼び出しのあとに catch がある');
});
