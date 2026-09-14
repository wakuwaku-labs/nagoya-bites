'use strict';
/**
 * scripts/promote_trending_candidate.js
 *
 * 話題店発掘ループ（docs/trending-scout-runbook.md）が data/trending_stores.json の
 * candidates[]（LOCAL_STORES未登録の話題店）を、実在検証を経て data/pending_stores.json
 * （build.js が次回ビルドで LOCAL_STORES へマージする外部媒体キュー）へ正式に橋渡しする
 * ためのヘルパー。CLAUDE.md「🚫架空店ブロック」の規律を機械的に強制する。
 *
 * 【なぜ必要か】
 * merge_pending_stores.js は「写真URLが無く、かつ 写真失敗理由 が付いている」エントリを
 * 自動的にマージ対象から除外する（ISSUE-120）。つまり fetch_manual_store_photos.js を
 * 一度も走らせていない新規エントリは、この保護が働かず**無検証のまま次の build.js で
 * 公開されてしまう**。このスクリプトの add-pending は写真フィールドを空のまま追加する
 * ため、直後に必ず fetch_manual_store_photos.js --only を走らせ、status で結果を確認する
 * ことが前提の運用（runbook Step 6 参照）。
 *
 * 【三重検証の実体】
 * fetch_manual_store_photos.js が店名一致(Dice)＋名古屋/愛知の住所＋飲食店業態を検証する。
 * 落ちた場合は 写真失敗理由 に name-mismatch / out-of-area / not-food / photo-policy が
 * 記録される。前3つは「実在確認そのものに失敗」、photo-policy は「実在は確認できたが
 * 採用基準を満たす写真が無い」。pending 方式は写真必須（ISSUE-120）のため、どちらの場合も
 * 現状は非公開のまま保留される（架空店を掲載しないための安全側フォールバック）。
 *
 * 使い方:
 *   node scripts/promote_trending_candidate.js --check
 *     … 段階ゲート（data/trending_scout_policy.json の listing セクション）を満たした
 *       candidates[] の一覧を表示（実在検証にまだ進んでいないものが対象）
 *
 *   node scripts/promote_trending_candidate.js add-pending "<店名>" \
 *     --area <エリア> --genre <ジャンル> --access <アクセス> --price <価格帯> \
 *     --note "<おすすめポイント 60-120字>" --source-confirm-url <一次情報URL>
 *     … candidates[] から該当店を pending_stores.json へ草稿として追加する。
 *       --source-confirm-url は食べログ/ホットペッパー/Retty/ぐるなび/公式サイト/
 *       公式Instagram/地域メディアなど「実在を確認した一次情報」のURL（agents/editor.md
 *       の「掲載前チェック」に相当・WebSearchで確認した後に渡す）。
 *       追加後、candidates[] の該当エントリは削除せず _promoted_to_pending:true を付けて
 *       追跡可能にする。
 *
 *   node scripts/promote_trending_candidate.js status ["<店名>"]
 *     … pending_stores.json の各エントリが「検証済み・公開待ち」「実在検証NG・保留」
 *       「写真基準未達・保留」「未検証（要 fetch_manual_store_photos.js 実行）」の
 *       どれかを判定して表示する。「未検証」が残っている限り、次の build.js で無検証の
 *       まま公開されるリスクがあるため、runbook はこれを 0件にしてから終了する。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRENDING_PATH = path.join(ROOT, 'data', 'trending_stores.json');
const PENDING_PATH = path.join(ROOT, 'data', 'pending_stores.json');
const POLICY_PATH = path.join(ROOT, 'data', 'trending_scout_policy.json');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function jstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function daysSince(dateStr) {
  const d = Date.parse(dateStr + 'T00:00:00+09:00');
  if (isNaN(d)) return -Infinity;
  const now = Date.parse(jstToday() + 'T00:00:00+09:00');
  return Math.floor((now - d) / 86400000);
}

function loadListingPolicy() {
  const policy = readJson(POLICY_PATH, {});
  return Object.assign(
    { min_days_since_detected: 3, min_source_urls: 2 },
    policy.listing || {}
  );
}

function cmdCheck() {
  const trending = readJson(TRENDING_PATH, { candidates: [] });
  const pol = loadListingPolicy();
  const candidates = (trending.candidates || []).filter(c => c && c['店名'] && !c._promoted_to_pending);
  if (candidates.length === 0) {
    console.log('candidates[] は空です（発掘元 _comment のみ、または全て promote 済み）。');
    return;
  }
  console.log(`段階ゲート: 検出から${pol.min_days_since_detected}日以上 かつ 出典URL${pol.min_source_urls}件以上\n`);
  let eligible = 0;
  candidates.forEach(c => {
    const days = daysSince(c['検出日']);
    const urlCount = (c['出典URL'] || []).length;
    const ok = days >= pol.min_days_since_detected && urlCount >= pol.min_source_urls;
    if (ok) eligible++;
    console.log(`${ok ? '✅ 検証対象' : '⏳ 保留中'} ${c['店名']} — 検出${days}日前 / 出典${urlCount}件${ok ? '' : `（あと${Math.max(0, pol.min_days_since_detected - days)}日 or 出典${Math.max(0, pol.min_source_urls - urlCount)}件不足）`}`);
  });
  console.log(`\n検証対象: ${eligible}件 / 保留中: ${candidates.length - eligible}件`);
  if (eligible > 0) {
    console.log('\n検証対象の各店について、WebSearchで一次情報（食べログ/ホットペッパー/Retty/ぐるなび/公式サイト/公式Instagram/地域メディア）による実在確認を行い、確認できたら add-pending で登録してください。');
  }
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
      flags[key] = val;
    }
  }
  return flags;
}

function cmdAddPending(name, flags) {
  if (!name) { console.error('店名を指定してください'); process.exit(1); }
  const required = ['area', 'genre', 'access', 'price', 'note', 'source-confirm-url'];
  const missing = required.filter(k => !flags[k]);
  if (missing.length) {
    console.error('不足オプション: ' + missing.map(k => '--' + k).join(' '));
    console.error('使い方: node scripts/promote_trending_candidate.js add-pending "<店名>" --area <エリア> --genre <ジャンル> --access <アクセス> --price <価格帯> --note "<おすすめポイント60-120字>" --source-confirm-url <一次情報URL>');
    process.exit(1);
  }
  const noteLen = String(flags.note).length;
  if (noteLen < 40 || noteLen > 160) {
    console.warn(`⚠ おすすめポイントが${noteLen}字です（目安60-120字）。内容を見直すことを推奨します。`);
  }

  const trending = readJson(TRENDING_PATH, { stores: [], candidates: [] });
  const candidates = (trending.candidates || []).filter(c => c && c['店名']);
  const target = candidates.find(c => c['店名'] === name)
    || candidates.find(c => c['店名'].includes(name) || name.includes(c['店名']));
  if (!target) {
    console.error(`candidates[] に見つかりません: ${name}`);
    process.exit(1);
  }
  if (target._promoted_to_pending) {
    console.error(`すでに pending_stores.json へ橋渡し済みです: ${target['店名']}`);
    process.exit(1);
  }
  const pol = loadListingPolicy();
  const days = daysSince(target['検出日']);
  const urlCount = (target['出典URL'] || []).length;
  if ((days < pol.min_days_since_detected || urlCount < pol.min_source_urls) && !flags.force) {
    console.error(`段階ゲート未達（検出${days}日前 / 出典${urlCount}件）。--force で強制実行できますが推奨しません。`);
    process.exit(1);
  }

  const pending = readJson(PENDING_PATH, { pending: [] });
  pending.pending = pending.pending || [];
  if (pending.pending.some(p => p['店名'] === target['店名'])) {
    console.error(`pending_stores.json に同名エントリが既にあります: ${target['店名']}`);
    process.exit(1);
  }

  const entry = {
    '店名': target['店名'],
    'ジャンル': flags.genre,
    'エリア': flags.area,
    'アクセス': flags.access,
    '価格帯': flags.price,
    '情報源': flags['source-confirm-url'],
    'おすすめポイント': flags.note,
    '営業状況': '営業中',
    '追加日': jstToday(),
    'merged': false,
    // 話題店発掘ループ固有の追跡情報（build.js/merge_pending_stores.js は無視する）
    '発掘元_話題出典URL': target['出典URL'] || [],
    '発掘元_コメント': target['コメント'] || '',
    '発掘元': 'trending-scout',
  };
  pending.pending.push(entry);
  writeJson(PENDING_PATH, pending);

  target._promoted_to_pending = true;
  target._promoted_at = jstToday();
  writeJson(TRENDING_PATH, trending);

  console.log(`✅ pending_stores.json へ追加しました: ${entry['店名']}`);
  console.log('\n次に必ず実行してください（実行しないと写真フィールドが空のまま次の build.js で無検証公開されます）:');
  console.log(`  GOOGLE_MAPS_API_KEY=... node scripts/fetch_manual_store_photos.js --only "${entry['店名']}"`);
  console.log(`\nその後: node scripts/promote_trending_candidate.js status "${entry['店名']}"`);
}

function classifyPendingEntry(p) {
  if (p['写真URL']) return { state: 'verified', label: '✅ 検証済み（実写あり）→ 次の build.js で公開されます' };
  const reason = p['写真失敗理由'];
  if (!reason) return { state: 'unchecked', label: '⚠️ 未検証 → fetch_manual_store_photos.js --only を実行してください（未実行のまま build.js が走ると無検証公開されるリスクがあります）' };
  if (reason === 'photo-policy') {
    return { state: 'hidden-photo-policy', label: '🔒 実在は確認済み・採用基準を満たす写真なし → 非公開のまま保留（写真が見つかれば自動公開）' };
  }
  return { state: 'hidden-verification-failed', label: `🚫 実在検証NG（${reason}）→ 非公開のまま保留（架空店ブロック）` };
}

/**
 * 検証済み（pending_stores.json に実写あり）の候補を、trending_stores.json の
 * stores[] へ 話題フラグ=true で追加する。
 *
 * 【なぜ必要か・2026-09-12発覚】
 * add-pending は candidates[] のエントリに _promoted_to_pending を付けるだけで、
 * stores[] には一切触れていなかった。scripts/pick_daily_trending5.js は
 * stores[] の 話題フラグ=true（または manual_stores.json の編集部推薦）しか
 * TOP5候補にしないため、Step 6で実在検証・掲載まで進めた店が「今日の話題店」の
 * 候補プールには一切乗らないという抜け穴があった（このループそのものの存在理由
 * ＝候補プール凍結の再発防止、に反する）。finalize はこの橋渡しの最後の一歩。
 *
 * Google Places三重検証を通った実在確認済みの店であり、既存の auto-promote
 * （3日+出典2件のみで判定）より強い根拠を既に持っているため、_auto は付けず
 * 直接 話題フラグ=true にする。
 */
