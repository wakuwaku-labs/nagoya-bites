#!/usr/bin/env node
'use strict';
/**
 * 公開済みジャーナル記事に「本文写真」を後から挿す（冪等）
 *
 * 【なぜ存在するか】
 *   記事の写真はヒーロー1枚だけで、本文は最後まで文字が続いていた。日次生成は
 *   scripts/generate_daily_draft.js が本文写真も付けるようになったが、それは
 *   これから作る記事の話で、既に公開した記事は1枚のまま残る。
 *
 * 【増やすのは枚数であって基準ではない】
 *   挿す写真は、その記事が扱う店（store-card に載っている店）のものだけ。
 *   判定器は生成時・公開前QA・日次CI監査と同じ scripts/lib/hero_photo_gate.js。
 *   候補が足りない記事は1枚のまま残す（他店の写真を借りない・取り繕わない）。
 *
 * 使い方:
 *   node scripts/add_journal_body_photos.js --dry-run          # 何が挿さるかだけ見る
 *   node scripts/add_journal_body_photos.js --days 30          # 直近N日の記事
 *   node scripts/add_journal_body_photos.js --only <slugの一部>
 *   node scripts/add_journal_body_photos.js --limit 5
 *   GOOGLE_MAPS_API_KEY=... node scripts/add_journal_body_photos.js   # Places も候補に入る
 *
 * ⚠️ CI では回さない。外部APIを叩くうえ、写真の中身（販促バナーでないか等）は
 *    機械で判定しないと決めてあるため（data/journal_photo_policy.json の textOverlayAdvisory）、
 *    実行結果は人が目で見てからコミットする運用にしている。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');
const JP = require('./lib/journal_photos');
const { extractHeroFromHtml, extractBodyPhotosFromHtml } = require('./lib/hero_photo_gate');

function parseArgs() {
  const a = process.argv.slice(2);
  const val = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  return {
    dryRun: a.includes('--dry-run'),
    days: val('--days') ? Number(val('--days')) : null,
    only: val('--only'),
    limit: val('--limit') ? Number(val('--limit')) : null,
  };
}

/** 記事HTMLから、その記事が扱う店（store-card）を取り出す */
function extractStores(html) {
  const out = [];
  for (const m of html.matchAll(/<div class="store-card"([^>]*)>([\s\S]*?)<h3 class="store-name">([^<]+)</g)) {
    const id = (m[1].match(/data-store-id="([^"]+)"/) || [])[1] || '';
    const name = m[3].trim();
    const area = (m[2].match(/<span>([^<]*)<\/span>\s*<span>([^<]*)<\/span>/) || [])[2] || '';
    if (name) out.push({ name, id, area: area.trim() });
  }
  return out;
}

/** 本文（art-body の中で、業界人の目利きブロックより前）の範囲を返す */
function bodyRange(html) {
  const startTag = '<div class="art-body">';
  const start = html.indexOf(startTag);
  if (start < 0) return null;
  const from = start + startTag.length;
  let to = html.indexOf('<div class="insider-box">', from);
  if (to < 0) to = html.indexOf('<div class="store-list">', from);
  if (to < 0) return null;
  return { from, to };
}

