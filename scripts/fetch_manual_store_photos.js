#!/usr/bin/env node
// 編集部が足した店に Google Maps の実写真を取得して 写真URL に設定する。
// Google が見つけられない店だけ既存の店舗固有SVG（＝プレースホルダー）を維持する。
//
// 【対象データ（ISSUE-076 で pending を追加）】
//   data/manual_stores.json … 手動キュレーション店（stores 配列）
//   data/pending_stores.json … ジャーナル経由で採用した外部媒体由来の話題店（pending 配列）
//     ※ pending は merge_pending_stores.js でカタログに合流するが、これまで写真取得の
//        対象外だったため「HotPepper ID を持たない店」が恒久的に写真ゼロのまま
//        トップの人気カード等に出ていた。両方を同じ三重ゲートで処理する。
//
// Google Places API（textsearch → place/details → place/photo CDN URL）を使用。
// textsearch は複数候補を返すため、店名ゲート（namesMatch）を通る候補が出るまで順に試す
// （2026-08-18: findplacefromtext の単一候補仕様が同一チェーンの別店舗に化ける事故があったため変更）。
// 要 GOOGLE_MAPS_API_KEY（または GOOGLE_PLACES_API_KEY）環境変数。
// place/photo が返す lh3.googleusercontent.com の CDN URL を保存（APIキーはHTMLに埋め込まない）。
//
// 使い方:
//   GOOGLE_MAPS_API_KEY=xxxx node scripts/fetch_manual_store_photos.js [--force] [--limit N] [--only <店名の一部>]
//   --only は指定店だけを対象に強制再判定する（既存写真の有無を問わない）。
//   採用基準の後付け改定（data/photo_policy.json）で個別店の客投稿写真を洗い直すときに使う。
// 取得後:
//   node build.js && node gen-store-pages.js
//
// 【再試行クールダウン（2026-08-21・Places API課金の実測調査で判明）】
// このスクリプトは build.yml の全実行（push契機・毎日約18回）で無条件に走り、写真の無い
// 店は毎回フルの textsearch+details を打ち直していた。Google側のデータは数時間では
// 変わらないのに、同じ「客投稿しかない/解像度不足」な店（実測75件超）を1日十数回、
// 何ヶ月も課金し続けていた計算になり、これが ¥1,500/月の Places API 予算アラートが
// 無料トライアル失効の翌日（2026-08-20）に即座に100%到達した主因と推定される
// （週次の weekly-places.yml 側は 100件/週の予算制御込みで¥1,429/月と別枠で見積もり済み）。
// 前回「試行した」事実だけを記録し（成功/失敗を問わない）、COOLDOWN_DAYS 以内に再試行
// 済みの店はスキップする。Google側の在庫は日次で動くものではないため、取りこぼしより
// 無駄打ちを減らす方を優先する。--force / --only は従来通りクールダウンを無視する。

const fs = require('fs');
const path = require('path');
const https = require('https');
// 写真の採用基準（オーナー投稿か／解像度）は data/photo_policy.json が唯一の情報源。
// 判定器を共有することで、この取得経路と audit_photo_policy.js の判定が食い違わないようにする。
const { loadPolicy, pickPhoto, attributionName } = require('./lib/photo_policy');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual_stores.json');
const PENDING_JSON = path.join(ROOT, 'data', 'pending_stores.json');
const KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
// 失敗した店を毎回（1日十数回）再試行しない。Google側の在庫は日次で動かないため、
// この間隔で十分に取りこぼしを回収できる（週次の weekly-places.yml と同じオーダー）。
const COOLDOWN_DAYS = 7;

// ── 課金枠に収める設計（2026-08-30・実測にもとづく）─────────────────────────
// 実測（Cloud Monitoring・serviceruntime request_count）:
//   2026-08-17〜22 は 975〜1,956 req/日 で、Places の月予算 ¥6,000 を 08-20 に使い切った。
//   その後 250 req/日 の上限（consumer override）が入り、08-28 は 146件、08-29 は 720件が
//   上限超過で 4xx 拒否されている。つまり**上限は現に効いており、かつ枠は溢れている**。
//
// 一方で ¥6,000/月が買えるリクエスト数は、Text Search が $32/1,000（≒¥4.8/件）、
// Place Details が $17/1,000（≒¥2.55/件）なので、月 1,250〜2,350件＝**日 40〜78件**でしかない。
// すなわち 250/日 の上限は既に予算の3〜6倍であり、**上限を上げても請求が増えるだけ**で
// 写真は増えない。増やすべきは枠ではなく「1件あたりの精度」と「無駄打ちの排除」。
//
// そこで3つの制御を入れる:
//   1. 失敗理由に応じた指数的バックオフ（下記 BACKOFF_DAYS）
//      … 「Google 側に基準を満たす写真が無い」店を毎週引き直しても結果は変わらない。
//        写真が増えるのは店のオーナーが Google に上げたときで、それは週単位の事象ではない。
//   2. 1回の実行あたりの API 呼び出し上限（MAX_API_CALLS_PER_RUN）
//      … build.yml は push のたびに走る（日十数回）。1回目が日枠を食い潰すと残りは全部 4xx になる。
//   3. 上限超過を検知したら即座に中断
//      … 拒否され続けても課金対象の試行は積み上がる。気づいた時点で止めるのが最も安い。
const BACKOFF_DAYS = {
  // 店は特定できたが、基準を満たす写真が Google に1枚も無い。
  // 解消にはオーナーがビジネスプロフィールに写真を上げる必要があり、月単位の事象。
  'photo-policy': [30, 60, 90],
  // Google 側で店を特定できない（閉店・未登録・別店しか出ない）。これも週では変わらない。
  'name-mismatch': [14, 30, 60],
  'out-of-area': [30, 60, 90],
  'not-food': [30, 60, 90],
};
const BACKOFF_DEFAULT = [7, 14, 30];
const MAX_BACKOFF_DAYS = 90;
// 1回の実行で使ってよい API 呼び出し数。
const MAX_API_CALLS_PER_RUN = 60;
// 1日（Google の枠がリセットされる太平洋時間の1日）に使ってよい API 呼び出し数。
//
// なぜ「1回あたり」だけでは足りないか: build.yml は push のたびに走り、実測で日十数回に及ぶ。
// 1回60回の枠でも 18回走れば 1,080回になり、Google 側の日次上限を軽く超える。
// そこで**日をまたいで積算した実績**を data/photo_pipeline_health.json に持ち、
// 使い切った日は API を1回も叩かずに終了する（＝上限超過の 4xx を出さない）。
const DAILY_API_BUDGET = 200;

