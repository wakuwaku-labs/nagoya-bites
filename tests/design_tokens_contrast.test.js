'use strict';

/**
 * tests/design_tokens_contrast.test.js — 文字色のトークンが、小さい文字に必要な 4.5:1 を満たす（I-26c・U-74）
 *
 * 事故: --dim（rgba(28,28,26,.55)）は背景 --bg で 3.75:1、--gold2（#96720f）は --bg で 4.09:1 しかなく、
 * 小さい文字に必要な 4.5:1（WCAG 2.1 AA 1.4.3）に届かないまま、出典の注記（.source-note）・パンくず・フッターの
 * 見出し・メタ情報など「根拠を書く文」に全ページで使われていた。値は assets/css/nb.css の :root だけに書いてあるので、
 * ここで nb.css を読み、文字色のトークンと、それが載る背景のトークンのすべての組で比を計算する
 * （第三者が同じ式で検算できる事実だけを見る・CLAUDE.md 制約10）。トークンの値を変える日は、この表が通ることを確かめる。
 * 読むのは手で保守している nb.css だけで、日次で作り直す生成物は読まない（build.yml は npm test を再生成の前に回す）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'nb.css'), 'utf8');
const ROOT_BLOCK = /:root\s*\{([\s\S]*?)\n\}/.exec(CSS)[1];
const TOKENS = {};
for (const m of ROOT_BLOCK.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) TOKENS[m[1]] = m[2].trim();

/** トークン名 → { r, g, b, a }（var(--x) の別名をたどる） */
function color(name, depth = 0) {
  assert.ok(depth < 5, `var() の別名が深すぎる: ${name}`);
  const raw = TOKENS[name];
  assert.ok(raw, `nb.css の :root に --${name} が無い`);
  let m;
  if ((m = /^var\(--([a-z0-9-]+)\)$/.exec(raw))) return color(m[1], depth + 1);
  if ((m = /^#([0-9a-f]{3})$/i.exec(raw))) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
  if ((m = /^#([0-9a-f]{6})$/i.exec(raw))) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(raw))) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  assert.fail(`色として読めない: --${name}: ${raw}`);
}

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });

/** 文字色トークン fg を、背景トークン bg の上に置いたときの WCAG のコントラスト比 */
function ratio(fgName, bgName) {
  const bg = color(bgName);
  assert.equal(bg.a, 1, `背景のトークンは不透明: --${bgName}`);
  const flat = over(color(fgName), bg);
  const [hi, lo] = [lum(flat), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_SMALL = 4.5;

test('nb.css の :root から、背景と文字色のトークンが読める（読めなければこのテストが空振りする）', () => {
  for (const n of ['bg', 'bg2', 'surface', 'card', 'text', 'ink', 'muted', 'dim', 'gold', 'gold2']) {
    assert.ok(TOKENS[n], `--${n}`);
    assert.ok(color(n), `--${n}`);
  }
});

test('本文・補助の文字色（text／ink／muted／dim／gold）は、4つの背景（bg／bg2／surface／card）のどれの上でも 4.5:1 以上', () => {
  const bad = [];
  for (const fg of ['text', 'ink', 'muted', 'dim', 'gold']) {
    for (const bg of ['bg', 'bg2', 'surface', 'card']) {
      const r = ratio(fg, bg);
      if (r < AA_SMALL) bad.push(`--${fg} on --${bg} = ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(bad, []);
});

test('強調の文字色 --gold2（.art-accent・.art-num・.store-meta .score）は、bg／bg2／card の上で 4.5:1 以上', () => {
  // --surface の上には --gold2 の文字を置かない（置く部品が出たら、この組も 4.5:1 にする）
  const bad = [];
  for (const bg of ['bg', 'bg2', 'card']) {
    const r = ratio('gold2', bg);
    if (r < AA_SMALL) bad.push(`--gold2 on --${bg} = ${r.toFixed(2)}:1`);
  }
  assert.deepEqual(bad, []);
});

test('主ボタン（背景 --gold・文字 --bg）と、そのホバー（背景 --gold2）の文字も 4.5:1 以上', () => {
  // .nb-btn--primary / .store-link-reserve などは background:var(--gold);color:var(--bg)、:hover は background:var(--gold2)
  for (const bgToken of ['gold', 'gold2']) {
    const r = ratio('bg', bgToken);
    assert.ok(r >= AA_SMALL, `--bg の文字を --${bgToken} の背景に置く = ${r.toFixed(2)}:1`);
  }
});

test('濃淡の順は保つ: --muted（本文の補助）は --dim（注記）より濃く、--gold2 は --gold より明るい（ホバーで少し明るくなる）', () => {
  assert.ok(color('muted').a > color('dim').a, '--muted の不透明度 > --dim');
  assert.ok(lum(color('gold2')) > lum(color('gold')), '--gold2 は --gold より明るい');
});
