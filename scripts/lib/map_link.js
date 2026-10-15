'use strict';
/**
 * scripts/lib/map_link.js
 *
 * Google マップへのリンクの作り方の唯一の情報源（MEO-005 の B2・計画書 docs/meo-plan-2026-10.md の 4.2 節・判断の記録 0046）。
 *
 * 形は Google の公式の形（https://developers.google.com/maps/documentation/urls/get-started・API キーは要らない）:
 *   https://www.google.com/maps/search/?api=1&query=<店名 住所>[&query_place_id=<place_id>]
 *   - query は「店名（読み仮名・装飾を外したもの）＋住所」。住所が無い店は、アクセスの中の住所 → エリア → 名古屋 で補う
 *   - query_place_id は、紐付けた Google の店舗情報が「確認済み」の店にだけ付ける（build.js が「地図確認」の欄を書く）。
 *     place_id が別の店を指していると、店名で検索しても Google はその place_id の店を開くため
 *
 * 店舗ページ（gen-store-pages.js）と、トップのカード・クイックビュー（index.html）が同じ関数を使う。
 * 判定の中身（NB-MAP-CORE の区画）は ES5・require 無しの純粋な関数だけで書き、index.html の `NB-MAP-EMBED` に
 * 書き写す。直接直さず `node scripts/lib/map_link.js --apply index.html` を実行する（`--check` はずれがあれば exit 1）。
 * cleanArea・cleanStoreName は、index.html が食べログ・Instagram などの検索にも使う（区画に移しただけで動きは同じ）。
 */
const fs = require('fs');
const path = require('path');

// NB-MAP-CORE:START
// エリアから1つ目の区切りだけを取り、半角カナを外す（"名古屋駅ﾒｲｴｷ/栄" → "名古屋駅"。半角カナの後ろの漢字は残るので "栄ｷﾀ錦/伏見丸の内" は "栄錦"）
// Hotpepperの middle_area.name は複数エリアがスラッシュ区切り＋半角カナで連結されており
// 外部検索（Instagram/食べログ/TikTok/X/Google）にそのまま渡すと一致しなくなるため整形する
function cleanArea(area) {
  if (!area) return '';
  // 半角カナ・記号で先に分割が壊れないよう、まず "/" で分割
  var first = String(area).split('/')[0] || '';
  // 半角カナ（ｱ-ﾝ等）を除去（例: "栄ｷﾀ" → "栄"）
  first = first.replace(/[｡-ﾟ]+/g, '').trim();
  return first;
}
// 店名から読み仮名やパレン括り読み・装飾を取り除く（外部サービス検索クエリ用）
// 例: "壺中天 こちゅうてん" → "壺中天" / "Cellarr（セラー）" → "Cellarr"
// 表示用の店名はそのままで、検索クエリだけクリーンにする
function cleanStoreName(name) {
  if (!name) return '';
  var s = String(name);
  // 1) パレン括り読み: （ひらがな/カタカナ/長音）/ (ひらがな/カタカナ/長音)
  s = s.replace(/[（(]\s*[぀-ゟ゠-ヿー]+\s*[）)]/g, ' ');
  // 2) ダッシュ括り読み: -ひらがな- や - ひらがな - 等
  s = s.replace(/[\-－‐‑–—]\s*[぀-ゟ゠-ヿー]+\s*[\-－‐‑–—]/g, ' ');
  // 3) 装飾ブラケット: 【...】
  s = s.replace(/【[^】]*】/g, ' ');
  // 4) 末尾の読み仮名トークン剥がし
  //    直前トークンが純粋漢字(1〜5字)で、ひらがな長 ≥ 漢字長 × 1.5 の場合のみ剥がす
  var tokens = s.split(/[\s　]+/).filter(Boolean);
  var isHira = function(t){ return /^[぀-ゟー]+$/.test(t); };
  var isKanji = function(t){ return /^[一-鿿々]+$/.test(t); };
  while (tokens.length >= 2) {
    var last = tokens[tokens.length - 1];
    var prev = tokens[tokens.length - 2];
    if (isHira(last) && isKanji(prev) && prev.length >= 1 && prev.length <= 5 && last.length >= prev.length * 1.5) {
      tokens.pop();
    } else {
      break;
    }
  }
  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}
