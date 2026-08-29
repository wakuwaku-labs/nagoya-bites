#!/usr/bin/env node
/**
 * 写真の無い手動キュレーション店を HotPepper の公式写真で埋める（写真ソース優先2）
 *
 * 【なぜ必要か】
 * 2026-08-21 の PR #166 が data/photo_policy.json（オーナー投稿のみ採用）を既存データへ
 * 遡及適用し、手動店の写真が 136/155 → 80/155 に落ちた。落ちた 55 件は「客が上げた写真しか
 * Google に存在しない店」で、コメダ珈琲 本店・喫茶マウンテン・餃子の王将 大須観音店 のように
 * **オーナーが Google ビジネスプロフィールに写真を上げる見込みが構造的に無い店**が多い。
 * つまり Places 経路だけに頼る限り、この 55 件は「待てば埋まる」のではなく恒久的に空白になる。
 *
 * HotPepper 写真は「店側が媒体に提出した素材」なので出所の観点では常にオーナー由来であり、
 * data/photo_policy.json も帰属ゲートを課さず解像度の基準だけを見る（写真ソース優先2）。
 * さらに imgfp.hotp.jp は署名付きの期限URLではないため、Places の
 * 「保存した URL が後から 403 になる」問題（ISSUE-074）からも解放される。
 *
 * 【判定は検証できる事実だけで行う（CLAUDE.md 制約10）】
 *   使う入力: HotPepper API が返す店名・住所・写真URL、および我々の店名・アクセス欄。
 *             採否の根拠は 店名一致 / 支店名一致 / 住所が名古屋市 / 区の一致 / 写真URLが実在配信されている の5つで、
 *             どれも第三者が同じ shop.id を引けば再現できる。
 *   使わない入力: 「たぶんこの店だと思う」等の自己申告値。
 *   証跡: 採用した店には HotPepper店名 / HotPepperURL / ホットペッパーID を書き戻すので、
 *         後から「なぜその写真がその店の写真だと言えるのか」を人が検算できる。
 *
 * 【誤マッチを三重に防ぐ】
 * 記事のヒーロー写真で「一行触れただけの別店の写真が顔になった」事故（ISSUE-090）と同じ
 * 失敗クラス＝**支店違い**をここでも塞ぐ。店名ゲート（scripts/lib/store_name_match.js・
 * Places 経路と同じ判定器）だけでは足りない：屋号が長いと Dice が支店差を飲み込むため
 * （実測「ヨコイ 錦店」vs「ヨコイ 住吉店」= 0.88 で閾値0.85を超える）。そこで
 *   ① 店名ゲート ② 支店名トークンの一致 ③ 区（〇〇区）の一致
 * の3つを課す。②と③は独立で、②は同じ区の別支店を、③は別の区の同名店を落とす。
 * 区が読み取れない店は、店名が完全一致/包含（sim>=0.9）のときだけ採用する。
 *
 * 使い方:
 *   HOTPEPPER_API_KEY=xxxx node scripts/fill_missing_photos_from_hotpepper.js [--dry-run] [--limit N] [--only <店名の一部>]
 * 取得後:
 *   node build.js && node gen-store-pages.js
 *
 * ※ ホットペッパーID を書き戻すため、既にカタログに同じ HotPepper 店が居る場合は
 *   build.js の mergeManualStores が両者を1件に統合する（＝重複の解消も同時に起きる。
 *   実例: 「しら河 浄心本店」が手動店とHP店の2件に割れていた）。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { loadPolicy } = require('./lib/photo_policy');
const { namesMatch } = require('./lib/store_name_match');

const ROOT = path.resolve(__dirname, '..');
const MANUAL_JSON = path.join(ROOT, 'data', 'manual_stores.json');
const PENDING_JSON = path.join(ROOT, 'data', 'pending_stores.json');
const HP_BASE = 'https://webservice.recruit.co.jp/hotpepper';
const KEY = process.env.HOTPEPPER_API_KEY || '';
// 東海サービスエリア（build.js が名古屋の middle_area を引くのと同じコード）
const SERVICE_AREA = 'SA22';
// 一度試した店を毎日引き直さない。HotPepper 側の掲載は日次では動かない。
const COOLDOWN_DAYS = 7;

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const limIdx = argv.indexOf('--limit');
const LIMIT = limIdx >= 0 ? parseInt(argv[limIdx + 1], 10) : Infinity;
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

// API が「応答したか」を記録する。ネットワーク断・キー不正で全滅している状況と
// 「API は答えたが該当店が無い」を区別する（前者を7日クールダウンに数えないため）。
const apiHealth = { responded: 0, failed: 0 };

function getJson(url) {
  return new Promise((resolve) => {
    let body = '';
    const req = https.get(url, { timeout: 10000 }, (res) => {
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j && j.results && !j.results.error) apiHealth.responded++;
          else apiHealth.failed++;
          resolve(j);
        } catch { apiHealth.failed++; resolve(null); }
      });
    });
    req.on('error', () => { apiHealth.failed++; resolve(null); });
    req.on('timeout', () => { req.destroy(); apiHealth.failed++; resolve(null); });
  });
}

/** URL が実際に配信されているか（1バイトだけ要求して判定） */
function isUrlAlive(url) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve(false); }
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { Range: 'bytes=0-0' }, timeout: 10000 },
      (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 400); }
    );
    req.on('error', () => resolve(false));
    // タイムアウトを「死んでいる」と断定しない（一時障害で採用機会を捨てない）
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/** 読み仮名の括弧書きは検索クエリのノイズにしかならないので落とす */
const stripReading = (name) => String(name || '').replace(/[（(][^）)]*[）)]/g, '').trim();

