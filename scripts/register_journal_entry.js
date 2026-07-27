'use strict';
/**
 * scripts/register_journal_entry.js
 *
 * 公開済みの記事HTMLから メタ情報を抽出し、data/journal_published.json に登録する。
 * 冪等（既に同じ date のエントリがあれば何もしない）。
 *
 * 使い方:
 *   node scripts/register_journal_entry.js journal/2026-07-27-slug.html
 *   node scripts/register_journal_entry.js journal/2026-07-27-slug.html --gate-note "88点（自動公開ライン95点）。主な不足: ..."
 *   node scripts/register_journal_entry.js journal/2026-07-27-slug.html --dry-run
 *
 * ============================================================================
 * なぜこれが要るのか（ISSUE-077 / C: ラッパーの never-stop 保証）
 * ============================================================================
 * 日次ジャーナルの生成本体はヘッドレスの claude 実行で、記事HTMLとSNS原稿を作った後に
 * published.json へ登録する。ところがエージェントが登録前に「これを公開してよいか」と
 * 人間に確認を求めて停止すると、**記事は完成しているのに永久に公開されない**。
 * 実際に 2026-07-22（validator の誤検知で die）と 2026-07-27（95点ゲート未達で承認待ち）の
 * 2回発生し、7/22 は本番サイトが 404 になった。
 *
 * このスクリプトは「成果物はあるのに未登録」という状態を、記事HTMLだけを根拠に
 * 機械的に解消するための部品。run_journal_local.sh の復旧経路から呼ばれる。
 * 公開の可否そのものは validate_journal_draft.js が判定し、ここでは判定しない
 * （＝品質ゲートを迂回する道具ではない）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLISHED_PATH = path.join(ROOT, 'data', 'journal_published.json');

/** art-eyebrow の表記から theme を決める（実データの表記ゆれに対応） */
function themeFromEyebrow(eyebrow) {
  const e = String(eyebrow || '');
  if (e.includes('今日の1軒')) return 'today_one';
  if (e.includes('業界の裏側') || e.includes('業界人コラム')) return 'industry_insider';
  if (e.includes('週次')) return 'weekly_digest';
  if (e.includes('季節') || e.includes('短信')) return 'seasonal';
  return 'flexible';
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, '')).trim();
}

/**
 * 記事HTMLから published.json のエントリを組み立てる。
 * 抽出できない項目は空で返し、呼び出し側が落ちないようにする（安全網としての性質を優先）。
 */
function extractEntry(htmlPath, opts = {}) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const base = path.basename(htmlPath, '.html');
  const dateMatch = base.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) throw new Error(`ファイル名から日付を取得できません: ${base}（YYYY-MM-DD-slug.html 形式である必要があります）`);
  const date = dateMatch[1];

  // タイトル: og:title を優先し、無ければ <title> からサイト名サフィックスを落とす
  let title = (html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || [])[1] || '';
  if (!title) title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  title = decodeEntities(title).replace(/｜NAGOYA BITES.*$/, '').trim();

  const description = decodeEntities(
    (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || ''
  ).trim();

  const eyebrow = stripTags((html.match(/class="art-eyebrow"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');
  const theme = themeFromEyebrow(eyebrow);

  // 店舗カードを1枚ずつ見て、J コードのある店は store_ids、無い店は pending_store_keys に振り分ける
  const storeIds = [];
  const pendingKeys = [];
  const cards = html.split(/class="store-card"/).slice(1);
  for (const card of cards) {
    const block = card.split('</div>').slice(0, 12).join('</div>');
    const id = (card.match(/data-store-id="([^"]+)"/) || [])[1] || '';
    const name = stripTags((block.match(/class="store-name"[^>]*>([\s\S]*?)<\/h3>/i) || [])[1] || '');
    if (id) {
      if (!storeIds.includes(id)) storeIds.push(id);
    } else if (name && !pendingKeys.includes(name)) {
      pendingKeys.push(name);
    }
  }
  // カード外に data-store-id が置かれている書式も拾う（取りこぼし防止）
  for (const m of html.matchAll(/data-store-id="([^"]+)"/g)) {
    if (!storeIds.includes(m[1])) storeIds.push(m[1]);
  }

  const entry = {
    slug: base,
    date,
    theme,
    title,
    description,
    store_ids: storeIds,
    pending_store_keys: pendingKeys,
    column_id: '',
    published_at: `${date}T08:00:00+09:00`
  };
  if (opts.gateNote) entry.gate_note = opts.gateNote;
  if (opts.registeredBy) entry.registered_by = opts.registeredBy;
  return entry;
}

function register(htmlPath, opts = {}) {
  const entry = extractEntry(htmlPath, opts);
  const published = JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf8'));
  published.entries = published.entries || [];

  const existing = published.entries.find(e => e.date === entry.date);
  if (existing) {
    return { action: 'skipped', reason: `${entry.date} は既に登録済み (slug=${existing.slug})`, entry: existing };
  }
  if (!entry.title) {
    throw new Error('タイトルを抽出できませんでした（og:title / <title> のいずれも空）');
  }

  if (!opts.dryRun) {
    published.entries.push(entry);
    fs.writeFileSync(PUBLISHED_PATH, JSON.stringify(published, null, 2) + '\n', 'utf8');
  }
  return { action: opts.dryRun ? 'dry-run' : 'registered', entry };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const htmlPath = args.find(a => !a.startsWith('--'));
  if (!htmlPath) {
    console.error('Usage: node scripts/register_journal_entry.js <journal/YYYY-MM-DD-slug.html> [--gate-note "..."] [--dry-run]');
    process.exit(1);
  }
  if (!fs.existsSync(htmlPath)) {
    console.error('記事HTMLが見つかりません: ' + htmlPath);
    process.exit(1);
  }
  const gnIdx = args.indexOf('--gate-note');
  const opts = {
    dryRun: args.includes('--dry-run'),
    gateNote: gnIdx >= 0 ? (args[gnIdx + 1] || '') : '',
    registeredBy: args.includes('--by-wrapper') ? 'run_journal_local.sh (auto-recovery)' : ''
  };

  try {
    const r = register(htmlPath, opts);
    if (r.action === 'skipped') {
      console.log(`スキップ: ${r.reason}`);
      process.exit(0);
    }
    console.log(`${r.action === 'dry-run' ? '[dry-run] ' : ''}published.json に登録しました:`);
    console.log(`  date  : ${r.entry.date}`);
    console.log(`  slug  : ${r.entry.slug}`);
    console.log(`  theme : ${r.entry.theme}`);
    console.log(`  title : ${r.entry.title}`);
    console.log(`  stores: ids=[${r.entry.store_ids.join(',')}] pending=[${r.entry.pending_store_keys.join(',')}]`);
    if (r.entry.gate_note) console.log(`  gate_note: ${r.entry.gate_note}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ 登録に失敗: ' + e.message);
    process.exit(1);
  }
}

module.exports = { extractEntry, register, themeFromEyebrow };
