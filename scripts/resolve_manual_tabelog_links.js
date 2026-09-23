#!/usr/bin/env node
/**
 * resolve_manual_tabelog_links.js
 *
 * 手動キュレーション店（data/manual_stores.json）の「食べログURL」空欄を、
 * **検証を通ったものだけ**埋める。
 *
 * ■ なぜ必要か（2026-09-20・オーナー報告）
 *   カードの食べログアイコンが「その店の食べログページ」に飛ばない、という報告。
 *   調査の結果、index.html の tabelogSearchUrl() は 食べログURL が空のとき
 *   食べログの**キーワード検索ページ**にフォールバックする設計で、手動キュレーション
 *   店 171件のうち 129件が空欄だった（＝トップに出る話題店・編集部推薦カードの大半）。
 *   空欄の直接の原因は 2026-09-03 の実地監査（audit_store_link_identity.js）で、
 *   68件の食べログURLが無関係な別店・404 を指していたため一括で空欄化したこと。
 *   つまり「間違ったURLを消した」ところまでは正しく、「正しいURLを入れ直す」工程が
 *   無かった。本スクリプトがその工程にあたる。
 *
 * ■ 判定は検証できる事実だけで行う（CLAUDE.md 制約10）
 *   使う入力は次の3つだけ。いずれも第三者が同じURLを開いて検算できる。
 *     (1) 食べログ検索結果ページに実在する店舗ページURL
 *     (2) その店舗ページの <title> から取れる店名（→ namesMatch() で照合）
 *     (3) その店舗ページの JSON-LD PostalAddress（区・住所）
 *   使わない入力: スコア・確度などエージェントが自由に書ける自己申告値。
 *
 * ■ 2つのゲートを両方通ったものだけ採用する
 *   名前ゲート : scripts/lib/store_link_identity.js の bestMatch()（namesMatch()）。
 *                日次監査 audit_store_link_identity.js と**同じ判定器**を使うため、
 *                ここで書いたURLが翌日の監査で不一致になることは原理的に起きない。
 *   所在地ゲート: 我々の「アクセス」「エリア」「住所」から取れる区の集合と、
 *                食べログ側 JSON-LD の addressLocality を突き合わせる。
 *                チェーンの支店違い（例:「麺や 六三六」が別区の名駅店にぶつかる）は
 *                名前ゲートだけでは抜けてしまうため、これが必須。
 *                区が取れない店は駅名で代替し、どちらも取れなければ
 *                「支店サフィックスの付いていない完全一致」のみ許す。
 *
 *   さらに、両ゲートを通った候補が2件以上ある店は「どの店か決められない」として
 *   空欄のまま残す（例: 喫茶ユキ が東区と熱田区の2店にぶつかるケース）。
 *
 * ■ 通らなかった店は空欄のまま残す（取り繕わない）
 *   空欄のカードは従来どおり食べログのキーワード検索へフォールバックする。
 *   間違ったURLを入れるより、検索ページに送る方が読者に対して誠実。
 *
 * 使い方:
 *   node scripts/resolve_manual_tabelog_links.js --dry-run     # 書き込まず結果だけ表示
 *   node scripts/resolve_manual_tabelog_links.js               # 解決して manual_stores.json を更新
 *   node scripts/resolve_manual_tabelog_links.js --limit 20    # 件数を絞る（レート制限対策）
 *   node scripts/resolve_manual_tabelog_links.js --store "くろぎ"
 *   node scripts/resolve_manual_tabelog_links.js --force       # キャッシュ無視で再解決
 *   node scripts/resolve_manual_tabelog_links.js --retry-failed # 未解決だった店だけ再挑戦
 *   node scripts/resolve_manual_tabelog_links.js --report      # 解決状況の要約のみ（通信しない）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  fetchHtml, extractTitle, tabelogNameFromTitle, bestMatch, normalizeJpAddress,
  buildPlacesAddressIndex,
} = require('./lib/store_link_identity');
const { coreStoreName } = require('./lib/store_core_name');

const ROOT = path.resolve(__dirname, '..');
const MANUAL = path.join(ROOT, 'data', 'manual_stores.json');
const CACHE = path.join(ROOT, 'data', 'manual_tabelog_resolved.json');

// ─── CLI ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { dryRun: false, force: false, report: false, retryFailed: false, limit: null, store: null, delayMs: 1500 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--force') opts.force = true;
  else if (a === '--report') opts.report = true;
  else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
  else if (a === '--store') opts.store = argv[++i];
  else if (a === '--delay') opts.delayMs = parseInt(argv[++i], 10);
  else if (a === '--retry-failed') opts.retryFailed = true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 入出力 ──────────────────────────────────────────────────────────
function loadManual() {
  const raw = JSON.parse(fs.readFileSync(MANUAL, 'utf8'));
  return { raw, stores: Array.isArray(raw) ? raw : raw.stores };
}
function saveManual(raw) {
  fs.writeFileSync(MANUAL, JSON.stringify(raw, null, 2) + '\n');
}
function loadCache() {
  if (!fs.existsSync(CACHE)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); }
  catch (e) { console.warn('[cache]', e.message); return {}; }
}
function saveCache(c) {
  fs.writeFileSync(CACHE, JSON.stringify(c, null, 2) + '\n');
}
const keyOf = (s) => `${s['店名']}::${s['エリア'] || ''}`;

// 住所索引（同一性の証明に使う）は監査と共有する — scripts/lib/store_link_identity.js
const ADDRESS_INDEX = buildPlacesAddressIndex(ROOT);

// ─── 検索クエリ（店名から） ──────────────────────────────────────────
// 丸括弧の読みがな・【】の装飾だけ落とす。支店サフィックスは落とさない
// （落とすと別支店にぶつかりやすくなるため。検索は部分一致で拾ってくれる）
function searchQuery(name) {
  return String(name || '')
    .replace(/【[^】]*】/g, ' ')
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── 我々の所在地トークン ────────────────────────────────────────────
// 「アクセス」と「エリア」は食い違うことがある（実測: COFFEE KAJITA は
// アクセス欄が千種区・エリア欄が名東区で、正しいのはエリア欄の名東区。
// 喫茶ユキ はアクセス欄が中区・エリア欄が東区）。どちらか一方を正としても
// 外れるため、**両方を候補集合**として持ち、食べログ側の区がそのどれかに
// 一致すれば所在地の裏が取れたとみなす。集合のどれとも一致しない候補は
// 落とすので、チェーンの支店違い（別の区の支店）は従来どおり弾ける。
// 名古屋市の16区（この一覧に無い「◯◯区」は拾わない。「名古屋市千種区」から
// 「市千種区」を拾うような取りこぼし・取り違えを避けるため、正規表現ではなく
// 実在する区名の一覧で照合する）
const WARDS = ['千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区',
  '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区'];
// 「名古屋」は市名そのもので、どの店の住所にも現れるため駅名の手がかりに使わない
const GENERIC_STATION = new Set(['名古屋', '名古屋市', '地下鉄', '名鉄', 'JR']);

function ourLocality(store) {
  const access = String(store['アクセス'] || '');
  const addr = String(store['住所'] || '');
  const area = String(store['エリア'] || '');
  const wards = new Set();
  for (const src of [access, addr, area]) {
    // 長い区名から先に消し込む（「名東区」を「東区」として二重に数えないため）
    let rest = src;
    for (const w of [...WARDS].sort((a, b) => b.length - a.length)) {
      if (rest.includes(w)) { wards.add(`名古屋市${w}`); rest = rest.split(w).join(' '); }
    }
  }
  const stations = new Set();
  for (const m of (access + ' ' + area).matchAll(/([^\s（）()・･／\/、,]{2,10}?)駅/g)) {
    if (!GENERIC_STATION.has(m[1])) stations.add(m[1]);
  }
  if (wards.size) return { kind: 'ward', values: [...wards], stations: [...stations] };
  if (stations.size) return { kind: 'station', values: [...stations], stations: [...stations] };
  return { kind: 'none', values: [], stations: [] };
}

// ─── 食べログ側の所在地（JSON-LD PostalAddress） ─────────────────────
function tabelogAddress(html) {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const findAddress = (o) => {
    if (!o || typeof o !== 'object') return null;
    if (o.address && typeof o.address === 'object' && o.address.addressLocality) return o.address;
    for (const k of Object.keys(o)) {
      const r = findAddress(o[k]);
      if (r) return r;
    }
    return null;
  };
  for (const b of blocks) {
    let json;
    try { json = JSON.parse(b); } catch (e) { continue; }
    const a = findAddress(json);
    if (a) return a;
  }
  return null;
}

// 支店サフィックス（◯◯店 / 本店 / 別館 …）を持つか
function hasBranchSuffix(name) {
  const tokens = String(name || '').split(/[\s　]+/).filter(Boolean);
  const last = tokens[tokens.length - 1] || '';
  return /店$/.test(last) || /^(本店|総本店|別館|新館|分店|別邸)$/.test(last) || /号店$/.test(last);
}

/**
 * 所在地ゲート
 *  ward    … 食べログ側 addressLocality と一致すること（チェーンの支店違いを弾く主役）
 *  station … 住所文字列か最寄り駅表記に駅名が現れること
 *  none    … 我々に所在地の手がかりが無い場合。相手側に支店サフィックスが
 *            付いていなければ許容し、付いていれば「どの支店か決められない」ので落とす
 */
