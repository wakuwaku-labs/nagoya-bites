#!/usr/bin/env node
/**
 * 外部リンク（食べログURL / ホットペッパーID）の店名一致判定 — 唯一の判定器
 *
 * 既存の scripts/audit_manual_stores_links.js は URL の「形式」だけを見ており、
 * 「形式は個別店舗ページなのに、実際には別の店（閉店店舗を含む）を指しているURL」
 * を検出できなかった（2026-09-03・サラマンジェドゥカジノの食べログURLが、来店とは
 * 無関係な別の閉店店舗のページを指していた事故で発覚。ユーザー報告により発覚し、
 * 事前に検知する仕組みが無かった）。
 *
 * このモジュールは「そのURLが実際にその店を指しているか」を、URLを実際に取得して
 * ページの <title> に現れる店名と我々の店名を突き合わせることで検証する。
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力: 実際に fetch したページの <title> テキストだけ。
 *   使わない入力: 「たぶん合っている」等の自己申告。
 *
 * 同一性判定そのものは scripts/lib/store_name_match.js の namesMatch()
 * （架空店ブロックの名前ゲートと同じ判定器）を使う。「同じ店かどうか」を判定する
 * ロジックをこの用途向けにもう1本作らない。
 *
 * 追加の工夫: 我々の 店名 が「英語名（かな併記）」形式（例:
 * 「SALLE A MANGER DE KAJINO（サラマンジェ ドゥ カジノ）」）の場合、丸括弧の中身
 * だけを取り出した候補でも照合する。namesMatch() は日本語同士の表記ゆれ用に
 * 作られており、英語名 vs 外部サイトの日本語タイトルはそのままでは Dice 係数が
 * 低く出て誤って「不一致」判定になるため（2026-09-03 実測: 素の比較だと sim=0.5
 * で閾値 0.85 を割るが、丸括弧の中身だけを使うと sim=1 で一致する）。
 *
 * 【支店違いの見分け（ISSUE-157 で発覚・ISSUE-159 で対応・2026-10-09）】
 *   食べログの題名に支店名が無い店（例: 題名が「うなぎのしろむら」だけ）は、名前だけでは
 *   我々のどの支店（「丸の内店」「柳橋本店」）とも一致する。namesMatch() が支店名の食い違いを
 *   見るのは、双方に支店名が書かれているときだけだから。そこで、住所（opts.address）を渡された
 *   ときは compareJpAddress() でページの住所と比べ、名前が一致しても住所が different なら
 *   ok にしない（reason: branch-address-mismatch）。住所は HotPepper の掲載住所を優先する。
 *   Google Places の住所は、紐付け自体が別の支店を指す店（丸の内店に泉本店の place_id が
 *   付いていた・ISSUE-147）では一緒に間違えるため。
 *   残る限界: 住所を持たない店（手動キュレーション店で Places の紐付けも無い店）と、ページに
 *   住所が無い場合は、従来どおり名前だけで判定する。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { namesMatch } = require('./store_name_match');

// ─── HTTP ────────────────────────────────────────────────────────────
function fetchHtml(url, { timeoutMs = 20000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        res.resume();
        return fetchHtml(next, { timeoutMs, redirects: redirects + 1 }).then(resolve, reject);
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!m) return '';
  // HTML実体参照の主要なものだけ最低限デコード（&amp; 等）
  return m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// ─── サイトごとのタイトル → 店名 抽出 ───────────────────────────────
function tabelogNameFromTitle(title) {
  let t = title.replace(/\s*\|\s*食べログ\s*$/, '');
  // 末尾の " - エリア/ジャンル" を落とす（店名自体にハイフンを含むケースは稀なので許容）
  t = t.replace(/\s-\s[^-]+\/[^/]+$/, '');
  // 予約受付ページのタイトルは「<店名>のご予約」になる。食べログが付けた接尾辞で
  // あって店名の一部ではないため落とす（2026-09-20 実測: これを残すと
  // 「野ら田」対「野ら田のご予約」が sim=0.5 で不一致になり、正しいリンクが
  // 監査で不一致として報告されていた）。
  t = t.replace(/のご予約$/, '').trim();
  const closed = /^【閉店】/.test(t);
  t = t.replace(/^【閉店】/, '').trim();
  return { name: t, closed };
}

// ─── 住所による同一性証明 ────────────────────────────────────────────
// 店名の表記ゆれ（「鉄板焼 那古亭」対「那古亭」、「コメダ珈琲 本店」対
// 「コメダ珈琲店 本店」）は名前の類似度だけでは詰められない。一方、住所は
// Google Places（我々が placeId で保持）と食べログ（JSON-LD PostalAddress）の
// 両方から機械的に取れて、町名＋番地が完全一致すれば**同じ建物を指している**
// ことの証明になる。名前より強い証拠なので、一致したときは名前ゲートの結果に
// かかわらず「その店のページ」と判定する（制約10・誰でも同じ2つのページを
// 開いて検算できる）。逆に、住所が取れないとき・食い違うときは何も主張しない。
function normalizeJpAddress(input) {
  if (!input) return '';
  let s = String(input).normalize('NFKC');
  s = s.replace(/^日本[、,]?\s*/, '').replace(/〒\s*\d{3}-?\d{4}\s*/g, '');
  s = s.replace(/愛知県/g, '').replace(/名古屋市/g, '');
  s = s.replace(/^(千種|東|北|西|中村|中|昭和|瑞穂|熱田|中川|港|南|守山|緑|名東|天白)区/, '');
  s = s.replace(/[ー−‐–—―ｰ]/g, '-');
  s = s.replace(/丁目|番地|番|号/g, '-');
  s = s.replace(/\s+/g, ' ').trim();
  const town = (s.match(/^[^0-9]+/) || [''])[0].replace(/[\s-]+$/, '').trim();
  const rest = s.slice(town.length);
  // 番地は「数字と区切りだけが続く範囲」まで。以降のビル名・階数は比較に使わない
  const numPart = (rest.match(/^[\s0-9-]+/) || [''])[0];
  const nums = numPart.split(/[^0-9]+/).filter(Boolean);
  if (!town || nums.length === 0) return '';
  return `${town}${nums.join('-')}`;
}

