#!/usr/bin/env node
/**
 * NAGOYA BITES — 店舗写真取得パイプラインの生存確認
 *
 * 何を見るか（2026-08-29 に判明した実害）:
 *   Google Places API の課金が 2026-08-20 に止まって以降、日次の写真取得は毎回
 *     OVER_QUERY_LIMIT — "You have exceeded your daily request quota for this API.
 *     ... verify your project has an active billing account"
 *   を返し、**1件も写真を取得できていなかった**。しかし build.yml のそのステップは
 *   continue-on-error: true で回るためジョブは緑のまま、9日間誰も気づかなかった。
 *
 *   既存のデータ監査（audit_photo_policy.js / audit_photo_coverage.js）はこの故障を
 *   **原理的に検出できない**。どちらも「いま入っているデータが基準どおりか」を見るもので、
 *   「写真が無い」は基準どおりの正常だからである。壊れているのは取得経路の方で、
 *   その事実はデータの中に現れない。
 *
 * 何を「検証できる事実」とみなすか（CLAUDE.md 制約10）:
 *   ○ data/photo_pipeline_health.json の実在と date の鮮度
 *       … 動いていないスクリプトはこのファイルを更新できないので偽装不能。本体の検知シグナル
 *   ○ status（api_down / ok）… 「API が応答したか」であって「写真が取れたか」ではない。
 *       取得0件は正常（基準を満たす写真が無い日もある）。応答0回は異常。ここが線引き
 *   △ reason … API が返した文面をそのまま運ぶ。合否は分けないが、人が原因に辿り着く材料
 *       （ISSUE-084 原則5: 何が壊れたかまで運べば、人はログを読みに行かなくて済む）
 *
 * 何を検知“しない”か（オオカミ少年化させない・ISSUE-084 原則6）:
 *   「写真の無い店が N 件ある」は異常ではない。オーナー投稿写真が存在しない店は
 *   data/photo_policy.json のとおり写真なしが正解で、鳴らすと毎日鳴り続ける。
 *   鳴らすのは「取得経路が働けていないこと」だけ。
 *
 * 使い方:
 *   node scripts/check_photo_pipeline_health.js            # 人が読む要約
 *   node scripts/check_photo_pipeline_health.js --json     # 機械可読（CI が読む）
 *   node scripts/check_photo_pipeline_health.js --max-silence-days 3
 *
 * 終了コード: 健全=0 / 異常=1（CI が分岐に使う）
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const HEALTH = path.join(REPO, 'data', 'photo_pipeline_health.json');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const msIdx = argv.indexOf('--max-silence-days');
const MAX_SILENCE_DAYS = msIdx >= 0 ? parseInt(argv[msIdx + 1], 10) : 3;
// 日枠到達が何日続いたら「枠不足」として鳴らすか
const QUOTA_STREAK_LIMIT = 3;

// 監視する取得経路。片方だけ死んでも分かるように別々に見る。
const PROVIDERS = [
  { key: 'places', label: 'Google Places', fix: 'Google Cloud の課金アカウントと Places API の日次上限を確認する（コードでは直せない）' },
  { key: 'hotpepper', label: 'HotPepper', fix: 'HOTPEPPER_API_KEY（GitHub Secrets）の有効性とレート制限を確認する' },
];

const jstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000).toISOString().slice(0, 10);

function daysBetween(fromYmd, toYmd) {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

const today = jstDate();
const result = {
  ok: true,
  today_jst: today,
  max_silence_days: MAX_SILENCE_DAYS,
  providers: {},
  problems: [],
  warnings: [],
};

let root = null;
try { root = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch { root = null; }

if (!root) {
  result.ok = false;
  result.problems.push({
    kind: 'no_heartbeat',
    provider: '-',
    detail: 'data/photo_pipeline_health.json が存在しません。写真取得のステップが一度も完走していない可能性があります。',
    fix: 'build.yml の写真取得ステップのログを確認する',
  });
} else {
  for (const p of PROVIDERS) {
    const h = root[p.key];
    if (!h || !h.date) {
      // 一度も動いていない経路は「まだ配線されていない」だけの可能性があるので警告に留める。
      // 経路の追加直後に赤くしても、人は何も直せない。
      result.warnings.push(`${p.label}: 心拍がまだありません（未実行 or 未配線）`);
      result.providers[p.key] = { status: 'unknown' };
      continue;
    }
    const silence = daysBetween(h.date, today);
    result.providers[p.key] = {
      status: h.status, date: h.date, silence_days: silence,
      reason: h.reason || '', adopted: h.adopted, attempted: h.attempted,
      quota_reached_streak: h.quota_reached_streak || 0,
    };
    // 日枠到達そのものは異常ではない（枠を使い切っただけで、翌日には回る）。
    // ただし何日も続くなら枠が実需に足りておらず、**写真は永久に増えない**。
    // これは人が予算・設計を判断する以外に直しようがないので、そこで初めて鳴らす
    // （ISSUE-084 原則6: 平常で鳴らさない／原則4: 人手が要る失敗ほど通知が唯一の復旧経路）。
    if (h.status === 'quota_reached' && (h.quota_reached_streak || 0) >= QUOTA_STREAK_LIMIT) {
      result.ok = false;
      result.problems.push({
        kind: 'quota_starved', provider: p.label,
        detail: `${h.quota_reached_streak}日連続で日次上限に到達（許容 ${QUOTA_STREAK_LIMIT}日）。枠が実需に足りていないため、写真は増えません。${h.reason || ''}`.trim(),
        fix: '日次上限（consumer override）か月予算のどちらを動かすかを決める。上限だけ上げると請求が増えるので、両方を突き合わせて判断すること',
      });
    } else if (h.status === 'quota_reached') {
      result.warnings.push(`${p.label}: 日次上限に到達（${h.quota_reached_streak || 1}日連続 / ${QUOTA_STREAK_LIMIT}日で異常扱い）`);
    }
    if (h.status === 'api_down') {
      result.ok = false;
      result.problems.push({
        kind: 'api_down', provider: p.label,
        detail: `${h.date} 時点で API から正常応答が0回（試行 ${h.attempted}件 / 失敗 ${h.failed}回）。${h.reason || ''}`.trim(),
        fix: p.fix,
      });
    } else if (silence !== null && silence > MAX_SILENCE_DAYS) {
      result.ok = false;
      result.problems.push({
        kind: 'stale_heartbeat', provider: p.label,
        detail: `最後の心拍が ${h.date}（${silence}日前 / 許容 ${MAX_SILENCE_DAYS}日）。取得ステップ自体が回っていない可能性があります。`,
        fix: 'build.yml のスケジュール実行と該当ステップのログを確認する',
      });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('=== 店舗写真取得パイプライン 生存確認 ===');
  console.log(`基準日(JST): ${today} / 許容欠測: ${MAX_SILENCE_DAYS}日\n`);
  for (const p of PROVIDERS) {
    const v = result.providers[p.key] || { status: 'unknown' };
    const mark = v.status === 'ok' ? '✅' : (v.status === 'api_down' ? '❌' : '—');
    console.log(`${mark} ${p.label}: ${v.status}${v.date ? `（${v.date} / ${v.silence_days}日前）` : ''}`);
    if (v.reason) console.log(`     理由: ${v.reason}`);
    if (typeof v.adopted === 'number') console.log(`     試行 ${v.attempted}件 → 採用 ${v.adopted}件`);
  }
  if (result.problems.length) {
    console.log('\n--- 検出した問題 ---');
    for (const p of result.problems) console.log(`  ❌ [${p.kind}] ${p.provider}: ${p.detail}\n     対処: ${p.fix}`);
  }
  for (const w of result.warnings) console.log(`  ⚠ ${w}`);
  console.log(`\n判定: ${result.ok ? '健全' : '異常あり'}`);
}

process.exit(result.ok ? 0 : 1);
