#!/usr/bin/env node
/**
 * relink_journal_store_cards.js  (SEO-110)
 *
 * ジャーナル店舗カードの「詳細を見る →」外部リンクを、実在する
 * stores/*.html への「店舗ページを見る →」内部リンクに置き換える。
 *
 * 判定: stores/*.html の最初の "name": "..." JSON-LD 値 → ファイル名（slug）
 * の正引き索引＋店名完全一致のみ（slug の再現計算はしない・制約10）。
 * 同名複数ページ・不一致はスキップしレポートに残す（取り繕わない）。
 *
 * 張り替えは .store-card の外部リンクを内部リンクへ差し替え、
 * 元の外部リンク（公式/Instagram）は失わずに内部リンクの後に保持する。
 * data/journal_published.json の store_ids も補完する。
 * 冪等: 内部リンク（../stores/）をすでに持つカードはスキップ。
 *
 * 使用例:
 *   node scripts/relink_journal_store_cards.js           # 全 journal 処理
 *   node scripts/relink_journal_store_cards.js --dry-run # 変更なしで差分表示
 *   node scripts/relink_journal_store_cards.js --check   # 未リンクカードがあれば exit 1
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const STORES_DIR   = path.join(ROOT, 'stores');
const JOURNAL_DIR  = path.join(ROOT, 'journal');
const PUBLISHED    = path.join(ROOT, 'data', 'journal_published.json');

const DRY_RUN = process.argv.includes('--dry-run');
const CHECK   = process.argv.includes('--check');

// ---- NFKC 正規化 --------------------------------------------------------
function norm(s) {
  return String(s || '').normalize('NFKC').trim();
}

// ---- stores/*.html から "name": "..." 最初の出現 → slug マップを構築 --------
function buildStoreIndex() {
  const nameToSlug = new Map();  // normalized name → [slug, ...]
  const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.html'));
  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(STORES_DIR, f), 'utf8');
    const m = html.match(/"name":\s*"([^"]+)"/);
    if (!m) continue;
    const key = norm(m[1]);
    if (!nameToSlug.has(key)) nameToSlug.set(key, []);
    nameToSlug.get(key).push(slug);
  }
  return nameToSlug;
}

// ---- store-card から店名を取得 -----------------------------------------------
function extractStoreName(cardInner) {
  const m = cardInner.match(/<h3 class="store-name">([^<]*)<\/h3>/);
  if (!m) return null;
  return m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// ---- ジャーナルファイル1件を処理 ----------------------------------------------
function processFile(filePath, nameToSlug, publishedMap) {
  const html  = fs.readFileSync(filePath, 'utf8');
  const slug  = path.basename(filePath, '.html');

  // store-card を非貪欲に抽出（add_journal_store_cta.js と同じパターン）
  const CARD_RE = /<div class="store-card"(?: data-store-id="([^"]*)")?>([\s\S]*?)<\/div>\s*<\/div>/g;

  let changed    = 0;
  let skipped    = 0;
  const unmatched = [];
  const linked    = [];

  const newHtml = html.replace(CARD_RE, (whole, storeId, inner) => {
    const storeName = extractStoreName(inner);
    if (!storeName) { skipped++; return whole; }

    // 内部リンクをすでに持つ → 冪等スキップ
    if (inner.includes('../stores/')) { skipped++; return whole; }

    // 「詳細を見る →」外部リンクを持つか
    const externalLinkRe = /<a class="store-link"([^>]*)>(詳細を見る →)<\/a>/;
    const extMatch = inner.match(externalLinkRe);
    if (!extMatch) { skipped++; return whole; }

    // 店名を正引き
    const key     = norm(storeName);
    const slugs   = nameToSlug.get(key);
    if (!slugs || slugs.length === 0) {
      unmatched.push({ name: storeName, reason: 'no_store_page' });
      skipped++;
      return whole;
    }
    if (slugs.length > 1) {
      unmatched.push({ name: storeName, reason: 'multiple_pages', slugs });
      skipped++;
      return whole;
    }
    const targetSlug = slugs[0];
    const internalLink = `<a class="store-link" href="../stores/${targetSlug}.html">店舗ページを見る →</a>`;

    // 外部リンクの前に内部リンクを挿入（外部リンクは保持）
    const newInner = inner.replace(externalLinkRe, `${internalLink}${extMatch[0]}`);
    changed++;
    linked.push({ name: storeName, slug: targetSlug });

    const openTag = storeId ? `<div class="store-card" data-store-id="${storeId}">` : '<div class="store-card">';
    return `${openTag}${newInner}</div>\n      </div>`;
  });

  // published.json の store_ids 補完
  const entry = publishedMap.get(slug);
  const newStoreIds = [];
  for (const { slug: s } of linked) {
    if (entry && !entry.store_ids.includes(s)) {
      newStoreIds.push(s);
    }
  }

  return { newHtml, changed, skipped, unmatched, linked, newStoreIds, entry };
}

// ---- main -------------------------------------------------------------------
function main() {
  const nameToSlug = buildStoreIndex();
  console.log(`Store index built: ${nameToSlug.size} unique names from stores/`);

  // published.json 読み込み
  let publishedData = { entries: [] };
  try { publishedData = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8')); } catch {}
  const publishedMap = new Map();
  for (const e of (publishedData.entries || [])) {
    publishedMap.set(e.slug, e);
  }

  // journal/*.html を対象に処理
  const journalFiles = fs.readdirSync(JOURNAL_DIR)
    .filter(f => f.endsWith('.html') && !f.endsWith('_template.html'))
    .map(f => path.join(JOURNAL_DIR, f));

  let totalChanged = 0, totalSkipped = 0;
  const allUnmatched = [];
  const allLinked    = [];
  let publishedDirty = false;

  for (const filePath of journalFiles) {
    const { newHtml, changed, skipped, unmatched, linked, newStoreIds, entry } =
      processFile(filePath, nameToSlug, publishedMap);

    if (changed > 0) {
      if (!DRY_RUN && !CHECK) {
        fs.writeFileSync(filePath, newHtml, 'utf8');
      }
      const label = DRY_RUN ? '[DRY-RUN] ' : '';
      console.log(`${label}OK: ${path.basename(filePath)} (${changed} cards relinked)`);

      // published.json 更新
      if (!DRY_RUN && !CHECK && entry && newStoreIds.length > 0) {
        entry.store_ids = [...(entry.store_ids || []), ...newStoreIds];
        publishedDirty = true;
      }
    }

    if (unmatched.length > 0) {
      for (const u of unmatched) {
        allUnmatched.push({ file: path.basename(filePath), ...u });
      }
    }
    allLinked.push(...linked.map(l => ({ file: path.basename(filePath), ...l })));
    totalChanged += changed;
    totalSkipped += skipped;
  }

  // published.json 書き戻し
  if (publishedDirty) {
    fs.writeFileSync(PUBLISHED, JSON.stringify(publishedData, null, 2) + '\n', 'utf8');
    console.log(`Updated: data/journal_published.json (${allLinked.length} store_ids added)`);
  }

  console.log(`\nSummary: relinked=${totalChanged} skipped=${totalSkipped} unmatched=${allUnmatched.length}`);

  if (allUnmatched.length > 0) {
    console.log('\nUnmatched cards (no action taken):');
    for (const u of allUnmatched) {
      const detail = u.reason === 'multiple_pages' ? ` [multiple: ${u.slugs.join(', ')}]` : '';
      console.log(`  ${u.file}: "${u.name}" (${u.reason}${detail})`);
    }
  }

  if (CHECK && totalChanged > 0) {
    console.error(`\ncheck: ${totalChanged} cards still need relinking (run without --check to apply)`);
    process.exit(1);
  }
  if (CHECK) {
    console.log('check: OK (no unlinked cards found)');
  }
}

main();
