'use strict';
// 題材の実験（next.json の candidates → 文面づくり → 台帳。docs/decisions/0067）。X にも Claude にも通信しない
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
const TOPIC = { enabled: true, since: '2026-11-22', until: '', weeklyTarget: 3, anyTopics: ['名古屋ジャーナルの紹介'], skip: ['x-nb-evening-post-time'], maxAgeDays: 8 };
const policy = { ...realPolicy, draft: { ...realPolicy.draft, generate: true, useInPost: true }, template: { points: true }, topicExperiment: TOPIC, planExperiment: { ...realPolicy.planExperiment, enabled: false } };
// 2026-11-28 は土曜（月=0 なら 5）。同じ週（2026-W48）の前の日は 11-23〜11-27
const DATE = '2026-11-28';
const NOW = new Date('2026-11-28T03:00:00Z');
const mkEntry = (title) => ({ slug: `${DATE}-test`, date: DATE, title, published_at: `${DATE}T09:00:00+09:00` });
const articleOf = (title) => `<html><head><meta property="og:image" content="https://img.example/a.jpg"></head><body>
<article>
<h1>${title}</h1>
<p class="art-lead">池下に9月15日開店した「QQ」は、イタリア食材店の奥にレストランがある店です。</p>
<div class="art-body"><p>棚のワインを1本選び、抜栓料（ボトル価格の<strong>20%・最低2,000円</strong>）を足して奥で開ける。3,000円のボトルなら5,000円になる。</p></div>
<div class="insider-box"><h3>知っておきたいポイント</h3><ul><li>抜栓料は最低2,000円なので、1万円までのボトルは一律で2,000円が乗る</li></ul></div>
</article></body></html>`;
const EV = ['抜栓料（ボトル価格の20%・最低2,000円）を足して奥で開ける', '3,000円のボトルなら5,000円になる'];
const NUM = { type: 'number', body: '抜栓料は20%・最低2,000円。\n3,000円のボトルなら5,000円になる。', evidence: EV };
const QUE = { type: 'number', body: '棚のワインを奥の席で開けたい？\n抜栓料は20%・最低2,000円で、3,000円のボトルなら5,000円になる。', evidence: EV };
const PLAIN = { type: 'number', body: '池下のQQは、棚のワインを奥の席で開けられる。\n抜栓料は20%・最低2,000円。', evidence: EV };
const reply = (d) => JSON.stringify(d);

const cand = (id, topic, format) => ({ id: `c-${id}`, topic, format: { media: 'none', thread: false, url: null, first_line: null, ...format }, hypothesis: 'h', experiment_id: id });
const CANDS = [
  cand('x-nb-thread-vs-single', '名古屋ジャーナルの紹介', { thread: false, first_line: 'number' }),
  cand('x-nb-question-first-line', '宴会・忘年会', { thread: true, first_line: 'question' }),
  cand('x-nb-evening-post-time', 'ひとり飲み・ひとりごはん', { thread: false }),
];
const nextJson = (candidates = CANDS, plan) => ({ schema: 'x-next/1', account: 'nagoya_bites', generated_at: '2026-11-27T21:30:00.000Z', judgement: 'insufficient_data', candidates, notes: [], ...(plan ? { plan } : {}) });

function analyzerDir(next) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xtopic-icloud-'));
  if (next) fs.writeFileSync(path.join(dir, 'next.json'), JSON.stringify(next));
  process.env.SNS_ANALYZER_X_DIR = dir;
  return dir;
}
test.after(() => { delete process.env.SNS_ANALYZER_X_DIR; });