function cmdFinalize(name) {
  if (!name) { console.error('店名を指定してください'); process.exit(1); }
  const trending = readJson(TRENDING_PATH, { stores: [], candidates: [] });
  const candidates = (trending.candidates || []).filter(c => c && c['店名']);
  const candidate = candidates.find(c => c['店名'] === name) || candidates.find(c => c['店名'].includes(name) || name.includes(c['店名']));
  if (!candidate) {
    console.error(`candidates[] に見つかりません（既にfinalize済みの可能性）: ${name}`);
    process.exit(1);
  }
  if (!candidate._promoted_to_pending) {
    console.error(`まだ add-pending されていません: ${candidate['店名']}`);
    process.exit(1);
  }
  const pending = readJson(PENDING_PATH, { pending: [] });
  const pendingEntry = (pending.pending || []).find(p => p['店名'] === candidate['店名'] && p['発掘元'] === 'trending-scout');
  if (!pendingEntry) {
    console.error(`pending_stores.json にエントリが見つかりません: ${candidate['店名']}`);
    process.exit(1);
  }
  const cls = classifyPendingEntry(pendingEntry);
  if (cls.state !== 'verified') {
    console.error(`まだ検証済みではありません（${cls.state}）。今日の話題店候補には追加しません: ${candidate['店名']}`);
    console.error(cls.label);
    process.exit(1);
  }

  trending.stores = trending.stores || [];
  if (trending.stores.some(s => s['店名'] === candidate['店名'])) {
    console.error(`stores[] に既に同名エントリがあります: ${candidate['店名']}`);
    process.exit(1);
  }
  const expireDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  trending.stores.push({
    '店名': candidate['店名'],
    'エリア': candidate['エリア'] || pendingEntry['エリア'] || '',
    '話題フラグ': true,
    'トレンド情報源': candidate['トレンド情報源'] || ['メディア記事'],
    '出典URL': candidate['出典URL'] || [],
    '話題スコア': candidate['話題スコア'] || 70,
    '検出日': candidate['検出日'] || jstToday(),
    '有効期限': expireDate,
    'コメント': `${candidate['コメント'] || ''}（Step6: 一次情報確認+Google Places三重検証を通過し正式掲載）`.trim(),
  });
  // candidates[] からは削除する（stores[] へ完全移行。二重管理を避ける）
  trending.candidates = candidates.filter(c => c['店名'] !== candidate['店名'])
    .concat((trending.candidates || []).filter(c => !c || !c['店名']));
  writeJson(TRENDING_PATH, trending);
  console.log(`✅ 話題フラグ=true で stores[] へ追加しました: ${candidate['店名']}`);
  console.log('次の node scripts/pick_daily_trending5.js dryrun で明日のTOP5候補への影響を確認できます。');
}

