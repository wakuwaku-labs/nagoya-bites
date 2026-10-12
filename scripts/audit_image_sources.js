#!/usr/bin/env node
'use strict';
/**
 * audit_image_sources.js — 画像の配信元の検査（I-35 ③・夜間QA の soft）
 *
 * 公開ページが、外部の画像変換サービス（wsrv.nl など）を使っていないかを数える。
 * 一覧の正本は data/image_source_policy.json（blockedHosts＝使っている件数を見張る一覧）。
 * オーナーは 2026-10-13 に「続ける」と決めた（P-237 #5・docs/decisions/0028-image-resizer-kept.md）ので、
 * 0 件にするのが目標ではない。赤のまま件数を見張る（夜間QA の soft・hard には上げない）。wsrv.nl を外す直し（I-09）は実装しない。
 *
 * 数え方（検証できる事実だけ・CLAUDE.md 制約10）:
 *   1. blockedHosts の文字列が、ページのどこかに（属性・インラインの JS・JSON-LD）出てくる箇所の数
 *   2. src / srcset / data-src / poster / og:image / twitter:image / CSS の url(...) に出てくる配信元のうち、
 *      allowedHosts にも blockedHosts にも無いもの（情報として出すだけ。違反には数えない）
 *
 * 使い方:
 *   node scripts/audit_image_sources.js            # 集計を出す（exit 0）
 *   node scripts/audit_image_sources.js --check    # blockedHosts が 1 か所でもあれば exit 1
 *   node scripts/audit_image_sources.js --json     # 結果を JSON で出す
 *   --root <dir>  別のリポジトリ（テスト用の小さな fixture）を見る
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_ROOT, SECTIONS, listPublishedPages } = require('./lib/published_pages');

const MAX_LISTED = 20;

function loadPolicy(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data', 'image_source_policy.json'), 'utf8'));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * blockedHosts の文字列が出てくる箇所の数。子ドメイン（cdn.wsrv.nl）は同じサービスなので数える。
 * ホスト名の一部だけが同じ別のドメイン（notwsrv.nl・my-wsrv.nl・wsrv.nl.example.com）は数えない。
 */
function countBlocked(html, blockedHosts) {
  const out = {};
  for (const b of blockedHosts) {
    const re = new RegExp('(?<![A-Za-z0-9-])' + escapeRe(b.host) + '(?![A-Za-z0-9-]|\\.[A-Za-z0-9])', 'g');
    const n = (html.match(re) || []).length;
    if (n) out[b.host] = n;
  }
  return out;
}

/** 画像として読み込まれる URL の配信元（ホスト名）の一覧。 */
function imageHosts(html) {
  const urls = [];
  for (const m of html.matchAll(/\b(?:src|data-src|poster)\s*=\s*"([^"]+)"/gi)) urls.push(m[1]);
  for (const m of html.matchAll(/\bsrcset\s*=\s*"([^"]+)"/gi)) for (const part of m[1].split(',')) urls.push(part.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (/(?:property|name)\s*=\s*"(?:og:image|twitter:image)"/i.test(tag)) {
      const c = tag.match(/\bcontent\s*=\s*"([^"]+)"/i);
      if (c) urls.push(c[1]);
    }
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^)'"]+)/gi)) urls.push(m[1]);
  const hosts = [];
  for (const u of urls) {
    const h = u.match(/^(?:https?:)?\/\/([^\/?#]+)/i);
    if (h) hosts.push(h[1].toLowerCase());
  }
  return hosts;
}

function audit({ root = DEFAULT_ROOT, policy = null } = {}) {
  policy = policy || loadPolicy(root);
  const known = new Set([...policy.blockedHosts, ...policy.allowedHosts].map((x) => x.host));
  const pages = listPublishedPages({ root });
  const bySection = Object.fromEntries(SECTIONS.map((s) => [s, { pages: 0, occurrences: 0 }]));
  const byHost = {};
  const unlisted = {};
  const violations = [];
  for (const p of pages) {
    const html = fs.readFileSync(p.abs, 'utf8');
    const blocked = countBlocked(html, policy.blockedHosts);
    const total = Object.values(blocked).reduce((a, b) => a + b, 0);
    if (total) {
      bySection[p.section].pages++;
      bySection[p.section].occurrences += total;
      for (const [h, n] of Object.entries(blocked)) {
        byHost[h] = byHost[h] || { pages: 0, occurrences: 0 };
        byHost[h].pages++;
        byHost[h].occurrences += n;
      }
      violations.push({ file: p.rel, section: p.section, hosts: blocked, occurrences: total });
    }
    for (const h of new Set(imageHosts(html))) if (!known.has(h)) unlisted[h] = (unlisted[h] || 0) + 1;
  }
  violations.sort((a, b) => b.occurrences - a.occurrences);
  return {
    ok: violations.length === 0,
    files_scanned: pages.length,
    pages_with_blocked_hosts: violations.length,
    occurrences: violations.reduce((a, v) => a + v.occurrences, 0),
    by_section: bySection, by_host: byHost,
    unlisted_hosts: Object.entries(unlisted).sort((a, b) => b[1] - a[1]).map(([host, pages]) => ({ host, pages })),
    violations: violations.slice(0, MAX_LISTED), violations_truncated: Math.max(0, violations.length - MAX_LISTED),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1]) : DEFAULT_ROOT;
  const result = audit({ root });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`画像の配信元の検査（I-35 ③）: 公開ページ ${result.files_scanned} 本`);
    for (const [h, v] of Object.entries(result.by_host)) console.log(`     ${h}: ${v.pages} ページ・${v.occurrences} か所`);
    for (const v of result.violations.slice(0, 5)) console.log(`     例: ${v.file}（${v.occurrences} か所）`);
    if (result.unlisted_hosts.length) console.log('  ℹ️ 一覧に無い配信元（情報のみ）: ' + result.unlisted_hosts.map((u) => `${u.host}(${u.pages})`).join(', '));
    console.log('     セクション別（ページ数）: ' + SECTIONS.map((s) => `${s} ${result.by_section[s].pages}`).join(' / '));
    console.log(`  ${result.ok ? '✅' : '❌'} 外部の変換サービス経由の画像: ${result.pages_with_blocked_hosts} ページ・${result.occurrences} か所`);
  }
  if (argv.includes('--check') && !result.ok) process.exit(1);
}

if (require.main === module) main();

module.exports = { audit, countBlocked, imageHosts, loadPolicy };
