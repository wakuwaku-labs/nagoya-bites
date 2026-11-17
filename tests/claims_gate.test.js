'use strict';
// 段階4（S4-1〜S4-3・S4-5 の準備）: 事実台帳・独立した読み手・3つの道・監査の履歴・合格の線の測定。
// 記録だけの段であること（公開の条件を変えていないこと）も確かめる。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const C = require('../scripts/lib/claims');
const { buildLedger } = require('../scripts/verify_article_claims');
const { decide } = require('../scripts/journal_lane');
const R = require('../scripts/review_article_independent');
const Cal = require('../scripts/claims_gate_calibrate');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('札の取り出し: 日付は1つの札・年と「時点」の日付は対象外・桁区切りは外す', () => {
  const t = C.claimTokens('11月30日までの予約は5,000円・8品で150分。2026年11月8日時点の情報。');
  const keys = t.map((x) => x.key);
  assert.ok(keys.includes('11/30'));
  assert.ok(keys.includes('5000'));
  assert.ok(!keys.includes('2026'));
  assert.ok(!keys.some((k) => k === '11/8'), '時点の日付は照合しない');
});

test('同じ項目の数字が違うときだけ食い違い（項目が見つからない数字は照合不能）', () => {
  const pool = [{ url: 'u', ok: true, text: 'グラスワイン 1,500円 コース 5,000円 予約受付 11月30日まで' }];
  assert.strictEqual(C.checkClaim('グラスワインは1,800円から。', pool, '確認済みの事実').status, '食い違い');
  assert.strictEqual(C.checkClaim('グラスワインは1,500円から。', pool, '確認済みの事実').status, '照合できた');
  assert.strictEqual(C.checkClaim('日本酒は777円から。', pool, '確認済みの事実').status, '取得できず照合不能');
  assert.strictEqual(C.checkClaim('予約受付は11月29日まで。', pool, '確認済みの事実').status, '食い違い');
});

test('出典が取得できないときは照合不能（食い違いにしない）', () => {
  assert.strictEqual(C.checkClaim('コースは5,000円。', [{ url: 'u', ok: false, text: '' }], '確認済みの事実').status, '取得できず照合不能');
});

test('出典が予定の書き方なのに記事が言い切ると記録する（定型の注意書きでは反応しない）', () => {
  const pool = [{ url: 'u', ok: true, text: 'ネット予約の受付は12月5日開始予定です。メニューは変更になる場合があります。' }];
  assert.strictEqual(C.checkClaim('ネット予約は12月5日に始まる。', pool, '確認済みの事実').hedge_dropped, true);
  assert.strictEqual(C.checkClaim('ネット予約は12月5日に始まる予定だ。', pool, '確認済みの事実').hedge_dropped, false);
  const plain = [{ url: 'u', ok: true, text: '営業時間 11:00〜21:00。メニューは変更になる場合があります。' }];
  assert.strictEqual(C.checkClaim('営業は11:00から21:00まで。', plain, '確認済みの事実').hedge_dropped, false);
});

test('見本の合格の線: 壊した20本のうち19本以上を検出・正しい30本の誤保留は3本以下', async () => {
  const cases = JSON.parse(read('tests/fixtures/claims_calibration/cases.json')).cases;
  assert.strictEqual(cases.filter((c) => c.label === 'broken').length, 20);
  assert.strictEqual(cases.filter((c) => c.label === 'correct').length, 30);
  const types = {};
  for (const c of cases.filter((x) => x.label === 'broken')) types[c.type] = (types[c.type] || 0) + 1;
  assert.deepStrictEqual(types, { number_changed: 4, source_swapped: 4, hedge_dropped: 4, closed_store: 4, visit_claim: 4 });
  const r = await Cal.runFixtures(cases);
  assert.ok(r.broken.detected >= Cal.LINE.detect_min, `検出 ${r.broken.detected}/20 見逃し: ${r.broken.missed.join(',')}`);
  assert.ok(r.correct.false_hold <= Cal.LINE.false_hold_max, `誤保留 ${r.correct.false_hold}: ${r.correct.false_hold_ids.join(',')}`);
  assert.strictEqual(r.pass, true);
});

test('見本は作り直しても同じ中身（乱数なし）', () => {
  // writer_view は作る途中の材料（保存時に台帳 ledger へ変わる）。台帳の中身は ledger の試験で確かめる
  const strip = (cs) => cs.map(({ ledger, writer_view, ...rest }) => rest);
  const again = Cal.makeCases();
  const saved = JSON.parse(read('tests/fixtures/claims_calibration/cases.json')).cases;
  assert.deepStrictEqual(strip(JSON.parse(JSON.stringify(again))), strip(saved));
  assert.ok(saved.every((c) => c.ledger && Array.isArray(c.ledger.claims)), '見本に書き手の台帳がある');
});

