#!/usr/bin/env node
/**
 * 店舗写真の採用基準 — 唯一の判定器
 *
 * 方針は data/photo_policy.json（唯一の情報源）に置き、ここはその適用だけを担う。
 * 「新規店に基準を設ける」＝写真がサイトに入る全経路がこの1ファイルを通ること。
 *
 * 現在この判定器を通る経路:
 *   scripts/fetch_manual_store_photos.js  … 手動店・pending 店の Places 写真取得（日次CI）
 *   scripts/audit_photo_policy.js         … 既存データの退行検知（CI）
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力: Places API が返す authorAttributions（クレジット名）と widthPx/heightPx。
 *   使わない入力: 「品質スコア」「見栄え」等、後から第三者が検算できない自己申告値。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'data', 'photo_policy.json');

let _policy = null;
function loadPolicy() {
  if (!_policy) _policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  return _policy;
}

/**
 * 比較用の正規化（Unicode 正規化 → 記号・空白の除去）。
 *
 * NFKC を先に掛けるのは、Google が返すクレジット名と我々の店名で
 * 「見た目が同じで符号位置が違う文字」が混在するため。実測（2026-08-29）:
 *   店名「那古野 しば福や 名駅店」の 福 = U+798F
 *   クレジット「那古野 しば福や 名駅店」の 福 = U+FA1B（CJK互換漢字）
 * この1文字差だけで包含判定が外れ、Dice が 0.44 まで落ちて
 * **オーナー本人が上げた写真が「客投稿」と誤判定されて捨てられていた**。
 * NFKC は互換漢字・全角英数・半角カナを正規形へ畳むだけで、別の店名を
 * 同一視することはないため、ゲートを緩めずに誤判定だけを消せる。
 */
function norm(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[\s　・,，、。\-—–_|｜()（）【】「」『』:：'"’”]/g, '')
    .toLowerCase();
}

/**
 * 屋号のコアだけを取り出す正規化。
 *
 * オーナーが Google ビジネスプロフィールに登録する名称と、サイト側の店名は
 * 支店名・地名の入れ方が揺れる（実例: 店名「福恩麻辣湯 大曽根店」に対して
 * クレジット「福恩麻辣湯 名古屋大曽根店」）。ここを素の Dice で見ると同一店を
 * 別名義と誤判定するため、fetch_manual_store_photos.js の namesMatch と同じ発想で
 * 一般語（ジャンル語・地名・支店表記）を落としてから比較する。
 *
 * ※ これは閾値を緩めているのではなく、比較する文字列を揃えているだけ。
 *   閾値を動かして全部通るようにするのはゲートを壊すのと同じ（CLAUDE.md 品質ゲートの原則5）。
 */
const GENERIC_WORDS = /専門店?|本格|個室|炭火焼?き?|焼き?鳥|焼肉|餃子|ラーメン|拉麺|らーめん|居酒屋|酒場|バー|カフェ|喫茶|鮨|寿司|うなぎ|鰻|天ぷら|割烹|会席|懐石|中華|中国料理|イタリアン|フレンチ|ビストロ|スイーツ|大福|プリン|チーズケーキ|パフェ|ジェラート|クレープ|トースト|サンド|カレー|ビュッフェ|ランチ|鉄板焼き?|ホルモン|和牛|おまかせ|カウンター|コース|本店|支店|[^\s]{1,6}店|名古屋|愛知|栄|伏見|名駅|大須|金山|今池|覚王山|藤が丘|星ヶ丘/g;
function core(s) {
  return norm(String(s || '').replace(GENERIC_WORDS, ''));
}

/** 文字bigram Dice係数（fetch_manual_store_photos.js と同じ定義） */
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : (a.includes(b) || b.includes(a) ? 0.7 : 0);
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b);
  let inter = 0, total = 0;
  for (const [g, c] of A) { total += c; if (B.has(g)) inter += Math.min(c, B.get(g)); }
  for (const [, c] of B) total += c;
  return (2 * inter) / total;
}

