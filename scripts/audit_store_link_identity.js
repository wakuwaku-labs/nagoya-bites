#!/usr/bin/env node
/**
 * data/manual_stores.json の外部リンク（食べログURL / ホットペッパーID）が、
 * 実際にその店のページを指しているかを実地検証する。
 *
 * 既存の scripts/audit_manual_stores_links.js は URL の「形式」（個別店舗ページの
 * 形をしているか）だけを静的にチェックしており、「形式は正しいが実際には別の店
 * （閉店店舗を含む）を指すURL」は検出できなかった。判定器は scripts/lib/
 * store_link_identity.js の1本（実際にURLを fetch し、ページの店名と我々の店名を
 * scripts/lib/store_name_match.js の namesMatch() で突き合わせる）。
 *
 * 使い方:
 *   node scripts/audit_store_link_identity.js                 # 未検証/期限切れ分のみ検証
 *   node scripts/audit_store_link_identity.js --limit 20       # 動作確認用（先頭20件）
 *   node scripts/audit_store_link_identity.js --store "サラマンジェ"  # 店名部分一致で1店のみ
 *   node scripts/audit_store_link_identity.js --force          # キャッシュ無視で全件再検証
 *   node scripts/audit_store_link_identity.js --check          # 不一致があれば exit 1（CI向け）
 *   node scripts/audit_store_link_identity.js --scope all      # 手動店だけでなく掲載全店を対象にする
 *   node scripts/audit_store_link_identity.js --scope all --kind tabelog --all  # 食べログURLだけ全件検証
 *   node scripts/audit_store_link_identity.js --scope all --health  # 照合せず、種類ごとの照合の状況だけ（食べログを30日より長く取得できていなければ exit 1）
 *   node scripts/audit_store_link_identity.js --scope all --health --json  # 同じ判定を JSON で出す（link-audit-watchdog.yml が読む）
 *   node scripts/audit_store_link_identity.js --scope all --closures  # 照合せず、ホットペッパーの閉店の表示と掲載終了の件数だけ（閉店の表示があれば exit 1・夜間QA）
 *
 * キャッシュ（data/store_link_identity_checked.json）:
 *   判定が出た組（一致・別の店・閉店・支店違い・ページが無い＝HTTP 404/410）は MAX_AGE_DAYS の間は照合し直さない
 *   （食べログ/ホットペッパーへの外部アクセス回数を抑えるため）。不一致の組はキャッシュから
 *   毎回レポートに出す（キャッシュが「まだ直っていない不一致」を握りつぶさない）。
 *   ページを取得できなかった照合（404/410 以外の fetch-error・no-title）は、前に記録した判定を上書きしない。
 *   試した日時と理由だけを足し、RETRY_DAYS あけてから試し直す（ISSUE-163。上書きすると題名と
 *   住所の記録が消え、支店違い・別の店の監査がその組を数えなくなる＝偽の緑になる）。
 *   照合する順番は、一度も照合していない組が先、その後は最後に試した日が古い順
 *   （旧実装は店の並び順で、取得できない組が毎日の枠を使い、新しいリンクに回らなかった）。
 *   同じ種類で取得の失敗が BREAK_AFTER 件続いたら、その回のその種類はやめる（ISSUE-164。
 *   食べログは遅くとも 2026-10-05 から CI の取得に HTTP 403 を返す。回避はしない）。
 *   --check が exit 1 にするのは判定の出ている不一致だけ。取得できなかった組は不一致と数えない。
 *
 * 人が確かめた組（ISSUE-176）:
 *   data/tabelog_branch_reviewed.json の decision=keep（同じ店と確かめた店ID と食べログ URL の組）は、
 *   店名・支店の不一致（name-mismatch・branch-address-mismatch）を不一致に数えず、レポートの reviewedKeep に
 *   分けて出す（確かめ終えた組を毎日「要手動修正」と出し続けない）。閉店・ページが無いは確かめた後でも起きうるので
 *   keep の組でも不一致に数える。URL が変われば組が外れて再び数える。decision=remove は
 *   scripts/clear_broken_tabelog_links.js --reviewed が外し、decision=undecided は記録だけで何もしない。
 *
 * 閉店の兆し（ISSUE-174）:
 *   ホットペッパーのページが店名の上に【閉店】を出していれば判定 closed（題名は変わらない）。ページが無い
 *   （HTTP 404「掲載情報なし」）は今までどおり判定として扱い、レポートの closures で「掲載終了」として分けて数える。
 *   掲載終了は掲載の契約が終わっただけで営業を続ける店もあるので、閉店とは数えない。見つかった店は自動では外さない。
 *   ISSUE-170 と同じ確認（一次情報2つ以上・data/store_liveness_reviews.json）を経て data/closed_stores.json へ入れる。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { checkTabelogUrl, checkHotpepperId, buildPlacesAddressIndex, linkCacheKey: cacheKey } = require('./lib/store_link_identity');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_PATH = path.join(ROOT, 'data', 'manual_stores.json');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const CACHE_PATH = path.join(ROOT, 'data', 'store_link_identity_checked.json');
const REPORT_PATH = path.join(ROOT, 'data', 'store_link_identity_report.json');
const REVIEWED_PATH = path.join(ROOT, 'data', 'tabelog_branch_reviewed.json');

const MAX_AGE_DAYS = 60;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
// 取得できなかった組を試し直すまでの日数。断られている間に毎日同じ組を取りに行かない（ISSUE-163）
const RETRY_DAYS = 7;
const RETRY_MS = RETRY_DAYS * 24 * 60 * 60 * 1000;
// 同じ種類で取得の失敗がこの件数続いたら、その回のその種類の照合をやめる（ISSUE-164・403 を回避しない）
const BREAK_AFTER = 5;
// --health が赤にする、最後に取得できた日からの日数（ISSUE-164）
const HEALTH_MAX_DAYS = 30;
// 判定が出ていない（ページを取得できなかった）結果の理由
const FETCH_FAILURES = new Set(['fetch-error', 'no-title']);
// ページが無いと分かった応答は判定として扱う（取得を断られたのではない。旧実装と同じく不一致に数える）
const NOT_FOUND = /^HTTP 4(04|10)$/;
// 人が同じ店と確かめた組（decision=keep）で数えない理由。閉店・ページが無いは数える（ISSUE-176）
const KEEP_REASONS = new Set(['name-mismatch', 'branch-address-mismatch']);

function isFetchFailure(entry) {
  return !!entry && entry.ok === false && FETCH_FAILURES.has(entry.reason) && !NOT_FOUND.test(entry.error || '');
}

function timeOf(iso) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? t : 0;
}

// 最後に試した時刻（取得できなかった回も含む）
function lastTriedAt(entry) {
  return Math.max(timeOf(entry.checkedAt), timeOf(entry.lastAttemptAt));
}

/**
 * 照合する組を、照合する順に返す（純関数・ISSUE-163）。
 * - 判定が出ている組（一致も不一致も）は MAX_AGE_DAYS の間は照合し直さない
 * - 取得できなかった組は、最後に試してから RETRY_DAYS あける（判定が古くなった組の試し直しも同じ）
 * - 種類は opts.kindOrder の順（既定は食べログが先。別の店を指すリンクが実際に見つかってきたのは食べログ）
 * - 同じ種類の中では、一度も照合していない組が先。その後は最後に試した時刻が古い順（同じなら元の並び順）
 * targets: [{ key, kind, ... }]（key は照合キャッシュの鍵）
 */
