'use strict';

/**
 * tests/i35_guards.test.js — I-35「後戻りを止める自動の検査」4本の決まり
 *   ① 店の選び方の言い方   scripts/audit_selection_wording.js ＋ data/selection_wording_policy.json
 *   ② style 属性の文字の大きさ  scripts/audit_design_system.js --inline-style
 *   ③ 画像の配信元        scripts/audit_image_sources.js ＋ data/image_source_policy.json
 *   ④ ページ種別ごとの重さ scripts/audit_page_weight.js ＋ data/page_weight_policy.json
 *
 * 公開ページの実物は読まない（build.yml は npm test を再生成の前に回す。生成済みのページを読むテストは
 * 書かない）。小さな fixture のディレクトリを作って --root で見せる。読むのは data/ の方針の JSON と
 * scripts/ だけ（どちらも手で保守しているもの）。
 *
 * 4本とも夜間QA の soft で回す（今は赤のものがある）。ここで守るのは「検査自体が正しく数えること」と
 * 「夜間QA に載っていること」。数える対象が 0 件になる日（P-237 #2・I-26b・I-09）に hard へ上げる。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const wording = require(path.join(SCRIPTS, 'audit_selection_wording.js'));
const images = require(path.join(SCRIPTS, 'audit_image_sources.js'));
const weight = require(path.join(SCRIPTS, 'audit_page_weight.js'));
const pages = require(path.join(SCRIPTS, 'lib', 'published_pages.js'));

// ── fixture ────────────────────────────────────────────────────────────────
function makeRoot(files, { copy = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i35-'));
  for (const rel of copy) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
  }
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const page = (body, head = '') => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>t</title>${head}</head><body>${body}</body></html>`;
function run(script, args) {
  const r = spawnSync('node', [path.join(SCRIPTS, script), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

// ══ 公開ページの一覧（3本が共有する部品） ══════════════════════════════════════
test('published_pages: セクションと種別の分け方（_ で始まる補助ページは数えない）', () => {
  assert.equal(pages.pageTypeOf('index.html'), 'top');
  assert.equal(pages.pageTypeOf('about.html'), 'static');
  assert.equal(pages.pageTypeOf('features/index.html'), 'feature-index');
  assert.equal(pages.pageTypeOf('features/banquet.html'), 'feature');
  assert.equal(pages.pageTypeOf('journal/index.html'), 'journal-index');
  assert.equal(pages.pageTypeOf('journal/2026-10-01-x.html'), 'journal');
  assert.equal(pages.pageTypeOf('stores/index.html'), 'stores-index');
  assert.equal(pages.pageTypeOf('stores/J000000001.html'), 'store');
  assert.equal(pages.pageTypeOf('stores/area/meieki/izakaya.html'), 'hub');
  assert.equal(pages.sectionOf('stores/area/meieki/izakaya.html'), 'area');
  assert.equal(pages.sectionOf('stores/J1.html'), 'stores');
  const dir = makeRoot({
    'index.html': page('top'), 'about.html': page('a'), '_private.html': page('x'),
    'features/f.html': page('f'), 'features/_t.html': page('x'),
    'journal/j.html': page('j'), 'journal/_template.html': page('x'),
    'stores/S1.html': page('s'), 'stores/area/a/b.html': page('h'), 'stores/area/a/_c.html': page('x'),
    'notes.txt': 'not html',
  });
  try {
    const list = pages.listPublishedPages({ root: dir });
    assert.deepEqual(list.map((p) => p.rel).sort(), ['about.html', 'features/f.html', 'index.html', 'journal/j.html', 'stores/S1.html', 'stores/area/a/b.html']);
    assert.deepEqual(pages.listPublishedPages({ root: dir, only: 'area' }).map((p) => p.rel), ['stores/area/a/b.html']);
  } finally { cleanup(dir); }
});

// ══ ① 店の選び方の言い方 ═══════════════════════════════════════════════════════
const policy = wording.loadPolicy(ROOT);
const compiled = wording.compilePolicy(policy);
const count = (html, opts) => wording.scanHtml(html, compiled, opts).counts;

test('① 方針の JSON: オーナーの指示を持ち、語は重複せず、例外は理由つき', () => {
  assert.match(policy.ownerRule, /人間の飲食業界関係者がすべての店舗を選定しているような表現は使用しないでください/);
  assert.ok(compiled.terms.length >= 8);
  assert.equal(new Set(compiled.terms.map((t) => t.id)).size, compiled.terms.length);
  for (const t of compiled.terms) assert.ok(t.why, `${t.id}: why が要る`);
  for (const e of compiled.exempt) assert.ok(String(e.reason).trim(), '例外は理由つき');
  // 単独の「厳選」は誰が選んだかを書いていないので、違反には数えない（info）
  assert.equal(compiled.terms.find((t) => t.id === 'gensen').severity, 'info');
});

test('① 方針の検証: 理由の無い例外・知らない語の例外・重複した id は検査自体を落とす', () => {
  const base = { terms: [{ id: 'a', severity: 'error', pattern: 'あ', why: 'w' }] };
  assert.throws(() => wording.compilePolicy({ ...base, exempt: [{ path: 'x.html', term: 'a' }] }), /reason/);
  assert.throws(() => wording.compilePolicy({ ...base, exempt: [{ path: 'x.html', term: 'a', reason: '  ' }] }), /reason/);
  assert.throws(() => wording.compilePolicy({ ...base, exempt: [{ path: 'x.html', term: 'zzz', reason: 'r' }] }), /terms に無い/);
  assert.throws(() => wording.compilePolicy({ ...base, exempt: [{ path: 'x.html', term: 'a', phrase: '', reason: 'r' }] }), /phrase/);
  assert.throws(() => wording.compilePolicy({ terms: [...base.terms, ...base.terms] }), /重複/);
  assert.throws(() => wording.compilePolicy({ terms: [{ id: 'a', severity: 'warn', pattern: 'あ' }] }), /severity/);
  assert.throws(() => wording.compilePolicy({ terms: [] }), /空/);
  assert.doesNotThrow(() => wording.compilePolicy({ ...base, exempt: [{ path: 'x.html', term: 'a', phrase: '【あ】', reason: 'r' }] }));
});

test('① 語ごとに、人が選んだと読める言い方を数える', () => {
  const yes = {
    'gyokai-jin': '業界人が通う名古屋の店',
    'genneki-tencho': '現役の店長が編集',
    'genneki-manager': '現役の飲食店マネージャーが編集する',
    'genneki-inshokujin': '現役飲食人が選ぶ',
    'inshoku-pro': '飲食のプロが選んだ',
    'naka-no-hito': '業界の中の人が通う店',
    'megiki': '編集部が目利きした店のみ',
    'who-gensen': '業界人が厳選した10店',
    'hensyubu-sentei': '編集部の選定理由がある店',
    'gensen': '厳選した素材',
  };
  for (const [id, text] of Object.entries(yes)) {
    assert.ok(count(`<p>${text}</p>`)[id] >= 1, `${id}: 「${text}」を数える`);
  }
  // 別の書き方も
  assert.ok(count('<p>現役飲食店マネージャーが</p>')['genneki-manager']);
  assert.ok(count('<p>現役店長</p>')['genneki-tencho']);
  assert.ok(count('<p>プロの目利き</p>')['megiki']);
  assert.ok(count('<p>業界人の目利きで選定する</p>')['megiki']);
  assert.ok(count('<p>目利きセレクト</p>')['megiki']);
  assert.ok(count('<p>編集部が厳選</p>')['who-gensen']);
});

test('① 数えないもの: 店名・食材や料理人の目利き・別の意味の語・何も書いていない「厳選」', () => {
  const none = [
    '目利きの銀次 金山南口駅前店',           // 店名
    '漁師が目利きの海鮮酒場',                // 店名（漁師は選んだ人ではない）
    '食材の目利き、技術、接客',              // 食材の目利き
    '大将の確かな目利きで仕入れた',          // 料理人の腕
    '連れていった側の目利き力も伝わる',      // 読者の目利き
    'メニューの中の人気No.1',                // 「中の人」ではなく「中の人気」
    'グループの中の人数に合わせる',          // 「中の人」ではなく「中の人数」
    '飲食プロデュース会社',                  // 「飲食プロ」ではなく「飲食プロデュース」
    '業界の動向と店長のおすすめ',            // 「現役の店長」ではない
  ];
  for (const text of none) {
    const c = count(`<p>${text}</p>`);
    const errors = Object.keys(c).filter((id) => compiled.terms.find((t) => t.id === id).severity === 'error');
    assert.deepEqual(errors, [], `数えない: 「${text}」→ ${JSON.stringify(c)}`);
  }
});

test('① どこを見るか: title・meta・alt・JSON-LD は数え、コメント・<style>・普通の <script> は数えない', () => {
  const html = page(
    `<img alt="業界人が通う店" src="x.jpg"><!-- 業界人 --><style>/* 業界人 */ .a::after{content:"業界人"}</style>
     <script>var s = "業界人";</script>
     <script type="application/ld+json">{"description":"業界人が選ぶ"}</script>`,
    '<meta name="description" content="業界人が厳選">');
  const c = count(html);
  // 数える: alt・JSON-LD・meta の 3 か所（コメント・style・普通の script の「業界人」は数えない）
  assert.equal(c['gyokai-jin'], 3, JSON.stringify(c));
  assert.equal(c['who-gensen'], 1, 'meta の「業界人が厳選」');
  // scanScripts の対象（index.html）だけは <script> の中の文字（画面の文字列を JS で持つ）も数える
  const withScripts = wording.scanHtml(html, compiled, { rel: 'index.html', keepScripts: true }).counts;
  assert.equal(withScripts['gyokai-jin'], 4, '普通の script の 1 か所が増える（コメントと style は今も数えない）');
  assert.deepEqual(policy.scanScripts, ['index.html']);
});

test('① 例外: path と語、phrase まで指定すると、その言い回しだけを許す', () => {
  const html = page('<p>業界人が通う</p><p>【メモ】業界人レビュー</p>');
  const mk = (exempt) => wording.compilePolicy({ terms: [{ id: 'g', severity: 'error', pattern: '業界人' }], exempt });
  const scan = (c, rel) => wording.scanHtml(html, c, { rel });
  assert.equal(scan(mk([]), 'a.html').counts.g, 2);
  assert.equal(scan(mk([{ path: 'a.html', term: 'g', reason: 'r' }]), 'a.html').counts.g, undefined);
  assert.equal(scan(mk([{ path: 'a.html', term: 'g', reason: 'r' }]), 'b.html').counts.g, 2, '別のファイルには効かない');
  assert.equal(scan(mk([{ path: 'a.html', term: 'g', reason: 'r' }]), 'a.html').exempted, 2);
  assert.equal(scan(mk([{ path: 'dir/', term: 'g', reason: 'r' }]), 'dir/x.html').counts.g, undefined, '末尾 / はその下すべて');
  assert.equal(scan(mk([{ path: 'dir/', term: 'g', reason: 'r' }]), 'dirx/x.html').counts.g, 2, 'dir/ は dirx/ に効かない');
  const onlyReview = scan(mk([{ path: 'a.html', term: 'g', phrase: '【業界人】レビュー', reason: 'r' }]), 'a.html');
  assert.equal(onlyReview.counts.g, 1, 'phrase に合う 1 か所だけ許す');
  assert.equal(onlyReview.exempted, 1);
});

test('① 言い回しの切り出し: タグは落とし、数字は # にそろえ、一致した語を【】で囲む', () => {
  const html = '<p>今日の<b>3</b>軒を<span class="x">業界人</span>が選ぶ 2026年</p>';
  const m = html.indexOf('業界人');
  assert.equal(wording.contextOf(html, m, 3), '今日の # 軒を 【業界人】 が選ぶ #年');
});

test('① audit: 件数は種別（error / info）とセクションに分け、info は --check を落とさない', () => {
  const dir = makeRoot({
    'data/selection_wording_policy.json': JSON.stringify(policy),
    'index.html': page('<p>業界人が通う</p><script>var kicker = "業界人メモ：";</script>'),   // 画面の文字列を JS で持つトップは <script> の中も数える
    'features/a.html': page('<p>現役の飲食店マネージャーが編集</p><p>業界人</p><script>var kicker = "業界人メモ：";</script>'),   // 特集の <script> は数えない
    'journal/b.html': page('<p>厳選した素材</p>'),           // info だけ
    'stores/S1.html': page('<p>きれいな文章</p>'),
  });
  try {
    const r = wording.audit({ root: dir });
    assert.equal(r.files_scanned, 4);
    assert.equal(r.ok, false);
    assert.equal(r.error_pages, 2);
    assert.equal(r.error_occurrences, 4, 'index.html は <script> の中の 1 か所も数える（特集の <script> は数えない）');
    assert.equal(r.by_section.root.pages, 1);
    assert.equal(r.by_section.root.occurrences, 2);
    assert.equal(r.by_section.features.occurrences, 2);
    assert.equal(r.by_section.journal.pages, 0, 'info だけのページは違反に数えない');
    assert.equal(r.terms.find((t) => t.id === 'gensen').pages, 1, 'info は集計には出す');
    assert.equal(r.violations[0].occurrences, 2, '多い順');
    // CLI
    assert.equal(run('audit_selection_wording.js', ['--root', dir]).code, 0, '--check なしは落とさない');
    const chk = run('audit_selection_wording.js', ['--root', dir, '--check']);
    assert.equal(chk.code, 1);
    assert.match(chk.out, /❌ 人が選んだと読める言い方（合計）: 2 ページ・4 か所/);
    const j = JSON.parse(run('audit_selection_wording.js', ['--root', dir, '--json']).out);
    assert.equal(j.error_occurrences, 4);
    // 見える文字が全部きれいなら 0 件・exit 0
    fs.writeFileSync(path.join(dir, 'index.html'), page('<p>きれい</p><script>var kicker = "メモ：";</script>'));
    fs.writeFileSync(path.join(dir, 'features/a.html'), page('<p>きれい</p>'));
    const ok = run('audit_selection_wording.js', ['--root', dir, '--check']);
    assert.equal(ok.code, 0);
    assert.match(ok.out, /✅ 人が選んだと読める言い方（合計）: 0 ページ・0 か所/);
  } finally { cleanup(dir); }
});

test('① CLI: policy が壊れていれば黙って緑にならず exit 1、--only の名前を間違えたら exit 2', () => {
  const dir = makeRoot({ 'data/selection_wording_policy.json': JSON.stringify({ terms: [{ id: 'a', severity: 'error', pattern: 'あ' }], exempt: [{ path: 'x', term: 'a' }] }), 'index.html': page('x') });
  try {
    const r = run('audit_selection_wording.js', ['--root', dir, '--check']);
    assert.equal(r.code, 1);
    assert.match(r.err, /実行できません/);
    assert.equal(run('audit_selection_wording.js', ['--root', dir, '--only', 'nope']).code, 2);
  } finally { cleanup(dir); }
});

test('① --phrases: 1 つの語の言い回しを多い順に出す（例外の phrase を書くときに使う）', () => {
  const dir = makeRoot({
    'data/selection_wording_policy.json': JSON.stringify(policy),
    'features/a.html': page('<p>【メモ】業界人レビュー</p>'), 'features/b.html': page('<p>【メモ】業界人レビュー</p>'), 'features/c.html': page('<p>業界人が通う</p>'),
  });
  try {
    const r = run('audit_selection_wording.js', ['--root', dir, '--phrases', 'gyokai-jin']);
    assert.equal(r.code, 0);
    assert.match(r.out, /gyokai-jin: 言い回し 2 種/);
    assert.match(r.out, /2 ページ\s+2 か所\s+.*【メモ】【業界人】レビュー/, '同じ言い回しは 1 種にまとめ、多い順に並べる');
    assert.equal(run('audit_selection_wording.js', ['--root', dir, '--phrases', 'nope']).code, 2);
  } finally { cleanup(dir); }
});

// ══ ② style 属性の文字の大きさ ═════════════════════════════════════════════════
const DS_COPY = ['data/design_system.json'];
function inlineReport(files) {
  const dir = makeRoot(files, { copy: DS_COPY });
  try {
    const check = run('audit_design_system.js', ['--inline-style', '--check', '--root', dir]);
    const json = JSON.parse(run('audit_design_system.js', ['--inline-style', '--json', '--root', dir]).out);
    const defaultReport = JSON.parse(run('audit_design_system.js', ['--report', '--root', dir]).out);
    return { check, json, defaultReport };
  } finally { cleanup(dir); }
}

test('② 床（12px）を割る style 属性の font-size を数える。rem / px・xx-small / x-small・単一引用符・!important も', () => {
  const r = inlineReport({
    'features/a.html': page(
      '<p style="font-size:.7rem">a</p><span style="color:red;font-size: 11px !important">c</span>' +
      '<i style=\'font-size:.5rem\'>d</i><b style="font-size:x-small">e</b><u style="font-size:xx-small">f</u>'),
  });
  assert.equal(r.json.ok, false);
  assert.equal(r.json.pages, 1);
  assert.equal(r.json.occurrences, 5);
  assert.equal(r.json.by_section.features.occurrences, 5);
  assert.equal(r.check.code, 1);
  assert.match(r.check.out, /❌ 床を割る style 属性の font-size: 1 ページ・5 か所/);
  const details = r.json.violations.map((v) => v.detail).join('\n');
  assert.match(details, /11\.2px/);
  assert.match(details, /= 11px/);
  assert.match(details, /= 8px/);
  assert.match(details, /= 9px/);
  assert.match(details, /= 10px/);
});

test('② em・% の指定は親の大きさで決まるので違反に数えず、件数だけ別の行で出す（h1 の中の .55em は 20px を超える）', () => {
  const r = inlineReport({
    'features/a.html': page(
      '<h1>題<small style="font-size:.55em;letter-spacing:.05em">副題</small></h1>' +
      '<i style=\'font-size:50%\'>d</i><p style="font-size:1.2em">大きい指定は数えない</p><p style="font-size:.7em !important">e</p>'),
    'features/b.html': page('<small style="font-size:.6em">f</small>'),
  });
  assert.equal(r.json.ok, true, JSON.stringify(r.json.violations));
  assert.equal(r.json.occurrences, 0);
  assert.deepEqual(r.json.relative_unchecked, { pages: 2, occurrences: 4 });
  assert.equal(r.check.code, 0);
  assert.match(r.check.out, /ℹ️ em・% の小さな指定（親の大きさで決まるため数えない）: 2 ページ・4 か所/);
  // 夜間QA の報告は最後の 30 行を載せる。判定の行がいちばん最後に来る
  const lines = r.check.out.trim().split('\n');
  assert.match(lines[lines.length - 1], /✅ 床を割る style 属性の font-size: 0 ページ・0 か所/);
});

test('② em・% と rem が同じページにあっても、rem の違反だけを数える', () => {
  const r = inlineReport({
    'features/a.html': page('<small style="font-size:.55em">a</small><p style="font-size:.7rem">b</p>'),
  });
  assert.equal(r.json.occurrences, 1);
  assert.deepEqual(r.json.relative_unchecked, { pages: 1, occurrences: 1 });
  assert.match(r.json.violations[0].detail, /font-size:\.7rem = 11\.2px/);
});

test('② 数えないもの: 12px 以上・トークン参照・<style> の中・コメントの中・許可した class・font-size ではない指定', () => {
  const r = inlineReport({
    'features/a.html': page(
      '<p style="font-size:12px">ok</p><p style="font-size:.75rem">ok 12px</p><p style="font-size:var(--fs-sm)">ok</p>' +
      '<p style="font-size:clamp(1rem,2vw,2rem)">ok</p><p style="font-size:inherit">ok</p><p style="font-size:small">ok</p>' +
      '<!-- <p style="font-size:8px">コメント</p> --><p class="photo-credit" style="font-size:10px">許可</p>' +
      '<p style="line-height:1;margin-top:.7rem">font-size ではない</p>',
      '<style>.x{font-size:8px} .y[style="font-size:9px"]{}</style>'),
  });
  assert.equal(r.json.ok, true, JSON.stringify(r.json.violations));
  assert.equal(r.json.occurrences, 0);
  assert.equal(r.check.code, 0);
});

test('② セクションごとに数える。ほかの検査（--report）の規則名は増やさない', () => {
  const r = inlineReport({
    'index.html': page('<p style="font-size:.7rem">a</p>'),
    'features/a.html': page('<p style="font-size:.7rem">a</p><p style="font-size:9px">b</p>'),
    'journal/j.html': page('<p style="font-size:10px">a</p>'),
    'stores/S1.html': page('<p style="font-size:11px">a</p>'),
    'stores/area/a/b.html': page('<p style="font-size:11px">a</p>'),
  });
  assert.equal(r.json.pages, 5);
  assert.equal(r.json.occurrences, 6);
  assert.deepEqual(Object.fromEntries(Object.entries(r.json.by_section).map(([k, v]) => [k, v.occurrences])), { root: 1, features: 2, journal: 1, stores: 1, hubs: 1 });
  // ブロッキングの既存ゲート（build.yml の --check）には、新しい規則を混ぜない
  assert.ok(!JSON.stringify(r.defaultReport).includes('inline-font-size-below-floor'));
});

test('② 上限の表示: 50 件を超える違反は先頭だけ出し、残りの数を truncated に持つ', () => {
  const body = Array.from({ length: 60 }, (_, i) => `<p style="font-size:${8 + (i % 3)}px">x${i}</p>`).join('');
  const r = inlineReport({ 'features/a.html': page(body) });
  assert.equal(r.json.occurrences, 60);
  assert.equal(r.json.violations.length, 50);
  assert.equal(r.json.violations_truncated, 10);
});

// ══ ③ 画像の配信元 ═════════════════════════════════════════════════════════════
const imgPolicy = images.loadPolicy(ROOT);

test('③ 方針の JSON: wsrv.nl と旧ドメインをやめる対象にし、許す配信元と重ならない', () => {
  const blocked = imgPolicy.blockedHosts.map((b) => b.host);
  assert.ok(blocked.includes('wsrv.nl'));
  assert.ok(blocked.includes('images.weserv.nl'));
  const allowed = imgPolicy.allowedHosts.map((a) => a.host);
  for (const h of blocked) assert.ok(!allowed.includes(h), `${h} は許す配信元に入れない`);
  for (const h of [...blocked, ...allowed]) assert.match(h, /^[a-z0-9.-]+$/, `${h}: ホスト名だけ（https:// や / を付けない）`);
  for (const b of imgPolicy.blockedHosts) { assert.ok(b.why); assert.ok(b.ownerDecision); }
  assert.ok(allowed.includes('imgfp.hotp.jp') && allowed.includes('lh3.googleusercontent.com'), '写真ソース優先順の配信元');
});