function localityGate(store, candidateName, html) {
  const our = ourLocality(store);
  const addr = tabelogAddress(html);
  const locality = addr ? String(addr.addressLocality || '').replace(/\s/g, '') : '';
  const street = addr ? String(addr.streetAddress || '') : '';
  const ourList = our.values.join('/');
  if (our.kind === 'ward') {
    if (!locality) return { ok: false, basis: 'no-address-on-page', our: ourList, theirs: '' };
    if (our.values.some((w) => w.replace(/\s/g, '') === locality)) {
      return { ok: true, basis: 'ward', our: ourList, theirs: locality };
    }
    // 区が食い違っても、住所表記に駅名（＝町名と一致することが多い）が出ていれば
    // 裏が取れたとみなす。照合先を住所フィールドに限るのは、ページ全文だと
    // 店名や周辺店の広告に含まれる地名を誤って拾うため
    const hay = `${locality}${street}`;
    const hit = our.stations.find((s) => hay.includes(s));
    if (hit) return { ok: true, basis: 'station', our: hit, theirs: locality };
    return { ok: false, basis: 'ward-mismatch', our: ourList, theirs: locality };
  }
  if (our.kind === 'station') {
    const hay = `${locality}${street}`;
    const hit = our.values.find((s) => hay.includes(s));
    return { ok: !!hit, basis: hit ? 'station' : 'station-mismatch', our: hit || ourList, theirs: locality };
  }
  // 所在地の手がかりが我々の側に無い場合だけ、店名の形で判断する
  const ourHasBranch = hasBranchSuffix(store['店名']);
  const theirsHasBranch = hasBranchSuffix(candidateName);
  return {
    ok: ourHasBranch || !theirsHasBranch,
    basis: ourHasBranch || !theirsHasBranch ? 'no-locality-evidence' : 'branch-ambiguous',
    our: '', theirs: locality,
  };
}

