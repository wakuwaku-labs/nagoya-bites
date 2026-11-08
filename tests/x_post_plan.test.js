'use strict';
// 分析の割り当て（iCloud の next.json の plan）を X の文面づくりに効かせる（docs/decisions/0059）。
// scripts/write_x_draft.js・scripts/lib/sns_analyzer.js・scripts/lib/x_post.js・scripts/post_journal_to_x.js。X にも Claude にも通信しない
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('../scripts/lib/x_post');
const S = require('../scripts/lib/sns_analyzer');
const { run: postRun } = require('../scripts/post_journal_to_x');
const W = require('../scripts/write_x_draft');
const M = require('../scripts/fetch_x_metrics');

const REAL_ROOT = path.resolve(__dirname, '..');
const realPolicy = X.loadPolicy(REAL_ROOT);
const policy = { ...realPolicy, draft: { ...realPolicy.draft, generate: true, useInPost: true }, template: { points: true } };
// 2026-10-15 は木曜（月=0 なら 3）、ISO 週は 2026-W42
const entry = { slug: '2026-10-15-ikeshita-test', date: '2026-10-15', title: '池下のイタリアン「QQ」でデート、棚のワインと抜栓料20%', published_at: '2026-10-15T09:00:00+09:00' };
const NOW = new Date('2026-10-15T03:00:00Z');
const ARTICLE = `<html><head><meta property="og:image" content="https://img.example/a.jpg"></head><body>
<article>
<h1>${entry.title}</h1>
<p class="art-lead">池下に9月15日開店した「QQ」は、イタリア食材店の奥にレストランがある店です。</p>
<div class="art-body"><p>棚のワインを1本選び、抜栓料（ボトル価格の<strong>20%・最低2,000円</strong>）を足して奥で開ける。3,000円のボトルなら5,000円になる。</p></div>
<div class="insider-box"><h3>知っておきたいポイント</h3><ul><li>抜栓料は最低2,000円なので、1万円までのボトルは一律で2,000円が乗る</li></ul></div>
</article></body></html>`;
const GOOD = {
  type: 'number',
  body: '池下のQQは、棚のワインを奥の席で開けられる。\n抜栓料は20%・最低2,000円で、3,000円のボトルなら5,000円になる。',
  evidence: ['抜栓料（ボトル価格の20%・最低2,000円）を足して奥で開ける', '3,000円のボトルなら5,000円になる'],
};
const CHECKLIST = { ...GOOD, type: 'checklist', body: '・平日は予約が要る\n・抜栓料は20%・最低2,000円' };
const reply = (d) => JSON.stringify(d);

function fixture(pol = policy) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xplan-'));
  for (const d of ['data', 'journal', 'docs']) fs.mkdirSync(path.join(root, d));
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify({ ...pol, mode: 'live', livePage: { attempts: 1, intervalSeconds: 0 } }));
  fs.copyFileSync(path.join(REAL_ROOT, 'data/selection_wording_policy.json'), path.join(root, 'data/selection_wording_policy.json'));
  fs.copyFileSync(path.join(REAL_ROOT, 'docs/x-post-prompt.md'), path.join(root, 'docs/x-post-prompt.md'));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: [entry] }));
  fs.writeFileSync(path.join(root, `journal/${entry.slug}.html`), ARTICLE);
  return root;
}

function fakeClaude(replies) {
  const prompts = [];
  const fn = async (bin, prompt) => {
    prompts.push(prompt);
    return { ok: true, out: replies[Math.min(prompts.length - 1, replies.length - 1)], err: '' };
  };
  fn.prompts = prompts;
  return fn;
}

function fakeFetch(root) {
  const sent = [];
  const fn = async (url, opts = {}) => {
    if (url.startsWith('https://api.x.com/2/tweets')) {
      sent.push(JSON.parse(opts.body).text);
      return { status: 201, text: async () => JSON.stringify({ data: { id: String(900 + sent.length) } }), headers: new Map() };
    }
    if (url.startsWith('https://img.example/')) return { status: 200, headers: { get: () => 'image/jpeg' }, body: null };
    const html = fs.readFileSync(path.join(root, `journal/${entry.slug}.html`), 'utf8');
    return { status: 200, text: async () => html, headers: { get: () => 'text/html' } };
  };
  fn.sent = sent;
  return fn;
}
const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };

/** iCloud の代わりの置き場を作り、環境変数で向ける。 */
function analyzerDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplan-icloud-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  process.env.SNS_ANALYZER_X_DIR = dir;
  return dir;
}

