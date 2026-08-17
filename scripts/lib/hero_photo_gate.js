#!/usr/bin/env node
'use strict';
/**
 * ジャーナルのヒーロー写真 — 唯一の判定器
 *
 * 方針は data/journal_photo_policy.json（唯一の情報源）に置き、ここはその適用だけを担う。
 * ヒーロー写真が記事に入る全経路がこの1ファイルを通る:
 *   scripts/generate_daily_draft.js    … 生成時（採用前に弾く）
 *   scripts/validate_journal_draft.js  … 公開前QA（項目16）
 *   scripts/audit_journal_photos.js    … 既存記事の退行検知（CI 日次）
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力:
 *     - 画像URL（HotPepper画像は data/stores.json の 写真URL から所有店名を一意に逆引きできる）
 *     - 記事HTMLに刻まれた data-hero-store / data-hero-source（成果物自身が持つ証跡）
 *     - 過去記事の hero URL（data/journal_published.json + journal/*.html）
 *   使わない入力:
 *     - 「良い写真か」「目を引くか」等、後から第三者が検算できない自己申告値。
 *       写真の見栄えは textOverlayAdvisory で扱うが、これは合否に使わない（policy参照）。
 *
 * 【2026-08-17 の事故】
 *   記事の主役2店に写真が無かったため、記事に一行触れただけの別店の販促バナーが顔になった。
 *   「実写であること」は検証されていたが「その記事の店の写真であること」は誰も見ていなかった。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'data', 'journal_photo_policy.json');

const { core, dice } = require('./photo_policy');
const { loadStores } = require('./load_stores');

let _policy = null;
function loadPolicy() {
  if (!_policy) _policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  return _policy;
}

/* ────────────────────────────────────────────────────────────────
 * 店名照合 — photo_policy.js の core()+dice() を共有する
 *   （同じ屋号を別基準で照合すると、経路ごとに判定がズレる）
 * ──────────────────────────────────────────────────────────────── */
function namesMatch(a, b, threshold) {
  if (!a || !b) return false;
  const ca = core(a), cb = core(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.includes(cb) || cb.includes(ca)) return true;
  return dice(ca, cb) >= threshold;
}

/* ────────────────────────────────────────────────────────────────
 * HotPepper 画像URL → 所有店名の逆引き（検算可能）
 * ──────────────────────────────────────────────────────────────── */
let _ownerIndex = null;
function hotpepperPhotoId(url) {
  // https://imgfp.hotp.jp/IMGH/50/38/P050945038/P050945038.jpg → P050945038
  const m = String(url || '').match(/\/(P\d{6,})(?:_\d+)?\.jpe?g/i);
  return m ? m[1].toUpperCase() : null;
}

function buildOwnerIndex() {
  if (_ownerIndex) return _ownerIndex;
  const idx = new Map(); // photoId -> Set(店名)
  const add = (name, url) => {
    const id = hotpepperPhotoId(url);
    if (!id || !name) return;
    if (!idx.has(id)) idx.set(id, new Set());
    idx.get(id).add(String(name).trim());
  };
  try {
    for (const s of loadStores()) add(s['店名'] || s.name, s['写真URL'] || s.photo_url);
  } catch (_) { /* stores.json が読めない環境では逆引き不能 → unverifiable 扱い */ }
  for (const f of ['manual_stores.json', 'pending_stores.json']) {
    const p = path.join(ROOT, 'data', f);
    if (!fs.existsSync(p)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const arr = j.stores || j.pending || (Array.isArray(j) ? j : []);
      for (const s of arr) add(s['店名'] || s.name, s['写真URL'] || s.photo_url);
    } catch (_) { /* 壊れたJSONで判定器ごと落ちないようにする */ }
  }
  _ownerIndex = idx;
  return idx;
}

/** HotPepper 画像の所有店名（複数店が同じ画像を持つことはあるので配列） */
function hotpepperOwners(url) {
  const id = hotpepperPhotoId(url);
  if (!id) return [];
  return Array.from(buildOwnerIndex().get(id) || []);
}

/* ────────────────────────────────────────────────────────────────
 * 画像ソースの分類（URL の形だけで決まる = 検算可能）
 * ──────────────────────────────────────────────────────────────── */
