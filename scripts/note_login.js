#!/usr/bin/env node
'use strict';
/**
 * 初回だけ: note に本人がログインするための窓を開く。ログイン状態は専用プロファイル
 * （~/.config/nagoya-bites/note-profile）に保存され、以後の自動投稿が使う。
 * 認証情報はこのスクリプトも Claude も受け取らない（本人が窓の中で入力する）。
 *   node scripts/note_login.js          # 窓を開く。ログインできたら自動で閉じる（最大10分待つ）
 *   node scripts/note_login.js --check  # ログイン済みか確かめるだけ（窓は出さない）
 */
const N = require('./lib/note_browser');

/**
 * --from-chrome: 本人が普段の Chrome で note にログイン済みなら、その note.com の Cookie だけを専用プロファイルへ複製する
 * （Google ログインは自動操作の窓では拒否されるため・2026-10-22 本人の了承: 方式A）。他のサイトの Cookie は複製しない。
 * 複製した Cookie は暗号化されたまま（Chrome 自身が実物のキーチェーンで復号する）。値は読まない・表示しない。
 */
function copyFromChrome() {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const src = path.join(os.homedir(), 'Library/Application Support/Google/Chrome', process.env.NOTE_CHROME_PROFILE || (() => { try { return require('./lib/note_draft').loadPolicy(path.join(__dirname, '..')).account.chromeProfile; } catch { return null; } })() || 'Default', 'Cookies');
  const dstDir = path.join(N.PROFILE_DIR, 'Default');
  fs.mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, 'Cookies');
  for (const f of [dst, dst + '-wal', dst + '-shm', dst + '-journal']) fs.rmSync(f, { force: true });
  execFileSync('sqlite3', [src, `.backup '${dst}'`]); // 使用中でも整合したコピーが取れる
  execFileSync('sqlite3', [dst, "delete from cookies where host_key not like '%note.com'; vacuum;"]);
  const n = execFileSync('sqlite3', [dst, "select count(*) from cookies where name='_note_session_v5'"], { encoding: 'utf8' }).trim();
  return n === '1' ? 'ok' : 'note のログイン Cookie が普段の Chrome に見つかりません（先に Chrome で note にログインしてください）';
}

(async () => {
  // --own: 自動操作でない普通の Chrome 窓を専用プロファイルで開く。本人が NAGOYA BITES でログインすると、その状態が
  //        普段の Chrome のアカウント切替・ログアウトから独立して残る（2026-10-22: 普段の Chrome の Cookie 複製は、本人が別アカウントに
  //        切り替えるたびに無効になり、3回止まった）。ログイン後は --own-close で窓を閉じて確かめる
  if (process.argv.includes('--own')) {
    require('child_process').spawn('open', ['-na', 'Google Chrome', '--args', `--user-data-dir=${N.PROFILE_DIR}`, '--no-first-run', '--no-default-browser-check', 'https://note.com/login'], { stdio: 'ignore', detached: true }).unref();
    console.log('note: 専用の Chrome 窓を開きました。NAGOYA BITES でログインしてください');
    return;
  }
  if (process.argv.includes('--own-close')) {
    try { require('child_process').execFileSync('pkill', ['-f', `user-data-dir=${N.PROFILE_DIR}`]); } catch {}
    await new Promise((r) => setTimeout(r, 2500));
    process.argv.push('--check');
  }
  if (process.argv.includes('--from-chrome')) {
    // Chrome は Cookie をディスクへ少し遅れて書く（ログイン直後は未ログインに見える）。最大4回、20秒おきに複製し直す
    let ok = false;
    for (let i = 0; i < 4 && !ok; i++) {
      if (i) await new Promise((r) => setTimeout(r, 20000));
      const r = copyFromChrome();
      if (r !== 'ok') { if (i === 3) { console.error('note: ' + r); process.exit(1); } continue; }
      const b = await N.launch({ headless: true });
      try { ok = await N.isLoggedIn(await b.newPage()); } finally { await b.close(); }
    }
    console.log('note: 普段の Chrome から note の Cookie を複製しました。確認します…');
    process.argv.push('--check');
  }
  const check = process.argv.includes('--check');
  const browser = await N.launch({ headless: check });
  const page = await browser.newPage();
  try {
    if (await N.isLoggedIn(page)) { console.log('note: ログイン済みです'); return; }
    if (check) { console.log('note: 未ログインです。node scripts/note_login.js を実行してください'); process.exitCode = 1; return; }
    console.log('開いた窓で note にログインしてください（最大10分待ちます）');
    await page.goto('https://note.com/login', { waitUntil: 'domcontentloaded' });
    // 裏で起動した窓は他のアプリの後ろに隠れるので、前面に出し、通知も出す
    for (const p of await browser.pages()) if (p !== page) await p.close().catch(() => {});
    await page.bringToFront();
    try {
      const { execFileSync } = require('child_process');
      execFileSync('osascript', ['-e', 'tell application "Google Chrome" to activate', '-e', 'display notification "note にログインしてください（この窓です）" with title "NAGOYA BITES"'], { timeout: 10000 });
    } catch { /* 通知に失敗しても続ける */ }
    // Google・X・Apple の画面に移っている間は待ち続け、note に戻って /login を離れたら成功とみなす。
    // 画面遷移で waitForFunction が壊れることがあるので、自分で一定間隔に見に行く
    const end = Date.now() + 600000;
    let ok = false, tick = 0;
    while (Date.now() < end && !ok) {
      await new Promise((r) => setTimeout(r, 2000));
      if (!browser.connected) throw new Error('ログイン窓が閉じられました。ログインが終わる前に閉じないでください');
      const pages = await browser.pages();
      if (++tick % 15 === 0) console.log('待機中の画面: ' + pages.map((p) => { try { const u = new URL(p.url()); return u.hostname + u.pathname; } catch { return p.url(); } }).join(' | '));
      ok = pages.some((p) => { try { const u = new URL(p.url()); return /(^|\.)note\.com$/.test(u.hostname) && !/\/login|\/oauth/.test(u.pathname); } catch { return false; } });
    }
    if (!ok) throw new Error('10分以内にログインが終わりませんでした');
    await new Promise((r) => setTimeout(r, 3000));
    const n = await N.saveCookies(page); // 古い Cookie で上書きされる前に、いまの状態を先に保存する
    if (!(await N.isLoggedIn(page))) throw new Error('ログイン状態が保存されませんでした');
    console.log(`note: Cookie ${n}件を保存しました`);
    console.log('note: ログインを確認しました。保存先: ' + N.PROFILE_DIR);
  } finally { await browser.close(); }
})().catch((e) => { console.error('note_login 失敗:', e.message); process.exit(1); });