test('③ countBlocked: ホスト名が出てくる箇所を数える。別のドメインの一部は数えない', () => {
  const b = imgPolicy.blockedHosts;
  assert.deepEqual(images.countBlocked('<img src="https://wsrv.nl/?url=a&w=400"><img srcset="https://wsrv.nl/?url=b 1x">', b), { 'wsrv.nl': 2 });
  assert.deepEqual(images.countBlocked("fetch('//images.weserv.nl/?url=x')", b), { 'images.weserv.nl': 1 });
  assert.deepEqual(images.countBlocked('<p>wsrv.nl を使わない</p>', b), { 'wsrv.nl': 1 }, '文章の中でも文字列が出れば数える（残骸の検出）');
  assert.deepEqual(images.countBlocked('https://notwsrv.nl/x https://wsrv.nl.example.com/y https://my-wsrv.nl/z', b), {}, '別のドメインの一部は数えない');
  assert.deepEqual(images.countBlocked('https://cdn.wsrv.nl/x', b), { 'wsrv.nl': 1 }, '子ドメインは同じサービスなので数える');
  assert.deepEqual(images.countBlocked('<img src="https://imgfp.hotp.jp/a.jpg">', b), {});
});

test('③ imageHosts: src・srcset・og:image・url() の配信元を集める', () => {
  const html = '<img src="https://imgfp.hotp.jp/a.jpg"><img data-src="//lh3.googleusercontent.com/b" srcset="https://x.example/a.jpg 1x, https://y.example/b.jpg 2x">' +
    '<meta property="og:image" content="https://nagoya-bites.com/o.png"><meta name="twitter:image" content="https://z.example/t.png">' +
    '<div style="background:url(\'https://bg.example/c.jpg\')"></div><img src="relative.jpg"><a href="https://link.example/">x</a>';
  assert.deepEqual([...new Set(images.imageHosts(html))].sort(), ['bg.example', 'imgfp.hotp.jp', 'lh3.googleusercontent.com', 'nagoya-bites.com', 'x.example', 'y.example', 'z.example']);
});