// ── SKU 別・月次の枠（ここが請求を ¥0 に固定する本体）────────────────────────
// Cloud Billing Catalog API（services/213C-9623-1402 = Places API）から取得した実価格
// （2026-08-30・JPY建て。第三者が同じエンドポイントを叩けば再現できる）:
//
//   SKU                    無料枠/月    超過分の単価
//   Places - Text Search   5,000件      ¥5.2398/件
//   Places Details         5,000件      ¥2.7837/件
//   Places Photo           1,000件      ¥1.1462/件
//
// 月予算は ¥6,000 だが、**無料枠の内側に収まっていれば請求は発生しない**。
// そこで「¥6,000 を何件ぶん使えるか」ではなく「無料枠を超えない」を制御目標にする。
// 呼び出し数そのものではなく SKU ごとに数えるのが要点で、合計だけを見ていると
// 単価が倍近い Text Search に偏ったときに無料枠を先に食い破る。
//
// 各枠は無料枠の8割に置く（他の経路——weekly-places.yml・ジャーナルの写真取得——も
// 同じプロジェクトの同じ SKU を消費するため、その分を残す）。
const SKU_MONTHLY_BUDGET = { textsearch: 4000, details: 4000, photo: 800 };
const SKU_LABEL = { textsearch: 'Text Search', details: 'Place Details', photo: 'Place Photo' };

/** Google の日次枠がリセットされる太平洋時間の日付（JST 16:00 が境目） */
function ptDate() {
  return new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 10);
}
/** 課金の無料枠がリセットされる月（太平洋時間基準） */
function ptMonth() {
  return ptDate().slice(0, 7);
}

if (!KEY) {
  console.error('❌ GOOGLE_MAPS_API_KEY（または GOOGLE_PLACES_API_KEY）が未設定です。');
  console.error('   例: GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch_manual_store_photos.js');
  process.exit(2);
}

// Places API が「応答したか」を記録する。ネットワーク障害・キー不正で全滅している状況と、
// 「API は答えたが条件を満たす写真が無い」を区別するため（前者で写真URLを消さないための安全弁）。
// lastError は「なぜ失敗したのか」を人へ運ぶためのもの（ISSUE-084 原則5）。
// Places API は課金停止・quota 超過を error_message に平文で書いて返す
// （実例: "You have exceeded your daily request quota for this API. ...
//   verify your project has an active billing account"）。
// これを health ファイルに載せておけば、オーナーは Issue のタイトルを見ただけで
// 「コードの不具合ではなく課金が止まっている」と分かり、ログを読みに行かなくて済む。
const apiHealth = {
  responded: 0, failed: 0, lastStatus: '', lastError: '', calls: 0, quotaExhausted: false,
  // SKU 別の消費数。請求はここで決まるので、合計とは別に必ず分けて数える
  sku: { textsearch: 0, details: 0, photo: 0 },
  skuExhausted: '',
};
// 今月これまでの SKU 別消費（心拍ファイルから引き継ぐ）。main() が確定させる。
let SPENT_MONTH = { textsearch: 0, details: 0, photo: 0 };
/** その SKU をあと何回叩けるか（今月の無料枠の内側に留まるための残数） */
const skuLeft = (kind) => SKU_MONTHLY_BUDGET[kind] - SPENT_MONTH[kind] - apiHealth.sku[kind];
/** その SKU をこれ以上叩いてよいか。使い切っていたら記録して false */
function skuAllow(kind) {
  if (skuLeft(kind) > 0) return true;
  if (!apiHealth.skuExhausted) apiHealth.skuExhausted = kind;
  return false;
}

// この実行で使える呼び出し数（1回あたりの枠と、その日の残り枠の小さい方）。main() が確定させる。
let RUN_BUDGET = MAX_API_CALLS_PER_RUN;
/** この実行で残っている呼び出し枠 */
const apiBudgetLeft = () => RUN_BUDGET - apiHealth.calls;

function getJson(url) {
  apiHealth.calls++;
  return new Promise((resolve) => {
    let body = '';
    const req = https.get(url, { timeout: 8000 }, (res) => {
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          // status が返っていれば API 自体は生きている（ZERO_RESULTS でも応答は応答）
          if (j && typeof j.status === 'string' && j.status !== 'REQUEST_DENIED' && j.status !== 'OVER_QUERY_LIMIT') apiHealth.responded++;
          else {
            apiHealth.failed++;
            if (j && j.status) apiHealth.lastStatus = String(j.status);
            if (j && j.error_message) apiHealth.lastError = String(j.error_message);
            // 日枠超過は「待てば直る」類の失敗ではない。この日はもう1件も通らないので、
            // 拒否され続けるより即座に止める方が安く、健全性の記録も正確になる。
            if (j && (j.status === 'OVER_QUERY_LIMIT' || j.status === 'RESOURCE_EXHAUSTED')) apiHealth.quotaExhausted = true;
          }
          resolve(j);
        } catch { apiHealth.failed++; apiHealth.lastStatus = 'INVALID_RESPONSE'; resolve(null); }
      });
    });
    req.on('error', (e) => { apiHealth.failed++; apiHealth.lastStatus = 'NETWORK_ERROR'; apiHealth.lastError = e.message; resolve(null); });
    req.on('timeout', () => { req.destroy(); apiHealth.failed++; apiHealth.lastStatus = 'TIMEOUT'; resolve(null); });
  });
}