/** 住所・アクセス欄から名古屋市の区を拾う（複数あり得るので集合で返す） */
function wards(text) {
  const out = new Set();
  const re = /(千種|東|北|西|中村|中|昭和|瑞穂|熱田|中川|港|南|守山|緑|名東|天白)区/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.add(m[1] + '区');
  return out;
}

/**
 * 支店名トークン（「◯◯店」）を取り出す。
 *
 * 店名ゲート（Dice）だけでは同一チェーンの別支店を分離できない。実測（2026-08-29）:
 *   「スパゲッティハウス ヨコイ 錦店」vs「スパゲッティハウス ヨコイ 住吉店」= 0.88（閾値0.85超）
 * 屋号が長いほど共通部分が支配的になり、支店名の差が沈む。しかも両店とも中区なので
 * 区ゲートも通ってしまう。＝ここを見ないと「別支店の写真が店の顔になる」（ISSUE-090 と同型）。
 *
 * 空白で区切られた末尾の「◯◯店」だけを支店名とみなす。空白が無い名前
 * （例「コメダ珈琲店」）は屋号の一部なので支店名として扱わない（取りこぼしを増やさない）。
 */
function branchToken(name) {
  const m = String(name || '').normalize('NFKC').trim().match(/[\s　]([^\s　]{1,8}店)$/);
  return m ? m[1].toLowerCase() : '';
}

/** HotPepper のサムネURLを L サイズへ格上げ（build.js の normalizePhotoUrl と同じ規則） */
function promote(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/imgfp\.hotp\.jp\/.*noimage/i.test(u)) return '';
  return u.replace(/(imgfp\.hotp\.jp\/.+?)_(?:58|100|168|238|320)\.jpg/, '$1_480.jpg');
}

/**
 * HotPepper のキーワード検索。候補を最大20件返す。
 * keyword は店名・住所等を横断で見るため、店名だけで引いて候補側でゲートする。
 */
async function searchShops(keyword) {
  const url = `${HP_BASE}/gourmet/v1/?key=${KEY}&keyword=${encodeURIComponent(keyword)}`
    + `&service_area=${SERVICE_AREA}&format=json&count=20`;
  const j = await getJson(url);
  const arr = (j && j.results && j.results.shop) || [];
  return Array.isArray(arr) ? arr : [];
}

/**
 * 候補1件がゲートを通るか。
 * @returns {{ok:boolean, reason:string, detail:string, sim:number}}
 */
