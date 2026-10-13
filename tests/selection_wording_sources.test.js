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

test('日次ジャーナルの生成ラッパーは、書き手への指示に「言葉の決まり」を入れている（P-335）', () => {
  // journal-today.md（.claude/ の自己改変ブロックで、Claude は編集できない）には「業界人視点」「『業界人』『編集部』で統一」が
  // 残っているので、その反映（P-335・オーナーの操作）までは、ラッパーが渡す指示で読み替えさせる。
  const sh = fs.readFileSync(path.join(ROOT, 'scripts', 'run_journal_local.sh'), 'utf8');
  const m = sh.match(/^SELF_HEADER=".*?"\n(?=PROMPT=)/ms);
  assert.ok(m, 'SELF_HEADER の代入が見つからない');
  // 実際に渡る文面を bash で評価する（$ やバッククォートが紛れると、文が欠けても構文は通ってしまう）
  const out = execFileSync('bash', ['-c', `TODAY_JST=2026-10-14\n${m[0]}printf '%s' "$SELF_HEADER"`], { encoding: 'utf8' });
  assert.ok(out.includes('【言葉の決まり'), out);
  assert.ok(out.includes('店舗の選定にはAIによる情報収集・分析を活用しています。'), out);
  assert.ok(out.includes('署名は『編集部』で統一'), out);
  assert.ok(out.includes('質問や確認待ちで止まらないこと'), '従来の無人実行の指示が残っている');
});
