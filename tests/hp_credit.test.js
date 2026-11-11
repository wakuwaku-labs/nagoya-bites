'use strict';

/**
 * tests/hp_credit.test.js — ホットペッパーグルメ Webサービスのクレジット・画像提供の表示
 *
 * 規約（https://webservice.recruit.co.jp/doc/hotpepper/guideline.html）:
 *   クレジット「Powered by ホットペッパーグルメ Webサービス」（リンク先 https://webservice.recruit.co.jp/）と、
 *   画像を使うときは「【画像提供：ホットペッパー グルメ】」。
 * 出す・出さないの決まりは scripts/lib/site_chrome.js の creditModeFor。ここでは
 *   - 決まり（出る・出ない・二重に入らない）
 *   - 書き出された生成物（stores・stores/area・features・journal・トップ）が、決まりどおりであること
 * を見る。生成物は、フッターのブロックを持つページだけが対象（移転の転送ページ・旧形式の残置ページは対象外）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const chrome = require(path.join(ROOT, 'scripts', 'lib', 'site_chrome.js'));

const CREDIT_RE = /<p class="nb-footer-credit">/g;
const FOOTER_MARK = chrome.MARK('FOOTER', 'START');
const IMAGE_NOTICE = '【画像提供：ホットペッパー グルメ】';

function walk(dir) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  let out = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(path.relative(ROOT, p)));
    else if (f.endsWith('.html') && !f.startsWith('_')) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}

const bare = (h) => h.replace(/<!-- NB-CHROME:FOOTER:START -->[\s\S]*?<!-- NB-CHROME:FOOTER:END -->/, '');

test('renderFooter: credit の指定どおりに出る（none は出ない・api はクレジットだけ・api+image は両方）', () => {
  const none = chrome.renderFooter({ depth: 1 });
  const api = chrome.renderFooter({ depth: 1, credit: 'api' });
  const img = chrome.renderFooter({ depth: 1, credit: 'api+image' });
  assert.ok(!none.includes('nb-footer-credit') && !none.includes('webservice.recruit.co.jp'));
  assert.equal((api.match(CREDIT_RE) || []).length, 1);
  assert.ok(api.includes('Powered by <a href="https://webservice.recruit.co.jp/"'));
  assert.ok(api.includes('>ホットペッパーグルメ Webサービス</a>'));
  assert.ok(!api.includes(IMAGE_NOTICE));
  assert.equal((img.match(CREDIT_RE) || []).length, 1);
  assert.ok(img.includes(IMAGE_NOTICE));
});

test('creditModeFor: 店舗系は常にクレジット・HP の画像があるときだけ画像提供', () => {
  const photo = '<img src="https://imgfp.hotp.jp/IMGH/00/00/P000.jpg">';
  assert.equal(chrome.creditModeFor('stores/J1.html', '<body></body>'), 'api');
  assert.equal(chrome.creditModeFor('stores/area/a/b.html', '<body></body>'), 'api');
  assert.equal(chrome.creditModeFor('stores/J1.html', '<body>' + photo + '</body>'), 'api+image');
});

test('creditModeFor: 特集・日次・トップは HP のリンクか画像があるときだけ。運営系は出ない', () => {
  const link = '<a href="https://www.hotpepper.jp/strJ1/">予約</a>';
  const photo = '<img src="https://imgfp.hotp.jp/IMGH/00/00/P000.jpg">';
  for (const rel of ['features/x.html', 'journal/2026-01-01-x.html', 'index.html']) {
    assert.equal(chrome.creditModeFor(rel, '<body>HP を使わない</body>'), 'none', rel);
    assert.equal(chrome.creditModeFor(rel, '<body>' + link + '</body>'), 'api', rel);
    assert.equal(chrome.creditModeFor(rel, '<body>' + photo + '</body>'), 'api+image', rel);
  }
  for (const rel of ['about.html', 'faq.html', 'contact.html', 'privacy-policy.html', '404.html']) {
    assert.equal(chrome.creditModeFor(rel, '<body>' + link + photo + '</body>'), 'none', rel);
  }
});

test('applyCredit: べき等・二重に入らない・HP が無くなれば外れる', () => {
  const base = (credit, body) => `<body>${body}${chrome.renderFooter({ depth: 1, credit })}</body>`;
  const photo = '<img src="https://imgfp.hotp.jp/IMGH/00/00/P000.jpg">';
  const once = chrome.applyCredit(base('none', photo), 'features/x.html');
  assert.equal((once.match(CREDIT_RE) || []).length, 1);
  assert.ok(once.includes(IMAGE_NOTICE));
  assert.equal(chrome.applyCredit(once, 'features/x.html'), once);
  assert.equal(chrome.applyCredit(chrome.applyCredit(once, 'features/x.html'), 'features/x.html'), once);
  // フッターにだけ画像提供があり、本文に HP の画像が無い（画像を外した）ページでは画像提供だけ外れる
  const noPhoto = chrome.applyCredit(base('api+image', '<a href="https://www.hotpepper.jp/strJ1/">x</a>'), 'features/x.html');
  assert.ok(noPhoto.includes('Powered by') && !noPhoto.includes(IMAGE_NOTICE));
  // 運営系は外れる
  const about = chrome.applyCredit(base('api', ''), 'about.html');
  assert.ok(!about.includes('nb-footer-credit'));
  // フッターのブロックが無いページは触らない
  assert.equal(chrome.applyCredit('<body>x</body>', 'stores/J1.html'), '<body>x</body>');
});

test('生成器: 店舗ページ・エリア×ジャンルのテンプレートがクレジットを出す（ソース）', () => {
  const store = fs.readFileSync(path.join(ROOT, 'gen-store-pages.js'), 'utf8');
  assert.ok(store.includes('siteChrome.applyCredit(html'), 'gen-store-pages.js はフッターへクレジットを足す');
  const area = fs.readFileSync(path.join(ROOT, 'scripts', 'gen_area_genre_pages.js'), 'utf8');
  assert.ok(/renderFooter\(\{ depth, credit: 'api' \}\)/.test(area), 'gen_area_genre_pages.js はクレジットを出す');
});

test('書き出された HTML: 種別ごとに、出るべきページに出て・出ないページに出ず・1 回だけ', () => {
  const groups = {
    stores: walk('stores').filter(r => !r.startsWith('stores/area/')),
    area: walk('stores/area'),
    features: walk('features'),
    journal: walk('journal'),
    root: ['index.html', 'about.html', 'faq.html', 'contact.html', 'privacy-policy.html'],
  };
  const tally = {};
  const bad = [];
  for (const [g, files] of Object.entries(groups)) {
    const t = (tally[g] = { pages: 0, expected: 0, withCredit: 0 });
    for (const rel of files) {
      if (!fs.existsSync(path.join(ROOT, rel))) continue;
      const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (!html.includes(FOOTER_MARK)) continue;
      t.pages++;
      const mode = chrome.creditModeFor(rel, html);
      const n = (html.match(CREDIT_RE) || []).length;
      if (mode !== 'none') t.expected++;
      if (n) t.withCredit++;
      const hasNotice = html.includes(IMAGE_NOTICE);
      if (mode === 'none' && n !== 0) bad.push(`${rel}: 出ないはずのページに出ている`);
      if (mode !== 'none' && n !== 1) bad.push(`${rel}: クレジットが ${n} 件（1 件のはず）`);
      if (mode === 'api+image' && !hasNotice) bad.push(`${rel}: 画像提供が無い`);
      if (mode !== 'api+image' && hasNotice) bad.push(`${rel}: 画像が無いのに画像提供がある`);
      if (/<a[^>]*>ホットペッパーグルメ Webサービス<\/a>/.test(bare(html)) && g !== 'root') bad.push(`${rel}: フッター以外にクレジットがある`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), [], `不一致 ${bad.length} 件`);
  for (const g of Object.keys(tally)) assert.equal(tally[g].withCredit, tally[g].expected, `${g}: 出るべき件数と一致する`);
  // 診断で確かめた数字の取りこぼしが無いこと（店舗・エリア・日次・特集で HP を使うページが 0 でない）
  assert.ok(tally.stores.pages > 1000 && tally.stores.withCredit === tally.stores.pages);
  assert.ok(tally.area.pages > 100 && tally.area.withCredit === tally.area.pages);
  assert.ok(tally.features.withCredit > 0 && tally.journal.withCredit > 0);
  // トップは旧位置（検索中だけ見える #hpc-foot）に残さず、フッターの 1 件だけ
  const top = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(!top.includes('id="hpc-foot"'));
  assert.equal((top.match(/Powered by/g) || []).length >= 1, true);
});

test('scripts/add_hp_credit.js --check: 反映済みなら要変更 0 件で終わる', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'add_hp_credit.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
