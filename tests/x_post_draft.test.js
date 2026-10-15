'use strict';
// P-476: X の文面を「記事の中の得する事実」にする（保存した文面・ポイント入りの定型・Mac 側の書き手）。
// scripts/lib/x_post.js・scripts/post_journal_to_x.js・scripts/write_x_draft.js。X にも Claude にも通信しない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('../scripts/lib/x_post');
const { run: postRun } = require('../scripts/post_journal_to_x');
const W = require('../scripts/write_x_draft');

const REAL_ROOT = path.resolve(__dirname, '..');
const realPolicy = X.loadPolicy(REAL_ROOT);
const policy = { ...realPolicy, draft: { ...realPolicy.draft, generate: true, useInPost: true }, template: { points: true } };
const entry = { slug: '2026-10-15-ikeshita-test', date: '2026-10-15', title: '池下のイタリアン「QQ」でデート、棚のワインと抜栓料20%', published_at: '2026-10-15T09:00:00+09:00' };

const ARTICLE = `<html><head><meta property="og:image" content="https://img.example/a.jpg"></head><body>
<header>NAGOYA BITES</header>
<article>
<h1>${entry.title}</h1>
<p class="art-lead">池下に9月15日開店した「QQ」は、イタリア食材店の奥にレストランがある店です。</p>
<div class="art-body">
<p>棚のワインを1本選び、抜栓料（ボトル価格の<strong>20%・最低2,000円</strong>）を足して奥で開ける。3,000円のボトルなら5,000円になる。</p>
<p>ランチは12〜14時の2時間で、ディナーは月・木が休み（祝日は営業）。</p>
</div>
<div class="insider-box">
  <h3>知っておきたいポイント</h3>
  <ul>
    <li>抜栓料は最低2,000円なので、1万円までのボトルは一律で2,000円が乗る。飲み残しは持ち帰れる</li>
    <li>レストランはランチ12〜14時の2時間で、ディナーは月・木が休み</li>
  </ul>
</div>
</article>
<footer>運営について</footer>
</body></html>`;
const ARTICLE_TEXT = X.htmlToText(ARTICLE);

const GOOD = {
  version: 1, date: entry.date, slug: entry.slug, type: 'number',
  body: '池下のQQは、棚のワインを奥の席で開けられる。\n抜栓料は20%・最低2,000円で、3,000円のボトルなら5,000円になる。飲み残しは持ち帰れる。',
  evidence: ['抜栓料（ボトル価格の20%・最低2,000円）を足して奥で開ける', '3,000円のボトルなら5,000円になる'],
};

// ── 検査 ────────────────────────────────────────────────────────────────
test('保存した文面: 本文の数字がすべて引用にあり、引用が記事の原文なら通る（空白・タグ・全角の違いは許す）', () => {
  assert.deepStrictEqual(X.checkDraft(GOOD, { entry, policy, articleText: ARTICLE_TEXT }), []);
  // 記事では <strong> で区切られている・全角数字で写しても同じ文とみなす
  const loose = { ...GOOD, evidence: ['抜栓料（ボトル価格の２０%・最低２,０００円）を足して奥で開ける', '3,000円のボトルなら5,000円になる'] };
  assert.deepStrictEqual(X.checkDraft(loose, { entry, policy, articleText: ARTICLE_TEXT }), []);
});

test('保存した文面: 数字が引用に無い・引用が記事に無い・短すぎる引用は落ちる', () => {
  const noNum = { ...GOOD, evidence: ['抜栓料（ボトル価格の20%・最低2,000円）を足して奥で開ける'] };
  assert.ok(X.checkDraft(noNum, { entry, policy, articleText: ARTICLE_TEXT }).includes('draft_numbers_not_in_evidence:3000,5000'));
  // 記事のどこかにある数字でも、引用に入っていなければ落とす（数字を別の品に付け替える誤りを防ぐ）
  const madeUp = { ...GOOD, evidence: [...GOOD.evidence, '抜栓料は25%・最低2,000円で開けられる店'] };
  assert.ok(X.checkDraft(madeUp, { entry, policy, articleText: ARTICLE_TEXT }).includes('draft_evidence_not_in_article:2'));
  const short = { ...GOOD, evidence: ['2,000円', '3,000円のボトルなら5,000円になる'] };
  assert.ok(X.checkDraft(short, { entry, policy, articleText: ARTICLE_TEXT }).includes('draft_evidence_length:0'));
  const none = { ...GOOD, evidence: [] };
  assert.ok(X.checkDraft(none, { entry, policy, articleText: ARTICLE_TEXT }).some((f) => f.startsWith('draft_evidence_count')));
  const notArray = { ...GOOD, evidence: 'abc' };
  assert.ok(X.checkDraft(notArray, { entry, policy, articleText: ARTICLE_TEXT }).some((f) => f.startsWith('draft_evidence_count')));
});