// ─── 検索 ────────────────────────────────────────────────────────────
async function searchCandidates(query) {
  const url = 'https://tabelog.com/aichi/rstLst/?sw=' + encodeURIComponent(query);
  const html = await fetchHtml(url);
  const re = /list-rst__rst-name-target[^>]*href="(https:\/\/tabelog\.com\/aichi\/A\d+\/A\d+\/\d+\/)"[^>]*>([^<]*)/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(html))) {
    if (!seen.has(m[1])) seen.set(m[1], { url: m[1], name: m[2].trim() });
  }
  return [...seen.values()];
}

// ─── 1店ぶん解決 ─────────────────────────────────────────────────────
// 検索に投げる語は2段。まず店名そのまま、当たらなければ業態語を落とした固有名詞だけ
// （実測: 「割烹 季節料理 花わさび」「鮨 結」は店名そのままだと検索結果が0件になる）。
// 判定ゲートは両方の段で同一なので、語を増やしても採用基準は緩まない。
function queryPlan(store) {
  const full = searchQuery(store['店名']);
  const core = searchQuery(coreStoreName(store['店名']));
  const out = [];
  if (full.length >= 2) out.push(full);
  if (core.length >= 2 && core !== full) out.push(core);
  return out;
}

async function resolveOne(store) {
  const plan = queryPlan(store);
  if (plan.length === 0) return { failed: true, reason: 'query-too-short' };

  let lastReason = 'no-candidates';
  const triedAll = [];
  for (const query of plan) {
    const r = await resolveWithQuery(store, query);
    if (!r.failed) return { ...r, tried: [...triedAll, ...(r.tried || [])] };
    triedAll.push(...(r.tried || []));
    lastReason = r.reason;
    // 「決められない」系（候補が複数通った／我々のデータが矛盾）は語を変えても
    // 結論が変わらないので、ここで打ち切る
    if (['ambiguous-candidates', 'our-locality-contradictory', 'branch-locality-mismatch', 'search-error'].includes(r.reason)) {
      return { ...r, tried: triedAll };
    }
    if (plan.length > 1) await sleep(opts.delayMs);
  }
  return { failed: true, reason: lastReason, query: plan[plan.length - 1], tried: triedAll };
}

