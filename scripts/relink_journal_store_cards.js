#!/usr/bin/env node
/**
 * relink_journal_store_cards.js  — SEO-110
 *
 * 問題: generate_daily_draft.js の storeDetailLink() は生成時点で stores/*.html が
 *       無い新店に外部リンク（Instagram/公式）を付ける。以後も誰も張り替えなければ、
 *       店舗ページが存在するのに journal のカードが外部リンクのままになる。
 *
 * 修正: 「stores/*.html の JSON-LD name → ファイル名」の正引き索引を使い、
 *       journal/*.html の .store-card にある「詳細を見る →」を
 *       「店舗ページを見る →」（../stores/{slug}.html）に張り替える（冪等）。
 *
 * 使い方:
 *   node scripts/relink_journal_store_cards.js               # 実際に書き換え
 *   node scripts/relink_journal_store_cards.js --dry-run      # 差分表示のみ
 *   node scripts/relink_journal_store_cards.js --check        # 未修正あれば exit 1（CI向け）
 *
 * 判定ルール（CLAUDE.md 制約10: 検証できる事実だけで判定）:
 *   - 判定は「stores/*.html の実ファイルの JSON-LD name と store-card の h3 の
 *     完全一致（NFKC 正規化後）」のみ。slug の再現計算はしない。
 *   - 同名で複数のストアページが存在する店は自動では張り替えない（レポートに残す）。
 *   - 既に ../stores/ リンクが付いているカードはスキップ（冪等）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STORES_DIR = path.join(ROOT, 'stores');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const PUBLISHED_JSON = path.join(ROOT, 'data', 'journal_published.json');

const isDryRun = process.argv.includes('--dry-run');
const isCheck = process.argv.includes('--check');

// NFKC 正規化 + 前後スペース除去
function normalize(s) {
  return (s || '').normalize('NFKC').trim();
}

// stores/*.html から JSON-LD の name を抽出する
function extractStoreNames() {
  const nameToSlug = new Map();  // name -> [slug, ...]  (重複検出)
  const files = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.html') && !f.startsWith('.'));
  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    try {
      const html = fs.readFileSync(path.join(STORES_DIR, file), 'utf8');
      // JSON-LD の "name": "..." を抽出（最初のマッチを使う）
      const m = html.match(/"name"\s*:\s*"([^"]+)"/);
      if (!m) continue;
      const name = normalize(m[1]);
      if (!nameToSlug.has(name)) {
        nameToSlug.set(name, []);
      }
      nameToSlug.get(name).push(slug);
    } catch (_) {
      // 読み取れないファイルはスキップ
    }
  }
  return nameToSlug;
}

// journal/*.html から store-card を持つファイルを列挙
function findJournalFiles() {
  return fs.readdirSync(JOURNAL_DIR)
    .filter(f => f.endsWith('.html') && !f.startsWith('.') && f !== 'index.html')
    .map(f => path.join(JOURNAL_DIR, f));
}

// 1ファイルを処理して [changed, report] を返す
// report: { file, relinked: [{name,oldHref,newHref}], skipped: [{name,reason}] }
function processFile(filePath, nameToSlug) {
  const html = fs.readFileSync(filePath, 'utf8');
  const relinked = [];
  const skipped = [];

  // store-card ブロックを処理する
  // パターン: <div class="store-card"...>...<h3 class="store-name">NAME</h3>...<div class="store-cta-row">...</div>
  let newHtml = html;

  // 「詳細を見る →」を持つ store-link を見つける（外部リンク・既に stores/ でないもの）
  // <a class="store-link[^"]*" href="(https?://...)" ...>詳細を見る →</a>
  const CTAPattern = /(<a\s+class="store-link[^"]*"\s+href=")(https?:\/\/[^"]+)("[^>]*>)詳細を見る\s*→(<\/a>)/g;

  // まず全 store-card の名前と CTA を対応づける
  // store-card ブロック全体を抽出してから判断する
  const CARD_PATTERN = /<div class="store-card"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let cardMatch;

  // 対象カード一覧を先に抽出
  const cards = [];
  let m;
  // store-name -> 外部リンク(href)の map
  const cardMap = []; // [{name, oldHref, oldAnchor}]

  const storeNameRe = /<h3 class="store-name">([^<]+)<\/h3>/;
  const ctaLinkRe = /(<a\s+class="store-link[^"]*"\s+href=")(https?:\/\/[^"]+)("[^>]*>)詳細を見る\s*→(<\/a>)/;

  // store-card ごとに処理するために、ファイルを store-card 単位で分割して処理する
  // シンプルなアプローチ: 正規表現でカード内の情報を取り出し、文字列置換する

  // ストアカード開始〜終了のパターン（store-cta-row の終わりまで）
  // 実際の構造:
  //   <div class="store-card"...>
  //     <div class="store-num">...</div>
  //     <div class="store-info">
  //       <h3 class="store-name">NAME</h3>
  //       ...
  //       <div class="store-cta-row">...</div>
  //     </div>
  //   </div>

  // まず store-name と直後の store-cta-row のペアを抽出する（同一 store-card 内に限定）
  const pairPattern = /(<h3 class="store-name">)(([^<]+))<\/h3>([\s\S]*?)(<div class="store-cta-row">)([\s\S]*?)(<\/div>)/g;

  newHtml = html.replace(pairPattern, (full, h3Open, nameRaw, namePlain, between, ctaOpen, ctaContent, ctaClose) => {
    const name = normalize(namePlain);
    const slugList = nameToSlug.get(name);

    // CTA 内に「詳細を見る →」があるか確認
    const detailMatch = ctaContent.match(/(<a\s+class="store-link[^"]*"\s+href=")(https?:\/\/[^"]+)("[^>]*>)詳細を見る\s*→(<\/a>)/);
    if (!detailMatch) {
      return full; // このカードは対象外（外部リンクが無い、または既に内部リンク）
    }

    const oldHref = detailMatch[2];

    if (!slugList) {
      skipped.push({ name, reason: '店舗ページが見つからない' });
      return full;
    }
    if (slugList.length > 1) {
      skipped.push({ name, reason: `同名の店舗ページが複数存在（${slugList.join(', ')}）` });
      return full;
    }

    const slug = slugList[0];
    const newHref = `../stores/${slug}.html`;

    // CTA コンテンツを更新: 「詳細を見る →」を「店舗ページを見る →」に変更し、href を内部リンクへ
    // 元の外部リンクは別リンクとして保持（「公式サイト」ラベル）
    const externalAttr = detailMatch[3]; // href 後の属性（target, rel 等）
    const externalLink = detailMatch[0];
    // 既存の外部リンクのテキストを変える（「詳細を見る →」→「公式サイト」）
    const renamedExternal = externalLink.replace(/>詳細を見る\s*→<\/a>/, '>公式・SNS<\/a>');

    const newCtaContent = ctaContent.replace(
      /(<a\s+class="store-link[^"]*"\s+href=")(https?:\/\/[^"]+)("[^>]*>)詳細を見る\s*→(<\/a>)/,
      `<a class="store-link" href="${newHref}">店舗ページを見る →</a>${renamedExternal}`
    );

    relinked.push({ name, oldHref, newHref });
    return `${h3Open}${nameRaw}</h3>${between}${ctaOpen}${newCtaContent}${ctaClose}`;
  });

  const changed = newHtml !== html;
  return { changed, newHtml, relinked, skipped };
}

function main() {
  console.log('=== relink_journal_store_cards.js ===');
  console.log(`モード: ${isCheck ? '--check' : isDryRun ? '--dry-run' : '書き換え'}`);

  const nameToSlug = extractStoreNames();
  console.log(`店舗ページ索引: ${nameToSlug.size} 件（ユニーク名）`);

  const journalFiles = findJournalFiles();
  console.log(`ジャーナルファイル: ${journalFiles.length} 件`);

  let totalRelinked = 0;
  let totalSkipped = 0;
  const allSkipped = [];
  const changedFiles = [];

  for (const filePath of journalFiles) {
    const { changed, newHtml, relinked, skipped } = processFile(filePath, nameToSlug);

    if (relinked.length > 0 || skipped.length > 0) {
      const shortPath = path.relative(ROOT, filePath);
      if (relinked.length > 0) {
        console.log(`\n✅ ${shortPath}`);
        for (const r of relinked) {
          console.log(`   ${r.name}: ${r.oldHref} → ${r.newHref}`);
        }
      }
      if (skipped.length > 0) {
        if (relinked.length === 0) console.log(`\n⚠️  ${shortPath}`);
        for (const s of skipped) {
          console.log(`   SKIP: ${s.name} (${s.reason})`);
          allSkipped.push({ file: shortPath, ...s });
        }
      }
    }

    totalRelinked += relinked.length;
    totalSkipped += skipped.length;

    if (changed) {
      changedFiles.push(filePath);
      if (!isDryRun && !isCheck) {
        fs.writeFileSync(filePath, newHtml, 'utf8');
      }
    }
  }

  console.log(`\n--- 結果 ---`);
  console.log(`張り替え対象: ${totalRelinked} 件（${changedFiles.length} ファイル）`);
  console.log(`スキップ: ${totalSkipped} 件`);

  if (allSkipped.length > 0) {
    console.log('\n--- 手動確認が必要なスキップ一覧 ---');
    for (const s of allSkipped) {
      console.log(`  [${s.file}] ${s.name}: ${s.reason}`);
    }
  }

  if (isCheck) {
    if (totalRelinked > 0) {
      console.error(`\n❌ --check: ${totalRelinked} 件の未修正カードが存在します（node scripts/relink_journal_store_cards.js で修正してください）`);
      process.exit(1);
    } else {
      console.log('\n✅ --check: 未修正カードなし');
    }
  } else if (isDryRun) {
    console.log('\n（--dry-run: ファイルは変更されていません）');
  } else {
    console.log(`\n書き換え完了: ${changedFiles.length} ファイル更新`);
  }
}

main();