test('保存した文面: 記事違い・知らない型・URL・ハッシュタグ・長すぎる本文・空は落ちる', () => {
  const c = (d) => X.checkDraft({ ...GOOD, ...d }, { entry, policy, articleText: ARTICLE_TEXT });
  assert.ok(c({ slug: 'other' }).includes('draft_slug_mismatch'));
  assert.ok(c({ type: 'buzz' }).includes('draft_type_unknown:buzz'));
  assert.ok(c({ body: GOOD.body + ' https://example.com' }).includes('draft_body_has_url'));
  assert.ok(c({ body: GOOD.body + '\n#池下' }).includes('draft_body_has_hashtag'));
  assert.ok(c({ body: 'あ'.repeat(116) }).includes('draft_body_too_long:232'));
  assert.ok(c({ body: '  ' }).includes('draft_body_empty'));
  assert.deepStrictEqual(X.checkDraft(null, { entry, policy, articleText: ARTICLE_TEXT }), ['draft_missing']);
});

test('保存した文面の投稿: 本文＋URL（utm_content=型）＋ハッシュタグ。280 を超えるならハッシュタグから削る', () => {
  const b = X.buildDraftPost(GOOD, entry, policy);
  assert.ok(b.ok);
  assert.ok(b.text.startsWith(GOOD.body + '\n\nhttps://nagoya-bites.com/journal/2026-10-15-ikeshita-test.html?'));
  assert.ok(b.url.includes('utm_campaign=2026-10-15-ikeshita-test&utm_content=number'));
  assert.deepStrictEqual(b.hashtags, ['#名古屋グルメ', '#池下']);
  const long = X.buildDraftPost({ ...GOOD, body: 'あ'.repeat(120) }, entry, policy);
  assert.ok(long.ok && long.weighted <= 280);
  assert.ok(long.hashtags.length < 2);
  assert.deepStrictEqual(X.validatePost(b.text, { entry, policy, articleText: ARTICLE_TEXT, root: REAL_ROOT }), []);
});

test('ポイント入りの定型: insider-box の項目をそのまま使い、280 に収まる項目だけ記事の順に返す', () => {
  assert.deepStrictEqual(X.insiderPoints(ARTICLE), [
    '抜栓料は最低2,000円なので、1万円までのボトルは一律で2,000円が乗る。飲み残しは持ち帰れる',
    'レストランはランチ12〜14時の2時間で、ディナーは月・木が休み',
  ]);
  const posts = X.buildPointPosts(entry, policy, ARTICLE);
  assert.strictEqual(posts.length, 2);
  assert.ok(posts[0].text.startsWith(`${entry.title}\n\n抜栓料は最低2,000円`));
  assert.ok(posts[0].url.endsWith('&utm_content=point'));
  assert.ok(!posts[0].text.includes('【'), '見出しの札は付けない（header が空）');
  const tooLong = ARTICLE.replace('<li>レストラン', `<li>${'長'.repeat(120)}レストラン`);
  assert.strictEqual(X.buildPointPosts(entry, policy, tooLong).length, 1, '途中で切らずに、収まらない項目は使わない');
  assert.deepStrictEqual(X.insiderPoints('<p>ポイントの欄が無い記事</p>'), []);
});

test('候補の順: 保存した文面 → ポイント → 題名だけ。useInPost が false なら保存した文面を使わない', () => {
  const root = fixture({ draft: GOOD });
  const modes = X.postCandidates({ entry, policy, date: entry.date, html: ARTICLE, root }).map((c) => c.mode);
  assert.deepStrictEqual(modes, ['draft', 'template-point', 'template-point', 'template']);
  const off = X.postCandidates({ entry, policy: { ...policy, draft: { ...policy.draft, useInPost: false } }, date: entry.date, html: ARTICLE, root });
  assert.deepStrictEqual(off.map((c) => c.mode), ['template-point', 'template-point', 'template']);
  const noFile = X.postCandidates({ entry, policy, date: entry.date, html: ARTICLE, root: fixture({}) });
  assert.deepStrictEqual(noFile[0], { mode: 'draft', failures: ['draft_missing'] });
});

