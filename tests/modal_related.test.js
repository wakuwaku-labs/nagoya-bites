'use strict';
/**
 * tests/modal_related.test.js — I-16b（UI・UX改修）
 *
 * トップのクイックビュー（モーダル）の「似た店」を確かめる。
 *   ・選び方は店舗ページと同じ（scripts/lib/related_stores.js の NB-RELATED-CORE を index.html に写してある）
 *   ・写した内容とエリア・ジャンルの対応表がずれていないこと（ずれたら `node scripts/lib/related_stores.js --apply index.html`）
 *   ・全店で、index.html の中の関数と Node 側が同じ店を同じ順に選ぶこと
 *   ・描画: 見出し・注記・価格帯・理由。店名は逃がす。選べない店は区画ごと出さない
 *   ・索引は ALL_STORES が入れ替わったときだけ作り直す（TOP50 → 全件）
 *
 * 実ブラウザでの確認は PR の本文に書く（390px・1280px）。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const rel = require('../scripts/lib/related_stores.js');
const agp = require('../scripts/lib/area_genre_pages.js');

// ── index.html から取り出す ─────────────────────────────────────────────
function between(src, startMark, endMark) {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark);
  assert.ok(a >= 0 && b > a, `${startMark} の区画が見つからない`);
  assert.equal(src.split(startMark).length - 1, 1, `${startMark} は1つだけ`);
  assert.equal(src.split(endMark).length - 1, 1, `${endMark} は1つだけ`);
  return src.slice(a, b + endMark.length);
}
const EMBED = between(INDEX, '// NB-RELATED-EMBED:START', '// NB-RELATED-EMBED:END');
const GLUE = between(INDEX, '// NB-MODAL-RELATED:START', '// NB-MODAL-RELATED:END');
function extractEsc(src) {
  const a = src.indexOf('function nbEscHtml(s) {');
  assert.ok(a >= 0, 'nbEscHtml が見つからない');
  const b = src.indexOf('\n}\n', a);
  assert.ok(b > a, 'nbEscHtml の終わりが見つからない');
  return src.slice(a, b + 3);
}
const ESC = extractEsc(INDEX);

// vm の中で作られたオブジェクトは Object.prototype が別物（deepStrictEqual が通らない）ので、受け取った時点で複製する
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function makeEnv(allStores) {
  const els = {};
  const sandbox = {
    ALL_STORES: allStores || [],
    nbImage: (u, w) => `${u}?w=${w}`,
    nbSrcset: (u, ws) => ws.map((w) => `${u}?w=${w} ${w}w`).join(', '),
    nbStoreFigure: () => 'figure.svg',
    document: { getElementById: (id) => els[id] || (els[id] = { style: { display: 'none' }, innerHTML: '' }) },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext([ESC, EMBED, GLUE].join('\n'), ctx);
  return { ctx, sandbox };
}

const storesJson = path.join(ROOT, 'data', 'stores.json');
const HAVE_DATA = fs.existsSync(storesJson);
const REAL = HAVE_DATA ? JSON.parse(fs.readFileSync(storesJson, 'utf8')).filter((s) => s['公開フラグ'] !== 'FALSE') : [];

// ---------------------------------------------------------------- 写しがずれていない

test('埋め込み: index.html の NB-RELATED-EMBED は scripts/lib/related_stores.js とポリシーから今作るものと同じ', () => {
  assert.equal(EMBED, rel.renderEmbed(), 'node scripts/lib/related_stores.js --apply index.html を実行する');
  assert.equal(rel.applyToHtml(INDEX), INDEX, '--apply で変わらない');
});

test('埋め込み: エリア・ジャンルの対応表は、ポリシーの match と全件で同じ（normalizeArea / normalizeGenre と同じ引き方）', () => {
  const policy = agp.loadPolicy();
  const { ctx } = makeEnv([]);
  const t = plain(ctx.NB_REL_TABLES);
  assert.deepEqual(t, rel.tablesOf(policy));
  for (const a of policy.areas) for (const raw of a.match) {
    const got = ctx.NB_REL_CTX.areaOf({ 'エリア': ` ${raw} ` });
    const want = agp.normalizeArea(raw, policy);
    assert.deepEqual(plain(got), { slug: want.slug, label: want.label }, `エリア ${raw}`);
  }
  for (const g of policy.genres) for (const raw of g.match) {
    const got = ctx.NB_REL_CTX.genreOf({ 'ジャンル': raw });
    const want = agp.normalizeGenre(raw, policy);
    assert.deepEqual(plain(got), { slug: want.slug, label: want.label }, `ジャンル ${raw}`);
  }
  for (const raw of ['', '焼肉屋', 'constructor', '__proto__', 'hasOwnProperty', undefined, null]) {
    assert.equal(ctx.NB_REL_CTX.areaOf({ 'エリア': raw }), null, `エリア ${raw}`);
    assert.equal(ctx.NB_REL_CTX.genreOf({ 'ジャンル': raw }), null, `ジャンル ${raw}`);
  }
});

test('旧実装（ジャンル名を含む店をデータ順に12軒・見出し「似た雰囲気のお店」）は残っていない', () => {
  assert.ok(!INDEX.includes('似た雰囲気のお店'));
  assert.ok(!INDEX.includes('relStores'));
  assert.ok(INDEX.includes('nbRelatedHtml(r)'), 'openM は nbRelatedHtml を呼ぶ');
});

test('呼び出し側: openM は似た店の区画を nbRelatedHtml で作り、選べなければ区画ごと隠す', () => {
  const a = INDEX.indexOf('function openM(i, source) {');
  const b = INDEX.indexOf('// モーダル ヒーロー写真カルーセル', a);
  assert.ok(a >= 0 && b > a, 'openM の範囲');
  const src = INDEX.slice(a, b);
  assert.match(src, /nbRenderModalFeatures\(r\);/, '特集の区画（I-15b）も同じ場所で更新する');
  assert.match(src, /var relHtml=nbRelatedHtml\(r\);\s*relEl\.innerHTML=relHtml;\s*relEl\.style\.display=relHtml\?'':'none';/);
});

// ---------------------------------------------------------------- 全店で Node 側と同じ

test('実データ: 全店で、index.html の関数と Node 側が同じ店を同じ順・同じ理由で選ぶ（pos は ALL_STORES の番号）', { skip: !HAVE_DATA }, () => {
  assert.ok(REAL.length > 1000, `店が少なすぎる（${REAL.length}）`);
  const { ctx } = makeEnv(REAL);
  const nctx = rel.makeCtx();
  const ncells = rel.nbRelBuildIndex(REAL, nctx);
  const bcells = ctx.nbRelCells();
  let withPick = 0, mismatch = [];
  for (let i = 0; i < REAL.length; i++) {
    const s = REAL[i];
    const want = rel.nbRelPick(s, ncells, nctx, rel.NB_REL_MAX);
    const got = ctx.nbRelPick(s, bcells, ctx.NB_REL_CTX, ctx.NB_REL_MAX);
    if (!want || !got) { if (!!want !== !!got) mismatch.push(`${s['店名']}: 区画の有無`); continue; }
    withPick++;
    const a = want.items.map((x) => `${x.store['ホットペッパーID'] || x.store['店名']}|${x.reasons.join('/')}|${x.tier}`);
    const b = plain(got.items.map((x) => `${x.store['ホットペッパーID'] || x.store['店名']}|${x.reasons.join('/')}|${x.tier}`));
    if (JSON.stringify(a) !== JSON.stringify(b)) mismatch.push(`${s['店名']}: ${a.join(',')} / ${b.join(',')}`);
    for (const it of got.items) if (REAL[it.pos] !== it.store) mismatch.push(`${s['店名']}: pos がずれている ${it.pos}`);
    if (want.basis !== got.basis) mismatch.push(`${s['店名']}: 注記の根拠が違う`);
  }
  assert.ok(withPick > REAL.length * 0.9, `区画が出る店が少なすぎる（${withPick}/${REAL.length}）`);
  assert.deepEqual(mismatch, [], mismatch.slice(0, 5).join('\n'));
});

// ---------------------------------------------------------------- 描画

const mk = (n, extra) => Object.assign({ '店名': `店${n}`, 'エリア': '栄(ミナミ)/矢場町/大須/上前津', 'ジャンル': '居酒屋', '価格帯': '3001～4000円', '最寄駅': '栄', 'ホットペッパーID': `J${String(n).padStart(9, '0')}`, '写真URL': `https://example.test/p${n}.jpg` }, extra || {});

test('描画: 見出し・注記・カード（価格帯と理由）。同じ駅は「同じ○○駅」、予算が近ければ「予算が近い」', () => {
  const me = mk(0);
  const same = mk(1);                                   // 同じ駅・同じ価格帯
  const other = mk(2, { '最寄駅': '矢場町' });            // 別の駅・同じ価格帯
  const far = mk(3, { '最寄駅': '大須観音', '価格帯': '8001～10000円' }); // 別の駅・遠い価格帯
  const { ctx } = makeEnv([me, same, other, far]);
  const html = ctx.nbRelatedHtml(me);
  assert.match(html, /^<div class="m-section-title">似た条件のお店<\/div>/);
  assert.match(html, /<p class="modal-related-note">この店と同じ[^<]+の居酒屋のうち、予算が近い店を先に並べています。<\/p>/);
  const cards = [...html.matchAll(/<button class="modal-rsc"[\s\S]*?<\/button>/g)].map((m) => m[0]);
  assert.equal(cards.length, 3);
  // 並び: 同じ駅 → 別の駅（予算が近い）→ 予算が遠い
  assert.deepEqual(cards.map((c) => /modal-rsc-name">([^<]+)</.exec(c)[1]), ['店1', '店2', '店3']);
  assert.match(cards[0], /modal-rsc-reason">同じ栄駅・予算が近い</);
  assert.match(cards[1], /modal-rsc-reason">予算が近い</);
  assert.ok(!/modal-rsc-reason/.test(cards[2]), '理由が無い店には理由の行を出さない');
  assert.match(cards[0], /modal-rsc-meta">3001～4000円</);
  // 開く先は ALL_STORES の番号。モーダルの切り替えは swap で、計測の source は今までどおり modal_reco
  assert.match(cards[0], /onclick="closeM\(\{swap:true\}\);setTimeout\(function\(\)\{openM\(1,'modal_reco'\);\},50\)"/);
  assert.match(cards[2], /openM\(3,'modal_reco'\)/);
  assert.match(cards[0], /aria-label="店1の詳細を見る"/);
  assert.match(cards[0], /src="https:\/\/example\.test\/p1\.jpg\?w=480"/);
});

test('描画: 店名は逃がす。価格帯が無い店は価格の行を出さない。写真が無い店は図を使う', () => {
  const me = mk(0);
  const evil = mk(1, { '店名': '<img src=x onerror=alert(1)>"&', '価格帯': '', '写真URL': '' });
  const { ctx } = makeEnv([me, evil]);
  const html = ctx.nbRelatedHtml(me);
  assert.ok(!html.includes('<img src=x'), '店名のタグは逃がす');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;&quot;&amp;'));
  assert.ok(!/modal-rsc-meta/.test(html), '価格帯が無い店には価格の行を出さない');
  assert.match(html, /src="figure\.svg\?w=480"/);
});

test('描画: 最大6軒。選べない店（エリア群・ジャンルが決まらない・同じ条件の店が無い）は区画ごと出さない', () => {
  const stores = [mk(0)];
  for (let i = 1; i <= 10; i++) stores.push(mk(i));
  const { ctx } = makeEnv(stores);
  const html = ctx.nbRelatedHtml(stores[0]);
  assert.equal((html.match(/class="modal-rsc"/g) || []).length, 6);

  const lone = mk(99, { 'ジャンル': 'イタリアン・フレンチ' });
  const { ctx: c2 } = makeEnv([lone, mk(1)]);
  assert.equal(c2.nbRelatedHtml(lone), '', '同じ条件の店が無ければ空');
  const noGenre = mk(98, { 'ジャンル': '江戸前おまかせ鮨' });
  const { ctx: c3 } = makeEnv([noGenre, mk(1)]);
  assert.equal(c3.nbRelatedHtml(noGenre), '', 'ジャンルの群が決まらなければ空');
  const noArea = mk(97, { 'エリア': '東京' });
  const { ctx: c4 } = makeEnv([noArea, mk(1)]);
  assert.equal(c4.nbRelatedHtml(noArea), '', 'エリアの群が決まらなければ空');
});

test('描画: 閉店・一時休業の店は候補にしない', () => {
  const me = mk(0);
  const closed = mk(1, { '営業ステータス': 'CLOSED_PERMANENTLY' });
  const paused = mk(2, { '営業ステータス': 'CLOSED_TEMPORARILY' });
  const open = mk(3, { '営業ステータス': 'OPERATIONAL' });
  const { ctx } = makeEnv([me, closed, paused, open]);
  const html = ctx.nbRelatedHtml(me);
  assert.deepEqual([...html.matchAll(/modal-rsc-name">([^<]+)</g)].map((m) => m[1]), ['店3']);
});

// ---------------------------------------------------------------- 索引の作り直し

test('索引: ALL_STORES が同じ間は作り直さない。入れ替わったら（TOP50 → 全件）作り直す', () => {
  const small = [mk(0), mk(1)];
  const { ctx, sandbox } = makeEnv(small);
  let built = 0;
  const orig = ctx.nbRelBuildIndex;
  ctx.nbRelBuildIndex = function (a, b) { built++; return orig(a, b); };
  assert.ok(ctx.nbRelatedHtml(small[0]).includes('店1'));
  ctx.nbRelatedHtml(small[0]); ctx.nbRelatedHtml(small[1]);
  assert.equal(built, 1, '開くたびには作らない');

  // 全件に入れ替わる（loadStores の ALL_STORES = ...）。前の索引の店は残さない
  const full = [mk(0), mk(5), mk(6)];
  sandbox.ALL_STORES = full;
  const html = ctx.nbRelatedHtml(full[0]);
  assert.equal(built, 2, '入れ替わったら作り直す');
  assert.deepEqual([...html.matchAll(/modal-rsc-name">([^<]+)</g)].map((m) => m[1]).sort(), ['店5', '店6']);
});
