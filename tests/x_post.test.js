'use strict';
// SNS-003: X 自動投稿の文面づくり・検査・投稿（scripts/lib/x_post.js・scripts/post_journal_to_x.js）。
// 計画書 docs/x-auto-posting-plan-2026-10.md。X には通信しない（fetch は差し替える）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('../scripts/lib/x_post');
const { run, effectiveMode } = require('../scripts/post_journal_to_x');

const REAL_ROOT = path.resolve(__dirname, '..');
const policy = X.loadPolicy(REAL_ROOT);
const entry = { slug: '2026-10-12-nakagawa-test', date: '2026-10-12', title: '中川区「なかがわ 街仲食堂」開店、おむすび550円と3時間営業を業界人が読む', published_at: '2026-10-12T08:00:00+09:00' };

test('X の数え方: 英数字=1・日本語=2・URL は長さに関係なく23', () => {
  assert.strictEqual(X.weightedLength('abc'), 3);
  assert.strictEqual(X.weightedLength('名古屋'), 6);
  assert.strictEqual(X.weightedLength('https://nagoya-bites.com/journal/' + 'a'.repeat(200) + '.html'), 23);
  assert.strictEqual(X.weightedLength('見て https://example.com/x'), 2 + 2 + 1 + 23);
});

test('OAuth 1.0a の署名が X（旧 Twitter）の公式の例と一致する', () => {
  const header = X.oauthHeader({
    method: 'POST', url: 'https://api.twitter.com/1.1/statuses/update.json',
    params: { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
    consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', timestamp: 1318622958,
  });
  assert.match(header, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/);
  assert.ok(!/include_entities|status=/.test(header), '署名に使った値はヘッダーに出さない');
});

test('定型の文面: UTM 付きリンク・地名のハッシュタグ・「業界人が読む」の置き換え', () => {
  const b = X.buildTemplatePost(entry, policy);
  assert.ok(b.ok);
  assert.ok(b.text.includes('?utm_source=x&utm_medium=social&utm_campaign=2026-10-12-nakagawa-test'));
  assert.deepStrictEqual(b.hashtags, ['#名古屋グルメ', '#中川区']);
  assert.ok(!b.text.includes('業界人'));
  assert.ok(b.text.includes('3時間営業を読む'));
  assert.deepStrictEqual(X.wordingViolations(b.text, REAL_ROOT), []);
});

test('地名は長い語から照合し、「」の中の店名は数えない', () => {
  assert.strictEqual(X.areaHashtag('名東区に新店', policy), '#名東区');
  assert.strictEqual(X.areaHashtag('新栄町「ちひろ菓子店」', policy), '#新栄');
  assert.strictEqual(X.areaHashtag('「栄寿司」が開店', policy), null);
});

test('長すぎる題名は、ハッシュタグ→見出しの順に削り、題名は切らない。それでも超えれば送らない', () => {
  const long = { ...entry, title: 'あ'.repeat(120) };
  const b = X.buildTemplatePost(long, policy);
  assert.ok(b.ok);
  assert.ok(b.text.includes('あ'.repeat(120)));
  assert.ok(b.weighted <= 280);
  assert.strictEqual(X.buildTemplatePost({ ...entry, title: 'あ'.repeat(140) }, policy).reason, 'too_long');
});

test('文面の数字は記事の本文にあるものだけ（全角・桁区切りはそろえて比べる）', () => {
  const article = '飲み放題3,500円、おむすび５５０円、11時〜14時';
  assert.deepStrictEqual(X.numbersMissingFromArticle('飲み放題3500円とおむすび550円', article), []);
  assert.deepStrictEqual(X.numbersMissingFromArticle('ランチ999円 https://x.com/1234 #名古屋2026', article), ['999']);
  assert.deepStrictEqual(X.numbersMissingFromArticle('35円', article), ['35']);
});

test('検査: 言い方・リンク先・UTM・重複を見る', () => {
  const b = X.buildTemplatePost(entry, policy);
  const articleText = entry.title;
  const ok = X.validatePost(b.text, { entry, policy, articleText, root: REAL_ROOT });
  assert.deepStrictEqual(ok, []);
  assert.ok(X.validatePost(b.text + ' 業界人', { entry, policy, articleText, root: REAL_ROOT }).some((f) => f.startsWith('wording:')));
  assert.ok(X.validatePost(b.text.replace('utm_source=x', 'utm_source=tw'), { entry, policy, articleText, root: REAL_ROOT }).includes('utm_missing'));
  assert.ok(X.validatePost(b.text.replace('nakagawa-test.html', 'other.html'), { entry, policy, articleText, root: REAL_ROOT }).includes('url_not_article'));
  assert.ok(X.validatePost(b.text, { entry, policy, articleText, root: REAL_ROOT, recentTexts: [b.text] }).includes('duplicate_recent'));
});

test('X の失敗の分類', () => {
  assert.strictEqual(X.classifyError(403, { detail: 'You are not allowed to create a Tweet with duplicate content.' }), 'duplicate');
  assert.strictEqual(X.classifyError(401, { title: 'Unauthorized' }), 'auth');
  assert.strictEqual(X.classifyError(403, { title: 'Forbidden' }), 'forbidden');
  assert.strictEqual(X.classifyError(402, {}), 'payment');
  assert.strictEqual(X.classifyError(403, { detail: 'Your account does not have enough credits' }), 'payment');
  assert.strictEqual(X.classifyError(429, {}), 'rate');
  assert.strictEqual(X.classifyError(503, ''), 'server');
});

test('mode: off は何もしない・--dry-run は live でも送らない・--force-live は dry-run でも送る', () => {
  assert.strictEqual(effectiveMode('off', { forceLive: true }), 'off');
  assert.strictEqual(effectiveMode('live', { dryRun: true }), 'dry-run');
  assert.strictEqual(effectiveMode('dry-run', { forceLive: true }), 'live');
  assert.strictEqual(effectiveMode('dry-run', {}), 'dry-run');
  assert.strictEqual(effectiveMode('unknown', {}), 'dry-run');
});

// ── run() を仮のリポジトリで通す ──────────────────────────────────────
function fixture({ mode = 'live', withEntry = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xpost-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'journal'));
  fs.writeFileSync(path.join(root, 'data/x_post_policy.json'), JSON.stringify({ ...policy, mode, livePage: { attempts: 2, intervalSeconds: 0 } }));
  fs.copyFileSync(path.join(REAL_ROOT, 'data/selection_wording_policy.json'), path.join(root, 'data/selection_wording_policy.json'));
  fs.writeFileSync(path.join(root, 'data/journal_published.json'), JSON.stringify({ entries: withEntry ? [entry] : [] }));
  fs.writeFileSync(path.join(root, `journal/${entry.slug}.html`), `<html><head><meta property="og:image" content="https://img.example/a.jpg"></head><body><h1>${entry.title}</h1></body></html>`);
  return root;
}