test('3つの道: 停止条件があれば hold・照合不能だけなら auto_fix・何も無ければ auto_publish', () => {
  const ok = { claims: [{ text: 'a', kind: '確認済みの事実', status: '照合できた' }], issues: [] };
  assert.strictEqual(decide({ claims: ok }).lane, 'auto_publish');
  const fix = { claims: [{ text: 'b', kind: '確認済みの事実', status: '取得できず照合不能' }], issues: [] };
  assert.strictEqual(decide({ claims: fix }).lane, 'auto_fix');
  const hold = { claims: [], issues: [{ type: 'number_mismatch', severity: 'core', detail: 'x' }] };
  assert.strictEqual(decide({ claims: hold }).lane, 'hold');
  // 分析・未確認・口コミの数字の照合不能は自動修正の対象にしない
  const ana = { claims: [{ text: 'c', kind: '編集部の分析', status: '取得できず照合不能' }, { text: 'd', kind: '口コミの数字', status: '取得できず照合不能' }], issues: [] };
  assert.strictEqual(decide({ claims: ana }).lane, 'auto_publish');
  assert.strictEqual(decide({ claims: null }).lane, 'unknown');
});

test('独立した読み手: 機械で再確認できた所見だけが停止の材料になる', () => {
  const articleText = '炉端のコースは5,500円で、飲み放題は150分。';
  const f = R.recheckFindings([
    { sentence: '炉端のコースは5,500円で、飲み放題は150分。', kind: 'number_mismatch', quote: 'コース 5,000円 全8品', reason: '価格が違う' },
    { sentence: '記事に無い文を作った所見ですよ。', kind: 'other', quote: 'コース 5,000円 全8品', reason: '' },
    { sentence: '炉端のコースは5,500円で、飲み放題は150分。', kind: 'number_mismatch', quote: '出典に無い一節です。', reason: '' },
  ], { articleText, sourceTexts: ['店舗情報 コース 5,000円 全8品 飲み放題 150分'] });
  assert.deepStrictEqual(f.map((x) => x.verified), [true, false, false]);
  const d = decide({ claims: { claims: [], issues: [] }, review: { findings: f } });
  assert.strictEqual(d.lane, 'hold');
  assert.ok(d.stop[0].type.startsWith('review:'));
});

test('独立した読み手: 指示文は agents/reviewer.md から取り出せ、出典の抜粋は指示として扱わないと書いてある', () => {
  const ins = R.loadInstruction();
  assert.match(ins, /信頼できないデータ/);
  assert.match(ins, /従わず/);
  assert.match(ins, /"findings"/);
});