// place/photo はリダイレクトで CDN URL を返す（本文は取らず Location を拾う）
function resolveCdnUrl(photoApiUrl) {
  return new Promise((resolve) => {
    const req = https.get(photoApiUrl, { timeout: 8000 }, (res) => {
      res.resume();
      const loc = res.headers.location;
      resolve(loc || null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── 写真URLの生死判定（ISSUE-074）────────────────────────────────────────
// Google Places の place/photo が返す lh3.googleusercontent.com/place-photos/... は
// 保存後に 403 になることがある。保存した URL をそのまま使い続けると写真が静かに消え、
// トップの人気店カードがプレースホルダーのまま放置される（2026-07-26 実測で
// manual_stores 116件中 62件が失効・canonical では 96件中 49件）。
//
// 【2026-07-26 の実測で分かった失効の性質】
//   生存56件と失効62件は **どちらも同じ 2026-05-31 に書き込まれた** URL だった。
//   つまり「時間経過で一律に期限切れする」のではなく、写真ごとに個別に参照不能になる
//   （オーナーによる写真の差し替え・削除、Google 側のローテーション等）。
//   → 一律の再取得間隔ではなく「毎回生死を確かめて、死んだ分だけ取り直す」が正しい対処。
//     実際に2ヶ月生き残る URL が多数あるため、日次の生死判定で十分に追随できる。
//
// そこで「URL が入っている＝OK」ではなく「実際に配信されているか」で再取得を判断する。
// 本文は要らないので 1 バイトだけ要求して判定する。
function isUrlAlive(url) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve(false); }
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { Range: 'bytes=0-0' }, timeout: 10000 },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
    );
    req.on('error', () => resolve(false));
    // タイムアウトは「死んでいる」と断定しない（一時的な失敗で写真を捨てないため）
    req.on('timeout', () => { req.destroy(); resolve(true); });
    req.end();
  });
}

// 期限付きで失効しうる URL か（＝生死を毎回確かめる価値がある URL か）
const isEphemeralPhotoUrl = (u) => String(u || '').includes('googleusercontent.com');

// 並列度を抑えて生死判定をまとめて実行する
async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// 店名の同一性判定は scripts/lib/store_name_match.js が唯一の判定器。
// HotPepper 経由の穴埋め（fill_missing_photos_from_hotpepper.js）と同じ関数を使うことで、
// 「Places では同一店と認めるが HotPepper では認めない」という経路ごとのブレを無くす。
const { namesMatch, branchToken, branchConflict } = require('./lib/store_name_match');

// 飲食店業態か（よもぎ蒸しサロン等の非飲食を弾く）
const FOOD_TYPES = ['restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_takeaway', 'meal_delivery'];
function isFoodPlace(types) {
  if (!Array.isArray(types) || types.length === 0) return true; // types 取得不可なら通す
  return types.some(t => FOOD_TYPES.includes(t));
}

// 名古屋市・愛知県内かを住所で検証（別都市の同名店を弾く）
function isInNagoyaArea(addr) {
  const a = String(addr || '');
  return /名古屋市|愛知県/.test(a) && !/東京都|横浜市|大阪市|京都市|福岡市|札幌市/.test(a);
}

// place_id から詳細（写真・店名・住所・業態）を引く
// ※ photos は先頭1枚ではなく配列ごと持ち帰る。Places は「客が上げたスマホ写真」を
//   先頭に返すことが半分あり（2026-08-16 実測 132件中66件）、photos[0] だけを見ると
//   素人写真しか採れない店が出るため、採用基準（data/photo_policy.json）で上位N枚を走査する。
async function detailsByPlaceId(placeId) {
  if (!skuAllow('details')) return null;
  apiHealth.sku.details++;
  const detailRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos,name,formatted_address,types&language=ja&key=${KEY}`
  );
  if (!detailRes?.result) return null;
  const photos = detailRes.result.photos || [];
  return {
    placeId,
    matchedName: detailRes.result.name || '',
    address: detailRes.result.formatted_address || '',
    types: detailRes.result.types || [],
    photos,
    photo: photos[0] || null, // 後方互換（存在判定にのみ使う）
  };
}

// 読み仮名の括弧書き（例:「那古野 しば福や 名駅店 (なごの しばふくや めいえきてん)」）を
// 検索クエリから除く。Google 側の検索文字列としては表記ゆれのノイズにしかならない。
// 店名一致判定（namesMatch）側は括弧内も許容するのでこちらは変更しない。
function stripReading(name) {
  return String(name || '').replace(/[（(][^）)]*[）)]/g, '').trim();
}

// findplacefromtext は「候補を1件だけ」返す仕様のため、Google 側のあいまい一致が
// 微妙に外れると（同一チェーンの別店舗等）ここでリカバリ手段が無かった
// （2026-08-18 実測: THE CUPS SAKAE が別店舗「THE CUPS Q」に化けて不採用になっていた）。
// textsearch は候補を複数返すため、店名ゲートを通る候補が見つかるまで順に試せる。
async function tryOneQuery(queryStr) {
  if (!skuAllow('textsearch')) return [];
  apiHealth.sku.textsearch++;
  const query = encodeURIComponent(queryStr);
  const res = await getJson(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=ja&key=${KEY}`
  );
  const results = Array.isArray(res?.results) ? res.results : [];
  return results.slice(0, 5).map(r => ({
    placeId: r.place_id,
    matchedName: r.name || '',
    address: r.formatted_address || '',
    types: r.types || [],
  }));
}