test('③ audit と CLI: 変換サービス経由の画像を数え、--check で exit 1。一覧に無い配信元は情報だけ', () => {
  const dir = makeRoot({
    'data/image_source_policy.json': JSON.stringify(imgPolicy),
    'index.html': page('<img src="https://wsrv.nl/?url=a"><img src="https://wsrv.nl/?url=b">'),
    'stores/S1.html': page('<img src="https://wsrv.nl/?url=c"><img src="https://unknown.example/z.jpg">'),
    'stores/S2.html': page('<img src="https://imgfp.hotp.jp/ok.jpg">'),
  });
  try {
    const r = images.audit({ root: dir });
    assert.equal(r.ok, false);
    assert.equal(r.files_scanned, 3);
    assert.equal(r.pages_with_blocked_hosts, 2);
    assert.equal(r.occurrences, 3);
    assert.deepEqual(r.by_host, { 'wsrv.nl': { pages: 2, occurrences: 3 } });
    assert.equal(r.by_section.root.occurrences, 2);
    assert.equal(r.by_section.stores.pages, 1);
    assert.deepEqual(r.unlisted_hosts, [{ host: 'unknown.example', pages: 1 }], '一覧に無い配信元は違反にせず情報だけ');
    assert.equal(run('audit_image_sources.js', ['--root', dir]).code, 0);
    const chk = run('audit_image_sources.js', ['--root', dir, '--check']);
    assert.equal(chk.code, 1);
    assert.match(chk.out, /❌ 外部の変換サービス経由の画像: 2 ページ・3 か所/);
    fs.writeFileSync(path.join(dir, 'index.html'), page('<img src="https://imgfp.hotp.jp/a.jpg">'));
    fs.writeFileSync(path.join(dir, 'stores/S1.html'), page('<img src="https://lh3.googleusercontent.com/b">'));
    const ok = run('audit_image_sources.js', ['--root', dir, '--check']);
    assert.equal(ok.code, 0);
    assert.match(ok.out, /✅ 外部の変換サービス経由の画像: 0 ページ・0 か所/);
  } finally { cleanup(dir); }
});