// ── 投稿（post_journal_to_x.js の run）────────────────────────────────────
function fixture({ draft = null, mode = 'live', article = ARTICLE, pol = policy } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xdraft-'));
  // 保存先のフォルダ（data/x_post_drafts）は作らない。本番の最初の日と同じく、無いところから書けること
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'journal'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify({ ...pol, mode, livePage: { attempts: 1, intervalSeconds: 0 } }));
  fs.copyFileSync(path.join(REAL_ROOT, 'data/selection_wording_policy.json'), path.join(root, 'data/selection_wording_policy.json'));
  fs.copyFileSync(path.join(REAL_ROOT, 'docs/x-post-prompt.md'), path.join(root, 'docs/x-post-prompt.md'));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [entry] }));
  fs.writeFileSync(path.join(root, `journal/${entry.slug}.html`), article);
  if (draft) {
    fs.mkdirSync(path.join(root, 'data/x_post_drafts'));
    fs.writeFileSync(path.join(root, `data/x_post_drafts/${entry.date}.json`), JSON.stringify(draft));
  }
  return root;
}

function fakeFetch(root) {
  const sent = [];
  const fn = async (url, opts = {}) => {
    if (url.startsWith('https://api.x.com/2/tweets')) {
      sent.push(JSON.parse(opts.body).text);
      return { status: 201, text: async () => JSON.stringify({ data: { id: '999' } }), headers: new Map() };
    }
    if (url.startsWith('https://img.example/')) return { status: 200, headers: { get: () => 'image/jpeg' }, body: null };
    const html = fs.readFileSync(path.join(root, `journal/${entry.slug}.html`), 'utf8');
    return { status: 200, text: async () => html, headers: { get: () => 'text/html' } };
  };
  fn.sent = sent;
  return fn;
}

const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };
const NOW = new Date('2026-10-15T03:00:00Z');

test('投稿: 保存した文面を送り、台帳に作り方（draft）を残す', async () => {
  const root = fixture({ draft: GOOD });
  const f = fakeFetch(root);
  const r = await postRun({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.strictEqual(r.textMode, 'draft');
  assert.strictEqual(r.draftType, 'number');
  assert.ok(f.sent[0].startsWith(GOOD.body));
  const row = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8')).posts[0];
  assert.strictEqual(row.text_mode, 'draft');
});

test('投稿: 保存した文面が検査に落ちたらポイント入りの定型、それも落ちたら題名だけ（理由は要約に残す）', async () => {
  // 使わない言い方を含む文面 → 保存した文面は使わない
  const bad = { ...GOOD, body: `業界人が選ぶ${GOOD.body}` };
  let root = fixture({ draft: bad });
  let f = fakeFetch(root);
  let r = await postRun({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.strictEqual(r.textMode, 'template-point');
  assert.ok(r.rejected[0].mode === 'draft' && r.rejected[0].reason.includes('wording'));
  assert.ok(f.sent[0].includes('抜栓料は最低2,000円なので'));

  // ポイントにも使わない言い方がある → 題名だけ
  root = fixture({ draft: bad, article: ARTICLE.replace(/<li>/g, '<li>業界人の目で見ると、') });
  f = fakeFetch(root);
  r = await postRun({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.textMode, 'template');
  assert.deepStrictEqual(r.rejected.map((x) => x.mode), ['draft', 'template-point', 'template-point']);
  assert.ok(f.sent[0].startsWith(entry.title));
});

test('投稿: 保存した文面が別の記事のものなら使わない', async () => {
  const root = fixture({ draft: { ...GOOD, slug: '2026-10-14-other' } });
  const r = await postRun({}, { root, env: ENV, fetchImpl: fakeFetch(root), now: NOW });
  assert.strictEqual(r.textMode, 'template-point');
  assert.ok(r.rejected[0].reason.includes('draft_slug_mismatch'));
});

test('投稿: どの候補も落ちたら送らず、題名だけの定型の理由を残す', async () => {
  const root = fixture({ article: ARTICLE.replace(/<li>/g, '<li>業界人が言うには').replace('<h1>', '<h1>（題名に無い）') });
  const pol = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_policy.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [{ ...entry, title: '業界人が選ぶ店' }] }));
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify({ ...pol, titleRewrites: [] }));
  const f = fakeFetch(root);
  const r = await postRun({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'blocked');
  assert.ok(r.reason.includes('wording'));
  assert.strictEqual(f.sent.length, 0);
});

// ── Mac 側の書き手（write_x_draft.js）──────────────────────────────────────
function fakeClaude(replies) {
  const prompts = [];
  const fn = async (bin, prompt) => {
    prompts.push(prompt);
    const r = replies[Math.min(prompts.length - 1, replies.length - 1)];
    return typeof r === 'string' ? { ok: true, out: r, err: '' } : r;
  };
  fn.prompts = prompts;
  return fn;
}
const reply = (d) => JSON.stringify({ type: d.type, body: d.body, evidence: d.evidence });

test('書き手: 検査を通った文面だけを保存し、指示書・使わない言い方・記事の本文を渡す', async () => {
  const root = fixture();
  const call = fakeClaude([`はい。\n\`\`\`json\n${reply(GOOD)}\n\`\`\``]);
  const r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call });
  assert.strictEqual(r.result, 'written');
  const saved = JSON.parse(fs.readFileSync(path.join(root, `data/x_post_drafts/${entry.date}.json`), 'utf8'));
  assert.strictEqual(saved.slug, entry.slug);
  assert.strictEqual(saved.type, 'number');
  assert.deepStrictEqual(X.checkDraft(saved, { entry, policy, articleText: ARTICLE_TEXT }), []);
  const p = call.prompts[0];
  assert.ok(p.includes('## 型（記事にいちばん合うものを1つ選ぶ）'));
  assert.ok(!p.includes('scripts/write_x_draft.js がこのファイルを'), '人向けの前置きは渡さない');
  assert.ok(p.includes('「業界人」'));
  assert.ok(p.includes('抜栓料（ボトル価格の 20%・最低2,000円 ）'));
  assert.ok(!p.includes('運営について'), '記事の外（フッター）は渡さない');
  // 2回目は書き直さない
  assert.strictEqual((await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call })).result, 'exists');
});

