#!/usr/bin/env node
/**
 * journal/ 記事の本文冒頭（導入段落の直後）に、関連特集への文脈リンクを冪等付与する（SEO-070）。
 *
 * 挿入位置: <div class="art-body"> の中の最初の段落（サイト紹介の1行 nb-site-intro は数えない）の </p> の直後
 *           （SEO-149: サイト紹介の1行が先頭に入ってから、区画が記事の導入より前に入っていた）
 * 条件:     記事タイトルが TOPIC_FEATURES にマッチし、かつ features/SLUG.html が実在する場合のみ。
 *           一致なしはスキップ（汎用リンクを差し込まない）
 * 冪等:     SEO-070:FEATURE-CTA:START/END マーカーで囲む。再実行時は置き換え
 *           --add-only は区画の無い記事にだけ入れ、既にある区画は書き換えも削除もしない（docs/decisions/0015 の5）。
 *           日次ジャーナルの refresh_journal_related.js がこの形で全記事に呼ぶ（SEO-149・新しい記事に入れる経路）
 * 実在保証: features/SLUG.html が存在するものだけ参照（リンク切れゼロ維持・架空店ブロックと同じ思想）
 *
 * 使い方:
 *   node scripts/inject_journal_feature_cta.js           # 全記事に適用
 *   node scripts/inject_journal_feature_cta.js --add-only  # 区画の無い記事にだけ入れる（日次）
 *   node scripts/inject_journal_feature_cta.js --check   # 書かずに、区画が入っていない記事があれば exit 1（夜間QA）
 *   node scripts/inject_journal_feature_cta.js --file 2026-09-08-ikeshita-kakuozan-yakiniku-smoke-free.html
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { relabelForSlug } = require('./lib/feature_counts');

const JOURNAL_DIR = path.join(__dirname, '..', 'journal');
const FEATURES_DIR = path.join(__dirname, '..', 'features');

const START = '<!-- SEO-070:FEATURE-CTA:START -->';
const END   = '<!-- SEO-070:FEATURE-CTA:END -->';

// 振り分け表は refresh_journal_related.js と共有する（scripts/lib/journal_topics.js・SEO-102）。
// 既に入っている区画は、この表で再実行したときだけ置き換わる
const { TOPIC_FEATURES } = require('./lib/journal_topics');

function listPosts(dir = JOURNAL_DIR) {
  return fs.readdirSync(dir)
    .filter(f => /^2\d{3}-\d{2}-\d{2}-.+\.html$/.test(f))
    .sort()
    .reverse();
}

function extractTitle(html) {
  const m = html.match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function matchTopicFeature(title) {
  if (!title) return null;
  for (const [re, slug, label] of TOPIC_FEATURES) {
    if (re.test(title)) {
      if (fs.existsSync(path.join(FEATURES_DIR, slug + '.html'))) {
        return { slug, label };
      }
    }
  }
  return null;
}

function buildBlock(topic) {
  const href = `../features/${topic.slug}.html`;
  const onclick = `onclick="trackEvent('internal_link_click',{block:'feature_cta_mid',link_url:'${href}'})"`;
  return [
    START,
    '<div class="tips-box" role="complementary" aria-label="関連特集">',
    '  <p style="font-family:var(--font-mono);font-size:var(--fs-xs);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--gold);margin:0 0 .5rem;">合わせて読む</p>',
    `  <a href="${href}" ${onclick}>${relabelForSlug(topic.label, topic.slug)} →</a>`,
    '</div>',
    END,
  ].join('\n');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findInsertionAfterIntroPara(html) {
  const artBodyIdx = html.indexOf('<div class="art-body">');
  if (artBodyIdx < 0) return -1;
  const re = /<p(?:\s[^>]*)?>/g;
  re.lastIndex = artBodyIdx;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/nb-site-intro/.test(m[0])) continue; // サイト紹介の1行は導入段落ではない
    const end = html.indexOf('</p>', m.index);
    return end < 0 ? -1 : end + 4; // 導入段落の閉じタグの後
  }
  return -1;
}

function processFile(file, opts) {
  const fp = path.join(opts.dir || JOURNAL_DIR, file);
  const html = fs.readFileSync(fp, 'utf8');
  const title = extractTitle(html);
  const topic = matchTopicFeature(title);
  const hasBlock = html.includes(START) && html.includes(END);

  if (!topic) {
    if (hasBlock && !opts.check && !opts.addOnly) {
      // タイトル変更等でマッチしなくなった → マーカーブロックを削除
      const re = new RegExp(escapeRegex(START) + '[\\s\\S]*?' + escapeRegex(END) + '\\n?');
      const updated = html.replace(re, '');
      if (updated !== html) {
        fs.writeFileSync(fp, updated);
        return { file, changed: true, status: 'removed' };
      }
    }
    return { file, changed: false, status: 'no_topic_match' };
  }

  const block = buildBlock(topic);
  let next;

  // --add-only: 既にある区画はそのまま（旧い振り分けの区画も残す・docs/decisions/0015 の5）
  if (hasBlock && opts.addOnly) return { file, changed: false, status: 'kept', topic: topic.slug };

  if (hasBlock) {
    const re = new RegExp(escapeRegex(START) + '[\\s\\S]*?' + escapeRegex(END));
    next = html.replace(re, block);
  } else {
    const at = findInsertionAfterIntroPara(html);
    if (at < 0) return { file, changed: false, status: 'no_art_body' };
    next = html.slice(0, at) + '\n' + block + '\n' + html.slice(at);
  }

  if (next === html) return { file, changed: false, status: 'no_diff', topic: topic.slug };
  if (!opts.check) fs.writeFileSync(fp, next);
  return {
    file,
    changed: true,
    status: hasBlock ? 'updated' : (opts.check ? 'would_add' : 'added'),
    topic: topic.slug,
  };
}

/** 全記事（または files）に適用する。refresh_journal_related.js から呼ぶ */
function run(opts = {}, files = null) {
  return (files || listPosts(opts.dir)).map(f => processFile(f, opts));
}

function main() {
  const args = process.argv.slice(2);
  const opts = { check: args.includes('--check'), addOnly: args.includes('--add-only') };
  const fileArg = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null;

  const posts = fileArg ? [fileArg] : listPosts();
  console.log(`Found ${posts.length} post(s)`);

  const results = run(opts, posts);
  const byStatus = {};
  results.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

  if (opts.check) {
    const missing = results.filter(r => r.status === 'would_add');
    missing.forEach(r => console.log(`MISSING ${r.file}: topic=${r.topic}`));
    console.log(`Check: ${JSON.stringify(byStatus)}`);
    if (missing.length > 0) process.exit(1);
  } else {
    const changed = results.filter(r => r.changed);
    changed.forEach(r => console.log(`${r.status.toUpperCase()} ${r.file}: topic=${r.topic || '(removed)'}`));
    console.log(`Done: ${JSON.stringify(byStatus)}`);
  }
}

if (require.main === module) main();
module.exports = { run, processFile, findInsertionAfterIntroPara, buildBlock, matchTopicFeature, START, END };
