'use strict';
// 名古屋バイツの基本方針（本人 2026-11-16・Ondine #2041・docs/decisions/0068）を、文面を作る仕組みと投稿前の検査に入れた。
// 原文の置き場・指示文への要点・避ける言い回しで止まること・記事の面の例外を確かめる。X にも Claude にも通信しない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BP = require('../scripts/lib/brand_policy');
const X = require('../scripts/lib/x_post');
const N = require('../scripts/lib/note_draft');

process.env.SNS_ANALYZER_X_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-nonext-'));
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('原文がリポジトリにあり、agents/editor.md から参照されている', () => {
  const md = read(BP.ORIGINAL_REL);
  assert.match(md, /NAGOYA BITES（名古屋バイツ）基本方針/);
  assert.match(md, /実際に訪問していない店舗を、訪問したかのように紹介しない/);
  assert.ok(read('agents/editor.md').includes('docs/brand-policy/nagoya_bites.md'));
  assert.ok(read('.claude/commands/journal-today.md').includes('docs/brand-policy/nagoya_bites.md'));
});

test('写しは SNS分析ツールの正本と同じ（正本がある端末だけ）', (t) => {
  const src = path.join(os.homedir(), 'orca/projects/SNS分析ツール/config/brand-policy');
  if (!fs.existsSync(src)) return t.skip('SNS分析ツールが無い端末（CI）');
  assert.strictEqual(read(BP.ORIGINAL_REL), fs.readFileSync(path.join(src, 'nagoya_bites.md'), 'utf8'));
  assert.strictEqual(read(BP.POLICY_REL), fs.readFileSync(path.join(src, 'nagoya_bites.json'), 'utf8'));
});

test('避ける言い回しの3種類（行った・順位・煽り）をすべて見分けられる', () => {
  const ids = BP.loadBrandPolicy(ROOT).ng.map((n) => n.id);
  assert.deepStrictEqual(ids, ['visit', 'ranking', 'hype']);
});

test('X の指示文と記事の生成の指示に、方針の要点と避ける言い回しが入っている', () => {
  const xp = read('docs/x-post-prompt.md');
  for (const s of ['名古屋バイツの基本方針', '判断材料', '未確認', '行っていない店', '順位で並べない', '注意点', '店選びガイド']) {
    assert.ok(xp.includes(s), `x-post-prompt.md に「${s}」が無い`);
  }
  const W = require('../scripts/write_x_draft');
  const entry = { slug: '2026-11-16-test', date: '2026-11-16', title: '題' };
  const prompt = W.buildPrompt({ root: ROOT, entry, material: '本文', previous: null, plan: null, topicExp: null });
  assert.ok(prompt.includes('名古屋バイツの基本方針（2026-11-16'));
  assert.ok(prompt.includes('名古屋バイツの基本方針で避ける言い回し'));
  assert.ok(prompt.includes('驚き価格') && prompt.includes('実食') && prompt.includes('第◯位'));
  const sh = read('scripts/run_journal_local.sh');
  assert.ok(sh.includes('【名古屋バイツの基本方針（本人 2026-11-16・原文 docs/brand-policy/nagoya_bites.md）】'));
  assert.ok(sh.includes('実際に行っていない店を行ったように見せない'));
});

// ── 投稿前の検査で止まる ─────────────────────────────────────────────
const xPolicy = X.loadPolicy(ROOT);
const entry = { slug: '2026-11-16-brand-test', date: '2026-11-16', title: '栄の店' };
const ARTICLE_TEXT = '栄の店は 3,000円のコース。予約は前日まで。';
const BAD = [
  ['栄の店に行ってきた。3,000円のコース。', 'visit'],
  ['栄の店を実食。3,000円のコース。', 'visit'],
  ['栄の居酒屋ランキング、3,000円のコース。', 'ranking'],
  ['栄で第1位の店。3,000円のコース。', 'ranking'],
  ['栄で最強の店。3,000円のコース。', 'hype'],
  ['栄の店は驚き価格の3,000円。', 'hype'],
];

