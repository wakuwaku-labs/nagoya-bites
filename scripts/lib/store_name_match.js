#!/usr/bin/env node
/**
 * 店名の同一性判定 — 唯一の判定器
 *
 * 「外部サービスが返した店名」と「我々の店名」が同じ店を指すかを判定する。
 * 架空店ブロック（CLAUDE.md）の門番のうち、名前ゲートの実装がここ1本。
 *
 * この判定器を通る経路:
 *   scripts/fetch_manual_store_photos.js        … Google Places の候補が同じ店か
 *   scripts/fill_missing_photos_from_hotpepper.js … HotPepper の候補が同じ店か
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力: 双方の店名文字列だけ。第三者が同じ2つの文字列を突き合わせれば再現できる。
 *   使わない入力: 「たぶん同じ店だと思う」等の自己申告。
 *
 * ※ 表記ゆれ許可リスト（VERIFIED_ALIASES）は scripts/lib/photo_policy.js が唯一の置き場所。
 *   店名マッチ（ここ）と写真クレジットのオーナー判定が同じ表を見るようにするため。
 */
const { VERIFIED_ALIASES } = require('./photo_policy');

// 店名照合用の正規化で落とす一般語（ジャンル語・支店表記・地名）
const GENRE_WORDS = /専門店?|本格|個室|炭火焼?き?|焼き?鳥|焼肉|餃子|ラーメン|拉麺|らーめん|居酒屋|酒場|バー|カフェ|喫茶|鮨|寿司|うなぎ|鰻|天ぷら|割烹|会席|懐石|中華|中国料理|イタリアン|フレンチ|ビストロ|スイーツ|大福|プリン|チーズケーキ|パフェ|ジェラート|クレープ|トースト|フレンチトースト|サンド|カレー|ビュッフェ|ランチ|鉄板焼き?|ホルモン|和牛|神戸牛|名古屋コーチン|おまかせ|カウンター|コース|店|名古屋/g;

function norm(s) {
  // 〜/～（波ダッシュ・キャッチコピー装飾）は表記ゆれの典型（例:
  // 「今日もパスタ日より ボロネ時々カルボ」= HotPepper側「今日もパスタ日より～ボロネーゼ時々カルボ～」
  // で装飾ぶんの差だけで一致度が0.85を割っていた・2026-08-18実測）なので除去対象に含める。
  //
  // NFKC は「見た目が同じで符号位置が違う文字」（CJK互換漢字 福 U+FA1B・全角英数・半角カナ）を
  // 正規形へ畳む。scripts/lib/photo_policy.js の norm() と同じ理由・同じ順序で掛ける
  // （店名ゲートとクレジット判定で正規化がズレると、片方だけ通る店が出る）。
  return String(s || '').normalize('NFKC').replace(/[\s　・,，、。\-—–|｜()（）【】「」『』:：〜～]/g, '').toLowerCase();
}

function core(s) {
  return norm(String(s || '').replace(GENRE_WORDS, ''));
}

// 文字bigram Dice係数
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  if (a.length < 2 || b.length < 2) return a === b ? 1 : (a.includes(b) || b.includes(a) ? 0.7 : 0);
  const A = bg(a), B = bg(b); let inter = 0, total = 0;
  for (const [g, c] of A) { total += c; if (B.has(g)) inter += Math.min(c, B.get(g)); }
  for (const [, c] of B) total += c;
  return (2 * inter) / total;
}

