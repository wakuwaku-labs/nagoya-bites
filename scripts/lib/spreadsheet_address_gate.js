'use strict';
/**
 * Google スプレッドシート経由の店を HotPepper の住所で検査し、県外の店を取り込まない（ISSUE-148）。
 *
 * build.js は HotPepper API から取った店には「住所に名古屋市を含む」検査をかけるが、スプレッドシート経由の
 * 行には住所の検査が無かった（スプレッドシートには住所の列が無く、都道府県の列は全行「愛知県」）。
 * スプレッドシートには「栄」の語で拾った他都市の店（釧路市栄町・〇栄ビル等）が入っており、ISSUE-103 で71店、
 * SEO-119 で23店を data/closed_stores.json で個別に外した。個別の除外は後追いで、同じ経路から別の店が
 * 入っても駅名監査（SEO-120）でしか気づけなかった。
 *
 * 判定は検証できる事実だけで行う（制約10）:
 *   - 行のホットペッパーIDの住所を、名古屋のエリアで取った店の住所から引き、無い ID だけ gourmet/v1 の
 *     id 指定（1回20件まで）で引く
 *   - 住所が取れて「愛知県」を含まない店だけを取り込まない
 *   - 住所が取れなかった店（API の失敗・応答なし・掲載終了で返らない）は外さない。ただし前の回に県外と
 *     確かめた店は、その記録（data/spreadsheet_address_gate.json）の住所で外し続ける。取得に失敗した日だけ
 *     店が戻り、店舗ページ・サイトマップに出て翌日また消える行き来を防ぐ（取得できなかった回は前の判定を
 *     消さない・ISSUE-163 と同じ考え方）
 */

const fs = require('fs');

const PREF = '愛知県';
const BATCH = 20; // gourmet/v1 の id は1回20件まで
const RECORD_DOC = [
  'ISSUE-148: Google スプレッドシート経由の店のうち、HotPepper の住所に「愛知県」を含まないため取り込まなかった店の記録。build.js が HotPepper の取得に成功した回だけ書く（判定器は scripts/lib/spreadsheet_address_gate.js）。',
  '住所は HotPepper（名古屋のエリアの店一覧か gourmet/v1 の id 指定）が返した値で、誰でも https://www.hotpepper.jp/str<ID>/ を開いて確かめられる。firstExcluded は初めて外した日、lastConfirmed はその住所を最後に取れた日（UTC の日付）。',
  '住所を取れなかった回は、ここにある店を前の住所で外し続ける。住所が愛知県と取れた店と、スプレッドシートから消えた行は次の回に外れる。',
];

const idOf = (r) => String((r && r['ホットペッパーID']) || '').trim();
const todayUtc = () => new Date().toISOString().slice(0, 10);

// HotPepper の店（API の shop）から ID → 住所 の表を作る
function addressMapFromShops(shops) {
  const m = new Map();
  for (const s of shops || []) if (s && s.id && s.address) m.set(s.id, s.address);
  return m;
}

/**
 * 住所の分からない ID を gourmet/v1 の id 指定で20件ずつ引く。
 * fetchJson(url) は JSON を返す関数（build.js の fetchJson。テストでは差し替える）。
 * 失敗した回の20件は分からないままにする（外さない）。エラー文に API キーを残さない
 */
async function lookupAddressesByIds(ids, { fetchJson, apiKey, base }) {
  const out = { addresses: new Map(), batches: 0, failedBatches: 0, errors: [] };
  const list = [...new Set((ids || []).filter(Boolean))];
  const redact = (msg) => (apiKey ? String(msg).split(apiKey).join('***') : String(msg));
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    out.batches++;
    try {
      const url = `${base}/gourmet/v1/?key=${apiKey}&id=${chunk.join(',')}&count=${BATCH}&format=json`;
      const data = await fetchJson(url);
      const results = data && data.results;
      if (!results) throw new Error('応答に results が無い');
      if (results.error) throw new Error(`API エラー: ${JSON.stringify(results.error).slice(0, 200)}`);
      for (const s of results.shop || []) if (s && s.id && s.address) out.addresses.set(s.id, s.address);
    } catch (e) {
      out.failedBatches++;
      out.errors.push(redact(e && e.message));
    }
  }
  return out;
}

