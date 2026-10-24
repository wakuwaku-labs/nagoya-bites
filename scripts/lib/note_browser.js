'use strict';
/** note のブラウザ操作の共通部分（ログイン用プロファイルと、画面の部品の探し方）。docs/decisions/0054 */
const os = require('os');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = process.env.NOTE_PROFILE_DIR || path.join(os.homedir(), '.config/nagoya-bites/note-profile-own');
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
    // puppeteer の既定は偽のキーチェーン（--use-mock-keychain）で、複製した Cookie を復号できない。実物のキーチェーンを使う
    ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic', ...(headless ? [] : ['--enable-automation'])], // 本人がログインする窓では「自動操作中」の表示を出さない（Google ログインが通らないことがある）
    args: ['--no-first-run', '--no-default-browser-check'],
  });
}

/** 画面内のボタン・リンクを文字で探し、本物のマウス操作で押す。見つからなければ false。 */
async function clickByText(page, texts, { timeout = 15000 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const box = await page.evaluate((ts) => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = els.find((e) => !e.disabled && ts.some((t) => (e.innerText || '').replace(/\s+/g, '').includes(t)));
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, texts);
    if (box) { await page.mouse.click(box.x, box.y); return true; }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function isLoggedIn(page) {
  await restoreCookies(page);
  await page.goto('https://note.com/notes/new', { waitUntil: 'networkidle2', timeout: 45000 });
  return !/\/login/.test(page.url());
}

const isNote = (u) => { try { return /(^|\.)note\.com$/.test(new URL(u).hostname); } catch { return false; } };

/** いまログインしている note のアカウント（未ログインなら null）。 */
async function currentUser(page) {
  // editor.note.com など別の画面からだと note.com の API を呼べない（別のオリジン）ので、note.com を開いてから聞く
  if ((() => { try { return new URL(page.url()).hostname !== 'note.com'; } catch { return true; } })()) await page.goto('https://note.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  return page.evaluate(async () => { const r = await fetch('https://note.com/api/v2/current_user', { credentials: 'include' }); return r.ok ? (await r.json()).data : null; }).catch(() => null);
}

/**
 * 専用プロファイルの中だけで note に入り直す。プロファイルに残っている Google のログインで「Google」を押すと、
 * 自動で NAGOYA BITES に入れる（2026-10-24 実測）。普段の Chrome から複製したログインは本人の Chrome と同じもので、
 * 本人が普段の Chrome で別アカウントに切り替えると一緒に切れていた。こちらで入り直したログインは専用プロファイルだけの
 * ものになる。note の Cookie は手元で消すだけ（note のログアウトは押さない）なので、本人の Chrome のログインはそのまま。
 * 返り値: { ok, at }（at は最後に見ていた画面。失敗の理由を書くため）
 */
async function loginWithGoogle(page) {
  fs.rmSync(COOKIES, { force: true }); // 古い書き出しを戻して、入り直したログインを上書きしないように
  const cdp = await page.createCDPSession();
  const { cookies } = await cdp.send('Network.getAllCookies');
  for (const c of cookies.filter((c) => /(^|\.)note\.com$/.test(c.domain.replace(/^\./, '')))) {
    await cdp.send('Network.deleteCookies', { name: c.name, domain: c.domain, path: c.path });
  }
  await page.goto('https://note.com/login', { waitUntil: 'networkidle2', timeout: 45000 });
  // Google のボタンは絵だけで、ボタン自身の文字に「Google」が無い（下の文字は別の要素）。aria-label・href まで見て探す
  const box = await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a, [role="button"]')].find((e) => /google/i.test((e.getAttribute('aria-label') || '') + (e.innerText || '') + (e.getAttribute('href') || '')));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!box) return { ok: false, at: 'note のログイン画面に Google のボタンが見つかりません' };
  await page.mouse.click(box.x, box.y);
  const where = (p) => { try { const u = new URL(p.url()); return u.hostname + u.pathname; } catch { return p.url(); } };
  const end = Date.now() + 60000;
  let pages = [page];
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, 2000));
    pages = await page.browser().pages();
    if (pages.some((p) => isNote(p.url()) && !/\/login|\/oauth|\/auth/.test(new URL(p.url()).pathname))) return { ok: true, at: pages.map(where).join(' | ') };
  }
  return { ok: false, at: pages.map(where).join(' | ') };
}

/**
 * 投稿する前に、note のアカウントが want（policy の account.nickname）か確かめる。未ログイン・別アカウントなら
 * loginWithGoogle で入り直してもう一度確かめる。だめなら投稿せずに止める（2026-10-22 に vide太郎 で公開した）。
 */
async function ensureAccount(page, want) {
  const before = await currentUser(page);
  if (before && before.nickname === want) return before;
  console.log(`note: いまのログインは ${before ? before.nickname : '未ログイン'} です。専用の窓の Google ログインで ${want} に入り直します`);
  const r = await loginWithGoogle(page).catch((e) => ({ ok: false, at: e.message }));
  const who = await currentUser(page).catch(() => null);
  if (who && who.nickname === want) { console.log(`note: ${want} に入り直しました`); return who; }
  throw new Error(`投稿先のアカウントが違います（今: ${who ? who.nickname : '未ログイン'} / 必要: ${want}）。Google での入り直しも通りませんでした（${r.ok ? '別のアカウントに入った' : r.at}）。node scripts/note_login.js --google を試し、だめなら node scripts/note_login.js --own で本人が ${want} にログイン`);
}

module.exports = { saveCookies, restoreCookies, PROFILE_DIR, COOKIES, launch, clickByText, isLoggedIn, currentUser, loginWithGoogle, ensureAccount };