const slots = (over = {}) => Array.from({ length: 7 }, (_, i) => ({
  slot: i, role: i === 3 ? 'explore' : 'exploit', topic: null,
  format: { kind: null, nb_kind: 'checklist', first_line: 'question', length: 'short', ...(i === 3 ? over : {}) },
  cell_id: i === 3 ? 'first_line=question|length=short' : `c${i}`, experiment_id: i === 3 ? 'exp-q-short' : `e${i}`, stop_condition: '4週',
}));
const nextJson = (over = {}) => ({
  schema: 'x-next/1', account: 'nagoya_bites', generated_at: '2026-10-14T21:30:00.000Z', judgement: 'insufficient_data', candidates: [], notes: [],
  plan: { week: '2026-W42', explore_ratio: 0.5, slots: slots() }, ...over,
});

async function draftWith(files, { pol = policy, replies = [reply(GOOD)] } = {}) {
  analyzerDir(files);
  const root = fixture(pol);
  const call = fakeClaude(replies);
  const r = await W.run({ date: entry.date, claudeBin: 'claude' }, { root, now: NOW, call });
  const file = path.join(root, `data/x_post_drafts/${entry.date}.json`);
  return { root, call, r, draft: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null };
}

test.after(() => { delete process.env.SNS_ANALYZER_X_DIR; });

test('週と曜日: ISO 週（JST）と月=0 の曜日', () => {
  assert.strictEqual(S.isoWeekJst('2026-10-15'), '2026-W42');
  assert.strictEqual(S.isoWeekJst('2026-11-09'), '2026-W46');
  assert.strictEqual(S.isoWeekJst('2026-11-08'), '2026-W45');
  assert.strictEqual(S.weekdayJst('2026-10-15'), 3);
  assert.strictEqual(S.weekdayJst('2026-11-08'), 6);
});

test('指定あり: 今日の枠の型・1行目・長さが指示に足され、使った枠が保存した文面に残る', async () => {
  const { r, call, draft } = await draftWith({ 'next.json': nextJson() }, { replies: [reply(CHECKLIST)] });
  assert.strictEqual(r.result, 'written');
  const p = call.prompts[0];
  assert.ok(p.includes('## 今日の指定'));
  assert.ok(p.includes('`checklist`') && p.includes('問いかけ') && p.includes('50字まで'));
  assert.deepStrictEqual([draft.plan.experiment_id, draft.plan.cell_id, draft.plan.week, draft.plan.slot], ['exp-q-short', 'first_line=question|length=short', '2026-W42', 3]);
  assert.strictEqual(draft.plan.followed, true);
  assert.deepStrictEqual(X.checkDraft(draft, { entry, policy, articleText: X.htmlToText(ARTICLE) }), [], '既存の検査は同じように通る');
});

test('指定あり: 指定と違う型で書かれたら1回だけ書き直させ、最後の回は通った案を followed:false で残す', async () => {
  const { r, call, draft } = await draftWith({ 'next.json': nextJson() });
  assert.strictEqual(r.result, 'written');
  assert.strictEqual(call.prompts.length, 2, 'attempts=2 の2回目で書き直し');
  assert.ok(call.prompts[1].includes('指定の型 checklist と違う型'));
  assert.strictEqual(draft.type, 'number');
  assert.strictEqual(draft.plan.followed, false);
});

test('指定なし・壊れ・古い・別の週・schema 違い・枠の値が未知: すべて「指定なし」で文面づくりは今までどおり通る', async () => {
  const cases = {
    'ファイル無し': {},
    '壊れた JSON': { 'next.json': '{not json' },
    '配列': { 'next.json': '[]' },
    '8日超': { 'next.json': nextJson({ generated_at: '2026-10-01T00:00:00.000Z' }) },
    '別の週': { 'next.json': nextJson({ plan: { week: '2026-W41', slots: slots() } }) },
    'schema 違い': { 'next.json': nextJson({ schema: 'x-next/2' }) },
    'plan 無し': { 'next.json': nextJson({ plan: undefined }) },
    'slots が配列でない': { 'next.json': nextJson({ plan: { week: '2026-W42', slots: {} } }) },
    '知らない型': { 'next.json': nextJson({ plan: { week: '2026-W42', slots: slots({ nb_kind: 'poem' }) } }) },
  };
  for (const [name, files] of Object.entries(cases)) {
    const { r, call, draft } = await draftWith(files);
    assert.strictEqual(r.result, 'written', name);
    assert.ok(!call.prompts[0].includes('## 今日の指定'), name);
    assert.ok(!('plan' in draft), name);
  }
});

test('設定オフ: 有効な割り当てがあっても、指示も保存した文面も割り当て無しのときと同一', async () => {
  const base = await draftWith({});
  const off = await draftWith({ 'next.json': nextJson() }, { pol: { ...policy, planExperiment: { ...realPolicy.planExperiment, enabled: false } } });
  const { planExperiment, ...noKey } = policy;
  const missing = await draftWith({ 'next.json': nextJson() }, { pol: noKey });
  assert.strictEqual(off.call.prompts[0], base.call.prompts[0]);
  assert.deepStrictEqual(off.draft, base.draft);
  assert.strictEqual(missing.call.prompts[0], base.call.prompts[0]);
  assert.deepStrictEqual(missing.draft, base.draft);
});