function fixture(title, pol = policy) {
  const entry = mkEntry(title);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xtopic-'));
  for (const d of ['data', 'journal', 'docs']) fs.mkdirSync(path.join(root, d));
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify({ ...pol, mode: 'live', livePage: { attempts: 1, intervalSeconds: 0 } }));
  fs.copyFileSync(path.join(REAL_ROOT, 'data/selection_wording_policy.json'), path.join(root, 'data/selection_wording_policy.json'));
  fs.copyFileSync(path.join(REAL_ROOT, 'docs/x-post-prompt.md'), path.join(root, 'docs/x-post-prompt.md'));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [entry] }));
  fs.writeFileSync(path.join(root, `journal/${entry.slug}.html`), articleOf(title));
  return { root, entry };
}
function fakeClaude(replies) {
  const prompts = [];
  const fn = async (bin, prompt) => { prompts.push(prompt); return { ok: true, out: replies[Math.min(prompts.length - 1, replies.length - 1)], err: '' }; };
  fn.prompts = prompts;
  return fn;
}
const GENERIC = '池下のイタリアン「QQ」でワインを開ける、抜栓料20%';
const BANKAI = '池下の忘年会に使える個室、抜栓料20%';
async function draftWith(next, replies, { title = GENERIC, pol = policy, prior = [], date = DATE } = {}) {
  analyzerDir(next);
  const { root, entry } = fixture(title, pol);
  for (const d of prior) {
    fs.mkdirSync(path.join(root, 'data/x_post_drafts'), { recursive: true });
    fs.writeFileSync(path.join(root, `data/x_post_drafts/${d.date}.json`), JSON.stringify({ topic_experiment: d.te }));
  }
  const call = fakeClaude(replies);
  const r = await W.run({ date, claudeBin: 'claude' }, { root, now: NOW, call });
  const file = path.join(root, `data/x_post_drafts/${date}.json`);
  return { root, entry, call, r, draft: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null };
}
const te = (followed = true) => ({ experiment_id: 'x', topic: 't', format: {}, followed });
const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };
function fakeFetch(root, entry) {
  const sent = [];
  const fn = async (url, opts = {}) => {
    if (url.startsWith('https://api.x.com/2/tweets')) { sent.push(JSON.parse(opts.body).text); return { status: 201, text: async () => JSON.stringify({ data: { id: String(900 + sent.length) } }), headers: new Map() }; }
    if (url.startsWith('https://img.example/')) return { status: 200, headers: { get: () => 'image/jpeg' }, body: null };
    const html = fs.readFileSync(path.join(root, `journal/${entry.slug}.html`), 'utf8');
    return { status: 200, text: async () => html, headers: { get: () => 'text/html' } };
  };
  fn.sent = sent;
  return fn;
}

test('本番の設定: topicExperiment は 11-22 から有効で、投稿時刻の実験は skip', () => {
  const t = realPolicy.topicExperiment;
  assert.strictEqual(t.enabled, true);
  assert.strictEqual(t.since, '2026-11-22');
  assert.strictEqual(t.weeklyTarget, 3);
  assert.deepStrictEqual(t.skip, ['x-nb-evening-post-time']);
  assert.ok(t.help.includes('#2025'));
});

test('since 前は使わない／until 後も使わない／オフも使わない', () => {
  analyzerDir(nextJson());
  const e = mkEntry(GENERIC);
  assert.strictEqual(W.loadTopicExperiment('2026-11-21', policy, e, '/nonexistent', NOW).reason, 'before_since');
  assert.strictEqual(W.loadTopicExperiment('2026-11-28', { topicExperiment: { ...TOPIC, until: '2026-11-27' } }, e, '/nonexistent', NOW).reason, 'after_until');
  assert.strictEqual(W.loadTopicExperiment('2026-11-28', { topicExperiment: { ...TOPIC, enabled: false } }, e, '/nonexistent', NOW).reason, 'off');
  assert.strictEqual(W.loadTopicExperiment('2026-11-28', policy, e, '/nonexistent', NOW).exp.experiment_id, 'x-nb-thread-vs-single');
});

test('next.json が無い・古いときは使わない（例外も投げない）', () => {
  const e = mkEntry(GENERIC);
  analyzerDir(null);
  assert.strictEqual(W.loadTopicExperiment(DATE, policy, e, '/nonexistent', NOW).exp, null);
  analyzerDir({ ...nextJson(), generated_at: '2026-11-01T00:00:00Z' });
  assert.strictEqual(W.loadTopicExperiment(DATE, policy, e, '/nonexistent', NOW).reason, 'stale');
});