test('書き手: 落ちたら理由を添えて書き直させ、それでも駄目なら何も保存しない', async () => {
  const root = fixture();
  const bad = { ...GOOD, evidence: ['抜栓料（ボトル価格の20%・最低2,000円）を足して奥で開ける'] };
  let call = fakeClaude([reply(bad), reply(GOOD)]);
  let r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call });
  assert.strictEqual(r.result, 'written');
  assert.strictEqual(r.attempts.length, 2);
  assert.ok(call.prompts[1].includes('落ちた理由: draft_numbers_not_in_evidence:3000,5000'));

  const root2 = fixture();
  call = fakeClaude([reply(bad), reply(bad)]);
  r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root: root2, now: NOW, call });
  assert.strictEqual(r.result, 'rejected');
  assert.ok(!fs.existsSync(path.join(root2, `data/x_post_drafts/${entry.date}.json`)));
});

test('書き手: 打ち切り・認証切れは書き直させずに諦める。--dry-run は保存しない。generate=false は何もしない', async () => {
  let root = fixture();
  let call = fakeClaude([{ ok: false, reason: 'timeout', out: '', err: '' }]);
  let r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call });
  assert.strictEqual(r.result, 'failed');
  assert.strictEqual(call.prompts.length, 1);

  call = fakeClaude(['Failed to authenticate: OAuth session expired and could not be refreshed']);
  r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call });
  assert.strictEqual(r.result, 'failed');
  assert.strictEqual(call.prompts.length, 1);

  r = await W.run({ date: entry.date, claudeBin: 'claude', dryRun: true }, { root, now: NOW, call: fakeClaude([reply(GOOD)]) });
  assert.strictEqual(r.result, 'dry_run_ok');
  assert.ok(r.post.startsWith(GOOD.body));
  assert.ok(!fs.existsSync(path.join(root, `data/x_post_drafts/${entry.date}.json`)));

  root = fixture({ pol: { ...policy, draft: { ...policy.draft, generate: false } } });
  call = fakeClaude([reply(GOOD)]);
  r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call });
  assert.strictEqual(r.result, 'off');
  assert.strictEqual(call.prompts.length, 0);

  r = await W.run({ date: '2026-10-01', claudeBin: 'claude' }, { root: fixture(), now: NOW, call });
  assert.strictEqual(r.result, 'no_journal');
});