/**
 * 既知の表記ゆれ許可リスト（ローマ字↔カタカナ等）。人手で実在・同一店を確認済みの事実表。
 * 店名マッチ（fetch_manual_store_photos.js の namesMatch）とクレジット名マッチの
 * 双方が同じ表を見るように、ここを唯一の置き場所にする。
 * key: 店名, value: 相手側に含まれていれば同一名義とみなすトークン配列
 */
const VERIFIED_ALIASES = {
  '麺や 六三六': ['六三六'],
  'COFFEE KAJITA': ['カジタ', 'kajita', 'コーヒーカジタ'],  // コーヒーカジタ = 2026-08-30 に Places が返した名前
  'TRUNK COFFEE': ['トランクコーヒー', 'trunk coffee'],
  '矢場とん 本店': ['矢場とん'],
  'まるや本店 名古屋駅店': ['まるや本店'],
  'やきとり大吉 今池店': ['やきとり大吉'],
  'レストランくるみ': ['くるみ'],
  '木曽路 名駅IMAI店': ['木曽路'],
  // 2026-07-25 実在検証済み（WebSearch/食べログ/公式サイトで同一店確認）
  'コーヒーハウス KAKO 花車本店': ['かこ 花車', 'コーヒーハウスかこ', 'coffee house kako'],
  '中華そば 雷杏 -RYAN- 名駅店': ['雷杏', 'ライアン'],
  "BOUL'ANGE 名古屋タカシマヤゲートタワーモール店": ['ブールアンジュ', 'ブール アンジュ', "boul'ange"],
  '韓国料理 ベジテジや 栄店': ['ベジテジや'],
  'kitchen HAKUGA': ['ハクガ', 'hakuga'],
  'KimiTote (キミトテ)': ['キミトテ', 'kimitote'],
  '淡 如雲 (アワイ ジョウン)': ['如雲', 'ジョウン'],
  'レミニセンス (Reminiscence)': ['レミニセンス', 'reminiscence'],
  'カーサ・オリーバ (CASA OLIVA)': ['カーサオリーバ', 'casa oliva'],
  '鮨屋 とんぼ 住吉店': ['鮨屋とんぼ'],
  // 2026-08-30 追加。いずれも「Google Places / HotPepper が実際にその店として返した名前」を
  // そのまま別名義として登録したもの（＝観測できた事実。第三者が同じ店を引けば再現できる）。
  // 短い別名義（カジタ等）は支店を特定できないため包含の下限で落ちる仕様になったので、
  // 屋号まるごとの表記を登録して拾い直す（scripts/lib/store_name_match.js の注記参照）。
  'PASTA MANIA 鶴舞店': ['パスタマニア鶴舞店'],
  'LIGNIN': ['リグニン'],
};

/**
 * クレジット名が「店舗オーナー投稿」を示すか。
 *
 * Google ビジネスプロフィールからオーナーが上げた写真は、クレジットが店名になる。
 * 客が上げた写真は個人名（例: "Yuzuki Arai" ← コメダ珈琲 本店）になる。
 * 和英の表記ゆれがあるため 英語名 とも突き合わせる（例: "トランクコーヒー" ← "TRUNK COFFEE"）。
 *
 * @returns {{owner: boolean, sim: number, matchedAgainst: string}}
 */
