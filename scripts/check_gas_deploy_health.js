#!/usr/bin/env node
/**
 * NAGOYA BITES — GAS レポートの反映状況 記録＆生存確認（SEO-069）
 *
 * 問題（2026-08-23 検出）:
 *   毎朝のレポートを作っている GAS は**リポジトリの外**で動いており、`.gas-deploy/Code.js` は
 *   ただのミラー。CIデプロイ経路が無いため、修正をマージしても GAS 側は旧コードのまま動き続ける。
 *   その結果 SEO-047 / SEO-057 / SEO-062 / SEO-063 の4件が未反映のまま積み上がり、
 *   **修正済みのバグが出力した数値の上で毎朝のアドバイスが生成されていた**（SEO-047 は24日滞留）。
 *   反映されたかを知る経路は「オーナーが翌朝のレポートを読んで気づく」だけ＝CLAUDE.md の言う
 *   検知ではなく記録（ISSUE-084 原則3）。
 *
 * 分担（ISSUE-084 の原則1・2をそのまま適用）:
 *   記録 … triage ルーチン（Gmail は CI から引けないので、メールを読める側がやる）
 *          `--record` で痕跡を data/gas_deploy_health.json に書き、コミットで Mac の外へ出す
 *   監視 … GitHub Actions（gas-deploy-watchdog.yml）。ローカルが丸ごと死んでも動く
 *   通知 … GitHub Issue → オーナーにメール（届いた実績のある経路）
 *
 * 使い方:
 *   # triage ルーチンが毎回呼ぶ（新着レポートが無い日も --no-report で心拍だけ書く）
 *   node scripts/check_gas_deploy_health.js --record --report-file <本文.txt> --date 2026-08-24 --kind daily
 *   node scripts/check_gas_deploy_health.js --record --no-report --date 2026-08-24
 *
 *   # CI・人が見る
 *   node scripts/check_gas_deploy_health.js            # 人が読む要約
 *   node scripts/check_gas_deploy_health.js --json     # 機械可読（CI が読む）
 *
 * 終了コード: 健全=0 / 異常=1
 */

const fs = require('fs');
const path = require('path');
const { loadPolicy, analyzeReport, jstDate, daysBetween } = require('./lib/gas_deploy_trace');

const REPO = path.resolve(__dirname, '..');
const HEALTH = path.join(REPO, 'data', 'gas_deploy_health.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

function loadHealth() {
  return readJson(HEALTH) || {
    version: 1,
    _comment:
      'GAS 反映状況の痕跡。triage ルーチンが毎回（レポートが無い日も）書き、コミットで Mac の外＝GitHub へ出す。' +
      'gas-deploy-watchdog.yml がこれを読み、旧コードのままの状態が続いたら Issue を起票する（＝オーナーにメール）。' +
      '判定は data/gas_deploy_policy.json の痕跡だけで行い、自己申告は使わない（CLAUDE.md 制約10）。',
    last_run: null,
    observations: [],
  };
}

// ──────────────────────────────────────────────────────────
// --record: 痕跡を記録する（triage ルーチンから呼ばれる）
// ──────────────────────────────────────────────────────────
function record() {
  const policy = loadPolicy();
  const health = loadHealth();
  const date = val('--date') || jstDate();
  const kind = val('--kind', 'daily');

  let observation = null;

  if (has('--no-report')) {
    // レポートが Gmail に無かった日。心拍だけ残す（0件と「引けなかった」を区別できるように）
    health.last_run = {
      date,
      recorded_at: new Date().toISOString(),
      status: val('--status', 'no_report'),
      reason: val('--reason', 'この日は対象レポートが Gmail に見つからなかった'),
      verdict: null,
    };
  } else {
    const file = val('--report-file');
    if (!file || !fs.existsSync(file)) {
      console.log(JSON.stringify({ ok: false, error: '--report-file が無い、または読めない' }));
      process.exit(1);
    }
    const body = fs.readFileSync(file, 'utf8');

    // 数値シグナル（SEO-074）の参照値。GAS レポートが主張した直帰率を、独立パイプライン
    // fetch_ga4_views.js が同じ日の GA4 から取った値と突き合わせるために読む。
    // 文字列を変えない修正（SEO-062）は文字列痕跡では検出できないため、これが唯一の検知経路。
    // 参照が無ければ従来どおり文字列痕跡だけで判定する（鳴らさない側に倒す）。
    let reference = null;
    let referenceNote = null;
    try {
      const sm = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'site_metrics.json'), 'utf8'));
      // SEO-076: 直帰率はレポート対象日ではなく「確定済みの日」の値として出る。どの日の値かは
      // レポート本文に『（確定値・YYYY-MM-DD）』として刻まれているので、それを正として突き合わせる。
      // 本文に無い（＝旧コード）場合はレポート対象日を期待日にする（従来どおりの判定）。
      const sp = policy.settled_date_pattern
        ? new RegExp(policy.settled_date_pattern) : /確定値・(\d{4}-\d{2}-\d{2})/;
      const sm2 = body.match(sp);
      const expected = sm2 ? sm2[1] : date;
      if (sm.dailyReference && sm.dailyReference.date === expected) reference = sm.dailyReference;
      else {
        // なぜ黙ったのかを第三者が後から検算できるようにする（制約10・SEO-075）
        referenceNote = `参照値の日付 ${sm.dailyReference ? sm.dailyReference.date : 'なし'} が` +
          ` レポートが名乗る対象日 ${expected} と一致しないため数値判定をしない`;
      }
    } catch (e) { /* 参照が無い/壊れている日は数値判定をしない */ }

    const r = analyzeReport(body, policy, reference);

    observation = {
      date,
      kind,
      verdict: r.verdict,
      missing_fixes: r.missing_fixes,
      // 証跡: 判定の根拠になった行そのものを残す。これが無いと第三者が後から検算できない
      evidence: r.matched.map((m) => ({ key: m.key, fix_id: m.fix_id, verdict: m.verdict, line: m.line })),
      // 数値検算の材料（後から第三者が GA4 を開いて検算できるように両方の実数を残す）
      numeric_reference: reference ? { date: reference.date, bounceRate: reference.bounceRate, sessions: reference.sessions } : null,
      numeric_reference_skipped: reference ? null : referenceNote,
      recorded_at: new Date().toISOString(),
    };

    // 同じ日・同じ種別の再記録は上書き（冪等。同じメールを再処理しても増えない）
    health.observations = (health.observations || []).filter((o) => !(o.date === date && o.kind === kind));
    health.observations.push(observation);
    health.observations.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date.localeCompare(b.date)));
    // 直近90件だけ保持（ファイルを無限に太らせない）
    if (health.observations.length > 90) health.observations = health.observations.slice(-90);

    health.last_run = {
      date,
      recorded_at: new Date().toISOString(),
      status: 'ok',
      reason: null,
      verdict: r.verdict,
      missing_fixes: r.missing_fixes,
    };
  }

  fs.writeFileSync(HEALTH, JSON.stringify(health, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, recorded: observation || health.last_run }, null, 2));
}

