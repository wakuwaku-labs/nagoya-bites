'use strict';

/**
 * tests/index_mono_font.test.js — トップ（index.html）の CSS で、等幅書体を使ってよい所は
 * 数字・記号・欧文だけ（I-26d・U-86）
 *
 * 事故: デザインシステムは「等幅は数字と3語以内の欧文のみ。日本語には使わない」とするのに、トップの
 * CSS は日本語の文字（「エリア（区）」「特集を読む」「もっと見る」「この条件をシェア」など）を等幅（当時は
 * Web フォントの DM Mono）で出していた（実ブラウザで 19 のセレクター）。等幅の書体には日本語の字が無いので、
 * 利用者の環境ごとに別の等幅の和文（Windows では MS ゴシック）へ落ち、letter-spacing .2em と大文字化の指定で
 * 語が散らばっていた。2026-10-13（P-318）に Web フォントをやめ、等幅は端末の書体（var(--font-mono)）になったが、
 * 日本語に等幅を使わない決まりと、このテストの見方は変わらない。
 *
 * 動的な確かめは docs/qa/uiux-2026-10/dmmono.js（実ブラウザで状態ごとに数える）。ここでは静的に、
 * 「DM Mono か var(--font-mono) を指定する規則のセレクターは、数字・記号・欧文だけを出す下の表に載っている」
 * ことを見る（DM Mono の名前は、書き戻された直書きも拾うために残す）。新しく等幅の規則を足すときは、中身が数字・記号・欧文だけかを確かめてから表へ足す。
 * 読むのは手で保守している CSS（<style>）だけで、日次で作り直す LOCAL_STORES などは見ない。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/** DM Mono か var(--font-mono) を指定する規則のセレクターを集める（@media の入れ子の中も拾う） */
function monoSelectors(html) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (/^@font-face/i.test(sel)) continue;
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean);
    const fam = decls.find((d) => /^font-family\s*:/i.test(d));
    if (!fam || !/DM Mono|var\(--font-mono\)/i.test(fam)) continue;
    for (const one of sel.split(',')) out.push(one.replace(/\s+/g, ' ').trim());
  }
  return out;
}

// 数字・記号・欧文だけを出す所（中身を確かめた理由つき）
const ALLOWED_MONO = new Map([
  ['.back-to-magazine .btm-arrow', '矢印「←」'],
  ['.cmeta .cc-cell', '口コミ信頼度の段階の英字（S〜D）'],
  ['.card-rating .gs-src', '「Google」（欧文1語）'],
  ['.m-rate .num', '数字'],
  ['.m-trust-link .cc-tier', '段階の英字（SS〜D）'],
  ['.m-pg-pos', '「2 / 120」の数字と斜線（読み上げ用の「件」は見えない）'],
  ['.m-info-row .v .num', '数字'],
  ['.cross-check-box .cc-tier-badge', '段階の英字（S〜D）'],
  ['.cross-check-box .cc-score', '点数の数字'],
  ['.cross-check-box .cc-breakdown .cc-sig-score', '点数の数字'],
]);

test('index.html の CSS から、等幅書体の規則を読めている（読めなければこのテストが空振りする）', () => {
  const found = monoSelectors(INDEX);
  assert.ok(found.length >= 6, `等幅の規則が ${found.length} 件しか読めなかった`);
  for (const k of ['.cmeta .cc-cell']) assert.ok(found.includes(k), `${k} が読めていない`);
});

test('等幅書体（DM Mono）の規則は、数字・記号・欧文だけを出す表のセレクターだけ（日本語の文字には使わない）', () => {
  const bad = [...new Set(monoSelectors(INDEX).filter((s) => !ALLOWED_MONO.has(s)))];
  assert.deepEqual(bad, [], `日本語を出していないか確かめて、数字・記号・欧文だけなら ALLOWED_MONO へ。日本語が入るなら var(--font-body)・letter-spacing:0 にする: ${bad.join(' / ')}`);
});

test('読み取りの確かめ: 入れ子の @media の中・複数セレクター・コメントの中の指定を取り違えない', () => {
  const html = `<style>
    /* .commented{font-family:'DM Mono',monospace} */
    .a,.b .c{font-family:'DM Mono',monospace;color:red}
    @media(max-width:640px){.d{font-family:var(--font-mono);font-size:13px}.e{font-family:var(--font-body)}}
    @font-face{font-family:'DM Mono';src:url(x)}
    .f{color:blue}
  </style>`;
  assert.deepEqual(monoSelectors(html), ['.a', '.b .c', '.d']);
});