async function resolveWithQuery(store, query) {
  let candidates;
  try {
    candidates = await searchCandidates(query);
  } catch (e) {
    return { failed: true, reason: 'search-error', error: e.message, retryable: true };
  }
  if (candidates.length === 0) return { failed: true, reason: 'no-candidates', query };

  const tried = [];
  const passed = [];
  const nameHits = [];
  const ourWardCount = ourLocality(store).kind === 'ward' ? ourLocality(store).values.length : 0;
  for (const cand of candidates.slice(0, 4)) {
    await sleep(opts.delayMs);
    // 1回の取得で名前ゲートと所在地ゲートの両方を判定する
    let html;
    try { html = await fetchHtml(cand.url); } catch (e) {
      tried.push({ url: cand.url, gate: 'fetch', reason: e.message });
      continue;
    }
    const title = extractTitle(html);
    const { name: matchedName, closed } = tabelogNameFromTitle(title);
    // 住所ゲート（最優先）— Google Places の住所と食べログの住所が一致したら、
    // 店名の表記ゆれに関係なくその店のページと確定できる
    const wantAddress = normalizeJpAddress(ADDRESS_INDEX.get(store['店名']) || '');
    const pageAddr = tabelogAddress(html);
    const gotAddress = pageAddr ? normalizeJpAddress(`${pageAddr.addressLocality || ''}${pageAddr.streetAddress || ''}`) : '';
    if (!closed && wantAddress && gotAddress && wantAddress === gotAddress) {
      return {
        url: cand.url, matchedName, title,
        sim: Number((bestMatch(store['店名'], matchedName).sim || 0).toFixed(3)),
        locality: { basis: 'address', our: wantAddress, theirs: gotAddress },
        query, tried,
      };
    }
    // 名前ゲート（日次監査 audit_store_link_identity.js と同じ判定器）
    const match = bestMatch(store['店名'], matchedName);
    if (!match.ok || closed) {
      tried.push({ url: cand.url, gate: 'name', reason: closed ? 'closed' : 'name-mismatch', sim: Number((match.sim || 0).toFixed(3)), matchedName });
      continue;
    }
    // 所在地ゲート
    const loc = localityGate(store, matchedName, html);
    nameHits.push({ url: cand.url, matchedName, title, sim: Number((match.sim || 0).toFixed(3)), loc });
    if (!loc.ok) {
      tried.push({ url: cand.url, gate: 'locality', reason: loc.basis, our: loc.our, theirs: loc.theirs, matchedName });
      continue;
    }
    passed.push({
      url: cand.url, matchedName, title,
      street: tabelogAddress(html) ? String(tabelogAddress(html).streetAddress || '') : '',
      sim: Number((match.sim || 0).toFixed(3)),
      locality: { basis: loc.basis, our: loc.our, theirs: loc.theirs },
    });
  }
  // 名前ゲートを通った候補が1件だけなら、その店だと特定できたとみなす
  // （愛知県内の検索結果で名前が一致する店が1軒しか無い＝支店の取り違えが起きない）。
  // 我々の「アクセス」と「エリア」は食い違うことがあるため（実測: COFFEE KAJITA は
  // アクセス=千種区・エリア=名東区で、正しいのはエリア側）、この場合は所在地ゲートを
  // 必須にしない。代わりに、名前一致が複数ある店（チェーンの支店など）では
  // 所在地ゲートを必須にし、かつ我々の区情報が食い違っている店は「決められない」
  // として空欄のまま残す。
  if (nameHits.length === 1) {
    const only = nameHits[0];
    // 所在地が食い違っていても許すのは「支店を持たない店で、我々の区情報の方が
    // 間違っている」ケースだけ。相手が支店（◯◯店）なら、我々の区と違う支店を
    // 掴んでいる可能性が残るので採らない（実測: 「ラーメン 山岡家 名古屋」は
    // エリア=港区＝宝神店のはずが、検索1位の太平通店（中川区）に当たっていた）。
    const branchRisk = hasBranchSuffix(only.matchedName) && !hasBranchSuffix(store['店名']);
    if (only.loc.ok) {
      return {
        url: only.url, matchedName: only.matchedName, title: only.title, sim: only.sim,
        locality: { basis: only.loc.basis, our: only.loc.our, theirs: only.loc.theirs },
        query, tried,
      };
    }
    if (!branchRisk) {
      return {
        url: only.url, matchedName: only.matchedName, title: only.title, sim: only.sim,
        locality: { basis: 'sole-name-match', our: only.loc.our, theirs: only.loc.theirs },
        query, tried,
      };
    }
    return { failed: true, reason: 'branch-locality-mismatch', query, tried };
  }
  if (passed.length === 0) return { failed: true, reason: 'no-verified-candidate', query, tried };
  if (ourWardCount > 1) {
    // 我々の区情報自体が食い違っている（例: アクセス=中区 / エリア=東区）状態で
    // 同名候補が複数ある。どちらを採っても根拠にならないので空欄のまま残す
    return { failed: true, reason: 'our-locality-contradictory', query, tried, passed: passed.map((p) => ({ url: p.url, matchedName: p.matchedName })) };
  }
  if (passed.length === 1) return { ...passed[0], query, tried };

  // 両ゲートを通った候補が複数ある（同じ区に同名チェーンの支店が複数ある等）。
  // 我々の「エリア」欄の地名・駅名が相手の住所か店名に現れる候補が**1つだけ**なら
  // それを採る。絞り切れなければ、どの店か決められないので空欄のまま残す。
  const our = ourLocality(store);
  const tokens = [String(store['エリア'] || '').trim(), ...our.stations].filter((t) => t && t.length >= 2);
  const narrowed = passed.filter((p) => tokens.some((t) => p.street.includes(t) || p.matchedName.includes(t)));
  if (narrowed.length === 1) {
    return { ...narrowed[0], narrowedBy: tokens.join('/'), query, tried };
  }
  return {
    failed: true, reason: 'ambiguous-candidates', query, tried,
    passed: passed.map((p) => ({ url: p.url, matchedName: p.matchedName, street: p.street })),
  };
}