// ══ ④ ページ種別ごとの重さ ═════════════════════════════════════════════════════
const wPolicy = weight.loadPolicy(ROOT);

test('④ 方針の JSON: すべての種別に上限があり、上限は測った最大に余裕を足した位置', () => {
  const kinds = ['top', 'static', 'feature', 'feature-index', 'journal', 'journal-index', 'store', 'stores-index', 'hub'];
  for (const k of kinds) {
    const rule = wPolicy.types[k];
    assert.ok(rule, `${k}: 上限がある`);
    assert.ok(Number.isInteger(rule.maxBytes) && rule.maxBytes > 0);
    assert.ok(rule.measured && rule.measured.max > 0 && rule.measured.maxPage, `${k}: 測った実測を残している`);
    // 上限が実測の最大を割ると、正直なページが落ちる（品質ゲート原則3）。余裕は 10% 以上を条件にする
    assert.ok(rule.maxBytes >= rule.measured.max * 1.1, `${k}: 上限 ${rule.maxBytes} は実測の最大 ${rule.measured.max} に余裕が要る`);
    assert.ok(rule.note);
  }
  // 方針に無い種別を足したら、ここも足す（上限の無い種別は audit が落ちる）
  assert.deepEqual(Object.keys(wPolicy.types).sort(), [...kinds].sort());
});

