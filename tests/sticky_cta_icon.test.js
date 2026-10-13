'use strict';
// I-36c（P-275）: スマホの追従バーで、幅 52px はアイコンだけのボタン（.modal-cta-icon）にだけ掛ける。
//
// 追従バーの導線は、ホットペッパーIDのある店が「帯＋アイコン2つ」、ない店で電話ありが「文字ボタン2つ」、
// どちらも無ければ「地図だけの帯」。アイコン用の幅 52px が文字つきの「電話する」「地図」にも掛かり、
// 予約先の無い店（5,004店中150店）では文字が縦に割れていた（I-36b の実ブラウザ確認で発見・main でも同じ）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX_HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const OPEN_M = INDEX_HTML.slice(INDEX_HTML.indexOf('function openM(i, source) {'));

// .m-sticky-cta を含む規則（セレクタ → 本文）を、index.html の CSS から全部集める
function stickyRules() {
  const rules = [];
  const re = /([^{}\n]*\.m-sticky-cta[^{}\n]*)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(INDEX_HTML))) rules.push({ selector: m[1].trim(), body: m[2] });
  return rules;
}

test('追従バー: 幅 52px の規則は、アイコンだけのボタン（.modal-cta-icon）にだけ掛かる', () => {
  const rules = stickyRules();
  // svg の大きさの規則は次のテストで見る（ここは、ボタンそのものの幅を決める規則）
  const widthRules = rules.filter((r) => !/svg/.test(r.selector) && /(^|;)\s*width\s*:/.test(r.body));
  assert.ok(widthRules.length >= 1, '追従バーのアイコン用の幅の規則が無い');
  for (const r of widthRules) {
    assert.strictEqual(r.selector, '.m-sticky-cta .modal-cta-icon',
      `幅を決める規則が ${r.selector} に掛かっている（文字つきの電話・地図ボタンまで押しつぶす）`);
  }
  const icon = rules.find((r) => r.selector === '.m-sticky-cta .modal-cta-icon');
  assert.ok(icon, '.m-sticky-cta .modal-cta-icon の規則が無い');
  const w = icon.body.match(/(^|;)\s*width\s*:\s*(\d+)px/);
  assert.ok(w && Number(w[2]) >= 44, 'アイコンだけのボタンの幅は 44px 以上（タップ対象）');
  assert.match(icon.body, /flex\s*:\s*0 0 auto/, '幅を固定するので伸び縮みさせない');
});

test('追従バー: アイコンの大きさ（20px）もアイコンだけのボタンにだけ掛かる', () => {
  const rules = stickyRules().filter((r) => /svg/.test(r.selector));
  assert.deepStrictEqual(rules.map((r) => r.selector), ['.m-sticky-cta .modal-cta-icon svg']);
  assert.match(rules[0].body, /width\s*:\s*20px/);
  assert.match(rules[0].body, /height\s*:\s*20px/);
});

function loadIndexCallHelpers() {
  const start = INDEX_HTML.indexOf('function nbCanCall(r)');
  const end = INDEX_HTML.indexOf('function openM(i, source) {');
  assert.ok(start > 0 && end > start);
  const sandbox = { NB_CALL_ICON_SVG: '<svg></svg>' };
  vm.createContext(sandbox);
  vm.runInContext(INDEX_HTML.slice(start, end), sandbox);
  return sandbox;
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
const classesOf = (html) => (html.match(/class="([^"]*)"/) || [, ''])[1].split(/\s+/);

test('電話のボタン: アイコンだけのときだけ modal-cta-icon が付き、文字つきには付かない', () => {
  const h = loadIndexCallHelpers();
  const store = { '店名': 'テスト酒場', placeId: 'PLACE1', '電話確認': '住所' };
  const icon = classesOf(h.nbCallBtnHtml(store, esc, true));
  const text = classesOf(h.nbCallBtnHtml(store, esc, false));
  assert.ok(icon.includes('modal-cta-call') && icon.includes('modal-cta-icon'), 'アイコンだけのボタンに modal-cta-icon が無い');
  assert.ok(text.includes('modal-cta-call') && !text.includes('modal-cta-icon'), '文字つきのボタンに modal-cta-icon が付いている');
});

test('地図のボタン: 追従バーのアイコン版にだけ modal-cta-icon が付き、文字つきの版には付かない', () => {
  const classOfVar = (name) => {
    const m = OPEN_M.match(new RegExp(`var ${name} = '<a [\\s\\S]*?class="([^"]*)"`));
    assert.ok(m, `${name} の定義が見つからない`);
    return m[1].split(/\s+/);
  };
  const iconBtn = classOfVar('mapIconBtn');
  const textBtn = classOfVar('mapBtnHtml');
  assert.ok(iconBtn.includes('modal-cta-gm') && iconBtn.includes('modal-cta-icon'), 'アイコン版の地図ボタンに modal-cta-icon が無い');
  assert.ok(textBtn.includes('modal-cta-gm') && !textBtn.includes('modal-cta-icon'), '文字つきの地図ボタンに modal-cta-icon が付いている');
});

test('追従バーの出し分け: ホットペッパーありはアイコン2つ、なしは文字ボタン（電話ありは電話＋地図、無ければ地図だけ）', () => {
  assert.match(OPEN_M, /var callIconBtn = nbCallBtnHtml\(r, ctaEsc, true\);/);
  assert.match(OPEN_M, /var callBtnHtml = nbCallBtnHtml\(r, ctaEsc, false\);/);
  assert.match(OPEN_M, /stickyEl\.innerHTML = \(hpId2 \? \(hpBtnHtml \+ callIconBtn \+ mapIconBtn\)\n\s+: nbCanCall\(r\) \? \(callBtnHtml \+ mapBtnHtml\)\n\s+: mapOnlyBtnHtml\) \+ callStatusHtml;/);
});