test('X 投稿: 避ける言い回しを含む文面は送る前の検査（validatePost・返信・保存した文面）で止まる', () => {
  for (const [text, id] of BAD) {
    const f = X.validatePost(text, { entry, policy: xPolicy, articleText: ARTICLE_TEXT, root: ROOT });
    assert.ok(f.some((x) => x.startsWith(`brand:${id}:`)), `${text} → ${f.join(' ')}`);
    const r = X.validateReplies([text], { policy: xPolicy, articleText: ARTICLE_TEXT, root: ROOT });
    assert.ok(r.some((x) => x.startsWith(`reply0_brand:${id}:`)), `返信 ${text} → ${r.join(' ')}`);
    const draft = { slug: entry.slug, type: 'number', body: text, replies: [text], evidence: ['栄の店は 3,000円のコース。'] };
    const d = X.checkDraft(draft, { entry, policy: xPolicy, articleText: ARTICLE_TEXT });
    assert.ok(d.some((x) => x.startsWith(`draft_body_brand:${id}:`)), `下書き ${text} → ${d.join(' ')}`);
    assert.ok(d.some((x) => x.startsWith(`draft_reply_brand:0:${id}:`)));
  }
  // 方針に沿った文面は brand で止まらない
  const ok = X.validatePost('栄の店は3,000円のコース。予約は前日まで。', { entry, policy: xPolicy, articleText: ARTICLE_TEXT, root: ROOT });
  assert.ok(!ok.some((x) => x.startsWith('brand:')), ok.join(' '));
});

test('note: 行った・煽りの言い回しは止まり、記事から写した Google 評価（★4.1）では止まらない', () => {
  const policy = N.loadPolicy(ROOT);
  const base = (body) => ({ title: '栄の店', body: `${body}\nhttps://nagoya-bites.com/journal/x.html?utm_source=${policy.utm.source}` });
  const bad = N.validateNoteDraft(base('栄の店に潜入。3,000円。'), { policy, articleText: ARTICLE_TEXT, root: ROOT });
  assert.ok(bad.some((x) => x.startsWith('brand:visit:')), bad.join(' '));
  const hype = N.validateNoteDraft(base('栄の店は間違いない。3,000円。'), { policy, articleText: ARTICLE_TEXT, root: ROOT });
  assert.ok(hype.some((x) => x.startsWith('brand:hype:')), hype.join(' '));
  const card = N.validateNoteDraft(base('栄の店 ★4.1 3,000円。'), { policy, articleText: ARTICLE_TEXT + ' 4.1', root: ROOT });
  assert.ok(!card.some((x) => x.startsWith('brand:')), card.join(' '));
});

test('記事の面: Google 評価の表示は対象外・順位の語は警告だけ・行った/煽りは止める', () => {
  assert.deepStrictEqual(BP.brandFindings('鉄板屋 ★4.5 栄駅から徒歩2分', { surface: 'article' }), { fail: [], warn: [] });
  const w = BP.brandFindings('愛知のキャベツは作付面積が全国1位', { surface: 'article' });
  assert.deepStrictEqual([w.fail.length, w.warn.map((x) => x.id)], [0, ['ranking']]);
  assert.deepStrictEqual(BP.brandFindings('全国1位', { surface: 'post' }).fail.map((x) => x.id), ['ranking']);
  assert.deepStrictEqual(BP.brandFindings('★5つ', { surface: 'post' }).fail.map((x) => x.id), ['ranking']);
});

test('日次ジャーナルの検査（5c）: 本文に「実食」「必見」があると止まり、無ければ通る', () => {
  const { checkJournal } = require('../scripts/validate_journal_draft');
  const src = fs.readdirSync(path.join(ROOT, 'journal')).filter((f) => /^2026-11-1\d-.+\.html$/.test(f)).sort()[0];
  const html = read(`journal/${src}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-journal-'));
  const okPath = path.join(dir, src);
  fs.writeFileSync(okPath, html);
  const ok = checkJournal(okPath).find((r) => r.id === '5c_brand_policy');
  assert.strictEqual(ok.ok, true, ok.msg);
  const badPath = path.join(dir, 'bad-' + src);
  fs.writeFileSync(badPath, html.replace(/(<div class="art-body">)/, '$1<p>話題の店を実食。必見の一皿。</p>'));
  const bad = checkJournal(badPath).find((r) => r.id === '5c_brand_policy');
  assert.strictEqual(bad.ok, false);
  assert.match(bad.msg, /実食/);
  assert.match(bad.msg, /必見/);
  // SNS の投稿案（md）は投稿の面: 順位の語も止める
  const mdPath = path.join(dir, 'post.md');
  fs.writeFileSync(mdPath, '## X\n1. 栄のランキング第1位\n');
  const md = checkJournal(okPath, mdPath).find((r) => r.id === '5c_brand_policy');
  assert.strictEqual(md.ok, false);
  assert.match(md.msg, /ランキング/);
});