/**
 * 部分一致を「同一店の根拠」と認めてよいか。
 *
 * 素の包含（a ⊂ b）は短い側が短いほど当てずっぽうになる。実測（2026-08-29・
 * 既存カタログの HotPepper 4,796件を候補にして写真なし店を照合した結果）:
 *   「旬彩料理 澤」  ⊃「彩」        → 1文字の包含で別店を同一店と判定
 *   「レストランくるみ」⊃「トラ」    → "レス**トラ**ン" に "カフェトラ" のコアが刺さる
 *   「焼肉酒場 番長」 ⊃「番長」      → ジャンル語を落とした2文字コアが刺さる
 * いずれも「別の店の写真をその店の顔にする」事故（ISSUE-090 と同型）に直行する。
 *
 * そこで包含は「短い側が4文字以上、かつ長い側の半分以上を占める」ときだけ認める。
 * 閾値を緩めているのではなく、**根拠として弱すぎる一致を根拠と数えない**ための下限。
 * 実データで確認した正しい一致はこの下限を満たす（矢場とん⊂矢場とん本店=0.67 /
 * lignin⊂ligninリグニン=0.55 / サウィ食堂⊂サウィ食堂名古屋栄店=0.5）。
 *
 * 【承知の上で切り捨てているもの】
 * カタログ全体で照合した結果、この下限で新たに落ちる正しい対は
 * 「メ有リー」⊂「居酒屋メ有リー（メアリー）栄・住吉店」= 0.36 の1件だけだった。
 * 比率を 0.35 まで下げれば拾えるが、誤判定側の最大値（矢場とん⊂レストランわらじや矢場とん
 * = 0.31）との差が 0.04 しかなく、実データに合わせて数字を動かすのはゲートを壊すのと同じ
 * （CLAUDE.md 品質ゲートの原則5）。**取りこぼしは「写真なし」で済むが、誤判定は
 * 「別の店の写真を載せる」になる**ため、安全な側に倒したままにする。
 */
const MIN_CONTAINED_CHARS = 4;
const MIN_CONTAINED_RATIO = 0.5;
function containmentOk(a, b, allowSuffix) {
  if (!a || !b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short === long) return true;
  // 「端から」の一致だけを認める（先頭 or 末尾）。日本語の店名は
  //   ［ジャンル語］＋ 屋号 ＋［支店名］
  // の形を取るため、同じ店の別表記は必ずどちらかの端で揃う:
  //   「うなぎ 和食 しら河 浄心本店」⊃「しら河 浄心本店」（末尾で一致・ジャンル語が前に付いただけ）
  //   「サウィ食堂 名古屋栄店」⊃「サウィ食堂」        （先頭で一致・支店名が後に付いただけ）
  // 逆に**真ん中に紛れ込む一致**は、屋号の一致ではなく他人の名前の混入である:
  //   「昔の矢場とん 大須」⊃「矢場とん」  … 別屋号が有名店名を含んでいるだけ
  // 比率の下限（0.5）だけでは分離できない（この例は 0.5 を満たす）ので、位置も見る。
  //
  // 末尾一致を許すのは**素の店名同士を比べるときだけ**（allowSuffix）。
  // ジャンル語を落とした core 同士では許さない: core は片側からジャンル語を消しているため、
  // 相手側に残った別のジャンル語を「ただの前置き」と誤読してしまう。実例（2026-08-29）:
  //   「鮨 いちかわ」→ core「いちかわ」が「天麩羅いちかわ」の末尾に一致してしまう。
  //   鮨屋と天麩羅屋は別の店であり、ここを通すと別店の写真が載る。
  if (!long.startsWith(short) && !(allowSuffix && long.endsWith(short))) return false;
  return short.length >= MIN_CONTAINED_CHARS && short.length / long.length >= MIN_CONTAINED_RATIO;
}

/**
 * 照合に使う店名の変種を作る。
 *
 * 読み仮名や別名義が括弧で併記された店名（「那古野 しば福や 名駅店 (なごの しばふくや …)」
 * 「KimiTote (キミトテ)」）は、括弧の中と外がそれぞれ独立した「その店の名前」になっている。
 * 括弧ごと1本の文字列として比べると、括弧の外だけを名乗る相手（＝正しい相手）との
 * 一致率が読み仮名のぶんだけ薄まる。そこで「括弧を落とした形」も候補に持たせる。
 *
 * ※ 逆に「括弧の中だけ」は候補にしない。括弧の中身は読み仮名とは限らず、
 *   「かき氷 うと（栄マルエイガレリア店）」のように**商業施設名**が入ることがあり、
 *   それ単体で照合すると同じ施設に入る無関係な店（亀屋 栄 マルエイガレリア店）と
 *   一致してしまう（2026-08-29 実測）。読み仮名・別名義は VERIFIED_ALIASES で扱う。
 */
function variants(name) {
  const s = String(name || '');
  const out = [norm(s)];
  const outside = norm(s.replace(/[（(][^）)]*[）)]/g, ''));
  if (outside && !out.includes(outside)) out.push(outside);
  return out.filter(Boolean);
}

/**
 * 店名 vs 外部サービスの店名 の一致判定。
 * @returns {{ok: boolean, sim: number}}
 */