// ──────────────────────────────────────────────────────────
// 既定: 健全性を判定する（CI・人が読む）
// ──────────────────────────────────────────────────────────
function check() {
  const policy = loadPolicy();
  const w = policy.watchdog || {};
  const MAX_SILENCE = Number.isFinite(w.max_silence_days) ? w.max_silence_days : 3;
  const MAX_NOT_DEPLOYED = Number.isFinite(w.max_not_deployed_days) ? w.max_not_deployed_days : 2;

  const today = jstDate();
  const health = loadHealth();
  const problems = [];
  const warnings = [];

  const pending = policy.pending_fixes || [];
  const observations = health.observations || [];
  const lastRun = health.last_run;

  // ---- 1. ルーチンが報告してきているか（鮮度は自己申告できない＝本体の検知シグナル）----
  let silenceDays = null;
  if (!lastRun || !lastRun.date) {
    problems.push({
      kind: 'no_heartbeat',
      detail:
        'data/gas_deploy_health.json に記録が無い。triage ルーチンが一度も痕跡を書いていない。' +
        'ルーチンの起動・push 権限・スケジュール登録を疑う。',
    });
  } else {
    silenceDays = daysBetween(lastRun.date, today);
    if (silenceDays !== null && silenceDays > MAX_SILENCE) {
      problems.push({
        kind: 'stale_heartbeat',
        detail:
          `最後の記録が ${lastRun.date}（${silenceDays}日前・許容 ${MAX_SILENCE}日）。` +
          'triage ルーチンが動いていないか、動いてもコミット/push できていない。',
      });
    }
  }

  // ---- 2. 旧コードのまま動いているか（indeterminate では絶対に鳴らさない）----
  // 直近の確定した観測（indeterminate を飛ばす）を新しい順に見る
  // デプロイ実績より前の観測は、その後に反映されている可能性があるので鳴らす根拠にしない。
  // （鳴りっぱなしを避ける・ISSUE-084 原則6「復旧したら自動で静かにする」。SEO-074）
  // 「デプロイした」という自己申告ではなく、clasp pull で本番の実体を引いて
  // リポジトリと**バイト一致**を確認した記録だけを実績として扱う（制約10）。
  const lastVerifiedDeploy = (health.deploys || [])
    .filter((d) => d.verified_identical)
    .map((d) => d.date)
    .sort()
    .pop() || null;

  const decided = observations
    .filter((o) => o.verdict === 'not_deployed' || o.verdict === 'deployed')
    .filter((o) => !(lastVerifiedDeploy && o.verdict === 'not_deployed' && o.date <= lastVerifiedDeploy));
  const latestDecided = decided.length ? decided[decided.length - 1] : null;

  // 連続して not_deployed が続いた日数（確定した観測ベース）
  let notDeployedStreak = 0;
  for (let i = decided.length - 1; i >= 0; i--) {
    if (decided[i].verdict === 'not_deployed') notDeployedStreak++;
    else break;
  }

  const missingFixes = latestDecided && latestDecided.verdict === 'not_deployed'
    ? latestDecided.missing_fixes || []
    : [];

  if (latestDecided && latestDecided.verdict === 'not_deployed' && notDeployedStreak >= MAX_NOT_DEPLOYED) {
    problems.push({
      kind: 'not_deployed',
      detail:
        `GAS 側が旧コードのまま動いている（${latestDecided.date} 時点の ${latestDecided.kind} レポートで確定・` +
        `確定観測 ${notDeployedStreak}回連続・許容 ${MAX_NOT_DEPLOYED}回）。` +
        (missingFixes.length ? `未反映と判定できた修正: ${missingFixes.join(', ')}。` : '') +
        `リポジトリ側で反映待ちの修正は ${pending.length}件（${pending.map((p) => p.id).join(', ')}）。` +
        'デプロイはオーナー本人の操作が必要（GAS エディタへのコピペ or clasp push）。',
    });
  } else if (latestDecided && latestDecided.verdict === 'not_deployed') {
    warnings.push(
      `${latestDecided.date} の ${latestDecided.kind} レポートで旧コードを検出（${notDeployedStreak}回連続）。` +
      `${MAX_NOT_DEPLOYED}回連続で Issue を起票する。`
    );
  }

  // ---- 3. 反映済みなのに pending_fixes が残っている（＝ポリシーの更新漏れ）----
  if (latestDecided && latestDecided.verdict === 'deployed' && pending.length > 0) {
    warnings.push(
      `${latestDecided.date} のレポートで新コードの痕跡を確認したが、data/gas_deploy_policy.json の ` +
      `pending_fixes に ${pending.length}件（${pending.map((p) => p.id).join(', ')}）が残っている。` +
      '反映が済んだなら pending_fixes を空にして、該当チケットの status を done に更新すること。'
    );
  }

  // ---- 4. 確定材料が長く出ていない（鳴らさないが、検知が効いていない可能性は伝える）----
  if (!latestDecided && observations.length > 0) {
    warnings.push(
      `観測は ${observations.length}件あるが、すべて indeterminate（その日のデータが分岐を通らなかった）。` +
      '痕跡が出る条件（GA4しきい値行の存在など）に依存するため、これ自体は異常ではない。'
    );
  }

  const result = {
    ok: problems.length === 0,
    today_jst: today,
    max_silence_days: MAX_SILENCE,
    max_not_deployed_days: MAX_NOT_DEPLOYED,
    silence_days: silenceDays,
    last_run: lastRun,
    latest_decided: latestDecided,
    not_deployed_streak: notDeployedStreak,
    last_verified_deploy: lastVerifiedDeploy,
    missing_fixes: missingFixes,
    pending_fixes: pending,
    observations_total: observations.length,
    problems,
    warnings,
  };

  if (has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[GAS 反映状況 確認] JST ${today}`);
    if (lastRun) {
      console.log(`  最後の記録: ${lastRun.date}（${silenceDays}日前） / status=${lastRun.status} / verdict=${lastRun.verdict || '—'}`);
    } else {
      console.log('  記録なし');
    }
    if (latestDecided) {
      console.log(`  直近の確定判定: ${latestDecided.date}（${latestDecided.kind}） → ${latestDecided.verdict}`);
      for (const e of latestDecided.evidence || []) {
        console.log(`     根拠[${e.key}/${e.fix_id}] ${e.line}`);
      }
    } else {
      console.log('  直近の確定判定: なし（すべて indeterminate）');
    }
    console.log(`  反映待ちの修正: ${pending.length}件${pending.length ? ' — ' + pending.map((p) => p.id).join(', ') : ''}`);
    if (result.ok) {
      console.log('✅ 健全');
    } else {
      console.log(`🔴 異常 ${problems.length}件`);
      for (const p of problems) console.log(`   - [${p.kind}] ${p.detail}`);
    }
    for (const wm of warnings) console.log(`   ⚠️  ${wm}`);
  }

  process.exit(result.ok ? 0 : 1);
}

if (has('--record')) record();
else check();
