// 本番（https://nagoya-bites.com/）の確認。分析（GA4 など）への通信は止め、入力は自分のブラウザの中だけで完結する（サーバーに何も書かない）。
// 確かめること: P-225（記号の入力が要素にならない）・I-13（スプラッシュが無い）・I-07（英語が無い）・I-23（保存した店が見える）・I-21（共有リンクで店が開く・戻るで閉じる）・ページのエラー
const puppeteer = require('puppeteer');
const BASE = 'https://nagoya-bites.com/';
const BLOCK = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|formspree\.io/;
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail)); }

async function newPage(browser, mobile) {
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', (r) => (BLOCK.test(r.url()) ? r.abort() : r.continue()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page._nbErrors = errors;
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'shell' });
  try {
    // ── P-225: 記号を含む検索語 ──
    {
      const page = await newPage(browser, false);
      await page.goto(BASE + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#si', { timeout: 30000 });
      const payload = '<b id="nb-test">x</b>';
      await page.type('#si', payload);
      // 検索語のチップは入力から 0.7〜3 秒ほどで出る（固定の 1.5 秒だと端で外れる）。出るまで最大 8 秒待つ
      await page.waitForFunction(() => { const c = document.getElementById('active-chips'); return !!c && c.textContent.indexOf('nb-test') >= 0; }, { timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
      const res = await page.evaluate((p) => {
        const injected = !!document.getElementById('nb-test');
        const chips = document.getElementById('active-chips');
        const cond = document.getElementById('results-summary-cond');
        return {
          injected,
          chipsText: chips ? chips.textContent : null,
          chipsHasB: chips ? !!chips.querySelector('b') : null,
          condHasB: cond ? !!cond.querySelector('b') : null,
          condText: cond ? cond.textContent : null,
        };
      }, payload);
      check('P-225 本番: 検索語の <b id="nb-test"> が要素にならない', !res.injected && !res.chipsHasB && !res.condHasB, JSON.stringify({ injected: res.injected, chipsHasB: res.chipsHasB, condHasB: res.condHasB }));
      check('P-225 本番: 検索語が文字としてチップに出る', res.chipsText && res.chipsText.indexOf('<b id="nb-test">x</b>') >= 0, (res.chipsText || '').slice(0, 60));
      check('P-225 本番: ページのエラーが出ていない', page._nbErrors.length === 0, page._nbErrors.slice(0, 2).join(' | '));
      await page.close();
    }
    // ── I-13・I-07: スプラッシュと英語（スマホ幅） ──
    {
      const page = await newPage(browser, true);
      await page.goto(BASE + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#si', { timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));
      const res = await page.evaluate(() => {
        const splash = document.getElementById('nb-splash');
        const vis = (el) => { if (!el) return false; const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().height > 0; };
        const body = document.body.innerText;
        return {
          splashVisible: vis(splash),
          hasGenreLabel: /\bGenre\b/.test(body),
          hasAllLabel: /(^|\n)All(\n|$)/.test(body),
          hasCapacity: /\bCapacity\b/.test(body),
          pwaBannerVisible: vis(document.getElementById('pwa-banner')) || vis(document.getElementById('pwa-banner-ios')),
        };
      });
      check('I-13 本番: スプラッシュが出ていない', !res.splashVisible, JSON.stringify(res));
      check('I-13 本番: 1回目の訪問でアプリ追加の帯が出ていない', !res.pwaBannerVisible);
      check('I-07 本番: 画面に Genre / Capacity の英語ラベルが無い', !res.hasGenreLabel && !res.hasCapacity, JSON.stringify({ g: res.hasGenreLabel, c: res.hasCapacity }));
      check('ページのエラーが出ていない（スマホ幅）', page._nbErrors.length === 0, page._nbErrors.slice(0, 2).join(' | '));
      await page.close();
    }
    // ── I-23: 保存した店が見える ──
    {
      const page = await newPage(browser, true);
      await page.goto(BASE + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#si', { timeout: 30000 });
      await page.waitForFunction(() => typeof window.ALL_STORES !== 'undefined' && window.ALL_STORES.length > 100, { timeout: 60000 }).catch(() => {});
      const name = await page.evaluate(() => { try { return ALL_STORES[3]['店名']; } catch (e) { return null; } });
      check('I-23 本番: 店のデータが読み込まれている', !!name, name);
      if (name) {
        await page.evaluate((n) => { localStorage.setItem('nb_favs', JSON.stringify([n])); }, name);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#si', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));
        const clicked = await page.evaluate(() => { const a = document.getElementById('nav-fav'); if (!a) return 0; a.click(); return 1; });
        await new Promise(r => setTimeout(r, 2000));
        const res = await page.evaluate(() => {
          const g = document.getElementById('grid');
          const cs = g ? getComputedStyle(g) : null;
          return { gridDisplay: cs ? cs.display : null, cards: g ? g.querySelectorAll('.card').length : 0, gridText: g ? g.innerText.slice(0, 80) : '' };
        });
        check('I-23 本番: 「保存済み」を押すと保存した店が一覧に見える', clicked > 0 && res.gridDisplay !== 'none' && res.cards >= 1, JSON.stringify({ clicked, ...res }));
        await page.evaluate(() => { localStorage.removeItem('nb_favs'); });
      }
      await page.close();
    }
    // ── I-21: 共有リンクで店が開く・戻るで閉じる ──
    {
      const page = await newPage(browser, true);
      await page.goto(BASE + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#si', { timeout: 30000 });
      await page.waitForFunction(() => typeof window.ALL_STORES !== 'undefined' && window.ALL_STORES.length > 100, { timeout: 60000 }).catch(() => {});
      const id = await page.evaluate(() => { try { return ALL_STORES[3]['ホットペッパーID']; } catch (e) { return null; } });
      check('I-21 本番: 店の ID が取れる', !!id, id);
      if (id) {
        const hist0 = await page.evaluate(() => history.length);
        await page.goto(BASE + '?cb=' + Date.now() + '#store=' + id, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => { const o = document.getElementById('ov'); return !!o && o.classList.contains('open'); }, { timeout: 30000 }).catch(() => {});
        const opened = await page.evaluate(() => { const o = document.getElementById('ov'); return { open: !!o && o.classList.contains('open'), hash: location.hash, title: (document.querySelector('#ov .modal h2, #ov h2, #ov .modal-title') || {}).textContent || '' }; });
        check('I-21 本番: 共有リンク（#store=ID）で店のモーダルが開く', opened.open, JSON.stringify(opened));
        check('I-21 本番: ページのエラーが出ていない', page._nbErrors.length === 0, page._nbErrors.slice(0, 2).join(' | '));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const fails = results.filter(r => !r.ok);
  console.log('\n合計 ' + results.length + ' 件中 ' + (results.length - fails.length) + ' 件通過・' + fails.length + ' 件失敗');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('実行できなかった: ' + e); process.exit(2); });