// 食べログ店舗ページの JSON-LD から住所（区＋番地）を取り出す

// ─── 住所の比較（ISSUE-159） ─────────────────────────────────────────
// 食べログの題名に支店名が無い店は、名前だけではどの支店のページか決められない（ISSUE-157）。
// その見分けに住所を使う。比べるのは「市町村・区・町名・番地の数字」だけで、ビル名・階数は見ない。
// 表記ゆれ（字・大字・漢数字の丁目・ヶ/ケ/が・の/ノ・町の有無・枝番）は畳み、畳んでも決められない組は
// unknown にする。different と言うのは、市町村か区か町名か番地の頭の数字が、表記ゆれでは説明できない
// ほど違うときだけ（推測で「違う」と言わない・制約10）。

// 愛知県の市町村（郡の町村は郡名つき）。町名の途中にある「市」を市と取り違えないよう、名前で引く
const AICHI_MUNICIPALITIES = [
  '名古屋市', '豊橋市', '岡崎市', '一宮市', '瀬戸市', '半田市', '春日井市', '豊川市', '津島市', '碧南市',
  '刈谷市', '豊田市', '安城市', '西尾市', '蒲郡市', '犬山市', '常滑市', '江南市', '小牧市', '稲沢市',
  '新城市', '東海市', '大府市', '知多市', '知立市', '尾張旭市', '高浜市', '岩倉市', '豊明市', '日進市',
  '田原市', '愛西市', '清須市', '北名古屋市', '弥富市', 'みよし市', 'あま市', '長久手市',
  '愛知郡東郷町', '西春日井郡豊山町', '丹羽郡大口町', '丹羽郡扶桑町', '海部郡大治町', '海部郡蟹江町',
  '海部郡飛島村', '知多郡阿久比町', '知多郡東浦町', '知多郡南知多町', '知多郡美浜町', '知多郡武豊町',
  '額田郡幸田町', '北設楽郡設楽町', '北設楽郡東栄町', '北設楽郡豊根村',
].sort((a, b) => b.length - a.length); // 「北名古屋市」を「名古屋市」より先に当てる
const NAGOYA_WARD_RE = /^(千種|東|北|西|中村|中|昭和|瑞穂|熱田|中川|港|南|守山|緑|名東|天白)区/;
const KANJI_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 「三」→3・「十二」→12・「二十」→20（丁目に出る範囲）
function kanjiToInt(k) {
  if (!k) return NaN;
  if (k === '十') return 10;
  const i = k.indexOf('十');
  if (i < 0) return k.length === 1 ? (KANJI_DIGIT[k] || NaN) : NaN;
  const tens = i === 0 ? 1 : KANJI_DIGIT[k.slice(0, i)];
  const ones = i === k.length - 1 ? 0 : KANJI_DIGIT[k.slice(i + 1)];
  return tens && ones !== undefined ? tens * 10 + ones : NaN;
}