function planChecks(targets, cache, now, opts = {}) {
  const kindOrder = opts.kindOrder || ['tabelog', 'hotpepper'];
  const rankOf = (kind) => (kindOrder.includes(kind) ? kindOrder.indexOf(kind) : kindOrder.length);
  const rows = [];
  targets.forEach((t, i) => {
    const entry = cache[t.key];
    if (!entry) { rows.push({ t, i, rank: rankOf(t.kind), tried: -Infinity }); return; }
    const tried = lastTriedAt(entry);
    if (!opts.force) {
      if (!isFetchFailure(entry) && now - timeOf(entry.checkedAt) < MAX_AGE_MS) return;
      if (now - tried < RETRY_MS) return;
    }
    rows.push({ t, i, rank: rankOf(t.kind), tried });
  });
  rows.sort((a, b) => a.rank - b.rank || a.tried - b.tried || a.i - b.i);
  return rows.map((r) => r.t);
}

/**
 * 照合の結果をキャッシュの組に書く形にする（純関数・ISSUE-163）。
 * 取得できなかった結果は、前に記録した判定（一致・別の店・閉店・支店違い・404）を上書きしない。
 * 上書きすると題名と住所の記録が消え、別の支店・別の店の監査がその組を数えなくなる
 */
function mergeCheckResult(prev, result, meta, nowIso) {
  if (isFetchFailure(result) && prev && !isFetchFailure(prev)) {
    return { ...prev, lastAttemptAt: nowIso, lastAttemptReason: result.reason, lastAttemptError: result.error || null };
  }
  return { ...result, ...meta, checkedAt: nowIso };
}

