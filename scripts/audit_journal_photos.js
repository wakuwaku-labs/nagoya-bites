#!/usr/bin/env node
'use strict';
/**
 * ジャーナルのヒーロー写真の退行検知（CI 日次 / ローカル共通）
 *
 * 「記事と無関係な写真が顔になっていないか」を、公開済みの全記事に対して機械的に検査する。
 * 判定器は scripts/lib/hero_photo_gate.js の1本（生成時・公開前QA・この監査が同じ判定を共有する）。
 * 基準の変更は data/journal_photo_policy.json で行い、このスクリプトは触らない。
 *
 * 使い方:
 *   node scripts/audit_journal_photos.js            # 全記事のレポート
 *   node scripts/audit_journal_photos.js --check    # 違反があれば exit 1（CI向け）
 *   node scripts/audit_journal_photos.js --days 30  # 直近N日だけ見る
 *
 * ヒーローだけでなく本文写真（art-body-img）も同じ判定を通す。本文に写真を散らすように
 * なったぶん、「その記事の店の写真か」を検証しない経路を作らないため。
 *
 * 【なぜ存在するか】
 *   2026-08-17、記事の主役2店に写真が無かったため、記事に一行触れただけの別店の販促バナーが
 *   記事の顔になって公開された。validator は「汎用ストック写真でないこと」しか見ておらず、
 *   「その記事の店の写真であること」を誰も検証していなかった。検知は人がサイトを見るまで働かなかった。
 *   → 検知は人が見に行かなくても届く場所（CI）で回す（CLAUDE.md 無人自動化の監視の原則3）。
 */

const fs = require('fs');
const path = require('path');
const { judgeHero, judgePhoto, findReuse, extractHeroFromHtml, extractBodyPhotosFromHtml, loadPolicy } = require('./lib/hero_photo_gate');

const ROOT = path.resolve(__dirname, '..');
const JOURNAL_DIR = path.join(ROOT, 'journal');

function parseArgs() {
  const a = process.argv.slice(2);
  return {
    check: a.includes('--check'),
    days: a.includes('--days') ? Number(a[a.indexOf('--days') + 1]) : null,
    verbose: a.includes('--verbose'),
  };
}

