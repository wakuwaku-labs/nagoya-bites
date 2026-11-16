'use strict';
/**
 * 名古屋バイツの基本方針（本人 2026-11-16）を、文面を作る仕組みと投稿前の検査に渡す（Ondine #2041・docs/decisions/0068）。
 *
 * 正本: data/brand_policy/nagoya_bites.json（要点・確かめ・避ける言い回し）と docs/brand-policy/nagoya_bites.md（原文）。
 * どちらも SNS分析ツールの config/brand-policy/ から写した物。中身を変えるときは SNS分析ツール側と一緒に直す
 * （tests/brand_policy.test.js が、写し元がある端末では一致を確かめる）。
 *
 * 面（surface）ごとの止め方:
 *   post    … X の本文・返信、SNS の投稿案。避ける言い回しはすべて止める
 *   article … 日次ジャーナルの記事と、記事から機械で作る note。店カードの Google 評価の表示（★4.1 など。
 *             制約5で壊さない部品）は対象外にし、順位の語（ランキング・◯位）は警告だけにする。
 *             記事は「全国1位の産地」「コンテストの2位」など出典つきの事実を引くことがあり、止めると正しい記事まで
 *             止まるため（2026-10〜11 の記事 47 本で実測: 順位の語は 3 本・すべて事実の引用。行った・煽りの語は 0 本）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const POLICY_REL = 'data/brand_policy/nagoya_bites.json';
const ORIGINAL_REL = 'docs/brand-policy/nagoya_bites.md';

/** 避ける言い回しの種類。写した JSON には id が無いので、型を代表する語で見分ける。 */
const KINDS = [
  { id: 'visit', key: '実食', label: '行っていない店を行った・食べたように見せる言い方' },
  { id: 'ranking', key: 'ランキング', label: '点数・順位で並べる言い方' },
  { id: 'hype', key: '最強', label: '宣伝・大げさな言い切り' },
];

/** 記事の面で対象外にする部分（店カードの Google 評価の表示）。 */
const ARTICLE_ALLOW = /★\s*[0-9０-９][.．][0-9０-９]/g;
/** 記事の面で警告にとどめる種類。 */
const ARTICLE_WARN_ONLY = new Set(['ranking']);

const cache = new Map();
function loadBrandPolicy(root = ROOT) {
  if (cache.has(root)) return cache.get(root);
  // 試験などで別の作業場所（root）を渡されても、方針はこのリポジトリの1つだけ。その場所に写しが無ければ本体の写しを読む
  const file = fs.existsSync(path.join(root, POLICY_REL)) ? path.join(root, POLICY_REL) : path.join(ROOT, POLICY_REL);
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ng = (p.ngPatterns || []).map((n, i) => {
    const kind = KINDS.find((k) => String(n.pattern).includes(k.key));
    return { id: kind ? kind.id : `ng${i}`, label: kind ? kind.label : n.why, why: n.why, re: new RegExp(n.pattern, 'g') };
  });
  const out = { ...p, ng };
  cache.set(root, out);
  return out;
}

/**
 * 文面に出る避ける言い回し。返り値は { fail: [{id, words, why}], warn: [...] }。
 * surface: 'post'（既定）か 'article'。
 */
function brandFindings(text, { surface = 'post', root = ROOT } = {}) {
  const p = loadBrandPolicy(root);
  let s = String(text || '');
  if (surface === 'article') s = s.replace(ARTICLE_ALLOW, ' ');
  const fail = [];
  const warn = [];
  for (const n of p.ng) {
    n.re.lastIndex = 0;
    const words = [...new Set(s.match(n.re) || [])];
    if (!words.length) continue;
    const f = { id: n.id, words, why: n.why };
    if (surface === 'article' && ARTICLE_WARN_ONLY.has(n.id)) warn.push(f);
    else fail.push(f);
  }
  return { fail, warn };
}

/** 投稿前の検査で使う、止める理由の短い札（例: 'visit:実食,行ってきた'）。空なら通過。 */
function brandViolations(text, opts = {}) {
  return brandFindings(text, opts).fail.map((f) => `${f.id}:${f.words.join(',')}`);
}

/** 避ける言い回しの箇条（AI に渡す指示文の末尾に付ける）。 */
function brandNgLines(root = ROOT) {
  return loadBrandPolicy(root).ng.map((n) => {
    const words = String(n.re.source).split('|')
      .map((w) => w.replace(/\[0-9０-９\]\+?/g, '◯').replace(/\\\.\?\\s\?/g, '.').replace(/\?/g, ''))
      .filter((w) => !/[\\\[\]]/.test(w));
    return `- ${n.why}: ${words.join("・")} など`;
  });
}

/** AI に渡す指示文の節（要点と避ける言い回し）。 */
function brandPromptSection(root = ROOT) {
  const p = loadBrandPolicy(root);
  return [
    '## 名古屋バイツの基本方針（要点・本人 2026-11-16）',
    `原文は ${ORIGINAL_REL}。目的: ${p.mission}。`,
    ...(p.summary || []).map((s) => `- ${s}`),
    '',
    '## 方針で避ける言い回し（出たら投稿前の検査で止まる）',
    ...brandNgLines(root),
  ].join('\n');
}

module.exports = { loadBrandPolicy, brandFindings, brandViolations, brandPromptSection, brandNgLines, POLICY_REL, ORIGINAL_REL, KINDS };
