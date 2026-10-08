'use strict';
/**
 * scripts/lib/access_corrections.js
 *
 * data/access_corrections.json（SEO-119）を店舗配列に当てる。ホットペッパー側のアクセス文が
 * 誤っている名古屋の店を、確かめた文か空欄に差し替える。取り込み元の文が『元のアクセス』と
 * 一致するときだけ差し替えるので、取り込み元が直れば何もしなくなる（古い訂正で上書きしない）。
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', 'data', 'access_corrections.json');

function loadCorrections(file = FILE) {
  if (!fs.existsSync(file)) return [];
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (j.corrections || []).filter((c) => c && c['ホットペッパーID'] && typeof c['元のアクセス'] === 'string' && typeof c['アクセス'] === 'string');
}

/** 当てた件数を返す。stores は書き換える */
function applyAccessCorrections(stores, corrections = loadCorrections()) {
  const byId = new Map(corrections.map((c) => [c['ホットペッパーID'], c]));
  let applied = 0;
  for (const s of stores) {
    const c = byId.get(s && s['ホットペッパーID']);
    if (!c || String(s['アクセス'] || '') !== c['元のアクセス']) continue;
    s['アクセス'] = c['アクセス'];
    applied++;
  }
  return applied;
}

module.exports = { loadCorrections, applyAccessCorrections };