function isOwnerAttribution(attribution, storeName, englishName) {
  const p = loadPolicy().places;
  const a = norm(attribution);
  if (!a) return { owner: false, sim: 0, matchedAgainst: '' };
  // "Google Maps" は帰属不明時に fetch 側が入れる既定値。オーナー証明にはならない。
  if (a === norm('Google Maps')) return { owner: false, sim: 0, matchedAgainst: '' };

  // 人手検証済みの表記ゆれ（"トランクコーヒー" ← "TRUNK COFFEE" 等）
  const aliases = VERIFIED_ALIASES[storeName];
  if (aliases && aliases.some((x) => a.includes(norm(x)) || norm(x).includes(a))) {
    return { owner: true, sim: 1, matchedAgainst: '別名義(検証済)' };
  }

  const ac = core(attribution);
  let best = { owner: false, sim: 0, matchedAgainst: '' };
  for (const [label, cand] of [['店名', storeName], ['英語名', englishName]]) {
    const n = norm(cand);
    if (!n) continue;
    // 片方がもう片方を含む＝同一名義（"矢場とん" ⊂ "矢場とん 本店" 等）
    if (n.includes(a) || a.includes(n)) return { owner: true, sim: 1, matchedAgainst: label };
    // 支店名・地名の揺れを落としたコア同士の包含（"福恩麻辣湯 大曽根店" ↔ "福恩麻辣湯 名古屋大曽根店"）
    const nc = core(cand);
    if (ac.length >= 2 && nc.length >= 2 && (nc.includes(ac) || ac.includes(nc))) {
      return { owner: true, sim: 0.9, matchedAgainst: `${label}(コア一致)` };
    }
    const sim = Math.round(Math.max(dice(a, n), dice(ac, nc)) * 100) / 100;
    if (sim > best.sim) best = { owner: sim >= p.attributionMatchThreshold, sim, matchedAgainst: label };
  }
  return best;
}

/**
 * Places の写真1枚が採用基準を満たすか。
 *
 * @param {object} photo   Places details の photos[i]（width/height または widthPx/heightPx）
 * @param {string} attribution クレジット名（html_attributions からタグを除いたもの）
 * @param {object} store   店（店名・英語名を参照）
 * @returns {{ok: boolean, reason: string, detail: string, sim: number}}
 */
function judgePlacesPhoto(photo, attribution, store) {
  const p = loadPolicy().places;
  if (!photo) return { ok: false, reason: 'no-photo', detail: '', sim: 0 };

  const w = Number(photo.widthPx || photo.width || 0);
  const h = Number(photo.heightPx || photo.height || 0);

  if (p.minWidthPx && w && w < p.minWidthPx) {
    return { ok: false, reason: 'too-small', detail: `${w}x${h} < ${p.minWidthPx}px`, sim: 0 };
  }
  if (p.rejectPortrait && w && h && h > w * p.portraitRatioThreshold) {
    return { ok: false, reason: 'portrait', detail: `${w}x${h}`, sim: 0 };
  }
  if (p.requireOwnerAttribution) {
    const r = isOwnerAttribution(attribution, store['店名'], store['英語名']);
    if (!r.owner) {
      // 疑わしきは載せない。取り繕うより「写真なし」の方がサイトの信頼を守る。
      return { ok: false, reason: 'not-owner-photo', detail: `credit="${attribution}"`, sim: r.sim };
    }
    return { ok: true, reason: 'owner-photo', detail: `credit="${attribution}" (${r.matchedAgainst})`, sim: r.sim };
  }
  return { ok: true, reason: 'ok', detail: '', sim: 0 };
}

/** html_attributions の1件目からタグを剥いでクレジット名を取り出す */
function attributionName(photo) {
  const raw = photo?.html_attributions?.[0] || photo?.authorAttributions?.[0]?.displayName || '';
  return String(raw).replace(/<[^>]+>/g, '').trim();
}

/** 写真URLが Places 由来（＝帰属ゲートの対象）か */
const isPlacesPhotoUrl = (u) => /googleusercontent\.com/.test(String(u || ''));

// core() は scripts/lib/hero_photo_gate.js（ジャーナルのヒーロー写真の帰属判定）でも使う。
// 同じ屋号を経路ごとに別基準で照合すると判定がズレるため、正規化はここ1本に集約する。
module.exports = { loadPolicy, isOwnerAttribution, judgePlacesPhoto, attributionName, isPlacesPhotoUrl, norm, core, dice, VERIFIED_ALIASES };
