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
const E = require('./lib/note_eyecatch');

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

/** 見出し画像（題・日付・ブランド名だけの自前の図）を入れる。他者の写真は使わない。失敗しても投稿は止めない（画像なしで続ける）。 */
async function removeEyecatch(page) {
  // 既に付いている見出し画像を外す（画像の右上の×）
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(590, 220); await sleep(600);
  await page.mouse.click(866, 133); await sleep(1500);
  const left = await page.evaluate(() => !!document.querySelector('img[src*="rectangle_large_type"]'));
  console.log('note: 見出し画像 ' + (left ? 'を外せませんでした' : 'を外しました'));
}

async function setEyecatch(page, draft, date, enabled = true) {
  if (!enabled) return removeEyecatch(page);
  try {
    const png = await E.makeEyecatch(draft.title, date, null, page.browser());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.click(298, 120); // タイトル上の丸い画像アイコン（画面幅1200・高さ900で固定している）
    await sleep(800);
    const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }), B.clickByText(page, ['画像をアップロード'], { timeout: 5000 })]);
    await chooser.accept([png]);
    await sleep(2500);
    await sleep(1500);
    // 切り抜きの確認（キャンセル／保存）。「下書き保存」を押さないよう、文字が「保存」だけのボタンを探す
    const box = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '保存');
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (box) await page.mouse.click(box.x, box.y);
    await sleep(3500);
    const has = await page.evaluate(() => !!document.querySelector('img[src*="assets.st-note.com"], img[src*="note-eyecatch"]'));
    console.log('note: 見出し画像 ' + (has ? 'を入れました' : 'は入ったか確認できません'));
  } catch (e) { console.error('note: 見出し画像は入れられませんでした（本文だけで続けます）: ' + e.message); }
}

