'use strict';
/**
 * scripts/lib/area_genre_pages.js
 *
 * エリア×ジャンル×条件 静的一覧ページ（stores/area/配下）の決定的プランナー。
 * data/area_genre_pages_policy.json（唯一の情報源）と data/stores.json から
 * 生成対象ページの一覧を純粋関数として計算する。副作用（ファイル書き込み）は
 * scripts/gen_area_genre_pages.js の責務で、本ファイルは持たない。
 *
 * 条件13軸の判定はすべて data/stores.json の実在フィールドだけを見る決定的な
 * 述語で、自己申告値や推測は使わない（CLAUDE.md 制約10）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'data', 'area_genre_pages_policy.json');

function loadPolicy() {
  return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
}

// ================================================================
// エリア／ジャンル正規化
// ================================================================

function buildMatchIndex(entries) {
  const idx = new Map();
  for (const e of entries) {
    for (const raw of e.match || []) idx.set(raw, e);
  }
  return idx;
}

/** stores.json の「エリア」原文 → policy の area エントリ（無ければ null） */
function normalizeArea(rawArea, policy) {
  const idx = policy.__areaIndex || (policy.__areaIndex = buildMatchIndex(policy.areas));
  const a = (rawArea || '').trim();
  return idx.get(a) || null;
}

/** stores.json の「ジャンル」原文 → policy の genre エントリ（無ければ null） */
function normalizeGenre(rawGenre, policy) {
  const idx = policy.__genreIndex || (policy.__genreIndex = buildMatchIndex(policy.genres));
  const g = (rawGenre || '').trim();
  return idx.get(g) || null;
}

// ================================================================
// 条件13軸の述語（すべて data/stores.json の実在フィールドのみ参照）
// ================================================================

function startsWithAri(v) {
  return typeof v === 'string' && /^あり/.test(v.trim());
}

const CONDITION_RULES = {
  koshitsu: s => startsWithAri(s['個室']),
  nomihodai: s => startsWithAri(s['飲み放題']),
  tabehodai: s => startsWithAri(s['食べ放題']),
  parking: s => startsWithAri(s['駐車場']),
  lunch: s => startsWithAri(s['ランチ']),

  // 深夜営業（翌1時以降）: 「翌0:xx」は除外し、翌1時〜翌12時のみ true
  lateNight: s => {
    const h = s['営業時間'];
    if (typeof h !== 'string') return false;
    const m = h.match(/翌\s*([0-9]{1,2})\s*[:：時]/);
    if (!m) return false;
    const hour = parseInt(m[1], 10);
    return hour >= 1 && hour <= 12;
  },

  // 日曜営業: 定休日に「日」を含まない。年中無休/なし/無休は true、不定休・現在・変更を含む
  // 自由記述は判定不能として false（安全側＝載せすぎない）
  sunday: s => {
    const t = (s['定休日'] || '').trim();
    if (!t) return false;
    if (/不定休|現在|変更|ご予約の状況/.test(t)) return false;
    if (/^(なし|年中無休|無休)$/.test(t)) return true;
    if (t.includes('日')) return false;
    // 「火」「月、木」等、曜日のみの自由記述で「日」を含まなければ日曜営業とみなす
    if (/^[月火水木金土日、,\s]+$/.test(t)) return true;
    return false;
  },

  smokingOk: s => {
    const v = s['禁煙'];
    return v === '禁煙席なし' || v === '一部禁煙';
  },
  nonSmoking: s => s['禁煙'] === '全面禁煙',

  group30: s => {
    const n = parseInt(s['宴会収容'], 10);
    return Number.isFinite(n) && n >= 30;
  },

  // 駅徒歩3分以内（アクセス文字列の最初の「徒歩N分」を見る）
  walk3: s => {
    const a = s['アクセス'];
    if (typeof a !== 'string') return false;
    const m = a.match(/徒歩\s*(?:約)?\s*(\d+)\s*分/);
    if (!m) return false;
    return parseInt(m[1], 10) <= 3;
  },

  // 価格帯: 「2001～3000円」のような文字列から上限/下限を取る
  budget3000: s => {
    const band = parsePriceBand(s['価格帯']);
    return !!band && band.hi !== null && band.hi <= 3000;
  },
  budget5000plus: s => {
    const band = parsePriceBand(s['価格帯']);
    return !!band && band.lo !== null && band.lo >= 5001;
  },
};