function judgeCandidate(store, shop) {
  const name = store['店名'] || '';
  const m = namesMatch(name, shop.name || '');
  if (!m.ok) return { ok: false, reason: 'name-mismatch', detail: shop.name || '', sim: m.sim };

  // 支店名が双方に書かれているなら一致必須（長い屋号は Dice が支店差を飲み込むため）
  const ourBranch = branchToken(name), theirBranch = branchToken(shop.name);
  if (ourBranch && theirBranch && ourBranch !== theirBranch) {
    return { ok: false, reason: 'branch-mismatch', detail: `${ourBranch} ≠ ${theirBranch}`, sim: m.sim };
  }

  const addr = shop.address || '';
  if (!addr.includes('名古屋市')) return { ok: false, reason: 'out-of-area', detail: addr.slice(0, 24), sim: m.sim };

  // 支店違いを塞ぐ。我々の側で区が読めるなら、HotPepper 側の区と一致していること。
  const ours = wards(`${store['アクセス'] || ''} ${store['住所'] || ''} ${store['エリア'] || ''}`);
  const theirs = wards(addr);
  if (ours.size && theirs.size) {
    const shared = [...ours].some((w) => theirs.has(w));
    if (!shared) {
      return { ok: false, reason: 'ward-mismatch', detail: `${[...ours].join('/')} ≠ ${[...theirs].join('/')}`, sim: m.sim };
    }
  } else if (m.sim < 0.9) {
    // 区で裏が取れないときは、店名が完全一致/包含レベルのものだけ通す
    return { ok: false, reason: 'weak-evidence', detail: `区不明かつ一致度${m.sim}`, sim: m.sim };
  }

  const photo = promote((shop.photo && shop.photo.pc && (shop.photo.pc.l || shop.photo.pc.m || shop.photo.pc.s)) || '');
  if (!photo) return { ok: false, reason: 'no-photo', detail: '', sim: m.sim };

  return { ok: true, reason: 'ok', detail: shop.name || '', sim: m.sim, photo };
}

const isSvgOrEmpty = (u) => !u || u.includes('/assets/store-figures/');
const daysSince = (d) => { const t = Date.parse(d); return isNaN(t) ? Infinity : Math.floor((Date.now() - t) / 86400000); };

