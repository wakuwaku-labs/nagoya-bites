'use strict';
/**
 * 店の選び方の言い方を、元（生成器・テンプレート）に置かない（P-326〜・設計書 5.5 節・8.4 節の順 1）
 *
 * オーナーの指示（2026-10-11）:
 *   「店舗の選定にはAIによる情報収集・分析を活用しています。人間の飲食業界関係者がすべての店舗を
 *    選定しているような表現は使用しないでください。」
 *
 * 公開ページ全体の検査（scripts/audit_selection_wording.js）は、既存の約6,000ページが残っているあいだ
 * 夜間QA の soft（赤くなっても止めない）。この検査はそれとは別に、「直し終えた元」が元の言い方に戻らないよう、
 * 元のファイルそのものを、data/selection_wording_policy.json の語（severity=error）で調べる。
 * 直したファイルは CLEAN_SOURCES に足していく（足すのは、そのファイルに語が 1 件も無いときだけ）。
 * 語が要るファイル（検索で狙う語の台帳など）は、足さずに、その理由を書く。
 * 共通のクローム（フッターなど）の写しは各ページにあり、正本は scripts/lib/site_chrome.js。写しは apply_site_chrome.js が合わせる。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'selection_wording_policy.json'), 'utf8'));
const errorTerms = policy.terms.filter((t) => t.severity === 'error').map((t) => ({ id: t.id, re: new RegExp(t.pattern, 'g') }));

// 直し終えた元。日次ジャーナルが新しく作るページの元（P-326）
const CLEAN_SOURCES = [
  // 日次ジャーナルが新しく作るページの元（P-326）
  'journal/_template.html',
  'scripts/add_journal_site_intro.js',
  'scripts/build_journal_index.js',
  'scripts/generate_daily_draft.js',
  // 全ページに共通で出る部品の元（P-327）: フッター・特集の署名・店舗ページ・ハブ・OG 画像・特集の一覧への導線
  'scripts/lib/site_chrome.js',
  'scripts/lib/feature_byline.js',
  'scripts/lib/editor_reason.js',
  'gen-store-pages.js',
  'scripts/gen_area_genre_pages.js',
  'scripts/gen_store_og_svg.js',
  'scripts/patch_store_og_images.js',
  'scripts/inject_store_links.js',
  // 機械が読む説明（アプリの説明）の元（P-328）
  'manifest.json',
  // 日次ジャーナルの採点器（P-333）: 語を入れると点が上がる加点をやめた。語を報酬にする定数を戻さない
  'scripts/score_journal_candidates.js',
  // 運営について・FAQ・編集規約・店舗一覧の本文（P-329）: 選び方の説明は編集規約 1 か所に、実際の手順だけを書く
  'about.html',
  'faq.html',
  'features/editorial-policy.html',
  'stores/index.html',
  // 特集の冒頭の導線・特集を作る生成器・店のカードの説明文の元データ（P-363）。
  //   scripts/gen_industry_features.js と data/featured.json は、特集の題の系統（title・h1 の副題・リンク名）に語が残るので、
  //   題を直す P-334 まで足さない（本文・見出し・FAQ・説明文は P-363 で直した）。
  'scripts/add_feature_top_cta.js',
  'scripts/apply_faq_per_topic.js',
  'scripts/recreate_fabricated_features.js',
  'scripts/fix_ramen_schema_pollution.js',
  'scripts/list_editorreason_candidates.js',
  'docs/editorreason-todo.md',
  'data/editor_picks.json',
  'data/manual_stores.json',
  'data/recommendations.json',
];

function hits(text) {
  const out = [];
  for (const t of errorTerms) {
    t.re.lastIndex = 0;
    let m;
    while ((m = t.re.exec(text)) !== null) out.push(`${t.id}: ${text.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10).replace(/\s+/g, ' ')}`);
  }
  return out;
}

test('policy の語（severity=error）が読めて、検査が空でない', () => {
  assert.ok(errorTerms.length >= 5, String(errorTerms.length));
  assert.ok(hits('飲食のプロが選んだ').length >= 1, 'プロが選んだ');
  assert.ok(hits('業界人の目利き').length >= 1, '業界人');
  assert.equal(hits('名古屋の新店と話題を、毎日まとめています').length, 0);
  // P-329 で足した語: 言い換え（飲食業界のプロ・プロが認めた）も数える。プロデュースは数えない
  assert.ok(hits('飲食業界のプロが自らの基準で選定').length >= 1, '飲食業界のプロ');
  assert.ok(hits('プロが認めた店だけを掲載').length >= 1, 'プロが認めた');
  assert.equal(hits('飲食プロデュース会社').length, 0);
});

for (const rel of CLEAN_SOURCES) {
  test(`元に人が選んだと読める言い方が無い: ${rel}`, () => {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.deepEqual(hits(text), [], `${rel} に、人が選んだ・書いたと読める言い方が戻っている（設計書 5.5 節の言い換えを使う）`);
  });
}

test('日次ジャーナルの下書きの見出しと仮の文は、新しい言い方（P-326）', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'journal', '_template.html'), 'utf8');
  assert.ok(tpl.includes('<p class="insider-title">知っておきたいポイント</p>'));
  const gen = fs.readFileSync(path.join(ROOT, 'scripts', 'generate_daily_draft.js'), 'utf8');
  assert.ok(gen.includes('<li>(読み解きのポイントを記述)</li>'));
  const idx = fs.readFileSync(path.join(ROOT, 'scripts', 'build_journal_index.js'), 'utf8');
  assert.equal((idx.match(/名古屋の新店と話題を、毎日まとめています/g) || []).length, 2, 'RSS の description と Atom の subtitle');
});

test('共通のフッター・特集の署名・OG の代替文・ハブの見出しは、新しい言い方（P-327）', () => {
  const chrome = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'), 'utf8');
  assert.ok(chrome.includes('広告ゼロ・PR記事ゼロの名古屋・愛知専門グルメガイド。店舗の選定にはAIによる情報収集・分析を活用しています。'));
  const store = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.equal((store.match(/NAGOYA BITES（名古屋グルメガイド）">/g) || []).length, 2, 'og:image:alt と twitter:image:alt');
  assert.ok(store.includes('<h2>選定理由</h2>'));
  const hub = fs.readFileSync(path.join(ROOT, 'scripts', 'gen_area_genre_pages.js'), 'utf8');
  assert.ok(hub.includes('<span>選定理由がある店</span>'));
  const svg = fs.readFileSync(path.join(ROOT, 'scripts', 'gen_store_og_svg.js'), 'utf8');
  assert.ok(svg.includes('名古屋グルメガイド ・ 広告ゼロ ・ nagoya-bites.com'));
});

// ---------------------------------------------------------------- 構造化データ・llms.txt（P-328・設計書 4.3 節 I-04）

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]));
  return out;
}

test('トップの構造化データ: 人が選んだと読める言い方が無く、FAQPage と運営者の個人情報（founder・Person）を出さない（P-328）', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const blocks = jsonLdBlocks(html);
  const types = blocks.map((b) => b['@type']).sort();
  // ItemList は 1 本だけ（I-25・判断の記録 0039）。以前は静的な about と、読み込み後に JS が足す 2 本が重なって最大 3 本出ていた
  assert.deepEqual(types, ['ItemList', 'Organization', 'WebPage', 'WebSite'], '構造化データの型');
  // 言い方の検査は、こちらが書く部分に対して行う。ItemList は掲載店の名前の並び（店名はそのまま出す）なので外す
  const own = blocks.filter((b) => b['@type'] !== 'ItemList');
  const text = JSON.stringify(own);
  assert.deepEqual(hits(text), [], 'トップの JSON-LD に、人が選んだ・書いたと読める言い方が戻っている');
  assert.ok(!/FAQPage|"Question"/.test(text), 'トップに画面の FAQ は無い。画面に無い質問と答えを構造化データだけに書かない（判断の記録 0029）');
  assert.ok(!/"founder"|"jobTitle"|"Person"/.test(text), '運営者の氏名・肩書・経歴は構造化データに載せない（判断の記録 0029）');
  const org = blocks.find((b) => b['@type'] === 'Organization');
  assert.match(org.description, /店舗の選定にはAIによる情報収集・分析を活用しています。/);
  const site = blocks.find((b) => b['@type'] === 'WebSite');
  assert.match(site.description, /店舗の選定にはAIによる情報収集・分析を活用しています。/);
});

test('llms.txt: 手で書く部分（自動生成の区間の外）に、人が選んだと読める言い方が無い（P-328）', () => {
  const txt = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  // 自動生成の区間は、店数の欄の写し以外を外す（特集の一覧は各特集の説明文から作るので、特集を直す課題 P-331 で変わる）
  const stat = txt.replace(/<!-- AUTO-GENERATED:(\w+):start -->[\s\S]*?<!-- AUTO-GENERATED:\1:end -->/g, '');
  assert.deepEqual(hits(stat), [], 'llms.txt の手で書く部分に、人が選んだ・書いたと読める言い方が戻っている');
  assert.ok(stat.includes('店舗の選定にはAIによる情報収集・分析を活用している。'));
  assert.ok(!/`insiderNote`|`visitStatus`/.test(txt), '画面に出していない項目（insiderNote）の説明を、店舗ページの項目として書かない');
});


test('日次ジャーナルの生成ラッパーは、書き手への指示に「言葉の決まり」を入れている（P-335）', () => {
  // journal-today.md の言い方は P-335（オーナーの操作・2026-10-14）で直した。ラッパーは表現の決まりそのものを渡し、読み替えは持たない。
  const sh = fs.readFileSync(path.join(ROOT, 'scripts', 'run_journal_local.sh'), 'utf8');
  const m = sh.match(/^SELF_HEADER=".*?"\n(?=PROMPT=)/ms);
  assert.ok(m, 'SELF_HEADER の代入が見つからない');
  // 実際に渡る文面を bash で評価する（$ やバッククォートが紛れると、文が欠けても構文は通ってしまう）
  const out = execFileSync('bash', ['-c', `TODAY_JST=2026-10-14\n${m[0]}printf '%s' "$SELF_HEADER"`], { encoding: 'utf8' });
  assert.ok(out.includes('【言葉の決まり'), out);
  assert.ok(out.includes('店舗の選定にはAIによる情報収集・分析を活用しています。'), out);
  assert.ok(!out.includes('読み替える'), '直した後は、journal-today.md の読み替えを渡さない');
  assert.ok(out.includes('質問や確認待ちで止まらないこと'), '従来の無人実行の指示が残っている');
});

test('journal-today.md（Claude 用・Codex 用の写し）は、業界人視点・個人署名の言い方を持たない（P-335）', () => {
  for (const rel of ['.claude/commands/journal-today.md', '.agents/skills/source-command-journal-today/SKILL.md']) {
    const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!t.includes('業界人視点'), rel + ': 業界人視点');
    assert.ok(!t.includes('「業界人」「編集部」で統一'), rel + ': 業界人で統一');
    assert.ok(t.includes('署名は「編集部」で統一'), rel + ': 署名は編集部');
  }
});

// ---------------------------------------------------------------- 運営について・FAQ・編集規約・店舗一覧（P-329・設計書 5.5 節・判断の記録 0031）

function readRel(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function stripTags(s) { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
const OWNER_SENTENCE = '店舗の選定にはAIによる情報収集・分析を活用しています。';

test('運営について: 経歴・実績・監修者を書かず、選び方と運営の説明が実際の手順になっている（P-329）', () => {
  const html = readRel('about.html');
  assert.ok(html.includes(OWNER_SENTENCE), 'オーナーの文');
  assert.ok(!/食べログスコア|改善実績|監修|3\.2<span/.test(html), '存在を確かめられない経歴・実績・監修者の言い方が戻っている');
  assert.ok(!/class="achievement"|class="ach-/.test(html), '実績の帯（Track Record）を戻さない');
  assert.ok(html.includes('<div class="sec-label">02 — How We Choose</div>'), '02 は店の選び方');
  assert.ok(html.includes('href="features/editorial-policy.html#anonymous"'), '運営者を公開しない理由は編集規約へ');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  assert.match(title, /広告ゼロ・PR記事ゼロ/, 'title は実態（広告ゼロ・PR記事ゼロ）で書く');
  assert.ok(!/<h1>[^]*?(?:マネージャー|店長|飲食人|監修)/.test(html), 'h1');
});

test('FAQ: 選び方・サイトの説明・掲載料の答えは、構造化データと画面が同じ文で、実際の手順だけを書く（P-329）', () => {
  const html = readRel('faq.html');
  const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faq = ld.find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq, 'FAQPage');
  const visible = [...html.matchAll(/<button class="faq-q"[^>]*>([\s\S]*?)<\/button>\s*<div class="faq-a">([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => ({ q: stripTags(m[1]), a: stripTags(m[2]) }));
  for (const name of ['NAGOYA BITESはどんなサイトですか？', '掲載店舗の選定基準は？', '掲載料はかかりますか？']) {
    const q = faq.mainEntity.find((e) => e.name === name);
    assert.ok(q, `構造化データに「${name}」がある`);
    const v = visible.find((x) => x.q === name);
    assert.ok(v, `画面に「${name}」がある（画面に無い質問と答えを構造化データだけに書かない）`);
    assert.ok(v.a.startsWith(stripTags(q.acceptedAnswer.text)), `「${name}」の答えが、構造化データと画面で食い違う`);
    assert.deepEqual(hits(q.acceptedAnswer.text), []);
  }
  // FAQPage の答えは画面と同じ文（タグを除いた文字列が完全一致）。全問を見る（P-336・判断の記録 0029）
  assert.equal(faq.mainEntity.length, 9, 'FAQPage の問数');
  for (const q of faq.mainEntity) {
    const v = visible.find((x) => x.q === q.name);
    assert.ok(v, `画面に「${q.name}」がある`);
    assert.equal(stripTags(q.acceptedAnswer.text), v.a, `「${q.name}」の答えが、構造化データと画面で食い違う`);
  }
  const how = visible.find((x) => x.q === '掲載店舗の選定基準は？').a;
  assert.ok(how.startsWith(OWNER_SENTENCE), '選定基準の答えはオーナーの文から始める');
  assert.ok(!/業界で培|独自のネットワーク|実務経験|プロ/.test(how), '経歴・人脈・プロを選ぶ根拠にしない');
});

test('編集規約: 選び方は実際の手順で書き、運営者は個人・氏名経歴所属は公開しない（05）。例えと存在しない役割を戻さない（P-329）', () => {
  const html = readRel('features/editorial-policy.html');
  assert.ok(html.includes(OWNER_SENTENCE), 'オーナーの文');
  const sec = (id, next) => { const i = html.indexOf(`id="${id}"`); const j = html.indexOf(`id="${next}"`); assert.ok(i > 0 && j > i, id); return stripTags(html.slice(i, j)); };
  const selection = sec('selection', 'independence');
  assert.ok(selection.includes('ホットペッパーグルメ') && selection.includes('Google') && selection.includes('実在を確かめる'), '02 に実際の手順（情報源・実在の確認）がある');
  const anon = sec('anonymous', 'inside-perspective');
  assert.ok(anon.includes('個人で運営しています') && anon.includes('氏名・経歴・所属は公開していません'), '05');
  assert.ok(!/ミシュラン|監修|現役|編集会議|公開判断/.test(html), '比喩・存在しない役割・人が毎回判断するという言い方を戻さない');
  assert.ok(html.includes('id="anonymous"') && html.includes('id="inside-perspective"'), '他のページからのリンク先（#anonymous・#inside-perspective）を消さない');
  assert.ok(!/業界人レビュ/.test(html), '「業界人レビュワー」は「飲食業界の経験者によるレビュワー」に改めた（判断の記録 0031）');
});

test('店舗一覧: 店を指さない一覧ページに、レビュー投稿の箱（店の ID が index）を置かない（P-329）', () => {
  const html = readRel('stores/index.html');
  assert.ok(!/INSIDER REVIEWS|review=1|store=index/.test(html), '雛形の残骸（リンク先が #store=index）を戻さない');
  assert.ok(html.includes(OWNER_SENTENCE), 'オーナーの文');
});

test('運営者の識別情報（確認者の名前・ハンドル）を、この 4 ページに書かない（P-329）', () => {
  const picks = JSON.parse(readRel('data/editor_picks.json')).stores;
  const handles = [...new Set(picks.map((p) => p && p.automation && p.automation.reviewed_by).filter(Boolean))];
  assert.ok(handles.length >= 1, '確認者の記録が読める（このテストが空振りしない）');
  for (const rel of ['about.html', 'faq.html', 'features/editorial-policy.html', 'stores/index.html']) {
    const html = readRel(rel);
    for (const h of handles) assert.ok(!html.includes(h), `${rel} に運営者の識別情報が出ている`);
  }
});

// ── トップ（P-330・判断の記録 0032）──
const audit = require('../scripts/audit_selection_wording');

// CI は npm test の直前に node build.js を回し、index.html の次の区画を元（店のデータ・特集・ジャーナル）から書き直す。
// 手で直しても次のビルドで戻る（2026-10-13: 「目的から探す」を手で直してマージし、CI で戻ってこの検査が落ちた）。
// だから index.html を読む検査は、手元のファイルではなく「ビルド後」の姿で通ることを確かめる
// （手元の再現: scripts/inject_store_links.js と scripts/build_journal_index.js を回してから npm test）。
//   除く（元は店のデータ・特集・ジャーナル。P-331・P-332 で直す）:
//     ・var LOCAL_STORES の行 … 店の紹介文と特集の題
//     ・FEATURED … 特集の題
//     ・LATEST_JOURNAL … ジャーナルの題と説明
//     ・STORE-ITEMLIST … 構造化データの掲載店の名前の並び（店名はそのまま出す）
//   除かない（元を直したので、ビルド後も語が出ないことを見る）:
//     ・SCENE-INDEX（目的から探す）… scripts/inject_store_links.js が data/journal_seo_keywords.json から作る
//     ・STORE-INDEX（エリア別 店舗一覧）… 以前は掲載全店の名前の一覧だったが、エリア・ジャンルの名前だけの入口になった（I-25・0039）
function indexWithoutGeneratedRegions() {
  let s = readRel('index.html').split('\n').filter((l) => !l.startsWith('var LOCAL_STORES')).join('\n');
  const cut = (from, to) => {
    const i = s.indexOf(from);
    const j = s.indexOf(to);
    assert.ok(i > 0 && j > i, `${from} 〜 ${to} が見つからない（区画の印を消さない）`);
    s = s.slice(0, i) + ' ' + s.slice(j + to.length);
  };
  cut('<!-- FEATURED_START -->', '<!-- FEATURED_END -->');
  cut('<!-- LATEST_JOURNAL_START -->', '<!-- LATEST_JOURNAL_END -->');
  cut('<!-- STORE-ITEMLIST:START -->', '<!-- STORE-ITEMLIST:END -->');
  return s;
}

test('トップ: 店のデータ・特集・ジャーナル・構造化データの店名の区画を除いた部分（手書きと「目的から探す」「エリア別 店舗一覧」）に、人が選んだと読める言い方が無い。例外は検索の辞書の 1 件だけ（P-330）', () => {
  const html = indexWithoutGeneratedRegions();
  const compiled = audit.compilePolicy(audit.loadPolicy(ROOT));
  const r = audit.scanHtml(html, compiled, { rel: 'index.html', keepScripts: true });
  const errorIds = new Set(policy.terms.filter((t) => t.severity === 'error').map((t) => t.id));
  assert.deepEqual(r.phrases.filter((p) => errorIds.has(p.term)), [], 'トップの手書きの部分に、人が選んだと読める言い方が戻っている');
  assert.equal(r.exempted, 1, '例外は検索の言い換え辞書（nbC の words）の 1 件だけ');
  const ex = policy.exempt.filter((e) => e.path === 'index.html');
  assert.equal(ex.length, 1);
  assert.ok(/検索/.test(ex[0].reason) && /画面には出ない/.test(ex[0].reason), '例外の理由は「画面に出ない検索の辞書」');
});

test('トップ: 「目的から探す」のリンク文は、生成器が語彙表から作る。業界人の導線は label の文で、語が出ない（P-330）', () => {
  const gen = require('../scripts/inject_store_links');
  const block = gen.renderSceneIndexBlock();
  assert.ok(block, '語彙表（data/journal_seo_keywords.json）が読める');
  const compiled = audit.compilePolicy(audit.loadPolicy(ROOT));
  const r = audit.scanHtml(block, compiled, { rel: 'index.html' });
  const errorIds = new Set(policy.terms.filter((t) => t.severity === 'error').map((t) => t.id));
  assert.deepEqual(r.phrases.filter((p) => errorIds.has(p.term)), [], '生成器が作るリンク文に、人が選んだと読める言い方が出ている');
  assert.ok(block.includes('<a href="features/industry-insiders-pick.html">飲食業界の人が通う店</a>'), '業界人の導線は label の文');
  assert.ok(!block.includes('名古屋の業界人'));
  // kw（検索語の対応づけ・採点・GSC の分類が使う）は変えず、画面に出す文だけを label で替える
  const master = JSON.parse(readRel('data/journal_seo_keywords.json'));
  const ins = master.scenes.find((x) => x.kw === '業界人');
  assert.ok(ins, '語彙表に kw=業界人 が残っている');
  assert.equal(ins.label, '飲食業界の人が通う店');
  assert.equal(gen.sceneLinkText({ kw: '接待' }), '名古屋の接待', 'label が無い語は従来どおり');
  assert.equal(gen.sceneLinkText({ kw: '業界人', label: '別の文' }), '別の文');
});

test('トップ: 題・OGP・Twitter・説明は、広告ゼロとシーンとエリアで探せることで書く（P-330）', () => {
  const html = readRel('index.html');
  const TITLE = /^名古屋グルメ約[\d,]+軒｜広告ゼロ、シーンとエリアで探せるガイド｜NAGOYA BITES$/;
  assert.match((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '', TITLE);
  for (const key of ['og:title', 'twitter:title']) {
    const m = html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`));
    assert.ok(m, key);
    assert.match(m[1].replace(/【NAGOYA BITES】$/, '｜NAGOYA BITES'), TITLE, key);
  }
  for (const key of ['description', 'og:description', 'twitter:description']) {
    const m = html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`));
    assert.ok(m, key);
    assert.ok(!/現役|選び直し|厳選|マネージャー|店長|業界人/.test(m[1]), `${key} に人が選んだと読める言い方が戻っている`);
    assert.ok(/約[\d,]+軒/.test(m[1]), `${key} に、件数の自動そろえ（sync_store_count.js）が見る「約N軒」がある`);
  }
  assert.ok(html.includes('店舗の選定にはAIによる情報収集・分析を活用しています。'), 'オーナーの文（構造化データの説明）');
});

test('トップ: 実績の帯から「現役の店長が編集」を外し、残りの 3 項目の最後をスマホの 2 列で中央に置く（P-330）', () => {
  const html = readRel('index.html');
  const bar = (html.match(/<div class="authority-bar">([\s\S]*?)<\/div>\s*\n/) || [])[1] || '';
  assert.equal((bar.match(/class="auth-item"/g) || []).length, 3, '実績の帯は 3 項目');
  assert.ok(!/店長|マネージャー|編集/.test(stripTags(bar)), stripTags(bar));
  assert.ok(stripTags(bar).includes('広告・サクラなし'), '残す項目');
  assert.ok(html.includes('.auth-item:last-child:nth-child(odd){grid-column:1/-1;justify-content:center;}'), '3 項目目が 2 列の左に寄らない');
});

test('トップ: 最初の画面の見出し（h1）は、確かめられる情報で選ぶと書く。3 行・各行 7 字以内で、人が選んだと読める言い方を（タグで割れていても）戻さない（P-389）', () => {
  const html = readRel('index.html');
  const h1 = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1];
  assert.ok(h1, 'トップに h1 がある');
  const lines = h1.split(/<br\s*\/?>/i).map((l) => stripTags(l).trim());
  assert.equal(lines.length, 3, '見出しは 3 行');
  for (const l of lines) assert.ok([...l].length <= 7, `1 行は 7 字まで（スマホの 320px で折り返さない・0034）: 「${l}」`);
  assert.ok(stripTags(h1).includes('確かめられる'), '確かめられる情報で選ぶ（運営についてと同じ意味・0034）');
  for (const s of ['プロ', '深く選んだ', '現役', '店長', '業界人', '厳選']) assert.ok(!stripTags(h1).includes(s), `見出しに戻っている: ${s}`);
  const compiled = audit.compilePolicy(audit.loadPolicy(ROOT));
  assert.deepEqual(audit.scanHtml(h1, compiled, { rel: 'index.html' }).phrases, [], '強調・改行のタグで割れた言い回しも数えて 0 件');
});

test('トップ: 店のモーダルとカードの言い方（区画名・署名・見出し・札）は新しい言い方（P-330）', () => {
  const html = indexWithoutGeneratedRegions();
  const must = [
    '<div class="m-section-title">この店のポイント</div>',
    '<div class="m-note-h">知っておきたいこと</div>',
    '<div class="m-section-title">飲食業界の経験者のレビュー</div>',
    "leadKicker = '知っておきたいこと：'",
    "leadKicker = 'ポイント：'",
    "'経験者レビュー' + r.insiderReviewCount + '件'",
    "var sigParts = [];",
    "sigParts.push('<strong>' + mEsc(visitLabel) + '</strong>')",
    "sigEl.style.display = sigParts.length ? '' : 'none'",
    "'匿名の飲食業界経験者'",
    "editorial','signal','編集部推薦・選定理由'",
  ];
  for (const s of must) assert.ok(html.includes(s), `新しい言い方が無い: ${s}`);
  const gone = ['現役飲食店マネージャーが編集', '編集部の視点', '業界人メモ', 'プロの目利き', '匿名の業界人', '名古屋の業界人', '編集部・業界人の推薦'];
  for (const s of gone) assert.ok(!html.includes(s), `古い言い方が戻っている: ${s}`);
  // 「ポイント紹介」の札は外した（紹介文が付く店の大半に付き、店の違いを伝えない・0032 の 5・0036）。紹介文の見出し「ポイント：」は残す
  assert.ok(!html.includes('flag-pro">ポイント紹介'), '「ポイント紹介」の札が戻っている');
  // クラス名と id は変えない（外から参照されている・0031 の 4）
  for (const s of ['id="m-insider-note"', 'id="m-insider-reviews"', 'class="card-flag flag-insider"', 'insider-cta']) assert.ok(readRel('index.html').includes(s), `名前を変えていない: ${s}`);
});

// ── 特集の元（P-363・特集本体は P-364、特集一覧は P-365）──
// 特集のページは、生成器・店のデータ・月替わりの設定から作られる。ページだけ直しても、次の再生成で元の言い方が戻る。
// 先に元を直し、その後でページを直す。題（title・h1 の副題・リンク名）は検索の見え方が変わるので P-334 で扱い、ここでは直さない。

test('特集の冒頭の導線: 「編集部が上位に挙げた」と言わず、並び順どおり「この特集の先頭の N 軒」と書く（P-363）', () => {
  const { buildCta } = require('../scripts/add_feature_top_cta.js');
  const stores = [
    { jcode: 'J000000001', name: 'テスト店A' },
    { jcode: 'J000000002', name: 'テスト店B' },
    { jcode: 'J000000003', name: 'テスト店C' },
  ];
  const html = buildCta(stores, 'banquet');
  assert.ok(html.includes('本文を読む前に動きたい方へ。この特集の先頭の3軒の詳細と予約はこちらから。'), html);
  assert.ok(!/編集部|上位に挙げた/.test(stripTags(html)), '誰が挙げたかを言わない');
  assert.equal(hits(html).length, 0);
});

test('特集の設定（data/featured.json）: 季節の文に人が選んだと読める言い方が無い。残る語は題の写し 1 件だけ（P-363）', () => {
  const featured = JSON.parse(readRel('data/featured.json'));
  const found = hits(JSON.stringify(featured));
  assert.equal(found.length, 1, `題の写し（業界人が通う名古屋の焼肉8選）以外に語が戻っている: ${found.join(' / ')}`);
  assert.ok(found[0].startsWith('gyokai-jin:'), found[0]);
  // build_featured.js が、この文を特集一覧と FEATURED に出す。ページ側の写し（P-364・P-365）はこの文にそろえる
  assert.equal(featured.sceneLeads['10']['nagoya-yakiniku-guide'], '食欲の秋は肉で。和牛・炭火の焼肉店を紹介します。');
  const desc = (featured.items || []).map((x) => x.seasonDesc || '').join('\n');
  assert.ok(desc.includes('2026年夏（6〜9月）の名古屋グルメを紹介。ビアガーデン'), '夏の seasonDesc は「紹介」');
  assert.ok(desc.includes('秋（9〜11月）の名古屋グルメを紹介。松茸'), '秋の seasonDesc は「紹介」');
  assert.ok(desc.includes('予算¥8,000〜¥35,000の店を紹介。'), '父の日の seasonDesc は「紹介」');
});

test('特集の生成器（gen_industry_features.js）: 語が残るのは題の系統（titleHtml・titleText・titleH1Suffix・他の特集へのリンク名）の 7 行だけ。本文・見出し・FAQ・札には戻さない（P-363）', () => {
  const allowed = /^\s*(titleHtml|titleText|titleH1Suffix):|href: 'nagoya-industry-pick-izakaya\.html', text: /;
  const lines = readRel('scripts/gen_industry_features.js').split('\n');
  const bad = [];
  let titleFamily = 0;
  lines.forEach((l, i) => {
    if (hits(l).length === 0) return;
    if (allowed.test(l)) titleFamily++;
    else bad.push(`${i + 1}: ${l.trim().slice(0, 80)}`);
  });
  assert.deepEqual(bad, [], '題の系統以外に、人が選んだと読める言い方が戻っている');
  assert.equal(titleFamily, 7, '題の系統の行数（増えていたら題でない場所に語が入っている。減ったら P-334 で CLEAN_SOURCES に足す）');
});

test('特集の店カードの説明文の元データ（editor_picks・manual_stores・recommendations）は CLEAN_SOURCES に入っている（P-363）', () => {
  for (const rel of ['data/editor_picks.json', 'data/manual_stores.json', 'data/recommendations.json', 'scripts/apply_faq_per_topic.js', 'scripts/recreate_fabricated_features.js']) {
    assert.ok(CLEAN_SOURCES.includes(rel), rel);
  }
});

// ── 特集一覧（P-365・判断の記録 0033）──
// 特集一覧（features/index.html）のカードの題（card-title）と JSON-LD の ItemList の名前は、各特集の題を写したもの。
// 題は P-334 で、特集の題と一緒に（写しもそろえて）変える。それ以外の本文（一覧の説明・カードの説明・札・画像の代替文）は P-365 で直した。
// 例外は、特集名そのものを写したカードの札（category）「業界人推薦」の 1 行だけ（industry-insiders-pick の名前。P-334 で題と一緒に変える）。
test('特集一覧: 題の写し（card-title・ItemList の名前）を除いた本文に、人が選んだと読める言い方が無い。例外は特集名の札 1 行だけ（P-365）', () => {
  const titleCopy = (l) => /class="card-title"/.test(l) || /"@type":"ListItem"/.test(l);
  const bad = [];
  const nameLabel = [];
  readRel('features/index.html').split('\n').forEach((l, i) => {
    if (hits(l).length === 0 || titleCopy(l)) return;
    if (l.trim() === '<div class="card-category">業界人推薦</div>') { nameLabel.push(i + 1); return; }
    bad.push(`${i + 1}: ${l.trim().slice(0, 90)}`);
  });
  assert.deepEqual(bad, [], '特集一覧の本文に、人が選んだと読める言い方が戻っている（題の写しは P-334）');
  assert.ok(nameLabel.length <= 1, '特集名の札の例外は 1 行だけ');
});

test('監査の語: 「業界人」の言い換え（業界視点・基準・標準・水準・的）と「経営者が厳選」は info で数える。違反には数えず作業の一覧に出す（P-365）', () => {
  const info = new Map(policy.terms.filter((t) => t.severity === 'info').map((t) => [t.id, new RegExp(t.pattern)]));
  const kijun = info.get('gyokai-no-kijun');
  assert.ok(kijun, 'gyokai-no-kijun');
  for (const s of ['業界視点で解説', '業界目線で比較', '業界基準を超える', '業界標準', '業界水準でも高い', '業界的に見ると', '業界内評価', '業界の鉄則', '業界のマナー', '業界の作法']) assert.ok(kijun.test(s), s);
  for (const s of ['業界最大級', '飲食業界の経験者', '業界で働く人']) assert.ok(!kijun.test(s), s);
  const keieisha = info.get('keieisha-sentei');
  assert.ok(keieisha, 'keieisha-sentei');
  assert.ok(keieisha.test('飲食店経営者が厳選'));
  assert.ok(keieisha.test('経営者による選定'));
  assert.ok(!keieisha.test('飲食店経営者・店長・シェフなど'), '役職の名前だけでは数えない');
  assert.ok(!errorTerms.some((t) => t.id === 'gyokai-no-kijun' || t.id === 'keieisha-sentei'), 'info は error（違反）の一覧に入れない');
});