/**
 * 住所を { pref, city, ward, town, nums } に分ける。生の住所（HotPepper・Places・食べログの JSON-LD）でも、
 * normalizeJpAddress を通した後の形（キャッシュの matchedAddress）でも同じ結果に寄せる。
 * 取れないものは空文字・空配列（何も主張しない）
 */
function parseJpAddress(input) {
  if (!input) return null;
  let s = String(input).normalize('NFKC');
  s = s.replace(/^日本[、,]?\s*/, '').replace(/〒\s*\d{3}-?\d{4}\s*/g, '');
  // 空白は番地の区切りとして残す（「錦２　5-34」を「錦25-34」にしない）。町名の中の空白は後で落とす
  s = s.replace(/[ー−‐–—―ｰ]/g, '-').replace(/\s+/g, ' ').trim().replace(/^-+\s*/, '');
  let pref = '';
  const pm = s.match(/^(東京都|北海道|京都府|大阪府|[^0-9\s-]{2,3}県)/);
  if (pm) { pref = pm[1]; s = s.slice(pm[1].length).trim(); }
  let city = '';
  const cm = AICHI_MUNICIPALITIES.find((c) => s.startsWith(c));
  if (cm) { city = cm; s = s.slice(cm.length).trim(); }
  let ward = '';
  const wm = s.match(NAGOYA_WARD_RE);
  if (wm && (!city || city === '名古屋市')) { ward = wm[0]; s = s.slice(wm[0].length).trim(); }
  // 漢数字の丁目（「泉三丁目」）を数字に
  s = s.replace(/([一二三四五六七八九十]+)丁目/g, (m, k) => { const n = kanjiToInt(k); return Number.isNaN(n) ? m : `${n}丁目`; });
  s = s.replace(/丁目|番地|番|号/g, '-');
  let town = (s.match(/^[^0-9]+/) || [''])[0];
  const rest = s.slice(town.length);
  town = town.replace(/[\s-]+/g, '').replace(/大字|字/g, '').replace(/[ヶケがガ]/g, 'ケ').replace(/[のノ之]/g, 'ノ');
  const numPart = (rest.match(/^[0-9\s-]+/) || [''])[0];
  const nums = numPart.split(/[^0-9]+/).filter(Boolean).map((n) => String(Number(n)));
  // normalizeJpAddress を通した形では「泉三丁目24」が「泉三24」になっている。町名の末尾の漢数字は丁目として扱う
  const km = town.match(/[一二三四五六七八九十]+$/);
  if (km && km[0].length < town.length) {
    const n = kanjiToInt(km[0]);
    if (!Number.isNaN(n)) { town = town.slice(0, -km[0].length); nums.unshift(String(n)); }
  }
  return { pref, city, ward, town, nums };
}

function isSubsequence(short, long) {
  let i = 0;
  for (const ch of long) if (ch === short[i]) i++;
  return i === short.length;
}

// 町名が表記ゆれの範囲で似ているか（「金山町」と「金山」・「藤見ケ丘」と「藤ケ丘」・「比々野町」と「日比野町」）
function townsSimilar(a, b) {
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  if (isSubsequence(a, b) || isSubsequence(b, a)) return true;
  const x = new Set(a), y = new Set(b);
  let common = 0;
  for (const ch of x) if (y.has(ch)) common++;
  return common / Math.max(x.size, y.size) >= 0.6;
}