async function main() {
  if (!KEY) {
    console.error('❌ HOTPEPPER_API_KEY が未設定です。');
    console.error('   例: HOTPEPPER_API_KEY=xxxx node scripts/fill_missing_photos_from_hotpepper.js');
    process.exit(2);
  }
  const pol = loadPolicy();
  const minW = (pol.hotpepper && pol.hotpepper.minMasterWidthPx) || 480;

  const datasets = [];
  const manual = JSON.parse(fs.readFileSync(MANUAL_JSON, 'utf8'));
  datasets.push({ label: 'manual', file: MANUAL_JSON, root: manual, list: manual.stores || [] });
  if (fs.existsSync(PENDING_JSON)) {
    const pending = JSON.parse(fs.readFileSync(PENDING_JSON, 'utf8'));
    datasets.push({ label: 'pending', file: PENDING_JSON, root: pending, list: pending.pending || [] });
  }
  const all = datasets.flatMap((d) => d.list);

  const targets = all.filter((s) => {
    if (ONLY && !String(s['店名'] || '').includes(ONLY)) return false;
    if (!isSvgOrEmpty(s['写真URL'])) return false;          // 既に実写がある店は触らない
    if (s['ホットペッパーID']) return false;                 // 既に HP と紐づく店は build 側で写真を継承する
    if (!ONLY && daysSince(s['HP写真確認日']) < COOLDOWN_DAYS) return false;
    return true;
  });

  console.log(`写真なしの手動/話題店: ${all.filter((s) => isSvgOrEmpty(s['写真URL'])).length}件 → 今回の対象 ${targets.length}件`
    + `${DRY ? '（--dry-run: 書き込みなし）' : ''}\n`);

  let ok = 0, miss = 0;
  const reasons = {};
  let done = 0;
  for (const s of targets) {
    if (done >= LIMIT) break;
    done++;
    const name = s['店名'] || '';
    const shops = await searchShops(stripReading(name));
    await new Promise((r) => setTimeout(r, 250));

    let picked = null, last = null;
    for (const shop of shops) {
      const j = judgeCandidate(s, shop);
      if (j.ok) { picked = { shop, judge: j }; break; }
      if (!last || j.sim > last.sim) last = j;
    }

    // 試行した事実を記録（API が応答した回だけ）＝次回のクールダウン基準
    if (apiHealth.responded > 0 && !DRY) s['HP写真確認日'] = new Date().toISOString().slice(0, 10);

    if (!picked) {
      miss++;
      const why = shops.length === 0 ? 'HotPepper に該当なし' : `${last ? last.reason : 'no-candidate'}${last && last.detail ? `（${last.detail}）` : ''}`;
      reasons[shops.length === 0 ? 'not-listed' : (last ? last.reason : 'no-candidate')] = (reasons[shops.length === 0 ? 'not-listed' : (last ? last.reason : 'no-candidate')] || 0) + 1;
      console.log(`— ${name}: ${why} → 写真なしのまま`);
      continue;
    }

    // 格上げした _480 が本当に配信されているかを確かめる。
    // 無ければ元サイズへ戻す（存在しない解像度のURLを保存して静かに壊さないため）。
    let url = picked.judge.photo;
    const raw = (picked.shop.photo && picked.shop.photo.pc && (picked.shop.photo.pc.l || picked.shop.photo.pc.m || picked.shop.photo.pc.s)) || '';
    if (url !== raw && !(await isUrlAlive(url))) {
      if (await isUrlAlive(raw)) {
        console.log(`  ⚠ ${name}: _480 が未配信のため元サイズを採用`);
        url = raw;
      } else {
        miss++;
        reasons['photo-not-served'] = (reasons['photo-not-served'] || 0) + 1;
        console.log(`— ${name}: HotPepper 写真が配信されていない → 写真なしのまま`);
        continue;
      }
    }

    ok++;
    const widthNote = /_480\.jpg$/.test(url) ? `${minW}px` : '元サイズ';
    console.log(`✅ ${name} (一致度${picked.judge.sim}) → HotPepper 写真を採用 [${picked.shop.name}] ${widthNote}`);
    if (DRY) continue;
    s['写真URL'] = url;
    s['ホットペッパーID'] = picked.shop.id || '';
    s['写真出所'] = 'hotpepper';
    s['写真取得日'] = new Date().toISOString().slice(0, 10);
    // 証跡（なぜその写真がその店の写真だと言えるか。第三者が同じ URL を開いて検算できる）
    s['HotPepper店名'] = picked.shop.name || '';
    s['HotPepperURL'] = (picked.shop.urls && picked.shop.urls.pc) || '';
    // HotPepper 写真は帰属ゲートの対象外（店側が媒体に提出した素材）。
    // Places 用の写真クレジットが残っていると監査の判定根拠と食い違うので消す。
    delete s['写真クレジット'];
    delete s['写真幅'];
  }

  // 心拍を残す（ISSUE-084 の再適用）。このステップも build.yml では continue-on-error で回るため、
  // API が死んでいても緑のまま進む。「取得できたか」ではなく「API が応答したか」を
  // リポジトリに出る場所へ書き、photo-watchdog.yml が Mac／CI の外から検知できるようにする。
  if (!DRY && targets.length) {
    writePhotoPipelineHealth({ attempted: done, adopted: ok });
  }

  if (apiHealth.responded === 0 && targets.length) {
    console.error(`\n❌ HotPepper API から一度も正常応答がありません（失敗 ${apiHealth.failed}回）。`);
    console.error('   キー不正・レート制限・ネットワーク断のいずれか。データは書き換えずに終了します。');
    process.exit(1);
  }

  // 写真が増えなかった回も書き戻す（「試行した」記録＝HP写真確認日 を残してクールダウンを効かせる）
  if (!DRY) {
    for (const d of datasets) fs.writeFileSync(d.file, JSON.stringify(d.root, null, 2) + '\n');
  }

  console.log(`\n=== HotPepper 穴埋め結果 ===`);
  console.log(`  採用 ${ok}件 / 見送り ${miss}件`);
  if (Object.keys(reasons).length) {
    console.log('  見送りの内訳:');
    for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    ${r}: ${n}件`);
  }
  if (!DRY && ok > 0) console.log(`\n次に: node build.js && node gen-store-pages.js`);
}

/**
 * 写真取得パイプラインの心拍を data/photo_pipeline_health.json に書く。
 * 形と意図は scripts/fetch_manual_store_photos.js の同名関数と揃える
 * （Places / HotPepper の2経路を1つのファイルに並べ、片方だけ死んでも分かるようにする）。
 */
function writePhotoPipelineHealth(counts) {
  const HEALTH = path.join(ROOT, 'data', 'photo_pipeline_health.json');
  let root = {};
  try { root = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch { root = {}; }
  const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const down = apiHealth.responded === 0 && (apiHealth.failed > 0 || counts.attempted > 0);
  root.hotpepper = {
    date: jstDate,
    status: down ? 'api_down' : 'ok',
    reason: down ? `正常応答0回 / 失敗${apiHealth.failed}回（キー不正・レート制限・ネットワーク断のいずれか）` : '',
    responded: apiHealth.responded,
    failed: apiHealth.failed,
    attempted: counts.attempted,
    adopted: counts.adopted,
    recorded_at: new Date().toISOString(),
  };
  fs.writeFileSync(HEALTH, JSON.stringify(root, null, 2) + '\n', 'utf8');
}

// 判定部だけを単体テストから使えるように公開する（tests/hotpepper_photo_fill.test.js）。
// 誤マッチ（支店違い）はサイト上で「別店の写真が店の顔になる」形で表に出るため、
// API を叩かずに実データの店名・住所で回帰を止められるようにしておく。
module.exports = { judgeCandidate, wards, promote, stripReading, branchToken };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