function namesMatch(storeName, matchedName) {
  const sn = norm(storeName), mn = norm(matchedName);
  if (!mn) return { ok: false, sim: 0 };
  // 確認済みの表記ゆれ（人手で実在・同一店を確認した事実表）。
  // 別名義そのものが短い（「くるみ」「矢場とん」等）ため、ここにも包含の下限を課す。
  //
  // 【この下限が別名義に効くことの意味】
  // 3文字以下の別名義（六三六 / カジタ / くるみ / 木曽路 / 雷杏 / ハクガ / 如雲）は、
  // 相手の店名と完全一致するときしか通らなくなる。人が同一店だと確認した表であっても、
  // 「六三六」のような短い屋号は**どの支店を指すかを特定できない**ためで、実際に
  // 「麺や 六三六」（名駅）に対して Google が返した「六三六 大須本店」を、旧実装は
  // 同一店として採用しようとしていた（2026-08-29 実測）。別支店の写真を載せるくらいなら
  // 写真なしのままにする。より具体的な別名義（支店名を含む形）を表に足せば拾える。
  const aliases = VERIFIED_ALIASES[storeName];
  if (aliases && aliases.some(a => containmentOk(norm(a), mn, true))) return { ok: true, sim: 1 };
  for (const sv of variants(storeName)) {
    for (const mv of variants(matchedName)) {
      if (containmentOk(sv, mv, true)) return { ok: true, sim: 1 };
    }
  }
  const sc = core(storeName), mc = core(matchedName);
  // コア（ジャンル語除去後）の包含 or 高Dice
  // core 同士は末尾一致を許さない（上の containmentOk のコメント参照）
  if (containmentOk(sc, mc, false)) return { ok: true, sim: 0.9 };
  const sim = Math.max(dice(sn, mn), dice(sc, mc));
  return { ok: sim >= 0.85, sim: Math.round(sim * 100) / 100 };
}

/**
 * 支店名トークン（「◯◯店」）を取り出す。
 *
 * 店名ゲート（Dice / 包含）だけでは同一チェーンの別支店を分離できない。実測:
 *   「スパゲッティハウス ヨコイ 錦店」vs「… 住吉店」= Dice 0.88（閾値0.85超）
 *   「やきとり大吉 今池店」vs「やきとり大吉 浅間町店」= 別名義「やきとり大吉」で一致してしまう
 * 屋号が長い／別名義が屋号だけだと、支店名の差が判定に効かない。
 * ＝ここを見ないと「別支店の写真が店の顔になる」（ISSUE-090 と同型）。
 *
 * 空白で区切られた末尾の「◯◯店」だけを支店名とみなす。空白が無い名前
 * （例「コメダ珈琲店」）は屋号の一部なので支店名として扱わない（取りこぼしを増やさない）。
 */
function branchToken(name) {
  // 上限を 24 文字にしているのは、商業施設名がそのまま支店名になるため。
  // 短すぎると「名古屋タカシマヤゲートタワーモール店」「JR名古屋髙島屋店」が
  // どちらもトークンとして取れず、別館の店を同一店として通してしまう（2026-08-30 実測）。
  const m = String(name || '').normalize('NFKC').trim().match(/[\s　]([^\s　]{1,24}店)$/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * 支店名の表記ゆれを畳む。同じ支店でも媒体ごとに書き方が揺れる（実測 2026-08-30）:
 *   「泉店」↔「泉本店」 /「大曽根店」↔「名古屋大曽根店」
 *   「名古屋タカシマヤゲートタワーモール店」↔「ゲートタワーモール店」
 * 「本」「名古屋」「駅」を落としたうえで、一方が他方を含めば同じ支店とみなす。
 */
function branchCore(token) {
  return String(token || '').replace(/本|名古屋|駅/g, '').replace(/店$/, '');
}

/**
 * 双方に支店名が書かれていて、それが食い違っていないか。
 * 片方にしか無い場合は判定しない（住所・区で裏を取る側に委ねる）。
 */
function branchConflict(a, b) {
  const x = branchToken(a), y = branchToken(b);
  if (!x || !y || x === y) return false;
  const cx = branchCore(x), cy = branchCore(y);
  if (!cx || !cy) return false;                       // 「本店」同士など、核が消える組は判定しない
  return !(cx === cy || cx.includes(cy) || cy.includes(cx));
}

module.exports = { namesMatch, branchToken, branchConflict, branchCore, norm, core, dice, GENRE_WORDS };