/**
 * キャッシュから現時点の不一致を集める（純関数・ISSUE-163/176）。今回照合していない過去の不一致も含む。
 * - 取得できなかった組は unfetched に分ける（判定が出ていないものを不一致と数えない）
 * - 人が同じ店と確かめた組（keptPairs に「店ID|URL」がある食べログ）の店名・支店の不一致は reviewedKeep に分ける
 * targets: [{ kind, key, url, storeName, area, storeId? }]
 */
function summarizeMismatches(targets, cache, keptPairs) {
  const out = { mismatches: [], unfetched: [], reviewedKeep: [] };
  for (const t of targets) {
    const cached = cache[t.key];
    if (!cached || cached.ok !== false) continue;
    const row = {
      店名: t.storeName,
      エリア: t.area,
      種別: t.kind,
      url: t.url,
      理由: cached.reason,
      検出タイトル: cached.matchedName || cached.title || null,
      エラー: cached.error || null,
      検証日: cached.checkedAt,
    };
    if (isFetchFailure(cached)) out.unfetched.push(row);
    else if (t.kind === 'tabelog' && KEEP_REASONS.has(cached.reason) && keptPairs && keptPairs.has(`${t.storeId || ''}|${t.url}`)) out.reviewedKeep.push(row);
    else out.mismatches.push(row);
  }
  return out;
}

// 人が同じ店と確かめた組（data/tabelog_branch_reviewed.json の decision=keep）。店ID と URL の組で持つ
function loadKeptPairs() {
  const raw = loadJson(REVIEWED_PATH, { reviews: [] });
  return new Set((raw.reviews || []).filter((r) => r.decision === 'keep').map((r) => `${r.id}|${r.url}`));
}

/**
 * 種類ごとの照合の状況（純関数・ISSUE-164）。外部へは問い合わせず、キャッシュの記録だけで数える。
 * links: リンクの数 / neverChecked: 一度も照合していない / unfetched: 取得できたことが無い /
 * lastFetchedAt: 最後に取得できた時刻（判定が出た照合の時刻の最大）
 */
function summarizeHealth(targets, cache) {
  const out = {};
  for (const t of targets) {
    const k = out[t.kind] || (out[t.kind] = { links: 0, neverChecked: 0, unfetched: 0, lastFetchedAt: null });
    k.links++;
    const entry = cache[t.key];
    if (!entry) { k.neverChecked++; continue; }
    if (isFetchFailure(entry)) { k.unfetched++; continue; }
    if (!k.lastFetchedAt || timeOf(entry.checkedAt) > timeOf(k.lastFetchedAt)) k.lastFetchedAt = entry.checkedAt;
  }
  return out;
}

/**
 * 照合の状況を判定する（純関数・ISSUE-164）。食べログを最後に取得できた日が maxDays より前
 * （または一度も取得できていない）なら ok=false。ホットペッパーは CI から取得できているので見ない。
 */
function judgeHealth(health, now, maxDays = HEALTH_MAX_DAYS) {
  const kinds = {};
  const stale = [];
  for (const [kind, h] of Object.entries(health)) {
    const days = h.lastFetchedAt ? Math.floor((now - Date.parse(h.lastFetchedAt)) / (24 * 60 * 60 * 1000)) : null;
    kinds[kind] = { ...h, daysSinceFetched: days };
    if (kind === 'tabelog' && h.links > 0 && (days === null || days > maxDays)) stale.push(kind);
  }
  return { ok: stale.length === 0, maxDays, stale, kinds };
}