test('独立した読み手: 失敗・不正な応答でも例外を投げずに記録する（公開を止めない）', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-'));
  try {
    fs.mkdirSync(path.join(tmp, 'agents'));
    fs.copyFileSync(path.join(ROOT, 'agents', 'reviewer.md'), path.join(tmp, 'agents', 'reviewer.md'));
    const html = '<h1 class="art-title">炉端のコースは5,000円</h1><div class="art-body"><p>炉端のコースは5,000円で、飲み放題は150分。</p><div class="source-note"><a href="https://x.example/a">店舗情報</a></div></div><!-- NB_X_FOLLOW_START -->';
    const url = 'https://x.example/a';
    fs.mkdirSync(C.cacheDir(tmp), { recursive: true });
    fs.writeFileSync(path.join(C.cacheDir(tmp), `${C.sha256(url).slice(0, 16)}.txt`), '店舗情報 コース 5,000円 全8品 飲み放題 150分 予約受付中の店です。');
    const claims = { date: '2026-11-17', slug: 's', sources: [{ url, fetch: { ok: true } }] };
    const bad = path.join(tmp, 'fake-claude-bad.sh');
    fs.writeFileSync(bad, '#!/bin/sh\necho "これはJSONではありません"\n', { mode: 0o755 });
    const r1 = await R.run({ html, claims, root: tmp, claudeBin: bad, timeoutSec: 10, promptVersion: 't' });
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(r1.reason, 'bad_reply');
    const good = path.join(tmp, 'fake-claude-good.sh');
    fs.writeFileSync(good, '#!/bin/sh\necho \'{"findings":[{"sentence":"炉端のコースは5,000円で、飲み放題は150分。","kind":"other","quote":"コース 5,000円 全8品","reason":"テスト"}]}\'\n', { mode: 0o755 });
    const r2 = await R.run({ html, claims, root: tmp, claudeBin: good, timeoutSec: 10, promptVersion: 't' });
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.findings.length, 1);
    assert.strictEqual(r2.findings[0].verified, true);
    const r3 = await R.run({ html, claims, root: tmp, claudeBin: '/nonexistent/claude', timeoutSec: 10, promptVersion: 't' });
    assert.strictEqual(r3.ok, false);
    assert.match(r3.reason, /spawn|exit/);
    // 抜粋が1つも無ければ AI を呼ばない
    const r4 = await R.run({ html, claims: { ...claims, sources: [] }, root: tmp, claudeBin: good, timeoutSec: 10, promptVersion: 't' });
    assert.strictEqual(r4.reason, 'no_excerpts');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('台帳: 出典の取得結果・短い引用・全文のハッシュだけを残し、全文は残さない', async () => {
  const html = '<h1 class="art-title">炉端のコースは5,000円</h1><div class="art-body"><p>炉端のコースは5,000円で、飲み放題は150分。</p><div class="source-note"><a href="https://x.example/a">店舗情報</a><span class="source-date">（2026-11-05掲載）</span></div></div><!-- NB_X_FOLLOW_START -->';
  const long = `店舗情報 コース 5,000円 全8品 飲み放題 150分 ${'あ'.repeat(400)}`;
  const L = await buildLedger(html, { date: '2026-11-17', slug: 's', cache: false, storesMap: new Map(), fetcher: async () => ({ ok: true, status: 200, text: long }) });
  assert.strictEqual(L.mode, 'shadow');
  assert.strictEqual(L.sources[0].fetch.ok, true);
  assert.match(L.sources[0].fetch.sha256, /^[0-9a-f]{64}$/);
  assert.ok(L.claims.length >= 1);
  for (const c of L.claims) assert.ok(c.evidence_quote.length <= C.QUOTE_MAX);
  assert.ok(!JSON.stringify(L).includes('あ'.repeat(200)), '出典の全文を台帳に残さない');
  const fields = ['text', 'kind', 'source', 'evidence_quote', 'fetched_at', 'confirmed_at', 'status', 'recheck_after', 'rights'];
  for (const k of fields) assert.ok(k in L.claims[0], k);
});

test('台帳: 取得に失敗した出典は照合不能として記録され、例外にならない', async () => {
  const html = '<h1 class="art-title">炉端のコースは5,000円</h1><div class="art-body"><p>炉端のコースは5,000円で、飲み放題は150分。</p><div class="source-note"><a href="https://x.example/a">店舗情報</a></div></div><!-- NB_X_FOLLOW_START -->';
  const L = await buildLedger(html, { date: '2026-11-17', slug: 's', cache: false, storesMap: new Map(), fetcher: async () => ({ ok: false, status: 403, reason: 'http_403' }) });
  assert.strictEqual(L.fetch_summary.ok, 0);
  assert.strictEqual(L.fetch_summary.failed[0].reason, 'http_403');
  assert.ok(L.claims.every((c) => c.status === '取得できず照合不能'));
});

test('記録だけの設定: claims_gate の既定は shadow・独立した読み手のモデルは記録され、固定は enforce と同時', () => {
  const p = JSON.parse(read('data/journal_gate_policy.json'));
  assert.strictEqual(p.claims_gate.mode, 'shadow');
  assert.strictEqual(p.claims_gate.independent_review.enabled, true);
  assert.ok(p.claims_gate.independent_review.prompt_version);
  // 既存の公開の条件は変えていない
  assert.strictEqual(p.auto_publish_min, 100);
  assert.strictEqual(p.review_publish_min, 85);
});

test('毎朝の実行: 記録の段は失敗しても止めず、HOLD 判定・公開条件に触れていない', () => {
  execFileSync('bash', ['-n', path.join(ROOT, 'scripts', 'run_journal_local.sh')]);
  const sh = read('scripts/run_journal_local.sh');
  const a = sh.indexOf('# (d2) 記事の事実の検査');
  const b = sh.indexOf('# (e) 記事 slug が feed.xml に載っているか');
  assert.ok(a > 0 && b > a);
  const block = sh.slice(a, b);
  for (const f of ['verify_article_claims.js', 'review_article_independent.js', 'journal_lane.js']) {
    const line = block.split('\n').find((l) => l.includes(`scripts/${f}`));
    assert.ok(line, f);
  }
  assert.ok(!/\bhold\b\s+"|\bdie\b\s+"/.test(block), '記録の段から hold / die を呼ばない');
  assert.ok(/\|\| log "⚠️ verify_article_claims/.test(block));
  assert.ok(/\|\| log "⚠️ review_article_independent/.test(block));
  assert.ok(/\|\| log "⚠️ journal_lane/.test(block));
  // 台帳・読み手・監査の履歴は当日のコミットに同乗する
  for (const f of ['data/journal_claims/${TODAY_JST}.json', 'data/journal_claims/${TODAY_JST}.review.json', 'data/journal_audit/${TODAY_JST}.json']) assert.ok(sh.includes(f), f);
});

test('健全性チェック: 基準に届かず出さなかった日（enforce 時）は故障の欠番と区別する。shadow の間は従来どおり', () => {
  const src = read('scripts/check_journal_health.js');
  assert.match(src, /enforced === true && a\.lane_if_enforced === 'hold' && a\.published === false/);
  assert.match(src, /withheld/);
  let stdout;
  try {
    stdout = execFileSync('node', [path.join(ROOT, 'scripts', 'check_journal_health.js'), '--json', '--days', '2', '--skip-today'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    stdout = e.stdout; // 欠番があると終了コード1（それ自体は従来どおり）
  }
  const out = JSON.parse(stdout);
  assert.strictEqual(out.withheld_count, 0);
});