test('本番の設定: planExperiment は有効（本人の決定2）', () => {
  assert.strictEqual(realPolicy.planExperiment.enabled, true);
});

test('投稿: 指定ありの文面でも --dry-run 相当の検査を通り、台帳に plan_cell・plan_experiment が残る。指定なしの行にはキーが増えない', async () => {
  const withPlan = await draftWith({ 'next.json': nextJson() }, { replies: [reply(CHECKLIST)] });
  const d = await postRun({ dryRun: true, skipLiveCheck: true }, { root: withPlan.root, env: ENV, fetchImpl: fakeFetch(withPlan.root), now: NOW });
  assert.strictEqual(d.result, 'dry_run_ok');
  assert.strictEqual(d.textMode, 'draft');
  assert.strictEqual(d.plan.cell_id, 'first_line=question|length=short');
  assert.ok(!fs.existsSync(path.join(withPlan.root, 'data/x_post_log.json')), 'dry-run は台帳を書かない');

  const live = await postRun({}, { root: withPlan.root, env: ENV, fetchImpl: fakeFetch(withPlan.root), now: NOW });
  assert.strictEqual(live.result, 'posted');
  const row = JSON.parse(fs.readFileSync(path.join(withPlan.root, 'data/x_post_log.json'), 'utf8')).posts[0];
  assert.deepStrictEqual([row.plan_cell, row.plan_experiment, row.plan_followed], ['first_line=question|length=short', 'exp-q-short', true]);

  const none = await draftWith({});
  const dry2 = await postRun({ dryRun: true, skipLiveCheck: true }, { root: none.root, env: ENV, fetchImpl: fakeFetch(none.root), now: NOW });
  assert.strictEqual(dry2.result, 'dry_run_ok');
  assert.ok(!('plan' in dry2));
  await postRun({}, { root: none.root, env: ENV, fetchImpl: fakeFetch(none.root), now: NOW });
  const row2 = JSON.parse(fs.readFileSync(path.join(none.root, 'data/x_post_log.json'), 'utf8')).posts[0];
  assert.ok(!Object.keys(row2).some((k) => k.startsWith('plan_')));
  assert.deepStrictEqual(Object.keys(row).filter((k) => !k.startsWith('plan_')).sort(), Object.keys(row2).sort());
});

test('x_metrics.json: 台帳に plan_* が増えても既存のキー・値は変わらない', async () => {
  const lp = (extra) => ({ date: '2026-10-24', slug: 's1', status: 'posted', tweet_id: '1', posted_at: '2026-10-24T09:40:00.000Z', ...extra });
  const tl = { data: [{ id: '1', created_at: '2026-10-24T09:40:00.000Z', text: 'あ', public_metrics: { impression_count: 9, like_count: 1, retweet_count: 0, reply_count: 0, quote_count: 0, bookmark_count: 0 } }] };
  const fetchImpl = async (url) => ({ status: 200, text: async () => JSON.stringify(url.includes('/users/me') ? { data: { id: '77', username: 'nagoya_bites', name: 'N', public_metrics: { followers_count: 12, following_count: 3, tweet_count: 40 } } } : tl) });
  const outs = [];
  for (const extra of [{}, { plan_cell: 'a=b', plan_experiment: 'e', plan_followed: true }]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xplan-m-'));
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'data/x_post_log.json'), JSON.stringify({ version: 1, posts: [lp(extra)] }));
    await M.run({ root, env: ENV, fetchImpl, now: new Date('2026-10-25T21:40:05.000Z'), log: () => {} });
    outs.push(JSON.parse(fs.readFileSync(path.join(root, 'data/x_metrics.json'), 'utf8')));
  }
  assert.deepStrictEqual(outs[0], outs[1]);
});

test('置き場: 環境変数があればそれだけ。無ければ iCloud → ~/.config の順（launchd から iCloud が読めない実測への備え）', () => {
  const saved = process.env.SNS_ANALYZER_X_DIR;
  try {
    process.env.SNS_ANALYZER_X_DIR = '/x/y';
    assert.deepStrictEqual(S.analyzerDirs(), ['/x/y']);
    delete process.env.SNS_ANALYZER_X_DIR;
    const d = S.analyzerDirs();
    assert.strictEqual(d.length, 2);
    assert.ok(d[0].includes('com~apple~CloudDocs/sns-analyzer-x/nagoya_bites') && d[1].endsWith('.config/sns-analyzer-x/nagoya_bites'));
  } finally { if (saved === undefined) delete process.env.SNS_ANALYZER_X_DIR; else process.env.SNS_ANALYZER_X_DIR = saved; }
});