var NB_MAP_BASE = 'https://www.google.com/maps/search/?api=1';
var NB_MAP_FIELD = '地図確認';
// 地図の検索に渡す住所: 掲載の住所 → アクセスの中の住所（手動の店は末尾の括弧に持つことが多い）→ 空
function nbMapAddress(store) {
  var addr = String((store && store['住所']) || '').replace(/\s+/g, ' ').trim();
  if (addr) return addr;
  var m = String((store && store['アクセス']) || '').match(/(?:愛知県)?(名古屋市[^\s（）()【】「」]+)/);
  return m ? m[1] : '';
}
// 店の地図リンク（公式の形）。place_id は「地図確認」の欄がある店だけに付ける
function nbMapUrl(store) {
  var s = store || {};
  var name = cleanStoreName(s['店名']) || String(s['店名'] || '').trim();
  var where = nbMapAddress(s) || cleanArea(s['エリア']) || '名古屋';
  var url = NB_MAP_BASE + '&query=' + encodeURIComponent((name + ' ' + where).trim());
  if (s[NB_MAP_FIELD] && s.placeId) url += '&query_place_id=' + encodeURIComponent(s.placeId);
  return url;
}
// 地図リンクの種類（計測の link_kind・MEO-006）: place_id つきなら 'place_id'、店名＋住所の検索だけなら 'search'
function nbMapLinkKind(url) {
  return /[?&]query_place_id=/.test(String(url || '')) ? 'place_id' : 'search';
}
// NB-MAP-CORE:END

const CORE_START = '// NB-MAP-CORE:START';
const CORE_END = '// NB-MAP-CORE:END';
const FIELD = NB_MAP_FIELD;
const FEATURE = 'map';

/**
 * place_id を地図リンクに付けてよい店に「地図確認」の欄を書き、それ以外の店から消す（build.js が日次で呼ぶ）。
 * 判定は scripts/lib/place_binding.js の gateFor（data/place_binding_policy.json の features.map）。紐付けの無い店は付けない。
 * @returns {object} 理由ごとの店の数（ok は欄を付けた店）
 */
function annotateMapLinks(stores, places, opts) {
  const pb = require('./place_binding');
  const ctx = pb.buildContext(stores, places, opts);
  const counts = { ok: 0 };
  for (const s of stores || []) {
    if (!s || !s['店名']) continue;
    delete s[FIELD];
    if (!s.placeId) continue;
    const b = pb.bindingOf(s, ctx);
    const g = pb.gateFor(FEATURE, b, ctx.policy);
    if (g.ok) {
      s[FIELD] = true;
      counts.ok++;
    } else {
      counts[g.reason] = (counts[g.reason] || 0) + 1;
    }
  }
  return counts;
}

function coreSource() {
  const src = fs.readFileSync(__filename, 'utf8');
  const a = src.indexOf(CORE_START);
  const b = src.indexOf(CORE_END);
  if (a < 0 || b < a) throw new Error('NB-MAP-CORE の区画が見つからない');
  return src.slice(a, b + CORE_END.length);
}

const EMBED_START = '// NB-MAP-EMBED:START';
const EMBED_END = '// NB-MAP-EMBED:END';
const EMBED_RE = /\/\/ NB-MAP-EMBED:START[\s\S]*?\/\/ NB-MAP-EMBED:END/;

function renderEmbed() {
  return [
    EMBED_START + '（scripts/lib/map_link.js が書く。ここを直接直さない: node scripts/lib/map_link.js --apply index.html）',
    coreSource(),
    EMBED_END,
  ].join('\n');
}

/** html の埋め込みを今の内容にそろえる。印が無ければ失敗する（置き場所は index.html に手で一度だけ作った） */
function applyToHtml(html) {
  if (!EMBED_RE.test(html)) throw new Error('埋め込み先（NB-MAP-EMBED の印）が見つからない');
  const block = renderEmbed();
  return html.replace(EMBED_RE, () => block);
}

module.exports = {
  FIELD, FEATURE, NB_MAP_BASE,
  cleanArea, cleanStoreName, nbMapAddress, nbMapUrl, nbMapLinkKind,
  annotateMapLinks, coreSource, renderEmbed, applyToHtml, EMBED_RE,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter((a) => !a.startsWith('--'));
  if ((!check && !args.includes('--apply')) || !files.length) {
    console.error('使い方: node scripts/lib/map_link.js --apply|--check <html...>');
    process.exit(2);
  }
  let stale = 0;
  for (const f of files) {
    const p = path.resolve(f);
    const html = fs.readFileSync(p, 'utf8');
    const next = applyToHtml(html);
    if (next === html) { console.log('変更なし: ' + f); continue; }
    if (check) { console.log('要更新: ' + f); stale++; continue; }
    fs.writeFileSync(p, next);
    console.log('更新: ' + f);
  }
  process.exit(stale ? 1 : 0);
}