test('anyTopics は週3本まで・特定の題材は上限なし', () => {
  const { root } = fixture(GENERIC);
  const mk = (n) => { fs.mkdirSync(path.join(root, 'data/x_post_drafts'), { recursive: true }); for (let k = 0; k < n; k++) fs.writeFileSync(path.join(root, `data/x_post_drafts/2026-11-${23 + k}.json`), JSON.stringify({ topic_experiment: te() })); };
  analyzerDir(nextJson());
  mk(2);
  assert.ok(W.loadTopicExperiment(DATE, policy, mkEntry(GENERIC), root, NOW).exp, '2本なら3本目に使える');
  mk(3);
  assert.strictEqual(W.loadTopicExperiment(DATE, policy, mkEntry(GENERIC), root, NOW).reason, 'weekly_target_reached');
  assert.strictEqual(W.loadTopicExperiment(DATE, policy, mkEntry(BANKAI), root, NOW).exp.experiment_id, 'x-nb-question-first-line', '特定の題材は上限なし・anyTopics より優先');
  // followed:false は数えない・前の週は数えない
  fs.writeFileSync(path.join(root, 'data/x_post_drafts/2026-11-25.json'), JSON.stringify({ topic_experiment: te(false) }));
  fs.writeFileSync(path.join(root, 'data/x_post_drafts/2026-11-22.json'), JSON.stringify({ topic_experiment: te() }));
  assert.ok(W.loadTopicExperiment(DATE, policy, mkEntry(GENERIC), root, NOW).exp);
});

test('skip の実験・media が none でない候補は使わない', () => {
  analyzerDir(nextJson([cand('x-nb-evening-post-time', 'ひとり飲み・ひとりごはん', {}), cand('m', '宴会・忘年会', { media: 'image' }), { topic: 'x', format: { media: 'none' } }]));
  const r = W.loadTopicExperiment(DATE, policy, mkEntry(BANKAI), '/nonexistent', NOW);
  assert.strictEqual(r.exp, null);
  assert.strictEqual(r.reason, 'no_usable_candidate');
});

test('thread:false: 指示に返信なしが入り、返ってきた replies は外れて保存される', async () => {
  const withReplies = { ...NUM, replies: ['記事の続きです。抜栓料は20%・最低2,000円。'] };
  const { r, call, draft } = await draftWith(nextJson(), [reply(withReplies)]);
  assert.strictEqual(r.result, 'written');
  assert.ok(call.prompts[0].includes('## 今日の題材の実験') && call.prompts[0].includes('返信（続き）は付けない'));
  assert.ok(!('replies' in draft));
  assert.deepStrictEqual([draft.topic_experiment.experiment_id, draft.topic_experiment.followed, draft.topic_experiment.format.thread], ['x-nb-thread-vs-single', true, false]);
  assert.strictEqual(r.topic_experiment.experiment_id, 'x-nb-thread-vs-single');
  assert.ok(W.summary(r).includes('題材の実験: x-nb-thread-vs-single'));
});

test('first_line question: 守らないと書き直させ、最後の回で守れていなければ followed:false', async () => {
  const ok = await draftWith(nextJson(), [reply(PLAIN), reply(QUE)], { title: BANKAI });
  assert.strictEqual(ok.call.prompts.length, 2);
  assert.ok(ok.call.prompts[1].includes('題材の実験の指定'));
  assert.strictEqual(ok.draft.topic_experiment.followed, true);
  const ng = await draftWith(nextJson(), [reply(PLAIN)], { title: BANKAI });
  assert.strictEqual(ng.r.result, 'written');
  assert.strictEqual(ng.call.prompts.length, 2);
  assert.strictEqual(ng.draft.topic_experiment.followed, false);
});

test('first_line number: 1行目に数字が無いと書き直し', async () => {
  const { call, draft } = await draftWith(nextJson(), [reply({ ...PLAIN, body: '池下のQQは、棚のワインを奥の席で開けられる。\n抜栓料は20%・最低2,000円。' }), reply(NUM)]);
  assert.strictEqual(call.prompts.length, 2);
  assert.strictEqual(draft.topic_experiment.followed, true);
});

