'use strict';
/**
 * store_dedup.js — 同じ店の重複レコードを build 時に1枚へ統合する（ISSUE-132 acceptance②③）
 *
 * 背景: 手動キュレーション店（エリア＝名古屋市◯◯区）と Hot Pepper 由来店（エリア＝名駅 等）は
 * build.js の突合キー（ホットペッパーID／店名＋エリア）が噛み合わず別レコードになり、
 * 同じ店が2枚のカードで並ぶ。片方だけ食べログURL・Instagram を持つため
 * 「同じ店なのにリンクが出るカードと出ないカード」が混在していた。
 *
 * 判定は検証できる事実だけで行う（CLAUDE.md 制約10・acceptance①）:
 *   候補 = 店名完全一致  または  placeId 一致 ＋ namesMatch()（scripts/audit_duplicate_stores.js と同じ）
 * そのうえで、同一と確認できない組は統合しない（acceptance③・取り繕わない）。
 * 「統合しない」理由（ブロッカー）は次のいずれか:
 *   - placeId_conflict … 双方に placeId があり食い違う（Google 上で別の店）
 *   - ward_conflict    … 住所/エリアから取れる区が双方にあり食い違う
 *                        （例: 手動=中村区・HotPepper住所=名東区。どちらかの誤り＝同一と言えない）
 *   - hp_distinct      … 双方に別々のホットペッパーIDがあり、店名も（空白・括弧の揺れを除いて）違う
 *                        ＝HotPepper 自身が別店として載せている（例:「権兵衛 名駅店」/「権兵衛 名駅南店」）
 *   - branch_conflict  … 支店名トークンが食い違う（store_name_match.branchConflict）
 *   - number_conflict  … 店名中の数字が食い違う（「1号店」/「2号店」）
 *   - no_corroboration … placeId 経由の候補で、店名が表記揺れの範囲で一致せず、区の一致も取れない
 *                        （placeId だけで統合しない＝「うなぎのしろむら」型の Places 誤りを取り込まない）
 *
 * 統合のしかた（acceptance②）:
 *   - 非空フィールド数が最も多いレコードを残す（同数なら編集部レコード → HotPepperID持ち → 元の順）
 *   - 残すレコードに欠けているフィールドを、他のレコードから補う（上書きはしない）
 *   - 写真・Instagram・Places はフィールド束ごとに補う（別出典の値を混ぜない）
 *   - 編集部フィールド（編集部推薦・話題フラグ・キュレーター・おすすめポイント・editorReason 等）は
 *     手動キュレーション側（キュレーター持ち）の値を優先し、絶対に落とさない。真偽は OR、配列は和集合
 *
 * データを削除しない: 消えるカードの stores/<slug>.html は gen-store-pages.js の孤児扱い
 * （--check-orphans で検出のみ・削除しない）に乗る。統合ペアは recordMerges() の戻り値を
 * data/store_merge_pairs.json に記録し、後日リダイレクト等を作る材料にする。
 */

const { namesMatch, branchConflict } = require('./store_name_match');

// 手動キュレーション側の値を優先する編集部フィールド
const EDITORIAL_SCALAR_FIELDS = [
  'キュレーター', 'おすすめポイント', 'editorReason', 'insiderNote', 'visitStatus',
  '選定理由', '価格帯目安', '話題コメント', '追加日', '食べログ評価',
];
const EDITORIAL_BOOL_FIELDS = ['編集部推薦', '話題フラグ', '今日の話題'];
const EDITORIAL_ARRAY_FIELDS = ['おすすめシーン', 'トレンド情報源', 'mediaFeatures', 'insiderReviews', '掲載特集'];

// 束で補うフィールド（主キーが空のときだけ、同じ出典の値をまとめて持ってくる）
const BUNDLES = [
  { key: '写真URL', fields: ['写真URL', '写真クレジット', '写真出所', '写真幅'] },
  { key: 'Instagram', fields: ['Instagram', 'Instagram投稿URL', 'Instagram投稿URL一覧'] },
  { key: 'placeId', fields: ['placeId', 'Google評価', '口コミ数', '営業ステータス'] },
  { key: '今日の話題', fields: ['今日の話題', '今日の話題順位', '今日の話題鮮度', '今日の話題媒体数', '話題ハイライト'] },
];