/**
 * 掲載店の閉店の兆し（純関数・ISSUE-174）。外部へは問い合わせず、照合キャッシュの判定だけで数える。
 * hotpepper.closed   … ページが店名の上に【閉店】を出している（名前が合うページだけ。判定 closed）
 * hotpepper.notFound … ページが無い（HTTP 404/410「掲載情報なし」＝掲載終了）。閉店とは数えない
 */
function summarizeClosures(targets, cache) {
  const closed = [];
  const notFound = [];
  for (const t of targets) {
    if (t.kind !== 'hotpepper') continue;
    const entry = cache[t.key];
    if (!entry || entry.ok !== false) continue;
    const row = { 店名: t.storeName, エリア: t.area, url: t.url, 検証日: entry.checkedAt };
    if (entry.reason === 'closed') closed.push({ ...row, 表示: entry.shopState || null });
    else if (NOT_FOUND.test(entry.error || '')) notFound.push({ ...row, エラー: entry.error });
  }
  return { hotpepper: { closed, notFound } };
}

const args = process.argv.slice(2);
const opts = { limit: 40, force: false, store: null, delayMs: 4000, jitterMs: 2000, check: false, scope: 'manual', kind: 'all', health: false, closures: false, json: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (a === '--force') opts.force = true;
  else if (a === '--store') opts.store = args[++i];
  else if (a === '--delay') opts.delayMs = parseInt(args[++i], 10);
  else if (a === '--check') opts.check = true;
  else if (a === '--all') opts.limit = Infinity;
  else if (a === '--scope') opts.scope = args[++i];
  else if (a === '--kind') opts.kind = args[++i];   // tabelog / hotpepper / all
  else if (a === '--jitter') opts.jitterMs = parseInt(args[++i], 10);
  else if (a === '--health') opts.health = true;   // 照合せず、種類ごとの照合の状況だけを出す（ISSUE-164）
  else if (a === '--closures') opts.closures = true; // 照合せず、閉店の兆しの件数だけを出す（ISSUE-174）
  else if (a === '--json') opts.json = true;       // --health・--closures の結果を JSON で出す
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function classifyTabelogFormat(url) {
  if (!url || !url.trim()) return 'missing';
  if (/tabelog\.com\/[a-z]+\/[A-Z0-9]+\/[A-Z0-9]+\/\d{5,}\/?$/i.test(url)) return 'direct';
  return 'other';
}

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

// 検証対象の母集団
//   manual … data/manual_stores.json（手動キュレーション店・従来の既定）
//   all    … data/stores.json（サイトに載る全店。手動店もここに含まれる）
// all を足したのは、Hot Pepper 由来店の食べログURLが scripts/resolve_tabelog.js の
// 旧スコアリング（ページ内に店名トークンが出れば採用）で機械的に埋められており、
// 一度も実地検証を通っていなかったため（2026-09-20・30件の等間隔サンプルで
// 5件が別店・別支店を指していた）。
function loadTargetsSource(scope) {
  if (scope === 'all') {
    const raw = loadJson(STORES_PATH, []);
    const arr = Array.isArray(raw) ? raw : (raw.stores || []);
    return arr;
  }
  const raw = loadJson(MANUAL_PATH, { stores: [] });
  return Array.isArray(raw.stores) ? raw.stores : [];
}

async function main() {
  if (!['manual', 'all'].includes(opts.scope)) {
    console.error(`--scope は manual / all のいずれか（指定: ${opts.scope}）`);
    process.exit(2);
  }
  const stores = loadTargetsSource(opts.scope);
  const cache = loadJson(CACHE_PATH, {});
  // 我々の住所。食べログ側の住所と一致すれば同じ建物＝同じ店の証明になるため、店名の
  // 表記ゆれ（「鉄板焼 那古亭」対「那古亭」）で誤って不一致にしないよう判定器へ渡す。
  // 名前が一致しても住所が違えば別の支店・別の店として落とす（ISSUE-159）。HotPepper の
  // 掲載住所（stores.json の「住所」）を優先し、無い店（手動キュレーション店）だけ Google Places
  // の住所を使う。Places は紐付け自体が別の支店を指す店がある（ISSUE-147）
  const addressIndex = (opts.health || opts.closures) ? new Map() : buildPlacesAddressIndex(ROOT);

  let targets = [];
  for (const s of stores) {
    const name = s['店名'] || '';
    if (opts.store && !name.includes(opts.store)) continue;
    const area = s['エリア'] || '';
    if (opts.kind !== 'hotpepper' && classifyTabelogFormat(s['食べログURL']) === 'direct') {
      const url = s['食べログURL'];
      targets.push({ kind: 'tabelog', url, key: cacheKey('tabelog', url, name), storeName: name, area, address: s['住所'] || '', storeId: s['ホットペッパーID'] || '' });
    }
    if (opts.kind !== 'tabelog' && s['ホットペッパーID'] && s['ホットペッパーID'].trim()) {
      const id = s['ホットペッパーID'].trim();
      const url = `https://www.hotpepper.jp/str${id}/`;
      targets.push({ kind: 'hotpepper', id, url, key: cacheKey('hotpepper', url, name), storeName: name, area });
    }
  }

  if (opts.health) return reportHealth(summarizeHealth(targets, cache));
  if (opts.closures) return reportClosures(summarizeClosures(targets, cache), { exitOnClosed: true });

  console.log(`=== 外部リンク実地検証 (scope=${opts.scope} / 対象候補 ${targets.length}件) ===`);

  const plan = planChecks(targets, cache, Date.now(), { force: opts.force });
  const run = {};
  const streak = {};
  let checkedCount = 0;

  for (let i = 0; i < plan.length && checkedCount < opts.limit; i++) {
    const t = plan[i];
    const r = run[t.kind] || (run[t.kind] = { attempted: 0, fetched: 0, stopped: false });
    if (r.stopped) continue;

    let result;
    if (t.kind === 'tabelog') {
      result = await checkTabelogUrl(t.url, t.storeName, { address: t.address || addressIndex.get(t.storeName) || '' });
    } else {
      result = await checkHotpepperId(t.id, t.storeName);
    }
    cache[t.key] = mergeCheckResult(cache[t.key], result, { kind: t.kind, area: t.area }, new Date().toISOString());
    checkedCount++;
    r.attempted++;

    const mark = result.ok ? '✅' : '❌';
    console.log(`${mark} [${t.kind}] ${t.storeName} (${t.area}) — ${result.ok ? `一致 (sim=${result.sim})` : `${result.reason}${result.matchedName ? ` 「${result.matchedName}」` : ''}${result.error ? `: ${result.error}` : ''}`}`);

    if (isFetchFailure(result)) {
      streak[t.kind] = (streak[t.kind] || 0) + 1;
      if (streak[t.kind] >= BREAK_AFTER) {
        r.stopped = true;
        console.log(`⏸ [${t.kind}] 取得できない照合が ${BREAK_AFTER} 件続いた（${result.error || result.reason}）。今回の ${t.kind} の照合はここでやめる`);
      }
    } else {
      streak[t.kind] = 0;
      r.fetched++;
    }

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    if (checkedCount < opts.limit && i < plan.length - 1) {
      await sleep(opts.delayMs + Math.floor(Math.random() * opts.jitterMs));
    }
  }

  console.log('');
  console.log(`照合: ${checkedCount}件 / 照合しない（判定が${MAX_AGE_DAYS}日以内・取得できなかった組は${RETRY_DAYS}日あける）: ${targets.length - plan.length}件 / 次回へ持ち越し: ${Math.max(plan.length - checkedCount, 0)}件`);
  for (const [kind, r] of Object.entries(run)) {
    console.log(`  ${kind}: 試した ${r.attempted}件・取得できた ${r.fetched}件${r.stopped ? '・取得できない照合が続いたので途中でやめた' : ''}`);
  }

  // レポート: キャッシュ全体から現時点の不一致を集計（今回検証していない過去の不一致も含む）。
  // 取得できなかった組と、人が同じ店と確かめた組は不一致と分けて出す（ISSUE-163・ISSUE-176）
  const { mismatches, unfetched, reviewedKeep } = summarizeMismatches(targets, cache, loadKeptPairs());
  const health = summarizeHealth(targets, cache);
  const closures = summarizeClosures(targets, cache);
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), run, health, closures, mismatches, unfetched, reviewedKeep }, null, 2));

  console.log('');
  reportClosures(closures, { exitOnClosed: false });
  if (unfetched.length) console.log(`… 取得できたことが無いリンク ${unfetched.length}件（不一致とは数えない）`);
  if (reviewedKeep.length) console.log(`… 人が同じ店と確かめた組 ${reviewedKeep.length}件（data/tabelog_branch_reviewed.json の keep・不一致とは数えない）`);
  if (mismatches.length) {
    console.log(`❌ 不一致 ${mismatches.length}件（別の店 or 閉店店舗を指している可能性・要手動修正）:`);
    mismatches.forEach((m) => console.log(`  - ${m.店名} (${m.エリア}) [${m.種別}] ${m.url} — ${m.理由}${m.エラー ? `（${m.エラー}）` : ''}${m.検出タイトル ? ` 「${m.検出タイトル}」` : ''}`));
    console.log('');
    console.log(`詳細: ${path.relative(ROOT, REPORT_PATH)}`);
    if (opts.check) process.exit(1);
  } else {
    console.log('✅ 検証済みの範囲で不一致は見つかりませんでした');
  }
}