function numsPrefixEqual(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 2つの住所が同じ場所か。{ verdict: 'same' | 'different' | 'unknown', reason }
 *   different … 都道府県・市町村・区のどれかが違う／町名が同じで番地の頭の数字が違う／
 *               町名が似ても似つかず番地も違う
 *   unknown   … 町名の表記ゆれ（似ている町名で番地が前方一致）や、町名は違うが番地が完全に同じ組。
 *               どちらとも言えないので人の確認に残す
 */
function compareJpAddress(a, b) {
  const x = typeof a === 'string' ? parseJpAddress(a) : a;
  const y = typeof b === 'string' ? parseJpAddress(b) : b;
  if (!x || !y || !x.town || !y.town || !x.nums.length || !y.nums.length) return { verdict: 'unknown', reason: 'unparsable' };
  if (x.pref && y.pref && x.pref !== y.pref) return { verdict: 'different', reason: 'pref' };
  if (x.city && y.city && x.city !== y.city) return { verdict: 'different', reason: 'city' };
  if (x.ward && y.ward && x.ward !== y.ward) return { verdict: 'different', reason: 'ward' };
  if (x.town === y.town) {
    if (x.nums[0] === y.nums[0]) return { verdict: 'same', reason: 'town+block' };
    return { verdict: 'different', reason: 'block' };
  }
  if (numsPrefixEqual(x.nums, y.nums) && townsSimilar(x.town, y.town)) return { verdict: 'unknown', reason: 'town-notation' };
  if (x.nums.join('-') === y.nums.join('-') && x.nums.length >= 2) return { verdict: 'unknown', reason: 'same-number' };
  return { verdict: 'different', reason: 'town' };
}

function tabelogAddressFromHtml(html) {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const find = (o) => {
    if (!o || typeof o !== 'object') return null;
    if (o.address && typeof o.address === 'object' && o.address.addressLocality) return o.address;
    for (const k of Object.keys(o)) { const r = find(o[k]); if (r) return r; }
    return null;
  };
  for (const b of blocks) {
    let json;
    try { json = JSON.parse(b); } catch (e) { continue; }
    const a = find(json);
    if (a) return { locality: String(a.addressLocality || ''), street: String(a.streetAddress || '') };
  }
  return null;
}

function hotpepperNameFromTitle(title) {
  let t = title.replace(/\s*\|\s*ホットペッパーグルメ\s*$/, '');
  // ネット予約ができる店は「店名(エリア/ジャンル)＜ネット予約可＞」。末尾の「＜…＞」を先に外さないと
  // 丸括弧が末尾にならず、店名が短い店ほど正しいリンクを不一致にする（ISSUE-162）
  t = t.replace(/\s*＜[^＞]*＞\s*$/, '');
  // エリア名が「藤が丘(名古屋)」のように丸括弧を1段含むことがあるので、1段までの入れ子を許して外す
  t = t.replace(/\((?:[^()]|\([^()]*\))*\)\s*$/, '').replace(/（(?:[^（）]|（[^（）]*）)*）\s*$/, '');
  return { name: t.trim() };
}

// ─── 我々の店名の照合候補（丸括弧の中身も候補に足す） ───────────────
function candidateNames(storeName) {
  const out = [storeName];
  const re = /[（(]([^）)]+)[）)]/g;
  let m;
  while ((m = re.exec(storeName))) {
    if (m[1] && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

function bestMatch(storeName, matchedName) {
  let best = { ok: false, sim: 0, via: storeName };
  for (const cand of candidateNames(storeName)) {
    const r = namesMatch(cand, matchedName);
    if (r.ok) return { ...r, via: cand };
    if (r.sim > best.sim) best = { ...r, via: cand };
  }
  return best;
}

// ─── 検証本体 ────────────────────────────────────────────────────────
// opts.address … 我々が別経路で持っている住所（HotPepper の掲載住所を優先し、無ければ Google Places）。
//                 渡すと、(1) 住所一致を同一性の証明として使い（名前の表記ゆれで落とさないため）、
//                 (2) 名前が一致しても住所が違う（compareJpAddress が different）ページを
//                 別の支店・別の店として落とす（ISSUE-159）

/** 取得済みの食べログのページから判定する（純関数・テスト対象） */
function judgeTabelogHtml(html, storeName, opts) {
  const title = extractTitle(html);
  if (!title) return { ok: false, reason: 'no-title', storeName };
  const { name: matchedName, closed } = tabelogNameFromTitle(title);
  const match = bestMatch(storeName, matchedName);
  // 住所が渡されていれば、名前の表記ゆれより強い証拠として先に照合する
  const ourRaw = (opts && opts.address) || '';
  const wantAddress = normalizeJpAddress(ourRaw);
  const pageAddress = ourRaw ? tabelogAddressFromHtml(html) : null;
  const pageRaw = pageAddress ? `${pageAddress.locality}${pageAddress.street}` : '';
  const gotAddress = pageRaw ? normalizeJpAddress(pageRaw) : '';
  const addressMatch = !!(wantAddress && gotAddress && wantAddress === gotAddress);
  const compared = ourRaw && pageRaw ? compareJpAddress(ourRaw, pageRaw) : null;
  // 名前は一致しても、住所が別の場所を指していれば別の支店・別の店のページ（題名に支店名が無い店）
  const branchMismatch = match.ok && !addressMatch && !!compared && compared.verdict === 'different';
  const ok = (match.ok || addressMatch) && !closed && !branchMismatch;
  return {
    ok,
    reason: ok ? null : (closed ? 'closed' : (branchMismatch ? 'branch-address-mismatch' : 'name-mismatch')),
    via: addressMatch ? (match.ok ? 'name+address' : 'address') : (match.ok ? 'name' : null),
    sim: match.sim,
    matchedName,
    matchedAddress: gotAddress || null,
    matchedAddressRaw: pageRaw || null,
    addressVerdict: compared ? compared.verdict : null,
    addressReason: compared ? compared.reason : null,
    closed,
    storeName,
    title,
  };
}

async function checkTabelogUrl(url, storeName, opts) {
  let html;
  try {
    html = await fetchHtml(url, opts);
  } catch (e) {
    return { ok: false, reason: 'fetch-error', error: e.message, url, storeName };
  }
  return { ...judgeTabelogHtml(html, storeName, opts), url };
}

async function checkHotpepperId(id, storeName, opts) {
  const url = `https://www.hotpepper.jp/str${id}/`;
  let html;
  try {
    html = await fetchHtml(url, opts);
  } catch (e) {
    return { ok: false, reason: 'fetch-error', error: e.message, url, storeName };
  }
  const title = extractTitle(html);
  if (!title) return { ok: false, reason: 'no-title', url, storeName };
  const { name: matchedName } = hotpepperNameFromTitle(title);
  const match = bestMatch(storeName, matchedName);
  return {
    ok: match.ok,
    reason: !match.ok ? 'name-mismatch' : null,
    sim: match.sim,
    matchedName,
    url,
    storeName,
    title,
  };
}

// 店名 → Google Places 由来の住所（同一性の証明に使う）。
// placeId は data/stores.json、Places 応答は data/places_resolved.json にある。
// 解決器（resolve_manual_tabelog_links.js）と監査（audit_store_link_identity.js）が
// 同じ索引を共有することで、「解決器は住所で通したが監査は名前で落とす」ズレを防ぐ。
function buildPlacesAddressIndex(root) {
  const ROOT = root || path.resolve(__dirname, '..', '..');
  const index = new Map();
  let stores = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
    stores = Array.isArray(raw) ? raw : (raw.stores || []);
  } catch (e) { return index; }
  let places = {};
  try { places = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'places_resolved.json'), 'utf8')); }
  catch (e) { return index; }
  const byPlaceId = new Map();
  for (const v of Object.values(places)) {
    if (v && v.placeId && v.formatted_address) byPlaceId.set(v.placeId, v.formatted_address);
  }
  for (const s of stores) {
    const addr = s.placeId ? byPlaceId.get(s.placeId) : null;
    if (addr) index.set(s['店名'], addr);
  }
  return index;
}