async function fillEditor(page, draft, date) {
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
  if (N.loadPolicy(ROOT).eyecatch !== false) await setEyecatch(page, draft, date);
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

/**
 * 保存した下書きを開き直し、題・本文が入っていることを確かめる（公開の前に必ず通す）。
 * 見出し画像を入れた直後の画面は、題も本文も見えているのに note 側では空のままで、「公開に進む」で
 * 「タイトル、本文を入力してください」と出て止まる（2026-10-24 朝に公開できず下書きのまま残った）。
 * 開き直すと保存した中身から始まるので公開できる。中身が無ければ空の記事を出さないよう止める。
 */
async function openDraft(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('textarea', { timeout: 30000 });
  await page.waitForSelector('.ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]', { timeout: 15000 });
  await sleep(2000);
  const got = await page.evaluate(() => {
    const t = document.querySelector('textarea'); const b = document.querySelector('.ProseMirror');
    return { title: t ? t.value.trim() : '', body: b ? b.innerText.trim().length : 0, eyecatch: !!document.querySelector('img[src*="rectangle_large_type"]') };
  });
  if (!got.title || got.body < 100) throw new Error(`保存した下書きの中身が足りないので公開しません（題 ${got.title ? 'あり' : 'なし'}・本文 ${got.body} 字）`);
  console.log(`note: 保存した下書きを確認（本文 ${got.body} 字・見出し画像 ${got.eyecatch ? 'あり' : 'なし'}）`);
}

async function publish(page, draft) {
  if (!(await B.clickByText(page, ['公開に進む']))) throw new Error('「公開に進む」ボタンが見つからない');
  // 進めないときは note が出した文言を理由に載せる（ログを開かなくても原因が分かるように）
  await page.waitForFunction(() => /\/publish\//.test(location.href), { timeout: 20000 }).catch(async (e) => {
    const shown = await page.evaluate(() => (document.body.innerText.match(/タイトル、本文を入力してください|[^\n]*(失敗|エラー)[^\n]*/) || [''])[0]).catch(() => '');
    throw new Error(shown ? `公開画面に進めません（note の表示: ${shown.trim()}）` : e.message);
  });
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
async function updatePublished(page, key, draft, date) {
  await page.goto(`https://editor.note.com/notes/${key}/edit/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const body = await page.waitForSelector('.ProseMirror[contenteditable="true"], [role="textbox"][contenteditable="true"]', { timeout: 30000 });
  await body.click(); await page.keyboard.down('Meta'); await page.keyboard.press('KeyA'); await page.keyboard.up('Meta'); await page.keyboard.press('Backspace');
  await writeBody(page, draft);
  await setEyecatch(page, draft, date, N.loadPolicy(ROOT).eyecatch !== false);
  await sleep(3000); // 画像の反映・自動保存が終わる前に進むと「タイトル、本文を入力してください」と出る
  if (!(await B.clickByText(page, ['公開に進む']))) throw new Error('「公開に進む」ボタンが見つからない');
  await page.waitForFunction(() => /\/publish\//.test(location.href), { timeout: 20000 });
  await sleep(2000);
  if (!(await B.clickByText(page, ['更新する']))) throw new Error('「更新する」ボタンが見つからない');
  // 更新後は /publish/ のまま「記事をシェアしてみましょう」が出る
  await page.waitForFunction(() => !/\/publish\//.test(location.href) || /シェアしてみましょう|記事が公開されました/.test(document.body.innerText), { timeout: 30000 });
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
  await page.setViewport({ width: 1200, height: 900 });
  // 保存後に編集画面から開き直すとき「このページを離れますか」が出ても止まらないようにする（保存は済んでいる）
  page.on('dialog', (d) => { if (d.type() === 'beforeunload') d.accept().catch(() => {}); });
  try {
    // 別のアカウントで投稿しない（2026-10-22 に vide太郎で公開してしまった）。名前が違えば何も書かずに止める
    await page.goto('https://note.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const who = await page.evaluate(async () => { const r = await fetch('/api/v2/current_user', { credentials: 'include' }); return r.ok ? (await r.json()).data : null; });
    const want = (policy.account && policy.account.nickname) || 'NAGOYA BITES';
    if (!who || who.nickname !== want) throw new Error(`投稿先のアカウントが違います（今: ${who ? who.nickname : '未ログイン'} / 必要: ${want}）。普段の Chrome で ${want} にログインし直して node scripts/note_login.js --from-chrome`);
    // 台帳は作業場所ごとに別なので、note 側の公開済みの題とも照らして二重投稿を防ぐ（2026-10-23 朝の自動投稿と手動が重なった）
    if (!upd && !prev) {
      const dup = await page.evaluate(async (u, t) => { try { const j = await (await fetch(`/api/v2/creators/${u}/contents?kind=note&page=1`, { credentials: 'include' })).json(); const c = (j.data && j.data.contents) || []; const hit = c.find((x) => (x.name || '').trim() === t.trim() && x.status === 'published'); return hit ? hit.noteUrl || hit.key : null; } catch { return null; } }, who.urlname, draft.title);
      if (dup) return console.log(`note: 同じ題の公開済みの記事があるため送りません（${dup}）`);
    }
    if (upd) { await updatePublished(page, upd, draft, out.date); return console.log(`note[update] ${out.slug} を ${upd} に反映しました`); }
    let url;
    if (prev) { // 下書きは保存済み（前回、公開で失敗した）。下書きを増やさず、同じ下書きの公開だけやり直す
      url = prev.url;
      // 前回、公開までは済んだのに台帳を書く前に落ちていた場合は、公開し直さず台帳だけ直す（二重に出さない）
      const key = (/notes\/(n[0-9a-f]+)/.exec(prev.url) || [])[1];
      const done = key && await page.evaluate(async (k) => { try { const r = await fetch(`/api/v3/notes/${k}`, { credentials: 'include' }); const j = r.ok ? await r.json() : null; return !!(j && j.data && j.data.status === 'published'); } catch { return false; } }, key);
      if (done) {
        Object.assign(prev, { status: 'live', url: `https://note.com/${who.urlname}/n/${key}`, at: new Date().toISOString() });
        writeLog(log);
        return console.log(`note: ${out.slug} は公開済みでした。台帳だけ直しました ${prev.url}`);
      }
    } else {
      await fillEditor(page, draft, out.date);
      url = (await saveDraft(page)).url;
      log.entries.push({ slug: out.slug, date: out.date, status: 'draft', url, at: new Date().toISOString() });
      writeLog(log); // 公開で失敗しても、保存済みの下書きを台帳に残す
    }
    let status = 'draft';
    if (mode === 'live') { await openDraft(page, url); url = (await publish(page, draft)).url; status = 'live'; }
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
