#!/usr/bin/env node
'use strict';
/**
 * scripts/probe_index_status.js（P-437）— 検索エンジンへの登録状況の日次観測
 *
 * data/index_probe_urls.json の「見本の URL」を Search Console の URL 検査 API で引き、
 * data/index_probe.json に「面ごとの登録率・最近クロールされた割合」の履歴を残す。
 * 全 URL の登録数・クロール統計は API では取れないため、見本で代表させる（見本は日をまたいで同じ）。
 * I-25（トップの全店の索引を一覧ページへのリンクに置き換える）で、トップから店舗ページへリンクでたどれなくなる店の
 * 登録率が、たどれる店（対照）に比べて落ちないかを、画面を見に行かなくても追えるようにするのが最初の目的。
 *
 * 使い方:
 *   GA4_SERVICE_ACCOUNT_KEY=... node scripts/probe_index_status.js          # 引いて data/index_probe.json を更新
 *   node scripts/probe_index_status.js --report                              # 保存済みの履歴を読んで表示（通信なし）
 *   node scripts/probe_index_status.js --build-urls --unreachable-file <audit_store_reachability.js --list --json の出力>
 *                                                                            # 見本 URL の一覧を作り直す（普段は不要）
 * 鍵が無い・権限が無いときは何も書かずに正常終了する（CI の他の処理を止めない）。
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib/index_probe');

const ROOT = path.join(__dirname, '..');
const URLS_PATH = path.join(ROOT, 'data', 'index_probe_urls.json');
const OUT_PATH = path.join(ROOT, 'data', 'index_probe.json');
const SITE = 'https://nagoya-bites.com';
const SAMPLE = { unreachable_after_i25: 100, control_store: 100, area_hub: 30, journal: 20 };
const PACE_MS = parseInt(process.env.INDEX_PROBE_PACE_MS || '150', 10);
// 日次ビルドを止めないための時間の上限（全体）と、1 回の呼び出しの上限
const BUDGET_MS = parseInt(process.env.INDEX_PROBE_BUDGET_MS || '400000', 10);
const CONCURRENCY = Math.max(1, parseInt(process.env.INDEX_PROBE_CONCURRENCY || '6', 10));
const CALL_TIMEOUT_MS = parseInt(process.env.INDEX_PROBE_CALL_TIMEOUT_MS || '20000', 10);

function withTimeout(promise, ms) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`応答が ${ms}ms で返らない`)), ms); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return fallback; }
}

function buildUrls(unreachableFile) {
  const reach = readJson(unreachableFile, null);
  if (!reach || !Array.isArray(reach.unreachablePublic)) throw new Error('--unreachable-file が読めない（unreachablePublic が無い）');
  const toUrl = (rel) => `${SITE}/${rel}`;
  const unreachable = reach.unreachablePublic.map(toUrl);
  const stores = readJson(path.join(ROOT, 'data', 'stores.json'), []);
  const storeUrls = [];
  for (const s of Array.isArray(stores) ? stores : []) {
    const id = s['ホットペッパーID'];
    if (id && fs.existsSync(path.join(ROOT, 'stores', `${id}.html`))) storeUrls.push(toUrl(`stores/${id}.html`));
  }
  const man = readJson(path.join(ROOT, 'data', 'area_genre_pages_manifest.json'), { pages: [] });
  const hubs = (man.pages || []).filter((p) => p.status === 'active' && p.path !== 'stores/area/index.html').map((p) => toUrl(p.path));
  const journals = fs.readdirSync(path.join(ROOT, 'journal')).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f)).map((f) => toUrl(`journal/${f}`));
  const groups = {
    unreachable_after_i25: lib.pickSample(unreachable, SAMPLE.unreachable_after_i25),
    control_store: lib.pickSample(storeUrls, SAMPLE.control_store, unreachable),
    area_hub: lib.pickSample(hubs, SAMPLE.area_hub),
    journal: lib.pickSample(journals, SAMPLE.journal),
    home: [`${SITE}/`],
  };
  const doc = { _README: '見本の URL（日をまたいで同じ）。scripts/probe_index_status.js --build-urls で作り直す。unreachable_after_i25 は、I-25 でトップからのリンクが無くなる店（audit_store_reachability.js --list）の見本、control_store はそれ以外の店の見本。', generatedAt: new Date().toISOString().slice(0, 10), groups };
  fs.writeFileSync(URLS_PATH, JSON.stringify(doc, null, 2) + '\n');
  for (const [g, u] of Object.entries(groups)) console.log(`${g}: ${u.length}`);
}

function report() {
  const d = readJson(OUT_PATH, null);
  if (!d || !(d.history || []).length) { console.log('まだ観測がありません（data/index_probe.json が無い）'); return; }
  for (const h of d.history.slice(-14)) {
    const parts = Object.entries(h.groups).map(([g, v]) => `${g} ${v.indexed}/${v.inspected}（最近クロール ${v.crawledRecently}${v.errors ? `・取得失敗 ${v.errors}` : ''}）`);
    console.log(`${h.date}  ${parts.join('  ')}`);
  }
}

async function probe() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!raw) { console.log('GA4_SERVICE_ACCOUNT_KEY が無いのでスキップ（観測しない）'); return; }
  const urlsDoc = readJson(URLS_PATH, null);
  if (!urlsDoc || !urlsDoc.groups) { console.log('data/index_probe_urls.json が無いのでスキップ'); return; }
  const { google } = require('googleapis');
  const cred = JSON.parse(raw);
  const auth = new google.auth.JWT({ email: cred.client_email, key: cred.private_key, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
  await auth.authorize();
  const sc = google.searchconsole({ version: 'v1', auth });
  const prev = readJson(OUT_PATH, {});
  const siteUrl = process.env.GSC_SITE_URL || (readJson(path.join(ROOT, 'data', 'gsc_metrics.json'), {}).siteUrl) || 'sc-domain:nagoya-bites.com';
  const now = Date.now();
  const rows = {};
  let consecutiveFail = 0;
  let aborted = false;
  let skipped = 0;
  const started = Date.now();
  const queue = lib.interleave(urlsDoc.groups);
  let next = 0;
  // 1 回の呼び出しが 6〜7 秒かかる（実測）ので、並べて引く。クォータは 1 分 600 件で、6 並列でも余裕がある
  async function worker() {
    while (!aborted) {
      const i = next++;
      if (i >= queue.length) return;
      const { group, url } = queue[i];
      // 時間切れ: 日次ビルドを止めないため、残りは引かずに終える（引けなかったのではなく引かなかったので記録しない）
      if (Date.now() - started > BUDGET_MS) { skipped += 1; continue; }
      const inspectedAt = new Date().toISOString();
      try {
        const res = await withTimeout(sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl, languageCode: 'ja' } }), CALL_TIMEOUT_MS);
        const s = lib.summarizeInspection(res.data);
        rows[url] = s ? { group, ...s, inspectedAt } : { group, error: '応答に indexStatusResult が無い', inspectedAt };
        consecutiveFail = 0;
      } catch (e) {
        const msg = String((e && e.message) || e).slice(0, 160);
        rows[url] = { group, error: msg, inspectedAt };
        consecutiveFail += 1;
        // 権限なし・クォータ切れ・API 未有効化は全 URL で同じように失敗する。5 回続いたら打ち切って、理由を残す
        if (consecutiveFail >= 5) { aborted = true; console.log(`連続 5 回失敗したので打ち切り: ${msg}`); }
      }
      await new Promise((r) => setTimeout(r, PACE_MS));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  if (skipped) console.log(`時間切れ（${Math.round(BUDGET_MS / 1000)} 秒）: ${skipped} 件は引かずに終了`);
  const ok = Object.values(rows).filter((r) => !r.error).length;
  if (!ok) { console.log('1 件も引けなかったので data/index_probe.json は更新しない（原因は上のログ）'); return; }
  const date = new Date(now).toISOString().slice(0, 10);
  const groups = lib.summarizeGroups(rows, now);
  const out = { generatedAt: new Date(now).toISOString(), siteUrl, urls: rows, history: lib.updateHistory(prev.history, date, groups) };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + '\n');
  for (const [g, v] of Object.entries(groups)) console.log(`${g}: 登録 ${v.indexed}/${v.inspected}・最近クロール ${v.crawledRecently}・取得失敗 ${v.errors}`);
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const run = a.includes('--build-urls') ? async () => buildUrls(a[a.indexOf('--unreachable-file') + 1])
    : a.includes('--report') ? async () => report() : probe;
  run().catch((e) => { console.error('probe_index_status:', e.message || e); process.exit(0); });
}
module.exports = { buildUrls };