// ─── レポート ────────────────────────────────────────────────────────
function report() {
  const { stores } = loadManual();
  const cache = loadCache();
  const has = stores.filter((s) => (s['食べログURL'] || '').trim()).length;
  const missing = stores.length - has;
  const failReasons = {};
  for (const v of Object.values(cache)) {
    if (v && v.failed) failReasons[v.reason] = (failReasons[v.reason] || 0) + 1;
  }
  console.log('手動キュレーション店の食べログURL:');
  console.log(`  掲載あり ${has} / ${stores.length}（空欄 ${missing}）`);
  console.log(`  キャッシュ ${Object.keys(cache).length}件`);
  if (Object.keys(failReasons).length) {
    console.log('  未解決の内訳:', JSON.stringify(failReasons));
  }
}

// ─── メイン ──────────────────────────────────────────────────────────
(async () => {
  if (opts.report) return report();

  const { raw, stores } = loadManual();
  const cache = loadCache();

  let targets = stores.filter((s) => !(s['食べログURL'] || '').trim());
  if (opts.store) targets = targets.filter((s) => String(s['店名']).includes(opts.store));
  if (!opts.force) {
    targets = targets.filter((s) => {
      const c = cache[keyOf(s)];
      if (!c) return true;
      if (c.url) return false;                 // 解決済み（未反映なら下で反映される）
      if (c.failed && c.retryable) return true; // 通信失敗は再挑戦する
      if (c.failed && opts.retryFailed) return true; // --retry-failed: 検索語を増やした等で再挑戦する
      return false;                            // ゲートで落ちた店は再挑戦しない
    });
  }
  if (opts.limit) targets = targets.slice(0, opts.limit);

  console.log(`対象 ${targets.length}件（空欄 ${stores.filter((s) => !(s['食べログURL'] || '').trim()).length}件中）`);

  let resolved = 0, failed = 0;
  for (const store of targets) {
    process.stdout.write(`・${store['店名']} … `);
    const r = await resolveOne(store);
    if (r.failed) {
      console.log(`✗ ${r.reason}`);
      cache[keyOf(store)] = { store: store['店名'], エリア: store['エリア'] || '', failed: true, reason: r.reason, retryable: !!r.retryable, tried: r.tried || [], checkedAt: new Date().toISOString() };
      failed++;
    } else {
      console.log(`✓ ${r.url}（${r.matchedName} / ${r.locality.basis}: ${r.locality.our || '—'}＝${r.locality.theirs || '—'}）`);
      cache[keyOf(store)] = {
        store: store['店名'], エリア: store['エリア'] || '',
        url: r.url, matchedName: r.matchedName, title: r.title,
        sim: Number((r.sim || 0).toFixed(3)), locality: r.locality,
        query: r.query, checkedAt: new Date().toISOString(),
      };
      resolved++;
    }
    if ((resolved + failed) % 10 === 0 && !opts.dryRun) saveCache(cache);
    await sleep(opts.delayMs);
  }

  // キャッシュ → manual_stores.json へ反映（解決済みで空欄のものだけ）
  let applied = 0;
  for (const s of stores) {
    if ((s['食べログURL'] || '').trim()) continue;
    const c = cache[keyOf(s)];
    if (c && c.url) { s['食べログURL'] = c.url; applied++; }
  }

  console.log(`\n解決 ${resolved}件 / 未解決 ${failed}件 / manual_stores.json へ反映 ${applied}件`);
  if (opts.dryRun) {
    console.log('--dry-run のため書き込みなし');
    return;
  }
  saveCache(cache);
  if (applied > 0) saveManual(raw);
  console.log('反映後は node build.js を実行してサイトへ反映すること');
})().catch((e) => { console.error(e); process.exit(1); });