test('④ audit と CLI: 種別ごとの上限を超えたページだけを挙げる。上限の無い種別は黙って通さない', () => {
  const small = { types: { top: { maxBytes: 200 }, feature: { maxBytes: 120 }, store: { maxBytes: 100 }, journal: { maxBytes: 100 }, 'journal-index': { maxBytes: 100 }, hub: { maxBytes: 100 }, static: { maxBytes: 100 }, 'feature-index': { maxBytes: 100 }, 'stores-index': { maxBytes: 100 } } };
  const pad = (n) => 'x'.repeat(n);
  const dir = makeRoot({
    'data/page_weight_policy.json': JSON.stringify(small),
    'index.html': pad(150), 'features/a.html': pad(121), 'features/b.html': pad(120), 'stores/S1.html': pad(300), 'stores/S2.html': pad(100),
  });
  try {
    const r = weight.audit({ root: dir });
    assert.equal(r.ok, false);
    assert.equal(r.violations_total, 2, '上限ちょうどは通す。1 バイトでも超えたら挙げる');
    assert.deepEqual(r.violations.map((v) => v.file), ['stores/S1.html', 'features/a.html'], '超過の大きい順');
    assert.equal(r.types.find((t) => t.type === 'feature').over, 1);
    assert.equal(r.types.find((t) => t.type === 'top').over, 0);
    const chk = run('audit_page_weight.js', ['--root', dir, '--check']);
    assert.equal(chk.code, 1);
    assert.match(chk.out, /❌ 上限を超えるページ: 2 本/);
    assert.equal(run('audit_page_weight.js', ['--root', dir]).code, 0);
    // 上限の無い種別（hub を方針から外す）は、見つけたまま緑にしない
    const noHub = { types: { ...small.types } };
    delete noHub.types.hub;
    fs.writeFileSync(path.join(dir, 'data/page_weight_policy.json'), JSON.stringify(noHub));
    fs.mkdirSync(path.join(dir, 'stores/area/a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'stores/area/a/h.html'), pad(10));
    fs.unlinkSync(path.join(dir, 'features/a.html'));
    fs.unlinkSync(path.join(dir, 'stores/S1.html'));
    const unknown = weight.audit({ root: dir });
    assert.equal(unknown.ok, false);
    assert.deepEqual(unknown.unknown_types, ['hub']);
    assert.match(run('audit_page_weight.js', ['--root', dir]).out, /上限の無い種別: hub/);
  } finally { cleanup(dir); }
});

test('④ --measure: 種別ごとの分布（件数・p50・p90・p99・最大）を出す', () => {
  const dir = makeRoot({ 'features/a.html': 'x'.repeat(10), 'features/b.html': 'x'.repeat(30), 'features/c.html': 'x'.repeat(20) });
  try {
    const m = JSON.parse(run('audit_page_weight.js', ['--root', dir, '--measure']).out);
    assert.equal(m.feature.n, 3);
    assert.equal(m.feature.max, 30);
    assert.equal(m.feature.maxPage, 'features/b.html');
    assert.equal(m.feature.p50, 20);
  } finally { cleanup(dir); }
});

// ══ 夜間QA に載っている（soft） ═════════════════════════════════════════════════
test('夜間QA: 4 本とも soft（赤の間は Issue を起票しない）で、報告に必ず載り、正しい検査を呼ぶ', () => {
  const qa = read('scripts/nightly_qa.js');
  const expect = {
    'selection-wording': "['scripts/audit_selection_wording.js', '--check']",
    'inline-style-font-size': "['scripts/audit_design_system.js', '--inline-style', '--check']",
    'image-sources': "['scripts/audit_image_sources.js', '--check']",
    'page-weight': "['scripts/audit_page_weight.js', '--check']",
  };
  for (const [id, cmd] of Object.entries(expect)) {
    const i = qa.indexOf(`id: '${id}'`);
    assert.ok(i > 0, `${id}: 夜間QA に載っている`);
    const block = qa.slice(i, qa.indexOf('});', i));
    assert.ok(block.includes('hard: false'), `${id}: soft`);
    assert.ok(block.includes('alwaysShow: true'), `${id}: 報告に常に載る`);
    assert.ok(block.includes(cmd), `${id}: ${cmd} を呼ぶ`);
  }
});
