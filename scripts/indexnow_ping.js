'use strict';
/**
 * scripts/indexnow_ping.js
 *
 * IndexNow で「更新した URL」を Bing に即時通知する（SEO-039）。
 *
 * ============================================================================
 * なぜ Bing なのか（2026-07-27 実測）
 * ============================================================================
 * GA4 30日で Bing 176 セッション（検索・AI経由 363 の 48.5%）に対し Google は 50（13.8%）。
 * それにも関わらず、これまでの SEO 施策・計測は Google（GSC）だけを見ていた。
 * IndexNow は Bing/Yandex/Seznam が対応するプッシュ型のインデックス通知プロトコルで、
 * アカウント登録もクレデンシャルも不要（自己生成したキーをサイトに置くだけで認証が成立する）。
 * 日次ジャーナルを毎日1本公開する運用と相性が良く、クロール待ちの遅延を縮められる。
 *
 * ※ Bing Webmaster Tools への登録（クエリ・掲載順位が見えるようになる）は
 *   アカウント作成とサイト所有権の確認が要るため**オーナー本人の操作**が必要。
 *   IndexNow はそれとは独立に、この仕組みだけで動く。
 *
 * ============================================================================
 * 安全設計
 * ============================================================================
 * - 既定は **dry-run**。実際に外部へ送信するのは `--yes` を明示したときだけ。
 * - 1回の送信は最大 MAX_URLS 件（IndexNow の仕様上 10,000 件が上限だが、事故を小さくする）。
 * - キーは `--init` でローカル生成し、キーファイルをリポジトリ直下に置く（GitHub Pages が配信）。
 *   キーファイルが公開されていないと IndexNow 側で認証されず、送信しても無視される。
 *
 * 使い方:
 *   node scripts/indexnow_ping.js --init                 # キー生成 + キーファイル作成（送信しない）
 *   node scripts/indexnow_ping.js --recent 7             # 送信対象（下記）を dry-run 表示
 *     送信対象: トップ/索引 + 直近7日のジャーナル + 編集コメントが変わった店舗ページ + 内容が変わったハブ
 *     （「変わった」は data/indexnow_state.json に記録した前回の送信値との比較・SEO-136）
 *   node scripts/indexnow_ping.js --recent 7 --yes       # 実際に送信する（外部通信が発生）
 *   node scripts/indexnow_ping.js --urls "https://..."   # URL を直接指定
 *   node scripts/indexnow_ping.js --status               # キーの設定状況を確認
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const HOST = 'nagoya-bites.com';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const CONFIG_PATH = path.join(ROOT, 'data', 'indexnow.json');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const PUBLISHED_PATH = path.join(ROOT, 'data', 'journal_published.json');
const MAX_URLS = 200;
const STATE_PATH = path.join(ROOT, 'data', 'indexnow_state.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'area_genre_pages_manifest.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

function out(o) { console.log(JSON.stringify(o, null, 2)); }

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) { return null; }
}

// ── --init : キー生成とキーファイル作成 ─────────────────────
function cmdInit() {
  const existing = loadConfig();
  if (existing && existing.key) {
    out({ ok: true, already_initialized: true, key_file: existing.key_file, note: 'キーは既に生成済み。作り直すと Bing 側の認証が一度切れるため、通常は再生成しない。' });
    return;
  }
  // IndexNow のキーは 8〜128 文字の英数字。UUID から生成する。
  const key = crypto.randomUUID().replace(/-/g, '');
  const keyFile = `${key}.txt`;
  fs.writeFileSync(path.join(ROOT, keyFile), key + '\n');
  const cfg = {
    description: 'IndexNow の送信設定（SEO-039）。キーファイルはサイト直下に公開されている必要がある。' +
                 'robots.txt / sitemap.xml / llms.txt と同じくルート直下の配信ファイルで、サイトのHTML構造には触れない。',
    host: HOST,
    key,
    key_file: keyFile,
    key_location: `${ORIGIN}/${keyFile}`,
    endpoint: ENDPOINT,
    created: new Date().toISOString().slice(0, 10),
    related_issue: 'SEO-039',
    notes: [
      'キーを作り直すと Bing 側の認証が切れるため、原則として再生成しない。',
      'キーファイルは公開されていること自体が認証条件（秘密情報ではない）。',
      '送信は scripts/indexnow_ping.js --recent N --yes。--yes が無ければ外部通信は発生しない。'
    ]
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  out({ ok: true, initialized: true, key_file: keyFile, key_location: cfg.key_location, config: path.relative(ROOT, CONFIG_PATH) });
}

// ── URL 収集 ────────────────────────────────────────────
// 1回の送信は「トップ/索引 → 直近 N 日のジャーナル → 編集コメントが変わった店舗ページ →
// 内容が変わったハブ」の順に MAX_URLS 件まで詰める（SEO-136）。
// 「変わった」は前回送った時点の値との比較で決める。送った値は data/indexnow_state.json に
// 実送信が成功したときだけ書く（dry-run や失敗では書かない＝送れなかった分は翌日に回る）。
// ハブは日々 100〜500 本の内容ハッシュが変わる（掲載店の評価などが動くため・2026-09-25〜10-08 の
// git 履歴で実測）。上限 200 件に収まらない分は、前回送った日が古いものから順に送る。
// 店舗ページは日々 300〜700 本変わるため全部は送らず、編集コメント（editorReason / insiderNote）が
// ページに出ていて、その文が前回送ったときから変わったものだけを送る。

/** 直近 N 日に公開されたジャーナル記事（実在するものだけ） */
function journalUrls(days, now = Date.now()) {
  if (!fs.existsSync(PUBLISHED_PATH)) return [];
  const pub = JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf8'));
  const cutoff = now - days * 86400000;
  const urls = [];
  (pub.entries || []).forEach(e => {
    if (!e.date || !e.slug) return;
    if (new Date(e.date + 'T00:00:00+09:00').getTime() < cutoff) return;
    if (!fs.existsSync(path.join(JOURNAL_DIR, e.slug + '.html'))) return;
    urls.push(`${ORIGIN}/journal/${e.slug}.html`);
  });
  return urls;
}