function cmdStatus(name) {
  const pending = readJson(PENDING_PATH, { pending: [] });
  const list = (pending.pending || []).filter(p => p['発掘元'] === 'trending-scout');
  const targets = name ? list.filter(p => p['店名'] === name || (p['店名'] || '').includes(name)) : list;
  if (targets.length === 0) {
    console.log('話題店発掘ループ経由の pending エントリはありません。');
    return;
  }
  let unchecked = 0;
  targets.forEach(p => {
    const c = classifyPendingEntry(p);
    if (c.state === 'unchecked') unchecked++;
    console.log(`${p['店名']}: ${c.label}`);
  });
  console.log(`\n未検証: ${unchecked}件`);
  if (unchecked > 0) {
    console.log('未検証が残っている間は runbook のこのステップを完了とみなさないこと。');
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === '--check' || cmd === 'check') {
  cmdCheck();
} else if (cmd === 'add-pending') {
  const name = rest[0];
  const flags = parseFlags(rest.slice(1));
  cmdAddPending(name, flags);
} else if (cmd === 'status') {
  cmdStatus(rest[0]);
} else if (cmd === 'finalize') {
  cmdFinalize(rest[0]);
} else {
  console.error('Usage:');
  console.error('  node scripts/promote_trending_candidate.js --check');
  console.error('  node scripts/promote_trending_candidate.js add-pending "<店名>" --area <エリア> --genre <ジャンル> --access <アクセス> --price <価格帯> --note "<おすすめポイント>" --source-confirm-url <URL>');
  console.error('  node scripts/promote_trending_candidate.js status ["<店名>"]');
  console.error('  node scripts/promote_trending_candidate.js finalize "<店名>"   # statusが検証済みになったら、話題フラグ=trueでstores[]へ（今日の話題店の候補プールに入る）');
  process.exit(1);
}
