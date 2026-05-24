#!/usr/bin/env node
/**
 * audit_isnagoya_filter.js
 *
 * ISSUE-057: build.js の isNagoyaStore() 部分一致バグ再発防止ガード。
 *
 * 目的:
 *   - POSITIVE-FIRST 方式の isNagoyaStore() が、以前 silent-reject されていた
 *     名古屋確定アクセス文字列を正しく accept することを CI で検証する
 *   - NEGATIVE 側（他都市の暗黙除外）も regression していないことを検証する
 *
 * 失敗時は exit code 1（CI 落とす想定）。
 *
 * 使い方: `node scripts/audit_isnagoya_filter.js`
 */

'use strict';

// build.js から isNagoyaStore を再エクスポートする経路がないため、
// テスト用に再実装ではなく `eval` で同関数を取り出す軽量アプローチを取る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const buildSrc = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8');

// build.js を読み込んで、副作用を避けつつ isNagoyaStore のみ抽出する。
// 関数定義部分（const ACCESS_HARD_NEGATIVE = [...]; ... function isNagoyaStore(s) {...}）を
// 単独 sandbox で評価。最後に isNagoyaStore を context にエクスポート。
const sliceStart = buildSrc.indexOf('// アクセス欄で照合する非名古屋キーワード');
const sliceEnd = buildSrc.indexOf('module.exports', sliceStart);
const fnEnd = (() => {
  // function isNagoyaStore の閉じ } まで含めて切り出す
  const fnStart = buildSrc.indexOf('function isNagoyaStore', sliceStart);
  let depth = 0;
  let i = buildSrc.indexOf('{', fnStart);
  for (; i < buildSrc.length; i++) {
    const ch = buildSrc[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return sliceEnd;
})();

const fnSource = buildSrc.slice(sliceStart, fnEnd) + '\nthis.isNagoyaStore = isNagoyaStore;\nthis.norm = norm;\n';
// `norm` も同じ slice より前に定義されているので別途取り出す
const normStart = buildSrc.indexOf('function norm(');
const normEnd = buildSrc.indexOf('\n}', normStart) + 2;
const normSource = buildSrc.slice(normStart, normEnd);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(normSource + '\n' + fnSource, sandbox);
const isNagoyaStore = sandbox.isNagoyaStore;

// ──────────────────────────────────────────────────────────
// テストケース
// ──────────────────────────────────────────────────────────

const POSITIVE_CASES = [
  // ISSUE-057 の直接原因＝上前津駅。以前は `'津'` substring に hit して reject されていた
  { access: '名古屋市営地下鉄名城線「上前津駅」より徒歩3分', expected: true, label: '上前津駅' },
  { access: '地下鉄上前津駅 12番出口 徒歩1分', expected: true, label: '上前津駅(短縮)' },
  // その他の名古屋固有駅
  { access: '地下鉄東山線 池下駅 徒歩2分', expected: true, label: '池下駅' },
  { access: '地下鉄鶴舞線 大須観音駅 徒歩4分', expected: true, label: '大須観音駅' },
  { access: '名鉄瀬戸線 大曽根駅', expected: true, label: '大曽根駅' },
  { access: 'ささしまライブ駅すぐ', expected: true, label: 'ささしまライブ' },
  { access: '名古屋駅から徒歩10分', expected: true, label: '名古屋駅' },
  // POSITIVE と NEGATIVE が共存（例: チェーン店説明で複数支店名）→ POSITIVE 優先で accept
  { access: '矢場町駅 徒歩5分（系列：銀座本店）', expected: true, label: 'POSITIVE+NEGATIVE共存' },
];

const NEGATIVE_CASES = [
  // 三重県津市は引き続き除外（津駅は POSITIVE 不在 → NEGATIVE が動く）
  { access: '近鉄名古屋線 津駅 徒歩3分', expected: true, label: '津駅+名古屋線(POSITIVE勝ち)' }, // 「近鉄名古屋線」内に「名古屋」が含まれるため STEP 0 で true
  { access: 'JR紀勢本線 津駅 徒歩5分', expected: false, label: 'JR紀勢本線 津駅(純粋三重)' },
  { access: '銀座駅 徒歩1分', expected: false, label: '銀座駅' },
  { access: '梅田駅すぐ', expected: false, label: '梅田駅' },
  { access: '博多駅 徒歩3分', expected: false, label: '博多駅' },
  { access: 'JR京都駅 徒歩5分', expected: false, label: 'JR京都駅' },
  { access: '近鉄四日市駅 徒歩2分', expected: false, label: '近鉄四日市駅' },
];

let pass = 0;
let fail = 0;
const failures = [];

for (const c of [...POSITIVE_CASES, ...NEGATIVE_CASES]) {
  const got = isNagoyaStore({ アクセス: c.access, 価格帯: '', 店名: 'テスト', 備考: '', エリア: '', 都道府県: '' });
  if (got === c.expected) {
    pass++;
  } else {
    fail++;
    failures.push(`✗ [${c.label}] access="${c.access}" expected=${c.expected} got=${got}`);
  }
}

console.log(`isNagoyaStore audit: ${pass} pass / ${fail} fail (total ${pass + fail})`);
if (fail) {
  for (const line of failures) console.error(line);
  process.exit(1);
}
console.log('✅ 全ケース pass — POSITIVE-FIRST 方式が ISSUE-057 を防止しています');
