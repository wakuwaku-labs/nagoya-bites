#!/usr/bin/env node
'use strict';
/**
 * X に投稿する前の待ち合わせ（.github/workflows/x-post.yml が scripts/post_journal_to_x.js の前に呼ぶ）。
 *
 *   (a) data/x_post_policy.json の postSlot に従い、平日（JST）は 12:00 まで眠る。土日・過去日の手動実行は待たない
 *       （枠の計算は scripts/lib/x_post.js の planWait）。mode が off・その日のジャーナルが無い・投稿済み・--now のときは眠らない。
 *       眠るのは postSlot.maxWaitMinutes 分まで（早朝に公開された日でもジョブの上限 timeout-minutes を超えないため。超える分は早めに出す）
 *   (b) 眠ったあと git pull --ff-only origin main で最新の main（保存した文面と台帳）を取り込む
 *   (c) その日の data/x_post_drafts/<date>.json がまだ無く、draft.generate と draft.useInPost が true なら、
 *       postSlot.draftWaitMinutes 分まで1分おきに pull して文面を待つ。届かなければそのまま抜ける
 *       （投稿は今までどおり定型の文面に戻る）
 *
 * なぜ待つか: Mac 側は記事の公開（data/journal_published.json の push）の後に、別のコミットで文面を push する。
 * x-post.yml は前者の push で起動するため、起動した時点の main には文面がまだ無いことがある
 * （2026-10-21・22 に定型へ落ちた原因）。
 *
 * git の失敗では止めない（警告を出して続ける）。待ちの失敗で投稿そのものを失わないため。
 *
 * 使い方: node scripts/x_post_wait.js [--date YYYY-MM-DD] [--now]（--now = 手動実行で枠を待たない。文面待ち (c) はする）
 * 終了コードは常に 0。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const X = require('./lib/x_post');
const { findEntry, todayJst } = require('./post_journal_to_x');

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 最新の main を取り込む。返り値: { ok, error? }（投げない） */
function gitPull(root) {
  try {
    execFileSync('git', ['pull', '--ff-only', 'origin', 'main'], { cwd: root, stdio: 'pipe', timeout: 120000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e.stderr && e.stderr.toString().trim()) || e.message).split('\n')[0] };
  }
}

function parseArgs(argv) {
  const a = { date: null, now: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date') a.date = argv[++i];
    else if (argv[i] === '--now') a.now = true;
    else throw new Error(`知らない引数: ${argv[i]}`);
  }
  if (a.date && !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('--date は YYYY-MM-DD');
  return a;
}

/**
 * 返り値: { result, slept, pulls, draftWaited, ... }。sleep / pull / now / log は差し替えられる（テスト用）。
 * result = off / no_journal / already_posted / done
 */
async function run(args = {}, { root = X.ROOT, now = () => new Date(), sleep = realSleep, pull = gitPull, log = (m) => console.log(m) } = {}) {
  const policy = X.loadPolicy(root);
  const date = args.date || todayJst(now());
  const out = { date, slept: 0, pulls: 0, draftWaited: 0 };
  const tryPull = () => {
    out.pulls++;
    const r = pull(root);
    if (!r.ok) log(`警告: git pull に失敗しました（${r.error || '理由不明'}）。取り込めないまま続けます`);
    return r.ok;
  };

  if (policy.mode === 'off') { log('X 投稿の mode が off のため待ちません'); return { ...out, result: 'off' }; }
  const entry = findEntry(date, root);
  if (!entry) { log(`${date} のジャーナルが無いため待ちません`); return { ...out, result: 'no_journal' }; }
  if (X.alreadyPosted(X.readLog(root), entry.slug)) { log('投稿済みのため待ちません'); return { ...out, result: 'already_posted' }; }

  // (a) 投稿枠まで眠る
  const plan = args.now ? { waitSeconds: 0, slot: null, reason: 'now' } : X.planWait({ policy, date, now: now() });
  out.plan = plan;
  const capMin = Number((policy.postSlot || {}).maxWaitMinutes);
  const waitSeconds = Number.isFinite(capMin) && capMin >= 0 ? Math.min(plan.waitSeconds, capMin * 60) : plan.waitSeconds;
  if (waitSeconds > 0) {
    log(`投稿枠 ${plan.slot}（JST）まであと ${Math.ceil(plan.waitSeconds / 60)} 分。${waitSeconds < plan.waitSeconds ? `上限の ${capMin} 分だけ` : ''}待ちます`);
    await sleep(waitSeconds * 1000);
    out.slept = waitSeconds;
    // (b) 眠っている間に届いた文面・台帳を取り込む
    tryPull();
  } else {
    log(`待たずに進みます（${plan.reason}）`);
  }

  // (c) 保存した文面がまだ無ければ、決めた分数まで1分おきに取り込み直して待つ
  const d = policy.draft || {};
  const maxMin = Math.max(0, Number((policy.postSlot || {}).draftWaitMinutes) || 0);
  if (d.generate && d.useInPost && maxMin > 0 && !fs.existsSync(X.draftPath(date, root))) {
    log(`保存した文面（${date}.json）がまだ無いので、最大 ${maxMin} 分待ちます`);
    for (let i = 1; i <= maxMin; i++) {
      await sleep(60000);
      out.draftWaited = i;
      tryPull();
      if (fs.existsSync(X.draftPath(date, root))) { log(`文面が届きました（${i} 分後）`); out.draftArrived = true; break; }
    }
    if (!out.draftArrived) log('文面が届かないまま待ち時間が尽きました。定型の文面で投稿します');
  }
  return { ...out, result: 'done' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const r = await run(args);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### X 投稿の待ち合わせ\n- 結果: ${r.result} / 待機 ${Math.round(r.slept / 60)} 分 / 文面待ち ${r.draftWaited} 分 / pull ${r.pulls} 回\n`);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`警告: 待ち合わせで例外（${e.message}）。投稿は続けます`); process.exitCode = 0; });
}

module.exports = { run, gitPull, parseArgs };
