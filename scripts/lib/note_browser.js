'use strict';
/** note のブラウザ操作の共通部分（ログイン用プロファイルと、画面の部品の探し方）。docs/decisions/0054 */
const os = require('os');
const path = require('path');

const PROFILE_DIR = process.env.NOTE_PROFILE_DIR || path.join(os.homedir(), '.config/nagoya-bites/note-profile');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function launch({ headless }) {
  const puppeteer = require('puppeteer');
  return puppeteer.launch({
    executablePath: CHROME, headless, userDataDir: PROFILE_DIR,
    defaultViewport: headless ? { width: 1280, height: 900 } : null,
    ignoreDefaultArgs: headless ? [] : ['--enable-automation'], // 本人がログインする窓では「自動操作中」の表示を出さない（Google ログインが通らないことがある）
    args: ['--no-first-run', '--no-default-browser-check'],
  });
}

/** 画面内のボタン・リンクを文字で探して押す。見つからなければ false。 */
async function clickByText(page, texts, { timeout = 15000 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = await page.evaluate((ts) => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = els.find((e) => !e.disabled && ts.some((t) => (e.innerText || '').replace(/\s+/g, '').includes(t)));
      if (!el) return false;
      el.scrollIntoView({ block: 'center' }); el.click(); return true;
    }, texts);
    if (hit) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function isLoggedIn(page) {
  await page.goto('https://note.com/notes/new', { waitUntil: 'networkidle2', timeout: 45000 });
  return !/\/login/.test(page.url());
}

module.exports = { PROFILE_DIR, launch, clickByText, isLoggedIn };
