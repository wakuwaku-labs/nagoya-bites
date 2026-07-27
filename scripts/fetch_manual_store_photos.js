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
// Google Places API（findplacefromtext → place/details → place/photo CDN URL）を使用。
// 要 GOOGLE_MAPS_API_KEY（または GOOGLE_PLACES_API_KEY）環境変数。
// place/photo が返す lh3.googleusercontent.com の CDN URL を保存（APIキーはHTMLに埋め込まない）。
//
// 使い方:
//   GOOGLE_MAPS_API_KEY=xxxx node scripts/fetch_manual_store_photos.js [--force] [--limit N]
// 取得後:
//   node build.js && node gen-store-pages.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual_stores.json');
const PENDING_JSON = path.join(ROOT, 'data', 'pending_stores.json');
const KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

if (!KEY) {
  console.error('❌ GOOGLE_MAPS_API_KEY（または GOOGLE_PLACES_API_KEY）が未設定です。');
  console.error('   例: GOOGLE_MAPS_API_KEY=AIza... node scripts/fetch_manual_store_photos.js');
  process.exit(2);
}

// Places API が「応答したか」を記録する。ネットワーク障害・キー不正で全滅している状況と、
// 「API は答えたが条件を満たす写真が無い」を区別するため（前者で写真URLを消さないための安全弁）。
const apiHealth = { responded: 0, failed: 0 };

function getJson(url) {
  return new Promise((resolve) => {
    let body = '';
    const req = https.get(url, { timeout: 8000 }, (res) => {
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          // status が返っていれば API 自体は生きている（ZERO_RESULTS でも応答は応答）
          if (j && typeof j.status === 'string' && j.status !== 'REQUEST_DENIED' && j.status !== 'OVER_QUERY_LIMIT') apiHealth.responded++;
          else apiHealth.failed++;
          resolve(j);
        } catch { apiHealth.failed++; resolve(null); }
      });
    });
    req.on('error', () => { apiHealth.failed++; resolve(null); });
    req.on('timeout', () => { req.destroy(); apiHealth.failed++; resolve(null); });
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

// 店名照合用の正規化（空白・記号・一般ジャンル語を除去）
const GENRE_WORDS = /専門店?|本格|個室|炭火焼?き?|焼き?鳥|焼肉|餃子|ラーメン|拉麺|らーめん|居酒屋|酒場|バー|カフェ|喫茶|鮨|寿司|うなぎ|鰻|天ぷら|割烹|会席|懐石|中華|中国料理|イタリアン|フレンチ|ビストロ|スイーツ|大福|プリン|チーズケーキ|パフェ|ジェラート|クレープ|トースト|フレンチトースト|サンド|カレー|ビュッフェ|ランチ|鉄板焼き?|ホルモン|和牛|神戸牛|名古屋コーチン|おまかせ|カウンター|コース|店|名古屋/g;
function norm(s) {
  return String(s || '').replace(/[\s　・,，、。\-—–|｜()（）【】「」『』:：]/g, '').toLowerCase();
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
// 既知の表記ゆれ許可リスト（手動で実在・同一店を確認済み。ローマ字↔カタカナ等）
// key: 店名, value: マッチ店名に含まれていれば同一店とみなすトークン配列
const VERIFIED_ALIASES = {
  '麺や 六三六': ['六三六'],
  'COFFEE KAJITA': ['カジタ', 'kajita'],
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
};

// 店名 vs マッチ店名 の一致判定
function namesMatch(storeName, matchedName) {
  const sn = norm(storeName), mn = norm(matchedName);
  if (!mn) return { ok: false, sim: 0 };
  // 確認済みの表記ゆれ
  const aliases = VERIFIED_ALIASES[storeName];
  if (aliases && aliases.some(a => mn.includes(norm(a)))) return { ok: true, sim: 1 };
  if (sn === mn || sn.includes(mn) || mn.includes(sn)) return { ok: true, sim: 1 };
  const sc = core(storeName), mc = core(matchedName);
  // コア（ジャンル語除去後）の包含 or 高Dice
  if (sc.length >= 2 && mc.length >= 2 && (mc.includes(sc) || sc.includes(mc))) return { ok: true, sim: 0.9 };
  const sim = Math.max(dice(sn, mn), dice(sc, mc));
  return { ok: sim >= 0.85, sim: Math.round(sim * 100) / 100 };
}

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
async function detailsByPlaceId(placeId) {
  const detailRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos,name,formatted_address,types&language=ja&key=${KEY}`
  );
  if (!detailRes?.result) return null;
  return {
    placeId,
    matchedName: detailRes.result.name || '',
    address: detailRes.result.formatted_address || '',
    types: detailRes.result.types || [],
    photo: detailRes.result.photos?.[0] || null,
  };
}

async function tryOneQuery(queryStr) {
  const query = encodeURIComponent(queryStr);
  const findRes = await getJson(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&language=ja&key=${KEY}`
  );
  const placeId = findRes?.candidates?.[0]?.place_id;
  if (!placeId) return null;
  return detailsByPlaceId(placeId);
}

// 三重検証ゲート（店名一致 / 名古屋・愛知の住所 / 飲食店業態）— 架空店ブロックの門番。
// place_id 経由の再取得でも必ず通す（place_id の付け替え・業態変更を検知するため）。
function passesGates(name, r) {
  if (!r || !r.matchedName) return { ok: false, reason: 'name-mismatch', label: '' };
  const m = namesMatch(name, r.matchedName);
  if (!m.ok) return { ok: false, reason: 'name-mismatch', label: r.matchedName, sim: m.sim };
  if (!isInNagoyaArea(r.address)) return { ok: false, reason: 'out-of-area', label: `${r.matchedName} @ ${r.address.slice(0, 24)}` };
  if (!isFoodPlace(r.types)) return { ok: false, reason: 'not-food', label: `${r.matchedName} (${(r.types || []).slice(0, 2).join(',')})` };
  return { ok: true, sim: m.sim };
}