// 三重検証ゲート（店名一致 / 名古屋・愛知の住所 / 飲食店業態）— 架空店ブロックの門番。
// place_id 経由の再取得でも必ず通す（place_id の付け替え・業態変更を検知するため）。
function passesGates(name, r) {
  if (!r || !r.matchedName) return { ok: false, reason: 'name-mismatch', label: '' };
  const m = namesMatch(name, r.matchedName);
  if (!m.ok) return { ok: false, reason: 'name-mismatch', label: r.matchedName, sim: m.sim };
  // 支店違いを塞ぐ（HotPepper 経路と同じ判定器）。店名ゲートは通ってしまうことがある:
  //   「やきとり大吉 今池店」は別名義「やきとり大吉」で「やきとり大吉 浅間町店」に一致する。
  //   2026-08-30 に実際にこの取り違えで別支店の写真を採用しかけた。
  if (branchConflict(name, r.matchedName)) {
    return { ok: false, reason: 'branch-mismatch', label: `${r.matchedName}（${branchToken(name)} ≠ ${branchToken(r.matchedName)}）` };
  }
  if (!isInNagoyaArea(r.address)) return { ok: false, reason: 'out-of-area', label: `${r.matchedName} @ ${r.address.slice(0, 24)}` };
  if (!isFoodPlace(r.types)) return { ok: false, reason: 'not-food', label: `${r.matchedName} (${(r.types || []).slice(0, 2).join(',')})` };
  return { ok: true, sim: m.sim };
}