function classifySource(url, opts = {}) {
  const u = String(url || '');
  if (opts.isInstagramEmbed || /instagram\.com\/(p|reel|tv)\//.test(u)) return 'instagram';
  if (/imgfp\.hotp\.jp/.test(u)) return 'hotpepper';
  if (/prcdn\.freetls\.fastly\.net|prtimes\.jp\/i\//.test(u)) return 'press';
  if (/lh\d\.googleusercontent\.com|maps\.googleapis\.com\/maps\/api\/place\/photo/.test(u)) return 'places';
  if (/\/assets\/journal-figures\//.test(u)) return 'figure';
  if (/\/assets\/journal-photos\//.test(u)) return 'self-hosted';
  return 'unknown';
}

/**
 * PR TIMES 画像URL → 発行元リリースの company_id / release_id
 * 例: .../release_image/44964/1495/44964-1495-<hash>-2090x1232.jpg → {company:"44964", release:"1495"}
 * リリースURL（.../p/000001495.000044964.html）とこの2つの数字が対応するため、
 * 「記事が引用しているリリースの画像か」を機械的に照合できる（＝検算可能）。
 */
function pressReleaseIds(url) {
  const m = String(url || '').match(/release_image\/(\d+)\/(\d+)\//);
  return m ? { company: m[1], release: m[2] } : null;
}

/** 記事本文に、その画像の出所リリースへのリンクがあるか（証跡の自己完結性） */
function articleCitesRelease(html, ids) {
  if (!ids || !html) return false;
  // PR TIMES のリリースURLは 000001495.000044964 のようにゼロ詰めされる
  const rel = String(ids.release).padStart(9, '0');
  const com = String(ids.company).padStart(9, '0');
  return html.includes(`${rel}.${com}`);
}

function isStockHost(url, policy) {
  const u = String(url || '');
  return (policy.stockHosts || []).some(h => u.includes(h));
}

/* ────────────────────────────────────────────────────────────────
 * 本体: ヒーロー写真1件を判定する
 *
 * article = {
 *   slug, date,
 *   heroUrl,                 // 画像URL（IG embed のときは投稿URL）
 *   heroSource,              // 記事HTMLの data-hero-source（あれば）
 *   heroStore,               // 記事HTMLの data-hero-store（あれば）
 *   caption,                 // figcaption のテキスト
 *   storeNames: [],          // 記事が主役として扱う店名（store-card / stores[]）
 *   instagramAccounts: {},   // 店名 -> 公式Instagram URL（任意）
 * }
 * 戻り値 { ok, level: 'fail'|'warn'|'ok', findings: [{code, level, msg}] }
 * ──────────────────────────────────────────────────────────────── */
function judgeHero(article) {
  const policy = loadPolicy();
  const findings = [];
  const add = (level, code, msg) => findings.push({ level, code, msg });

  const url = article.heroUrl || '';
  const names = (article.storeNames || []).filter(Boolean);
  const th = policy.attribution.matchThreshold;

  // enforceFrom より前の記事は、当時この基準が存在しなかったため証跡が無い。
  // 「明確な誤り（別店の写真を使っている等）」は日付に関係なく FAIL、
  // 「証跡が無い・当時の仕様で画像そのものが無い」は警告に留める。
  // ゲートは正直な最良の成果物が余裕を持って通る位置に置く（CLAUDE.md 品質ゲート原則3）。
  const enforce = !policy.enforceFrom || !article.date || article.date >= policy.enforceFrom;

  if (!url) {
    add(enforce ? 'fail' : 'warn', 'hero_missing',
      'ヒーロー画像がありません（写真の自動取得が失敗した可能性）');
    return finish(findings);
  }

  // 1. 汎用ストック写真（CLAUDE.md 制約9）
  if (isStockHost(url, policy)) {
    add('fail', 'stock_photo', `汎用ストック写真を検出: ${url.slice(0, 80)}`);
  }

  // 2. キャプションの出所（出所不明のまま公開しない）
  const cap = String(article.caption || '');
  const badCap = (policy.caption.forbiddenPatterns || []).find(p => cap.includes(p));
  if (badCap) {
    add('fail', 'caption_unknown_source', `写真の出所が確定していません（キャプションに「${badCap}」）。出所を書けない写真は載せない`);
  }

  // 3. 帰属 — この記事の店の写真か
  const source = article.heroSource || classifySource(url, article);

  if (source === 'figure' || source === 'self-hosted') {
    // 記事固有であること = ファイル名に記事slugを含む
    const base = decodeURIComponent(url.split('/').pop() || '');
    const slug = article.slug || '';
    const slugCore = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const ok = slug && (base.includes(slug) || (slugCore && base.includes(slugCore)) ||
                        // 日付+主要語の部分一致（図のファイル名は短縮されることがある）
                        (slugCore.split('-').filter(w => w.length >= 4).some(w => base.includes(w))));
    if (!ok) {
      add(enforce ? 'fail' : 'warn', 'figure_not_article_specific',
        `記事固有の図ではない可能性: ${base} が記事slug(${slug})と対応しません。使い回しの図は不可（CLAUDE.md 写真ソース最終手段の条件）`);
    }
  } else if (source === 'hotpepper') {
    const owners = hotpepperOwners(url);
    if (owners.length === 0) {
      add('warn', 'hotpepper_owner_unknown',
        `HotPepper画像の所有店をデータから逆引きできませんでした: ${url.slice(0, 70)}（stores.json に無い画像）`);
    } else {
      const matched = owners.find(o => names.some(n => namesMatch(o, n, th)));
      if (!matched) {
        add('fail', 'hero_store_mismatch',
          `ヒーロー写真が記事の店の写真ではありません。\n` +
          `       画像の所有店: ${owners.join(' / ')}\n` +
          `       記事の店    : ${names.join(' / ') || '(なし)'}\n` +
          `       → 主役店の写真が無い場合、他店の写真を借りてはいけない。記事固有のイメージ図に倒すこと（CLAUDE.md 写真ソースの優先順・最終手段）`);
      }
    }
  } else if (source === 'press') {
    // プレスリリースの報道用画像（CLAUDE.md 優先3）。
    // 規約上の許諾は「報道目的」に紐づくので、その記事が本当にそのリリースを報じているか＝
    // 記事がリリースを情報源として引用しているかを、記事HTML自身で検算する。
    // 引用の無いリリース画像は「報道」ではなく単なる無断利用になる。
    const ids = pressReleaseIds(url);
    if (!article.heroStore) {
      add(enforce ? 'fail' : 'warn', 'press_attribution_missing',
        'プレスリリース写真に取得元店舗の証跡がありません。figure タグに data-hero-store="店名" を付けてください');
    } else if (!names.some(n => namesMatch(article.heroStore, n, th))) {
      add('fail', 'hero_store_mismatch',
        `プレスリリース写真の店舗（${article.heroStore}）が記事の店（${names.join(' / ') || 'なし'}）と一致しません`);
    }
    if (ids && article.html && !articleCitesRelease(article.html, ids)) {
      add('fail', 'press_release_not_cited',
        `この画像の出所リリース（company=${ids.company} / release=${ids.release}）が記事から引用されていません。\n` +
        `       報道目的の利用許諾に依拠する以上、記事はそのリリースを情報源として明示しなければなりません。\n` +
        `       → sources[] にリリースURLを追加してください`);
    }
    if (!/提供|プレスリリース/.test(cap)) {
      add('warn', 'press_credit_incomplete',
        'キャプションに提供元（発行企業名＋プレスリリースである旨）が明記されていません');
    }
  } else if (source === 'places') {
    // Places CDN の URL からは店名を逆引きできない → 成果物に刻まれた証跡で照合する
    if (article.heroStore) {
      if (!names.some(n => namesMatch(article.heroStore, n, th))) {
        add('fail', 'hero_store_mismatch',
          `ヒーロー写真の取得元店舗（${article.heroStore}）が記事の店（${names.join(' / ') || 'なし'}）と一致しません`);
      }
    } else {
      add(enforce ? 'fail' : 'warn', 'places_attribution_missing',
        `Google Places 写真に取得元店舗の証跡がありません。figure タグに data-hero-store="店名" を付けてください（URLからは逆引きできないため、証跡を成果物に持たせる）`);
    }
  } else if (source === 'instagram') {
    const acct = (url.match(/instagram\.com\/([^/]+)\/(?:p|reel|tv)\//) || [])[1];
    const known = article.instagramAccounts || {};
    if (acct && Object.keys(known).length) {
      const ok = names.some(n => {
        const a = known[n];
        return a && String(a).toLowerCase().includes(String(acct).toLowerCase());
      });
      if (!ok) {
        add('warn', 'instagram_account_unverified',
          `Instagram投稿のアカウント(@${acct})が記事の店の公式アカウントと照合できませんでした`);
      }
    }
  } else if (source === 'unknown') {
    add('fail', 'hero_source_unknown',
      `ヒーロー画像の出所を機械判定できません: ${url.slice(0, 80)}\n` +
      `       許可: Instagram embed / HotPepper / Google Places / assets/journal-figures / assets/journal-photos`);
  }

  // 4. 帰属の証跡そのものが無い（enforceFrom 以降は必須）
  if (enforce && !article.heroSource && source !== 'figure' && source !== 'self-hosted' && source !== 'instagram') {
    add('warn', 'attribution_evidence_missing',
      'figure タグに data-hero-source が付いていません（証跡なしの写真は後から検算できない）');
  }

  return finish(findings);
}

function finish(findings) {
  const hasFail = findings.some(f => f.level === 'fail');
  return {
    ok: !hasFail,
    level: hasFail ? 'fail' : (findings.length ? 'warn' : 'ok'),
    findings,
  };
}

/* ────────────────────────────────────────────────────────────────
 * 使い回し検出 — 過去記事の hero と同一URLか（検算可能）
 * heroesByArticle: [{slug, date, heroUrl}]
 * ──────────────────────────────────────────────────────────────── */
function findReuse(heroesByArticle) {
  const policy = loadPolicy();
  if (!policy.reuse.blockExactUrl) return [];
  const byUrl = new Map();
  for (const a of heroesByArticle) {
    if (!a.heroUrl) continue;
    // 記事固有の図は slug 検査で担保済み。写真だけを見る。
    if (/\/assets\/journal-(figures|photos)\//.test(a.heroUrl)) continue;
    if (!byUrl.has(a.heroUrl)) byUrl.set(a.heroUrl, []);
    byUrl.get(a.heroUrl).push(a);
  }
  const out = [];
  const win = policy.reuse.windowDays;
  for (const [url, arr] of byUrl) {
    if (arr.length < 2) continue;
    const sorted = arr.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (let i = 1; i < sorted.length; i++) {
      const days = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (days === null || days <= win) {
        // 使い回しの「加害側」は後から公開した記事。基準の施行日より前の記事は
        // 当時この基準が無かったため警告に留め、施行日以降の再発だけを違反にする。
        const offender = sorted[i];
        const enforced = !policy.enforceFrom || String(offender.date) >= policy.enforceFrom;
        out.push({ url, articles: sorted.map(a => a.slug), days, offender: offender.slug, enforced });
        break;
      }
    }
  }
  return out;
}

function daysBetween(a, b) {
  const pa = Date.parse(a), pb = Date.parse(b);
  if (Number.isNaN(pa) || Number.isNaN(pb)) return null;
  return Math.abs(pb - pa) / 86400000;
}

/* ────────────────────────────────────────────────────────────────
 * 記事HTMLから hero 情報を取り出す（audit / validator が共有）
 * ──────────────────────────────────────────────────────────────── */
function extractHeroFromHtml(html, slug, date) {
  const figMatch = html.match(/<figure class="art-hero-img"([^>]*)>([\s\S]*?)<\/figure>/);
  const isIg = /class="art-hero-ig"/.test(html);
  const attrs = figMatch ? figMatch[1] : '';
  const heroSource = (attrs.match(/data-hero-source="([^"]*)"/) || [])[1] || '';
  const heroStore = (attrs.match(/data-hero-store="([^"]*)"/) || [])[1] || '';

  let heroUrl = '';
  if (figMatch) {
    heroUrl = (figMatch[2].match(/<img[^>]*src="([^"]+)"/) || [])[1] || '';
  } else if (isIg) {
    heroUrl = (html.match(/data-instgrm-permalink="([^"]+)"/) || [])[1] || '';
  } else {
    // 旧テンプレート: figure で包まず <img class="hero-img"> を直接置いていた時期がある。
    // 抽出漏れは「画像が無い」と誤判定され、監査の信頼を落とすので拾う。
    heroUrl = (html.match(/<img[^>]*class="hero-img"[^>]*\ssrc="([^"]+)"/) || [])[1]
           || (html.match(/<img[^>]*\ssrc="([^"]+)"[^>]*class="hero-img"/) || [])[1] || '';
  }

  const caption = figMatch
    ? (figMatch[2].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || ['', ''])[1]
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const storeNames = Array.from(html.matchAll(/class="store-name">([^<]+)</g)).map(m => m[1].trim());

  return {
    slug, date,
    heroUrl,
    heroSource: heroSource || (isIg ? 'instagram' : ''),
    heroStore,
    caption,
    storeNames,
    isInstagramEmbed: isIg,
    html, // 報道用画像の「リリースを引用しているか」照合に使う
  };
}

module.exports = {
  loadPolicy,
  judgeHero,
  findReuse,
  extractHeroFromHtml,
  classifySource,
  pressReleaseIds,
  articleCitesRelease,
  hotpepperOwners,
  hotpepperPhotoId,
  namesMatch,
};
