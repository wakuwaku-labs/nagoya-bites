'use strict';

/**
 * tests/store_page_trust_fold.test.js — 店舗ページの「口コミ信頼度の内訳」を畳む（I-14d・計画書 W6）
 *
 * 背景: 店舗ページでは口コミ信頼度の内訳（9 項目の行＋別枠 3 行＋注記）が約 900px の高さで本文の途中に開きっぱなしで、
 * 「観測できなかった」行が何行も続いたあとに「予約・情報を確認」の節が来ていた。段階・点数・助言の 1 行（と、いくつの
 * 項目を観測できたかの 1 行）だけを見せ、内訳は押すと開く `<details>` に入れる。トップのモーダル（index.html の
 * `.cross-check-box`）が既に同じ型で畳んでいるので、それにそろえる。
 *
 * 守ること（計画書 I-14・9.3 節）:
 *   - 中身は HTML に残す（畳むだけ。検索エンジンも画面の読み上げも読める。`open` を付けない＝既定は閉じる）
 *   - 観測できなかった行も消さない（行ごとに理由が違う。判定保留と書く事実を隠さない・制約7/10）
 *   - `<div class="trust-breakdown">` と、見出し `<h2>口コミ信頼度</h2>`（畳む前は `口コミ信頼度の内訳` の文字列）は、公開文言の
 *     監査（scripts/audit_trust_wording.js）が検査の範囲と「新しい形式のページか」を決めるのに使うので残す
 *
 * 読むのは生成器（gen-store-pages.js）が返す文字列と、その中のページ内 CSS だけ。日次で作り直す stores/ の生成物は見ない
 * （build.yml は npm test を再生成より前に回すので、生成物を読むテストは前の日の生成物を見てしまう）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GEN_SRC = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
const { buildTrustBreakdown, renderStorePage } = require(path.join(ROOT, 'gen-store-pages.js'));
const { loadPolicy } = require(path.join(ROOT, 'scripts/lib/trust_display.js'));
const { auditHtml } = require(path.join(ROOT, 'scripts', 'lib', 'inline_js.js'));
const P = loadPolicy();

/** 方針ファイルの検証項目からそのまま作る cc（crosscheck の 1 店分）。unobserved に入れた id の行は観測なし */
function fixtureCc(unobserved = []) {
  const cc = {};
  for (const chk of P.checks) {
    const observed = !unobserved.includes(chk.id);
    const node = { id: chk.part, score: observed ? 6 : 0, max: 10, reason: `理由:${chk.id}`, observed };
    if (chk.part) {
      (cc[chk.axis] = cc[chk.axis] || { score: 0, max: 20, reason: '', observed: true, parts: [] }).parts.push(node);
    } else {
      cc[chk.axis] = node;
    }
  }
  for (const m of P.meta) cc[m.axis] = { score: 5, max: 10, reason: `別枠:${m.axis}`, observed: true };
  return cc;
}
const RT = { score: 72, tier: 'B', headline: 'Google★4.3（39件）は、おおむね参考にできます。', coverage: { observed: '7', total: P.checks.length }, lastChecked: '2026-06-01' };

/** ブロックを <details> の外と中に分ける */
function split(html) {
  const i0 = html.indexOf('<details class="trust-details">');
  const i1 = html.indexOf('</details>');
  assert.ok(i0 > 0 && i1 > i0, '<details class="trust-details"> がある');
  return { outside: html.slice(0, i0) + html.slice(i1 + '</details>'.length), inside: html.slice(i0, i1 + '</details>'.length) };
}
const count = (s, re) => (s.match(re) || []).length;

// ── 1. 見える所と畳む所 ──