const planOf = (first_line) => ({ week: '2026-W48', explore_ratio: 0.5, slots: Array.from({ length: 7 }, (_, i) => ({ slot: i, role: 'explore', topic: null, format: { kind: null, nb_kind: 'number', first_line, length: null }, cell_id: `c${i}`, experiment_id: `e${i}`, stop_condition: '4週' })) });
const polPlan = { ...policy, planExperiment: { ...realPolicy.planExperiment, enabled: true } };

test('plan と first_line が食い違うと plan を使わない・合うと両方残る', async () => {
  const a = await draftWith(nextJson(CANDS, planOf('question')), [reply(NUM)], { pol: polPlan });
  assert.strictEqual(a.r.plan_skipped, 'topic_experiment');
  assert.ok(!a.draft.plan && a.draft.topic_experiment);
  assert.ok(!a.call.prompts[0].includes('## 今日の指定'));
  const b = await draftWith(nextJson(CANDS, planOf('number')), [reply(NUM)], { pol: polPlan });
  assert.ok(b.draft.plan && b.draft.topic_experiment);
  assert.ok(b.call.prompts[0].includes('## 今日の指定') && b.call.prompts[0].includes('## 今日の題材の実験'));
  const c = await draftWith(nextJson(CANDS, planOf(null)), [reply(NUM)], { pol: polPlan });
  assert.ok(c.draft.plan && c.draft.topic_experiment);
});

function readRow(root) { return JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8')).posts[0]; }

test('台帳: URL の実験がある日は experiment を上書きせず topic_experiment だけ。無い日は experiment にも入る', async () => {
  const urlPol = { ...policy, urlExperiment: { enabled: true, id: 'url-vs-nourl-2', noUrlShare: 0, since: '', until: '' } };
  const a = await draftWith(nextJson(), [reply(NUM)], { pol: urlPol });
  const ra = await postRun({}, { root: a.root, env: ENV, fetchImpl: fakeFetch(a.root, a.entry), now: NOW });
  assert.strictEqual(ra.result, 'posted');
  const rowA = readRow(a.root);
  assert.strictEqual(rowA.experiment, 'url-vs-nourl-2');
  assert.strictEqual(rowA.topic_experiment, 'x-nb-thread-vs-single');

  const b = await draftWith(nextJson(), [reply(NUM)]);
  await postRun({}, { root: b.root, env: ENV, fetchImpl: fakeFetch(b.root, b.entry), now: NOW });
  const rowB = readRow(b.root);
  assert.strictEqual(rowB.experiment, 'x-nb-thread-vs-single');
  assert.strictEqual(rowB.topic_experiment, 'x-nb-thread-vs-single');
  assert.ok(!('url_variant' in rowB));
});

test('台帳: 定型に落ちた日・followed:false の日は付かない', async () => {
  const a = await draftWith(nextJson(), [reply(NUM)]);
  const pf = path.join(a.root, 'data/x_post_policy.json');
  const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
  p.draft.useInPost = false;
  fs.writeFileSync(pf, JSON.stringify(p));
  const ra = await postRun({}, { root: a.root, env: ENV, fetchImpl: fakeFetch(a.root, a.entry), now: NOW });
  assert.strictEqual(ra.result, 'posted');
  assert.notStrictEqual(ra.textMode, 'draft');
  const rowA = readRow(a.root);
  assert.ok(!('topic_experiment' in rowA) && !('experiment' in rowA));

  const b = await draftWith(nextJson(), [reply(PLAIN)], { title: BANKAI });
  assert.strictEqual(b.draft.topic_experiment.followed, false);
  const rb = await postRun({}, { root: b.root, env: ENV, fetchImpl: fakeFetch(b.root, b.entry), now: NOW });
  assert.strictEqual(rb.result, 'posted');
  assert.ok(!('topic_experiment' in readRow(b.root)) && !('experiment' in readRow(b.root)));
});