function main() {
  const args = parseArgs();
  const policy = loadPolicy();

  let files = fs.readdirSync(JOURNAL_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}-.+\.html$/.test(f))
    .sort();

  if (args.days) {
    const cutoff = new Date(Date.now() - args.days * 86400000).toISOString().slice(0, 10);
    files = files.filter(f => f.slice(0, 10) >= cutoff);
  }

  const heroes = [];
  const photoCounts = [];
  const failures = [];
  const warnings = [];

  for (const f of files) {
    const slug = f.replace(/\.html$/, '');
    const date = slug.slice(0, 10);
    const html = fs.readFileSync(path.join(JOURNAL_DIR, f), 'utf8');
    const article = extractHeroFromHtml(html, slug, date);
    heroes.push({ slug, date, heroUrl: article.heroUrl });

    const verdict = judgeHero(article);
    for (const fd of verdict.findings) {
      const rec = { slug, date, ...fd, heroUrl: article.heroUrl };
      (fd.level === 'fail' ? failures : warnings).push(rec);
    }

    // 本文写真（art-body-img）— 判定はヒーローと同一
    const bodyPhotos = extractBodyPhotosFromHtml(html, slug, date);
    photoCounts.push({ slug, date, total: (article.heroUrl ? 1 : 0) + bodyPhotos.length });
    const seenInArticle = new Set([article.heroUrl].filter(Boolean));
    for (const bp of bodyPhotos) {
      if (bp.heroUrl && seenInArticle.has(bp.heroUrl)) {
        failures.push({ slug, date, level: 'fail', code: 'body_duplicate',
          msg: `同じ画像が記事内で2回使われています（ヒーローまたは他の本文写真と同一）: ${bp.heroUrl.slice(0, 70)}`,
          heroUrl: bp.heroUrl });
        continue;
      }
      if (bp.heroUrl) seenInArticle.add(bp.heroUrl);
      const v = judgePhoto(bp);
      for (const fd of v.findings) {
        const rec = { slug, date, ...fd, code: `body:${fd.code}`, heroUrl: bp.heroUrl };
        (fd.level === 'fail' ? failures : warnings).push(rec);
      }
    }
    if (args.verbose) {
      const mark = verdict.level === 'fail' ? '❌' : verdict.level === 'warn' ? '⚠️ ' : '✅';
      console.log(`${mark} ${slug}  ${(article.heroSource || '?').padEnd(12)} ${String(article.heroUrl).slice(0, 60)}`);
    }
  }

  // 使い回し（別記事の顔に同じ画像）
  const reuse = findReuse(heroes);

  console.log('═'.repeat(78));
  console.log(`ジャーナル ヒーロー写真 監査 — 対象 ${files.length} 本` + (args.days ? `（直近${args.days}日）` : ''));
  console.log(`基準: data/journal_photo_policy.json v${policy.version}（enforceFrom ${policy.enforceFrom}）`);
  console.log('═'.repeat(78));

  if (failures.length) {
    console.log(`\n❌ 違反 ${failures.length} 件 — 記事と写真の対応が壊れています\n`);
    for (const f of failures) {
      console.log(`  [${f.code}] ${f.slug}`);
      console.log(`     ${f.msg.replace(/\n/g, '\n     ')}`);
    }
  }

  const reuseFail = reuse.filter(r => r.enforced);
  const reuseWarn = reuse.filter(r => !r.enforced);

  if (reuseFail.length) {
    console.log(`\n❌ 使い回し ${reuseFail.length} 件 — 同じ画像が複数記事の顔になっています\n`);
    for (const r of reuseFail) {
      console.log(`  ${r.url.slice(0, 72)}`);
      console.log(`     → ${r.articles.join(' , ')}`);
    }
  }
  if (reuseWarn.length) {
    console.log(`\n⚠️  使い回し（基準の施行日より前・記録のみ） ${reuseWarn.length} 件\n`);
    for (const r of reuseWarn) {
      console.log(`  ${r.url.slice(0, 60)} → ${r.articles.join(' , ')}`);
    }
  }

  if (warnings.length) {
    console.log(`\n⚠️  警告 ${warnings.length} 件（証跡なし等・公開はブロックしない）\n`);
    const byCode = new Map();
    for (const w of warnings) {
      if (!byCode.has(w.code)) byCode.set(w.code, []);
      byCode.get(w.code).push(w.slug);
    }
    for (const [code, slugs] of byCode) {
      console.log(`  [${code}] ${slugs.length}本: ${slugs.slice(0, 6).join(', ')}${slugs.length > 6 ? ` ほか${slugs.length - 6}本` : ''}`);
    }
  }

  // 記事あたりの写真枚数（情報提供のみ・合否には使わない）。
  // 枚数を合否にすると、候補が足りない日に他店の写真を借りる動機が生まれる
  // （CLAUDE.md 品質ゲート原則1・4）。ここでは「今どうなっているか」を見えるようにするだけ。
  if (photoCounts.length) {
    const target = (policy.bodyPhotos || {}).targetTotal || 3;
    const dist = new Map();
    for (const p of photoCounts) dist.set(p.total, (dist.get(p.total) || 0) + 1);
    const line = Array.from(dist.entries()).sort((a, b) => a[0] - b[0])
      .map(([n, c]) => `${n}枚:${c}本`).join(' / ');
    const short = photoCounts.filter(p => p.total < target).length;
    console.log(`\n📊 記事あたりの写真枚数（目安 ${target}枚）: ${line}`);
    if (short) console.log(`   目安に届かない記事 ${short}本 — node scripts/add_journal_body_photos.js で候補を探せます`);
  }

  const bad = failures.length + reuseFail.length;
  if (!bad) {
    console.log(`\n✅ 違反ゼロ（警告 ${warnings.length} 件）`);
  } else {
    console.log(`\n合計 ${bad} 件の違反。`);
    console.log('対処: 主役店の写真が無い場合、他店の写真を借りず、記事固有のイメージ図に倒すこと。');
    console.log('      （CLAUDE.md「写真ソースの優先順」最終手段 / data/journal_photo_policy.json）');
  }

  if (args.check && bad > 0) process.exit(1);
}

if (require.main === module) main();
