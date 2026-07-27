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
 *   node scripts/indexnow_ping.js --recent 7             # 直近7日に更新された URL を dry-run 表示
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
/** 直近 N 日に公開されたジャーナル記事 + 常時更新されるトップ/索引 */
function recentUrls(days) {
  const urls = new Set([`${ORIGIN}/`, `${ORIGIN}/journal/`, `${ORIGIN}/features/`]);
  if (fs.existsSync(PUBLISHED_PATH)) {
    const pub = JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf8'));
    const cutoff = Date.now() - days * 86400000;
    (pub.entries || []).forEach(e => {
      if (!e.date || !e.slug) return;
      if (new Date(e.date + 'T00:00:00+09:00').getTime() < cutoff) return;
      if (!fs.existsSync(path.join(JOURNAL_DIR, e.slug + '.html'))) return; // 実在する記事だけ
      urls.add(`${ORIGIN}/journal/${e.slug}.html`);
    });
  }
  return Array.from(urls).slice(0, MAX_URLS);
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
  if (args.includes('--urls')) {
    urls = String(flag('--urls') || '').split(/[,\s]+/).filter(Boolean);
  } else {
    urls = recentUrls(parseInt(flag('--recent') || '7', 10));
  }
  if (urls.length === 0) { out({ ok: true, skipped: true, note: '送信対象の URL が無い' }); return; }

  const bad = urls.filter(u => !u.startsWith(ORIGIN));
  if (bad.length) { out({ ok: false, error: 'foreign_host', bad }); process.exit(1); }

  out(await submit(urls, cfg, args.includes('--yes')));
}

if (require.main === module) main().catch(e => { out({ ok: false, error: e.message }); process.exit(1); });
