#!/usr/bin/env node
// 全特集記事の掲載店を監査し、LOCAL_STORES（実在データ）に存在しない店を洗い出す。
// 「存在しない」＝必ずしも架空ではない（HotPepper 未掲載の実在有名店を含む）ため、
// 出力は「要・実在検証」の候補リストとして使う。
//
// 使い方: node scripts/audit_feature_stores.js [--json]
//   --json: /tmp/feature_audit.json に {file: [店名,...]} を書き出す

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const STORES_DIR = path.join(ROOT, 'stores');

// ISSUE-061 後続: NFKC で全角→半角統一（'錦３丁目' と '錦3丁目' を同一視）
const norm = (s) => String(s || '').normalize('NFKC').replace(/\s|　/g, '').replace(/&amp;/g, '&').toLowerCase();

const { loadStores } = require('./lib/load_stores');
function loadRealNames() {
  // ISSUE-015-P2: data/stores.json 優先・index.html フォールバック
  const L = loadStores();
  return new Set(L.map(s => norm(s['店名'])));
}
function loadRealRawNames() {
  return loadStores().map(s => String(s['店名'] || ''));
}

// ISSUE-064: HP名 vs 食べログ名の表記差を「識別力トークン照合」で吸収する。
//   例: 特集「炉端とおでん 呼炉凪来 ころなぎらい 大曽根店」
//       ⟺ LOCAL_STORES「呼炉凪来 ころなぎらい 大曽根駅前店」
//   業態接頭辞（炉端とおでん）と支店表記差（大曽根店 vs 大曽根駅前店）で
//   厳密一致も包含一致も外れるが、識別力トークン（呼炉凪来 / ころなぎらい）は完全一致する。
// 架空店検出力の維持: ①支店語（〜店で終わるトークン）と②汎用業態語は識別トークンから除外し、
//   ③同一実在店と「2つ以上」の識別トークンを共有して初めて実在扱いにする（generic 1語被りでは通さない）。
const GENERIC_STORE_TOKENS = new Set([
  '炉端とおでん', '炉端焼き', '炉端焼', '個室居酒屋', '完全個室', '海鮮居酒屋', '創作居酒屋',
  '大衆居酒屋', '個室ダイニング', 'ダイニングバー', '鉄板焼き', '鉄板焼', '中国料理', '本格中華',
  '創作料理', '和食処', '日本料理', '焼肉ホルモン', '炭火焼鳥', '炭火焼肉', 'もつ鍋',
].map(t => t.normalize('NFKC').toLowerCase()));
const tokenizeDistinctive = (s) =>
  String(s || '')
    .normalize('NFKC').toLowerCase()
    .replace(/&amp;/g, '&')
    .split(/[\s　]+/)
    .filter(Boolean)
    // 支店語（〜店）と汎用業態語は識別力なしとして除外
    .filter(t => t.length >= 3 && !/店$/.test(t) && !GENERIC_STORE_TOKENS.has(t));

function main() {
  const toJson = process.argv.includes('--json');
  const realNames = loadRealNames();
  const realNamesArr = [...realNames];
  // 実在店ごとの識別力トークン集合（ISSUE-064 トークン照合用・1回だけ構築）
  const realTokenSets = loadRealRawNames()
    .map(name => new Set(tokenizeDistinctive(name)))
    .filter(set => set.size > 0);
  const result = {};
  let totalSuspect = 0, totalBroken = 0;

  for (const f of fs.readdirSync(FEATURES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html')) {
    const src = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
    const names = [...src.matchAll(/class="(?:shop-name|store-name)"[^>]*>(?:<a[^>]*>)?([^<]+)/g)]
      .map(m => m[1].trim());
    // ISSUE-061 後続: 厳密一致に加え、部分一致（実在店名の prefix/suffix に suspect が含まれる）も許可
    // 例: 特集の「個室居酒屋 地鶏と地酒 酒肴日和 かしわや」⟺ LOCAL_STORES の同名+業態接尾辞付き版
    const isReal = (n) => {
      const nn = norm(n);
      if (realNames.has(nn)) return true;
      // どちらかが他方を完全に内包すれば実在扱い
      if (nn.length >= 4 && realNamesArr.some(r => r.includes(nn) || nn.includes(r))) return true;
      // ISSUE-064: 識別力トークンを同一実在店と2つ以上共有すれば表記差とみなして実在扱い
      const toks = tokenizeDistinctive(n);
      if (toks.length >= 2) {
        for (const rset of realTokenSets) {
          let shared = 0;
          for (const t of toks) if (rset.has(t)) shared++;
          if (shared >= 2) return true;
        }
      }
      return false;
    };
    const suspect = [...new Set(names.filter(n => !isReal(n)))];
    const broken = [...new Set(
      [...src.matchAll(/href="\.\.\/stores\/([A-Za-z0-9]+)\.html"/g)].map(m => m[1])
        .filter(id => !fs.existsSync(path.join(STORES_DIR, id + '.html')))
    )];
    if (suspect.length || broken.length) {
      result[f] = { suspect, broken };
      totalSuspect += suspect.length;
      totalBroken += broken.length;
    }
  }

  if (toJson) {
    const flat = {};
    for (const [f, d] of Object.entries(result)) flat[f] = d.suspect;
    fs.writeFileSync('/tmp/feature_audit.json', JSON.stringify(flat, null, 2));
    console.log('→ /tmp/feature_audit.json に書き出し');
  }
  for (const [f, d] of Object.entries(result)) {
    console.log(`■ ${f}`);
    if (d.suspect.length) console.log(`   実在不明(${d.suspect.length}): ${d.suspect.join(' / ')}`);
    if (d.broken.length) console.log(`   リンク切れ: ${d.broken.join(', ')}`);
  }
  console.log(`\n合計 実在不明掲載店: ${totalSuspect} / リンク切れ: ${totalBroken} / 対象特集: ${Object.keys(result).length}`);
  process.exit(totalSuspect > 0 ? 1 : 0);
}

main();
