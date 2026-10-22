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

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/** 本文（Markdown 風）を、note のエディタが見出し・箇条書きとして受け取れる HTML へ。「元記事: URL」の URL は別に返す（カードにするため）。 */
function bodyToHtml(body) {
  const html = []; let list = false, cardUrl = null;
  const close = () => { if (list) { html.push('</ul>'); list = false; } };
  for (const raw of body.split('\n')) {
    const l = raw.trim(); if (!l) continue;
    let m;
    if ((m = /^(.*?):\s*(https?:\/\/\S+)$/.exec(l))) { close(); html.push(`<p>${inline(m[1])}</p>`); cardUrl = m[2]; continue; }
    if ((m = /^##\s+(.*)$/.exec(l))) { close(); html.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = /^[-・]\s+(.*)$/.exec(l))) { if (!list) { html.push('<ul>'); list = true; } html.push(`<li>${inline(m[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))}</li>`); continue; }
    close(); html.push(`<p>${inline(l.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'))}</p>`);
  }
  close();
  return { html: html.join(''), cardUrl };
}

async function writeBody(page, draft) {
  const { html, cardUrl } = bodyToHtml(draft.body);
  // 見出し・箇条書きは、HTML を貼り付ける形でエディタに渡すと正しく変換される（キー入力だと「##」が記号のまま残る）
  await page.evaluate((h) => {
    const el = document.querySelector('.ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]');
    el.focus();
    const dt = new DataTransfer(); dt.setData('text/html', h); dt.setData('text/plain', el.innerText);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, html);
  await sleep(1500);
  // 元記事の URL は URL だけの行で Enter すると、写真つきのリンクカードになる
  // 貼り付けの直後は、カーソルが貼った内容の最後にある（クリックし直すと途中に戻るので、しない）
  await page.keyboard.press('Enter');
  if (cardUrl) { await page.keyboard.type(cardUrl, { delay: 2 }); await page.keyboard.press('Enter'); await sleep(3000); }
  await sleep(1500);
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
  await writeBody(page, draft);
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
  await page.waitForFunction(() => /\/publish\//.test(location.href), { timeout: 20000 });
  await sleep(2000);
  // タグは本人が選んだ基本タグ＋地名だけを入れる（note の候補タグ「#00」などは選ばない）
  const tagInput = await page.waitForSelector('input[placeholder*="ハッシュタグ"]', { timeout: 15000 });
  for (const t of draft.tags) { await tagInput.type(t, { delay: 30 }); await page.keyboard.press('Enter'); await sleep(400); }
  const added = await page.evaluate((tags) => tags.filter((t) => document.body.innerText.includes('#' + t)).length, draft.tags);
  if (added < Math.min(1, draft.tags.length)) throw new Error('タグが入りませんでした');
  // 公開は取り消しにくいので、押す直前にもう一度だけ確認する（投稿ボタンが無ければここで止まる）
  if (!(await B.clickByText(page, ['投稿する']))) throw new Error('「投稿する」ボタンが見つからない');
  // 投稿後は /publish/ を離れる。離れなければ失敗（確認の画面が出た場合も含む）
  await page.waitForFunction(() => !/\/publish\//.test(location.href), { timeout: 30000 })
    .catch(async () => { if (!(await B.clickByText(page, ['投稿する', 'OK'], { timeout: 3000 }))) throw new Error('投稿が完了しませんでした'); await page.waitForFunction(() => !/\/publish\//.test(location.href), { timeout: 30000 }); });
  await sleep(2000);
  return { url: page.url() };
}

/** 公開済みの記事を、同じ URL のまま今の形（見出し・箇条書き・カード）に直す: node scripts/post_note.js --date D --update nXXXX */
async function updatePublished(page, key, draft) {
  await page.goto(`https://editor.note.com/notes/${key}/edit/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const body = await page.waitForSelector('.ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]', { timeout: 30000 });
  await body.click(); await page.keyboard.down('Meta'); await page.keyboard.press('KeyA'); await page.keyboard.up('Meta'); await page.keyboard.press('Backspace');
  await writeBody(page, draft);
  if (!(await B.clickByText(page, ['公開に進む']))) throw new Error('「公開に進む」ボタンが見つからない');
  await page.waitForFunction(() => /\/publish\//.test(location.href), { timeout: 20000 });
  await sleep(2000);
  if (!(await B.clickByText(page, ['更新する']))) throw new Error('「更新する」ボタンが見つからない');
  // 更新後は /publish/ のまま「記事をシェアしてみましょう」が出る
  await page.waitForFunction(() => !/\/publish\//.test(location.href) || document.body.innerText.includes('シェアしてみましょう'), { timeout: 30000 });
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
  const prev = log.entries.find((e) => e.slug === out.slug && ['draft', 'live'].includes(e.status));
  const upd = arg('--update');
  if (!upd && prev && (prev.status === 'live' || mode !== 'live')) return console.log('note: 送信済み ' + out.slug + '（' + prev.status + '）');

  const md = fs.readFileSync(path.join(ROOT, out.file), 'utf8');
  const tags = (/^タグ: (.*)$/m.exec(md) || [, ''])[1].split(' / ').filter(Boolean);
  const draft = { title: /^# (.*)$/m.exec(md)[1], tags, body: md.split('\n---\n').slice(1).join('\n---\n').trim() };

  // 画面なし（headless）だと note の下書き作成が 403 で拒否される（2026-10-22 実測）。普通の窓で動かす（30秒ほど窓が出る）
  const browser = await B.launch({ headless: false });
  const page = await browser.newPage();
  try {
    // 別のアカウントで投稿しない（2026-10-22 に vide太郎で公開してしまった）。名前が違えば何も書かずに止める
    await page.goto('https://note.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const who = await page.evaluate(async () => { const r = await fetch('/api/v2/current_user', { credentials: 'include' }); return r.ok ? (await r.json()).data : null; });
    const want = (policy.account && policy.account.nickname) || 'NAGOYA BITES';
    if (!who || who.nickname !== want) throw new Error(`投稿先のアカウントが違います（今: ${who ? who.nickname : '未ログイン'} / 必要: ${want}）。普段の Chrome で ${want} にログインし直して node scripts/note_login.js --from-chrome`);
    if (upd) { await updatePublished(page, upd, draft); return console.log(`note[update] ${out.slug} を ${upd} に反映しました`); }
    let url;
    if (prev) { // 下書きは保存済み（前回、公開で失敗した）。同じ下書きを開き直して公開だけやり直す（下書きを増やさない）
      await page.goto(prev.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('textarea', { timeout: 30000 });
      url = prev.url;
    } else {
      await fillEditor(page, draft);
      url = (await saveDraft(page)).url;
      log.entries.push({ slug: out.slug, date: out.date, status: 'draft', url, at: new Date().toISOString() });
      writeLog(log); // 公開で失敗しても、保存済みの下書きを台帳に残す
    }
    let status = 'draft';
    if (mode === 'live') { url = (await publish(page, draft)).url; status = 'live'; }
    const rec = log.entries.find((e) => e.slug === out.slug);
    Object.assign(rec, { status, url, at: new Date().toISOString() });
    writeLog(log);
    console.log(`note[${mode}] ${out.slug} → ${status} ${url}`);
  } catch (e) {
    const dir = path.join(os.homedir(), '.config/nagoya-bites/note-fail'); fs.mkdirSync(dir, { recursive: true });
    const shot = path.join(dir, `${out.date}.png`); await page.screenshot({ path: shot }).catch(() => {});
    console.error(`note: 送信失敗 ${e.message}（画面: ${shot}）`); process.exitCode = 1;
  } finally { await browser.close(); }
})();
