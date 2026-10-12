'use strict';
// I-06（P-272）: サイト全体の掲載店数の表記を、データから作る1つの値（約5,000）にそろえる。
// - 数え方（営業中の店）と丸め（500 件単位）
// - 静的な文面の数字の書き換え（言い回しは変えない・冪等・触らない文面を触らない）
// - 生成側（llms.txt・ジャーナル冒頭の紹介文）が同じ値を使うこと
// - build.yml の順（ページの生成が終わった後・コミットの前）
// ページの実データを見るテストは置かない: build.yml の npm test は再生成の前に走るため、丸めた値が変わった日に
// 日次ビルドを止めてしまう（同期のステップがその日のうちに追いつく）。実データの確認は nightly_qa の store-count が行う。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const {
  ROUND_UNIT, SCOPES, roundStoreCount, siteStoreCount, syncStoreCountText, findUnmanagedTokens,
} = require(path.join(ROOT, 'scripts', 'lib', 'store_count.js'));

const COUNT = { exact: 4978, rounded: 5000, number: '5,000', label: '約5,000' };
const countOf = (rounded) => ({ exact: rounded, rounded, number: rounded.toLocaleString('en-US'), label: `約${rounded.toLocaleString('en-US')}` });
const sync = (text, scopeId, count = COUNT) => syncStoreCountText(text, SCOPES[scopeId], count);

// ---------------------------------------------------------------- 数え方と丸め

test('丸め: 500 件単位で最も近い値。ちょうど真ん中は上へ', () => {
  assert.equal(ROUND_UNIT, 500);
  assert.equal(roundStoreCount(4749), 4500);
  assert.equal(roundStoreCount(4750), 5000);
  assert.equal(roundStoreCount(4884), 5000, '2026-10-09 に HotPepper の取りこぼしで下がった日の値でも同じ表記');
  assert.equal(roundStoreCount(4978), 5000);
  assert.equal(roundStoreCount(5004), 5000);
  assert.equal(roundStoreCount(5119), 5000);
  assert.equal(roundStoreCount(5249), 5000);
  assert.equal(roundStoreCount(5250), 5500);
  assert.equal(roundStoreCount(0), 0);
});

test('ログ: 丸めの単位は ROUND_UNIT（丸めた値ではない）。「5,000 件単位」と出さない', () => {
  // --only に実在しない scope を渡さず、書き換えない --dry-run で先頭の1行だけを見る
  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'sync_store_count.js'), '--dry-run', '--only', 'faq'], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('掲載店数:'));
  assert.ok(line, '掲載店数の行が無い');
  assert.match(line, new RegExp(`（${ROUND_UNIT.toLocaleString('en-US')} 件単位に丸め）`));
  assert.doesNotMatch(line, /（5,000 件単位/);
});

test('丸め: 件数が不正なら止まる（NaN や負の数を文面に書かない）', () => {
  for (const bad of [NaN, -1, Infinity, undefined]) assert.throws(() => roundStoreCount(bad), /不正/);
});

test('数え方: 営業中の店だけ（閉店・休業を除く）。表記は「約」＋桁区切り', () => {
  const stores = [
    ...Array.from({ length: 4978 }, () => ({ '営業ステータス': 'OPERATIONAL' })),
    ...Array.from({ length: 20 }, () => ({ '営業ステータス': 'CLOSED_PERMANENTLY' })),
    ...Array.from({ length: 6 }, () => ({ '営業ステータス': 'CLOSED_TEMPORARILY' })),
  ];
  assert.deepEqual(siteStoreCount(stores), COUNT);
  assert.equal(siteStoreCount(Array.from({ length: 10200 }, () => ({}))).label, '約10,000');
});

// ---------------------------------------------------------------- 数字の書き換え

test('過去にサイト全体の数として書かれた値を、単位（店・店舗・軒）を残して「約5,000」にする。以上・超は外す', () => {
  const cases = [
    ['名古屋グルメ5,000軒｜', '名古屋グルメ約5,000軒｜'],
    ['飲食店4,500軒以上を掲載', '飲食店約5,000軒を掲載'],
    ['トップで全4,559店舗を', 'トップで全約5,000店舗を'],
    ['4,910店の構造化データ', '約5,000店の構造化データ'],
    ['4500店舗', '約5,000店舗'],
  ];
  for (const [from, to] of cases) {
    const r = sync(from, 'features');
    assert.equal(r.text, to, from);
    assert.equal(r.changes.length, 1);
  }
  assert.equal(sync('Restaurant Database — 4,584店掲載', 'stores-index').text, 'Restaurant Database — 約5,000店掲載');
});

