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

(async () => {
  const check = process.argv.includes('--check');
  const browser = await N.launch({ headless: check });
  const page = await browser.newPage();
  try {
    if (await N.isLoggedIn(page)) { console.log('note: ログイン済みです'); return; }
    if (check) { console.log('note: 未ログインです。node scripts/note_login.js を実行してください'); process.exitCode = 1; return; }
    console.log('開いた窓で note にログインしてください（最大10分待ちます）');
    await page.goto('https://note.com/login', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !/\/login/.test(location.pathname), { timeout: 600000, polling: 1000 });
    await new Promise((r) => setTimeout(r, 3000));
    console.log('note: ログインを確認しました。保存先: ' + N.PROFILE_DIR);
  } finally { await browser.close(); }
})().catch((e) => { console.error('note_login 失敗:', e.message); process.exit(1); });
