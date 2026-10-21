'use strict';
/** note のブラウザ操作の共通部分（ログイン用プロファイルと、画面の部品の探し方）。docs/decisions/0054 */
const os = require('os');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = process.env.NOTE_PROFILE_DIR || path.join(os.homedir(), '.config/nagoya-bites/note-profile');
const COOKIES = process.env.NOTE_COOKIES || path.join(os.homedir(), '.config/nagoya-bites/note-cookies.json');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/**
 * note のログイン Cookie は「ブラウザを閉じると消える種類」のものがあり、プロファイルだけでは次回に残らなかった
 * （2026-10-21 実測: ログイン直後は通るのに、閉じて開き直すと未ログイン）。そのため、ログイン後に Cookie を
 * 本人の Mac の中のファイル（権限 600・git の外）へ書き出し、開くたびに期限を30日に延ばして戻す。
 */
async function saveCookies(page) {
  const cdp = await page.createCDPSession();
  const { cookies } = await cdp.send('Network.getAllCookies');
  const mine = cookies.filter((c) => /(^|\.)note\.com$/.test(c.domain.replace(/^\./, '')));
  fs.mkdirSync(path.dirname(COOKIES), { recursive: true });
  fs.writeFileSync(COOKIES, JSON.stringify(mine), { mode: 0o600 });
  return mine.length;
}

async function restoreCookies(page) {
  let list;
  try { list = JSON.parse(fs.readFileSync(COOKIES, 'utf8')); } catch { return 0; }
  const exp = Math.floor(Date.now() / 1000) + 30 * 86400;
  const cdp = await page.createCDPSession();
  await cdp.send('Network.setCookies', { cookies: list.map((c) => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly,
    sameSite: c.sameSite, expires: c.session || !c.expires || c.expires < 0 ? exp : c.expires })) });
  return list.length;
}

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
  await restoreCookies(page);
  await page.goto('https://note.com/notes/new', { waitUntil: 'networkidle2', timeout: 45000 });
  return !/\/login/.test(page.url());
}

module.exports = { saveCookies, restoreCookies, PROFILE_DIR, launch, clickByText, isLoggedIn };