test('数字と単位のあいだの空白は元のまま残す（「4,664 店データベース」）', () => {
  assert.equal(sync('の 4,664 店データベースから', 'features').text, 'の 約5,000 店データベースから');
  assert.equal(sync('4,664店のデータベース', 'features').text, '約5,000店のデータベース');
});

test('冪等: 2回目は何も変えない。丸めた値が変わった日は「約N」が追いつく', () => {
  const src = '名古屋グルメ4,500軒以上。全4,559店舗。4,910店の構造化データ。';
  const once = sync(src, 'features');
  const twice = sync(once.text, 'features');
  assert.equal(twice.text, once.text);
  assert.equal(twice.changes.length, 0);
  const later = sync(once.text, 'features', countOf(5500));
  assert.match(later.text, /約5,500軒/);
  assert.match(later.text, /約5,500店の構造化データ/);
  assert.ok(!later.text.includes('5,000'), '前の丸めた値が残らない');
  assert.equal(sync(later.text, 'features', countOf(5500)).changes.length, 0);
});

test('触らない: 日付つきの数・ジャンルやエリアごとの件数・実測した母数・一覧の件数・金額', () => {
  const keep = [
    '2026年5月時点で4,584店を掲載しています',
    'ジャンル別では居酒屋1,801店、和食465店、焼肉463店',
    '名古屋の居酒屋1,801軒から業界人が厳選',
    '2026-08-20 の実測分布（5,030 店）: SS 4%',
    '掲載4,768店の営業時間を実測すると',
    '名古屋3,697軒の料理L.O.から',
    'エリア別 全店舗一覧（5004店）',
    'ランチコースは2,500〜4,500円が目安',
    '厳選10店 ／ 15選 ／ 62店',
    '14,500軒',
    '1.4,500軒',
  ];
  for (const s of keep) {
    for (const id of Object.keys(SCOPES)) {
      const scope = SCOPES[id];
      const text = scope.region ? `<p class="nb-site-intro">${s}</p>` : s;
      assert.equal(syncStoreCountText(text, scope, COUNT).text, text, `${id}: ${s}`);
    }
  }
});

test('触らない: 値が合っていても、legacy に無いサイト外の scope の値（faq の 1,000 を features に当てない）', () => {
  assert.equal(sync('1,000軒以上を掲載中です', 'features').text, '1,000軒以上を掲載中です');
  assert.equal(sync('1,000軒以上を掲載中です', 'faq').text, '約5,000軒を掲載中です');
  assert.equal(sync('厳選1,100店超', 'features').text, '厳選1,100店超');
});

test('構造化データ: numberOfItems（1,000 以上）をそろえるのは index と stores/index だけ。特集の本数は触らない', () => {
  const ld = '"numberOfItems": 4559,\n  "x": 1';
  assert.equal(sync(ld, 'index').text, '"numberOfItems": 5000,\n  "x": 1');
  assert.equal(sync('"numberOfItems": 4584', 'stores-index').text, '"numberOfItems": 5000');
  assert.equal(sync('"numberOfItems":4584}', 'stores-index').text, '"numberOfItems":5000}');
  assert.equal(sync(ld, 'features').text, ld);
  assert.equal(sync('"numberOfItems":15,"itemListElement"', 'index').text, '"numberOfItems":15,"itemListElement"');
  const twice = sync(sync(ld, 'index').text, 'index');
  assert.equal(twice.changes.length, 0);
});