function parsePriceBand(price) {
  if (typeof price !== 'string' || !price) return null;
  const nums = price.match(/\d[\d,]*/g);
  if (!nums || nums.length === 0) return null;
  const vals = nums.map(n => parseInt(n.replace(/,/g, ''), 10));
  // 実データ（HotPepper 価格帯）は全角チルダ「～」を使う（例:「～500円」「30001円～」「2001～3000円」）。
  // 半角チルダ「〜」表記や「以上」「以下」の文言は現状の価格帯フィールドには出ないが、将来の表記ゆれに
  // 備えて両方を許容する。
  const openLow = vals.length === 1 && (/^[～〜]/.test(price) || /以下/.test(price));
  const openHigh = vals.length === 1 && (/[～〜]$/.test(price) || /以上/.test(price));
  if (openLow) return { lo: null, hi: vals[0] };
  if (openHigh) return { lo: vals[0], hi: null };
  if (vals.length >= 2) return { lo: vals[0], hi: vals[vals.length - 1] };
  return { lo: vals[0], hi: vals[0] };
}

const CONDITION_LABELS_HELP = Object.keys(CONDITION_RULES);

function storeMatchesCondition(store, ruleKey) {
  const fn = CONDITION_RULES[ruleKey];
  if (!fn) throw new Error(`area_genre_pages: unknown condition rule "${ruleKey}"`);
  try {
    return !!fn(store);
  } catch (e) {
    return false;
  }
}

// ================================================================
// アクセス要約（gen-store-pages.js のものと同一思想の軽量版。循環依存を避けるため複製せず、
// gen-store-pages.js 側が本ファイルを import する片方向依存にする）
// ================================================================
function accessSummary(access) {
  if (typeof access !== 'string' || !access) return '';
  const m = access.match(/([^\s、。]+駅)[^、。]*?徒歩\s*(?:約)?\s*(\d+)\s*分/);
  if (m) return `${m[1]}徒歩${m[2]}分`;
  return access.length > 24 ? access.slice(0, 24) + '…' : access;
}

// ================================================================
// 開店中の店舗を対象データにフィルタ
// ================================================================
function openStores(stores) {
  return stores.filter(s => {
    const st = s['営業ステータス'];
    return st !== 'CLOSED_TEMPORARILY' && st !== 'CLOSED_PERMANENTLY';
  });
}

// ================================================================
// プランナー本体
// ================================================================

/**
 * @param {Array<object>} stores data/stores.json 相当の配列
 * @param {object} policy loadPolicy() の戻り値
 * @returns {{pages: Array<PageSpec>, byCell: Map<string, Array<object>>}}
 *
 * PageSpec = { type: 'root'|'area'|'genre'|'condition', area, genre, cond, url, stores: [...] }
 */
function planPages(stores, policy) {
  const open = openStores(stores);

  // area/genre で分類
  const byCell = new Map(); // key: `${areaSlug}::${genreSlug}` -> stores[]
  const byArea = new Map(); // key: areaSlug -> stores[]（全ジャンル込み・エリアハブ用）

  for (const s of open) {
    const area = normalizeArea(s['エリア'], policy);
    const genre = normalizeGenre(s['ジャンル'], policy);
    if (!area) continue;
    if (!byArea.has(area.slug)) byArea.set(area.slug, []);
    byArea.get(area.slug).push(s);
    if (!genre) continue;
    const key = `${area.slug}::${genre.slug}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(s);
  }

  const pages = [];

  // root
  pages.push({ type: 'root', url: `${policy.baseDir}/index.html` });

  // area hubs（エリアだけで軒数を見る。全エリアがロード対象）
  for (const area of policy.areas) {
    const areaStores = byArea.get(area.slug) || [];
    if (areaStores.length < policy.hubMinStores) continue;
    pages.push({
      type: 'area', area, url: `${policy.baseDir}/${area.slug}/index.html`,
      stores: areaStores,
    });
  }

  // area×genre hubs + condition pages
  for (const area of policy.areas) {
    for (const genre of policy.genres) {
      const key = `${area.slug}::${genre.slug}`;
      const cellStores = byCell.get(key) || [];
      if (cellStores.length < policy.hubMinStores) continue;
      pages.push({
        type: 'genre', area, genre, url: `${policy.baseDir}/${area.slug}/${genre.slug}.html`,
        stores: cellStores,
      });

      for (const cond of policy.conditions) {
        const matched = cellStores.filter(s => storeMatchesCondition(s, cond.rule));
        if (matched.length < policy.conditionMinStores) continue;
        pages.push({
          type: 'condition', area, genre, cond,
          url: `${policy.baseDir}/${area.slug}/${genre.slug}-${cond.slug}.html`,
          stores: matched,
        });
      }
    }
  }

  return { pages, byCell, byArea };
}

module.exports = {
  loadPolicy,
  normalizeArea,
  normalizeGenre,
  storeMatchesCondition,
  CONDITION_RULES,
  CONDITION_LABELS_HELP,
  parsePriceBand,
  accessSummary,
  openStores,
  planPages,
};