async function fetchPhoto(name, area, cachedPlaceId, store = {}) {
  let best = null; // {matchedName, address, photos, photo, sim, placeId}
  let lastMatchedName = '', lastReason = 'name-mismatch', lastSim = 0;

  // ── 既知の place_id があればまずそこから引く（ISSUE-074）──
  // textsearch を省けるので API 呼び出しが減り、かつ「一度検証を通った同じ店」を
  // 引き直すので再マッチのブレ（別店に化ける事故）も起きない。ゲートは省略せず再検証する。
  if (cachedPlaceId) {
    const r = await detailsByPlaceId(cachedPlaceId);
    await new Promise(res => setTimeout(res, 150));
    const g = passesGates(name, r);
    if (g.ok && r.photo?.photo_reference) {
      best = { ...r, sim: g.sim };
    } else if (r && !g.ok) {
      // 保存済み place_id がゲートを落ちた（店舗入れ替わり等）→ 名前検索にフォールバック
      lastReason = g.reason; lastMatchedName = g.label; lastSim = g.sim || 0;
      console.log(`  ⚠ 保存済み place_id がゲート不通過(${g.reason}) → 名前検索にフォールバック`);
      cachedPlaceId = null;
    }
  }

  // 「名古屋」を含むクエリのみ（別都市の同名店を避ける）。店名一致＋名古屋/愛知の住所を満たす候補を採用
  const cleanName = stripReading(name);
  const queries = [
    `${cleanName} ${area} 名古屋`,
    `${cleanName} 名古屋`,
  ];
  for (const q of best ? [] : queries) {
    const candidates = await tryOneQuery(q);
    await new Promise(res => setTimeout(res, 150));
    for (const c of candidates) {
      if (!c || !c.matchedName) continue;
      lastMatchedName = c.matchedName;
      // textsearch は候補一覧の名前/住所/業態だけを軽量に返す。名前ゲートを通った候補だけ
      // 詳細取得（写真ギャラリー付き）に進む＝無関係な候補ぶんの API 消費を避ける。
      const quickGate = passesGates(name, { matchedName: c.matchedName, address: c.address, types: c.types });
      lastSim = quickGate.sim || 0;
      if (!quickGate.ok) { if (quickGate.reason !== 'name-mismatch') { lastReason = quickGate.reason; lastMatchedName = quickGate.label; } continue; }
      const r = await detailsByPlaceId(c.placeId);
      await new Promise(res => setTimeout(res, 150));
      if (!r) continue;
      const g = passesGates(name, r); // 詳細取得後の name/address/types で再検証（保険）
      lastSim = g.sim || 0;
      if (!g.ok) { if (g.reason !== 'name-mismatch') { lastReason = g.reason; lastMatchedName = g.label; } continue; }
      if (r.photo?.photo_reference) { best = { ...r, sim: g.sim }; break; }
    }
    if (best) break;
  }
  if (!best) return { reason: lastReason, matchedName: lastMatchedName, sim: lastSim };

  // ── 採用基準ゲート（data/photo_policy.json）──────────────────────────
  // Places の写真には「オーナーが上げた宣材」と「客が上げたスマホ写真」が混在し、
  // 先頭が客の写真であることが半分ある。上位N枚を順に見て、最初に基準を通った1枚を採る。
  // 全部落ちたら写真なし扱い（SVG維持）。取り繕って素人写真を載せない。
  //
  // 2026-08-30: オーナー写真が1枚も無い店に限り、客投稿を「代替枠」として採る階層を追加
  // （data/photo_policy.json の allowUserPhotoFallback・オーナー承認済み）。
  // 階層の判断は pickPhoto() が一手に持つ。ここは走査対象を渡すだけにして、
  // 「オーナー写真を必ず優先する」規則が経路ごとにブレないようにする。
  const pol = loadPolicy().places;
  const candidates = (best.photos || [best.photo]).filter(Boolean).slice(0, pol.scanPhotos)
    .map((ph) => ({ photo: ph, attribution: attributionName(ph) || 'Google Maps' }));
  const { picked, rejects } = pickPhoto(candidates, store);
  if (!picked) {
    return {
      reason: 'photo-policy',
      matchedName: best.matchedName,
      sim: best.sim,
      policyRejects: rejects,
    };
  }

  if (!skuAllow('photo')) return { reason: 'sku-budget', matchedName: best.matchedName };
  apiHealth.sku.photo++;
  const cdnUrl = await resolveCdnUrl(
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${picked.photo.photo_reference}&key=${KEY}`
  );
  if (!cdnUrl) return { reason: 'no-cdn', matchedName: best.matchedName };
  return {
    url: cdnUrl,
    attribution: picked.attribution,
    tier: picked.tier,                                 // 'owner' | 'user'
    matchedName: best.matchedName,
    sim: best.sim,
    placeId: best.placeId,
    photoWidth: Number(picked.photo.width || picked.photo.widthPx || 0),
    scanned: candidates.length,
    skipped: rejects.length,
  };
}

const isSvgOrEmpty = (u) => !u || u.includes('/assets/store-figures/');

async function main() {
  const force = process.argv.includes('--force');
  const limIdx = process.argv.indexOf('--limit');
  const limit = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
  const matchesOnly = (s) => !only || (s['店名'] || '').includes(only);

  // ── 対象データセットの読み込み（manual＋pending・ISSUE-076）────────────────
  // pending（ジャーナル採用の話題店）は写真取得の対象外だったため、HotPepper ID を
  // 持たない店が恒久的に写真ゼロのままだった。同じ三重ゲートで一緒に処理する。
  const datasets = [];
  const manual = JSON.parse(fs.readFileSync(MANUAL_JSON, 'utf8'));
  datasets.push({ label: 'manual', file: MANUAL_JSON, root: manual, list: manual.stores });

  let pendingSkippedByHp = 0;
  if (fs.existsSync(PENDING_JSON)) {
    const pending = JSON.parse(fs.readFileSync(PENDING_JSON, 'utf8'));
    const all = pending.pending || [];
    // hotpepper_id を持つ pending は merge 時に既存の HotPepper 店へ合流し、
    // そちらの恒久写真（imgfp）を引き継ぐので Places を叩く必要がない。
    const list = all.filter(p => {
      if (p.hotpepper_id) { pendingSkippedByHp++; return false; }
      return true;
    });
    datasets.push({ label: 'pending', file: PENDING_JSON, root: pending, list });
    console.log(`対象: manual ${manual.stores.length}件 / pending ${list.length}件（HotPepper ID 保有の ${pendingSkippedByHp}件は HP写真を継承するため対象外）\n`);
  }

  // 全データセットを串刺しにした作業リスト（判定・取得ロジックは共通）
  const allStores = datasets.flatMap(d => d.list);

  // ── Phase 1: 生死判定で「本当に再取得が必要な店」を洗い出す（ISSUE-074）─────────
  // 従来は「写真URLが入っていれば OK」でスキップしていたため、Google Places の
  // 期限付きURLが 403 で失効しても永久に気づけず、トップの人気店カードが
  // プレースホルダーのまま放置されていた。URL の有無ではなく配信の実態で判断する。
  // 「実写が入っている」とみなせる URL か（未取得・SVG・禁止ストックは最初から再取得対象）
  const hasRealPhoto = (s) => {
    const cur = s['写真URL'] || '';
    return cur.startsWith('http') && !isSvgOrEmpty(cur) && !/unsplash|pexels|loremflickr/i.test(cur);
  };
  const 生死確認対象 = (force || only) ? [] : allStores.filter(hasRealPhoto);

  let 失効 = 0, 生存 = 0;
  if (生死確認対象.length) {
    console.log(`写真URLの生死確認: ${生死確認対象.length}件（期限付きURLの失効を検知）`);
    const results = await mapWithConcurrency(生死確認対象, 8, (s) => isUrlAlive(s['写真URL']));
    生死確認対象.forEach((s, i) => {
      if (results[i]) { 生存++; s.__alive = true; }
      else {
        失効++;
        s.__needsRefetch = true;
        const kind = isEphemeralPhotoUrl(s['写真URL']) ? '期限切れ(Places署名URL)' : '配信停止';
        console.log(`  ✗ ${s['店名']}: ${kind} → 再取得対象`);
      }
    });
    console.log(`  生存 ${生存}件 / 失効 ${失効}件\n`);
  }

  // 再取得対象 = 未取得/SVG/禁止ストック（従来どおり）＋ 生死判定で失効が確認された店（新規）
  // --only 指定時はその店だけを対象にし、hasRealPhoto の有無に関わらず強制的に再判定する
  // （採用基準ゲート＝data/photo_policy.json 施行前に採用済みの客投稿写真を洗い直すため）
  const daysSince = (dateStr) => {
    const d = Date.parse(dateStr);
    if (isNaN(d)) return Infinity;
    return Math.floor((Date.now() - d) / 86400000);
  };
  /**
   * その店を次に試すまで空けるべき日数。
   *
   * 一律7日だと、同じ日に試した店が**同じ日にまとめて期限切れ**になり、週に一度
   * 日枠を超える山ができる（2026-08-28 の 548件・うち146件が上限超過で拒否）。
   * さらに「Google 側に基準を満たす写真が無い」店は何度引いても結果が変わらないため、
   * その週次の山の大半は結果の分かっている無駄打ちだった。
   * 失敗の理由と回数で間隔を伸ばし、山も同時にならす。
   */
  const backoffDaysFor = (s) => {
    const n = Math.max(0, Number(s['写真失敗回数']) || 0);
    if (n === 0) return COOLDOWN_DAYS;
    const table = BACKOFF_DAYS[s['写真失敗理由']] || BACKOFF_DEFAULT;
    return Math.min(table[Math.min(n - 1, table.length - 1)], MAX_BACKOFF_DAYS);
  };
  const inCooldown = (s) => !force && !only && !s.__needsRefetch
    && daysSince(s['写真確認日']) < backoffDaysFor(s);
  let cooldownSkipped = 0;
  const targets = allStores.filter(s => {
    if (!matchesOnly(s) || !(force || only || s.__needsRefetch || !hasRealPhoto(s))) return false;
    if (inCooldown(s)) { cooldownSkipped++; return false; }
    return true;
  });
  if (cooldownSkipped) {
    console.log(`バックオフ中につきスキップ: ${cooldownSkipped}件（初回${COOLDOWN_DAYS}日 → 失敗理由に応じて最長${MAX_BACKOFF_DAYS}日）\n`);
  }
  // ── 課金の無料枠（SKU別・月次）の残りを確認する ──
  SPENT_MONTH = readSpentMonth();
  const skuLine = Object.keys(SKU_MONTHLY_BUDGET)
    .map(k => `${SKU_LABEL[k]} ${SPENT_MONTH[k]}/${SKU_MONTHLY_BUDGET[k]}`).join(' / ');
  console.log(`今月の消費（無料枠の内側に収める）: ${skuLine}`);
  if (!force && !only && skuLeft('textsearch') <= 0 && skuLeft('details') <= 0) {
    console.log('今月の SKU 枠を使い切っています。API を叩かずに終了します（請求を発生させないため）。');
    writePhotoPipelineHealth({ attempted: 0, adopted: 0, skippedByDailyBudget: true });
    return;
  }

  // ── 日次枠の残りを確認する（build.yml は日十数回走るので、1回あたりの枠だけでは日を守れない）──
  const spentToday = readSpentToday();
  const dailyLeft = DAILY_API_BUDGET - spentToday;
  if (!force && !only && dailyLeft <= 0) {
    console.log(`本日の API 枠（${DAILY_API_BUDGET}回/日・太平洋時間 ${ptDate()}）を使い切っています（消費 ${spentToday}回）。`);
    console.log('API を叩かずに終了します。残りは枠がリセットされてから処理されます。');
    writePhotoPipelineHealth({ attempted: 0, adopted: 0, skippedByDailyBudget: true });
    return;
  }
  // この実行で使ってよい回数 = 1回あたりの枠と、日次枠の残りの小さい方
  RUN_BUDGET = Math.max(0, Math.min(MAX_API_CALLS_PER_RUN, dailyLeft));
  console.log(`今回の対象 ${targets.length}件 / この実行の API 枠 ${RUN_BUDGET}回`
    + `（本日の残り ${dailyLeft}回 / 上限 ${DAILY_API_BUDGET}回）\n`);

  // ── Phase 2: 対象店だけ Places から取得（place_id キャッシュで API 呼び出しを節約）──
  let done = 0, ok = 0, miss = 0, 復活 = 0, policyRejected = 0;
  let budgetStopped = false;
  for (const s of targets) {
    if (done >= limit) break;
    // 上限超過を踏んだ日は、以降どの店を引いても通らない。粘らず止める（課金だけが積み上がるため）
    if (apiHealth.quotaExhausted) { budgetStopped = true; break; }
    // 1回の実行で日枠を食い潰さない。1店あたり最悪 2 textsearch + 5 details を使うので、
    // 残り枠がそれを賄えないところで打ち切る（中途半端に打って失敗扱いにしない）
    if (apiBudgetLeft() < 8) { budgetStopped = true; break; }
    // 無料枠を使い切った SKU が出たら止める（ここから先は課金が発生する）
    if (apiHealth.skuExhausted) { budgetStopped = true; break; }
    done++;
    const name = s['店名'] || '';
    const area = s['エリア'] || '';
    const wasDead = !!s.__needsRefetch;
    const r = await fetchPhoto(name, area, s['GooglePlaceID'] || '', s);
    // 成功/失敗を問わず「試行した」ことを記録する（クールダウン判定の基準）。
    // API 自体が応答していない回（キー不正・quota・ネットワーク断）は記録しない
    // ＝一時的な障害を「7日間再試行不要」と誤解させないための安全弁。
    // 上限超過で引けなかった回は「その店を試した」ことにしない。
    // ここで日付を刻むと、一度も正しく引けていない店が7日間スキップされ続ける。
    if (apiHealth.responded > 0 && !apiHealth.quotaExhausted) {
      s['写真確認日'] = new Date().toISOString().slice(0, 10);
    }
    if (r && r.url) {
      s['写真URL'] = r.url;
      s['写真クレジット'] = r.attribution;
      if (r.placeId) s['GooglePlaceID'] = r.placeId;   // 次回の再取得を安く・確実にする
      s['写真取得日'] = new Date().toISOString().slice(0, 10);
      if (r.photoWidth) s['写真幅'] = r.photoWidth;     // 実測幅。srcset の上限決定に使う
      // 出所を必ず記録する。表示面でクレジットを出すか（客投稿か）の判断根拠であり、
      // 監査が「代替枠が何店に出ているか」を数える唯一の手掛かりでもある（制約10）。
      s['写真出所'] = r.tier === 'user' ? 'places-user' : 'places-owner';
      // 取れた店はバックオフの履歴を捨てる（次に失効したときは初回として扱う）
      delete s['写真失敗回数'];
      delete s['写真失敗理由'];
      ok++;
      if (wasDead) 復活++;
      const skip = r.skipped ? `・${r.skipped}枚を除外` : '';
      const tierLabel = r.tier === 'user' ? '代替枠(客投稿・クレジット表示)' : 'オーナー写真';
      console.log(`✅ ${name} (一致度${r.sim}${skip}) → ${wasDead ? '失効URLを差し替え' : tierLabel + 'を採用'} [${r.matchedName}] 撮影:${r.attribution}`);
    } else {
      miss++;
      if (r?.reason === 'photo-policy') policyRejected++;
      // 失敗の回数と理由を残す。次回いつ試すか（バックオフ）はこの2つだけで決まる＝
      // 後から第三者が同じ計算を再現できる（CLAUDE.md 制約10）。
      // 上限超過で引けなかった回は「その店の失敗」ではないので数えない。
      if (apiHealth.responded > 0 && !apiHealth.quotaExhausted) {
        s['写真失敗回数'] = (Number(s['写真失敗回数']) || 0) + 1;
        s['写真失敗理由'] = r?.reason || 'unknown';
      }
      const why = apiHealth.quotaExhausted
        // 上限超過で候補を引けなかっただけ。店名の判定結果ではないので、そう書かない
        // （旧実装は既定値の name-mismatch を表示し、一致度1の正しい候補まで
        //   「別店マッチ」と報告していた）
        ? '日次上限に到達して候補を取得できず → 次回に持ち越し'
        : r?.reason === 'name-mismatch'
        ? `別店マッチのため不採用（候補:「${r.matchedName}」一致度${r.sim}）→ SVG維持`
        : r?.reason === 'photo-policy'
        ? `採用基準を満たす写真なし（${(r.policyRejects || []).join(' / ')}）→ SVG維持`
        : `Google で実写取得できず（${r?.reason || 'unknown'}）→ SVG維持`;
      console.log(`— ${name}: ${why}`);
      // 失効URLは表示できない上に JSON-LD image / og:image が 403 を指し続けるので、
      // 取り繕わずクリアして正規フォールバックへ委ねる。
      // ただし API 自体が落ちている（キー不正・quota・ネットワーク断）ときに消すと
      // 復旧可能なURLを取りこぼすため、API が応答している場合に限る。
      //
      // photo-policy 不採用（＝店は正しく特定できたが Places 側の写真が全て客投稿等で
      // 基準を満たさない）で、かつ現在の写真URLが Places CDN 由来のときも同様にクリアする。
      // 旧実装は wasDead（＝生死判定で失効と判定済み）のときしかクリアしておらず、
      // --force/--only で「既にある写真を基準に照らして洗い直す」場合に非採用と判定しても
      // 古い客投稿URLが残り続ける抜け穴があった（採用基準ゲート新設後も既存違反が
      // 解消されなかった実際の原因）。
      // 支店違いで落ちたときは、今載っている Places 写真も別支店のものである疑いが強い。
      // 「その店の写真だと確認できないもの」は載せ続けない（ISSUE-090 の教訓）。
      const wrongBranch = r?.reason === 'branch-mismatch' && /googleusercontent\.com/.test(s['写真URL'] || '');
      const staleNonCompliant = (r?.reason === 'photo-policy' || wrongBranch) && /googleusercontent\.com/.test(s['写真URL'] || '');
      if ((wasDead || staleNonCompliant) && apiHealth.responded > 0) {
        s['写真URL'] = '';
        // 出所・幅・クレジットは写真URLとひと組。片方だけ残すと表示（クレジット表示の判定）と
        // 監査（代替枠の件数）が実体とズレる
        delete s['写真クレジット'];
        delete s['写真出所'];
        delete s['写真幅'];
        console.log(`   ↳ ${wrongBranch ? '別支店の写真だった疑いがあるためクリア' : staleNonCompliant ? '基準を満たさない既存写真をクリア' : '失効URLをクリア'}（JSON-LD/og:image が 403 を指さないように）`);
      } else if (wasDead) {
        console.log(`   ↳ API 応答なし → 失効URLは保持（次回再試行）`);
      }
    }
    await new Promise(r => setTimeout(r, 200)); // レート配慮
  }

  // 一時フラグを保存対象から除去
  for (const s of allStores) { delete s.__alive; delete s.__needsRefetch; }

  // データセットごとに書き戻す（pending は list をフィルタしているが、要素は
  // root の配列と同一オブジェクト参照なので root をそのまま保存すれば反映される）
  for (const d of datasets) {
    fs.writeFileSync(d.file, JSON.stringify(d.root, null, 2) + '\n', 'utf8');
  }
  console.log(`\n生存 ${生存}件 / 失効検知 ${失効}件 / バックオフ中${cooldownSkipped}件スキップ → 処理 ${done}件 / 実写採用 ${ok}件（うち失効差し替え ${復活}件）/ 不採用(SVG維持) ${miss}件`);
  if (policyRejected) console.log(`  ↳ うち ${policyRejected}件は採用基準（客投稿の除外・解像度）で不採用。data/photo_policy.json 参照`);
  console.log(`API 呼び出し ${apiHealth.calls}回 / この実行の枠 ${RUN_BUDGET}回（本日累計 ${readSpentToday() + apiHealth.calls}回 / 上限 ${DAILY_API_BUDGET}回）`);
  if (budgetStopped) {
    console.log(apiHealth.quotaExhausted
      ? '  ↳ Google 側の日次上限に到達したため中断しました（残りは翌日以降に回ります）'
      : apiHealth.skuExhausted
      ? `  ↳ ${SKU_LABEL[apiHealth.skuExhausted]} の今月の無料枠を使い切ったため中断しました（これ以上は課金が発生します）`
      : `  ↳ この実行の枠を使い切ったため中断しました（残り ${targets.length - done}件は次の実行へ）`);
  }
  console.log(`今月の消費: ` + Object.keys(SKU_MONTHLY_BUDGET)
    .map(k => `${SKU_LABEL[k]} ${SPENT_MONTH[k] + apiHealth.sku[k]}/${SKU_MONTHLY_BUDGET[k]}`).join(' / '));

  writePhotoPipelineHealth({ attempted: done, adopted: ok });

  console.log('次に: node build.js && node gen-store-pages.js');
}

/**
 * 写真取得パイプラインの心拍を data/photo_pipeline_health.json に書く（ISSUE-084 の再適用）。
 *
 * なぜ必要か（2026-08-29 に判明）:
 *   build.yml のこのステップは continue-on-error: true で回っている。Places API の課金が
 *   止まった 2026-08-20 以降、この取得は毎回 OVER_QUERY_LIMIT で1件も取れていなかったが、
 *   **ジョブは緑のまま**だった。写真が増えないこと自体はサイトを見ないと分からず、
 *   実際に9日間気づかれなかった。データ側の監査（audit_photo_policy / audit_photo_coverage）も
 *   「写真が無い」を基準どおりの正常として通すため、この故障は原理的に検出できない。
 *
 * そこで「取得が成功したか」ではなく「API が応答したか」を、リポジトリに出る場所へ書く。
 * data/ 配下なのでコミットで Mac／CI の外へ出る（.local-logs/ に書いても誰にも届かない）。
 * 鮮度と状態は自己申告できない——動いていないスクリプトはこのファイルを更新できない。
 */
/**
 * 本日（太平洋時間）これまでに使った API 呼び出し数を心拍ファイルから読む。
 * 実行ごとに別プロセスなので、日次の枠はここに積んで引き継ぐしかない。
 */
function readSpentToday() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'photo_pipeline_health.json'), 'utf8'));
    const p = j.places || {};
    return p.quota_day === ptDate() ? (Number(p.api_calls_day) || 0) : 0;
  } catch { return 0; }
}

/** 今月（太平洋時間）これまでに使った SKU 別の呼び出し数を心拍ファイルから読む */
function readSpentMonth() {
  const zero = { textsearch: 0, details: 0, photo: 0 };
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'photo_pipeline_health.json'), 'utf8'));
    const p = j.places || {};
    if (p.sku_month !== ptMonth()) return zero;
    return { ...zero, ...(p.sku_calls_month || {}) };
  } catch { return zero; }
}

function writePhotoPipelineHealth(counts) {
  const HEALTH = path.join(ROOT, 'data', 'photo_pipeline_health.json');
  let root = {};
  try { root = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch { root = {}; }
  const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  // 日枠に当たった日は「壊れている」のではなく「使い切った」。原因が違えば対処も違うので
  // 別の状態として記録する（watchdog は api_down だけを異常として鳴らす）。
  const down = apiHealth.responded === 0 && (apiHealth.failed > 0 || counts.attempted > 0);
  // 日枠到達が何日続いているか。1日なら平常（枠を使い切っただけ）だが、毎日続くなら
  // 「枠が実需に足りていない」＝人が予算か設計を判断すべき状態なので、連続日数を数える。
  // 前回と同じ日の再実行では二重に数えない。
  const prev = root.places || {};
  const prevDay = prev.quota_day;
  const nowQuota = apiHealth.quotaExhausted;
  const streak = nowQuota
    ? (prev.date === jstDate ? (prev.quota_reached_streak || 1) : (prev.quota_reached_streak || 0) + 1)
    : 0;
  root.places = {
    date: jstDate,
    status: down ? 'api_down' : (nowQuota ? 'quota_reached' : 'ok'),
    quota_reached_streak: streak,
    // 原因を人へ運ぶ。Places は課金停止・quota 超過を error_message に平文で書いて返す
    reason: (down || apiHealth.quotaExhausted) ? [apiHealth.lastStatus, apiHealth.lastError].filter(Boolean).join(' — ') : '',
    api_calls: apiHealth.calls,
    // 太平洋時間の1日で積算した消費（Google の枠のリセット境界に合わせる）
    quota_day: ptDate(),
    api_calls_day: (prevDay === ptDate() ? (Number(prev.api_calls_day) || 0) : 0) + apiHealth.calls,
    daily_budget: DAILY_API_BUDGET,
    // SKU 別・月次の消費（請求はここで決まる。無料枠の内側に収まっていれば ¥0）
    sku_month: ptMonth(),
    sku_calls_month: {
      textsearch: SPENT_MONTH.textsearch + apiHealth.sku.textsearch,
      details: SPENT_MONTH.details + apiHealth.sku.details,
      photo: SPENT_MONTH.photo + apiHealth.sku.photo,
    },
    sku_monthly_budget: SKU_MONTHLY_BUDGET,
    sku_exhausted: apiHealth.skuExhausted || '',
    skipped_by_daily_budget: !!counts.skippedByDailyBudget,
    responded: apiHealth.responded,
    failed: apiHealth.failed,
    attempted: counts.attempted,
    adopted: counts.adopted,
    recorded_at: new Date().toISOString(),
  };
  fs.writeFileSync(HEALTH, JSON.stringify(root, null, 2) + '\n', 'utf8');
  if (down) {
    console.error(`\n❌ Places API から一度も正常応答がありませんでした: ${root.places.reason || '原因不明'}`);
    console.error('   写真は1件も増えません。data/photo_pipeline_health.json に記録しました（photo-watchdog.yml が検知します）。');
  }
}

main();