// 閉店の兆しの件数を出す（ISSUE-174）。--closures のときは、閉店の表示が1件でもあれば exit 1（夜間QA の soft）
function reportClosures(closures, { exitOnClosed }) {
  const { closed, notFound } = closures.hotpepper;
  if (opts.json && exitOnClosed) {
    console.log(JSON.stringify({ ...closures, today: new Date().toISOString().slice(0, 10) }, null, 2));
  } else {
    console.log(`ホットペッパーの閉店の表示: ${closed.length}件・掲載終了（ページが無い）: ${notFound.length}件`);
    closed.forEach((c) => console.log(`  - 【閉店】 ${c.店名} (${c.エリア}) ${c.url}（${String(c.検証日 || '').slice(0, 10)} 確認）`));
    notFound.forEach((c) => console.log(`  - 掲載終了 ${c.店名} (${c.エリア}) ${c.url}（${c.エラー}・${String(c.検証日 || '').slice(0, 10)} 確認）`));
    if (closed.length) {
      console.log('  自動では外さない。ISSUE-170 と同じく一次情報2つ以上で確かめ、data/store_liveness_reviews.json に記録してから data/closed_stores.json へ入れる');
    }
  }
  if (exitOnClosed && closed.length) process.exit(1);
}

// --health: 種類ごとの照合の状況を出す。食べログを最後に取得できた日が HEALTH_MAX_DAYS より前なら exit 1（ISSUE-164）
function reportHealth(health) {
  const j = judgeHealth(health, Date.now());
  if (opts.json) {
    console.log(JSON.stringify({ ...j, today: new Date().toISOString().slice(0, 10) }, null, 2));
  } else {
    for (const [kind, h] of Object.entries(j.kinds)) {
      console.log(`${kind}: リンク ${h.links}件・一度も照合していない ${h.neverChecked}件・取得できたことが無い ${h.unfetched}件・最後に取得できた日 ${h.lastFetchedAt ? `${h.lastFetchedAt.slice(0, 10)}（${h.daysSinceFetched}日前）` : 'なし'}`);
    }
    if (!j.ok) {
      console.log(`❌ 食べログを ${HEALTH_MAX_DAYS}日より長く取得できていない（CI からは HTTP 403）。照合の記録が古くなり、新しいリンクも確かめられていない`);
      console.log('   手元で照合し直す: node scripts/audit_store_link_identity.js --scope all --kind tabelog --limit 100');
      console.log('   403 が返ったら回避せず、日を改める（5件続けて取得できなければ自動でやめる）');
    }
  }
  if (!j.ok) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('致命的エラー:', e);
    process.exit(1);
  });
}
module.exports = { planChecks, mergeCheckResult, summarizeHealth, judgeHealth, summarizeClosures, summarizeMismatches, isFetchFailure };