async function fetchPhoto(name, area, cachedPlaceId) {
  let best = null; // {matchedName, address, photo, sim, placeId}
  let lastMatchedName = '', lastReason = 'name-mismatch';

  // ── 既知の place_id があればまずそこから引く（ISSUE-074）──
  // findplacefromtext を省けるので API 呼び出しが半分になり、かつ「一度検証を通った同じ店」を
  // 引き直すので再マッチのブレ（別店に化ける事故）も起きない。ゲートは省略せず再検証する。
  if (cachedPlaceId) {
    const r = await detailsByPlaceId(cachedPlaceId);
    await new Promise(res => setTimeout(res, 150));
    const g = passesGates(name, r);
    if (g.ok && r.photo?.photo_reference) {
      best = { ...r, sim: g.sim };
    } else if (r && !g.ok) {
      // 保存済み place_id がゲートを落ちた（店舗入れ替わり等）→ 名前検索にフォールバック
      lastReason = g.reason; lastMatchedName = g.label;
      console.log(`  ⚠ 保存済み place_id がゲート不通過(${g.reason}) → 名前検索にフォールバック`);
      cachedPlaceId = null;
    }
  }

  // 「名古屋」を含むクエリのみ（別都市の同名店を避ける）。店名一致＋名古屋/愛知の住所を満たす候補を採用
  const queries = [
    `${name} ${area} 名古屋`,
    `${name} 名古屋`,
  ];
  for (const q of best ? [] : queries) {
    const r = await tryOneQuery(q);
    await new Promise(res => setTimeout(res, 150));
    if (!r || !r.matchedName) continue;
    lastMatchedName = r.matchedName;
    const g = passesGates(name, r);
    if (!g.ok) { if (g.reason !== 'name-mismatch') { lastReason = g.reason; lastMatchedName = g.label; } continue; }
    if (r.photo?.photo_reference) { best = { ...r, sim: g.sim }; break; }
  }
  if (!best) return { reason: lastReason, matchedName: lastMatchedName, sim: 0 };

  const attribution = best.photo.html_attributions?.[0]
    ? best.photo.html_attributions[0].replace(/<[^>]+>/g, '')
    : 'Google Maps';
  const cdnUrl = await resolveCdnUrl(
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${best.photo.photo_reference}&key=${KEY}`
  );
  if (!cdnUrl) return { reason: 'no-cdn', matchedName: best.matchedName };
  return { url: cdnUrl, attribution, matchedName: best.matchedName, sim: best.sim };
}

const isSvgOrEmpty = (u) => !u || u.includes('/assets/store-figures/');

async function main() {
  const force = process.argv.includes('--force');
  const limIdx = process.argv.indexOf('--limit');
  const limit = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;

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
  const 生死確認対象 = force ? [] : allStores.filter(hasRealPhoto);

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
  const targets = allStores.filter(s => force || s.__needsRefetch || !hasRealPhoto(s));

  // ── Phase 2: 対象店だけ Places から取得（place_id キャッシュで API 呼び出しを節約）──
  let done = 0, ok = 0, miss = 0, 復活 = 0;
  for (const s of targets) {
    if (done >= limit) break;
    done++;
    const name = s['店名'] || '';
    const area = s['エリア'] || '';
    const wasDead = !!s.__needsRefetch;
    const r = await fetchPhoto(name, area, s['GooglePlaceID'] || '');
    if (r && r.url) {
      s['写真URL'] = r.url;
      s['写真クレジット'] = r.attribution;
      if (r.placeId) s['GooglePlaceID'] = r.placeId;   // 次回の再取得を安く・確実にする
      s['写真取得日'] = new Date().toISOString().slice(0, 10);
      ok++;
      if (wasDead) 復活++;
      console.log(`✅ ${name} (一致度${r.sim}) → ${wasDead ? '失効URLを差し替え' : '実写採用'} [${r.matchedName}]`);
    } else {
      miss++;
      const why = r?.reason === 'name-mismatch'
        ? `別店マッチのため不採用（候補:「${r.matchedName}」一致度${r.sim}）→ SVG維持`
        : `Google で実写取得できず（${r?.reason || 'unknown'}）→ SVG維持`;
      console.log(`— ${name}: ${why}`);
      // 失効URLは表示できない上に JSON-LD image / og:image が 403 を指し続けるので、
      // 取り繕わずクリアして正規フォールバックへ委ねる。
      // ただし API 自体が落ちている（キー不正・quota・ネットワーク断）ときに消すと
      // 復旧可能なURLを取りこぼすため、API が応答している場合に限る。
      if (wasDead && apiHealth.responded > 0) {
        s['写真URL'] = '';
        delete s['写真クレジット'];
        console.log(`   ↳ 失効URLをクリア（JSON-LD/og:image が 403 を指さないように）`);
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
  console.log(`\n生存 ${生存}件 / 失効検知 ${失効}件 → 処理 ${done}件 / 実写採用 ${ok}件（うち失効差し替え ${復活}件）/ 不採用(SVG維持) ${miss}件`);
  console.log('次に: node build.js && node gen-store-pages.js');
}

main();