function fakeFetch({ page = 200, tweet = { status: 201, body: { data: { id: '123', text: 'x' } } } } = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.startsWith('https://api.x.com/2/tweets')) {
      return { status: tweet.status, text: async () => JSON.stringify(tweet.body), headers: new Map() };
    }
    if (url.startsWith('https://img.example/')) {
      return { status: 200, headers: { get: () => 'image/jpeg' }, body: null };
    }
    const html = fs.readFileSync(path.join(fn.root, `journal/${entry.slug}.html`), 'utf8');
    return { status: page, text: async () => html, headers: { get: () => 'text/html' } };
  };
  fn.calls = calls;
  return fn;
}

const ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' };
const NOW = new Date('2026-10-12T03:00:00Z');

test('live: 投稿して台帳と心拍を書き、2回目は送らない', async () => {
  const root = fixture();
  const f = fakeFetch(); f.root = root;
  const r = await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'posted');
  assert.strictEqual(r.tweetId, '123');
  const post = f.calls.find((c) => c.url.startsWith('https://api.x.com'));
  assert.match(post.opts.headers.authorization, /^OAuth /);
  assert.strictEqual(JSON.parse(post.opts.body).text, r.text);
  const log = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8'));
  assert.strictEqual(log.posts[0].status, 'posted');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_health.json'), 'utf8')).last_run.result, 'posted');

  const f2 = fakeFetch(); f2.root = root;
  const r2 = await run({}, { root, env: ENV, fetchImpl: f2, now: NOW });
  assert.strictEqual(r2.result, 'already_posted');
  assert.strictEqual(f2.calls.length, 0);
});

test('dry-run: X に送らず、台帳も心拍も書かない', async () => {
  const root = fixture({ mode: 'dry-run' });
  const f = fakeFetch(); f.root = root;
  const r = await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'dry_run_ok');
  assert.ok(!f.calls.some((c) => c.url.startsWith('https://api.x.com')));
  assert.ok(!fs.existsSync(path.join(root, 'data/x_post_log.json')));
  assert.ok(!fs.existsSync(path.join(root, 'data/x_post_health.json')));
});

test('ジャーナルが無い日は送らず、何も書かない', async () => {
  const root = fixture({ withEntry: false });
  const f = fakeFetch(); f.root = root;
  const r = await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'no_journal');
  assert.strictEqual(f.calls.length, 0);
  assert.ok(!fs.existsSync(path.join(root, 'data/x_post_health.json')));
});

test('本番の記事がまだ出ていなければ送らず、次の回に回す', async () => {
  const root = fixture();
  const f = fakeFetch({ page: 404 }); f.root = root;
  const r = await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'page_not_live');
  assert.strictEqual(r.exitCode, 0);
  assert.ok(!f.calls.some((c) => c.url.startsWith('https://api.x.com')));
});

test('鍵が無い・401 は失敗として理由を残し、X の重複は届いた印として扱う', async () => {
  let root = fixture();
  let f = fakeFetch(); f.root = root;
  let r = await run({}, { root, env: {}, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'failed');
  assert.strictEqual(r.reason, 'no_credentials');

  root = fixture();
  f = fakeFetch({ tweet: { status: 401, body: { title: 'Unauthorized' } } }); f.root = root;
  r = await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.errorClass, 'auth');
  assert.strictEqual(r.exitCode, 1);
  const health = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_health.json'), 'utf8'));
  assert.strictEqual(health.last_run.error_class, 'auth');

  root = fixture();
  f = fakeFetch({ tweet: { status: 403, body: { detail: 'You are not allowed to create a Tweet with duplicate content.' } } }); f.root = root;
  r = await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  assert.strictEqual(r.result, 'duplicate');
  const f2 = fakeFetch(); f2.root = root;
  assert.strictEqual((await run({}, { root, env: ENV, fetchImpl: f2, now: NOW })).result, 'already_posted');
});

test('失敗の行は同じ記事の最新1行だけ残す', async () => {
  const root = fixture();
  for (let i = 0; i < 3; i++) {
    const f = fakeFetch({ tweet: { status: 503, body: 'down' } }); f.root = root;
    await run({}, { root, env: ENV, fetchImpl: f, now: NOW });
  }
  const log = JSON.parse(fs.readFileSync(path.join(root, 'data/x_post_log.json'), 'utf8'));
  assert.strictEqual(log.posts.length, 1);
  assert.strictEqual(log.posts[0].error_class, 'server');
});