test('見えるのは 見出し・段階と助言の 1 行・観測できた項目の 1 行だけ。項目の行・注記・別枠は <details> の中', () => {
  const html = buildTrustBreakdown(fixtureCc(['s4', 's9']), RT);
  const { outside, inside } = split(html);
  assert.ok(outside.includes(`<h2>${P.name}</h2>`), `見出しは「${P.name}」`);
  assert.match(outside, /<p class="trust-headline">[\s\S]*cc-tier-B[\s\S]*72 \/ 100[\s\S]*Google★4\.3（39件）は、おおむね参考にできます。/, '段階・点数・助言の 1 行');
  assert.match(outside, /<p class="trust-meta-line">検証 7\/9項目 ・ Google口コミ取得日 2026-06-01<\/p>/, 'いくつの項目を観測できたか（段階の重みを読む手がかり）');
  for (const cls of ['trust-axis-row', 'trust-breakdown-intro', 'trust-meta-heading']) {
    assert.ok(!outside.includes(cls), `${cls} は畳む側（外に出さない）`);
    assert.ok(inside.includes(cls), `${cls} は <details> の中`);
  }
});

test('中身は HTML に残す: 項目の行 9 ＋ 別枠 3 の全部と、注記の読み方・算定方法のリンクが <details> の中にある', () => {
  const { inside } = split(buildTrustBreakdown(fixtureCc(), RT));
  assert.equal(count(inside, /class="trust-axis-row/g), P.checks.length + P.meta.length, '行数は検証項目＋別枠の数');
  for (const chk of P.checks) assert.ok(inside.includes(`理由:${chk.id}`), `行の理由が残る: ${chk.id}`);
  for (const m of P.meta) assert.ok(inside.includes(`別枠:${m.axis}`), `別枠の行が残る: ${m.axis}`);
  assert.ok(inside.includes(P.metaHeading), '別枠の見出し');
  assert.ok(inside.includes('href="../features/review-trust.html"') && inside.includes('href="../features/integrity-method.html"'), '読み方と算定方法のリンク');
});

test('観測できなかった行も消さない（判定保留と理由を、行ごとにそのまま書く）', () => {
  const { inside } = split(buildTrustBreakdown(fixtureCc(['s4', 's9', 's7d']), RT));
  assert.equal(count(inside, /trust-axis-unobserved/g), 3, '観測なしの行は 3 行のまま');
  for (const id of ['s4', 's9', 's7d']) assert.ok(inside.includes(`理由:${id}（${P.notObservedLabel}・採点に含めません）`), `${id} の理由と判定保留の注記`);
  assert.ok(!inside.includes('観測できなかった項目はまとめ'), '1 行にまとめて理由を落とさない');
});

// ── 2. 開閉の部品 ──

test('<details> は既定で閉じる（open を付けない）。<summary> が先頭で 1 つだけ、押す所に名前が付く', () => {
  const html = buildTrustBreakdown(fixtureCc(), RT);
  const { inside } = split(html);
  assert.equal(count(html, /<details\b/g), 1, '<details> は 1 つ');
  assert.ok(!/<details\b[^>]*\bopen\b/.test(html), 'open を付けない');
  assert.match(inside, /^<details class="trust-details">\s*<summary>/, '<summary> が <details> の最初の子');
  assert.equal(count(inside, /<summary\b/g), 1);
  const label = (inside.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1];
  assert.equal(label, `内訳を見る（${P.checks.length}つの検証項目）`, '押すと何が開くかが名前に出る（見出しは「' + P.name + '」。幅 320px でも 1 行に収まる長さ）');
  assert.ok(!/<(a|button|input)\b/.test(label), '押す所の中に、別の押す所を入れない');
});

test('公開文言の監査が頼る目印を残す: <div class="trust-breakdown"> で始まり、見出しは <h2>口コミ信頼度</h2>。監査もその見出しを新形式の目印に数える', () => {
  const html = buildTrustBreakdown(fixtureCc(), RT);
  assert.match(html.trim(), /^<div class="trust-breakdown">/);
  assert.ok(html.includes(`<h2>${P.name}</h2>`));
  const audit = fs.readFileSync(path.join(ROOT, 'scripts/audit_trust_wording.js'), 'utf8');
  assert.ok(audit.includes('<div class="trust-breakdown">') && audit.includes('<div class="links-section">'), '監査が検査の範囲を取る 2 つの目印');
  assert.ok(audit.includes('t.includes(`<h2>${P.name}</h2>`)'), '新形式の判定に、畳んだ後の見出しを数える（数えないと「旧形式」と見て検査を飛ばす）');
  assert.ok((audit.match(/isNewFormatStorePage/g) || []).length >= 3, '新形式の判定は 1 つの関数にして（定義 1 ＋ 使用 2）、旧名称の検査（A）と禁止語の検査（B-4）の両方が使う');
});

test('段階が「—」（判定材料不足）のページも同じ型で畳む。行が 1 つも作れない場合は何も出さない', () => {
  const na = { ...RT, tier: P.na.id, score: null, headline: P.headlineNoRating.replace('{advice}', P.na.advice) };
  const { outside, inside } = split(buildTrustBreakdown(fixtureCc(), na));
  assert.ok(outside.includes('cc-tier-NA') && outside.includes('— / 100'));
  assert.ok(inside.includes('trust-axis-row'));
  assert.equal(buildTrustBreakdown(null, RT), '');
  assert.equal(buildTrustBreakdown(fixtureCc(), null), '');
  assert.equal(buildTrustBreakdown({}, RT), '');
});

// ── 3. ページに組み込んだとき ──

test('renderStorePage: 実在の店の 1 ページで、畳んだ内訳が「予約・情報を確認」の前に 1 つだけ出る。インライン JS も壊さない', (t) => {
  const { placesKey } = require(path.join(ROOT, 'scripts/lib/places_key.js'));
  const crosscheck = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crosscheck.json'), 'utf8'));
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stores.json'), 'utf8'));
  const s = stores.find((x) => x['店名'] && x.reviewTrust && x.reviewTrust.t && crosscheck[placesKey(x)]);
  if (!s) return t.skip('crosscheck と reviewTrust を両方持つ店が data/stores.json に無い');
  const html = renderStorePage(s, 'J-test', [], []);
  const iTrust = html.indexOf('<div class="trust-breakdown">');
  const iLinks = html.indexOf('<div class="links-section">');
  assert.ok(iTrust > 0 && iLinks > iTrust, '口コミ信頼度は「予約・情報を確認」の前（監査の範囲の取り方と同じ並び）');
  assert.equal(count(html, /<details class="trust-details">/g), 1);
  const block = html.slice(iTrust, iLinks);
  assert.ok(block.includes('<summary>') && block.includes('trust-axis-row'));
  assert.deepEqual(auditHtml(html, { filename: 'render:trust-fold' }).violations, []);
});

// ── 4. CSS（ページ内 CSS）: トップのモーダルと同じ型・押す所は 44px 以上・文字は 13px 以上のトークン ──

test('ページ内 CSS: 開閉の見た目は ＋／－、押す所は 44px 以上、文字は var(--fs-sm)、標準の三角は出さない', () => {
  const rule = (sel) => {
    const i = GEN_SRC.indexOf(sel + '{');
    assert.ok(i >= 0, `${sel} の規則がある`);
    return GEN_SRC.slice(i, GEN_SRC.indexOf('}', i));
  };
  const sum = rule('.trust-details summary');
  assert.match(sum, /min-height:var\(--tap-min\)/, '押す所は 44px 以上');
  assert.match(sum, /font-size:var\(--fs-sm\)/, '文字はトークン（リテラルの px を直書きしない）');
  assert.match(sum, /list-style:none/);
  assert.match(sum, /cursor:pointer/);
  assert.match(rule('.trust-details summary::-webkit-details-marker'), /display:none/);
  assert.match(rule('.trust-details summary::before'), /content:'＋'/);
  assert.match(rule('.trust-details[open] summary::before'), /content:'－'/);
  assert.ok(!/\.trust-details summary[^{]*\{[^}]*outline:\s*none/.test(GEN_SRC), '見える枠（nb.css の :focus-visible）を消さない');
});