/**
 * スプレッドシートの行を、取り込む行と外す行に分ける（純関数）。
 * 住所が分かっていて「愛知県」を含まない行だけを外す。住所が分からない行は残す
 */
function splitByPrefecture(rows, addresses) {
  const kept = [];
  const excluded = [];
  let unknown = 0;
  for (const r of rows || []) {
    const id = idOf(r);
    const addr = id ? addresses.get(id) : undefined;
    if (!addr) { unknown++; kept.push(r); continue; }
    if (!addr.includes(PREF)) excluded.push({ id, 店名: r['店名'] || '', 住所: addr });
    else kept.push(r);
  }
  return { kept, excluded, unknown };
}

/**
 * 前の回の記録を読む。ファイルが無いときは空。壊れているときは空にして error を返す（呼び出し側が警告を出す）
 */
function loadRecord(file) {
  const remembered = new Map();
  if (!fs.existsSync(file)) return { remembered, error: null };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const e of raw.excluded || []) if (e && e.id && e.住所) remembered.set(e.id, e);
    return { remembered, error: null };
  } catch (e) {
    return { remembered, error: e.message };
  }
}

/**
 * build.js から呼ぶ入口。名古屋のエリアで取った店（hpShops）の住所を先に使い、無い ID だけ API で引く。
 * API キーが無いとき（手元の実行）は引かない。住所が取れなかった ID は opts.remembered（前の回の記録）の住所を使う
 * 戻り値: { kept, excluded, record, stats }
 *   excluded[].fromMemory … この回は住所を取れず、前の回の記録で外した
 *   record … 次の回のための記録（writeRecord が書く）
 */
async function gateSpreadsheetRows(rows, hpShops, opts = {}) {
  const today = opts.today || todayUtc();
  const remembered = opts.remembered || new Map();
  const addresses = addressMapFromShops(hpShops);
  const rowIds = new Set((rows || []).map(idOf).filter(Boolean));
  const fromArea = (rows || []).filter((r) => addresses.has(idOf(r))).length;
  const missing = [...rowIds].filter((id) => !addresses.has(id));
  let lookup = { addresses: new Map(), batches: 0, failedBatches: 0, errors: [] };
  if (opts.apiKey && opts.fetchJson && missing.length) lookup = await lookupAddressesByIds(missing, opts);
  for (const [id, addr] of lookup.addresses) addresses.set(id, addr);

  // 前の回に県外と確かめた店: この回に住所が取れたらその住所で判定し直す。取れなければ前の住所で外し続ける
  const fromMemory = new Set();
  let released = 0;
  for (const [id, prev] of remembered) {
    if (!rowIds.has(id)) continue;
    if (addresses.has(id)) { if (addresses.get(id).includes(PREF)) released++; continue; }
    addresses.set(id, prev.住所);
    fromMemory.add(id);
  }

  const { kept, excluded, unknown } = splitByPrefecture(rows, addresses);
  const record = [];
  const seen = new Set();
  for (const x of excluded) {
    x.fromMemory = fromMemory.has(x.id);
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    const prev = remembered.get(x.id);
    record.push({
      id: x.id,
      店名: x.店名,
      住所: x.住所,
      firstExcluded: (prev && prev.firstExcluded) || today,
      lastConfirmed: x.fromMemory ? (prev && prev.lastConfirmed) || null : today,
    });
  }
  return {
    kept,
    excluded,
    record,
    stats: {
      rows: (rows || []).length,
      fromArea,
      lookedUp: missing.length,
      found: lookup.addresses.size,
      fromMemory: fromMemory.size,
      released,
      unknown,
      batches: lookup.batches,
      failedBatches: lookup.failedBatches,
      errors: lookup.errors,
    },
  };
}

// 次の回のための記録を書く（build.js は HotPepper の取得に成功した回だけ呼ぶ）
function writeRecord(file, result, today = todayUtc()) {
  const { errors, ...stats } = result.stats;
  const out = {
    _doc: RECORD_DOC,
    lastRun: today,
    stats: { ...stats, errors: errors.slice(0, 5) },
    excluded: result.record,
  };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

module.exports = { PREF, BATCH, addressMapFromShops, lookupAddressesByIds, splitByPrefecture, loadRecord, gateSpreadsheetRows, writeRecord };
