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
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
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
  t = t.replace(/\([^)]*\)\s*$/, '').replace(/（[^）]*）\s*$/, '');
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
// opts.address … 我々が別経路（Google Places）で持っている住所。渡すと住所一致を
//                 同一性の証明として使う（名前の表記ゆれで落とさないため）
async function checkTabelogUrl(url, storeName, opts) {
  let html;
  try {
    html = await fetchHtml(url, opts);
  } catch (e) {
    return { ok: false, reason: 'fetch-error', error: e.message, url, storeName };
  }
  const title = extractTitle(html);
  if (!title) return { ok: false, reason: 'no-title', url, storeName };
  const { name: matchedName, closed } = tabelogNameFromTitle(title);
  const match = bestMatch(storeName, matchedName);
  // 住所が渡されていれば、名前の表記ゆれより強い証拠として先に照合する
  const wantAddress = normalizeJpAddress((opts && opts.address) || '');
  const pageAddress = wantAddress ? tabelogAddressFromHtml(html) : null;
  const gotAddress = pageAddress ? normalizeJpAddress(`${pageAddress.locality}${pageAddress.street}`) : '';
  const addressMatch = !!(wantAddress && gotAddress && wantAddress === gotAddress);
  const ok = (match.ok || addressMatch) && !closed;
  return {
    ok,
    reason: ok ? null : (closed ? 'closed' : 'name-mismatch'),
    via: addressMatch ? (match.ok ? 'name+address' : 'address') : (match.ok ? 'name' : null),
    sim: match.sim,
    matchedName,
    matchedAddress: gotAddress || null,
    closed,
    url,
    storeName,
    title,
  };
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

module.exports = {
  fetchHtml,
  buildPlacesAddressIndex,
  normalizeJpAddress,
  tabelogAddressFromHtml,
  extractTitle,
  tabelogNameFromTitle,
  hotpepperNameFromTitle,
  candidateNames,
  bestMatch,
  checkTabelogUrl,
  checkHotpepperId,
};
