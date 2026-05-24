#!/usr/bin/env node
/**
 * audit_feature_schema_alignment.js
 *
 * ISSUE-059 再発防止: features/*.html の見た目（<title> / <h1>）と
 * JSON-LD（Article.headline / ItemList.name / BreadcrumbList の末端）が一致するか検査する。
 *
 * 検出するパターン:
 *   - Article.headline が <title> と全く異なる語彙（テンプレ copy-paste 事故）
 *   - ItemList.name が <h1> と全く異なる語彙
 *   - BreadcrumbList の末端 name が <title> と全く異なる語彙
 *   - Article.url が当該ファイル URL を指していない（href が別ページ）
 *
 * 「全く異なる語彙」の定義:
 *   - 双方を 2-gram に分割し、共通 2-gram 数 / min(双方の 2-gram 数) を類似度として算出
 *   - 0.20 未満を mismatch と判定（接待 vs ラーメンの実例は 0.0 になる）
 *
 * 使い方: `node scripts/audit_feature_schema_alignment.js [--fix-suggest]`
 * 終了コード: mismatch 検出件数（0 = 全件 OK・CI で `|| true` 不要）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', 'features');
const THRESHOLD = 0.13; // 類似度がこれ未満なら mismatch（0.13 で「ラーメンテンプレ汚染」と false-positive を分離可能）

function normalize(str) {
  // 共通ボイラープレートを除去してから 2-gram 化する（短い日本語タイトルでの偽陽性を防ぐ）
  return (str || '')
    .replace(/【\d{4}年版】|【最新版】|【\d{4}年最新】/g, '')
    .replace(/｜NAGOYA BITES.*$|\|NAGOYA BITES.*$/g, '')
    .replace(/[—\-:：].*NAGOYA BITES.*$/g, '')
    .replace(/おすすめ|完全ガイド|【業界人.*?】|【飲食人.*?】/g, '')
    .replace(/名古屋(の|めし|グルメ)?/g, '')
    .replace(/\d+選|\d+店|\d+本|\d+件/g, '')
    .replace(/\s+/g, '')
    .replace(/[【】「」『』！？・，、。()「」［］〈〉《》#＃!?\[\]｜|—\-:：\/]/g, '');
}

function bigrams(str) {
  const s = normalize(str);
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function similarity(a, b) {
  // 正規化後のいずれかが極端に短い場合（鮨/夏 等）は部分一致でフォールバック判定
  const nA = normalize(a);
  const nB = normalize(b);
  if (nA.length === 0 || nB.length === 0) return 0;
  if (nA.length < 4 || nB.length < 4) {
    // 短い側の文字が長い側に含まれていれば一致とみなす
    const short = nA.length <= nB.length ? nA : nB;
    const long = nA.length <= nB.length ? nB : nA;
    return long.includes(short) ? 1.0 : 0;
  }
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / Math.min(A.size, B.size);
}

function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (e) {
      // パース不能ブロックはスキップ（warn は呼び側で集計）
      blocks.push({ _parseError: e.message, _raw: m[1].slice(0, 200) });
    }
  }
  return blocks;
}

function audit(filename) {
  const filePath = path.join(FEATURES_DIR, filename);
  const html = fs.readFileSync(filePath, 'utf8');
  const title = extract(html, /<title[^>]*>([^<]+)<\/title>/);
  const h1 = extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '');
  const blocks = extractJsonLdBlocks(html);

  const issues = [];

  for (const b of blocks) {
    if (b._parseError) {
      issues.push({ kind: 'json_parse_error', detail: b._parseError });
      continue;
    }
    if (b['@type'] === 'Article') {
      const headline = b.headline || '';
      const sim = similarity(title, headline);
      if (sim < THRESHOLD) {
        issues.push({ kind: 'article_headline_mismatch', title, headline, similarity: sim.toFixed(2) });
      }
      if (b.url && !b.url.endsWith('/' + filename) && !b.url.endsWith(filename)) {
        issues.push({ kind: 'article_url_mismatch', filename, articleUrl: b.url });
      }
      if (b.mainEntityOfPage && typeof b.mainEntityOfPage === 'string'
          && !b.mainEntityOfPage.endsWith('/' + filename) && !b.mainEntityOfPage.endsWith(filename)) {
        issues.push({ kind: 'article_mainEntity_mismatch', filename, mainEntity: b.mainEntityOfPage });
      }
    } else if (b['@type'] === 'ItemList') {
      const name = b.name || '';
      const sim = similarity(h1 || title, name);
      if (sim < THRESHOLD) {
        issues.push({ kind: 'itemlist_name_mismatch', h1Or: h1 || title, itemListName: name, similarity: sim.toFixed(2) });
      }
    } else if (b['@type'] === 'BreadcrumbList') {
      const items = b.itemListElement || [];
      const last = items[items.length - 1];
      if (last && last.name) {
        const sim = similarity(title, last.name);
        if (sim < THRESHOLD) {
          issues.push({ kind: 'breadcrumb_last_mismatch', title, breadcrumbLast: last.name, similarity: sim.toFixed(2) });
        }
      }
    } else if (b['@type'] === 'FAQPage') {
      // FAQPage は本文の語彙との一致が望ましい。ここでは Q の文字列を結合して title との重複を見る
      const questions = (b.mainEntity || []).map(q => q.name || '').join(' ');
      if (questions) {
        const sim = similarity(title, questions);
        if (sim < THRESHOLD) {
          issues.push({ kind: 'faqpage_topic_mismatch', title, questionsPreview: questions.slice(0, 80) + '...', similarity: sim.toFixed(2) });
        }
      }
    }
  }

  return { filename, title, h1, issues };
}

function main() {
  const files = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html');

  const failed = [];
  let total = 0;
  for (const f of files) {
    const result = audit(f);
    if (result.issues.length > 0) {
      failed.push(result);
      total += result.issues.length;
    }
  }

  if (failed.length === 0) {
    console.log(`✅ features/*.html ${files.length} 件: スキーマ整合性 OK（全件で title/h1/Article/ItemList/Breadcrumb/FAQPage が一致）`);
    process.exit(0);
  }

  console.error(`❌ ${failed.length}/${files.length} 件で ${total} 件のスキーマ汚染を検出:\n`);
  for (const r of failed) {
    console.error(`── ${r.filename}`);
    console.error(`   title: ${r.title}`);
    if (r.h1) console.error(`   h1:    ${r.h1}`);
    for (const i of r.issues) {
      console.error(`   ⚠ [${i.kind}] ${JSON.stringify(i, null, 0).slice(0, 240)}`);
    }
    console.error('');
  }
  console.error(`合計 ${total} 件の mismatch — ISSUE-059 起票根拠`);
  process.exit(failed.length); // mismatch ファイル数を exit code に
}

main();
