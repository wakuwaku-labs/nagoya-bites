#!/usr/bin/env node
'use strict';
/**
 * add_feature_journal_links.js  (SEO-056, updated SEO-108)
 *
 * 特集記事（features/*.html）に、同じ店を扱っているジャーナル記事（journal/*.html）への
 * 内部リンクを設置する。三層編集（DB／特集／ジャーナル）のうち、ジャーナル→特集は
 * refresh_journal_related.js で自動化済みだが、逆方向（特集→ジャーナル個別記事）が
 * 凍結していた（2026-08-19 の一回実行以降 36本が未反映・SEO-108）。
 *
 * 対応関係は2つの独立したキーで判定する（並列・どちらか一方でも一致すればリンク対象）:
 *   キー1: data/journal_published.json の store_ids と 特集HTML内の stores/JXXXX.html リンクの突合
 *   キー2: data/journal_seo_keywords.json の KW（表記揺れ含む）を記事タイトルが含み、
 *           その KW の feature が当該特集である（検証できる事実だけ・制約10）
 *
 * 実在する記事のみ（journal/SLUG.html が存在する）を出す（架空リンク・404を作らない）。
 *
 * 冪等:
 *   - class="related-journal-articles" マーカー区間を毎回再生成する（スキップしない）。
 *   - 生成内容が前回と同じ場合はファイルを書き換えない（diff なし）。
 *
 * 使い方:
 *   node scripts/add_feature_journal_links.js            # 全 features/*.html に適用
 *   node scripts/add_feature_journal_links.js --dry-run   # 書き込まず対象・件数だけ表示
 *   node scripts/add_feature_journal_links.js --check     # 差分があれば exit 1（CI向け）
 *   node scripts/add_feature_journal_links.js --file features/nagoya-solo-dining.html  # 1ファイル
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const PUBLISHED = path.join(ROOT, 'data', 'journal_published.json');
const SEO_KW = path.join(ROOT, 'data', 'journal_seo_keywords.json');

const MARKER = 'related-journal-articles';
// セクション境界: マーカーpタグ + related-linksブロック を1単位として扱う
// 行頭の水平スペース（インデント）もまとめて消去することで strip→re-inject が冪等になる
const SECTION_RE = /[ \t]*<p class="related-journal-title related-journal-articles"[\s\S]*?<\/div>\n/;
const MAX_LINKS = 3;

// 上限件数ポリシーは将来 data/journal_seo_kw_policy.json へ移せる準備として定数化
const MAX_LINKS_PER_FEATURE = MAX_LINKS;

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function jsEsc(s) { return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, ''); }

function shortLabel(title) {
  if (!title) return '';
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

function buildStoreToJournalsMap(entries) {
  const map = new Map();
  for (const e of entries) {
    for (const id of e.store_ids || []) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(e);
    }
  }
  return map;
}

// data/journal_seo_keywords.json から feature -> [{kw, aliases}] のマッピングを構築
function buildFeatureToKwsMap() {
  if (!fs.existsSync(SEO_KW)) return {};
  const d = JSON.parse(fs.readFileSync(SEO_KW, 'utf8'));
  const map = {};
  const cats = ['scenes', 'areas', 'genres'];
  for (const cat of cats) {
    for (const entry of Object.values(d[cat] || {})) {
      if (!entry.feature) continue;
      if (!map[entry.feature]) map[entry.feature] = [];
      map[entry.feature].push({ kw: entry.kw, aliases: entry.aliases || [] });
    }
  }
  return map;
}

// ジャーナル記事タイトルが KW（またはその表記揺れ）を含むか判定
function titleMatchesKws(title, kwEntries) {
  if (!title || !kwEntries || kwEntries.length === 0) return false;
  const t = title.toLowerCase();
  for (const { kw, aliases } of kwEntries) {
    const terms = [kw, ...(aliases || [])];
    if (terms.some(term => t.includes(term.toLowerCase()))) return true;
  }
  return false;
}

function buildBlockHtml(entries) {
  const links = entries.map((e) => {
    const href = `../journal/${e.slug}.html`;
    return `    <a class="related-link" href="${esc(href)}" onclick="trackEvent('internal_link_click',{link_url:'${jsEsc(href)}',link_text:'${jsEsc(shortLabel(e.title))}',block:'feature_journal'})">${esc(shortLabel(e.title))}</a>`;
  }).join('\n');
  return (
    `  <p class="related-journal-title ${MARKER}" style="margin-top:1.2rem;font-size:.7rem;letter-spacing:.08em;color:rgba(28,28,26,.5);text-transform:uppercase;">この特集の店の最新ジャーナル記事</p>\n` +
    `  <div class="related-links">\n${links}\n  </div>\n`
  );
}

// マーカー区間を html から取り除く（再生成のために既存区間を削除）
function stripMarkerSection(html) {
  return html.replace(SECTION_RE, '');
}

function inject(html, blockHtml) {
  // まず既存マーカー区間があれば除去（再生成）
  const strippedHtml = stripMarkerSection(html);

  // 優先: 既存 .related ブロック内の related-journal 段落（デイリージャーナル索引リンク）直後
  const anchorRe = /(<p class="related-journal"[\s\S]*?<\/p>\n)/;
  const m = strippedHtml.match(anchorRe);
  if (m) {
    const idx = strippedHtml.indexOf(m[0]) + m[0].length;
    return strippedHtml.slice(0, idx) + blockHtml + strippedHtml.slice(idx);
  }
  // 次点: <div class="related"> の related-links ブロック直後
  const relStart = strippedHtml.indexOf('<div class="related"');
  if (relStart !== -1) {
    const linksOpen = strippedHtml.indexOf('<div class="related-links">', relStart);
    if (linksOpen !== -1) {
      const linksClose = strippedHtml.indexOf('</div>', linksOpen) + '</div>'.length;
      return strippedHtml.slice(0, linksClose) + '\n' + blockHtml.trimEnd() + strippedHtml.slice(linksClose);
    }
  }
  // 最終手段: <footer の直前に単独ブロックとして挿入
  const fi = strippedHtml.indexOf('<footer');
  if (fi !== -1) {
    return strippedHtml.slice(0, fi) + `<div class="related">\n${blockHtml}</div>\n` + strippedHtml.slice(fi);
  }
  return null; // 挿入先が見つからない
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const checkMode = args.includes('--check');
  const fileArg = args.find(a => a.endsWith('.html') && !a.startsWith('--'));

  if (checkMode) {
    // --check: 差分があれば非ゼロ終了（CI向け・ファイルは書かない）
    args.push('--dry-run');
  }

  const publishedData = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
  const allEntries = publishedData.entries || [];
  const storeToJournals = buildStoreToJournalsMap(allEntries);
  const featureToKws = buildFeatureToKwsMap();

  // journal/*.html の存在確認セット（404リンクを作らない）
  const existingSlugs = new Set(
    fs.readdirSync(JOURNAL_DIR)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .map(f => f.replace('.html', ''))
  );

  let files;
  if (fileArg) {
    files = [path.basename(fileArg)];
  } else {
    files = fs.readdirSync(FEATURES_DIR)
      .filter((f) => f.endsWith('.html') && f !== 'index.html' && !f.startsWith('_'));
  }

  let modified = 0, noChange = 0, noMatch = 0, errored = 0;

  for (const file of files) {
    try {
      const filePath = path.join(FEATURES_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.error(`SKIP (not found): ${file}`);
        continue;
      }
      const html = fs.readFileSync(filePath, 'utf8');
      const featureRelPath = `features/${file}`;

      // キー1: 店舗ID突合
      const storeIds = new Set([...html.matchAll(/stores\/(J\d+)\.html/g)].map((m) => m[1]));
      const seenSlugs = new Set();
      const matched = [];
      for (const id of storeIds) {
        for (const e of storeToJournals.get(id) || []) {
          if (seenSlugs.has(e.slug)) continue;
          if (!existingSlugs.has(e.slug)) continue; // 実在確認
          seenSlugs.add(e.slug);
          matched.push(e);
        }
      }

      // キー2: KW突合（store_idで取れなかったエントリを追加）
      const kwEntries = featureToKws[featureRelPath] || [];
      if (kwEntries.length > 0) {
        for (const e of allEntries) {
          if (seenSlugs.has(e.slug)) continue;
          if (!existingSlugs.has(e.slug)) continue;
          if (titleMatchesKws(e.title, kwEntries)) {
            seenSlugs.add(e.slug);
            matched.push(e);
          }
        }
      }

      if (matched.length === 0) { noMatch++; continue; }

      matched.sort((a, b) => (a.date < b.date ? 1 : -1));
      const top = matched.slice(0, MAX_LINKS_PER_FEATURE);

      const blockHtml = buildBlockHtml(top);
      const newHtml = inject(html, blockHtml);
      if (!newHtml) {
        console.error(`SKIP (挿入先not found): ${file}`);
        errored++;
        continue;
      }

      if (newHtml === html) {
        noChange++;
        continue;
      }

      if (!dryRun && !checkMode) {
        fs.writeFileSync(filePath, newHtml, 'utf8');
      }
      console.log(`${dryRun || checkMode ? 'DIFF' : 'OK'}: ${file} (${top.length}件: ${top.map((e) => e.slug).join(', ')})`);
      modified++;
    } catch (e) {
      console.error(`ERROR: ${file}: ${e.message}`);
      errored++;
    }
  }

  console.log(`add_feature_journal_links: modified=${modified} noChange=${noChange} noMatch=${noMatch} errored=${errored}${dryRun ? ' (--dry-run)' : ''}${checkMode ? ' (--check)' : ''}`);

  if (checkMode && modified > 0) {
    console.error(`--check: ${modified}件の特集に未反映の新規ジャーナルリンクがあります`);
    process.exit(1);
  }
}

main();