async function processArticle(file, args) {
  const slug = file.replace(/\.html$/, '');
  const date = slug.slice(0, 10);
  const full = path.join(JOURNAL_DIR, file);
  const html = fs.readFileSync(full, 'utf8');

  const range = bodyRange(html);
  if (!range) return { slug, skipped: '本文の範囲を特定できない（テンプレート外の記事）' };

  const hero = extractHeroFromHtml(html, slug, date);
  const stores = extractStores(html);
  if (!stores.length) return { slug, skipped: '記事に店舗カードが無い' };

  // 既に入っている写真は数に入れる。クォータ切れで途中までしか埋まらなかった記事を
  // 翌日の再実行で続きから埋められるようにする（同じ写真は excludeUrls で二度入らない）。
  const existing = extractBodyPhotosFromHtml(html, slug, date);
  const pol = JP.bodyPolicy();
  const have = (hero.heroUrl ? 1 : 0) + existing.length;
  const need = Math.max(0, Math.min(pol.targetTotal, pol.maxTotal) - have);
  if (!need) return { slug, skipped: `既に目安枚数（${have}枚）` };

  const photos = await JP.collectBodyPhotos(stores, {
    need,
    excludeUrls: [hero.heroUrl, ...existing.map(e => e.heroUrl)].filter(Boolean),
  });
  if (!photos.length) {
    const err = JP.placesError();
    return {
      slug,
      skipped: err
        ? `Places を引けませんでした（${err.status}）— 候補なしと同じではない。クォータ回復後に再実行を`
        : '候補なし（他店の写真は借りない）',
    };
  }

  const storeNames = stores.map(s => s.name);
  const figures = [];
  const rejected = [];
  for (const photo of photos) {
    const verdict = JP.judgeBodyPhoto(photo, { slug, date, storeNames, html });
    const fails = verdict.findings.filter(f => f.level === 'fail');
    if (fails.length) { rejected.push(`${photo.storeName}: ${fails.map(f => f.code).join(',')}`); continue; }
    const fig = JP.figureHtml(photo);
    if (fig) figures.push({ fig, photo });
  }
  if (!figures.length) return { slug, skipped: `判定に通る候補なし${rejected.length ? `（${rejected.join(' / ')}）` : ''}` };

  const body = html.slice(range.from, range.to);
  const res = JP.insertIntoBody(body, figures.map(f => f.fig));
  if (!res.inserted) return { slug, skipped: '挿入位置を決められない（見出しも段落も足りない）' };

  if (!args.dryRun) {
    fs.writeFileSync(full, html.slice(0, range.from) + res.html + html.slice(range.to));
  }
  return {
    slug,
    added: res.inserted,
    detail: figures.slice(0, res.inserted)
      .map(f => `${f.photo.storeName} [${f.photo.source}${f.photo.tier === 'user' ? '/利用者投稿' : ''}]`),
  };
}

async function main() {
  const args = parseArgs();
  let files = fs.readdirSync(JOURNAL_DIR).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f)).sort().reverse();
  if (args.days) {
    const cutoff = new Date(Date.now() - args.days * 86400000).toISOString().slice(0, 10);
    files = files.filter(f => f.slice(0, 10) >= cutoff);
  }
  if (args.only) files = files.filter(f => f.includes(args.only));
  if (args.limit) files = files.slice(0, args.limit);

  console.log('═'.repeat(78));
  console.log(`ジャーナル 本文写真の追加${args.dryRun ? '（dry-run — 書き込みません）' : ''} — 対象 ${files.length} 本`);
  console.log(`Places: ${process.env.GOOGLE_MAPS_API_KEY ? '有効' : '無効（HotPepper 写真のみ）'}`);
  console.log('═'.repeat(78));

  let added = 0, touched = 0;
  for (const f of files) {
    const r = await processArticle(f, args);
    if (r.added) {
      touched++; added += r.added;
      console.log(`✅ ${r.slug}  +${r.added}枚`);
      r.detail.forEach(d => console.log(`     - ${d}`));
    } else {
      console.log(`・ ${r.slug}  — ${r.skipped}`);
    }
  }

  console.log('─'.repeat(78));
  console.log(`${args.dryRun ? '挿入予定' : '挿入'}: ${touched}本 / 計 ${added}枚`);
  // Places の消費を共有台帳へ積む（dry-run でも API は叩いているので必ず記録する）
  const sku = JP.flushSkuUsage();
  if (sku) console.log(`Places 消費: Details ${sku.details} / Photo ${sku.photo} / TextSearch ${sku.textsearch}（data/photo_pipeline_health.json に積算）`);
  const err = JP.placesError();
  if (err) {
    console.log(`\n⚠️  Google Places が途中から引けませんでした: ${err.status}`);
    if (err.message) console.log(`   ${err.message}`);
    console.log('   → この実行で「Places を引けませんでした」と出た記事は、写真が無いのではなく取りに行けていない。');
    console.log('     日次クォータは翌日に戻るので、同じコマンドを再実行すれば続きから埋まる（冪等）。');
  }
  if (!args.dryRun && touched) {
    console.log('確認: node scripts/audit_journal_photos.js --check');
    console.log('※ 写真の中身（販促バナーが混じっていないか）は機械で判定しない。目で見てからコミットすること。');
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