test('書き手: Claude の応答を待つのは時間まで。止まった子は待たずに打ち切り、出力は受け取る', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xclaude-'));
  const slow = path.join(dir, 'slow.sh');
  fs.writeFileSync(slow, '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
  const t0 = Date.now();
  const r = await W.callClaude(slow, 'x', 500);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'timeout');
  assert.ok(Date.now() - t0 < 5000);
  const echo = path.join(dir, 'echo.sh');
  fs.writeFileSync(echo, '#!/bin/sh\necho \'{"type":"number"}\'\n', { mode: 0o755 });
  const ok = await W.callClaude(echo, 'x', 5000);
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(W.parseReply(ok.out), { type: 'number' });
  const missing = await W.callClaude(path.join(dir, 'none'), 'x', 5000);
  assert.ok(!missing.ok && missing.reason.startsWith('spawn:'));
});

test('書き手: 応答の前後の文やコードブロックの記号を無視して JSON を取り出す', () => {
  assert.deepStrictEqual(W.parseReply('```json\n{"type":"number","body":"a"}\n```'), { type: 'number', body: 'a' });
  assert.strictEqual(W.parseReply('JSON はありません'), null);
  assert.strictEqual(W.parseReply('[1,2]'), null);
});

test('設定と指示書: 型の一覧が指示書と一致し、本番の設定で見出しの札が空', () => {
  const md = fs.readFileSync(path.join(REAL_ROOT, 'docs/x-post-prompt.md'), 'utf8');
  for (const t of Object.keys(realPolicy.draft.types)) assert.ok(md.includes(`\`${t}\``), `指示書に型 ${t} がある`);
  assert.strictEqual(realPolicy.header, '');
  assert.ok(realPolicy.draft.maxBodyWeighted + 23 + 3 + X.weightedLength('#名古屋グルメ #久屋大通') <= 280, '本文の上限＋URL＋ハッシュタグ2個が 280 に収まる');
});

// ── 見張り役: 保存した文面が続けて使われていない ──────────────────────────────
test('投稿: 保存した文面を使わなかったときは、その理由を台帳の draft_reason に残す', async () => {
  const root = fixture({});
  await postRun({}, { root, env: ENV, fetchImpl: fakeFetch(root), now: NOW });
  const row = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8')).posts[0];
  assert.strictEqual(row.text_mode, 'template-point');
  assert.strictEqual(row.draft_reason, 'draft_missing');
});

test('見張り役: 送った投稿が3回続けて保存した文面を使っていなければ原因つきで鳴らし、1回でも使えば静かにする', () => {
  const { draftUnused, issueBody } = require('../scripts/check_x_post_health');
  const pol = { ...policy, draft: { ...policy.draft, since: '2026-10-16', alertAfterDays: 3 } };
  const row = (date, mode, extra = {}) => ({ date, slug: `${date}-x`, status: 'posted', text_mode: mode, ...extra });
  const three = [row('2026-10-16', 'template-point', { draft_reason: 'draft_missing' }), row('2026-10-17', 'template'), row('2026-10-18', 'template-point', { draft_reason: 'draft_missing' })];
  const p = draftUnused(pol, { posts: three }, '2026-10-15');
  assert.strictEqual(p.kind, 'draft_unused');
  assert.strictEqual(p.date, '2026-10-18');
  assert.ok(p.reason.includes('2026-10-16: template-point（draft_missing）'));
  assert.ok(issueBody({ today: '2026-10-18', problems: [p] }).includes('.local-logs'));
  // 1回でも保存した文面を使えば鳴らさない
  assert.strictEqual(draftUnused(pol, { posts: [...three.slice(0, 2), row('2026-10-18', 'draft')] }, '2026-10-15'), null);
  // まだ2回しか送っていない・since より前・作り方を記録していない行・失敗の行は数えない
  assert.strictEqual(draftUnused(pol, { posts: three.slice(1) }, '2026-10-15'), null);
  assert.strictEqual(draftUnused(pol, { posts: [row('2026-10-14', 'template'), row('2026-10-15', 'template'), ...three.slice(1)] }, '2026-10-15'), null);
  assert.strictEqual(draftUnused(pol, { posts: [{ date: '2026-10-16', status: 'posted' }, ...three.slice(1)] }, '2026-10-15'), null);
  assert.strictEqual(draftUnused(pol, { posts: [...three.slice(0, 2), { ...three[2], status: 'failed' }] }, '2026-10-15'), null);
  // 使う設定でなければ鳴らさない
  assert.strictEqual(draftUnused({ ...pol, draft: { ...pol.draft, useInPost: false } }, { posts: three }, '2026-10-15'), null);
  assert.strictEqual(draftUnused({ ...pol, draft: { ...pol.draft, alertAfterDays: 0 } }, { posts: three }, '2026-10-15'), null);
});
