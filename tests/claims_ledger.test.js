'use strict';
// 段階4・S4-1: 書き手が出す事実台帳（文と出典の該当記述の対）での照合。台帳が無い古い記事は従来どおり。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const C = require('../scripts/lib/claims');
const { buildLedger } = require('../scripts/verify_article_claims');
const { decide } = require('../scripts/journal_lane');
const G = require('../scripts/generate_daily_draft');

const URL_A = 'https://x.example/a';
const SRC = '店舗情報 コース 5,000円 全8品 飲み放題 150分 客席数 30席 営業時間 17時〜23時 創業は2005年です。';
const html = (price) => `<h1 class="art-title">炉端のコースは${price}円</h1><div class="art-body"><p>炉端のコースは${price}円で、飲み放題は150分。</p><p>創業は2005年で、地元の常連が多い店だ。</p><div class="source-note"><a href="${URL_A}">店舗情報</a></div></div><!-- NB_X_FOLLOW_START -->`;
const fetcher = async () => ({ ok: true, status: 200, text: SRC });
const pair = { text: '炉端のコースは5,000円で、飲み放題は150分。', source_url: URL_A, quote: 'コース 5,000円 全8品 飲み放題 150分' };
const build = (h, ledger) => buildLedger(h, { date: '2026-11-17', slug: 's', cache: false, storesMap: new Map(), fetcher, ledger });

test('台帳の対どおりなら、文は台帳の対で照合できた（paired）', async () => {
  const L = await build(html('5,000'), { claims: [pair] });
  const c = L.claims.find((x) => x.text.includes('飲み放題'));
  assert.strictEqual(c.status, '照合できた');
  assert.strictEqual(c.paired, true);
  assert.match(c.evidence_quote, /5000円|5,000円/);
  assert.ok(L.summary.paired >= 1);
  assert.strictEqual(decide({ claims: L }).lane, 'auto_publish');
});

test('台帳を書いた後に記事の価格が変わると、食い違いで保留の道になる', async () => {
  const L = await build(html('5,500'), { claims: [pair] });
  const c = L.claims.find((x) => x.text.includes('飲み放題'));
  assert.strictEqual(c.status, '食い違い');
  assert.strictEqual(decide({ claims: L }).lane, 'hold');
  assert.ok(L.issues.some((i) => i.type === 'number_mismatch'));
});

test('台帳の引用が出典に無いときは従来の照合に回る（数字が出典にあれば通る・無ければ従来どおり）', async () => {
  const bad = { ...pair, quote: '出典に無い引用の文字列です' };
  const L = await build(html('5,000'), { claims: [bad] });
  const c = L.claims.find((x) => x.text.includes('飲み放題'));
  assert.strictEqual(c.status, '照合できた');
  assert.ok(!c.paired);
});

test('台帳が無い・古い形（出典の対なし）の台帳は従来どおり機械が取り出す', async () => {
  const a = await build(html('5,000'), null);
  assert.strictEqual(a.ledger_by, 'machine');
  const b = await build(html('5,000'), { claims: [{ text: pair.text, kind: '確認済みの事実' }] });
  assert.ok(b.claims.length >= 1);
  assert.ok(b.claims.every((c) => !c.paired));
});

test('来店前に重要でない文は、照合不能でも自動修正の対象にしない（価格・時間は対象のまま）', async () => {
  const L = await build(html('5,000'), null);
  const founded = L.claims.find((x) => x.text.includes('創業は2005年で'));
  if (founded) {
    assert.strictEqual(founded.pre_visit, false);
    assert.notStrictEqual(founded.status, '取得できず照合不能');
  }
  assert.ok(C.isPreVisit('コースは5,000円で飲み放題は150分。'));
  assert.ok(C.isPreVisit('予約は11月30日まで受け付ける。'));
  assert.ok(!C.isPreVisit('創業は2005年で、常連が多い。'));
  // 出典に無い価格は、来店前に重要なので従来どおり照合不能（自動修正の道）
  const L2 = await buildLedger(html('5,000').replace('炉端のコースは5,000円</h1>', '炉端の忘年会コースを整理する</h1>'), { date: '2026-11-17', slug: 's', cache: false, storesMap: new Map(), fetcher: async () => ({ ok: true, status: 200, text: '店舗情報 全8品 客席数 30席 のページです。説明が続きます。' }) });
  const price = L2.claims.find((x) => x.text.includes('飲み放題'));
  assert.strictEqual(price.status, '取得できず照合不能');
  assert.strictEqual(decide({ claims: L2 }).lane, 'auto_fix');
});

test('書き手の出力: claims_ledger が data/journal_claims/<日付>.ledger.json に出る（空の日は警告だけ）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-ledger-'));
  const orig = console.warn;
  try {
    const warns = [];
    console.warn = (m) => warns.push(String(m));
    const input = { date: '2099-01-01', slug: 'test-ledger', sources: [{ url: URL_A }], claims_ledger: [pair, { text: '', source_url: URL_A, quote: 'x' }] };
    const file = G.writeClaimsLedger(input, html('5,000'));
    assert.ok(file && file.endsWith('2099-01-01.ledger.json'));
    const body = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(body.claims.length, 1);
    assert.ok(body.claims[0].quote.length <= 120);
    fs.rmSync(file);
    assert.strictEqual(G.writeClaimsLedger({ date: '2099-01-02', slug: 'x', sources: [] }, ''), null);
    assert.ok(warns.some((w) => /claims_ledger が空/.test(w)));
  } finally {
    console.warn = orig;
    fs.rmSync(tmp, { recursive: true, force: true });
    try { fs.rmSync(path.join(ROOT, 'data', 'journal_claims', '2099-01-01.ledger.json')); } catch (_) { /* 無ければよい */ }
  }
});

test('生成の指示（journal-today.md）に事実台帳の書き方がある', () => {
  const s = fs.readFileSync(path.join(ROOT, '.claude', 'commands', 'journal-today.md'), 'utf8');
  assert.match(s, /claims_ledger/);
  assert.match(s, /来店前に重要な文を優先/);
});
