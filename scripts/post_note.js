#!/usr/bin/env node
'use strict';
/**
 * 日次ジャーナルの note 版を note に送る（docs/decisions/0054）。動きは data/note_post_policy.json の mode:
 *   off / dry-run … 送らない（dry-run は下書きの生成と検査だけ）
 *   draft         … note に「下書き保存」まで。公開はオーナーが note の画面で押す
 *   live          … 公開まで
 *   node scripts/post_note.js [--date YYYY-MM-DD] [--mode draft|live]   # --mode は policy が dry-run のときの試運転用
 * 二重投稿の防止: 台帳 data/note_post_log.json に同じ slug があれば送らない。検査に落ちた日は送らない。
 * 失敗時は画面の写真を ~/.config/nagoya-bites/note-fail/ に残す。終了コード 1 = 送れなかった。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const N = require('./lib/note_draft');
const B = require('./lib/note_browser');

const ROOT = path.resolve(__dirname, '..');
const LOG = path.join(ROOT, 'data/note_post_log.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readLog = () => { try { return JSON.parse(fs.readFileSync(LOG, 'utf8')); } catch { return { entries: [] }; } };
const writeLog = (l) => fs.writeFileSync(LOG, JSON.stringify(l, null, 2) + '\n');

/** エディタに入れる行へ。リンクと強調は外す（入力ショートカットで崩れないように）。 */
function editorLines(body) {
  return body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
    .split('\n').filter((l) => l.trim() !== '');
}

async function fillEditor(page, draft) {
  await B.restoreCookies(page);
  // editor.note.com/new を直接開くと真っ白のまま止まる（2026-10-22 実測）。note.com/notes/new から入ると下書き ID つきの編集画面へ移る
  await page.goto('https://note.com/notes/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => /\/login/.test(location.href) || /editor\.note\.com\/notes\/n[0-9a-f]+\/edit/.test(location.href), { timeout: 60000 });
  if (/login/.test(page.url())) throw new Error('未ログイン（node scripts/note_login.js --from-chrome が必要）');
  const title = await page.waitForSelector('textarea[placeholder*="タイトル"], [placeholder*="タイトル"]', { timeout: 30000 });
  await title.click(); await page.keyboard.type(draft.title, { delay: 5 });
  const body = await page.waitForSelector('.ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]', { timeout: 15000 });
  await body.click();
  for (const line of editorLines(draft.body)) {
    await page.keyboard.type(line, { delay: 2 });
    await page.keyboard.press('Enter');
  }
  await sleep(1500);
}

async function saveDraft(page) {
  // HTTP は成功（201）でも本文の error / result で失敗を返すので、応答の本文で判定する
  const reply = page.waitForResponse((r) => r.request().method() === 'POST' && /text_notes\/draft_save/.test(r.url()), { timeout: 20000 });
  if (!(await B.clickByText(page, ['下書き保存']))) throw new Error('「下書き保存」ボタンが見つからない');
  const body = await (await reply).text();
  if (!/"result":\s*true/.test(body)) throw new Error('下書き保存が拒否された: ' + body.slice(0, 120));
  const m = /editor\.note\.com\/notes\/(n[0-9a-f]+)/.exec(page.url());
  return { note_key: m ? m[1] : null, url: page.url() };
}

async function publish(page, draft) {
  if (!(await B.clickByText(page, ['公開に進む']))) throw new Error('「公開に進む」ボタンが見つからない');
  await sleep(3000);
  const tagInput = await page.$('input[placeholder*="ハッシュタグ"], input[placeholder*="タグ"]');
  if (tagInput) for (const t of draft.tags) { await tagInput.type(t); await page.keyboard.press('Enter'); await sleep(300); }
  if (!(await B.clickByText(page, ['投稿する']))) throw new Error('「投稿する」ボタンが見つからない');
  await sleep(5000);
  return { url: page.url() };
}

(async () => {
  const a = process.argv.slice(2);
  const arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  const date = arg('--date');
  const policy = N.loadPolicy(ROOT);
  const mode = arg('--mode') || policy.mode;
  if (mode === 'off') return console.log('note: mode=off');
  // 下書きの生成と検査は build_note_draft.js と同じ判定を使う
  const out = JSON.parse(execFileSync('node', [path.join(__dirname, 'build_note_draft.js'), '--json', ...(date ? ['--date', date] : [])], { encoding: 'utf8' }));
  if (!out.ok) { console.error('note: 検査に落ちたので送りません: ' + out.failures.join(' ')); process.exit(1); }
  if (mode === 'dry-run') return console.log(`note[dry-run] ${out.date} 検査通過。送りません (${out.file})`);
  const log = readLog();
  if (log.entries.some((e) => e.slug === out.slug && ['draft', 'live'].includes(e.status))) return console.log('note: 送信済み ' + out.slug);

  const md = fs.readFileSync(path.join(ROOT, out.file), 'utf8');
  const tags = (/^タグ: (.*)$/m.exec(md) || [, ''])[1].split(' / ').filter(Boolean);
  const draft = { title: /^# (.*)$/m.exec(md)[1], tags, body: md.split('\n---\n').slice(1).join('\n---\n').trim() };

  // 画面なし（headless）だと note の下書き作成が 403 で拒否される（2026-10-22 実測）。普通の窓で動かす（30秒ほど窓が出る）
  const browser = await B.launch({ headless: false });
  const page = await browser.newPage();
  try {
    await fillEditor(page, draft);
    const saved = await saveDraft(page);
    let status = 'draft', url = saved.url;
    if (mode === 'live') { url = (await publish(page, draft)).url; status = 'live'; }
    log.entries.push({ slug: out.slug, date: out.date, status, url, at: new Date().toISOString() });
    writeLog(log);
    console.log(`note[${mode}] ${out.slug} → ${status} ${url}`);
  } catch (e) {
    const dir = path.join(os.homedir(), '.config/nagoya-bites/note-fail'); fs.mkdirSync(dir, { recursive: true });
    const shot = path.join(dir, `${out.date}.png`); await page.screenshot({ path: shot }).catch(() => {});
    console.error(`note: 送信失敗 ${e.message}（画面: ${shot}）`); process.exitCode = 1;
  } finally { await browser.close(); }
})();
