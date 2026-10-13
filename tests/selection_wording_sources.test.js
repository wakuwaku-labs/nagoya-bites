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
  assert.deepEqual(types, ['Organization', 'WebPage', 'WebSite'], '構造化データの型');
  const text = JSON.stringify(blocks);
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