test('トップの権威性バー: id="auth-total" の静的な数字を、丸めた数字（約なし）にそろえる。他の要素は触らない', () => {
  // 表示のときは index.html の loadStores() が実データの件数で上書きする。ここは JS を実行しないクローラ・初回描画が見る値
  const bar = '<span><span class="num-serif" id="auth-total">4,559</span>店</span>';
  const r = sync(bar, 'index');
  assert.equal(r.text, '<span><span class="num-serif" id="auth-total">5,000</span>店</span>');
  assert.equal(r.changes.length, 1);
  assert.equal(sync(r.text, 'index').changes.length, 0, '冪等');
  // 丸めた値が変わった日は追いつく
  assert.equal(sync(r.text, 'index', countOf(5500)).text, bar.replace('4,559', '5,500'));
  // 上書きされる前後で表示の幅が動かない（約を付けない・桁数が同じ）
  assert.equal(r.text.match(/id="auth-total">([^<]*)</)[1].length, '4,559'.length);
  // 他の id・class・data-id・1,000 未満の仮置き（TOP50 の「50」）・ほかの scope は触らない
  const other = '<span id="auth-other">4,559</span><span id="auth-total">50</span><span class="auth-total">4,559</span><i data-id="auth-total">4,559</i>';
  assert.equal(sync(other, 'index').text, other);
  assert.equal(sync(bar, 'faq').text, bar);
  assert.equal(sync(bar, 'features').text, bar);
  assert.equal(sync(bar, 'stores-index').text, bar);
  // 実際のトップが、実行時に上書きする口を持っていること（口が無くなれば静的な値が見えたままになる）
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal((index.match(/id="auth-total"/g) || []).length, 1);
  assert.match(index, /\['auth-total'\]\.forEach\(function\(id\)/);
});

test('トップへの導線: 特集では「全N店舗を検索する」を雛形（scripts/add_related_features.js）の数字なしにそろえる', () => {
  const a = sync('トップページで全4,559店舗を検索する →', 'features');
  assert.equal(a.text, 'トップページで全店舗を検索する →');
  assert.equal(a.changes.length, 1, '数字を約5,000にしてから外す、という二重の変更を数えない');
  assert.equal(sync('← トップページで全4500店舗を検索する', 'features').text, '← トップページで全店舗を検索する');
  assert.equal(sync('トップページで全約5,000店舗を検索する', 'features').text, 'トップページで全店舗を検索する');
  // 雛形はもう数字を持たない（持つようになったら、この規則と合わなくなる）
  const tpl = fs.readFileSync(path.join(ROOT, 'scripts', 'add_related_features.js'), 'utf8');
  assert.match(tpl, /トップページで全店舗を検索する/);
  assert.doesNotMatch(tpl, /トップページで全[\d,]/);
});

test('ジャーナル: 記事の冒頭の紹介文（nb-site-intro）の中だけ。本文の数は触らない', () => {
  const intro = '<p class="nb-site-intro">この記事は<a href="../index.html">NAGOYA BITES</a> — 名古屋の厳選1,100店超を業界視点で紹介するグルメガイドの一部です。</p>';
  const body = '<p>掲載1,100店のうち、朝営業は172店。</p>';
  const r = sync(`${intro}\n${body}`, 'journal');
  assert.equal(r.text, `${intro.replace('1,100店超', '約5,000店')}\n${body}`);
  assert.equal(r.changes.length, 1);
  assert.equal(sync(r.text, 'journal').changes.length, 0);
});

test('データを埋めた長い行（var LOCAL_STORES = [...]）は対象にしない', () => {
  const longLine = `var LOCAL_STORES = [{"おすすめポイント":"全4,500軒以上から${'あ'.repeat(25000)}"}];`;
  const text = `<title>名古屋グルメ5,000軒｜x</title>\n${longLine}\n`;
  const r = sync(text, 'index');
  assert.ok(r.text.includes('<title>名古屋グルメ約5,000軒｜x</title>'));
  assert.ok(r.text.includes('全4,500軒以上から'), '長い行は書き換えない');
});

test('対象外の一覧: 1,000 以上の「N店/N軒」のうち同期しないものと、日付つきの数を分けて返す', () => {
  const text = '居酒屋1,801店、2026年5月時点で4,584店、約5,000軒、4,559店舗、一覧（5004店）、900店';
  const found = findUnmanagedTokens(text, SCOPES.index);
  const tokens = found.map((f) => f.token);
  assert.deepEqual(tokens.sort(), ['1,801店', '4,584店', '5004店'].sort());
  assert.equal(found.find((f) => f.token === '4,584店').dated, true);
  assert.equal(found.find((f) => f.token === '1,801店').dated, false);
});

test('scope: legacy の値は 1,000 以上の整数で、丸めの単位の倍数でない値は「約」つきでは管理しない', () => {
  for (const [id, scope] of Object.entries(SCOPES)) {
    assert.ok(scope.legacy.size > 0, id);
    for (const v of scope.legacy) assert.ok(Number.isInteger(v) && v >= 1000, `${id}: ${v}`);
  }
  // 約N（N が単位の倍数でない）は触らない: 「約1,801軒」のような別の数を壊さない
  assert.equal(sync('約1,801軒', 'features').text, '約1,801軒');
});

// ---------------------------------------------------------------- 生成側が同じ値を使う

test('ジャーナルの紹介文を作るスクリプトは、固定の数字を書かず同じ値を入れる', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-count-'));
  const file = path.join(dir, 'article.html');
  fs.writeFileSync(file, '<html><body><div class="art-body">\n<p>本文</p>\n</div></body></html>\n', 'utf8');
  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'add_journal_site_intro.js'), file], { encoding: 'utf8' });
  assert.match(out, /modified=1/);
  const html = fs.readFileSync(file, 'utf8');
  const label = siteStoreCount().label;
  assert.ok(html.includes(`名古屋の厳選${label}店を業界視点で紹介するグルメガイドの一部です。`), html);
  assert.doesNotMatch(html, /1,100/);
  // 紹介文は同期の対象と同じ形（同期が追随できる）
  assert.equal(syncStoreCountText(html, SCOPES.journal, siteStoreCount()).changes.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('llms.txt: 店数の欄は同じ丸めた値。マーカーの前後の文は「約約」「約…以上」にならない', () => {
  const G = require(path.join(ROOT, 'scripts', 'gen_llms_txt.js'));
  const original = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  const content = G.buildMarkerContent(original, '2026-10-12');
  assert.equal(content.store_count, siteStoreCount().label);
  assert.match(content.store_count, /^約[\d,]+$/);
  const re = /(.{0,3})<!-- AUTO-GENERATED:store_count:start -->[^<]*<!-- AUTO-GENERATED:store_count:end -->(.{0,3})/g;
  let n = 0;
  for (const m of original.matchAll(re)) {
    n++;
    assert.ok(!m[1].endsWith('約'), `約が二重: ${m[0]}`);
    assert.ok(!m[2].startsWith('軒以上'), `約と以上が並ぶ: ${m[0]}`);
  }
  assert.ok(n >= 4, '店数の欄が減っている');
  // 正確な数は統計にだけ残る（エリア別内訳の見出し）
  assert.match(content.areas, /営業中[\d,]+店中[\d,]+店をマッピング/);
});

// ---------------------------------------------------------------- build.yml

const BUILD = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'build.yml'), 'utf8').split('\n');
const runLine = (re) => BUILD.findIndex((l) => !/^\s*#/.test(l) && /^\s*run:\s/.test(l) && re.test(l));
const nameLine = (re) => BUILD.findIndex((l) => /^\s*-\s+name:\s/.test(l) && re.test(l));

test('build.yml: 店数の表記の同期は、特集・トップの書き換えが終わった後・コミットの前。失敗してもデプロイを止めない', () => {
  const syncAt = runLine(/node scripts\/sync_store_count\.js\b/);
  const llms = runLine(/node scripts\/gen_llms_txt\.js/);
  const features = runLine(/node scripts\/sync_feature_counts\.js\s*$/);
  const commit = nameLine(/Commit & push if changed/);
  assert.ok(syncAt >= 0, 'sync_store_count.js のステップが無い');
  assert.ok(features >= 0 && features < syncAt, '特集の書き換え（sync_feature_counts.js）の後に置く');
  assert.ok(llms >= 0 && llms < syncAt, 'llms.txt の再生成の後に置く');
  assert.ok(syncAt < commit, 'コミットより前に置く');
  assert.doesNotMatch(BUILD[syncAt], /--only[^\n]*journal/, 'build.yml は journal/ を触らない（書き手を1つにするため）');
  let ok = false;
  for (let i = syncAt + 1; i < BUILD.length && !/^\s*-\s+name:/.test(BUILD[i]); i++) {
    if (/^\s*continue-on-error:\s*true\s*$/.test(BUILD[i])) { ok = true; break; }
  }
  assert.ok(ok, 'continue-on-error: true が無い');
});

test('build.yml: 同期で書き換えるファイル（faq.html）はコミットの対象に入っている', () => {
  const add = BUILD.filter((l) => /^\s*git add\s/.test(l)).join('\n');
  assert.match(add, /(^|\s)faq\.html(\s|$)/m);
});

test('nightly_qa: 店数の表記のずれを soft で数える', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'nightly_qa.js'), 'utf8');
  assert.match(src, /id: 'store-count'[\s\S]{0,300}hard: false[\s\S]{0,200}sync_store_count\.js', '--check'/);
});
