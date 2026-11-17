'use strict';
/**
 * scripts/journal_withdraw.js — 公開済みのジャーナル記事を取り下げる（戻す）道具（S4-4・計画 media-policy-2026-11）
 *
 *   node scripts/journal_withdraw.js --slug <slug> --reason "取り下げる理由" [--yes] [--delete-x] [--no-rebuild]
 *   node scripts/journal_withdraw.js --slug <slug> --reason "戻す理由" --restore [--yes]
 *
 * 取り下げは取り消しにくい操作なので、自動では動かさない（呼ぶのは本人が命じたときと、保留の課題で本人が選んだときだけ）。
 * - 既定は予行（何をするかを手順ごとに表示するだけ。何も書かない）。--yes のときだけ実行する。
 * - 記事のファイルは消さない（URL を残す）。やること:
 *     1. data/journal_published.json の該当行を status: withdrawn にして、corrections[] に記録を足す
 *     2. 記事に noindex（data-withdrawn の meta）と「取り下げました」の注記を入れ、「訂正の履歴」欄に1行足す
 *     3. 一覧・フィード・トップを作り直す（取り下げた記事は載らない・scripts/build_journal_index.js）
 *     4. X に投稿していたら、削除の手順を表示する。--delete-x を付けると x-delete.yml を gh で起動する（--yes も必要）
 * - 途中で失敗したら、書き換えたファイルを元に戻して止まる。--restore で元に戻せる（取り下げの注記と noindex を外す。履歴は残す）。
 * - 記事の「訂正の履歴」欄の目印は data-correction-log（scripts/journal_correct.js と同じ）。
 */
const fs = require('fs');
const path = require('path');
const C = require('./journal_correct');

const NOINDEX = '<meta name="robots" content="noindex" data-withdrawn>';
const NOTICE_RE = /\n?<p class="withdrawn-notice" data-withdrawn[^>]*>[\s\S]*?<\/p>/;

function noticeHtml(reason, day) {
  return `<p class="withdrawn-notice" data-withdrawn role="note">この記事は${C.jaDate(day)}に取り下げました。理由: ${C.esc(reason)}</p>`;
}

function withdrawHtml(html, reason, day) {
  let out = html;
  if (!out.includes(NOINDEX)) out = out.replace('</head>', NOINDEX + '\n</head>');
  if (!NOTICE_RE.test(out)) {
    const open = out.match(/<article\b[^>]*>/);
    if (!open) throw new Error('記事の本文（<article>）が見つかりません');
    const at = open.index + open[0].length;
    out = out.slice(0, at) + '\n' + noticeHtml(reason, day) + out.slice(at);
  }
  return out;
}

function restoreHtml(html) {
  return html.replace('\n' + NOINDEX, '').replace(NOINDEX + '\n', '').replace(NOINDEX, '').replace(NOTICE_RE, '');
}

/** 台帳から、この記事の X の親投稿（未削除）を探す */
function findXPosts(root, slug) {
  try {
    const log = JSON.parse(fs.readFileSync(path.join(root, 'data', 'x_post_log.json'), 'utf8'));
    return (log.posts || []).filter((p) => p.slug === slug && p.tweet_id && !p.deleted_at).map((p) => p.tweet_id);
  } catch (_) { return []; }
}

function run({ slug, reason, restore = false, yes = false, deleteX = false, rebuild = true, root = path.resolve(__dirname, '..'), now = new Date(), exec = null, ghExec = null, by = 'manual' }) {
  if (!reason || !String(reason).trim()) return { ok: false, code: 'no_reason' };
  const t = C.loadTarget(root, slug);
  if (t.error) return { ok: false, code: t.error };
  const isWithdrawn = t.entry.status === 'withdrawn';
  if (!restore && isWithdrawn) return { ok: false, code: 'already_withdrawn' };
  if (restore && !isWithdrawn) return { ok: false, code: 'not_withdrawn' };
  const kind = restore ? 'restore' : 'withdrawal';
  const record = { at: now.toISOString(), kind, summary: String(reason).trim().slice(0, 300), by };
  const day = C.jstDate(now);
  const xIds = restore ? [] : findXPosts(root, slug);
  const steps = [
    `台帳 ${C.PUBLISHED_REL}: ${slug} を ${restore ? 'published' : 'withdrawn'} にして記録を足す`,
    restore ? '記事: noindex と取り下げの注記を外し、「訂正の履歴」欄に1行足す' : '記事: noindex と取り下げの注記を入れ、「訂正の履歴」欄に1行足す',
    rebuild ? '一覧・フィード・トップを作り直す（node scripts/build_journal_index.js）' : '（--no-rebuild: 一覧の作り直しは行わない）',
  ];
  if (xIds.length) steps.push(deleteX ? `X: x-delete.yml を起動して ${xIds.join(', ')} を削除` : `X: 削除は別の手順（--delete-x を付けるか、gh workflow run x-delete.yml -f slug=${slug} -f reason=...）。対象 ${xIds.join(', ')}`);
  if (!yes) return { ok: true, code: 'dry_run', mode: restore ? 'restore' : 'withdraw', slug, steps, record };

  const snaps = [[t.p.html, t.html], [t.p.pub, t.rawPub]];
  C.withRollback(snaps, () => {
    // 手順ごとに、やった内容を確かめてから次へ進む
    const html = restore ? C.addCorrectionLog(restoreHtml(t.html), record) : C.addCorrectionLog(withdrawHtml(t.html, record.summary, day), record);
    fs.writeFileSync(t.p.html, html);
    const check = fs.readFileSync(t.p.html, 'utf8');
    if (restore ? check.includes(NOINDEX) : !check.includes(NOINDEX)) throw new Error('記事の書き換えを確認できませんでした');
    if (restore) delete t.entry.status; else t.entry.status = 'withdrawn';
    t.entry.corrections = (t.entry.corrections || []).concat([record]);
    C.writePublished(t.p.pub, t.pub);
    if (rebuild) C.runRebuild(root, exec);
  });

  const out = { ok: true, code: restore ? 'restored' : 'withdrawn', slug, record, x_posts: xIds, x_delete: 'not_requested' };
  if (deleteX && xIds.length) {
    // X の削除は戻せない。記事の取り下げが済んだ後に、1件ずつ起動する（失敗しても記事側は取り下げ済みのまま、結果を返す）
    const gh = ghExec || ((args) => require('child_process').execFileSync('gh', args, { encoding: 'utf8' }));
    out.x_delete = xIds.map((id) => {
      try { gh(['workflow', 'run', 'x-delete.yml', '-f', `tweet_id=${id}`, '-f', `reason=記事の取り下げ: ${record.summary.slice(0, 100)}`]); return { id, started: true }; }
      catch (e) { return { id, started: false, error: String(e.message).slice(0, 200) }; }
    });
  }
  return out;
}

function parseArgs(argv) {
  const a = { yes: false, rebuild: true, restore: false, deleteX: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--yes') a.yes = true;
    else if (k === '--restore') a.restore = true;
    else if (k === '--delete-x') a.deleteX = true;
    else if (k === '--no-rebuild') a.rebuild = false;
    else if (k === '--slug') a.slug = argv[++i];
    else if (k === '--reason') a.reason = argv[++i];
  }
  return a;
}

if (require.main === module) {
  try {
    const r = run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  } catch (e) { console.error(`失敗（書いたファイルは元に戻しました）: ${e.message}`); process.exit(1); }
}

module.exports = { run, parseArgs, withdrawHtml, restoreHtml, findXPosts, NOINDEX };