function isEmpty(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'boolean') return v === false;
  return false;
}

function filledCount(s) {
  let n = 0;
  for (const k of Object.keys(s)) if (!k.startsWith('__') && !isEmpty(s[k])) n++;
  return n;
}

function isEditorial(s) {
  return !!(s && (s['キュレーター'] || s.__manual));
}

// 空白・括弧・中黒などの表記揺れだけを畳んだ店名（「食堂　灯ル」=「食堂 灯ル」）
function looseName(name) {
  return String(name || '').normalize('NFKC').toLowerCase()
    .replace(/[\s　()（）［］\[\]「」『』・･.,、。'’"“”\-ー－―]/g, '');
}

// 名古屋市の16区。正規表現の文字クラスで区名を切り出すと「中村区」「瑞穂区」等の
// 区名の一部を取りこぼすため、実在の区名一覧と突き合わせる
const NAGOYA_WARDS = ['千種区', '東区', '北区', '西区', '中村区', '中区', '昭和区', '瑞穂区',
  '熱田区', '中川区', '港区', '南区', '守山区', '緑区', '名東区', '天白区'];
// 長い区名から先に照合する（「中村区」を「中区」「村区」より先に）
const WARDS_BY_LEN = [...NAGOYA_WARDS].sort((a, b) => b.length - a.length);

function wardAfterCity(text) {
  const t = String(text || '').normalize('NFKC');
  const i = t.indexOf('名古屋市');
  if (i < 0) return '';
  const rest = t.slice(i + 4);
  return WARDS_BY_LEN.find((w) => rest.startsWith(w)) || '';
}

// 名古屋市の区（住所 → エリア の順に、区が一意に読めるときだけ返す）
function wardOf(s) {
  const fromAddr = wardAfterCity(s['住所']);
  if (fromAddr) return fromAddr;
  const area = String(s['エリア'] || '').normalize('NFKC').trim();
  const fromArea = wardAfterCity(area);
  if (fromArea) return fromArea;
  // 「昭和区 川名」のように区名で始まる手動エリア。複数区を並べた HotPepper の
  // エリア（「名古屋(名古屋駅/西区/中村区)」「中川区・港区」等）は一意でないので読まない
  const head = WARDS_BY_LEN.find((w) => area.startsWith(w));
  if (head && !/[・･/、,]/.test(area)) return head;
  return '';
}

function digitsOf(name) {
  return (String(name || '').normalize('NFKC').match(/\d+/g) || []).sort().join(',');
}

function nameGate(a, b) {
  const r1 = namesMatch(a, b);
  if (r1 && r1.ok) return true;
  const r2 = namesMatch(b, a);
  return !!(r2 && r2.ok);
}

/**
 * 2レコードが「同じ店」と確認できるか。
 * @returns {{candidate: boolean, ok: boolean, reason: string, blocker?: string}}
 */
function judgePair(a, b) {
  const na = a['店名'] || '', nb = b['店名'] || '';
  if (!na || !nb) return { candidate: false, ok: false, reason: '' };
  const exact = na === nb;
  const samePlace = !!(a.placeId && b.placeId && a.placeId === b.placeId);
  let reason = '';
  if (exact) reason = 'name_exact';
  else if (samePlace && nameGate(na, nb)) reason = 'placeid_match';
  else return { candidate: false, ok: false, reason: '' };

  const block = (blocker) => ({ candidate: true, ok: false, reason, blocker });
  if (a.placeId && b.placeId && a.placeId !== b.placeId) return block('placeId_conflict');
  const wa = wardOf(a), wb = wardOf(b);
  if (wa && wb && wa !== wb) return block('ward_conflict');
  const ha = a['ホットペッパーID'], hb = b['ホットペッパーID'];
  const looseEq = looseName(na) === looseName(nb);
  if (ha && hb && ha !== hb && !looseEq) return block('hp_distinct');
  if (branchConflict(na, nb)) return block('branch_conflict');
  const da = digitsOf(na), db = digitsOf(nb);
  if (da && db && da !== db) return block('number_conflict');
  if (reason === 'placeid_match' && !looseEq && !(wa && wb && wa === wb)) return block('no_corroboration');
  return { candidate: true, ok: true, reason };
}

function pickBase(group) {
  const ranked = group.map((s, i) => ({ s, i, n: filledCount(s) }));
  ranked.sort((x, y) =>
    (y.n - x.n) ||
    ((isEditorial(y.s) ? 1 : 0) - (isEditorial(x.s) ? 1 : 0)) ||
    ((y.s['ホットペッパーID'] ? 1 : 0) - (x.s['ホットペッパーID'] ? 1 : 0)) ||
    (x.i - y.i));
  return ranked[0].s;
}

function arrayKey(v) {
  if (v && typeof v === 'object') return v.url || v.id || JSON.stringify(v);
  return String(v);
}

function unionArrays(arrs) {
  const out = [], seen = new Set();
  for (const arr of arrs) {
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      const k = arrayKey(v);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/**
 * group（同一店と確認済みのレコード群）を base 1件に統合する。base を破壊的に更新して返す。
 * @returns {{base: object, filled: string[]}}
 */
function mergeGroup(group) {
  const base = pickBase(group);
  const others = group.filter((s) => s !== base);
  // 優先順: 手動キュレーション（編集部）レコード → 残すレコード → その他（元の順）
  const rank = (s) => (isEditorial(s) ? 0 : s === base ? 1 : 2);
  const editorialFirst = group.map((s, i) => ({ s, i }))
    .sort((x, y) => (rank(x.s) - rank(y.s)) || (x.i - y.i)).map((x) => x.s);
  const filled = new Set();
  const handled = new Set();

  // 1) 編集部フィールド: 手動キュレーション側の値を優先（base が HotPepper 由来でも落とさない）
  for (const k of EDITORIAL_SCALAR_FIELDS) {
    handled.add(k);
    const src = editorialFirst.find((s) => !isEmpty(s[k]));
    if (src && src !== base && src[k] !== base[k]) { base[k] = src[k]; filled.add(k); }
  }
  for (const k of EDITORIAL_BOOL_FIELDS) {
    if (BUNDLES.some((b) => b.fields.includes(k))) continue;
    handled.add(k);
    if (base[k] !== true && group.some((s) => s[k] === true)) { base[k] = true; filled.add(k); }
  }
  for (const k of EDITORIAL_ARRAY_FIELDS) {
    handled.add(k);
    const merged = unionArrays(editorialFirst.map((s) => s[k]));
    if (merged.length && merged.length !== (Array.isArray(base[k]) ? base[k].length : 0)) {
      base[k] = merged; filled.add(k);
    }
  }
  if (Array.isArray(base.insiderReviews)) base.insiderReviewCount = base.insiderReviews.length;
  handled.add('insiderReviewCount');
  const scores = group.map((s) => Number(s['話題スコア'])).filter(Number.isFinite);
  handled.add('話題スコア');
  if (scores.length) {
    const max = Math.max(...scores);
    if (Number(base['話題スコア']) !== max) { base['話題スコア'] = max; filled.add('話題スコア'); }
  }

  // 2) 束: 主キーが空なら、主キーを持つ最初のレコードから束ごと持ってくる
  for (const b of BUNDLES) {
    b.fields.forEach((f) => handled.add(f));
    if (!isEmpty(base[b.key])) continue;
    const src = others.find((s) => !isEmpty(s[b.key]));
    if (!src) continue;
    for (const f of b.fields) {
      if (!isEmpty(src[f])) { base[f] = src[f]; filled.add(f); }
    }
  }

  // 3) その他: 空欄だけを補う（上書きしない）
  for (const s of others) {
    for (const k of Object.keys(s)) {
      if (k.startsWith('__') || handled.has(k)) continue;
      if (isEmpty(base[k]) && !isEmpty(s[k])) { base[k] = s[k]; filled.add(k); }
    }
  }
  return { base, filled: [...filled].sort() };
}

/**
 * stores 配列の重複を統合する（非破壊: 新しい配列を返す。統合先レコードは更新される）。
 * @param {object[]} stores
 * @param {{slugOf?: (s:object)=>string}} [opts]
 * @returns {{stores: object[], merged: object[], skipped: object[]}}
 */
function dedupeStores(stores, opts = {}) {
  const slugOf = typeof opts.slugOf === 'function' ? opts.slugOf : () => '';
  const n = stores.length;

  // 候補ペア（店名完全一致 / placeId 一致）だけを列挙する（全ペア比較はしない）
  const buckets = new Map();
  const addBucket = (key, i) => {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  };
  stores.forEach((s, i) => {
    if (s['店名']) addBucket(`n:${s['店名']}`, i);
    if (s.placeId) addBucket(`p:${s.placeId}`, i);
  });
  const pairKeys = new Set();
  const pairs = [];
  for (const idx of buckets.values()) {
    if (idx.length < 2) continue;
    for (let x = 0; x < idx.length; x++) {
      for (let y = x + 1; y < idx.length; y++) {
        const i = Math.min(idx[x], idx[y]), j = Math.max(idx[x], idx[y]);
        const k = `${i}:${j}`;
        if (pairKeys.has(k)) continue;
        pairKeys.add(k);
        pairs.push([i, j]);
      }
    }
  }
  pairs.sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));

  // union-find。結合は「両クラスタの全メンバー同士でブロッカーが無い」ときだけ
  // （A=B・B=C でも A と C が区で食い違えば推移的に繋げない）
  const parent = Array.from({ length: n }, (_, i) => i);
  const members = new Map();
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const membersOf = (r) => members.get(r) || [r];
  const skipped = [];
  const reasonOf = new Map();
  for (const [i, j] of pairs) {
    const v = judgePair(stores[i], stores[j]);
    if (!v.candidate) continue;
    if (!v.ok) {
      skipped.push({ names: [stores[i]['店名'], stores[j]['店名']], hpIds: [stores[i]['ホットペッパーID'] || '', stores[j]['ホットペッパーID'] || ''], reason: v.reason, blocker: v.blocker });
      continue;
    }
    const ri = find(i), rj = find(j);
    if (ri === rj) continue;
    const mi = membersOf(ri), mj = membersOf(rj);
    let blocker = '';
    for (const a of mi) {
      for (const b of mj) {
        if (a === i && b === j) continue;
        const w = judgePair(stores[a], stores[b]);
        if (w.candidate && !w.ok) { blocker = w.blocker; break; }
        // 候補にならない組（名前も placeId も違う）でも、区・placeId の食い違いは結合を止める
        if (!w.candidate) {
          const sa = stores[a], sb = stores[b];
          if (sa.placeId && sb.placeId && sa.placeId !== sb.placeId) { blocker = 'placeId_conflict'; break; }
          const wa = wardOf(sa), wb = wardOf(sb);
          if (wa && wb && wa !== wb) { blocker = 'ward_conflict'; break; }
        }
      }
      if (blocker) break;
    }
    if (blocker) {
      skipped.push({ names: [stores[i]['店名'], stores[j]['店名']], hpIds: [stores[i]['ホットペッパーID'] || '', stores[j]['ホットペッパーID'] || ''], reason: v.reason, blocker: `transitive_${blocker}` });
      continue;
    }
    parent[rj] = ri;
    members.set(ri, mi.concat(mj));
    members.delete(rj);
    const rs = reasonOf.get(ri) || new Set();
    for (const r of [v.reason, ...(reasonOf.get(rj) || [])]) rs.add(r);
    reasonOf.set(ri, rs);
    reasonOf.delete(rj);
  }

  const drop = new Set();
  const merged = [];
  const roots = [...members.keys()].sort((a, b) => Math.min(...membersOf(a)) - Math.min(...membersOf(b)));
  for (const r of roots) {
    const idx = membersOf(r).slice().sort((a, b) => a - b);
    const group = idx.map((i) => stores[i]);
    const snap = group.map((s) => ({ 店名: s['店名'] || '', エリア: s['エリア'] || '', ホットペッパーID: s['ホットペッパーID'] || '', placeId: s.placeId || '', slug: slugOf(s) }));
    const { base, filled } = mergeGroup(group);
    const baseIdx = idx[group.indexOf(base)];
    for (const i of idx) if (i !== baseIdx) drop.add(i);
    merged.push({
      reasons: [...(reasonOf.get(r) || [])].sort(),
      kept: snap[group.indexOf(base)],
      absorbed: snap.filter((_, k) => group[k] !== base),
      filledFields: filled,
    });
  }
  return { stores: stores.filter((_, i) => !drop.has(i)), merged, skipped };
}

module.exports = { dedupeStores, judgePair, mergeGroup, wardOf, looseName, pickBase };