function loadState(p = STATE_PATH) {
  try {
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { hubs: s.hubs || {}, stores: s.stores || {} };
  } catch (_) {
    return { hubs: {}, stores: {} };
  }
}

const TYPE_ORDER = { root: 0, area: 1, genre: 2, condition: 3 };

/** manifest の公開中ハブのうち、前回送ったときと contentHash が違うもの（前回送った日が古い順） */
function hubTargets(manifest, state, exists) {
  const pending = ((manifest && manifest.pages) || [])
    .filter(p => p.status === 'active' && p.contentHash && exists(p.path))
    .filter(p => (state.hubs[p.path] || {}).hash !== p.contentHash)
    .map(p => ({ url: `${ORIGIN}/${p.path}`, key: p.path, hash: p.contentHash, type: p.type, updated: p.updated || '', last: (state.hubs[p.path] || {}).at || '' }));
  pending.sort((a, b) =>
    a.last.localeCompare(b.last) ||
    (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
    b.updated.localeCompare(a.updated) ||
    a.key.localeCompare(b.key));
  return pending;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'" };
function normText(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function pageText(html) { return normText(String(html).replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/g, m => ENTITIES[m])); }

/**
 * 店のページを探す。同じ slug になる店が複数あると、生成器は2店目以降に `-2`・`-3` を付ける
 * （gen-store-pages.js の main）。どの店が何番目かはスプレッドシートとの突き合わせ後の順で決まり、
 * ここでは再現できないため、ページの <h1> の店名で探す。どれにも当たらなければ基本の slug のページを返す。
 */
function storePageFor(s, { readPage, toSlug }) {
  const base = toSlug(s);
  const name = String(s['店名'] || '').trim();
  let first = null;
  for (let n = 1; n <= 20; n++) {
    const key = `stores/${n === 1 ? base : `${base}-${n}`}.html`;
    const html = readPage(key);
    if (!html) break;
    if (!first) first = { key, html };
    if (name && html.includes(`<h1>${name}</h1>`)) return { key, html };
  }
  return first || { key: `stores/${base}.html`, html: null };
}

/**
 * 編集コメントがページに出ている店舗ページのうち、出ている文が前回送ったときと違うもの。
 * 「出ている」はページの HTML に文がそのまま含まれること（第三者が検算できる事実・制約10）。
 * データにコメントがあってもページに出ていなければ、ページは変わっていないので送らない。
 */
function storeTargets(stores, state, { sitemapLocs, readPage, toSlug }) {
  const pending = [];
  const seen = new Set();
  let notOnPage = 0;
  for (const s of stores || []) {
    const comments = [s.editorReason, s.insiderNote].map(normText).filter(Boolean);
    if (!comments.length) continue;
    const { key, html } = storePageFor(s, { readPage, toSlug });
    const url = `${ORIGIN}/${key}`;
    if (seen.has(key) || !sitemapLocs.has(url)) continue;
    seen.add(key);
    if (!html) continue;
    const text = pageText(html);
    const shown = comments.filter(c => text.includes(c));
    if (!shown.length) { notOnPage++; continue; }
    const sig = crypto.createHash('sha256').update(shown.join('\u0000')).digest('hex').slice(0, 16);
    const prev = state.stores[key] || {};
    if (prev.sig === sig) continue;
    pending.push({ url, key, sig, last: prev.at || '' });
  }
  pending.sort((a, b) => a.last.localeCompare(b.last) || a.key.localeCompare(b.key));
  return { pending, notOnPage };
}

function collectTargets({ days, now, state, manifest, stores, sitemapLocs, readPage, exists, toSlug }) {
  const fixed = [`${ORIGIN}/`, `${ORIGIN}/journal/`, `${ORIGIN}/features/`];
  const journal = journalUrls(days, now);
  const st = storeTargets(stores, state, { sitemapLocs, readPage, toSlug });
  const hubs = hubTargets(manifest, state, exists);
  const urls = [];
  const seen = new Set();
  const take = (u) => {
    if (urls.length >= MAX_URLS || seen.has(u)) return false;
    seen.add(u);
    urls.push(u);
    return true;
  };
  fixed.forEach(take);
  const journalTaken = journal.filter(take);
  const storesSent = st.pending.filter(t => take(t.url));
  const hubsSent = hubs.filter(t => take(t.url));
  return {
    urls,
    breakdown: {
      cap: MAX_URLS,
      fixed: fixed.length,
      journal: journalTaken.length,
      stores: { selected: storesSent.length, pending: st.pending.length, comment_not_on_page: st.notOnPage },
      hubs: { selected: hubsSent.length, pending: hubs.length },
    },
    sent: { stores: storesSent, hubs: hubsSent },
  };
}

/** 実送信に成功した分を記録する（公開中でなくなったハブの記録は消す） */
function recordSent(state, sent, today, activeHubPaths) {
  const hubs = { ...state.hubs };
  const stores = { ...state.stores };
  for (const t of sent.hubs) hubs[t.key] = { hash: t.hash, at: today };
  for (const t of sent.stores) stores[t.key] = { sig: t.sig, at: today };
  if (activeHubPaths) for (const k of Object.keys(hubs)) if (!activeHubPaths.has(k)) delete hubs[k];
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  return { hubs: sorted(hubs), stores: sorted(stores) };
}

function writeState(next, today, p = STATE_PATH) {
  const body = {
    note: 'IndexNow で実際に送った値の記録（scripts/indexnow_ping.js・SEO-136）。ハブは contentHash、店舗ページはページに出ている編集コメントの要約値。ここと違うものだけが次の送信対象になる。',
    updated: today,
    ...next,
  };
  fs.writeFileSync(p, JSON.stringify(body, null, 2) + '\n');
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function sitemapLocSet(p = SITEMAP_PATH) {
  if (!fs.existsSync(p)) return new Set();
  return new Set([...fs.readFileSync(p, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()));
}

// ── --status ────────────────────────────────────────────
function cmdStatus() {
  const cfg = loadConfig();
  if (!cfg) { out({ ok: true, initialized: false, note: 'まだ --init していない。送信はできない。' }); return; }
  const keyFileExists = fs.existsSync(path.join(ROOT, cfg.key_file));
  out({
    ok: true, initialized: true, host: cfg.host, key_file: cfg.key_file,
    key_file_in_repo: keyFileExists,
    key_location: cfg.key_location,
    ready_to_submit: keyFileExists,
    note: keyFileExists
      ? 'キーファイルがリポジトリにある。デプロイ後に key_location が 200 を返せば送信が有効になる。'
      : '⚠️ キーファイルが見つからない。--init し直すか、キーファイルを復元すること。'
  });
}

// ── 送信 ────────────────────────────────────────────────
async function submit(urls, cfg, doIt) {
  const body = { host: cfg.host, key: cfg.key, keyLocation: cfg.key_location, urlList: urls };
  if (!doIt) {
    return { ok: true, dry_run: true, would_send: urls.length, endpoint: cfg.endpoint, urls, note: '--yes を付けると実際に送信する（外部通信が発生する）' };
  }
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  });
  const text = await res.text().catch(() => '');
  // IndexNow は 200/202 を成功として返す
  return { ok: res.status === 200 || res.status === 202, dry_run: false, status: res.status, sent: urls.length, response: text.slice(0, 300) };
}

// ── CLI ─────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

  if (args.includes('--init')) return cmdInit();
  if (args.includes('--status')) return cmdStatus();

  const cfg = loadConfig();
  if (!cfg || !cfg.key) {
    out({ ok: false, error: 'not_initialized', note: '先に node scripts/indexnow_ping.js --init を実行すること' });
    process.exit(1);
  }

  let urls;
  let collected = null;
  let manifest = null;
  if (args.includes('--urls')) {
    urls = String(flag('--urls') || '').split(/[,\s]+/).filter(Boolean);
  } else {
    manifest = readJson(MANIFEST_PATH);
    const { loadStores } = require('./lib/load_stores');
    const { toSlug } = require('../gen-store-pages.js');
    collected = collectTargets({
      days: parseInt(flag('--recent') || '7', 10),
      now: Date.now(),
      state: loadState(),
      manifest,
      stores: loadStores(),
      sitemapLocs: sitemapLocSet(),
      readPage: (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { return null; } },
      exists: (rel) => fs.existsSync(path.join(ROOT, rel)),
      toSlug,
    });
    urls = collected.urls;
  }
  if (urls.length === 0) { out({ ok: true, skipped: true, note: '送信対象の URL が無い' }); return; }

  const bad = urls.filter(u => !u.startsWith(ORIGIN));
  if (bad.length) { out({ ok: false, error: 'foreign_host', bad }); process.exit(1); }

  const result = await submit(urls, cfg, args.includes('--yes'));
  if (collected) result.breakdown = collected.breakdown;
  out(result);

  // 実送信に成功した分だけ「送った値」を記録する（dry-run・失敗では記録しない＝翌日に回る）
  if (collected && result.ok && !result.dry_run) {
    const today = new Date().toISOString().slice(0, 10);
    const active = manifest ? new Set((manifest.pages || []).filter(p => p.status === 'active').map(p => p.path)) : null;
    writeState(recordSent(loadState(), collected.sent, today, active), today);
  }

  const logFile = flag('--log-file');
  if (logFile) {
    const logPath = path.resolve(logFile);
    fs.writeFileSync(logPath, JSON.stringify({ ...result, urls, logged_at: new Date().toISOString() }, null, 2) + '\n');
  }
}

module.exports = { storePageFor, journalUrls, loadState, hubTargets, storeTargets, collectTargets, recordSent, pageText, MAX_URLS };

if (require.main === module) main().catch(e => { out({ ok: false, error: e.message }); process.exit(1); });