// 支店サフィックス（◯◯店 / 本店 / 別館 …）を持つか。読み仮名の丸括弧
// （「東京竹葉亭 名古屋店 （とうきょうちくようてい）」）は外して見る
function hasBranchSuffix(name) {
  const tokens = String(name || '').replace(/[（(][^）)]*[）)]/g, ' ').split(/[\s　]+/).filter(Boolean);
  const last = tokens[tokens.length - 1] || '';
  return /店$/.test(last) || /^(本店|総本店|別館|新館|分店|別邸)$/.test(last) || /号店$/.test(last);
}
// 我々は支店を名乗っているのに、相手は支店名の無い名前か（「うなぎのしろむら 柳橋本店」対「うなぎのしろむら」）
function ourBranchOnly(ourName, theirName) {
  return hasBranchSuffix(ourName) && !hasBranchSuffix(theirName);
}

// 照合キャッシュ（data/store_link_identity_checked.json）の鍵。照合する監査（audit_store_link_identity.js）と
// キャッシュを読み直す監査（audit_tabelog_branch_mismatch.js）が同じ鍵を使う
function linkCacheKey(kind, url, storeName) {
  return crypto.createHash('md5').update(`${kind}|${url}|${storeName}`).digest('hex');
}

module.exports = {
  fetchHtml,
  linkCacheKey,
  buildPlacesAddressIndex,
  normalizeJpAddress,
  parseJpAddress,
  compareJpAddress,
  tabelogAddressFromHtml,
  extractTitle,
  tabelogNameFromTitle,
  hotpepperNameFromTitle,
  candidateNames,
  hasBranchSuffix,
  ourBranchOnly,
  bestMatch,
  judgeTabelogHtml,
  checkTabelogUrl,
  checkHotpepperId,
};
