'use strict';
/**
 * tests/index_install_prompt.test.js — I-13（UI・UX改修 段階1a）
 *
 * トップ（index.html）の「初めての人を止めるもの」をやめた決まりを確かめる。
 *   1. スプラッシュ（全画面のロゴ）と、ホーム画面への追加の案内の暗幕（#pwa-install-backdrop）が無い
 *   2. ホーム画面への追加の案内は、「2回目以降の訪問で、保存した店が1件以上あり、まだ案内を出していないとき」だけ、1回出す。
 *      Android（beforeinstallprompt）と iOS（3秒後）の両方の経路が、同じ判定（pwaInstallPromptAllowed）を通る
 *   3. 「後で」の記録（pwa-banner-dismissed）は、Android の経路でも見る。出した時点でも記録を残す（閉じずに離れても2回目は出さない）
 *   4. サイトデータを拒否した端末（localStorage・sessionStorage が例外を投げる）では、案内を出さず、ページの初期化を止めない（SEO-144）
 *   5. 案内は、固定検索バー（190）より上・ナビの暗幕（199）・ご意見（290〜295）・モーダル（500）より下の層に置く（操作をふさがない）
 *   6. 文言（ホーム画面に追加して…・追加する・後で・iOS の手順）は変えていない
 *
 * index.html から案内の部分（var deferredPrompt の行から、キーボードの項目の見出しの手前まで）と実物の getFavs を取り出し、
 * 偽の DOM・偽の保存領域の上で動かす。実ブラウザでの確認は docs/qa/uiux-2026-10/e2e_install.js。
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const NB_CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'nb.css'), 'utf8');

// ── index.html から取り出す ─────────────────────────────────────────────
function fnSource(name) {
  const head = '\nfunction ' + name + '(';
  assert.strictEqual(INDEX.split(head).length - 1, 1, `function ${name} は1つだけ定義されている`);
  const a = INDEX.indexOf(head) + 1;
  const b = INDEX.indexOf('\n}\n', a);
  assert.ok(b > a, `function ${name} の終わりが見つからない`);
  return INDEX.slice(a, b + 2);
}

const PWA_START = 'var deferredPrompt = null;';
const PWA_END = '// ================================================================\n// Keyboard support for cards (Enter key)';
assert.strictEqual(INDEX.split(PWA_START).length - 1, 1, 'var deferredPrompt の行は1つだけ');
assert.strictEqual(INDEX.split(PWA_END).length - 1, 1, 'キーボードの項目の見出しは1つだけ');
const PWA_BLOCK = INDEX.slice(INDEX.indexOf(PWA_START), INDEX.indexOf(PWA_END));
const CODE = fnSource('getFavs') + '\n' + PWA_BLOCK;

// ── 偽の環境 ──────────────────────────────────────────────────────────
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DAY = 24 * 3600 * 1000;

// opts.local / opts.session: 保存領域の初期値／denyLocal・denySession: 読み書きが例外を投げる／ua・platform・touch・standalone・displayStandalone
function makeEnv(opts) {
  opts = opts || {};
  const local = new Map(Object.entries(opts.local || {}));
  const session = new Map(Object.entries(opts.session || {}));
  const storage = (m, deny) => ({
    getItem: (k) => { if (deny) throw new Error('Access is denied'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (deny) throw new Error('Access is denied'); m.set(k, String(v)); },
    removeItem: (k) => { if (deny) throw new Error('Access is denied'); m.delete(k); },
  });
  const listeners = {};
  const els = {};
  const getEl = (id) => els[id] || (els[id] = {
    id, style: { display: 'none' }, handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; },
  });
  const timers = [];
  const navigator = { userAgent: opts.ua || ANDROID_UA, platform: opts.platform || 'Linux armv8l', maxTouchPoints: opts.touch || 0, standalone: !!opts.standalone };
  const sandbox = {
    localStorage: storage(local, opts.denyLocal),
    sessionStorage: storage(session, opts.denySession),
    document: { getElementById: getEl },
    navigator,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    console: { log() {} },
  };
  sandbox.window = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    navigator,
    matchMedia: () => ({ matches: !!opts.displayStandalone }),
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(CODE, ctx);
  const env = { ctx, local, session, listeners, getEl, timers, promptCalls: 0 };
  env.fire = () => {
    const ev = {
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      prompt() { env.promptCalls++; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };
    (listeners.beforeinstallprompt || []).forEach((fn) => fn(ev));
    return ev;
  };
  env.shown = (id) => getEl(id).style.display === 'flex';
  env.runTimers = () => timers.splice(0).forEach((t) => t.fn());
  return env;
}
const favs = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => '店' + (i + 1)));
// 「2回目の訪問」: 前回までに nb_visits=1 が残っていて、このタブは新しい（sessionStorage が空）
const second = (extra) => Object.assign({ nb_visits: '1', nb_favs: favs(1) }, extra || {});

// ── 1. スプラッシュ・暗幕が無い ─────────────────────────────────────────
test('スプラッシュ（全画面のロゴ）が index.html に残っていない', () => {
  for (const s of ['nb-splash', 'nb_splash', 'nbs-mark', 'nbs-rule', 'nb-splash-on', 'オープニング・スプラッシュ']) {
    assert.ok(!INDEX.includes(s), `「${s}」が残っている`);
  }
});

test('ホーム画面への追加の案内の暗幕が index.html に残っていない', () => {
  for (const s of ['pwa-install-backdrop', 'showPwaInstallBackdrop', 'hidePwaInstallBackdrop', 'pwaIosBackdropEl']) {
    assert.ok(!INDEX.includes(s), `「${s}」が残っている`);
  }
});

// ── 2. 出す条件 ─────────────────────────────────────────────────────────
test('初回の訪問: Android の合図が来ても案内を出さない（標準の案内は今までどおり止める）', () => {
  const env = makeEnv({ local: { nb_favs: favs(1) } });
  assert.strictEqual(env.ctx.pwaVisitCount, 1);
  assert.strictEqual(env.local.get('nb_visits'), '1');
  const ev = env.fire();
  assert.strictEqual(ev.defaultPrevented, true, '標準の案内は止める（今までと同じ）');
  assert.ok(env.ctx.deferredPrompt, '「追加する」で使うので合図は取っておく');
  assert.strictEqual(env.shown('pwa-banner'), false);
  assert.strictEqual(env.local.has('pwa-banner-dismissed'), false, '出していないので記録も残さない');
});

test('2回目の訪問でも、保存が0件なら出さない', () => {
  const env = makeEnv({ local: { nb_visits: '1' } });
  assert.strictEqual(env.ctx.pwaVisitCount, 2);
  env.fire();
  assert.strictEqual(env.shown('pwa-banner'), false);
});

test('2回目の訪問でも、保存の中身が壊れている・空なら出さない（例外も出さない）', () => {
  // null・オブジェクト・数字は JSON としては正しいが、配列ではない（length が無い・null）
  for (const bad of ['[]', '{', 'null', '""', 'abc', '{"a":1}', '5', 'true']) {
    const env = makeEnv({ local: { nb_visits: '1', nb_favs: bad } });
    env.fire();
    assert.strictEqual(env.shown('pwa-banner'), false, `nb_favs=${bad}`);
  }
});

test('2回目の訪問・保存1件: 案内（Android）を出し、出した時点で記録を残す', () => {
  const env = makeEnv({ local: second() });
  assert.strictEqual(env.ctx.pwaVisitCount, 2);
  env.fire();
  assert.strictEqual(env.shown('pwa-banner'), true);
  assert.match(env.local.get('pwa-banner-dismissed') || '', /^\d+$/, '閉じずに離れても2回目は出さないよう、出した時点で残す');
});

test('3回目の訪問: 出した記録があれば、Android の合図が来ても出さない（出すのは1回）', () => {
  const first = makeEnv({ local: second() });
  first.fire();
  assert.strictEqual(first.shown('pwa-banner'), true);
  // 2回目に出して閉じずに離れた人の、3回目（記録は残る・セッションは新しい）
  const third = makeEnv({ local: Object.fromEntries(first.local) });
  assert.strictEqual(third.ctx.pwaVisitCount, 3);
  third.fire();
  assert.strictEqual(third.shown('pwa-banner'), false);
});

test('昔に「後で」を押した記録がある人には、訪問が増えても出さない（Android）', () => {
  const env = makeEnv({ local: { nb_visits: '8', nb_favs: favs(3), 'pwa-banner-dismissed': String(Date.now() - 30 * DAY) } });
  env.fire();
  assert.strictEqual(env.shown('pwa-banner'), false, '以前は iOS だけが記録を見て、Android は毎回出していた');
});

test('再読み込み（同じタブのセッション）では訪問回数が増えない', () => {
  const env = makeEnv({ local: { nb_visits: '1' }, session: { nb_visit_counted: '1' } });
  assert.strictEqual(env.ctx.pwaVisitCount, 1);
  assert.strictEqual(env.local.get('nb_visits'), '1');
});

test('訪問回数: 新しいセッションごとに1回数える（1→2→3）', () => {
  let local = {};
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const env = makeEnv({ local });
    seen.push(env.ctx.pwaVisitCount);
    local = Object.fromEntries(env.local);
  }
  assert.deepStrictEqual(seen, [1, 2, 3]);
});

test('訪問回数が壊れた値でも例外を出さず、1回目として数える', () => {
  for (const bad of ['abc', '', '-3', 'NaN']) {
    const env = makeEnv({ local: { nb_visits: bad, nb_favs: favs(1) } });
    assert.ok(Number.isFinite(env.ctx.pwaVisitCount), `nb_visits=${bad}`);
    env.fire();
    if (env.ctx.pwaVisitCount < 2) assert.strictEqual(env.shown('pwa-banner'), false, `nb_visits=${bad}`);
  }
});

// ── 3. iOS ──────────────────────────────────────────────────────────────
test('iOS: 3秒後に判定し、条件を満たすときだけ出す（2回目・保存1件）', () => {
  const env = makeEnv({ ua: IOS_UA, local: second() });
  assert.strictEqual(env.timers.length, 1);
  assert.strictEqual(env.timers[0].ms, 3000);
  assert.strictEqual(env.shown('pwa-banner-ios'), false, '開いた直後は出さない');
  env.runTimers();
  assert.strictEqual(env.shown('pwa-banner-ios'), true);
  assert.match(env.local.get('pwa-banner-dismissed') || '', /^\d+$/);
});

test('iOS: 初回・保存0件・記録ありは、3秒たっても出さない', () => {
  const cases = {
    '初回': { local: { nb_favs: favs(1) } },
    '2回目・保存0件': { local: { nb_visits: '1' } },
    '2回目・保存1件・「後で」の記録あり': { local: second({ 'pwa-banner-dismissed': String(Date.now() - 30 * DAY) }) },
  };
  for (const [name, o] of Object.entries(cases)) {
    const env = makeEnv(Object.assign({ ua: IOS_UA }, o));
    env.runTimers();
    assert.strictEqual(env.shown('pwa-banner-ios'), false, name);
  }
});

test('iOS: 7日たっても再表示しない（記録があれば出さない）', () => {
  for (const days of [1, 7, 8, 365]) {
    const env = makeEnv({ ua: IOS_UA, local: second({ 'pwa-banner-dismissed': String(Date.now() - days * DAY) }) });
    env.runTimers();
    assert.strictEqual(env.shown('pwa-banner-ios'), false, `${days}日前の記録`);
  }
});

test('iOS: ホーム画面から開いたとき（standalone）は、条件を満たしても出さない（タイマーも作らない）', () => {
  for (const o of [{ standalone: true }, { displayStandalone: true }]) {
    const env = makeEnv(Object.assign({ ua: IOS_UA, local: second() }, o));
    assert.strictEqual(env.timers.length, 0);
    assert.strictEqual(env.shown('pwa-banner-ios'), false);
  }
});

test('iPadOS（Mac を名乗る・タッチあり）も iOS の経路を通る／Android・PC は iOS の案内を作らない', () => {
  const ipad = makeEnv({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', touch: 5, local: second() });
  assert.strictEqual(ipad.timers.length, 1);
  ipad.runTimers();
  assert.strictEqual(ipad.shown('pwa-banner-ios'), true);
  for (const ua of [ANDROID_UA, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)']) {
    const env = makeEnv({ ua, platform: 'Win32', local: second() });
    assert.strictEqual(env.timers.length, 0, ua);
  }
});

test('iOS の案内と Android の案内は、同じ記録を共有する（片方で出したらもう片方も出さない）', () => {
  const a = makeEnv({ local: second() });
  a.fire();
  assert.strictEqual(a.shown('pwa-banner'), true);
  const b = makeEnv({ ua: IOS_UA, local: Object.fromEntries(a.local) });
  b.runTimers();
  assert.strictEqual(b.shown('pwa-banner-ios'), false);
});

// ── 4. ボタン ───────────────────────────────────────────────────────────
test('「後で」（Android）: 帯を閉じて、記録を残す', () => {
  const env = makeEnv({ local: second() });
  env.fire();
  env.local.delete('pwa-banner-dismissed');
  env.getEl('pwa-dismiss').handlers.click();
  assert.strictEqual(env.shown('pwa-banner'), false);
  assert.strictEqual(env.getEl('pwa-banner').style.display, 'none');
  assert.match(env.local.get('pwa-banner-dismissed') || '', /^\d+$/);
});

test('「後で」（iOS）: 案内を閉じて、記録を残す', () => {
  const env = makeEnv({ ua: IOS_UA, local: second() });
  env.runTimers();
  env.local.delete('pwa-banner-dismissed');
  env.getEl('pwa-dismiss-ios').handlers.click();
  assert.strictEqual(env.shown('pwa-banner-ios'), false);
  assert.match(env.local.get('pwa-banner-dismissed') || '', /^\d+$/);
});

test('「追加する」: 標準の案内（prompt）を呼び、選んだあとに帯を閉じる', async () => {
  const env = makeEnv({ local: second() });
  env.fire();
  env.getEl('pwa-install-btn').handlers.click();
  assert.strictEqual(env.promptCalls, 1);
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(env.shown('pwa-banner'), false);
  assert.strictEqual(env.ctx.deferredPrompt, null);
});

test('インストールが終わったら（appinstalled）、帯を閉じる', () => {
  const env = makeEnv({ local: second() });
  env.fire();
  assert.strictEqual(env.shown('pwa-banner'), true);
  (env.listeners.appinstalled || []).forEach((fn) => fn({}));
  assert.strictEqual(env.shown('pwa-banner'), false);
  assert.strictEqual(env.ctx.deferredPrompt, null);
});

// ── 5. サイトデータを拒否した端末 ───────────────────────────────────────
test('サイトデータを拒否した端末: 読み込みで例外を出さず、案内を出さない（Android・iOS）', () => {
  for (const o of [{ denyLocal: true }, { denySession: true }, { denyLocal: true, denySession: true }]) {
    let env;
    assert.doesNotThrow(() => { env = makeEnv(o); }, JSON.stringify(o));
    assert.strictEqual(env.ctx.pwaVisitCount, 0, '数えられない');
    env.fire();
    assert.strictEqual(env.shown('pwa-banner'), false, JSON.stringify(o));
    let ios;
    assert.doesNotThrow(() => { ios = makeEnv(Object.assign({ ua: IOS_UA }, o)); ios.runTimers(); }, JSON.stringify(o));
    assert.strictEqual(ios.shown('pwa-banner-ios'), false, JSON.stringify(o));
  }
});

test('保存領域が書き込みだけ拒否する端末（読めるが書けない）でも、例外を出さない', () => {
  const env = makeEnv({ local: second() });
  env.ctx.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.doesNotThrow(() => env.fire());
  assert.doesNotThrow(() => env.getEl('pwa-dismiss').handlers.click());
});

// ── 6. 層（操作をふさがない）・大きさ・文言 ─────────────────────────────
function zOf(css, selector) {
  // 同じセレクタの規則が複数ある（表示を消す規則・スマホ用の規則など）ので、z-index を持つ最初のものを使う
  const re = new RegExp('(?:^|\\n)\\s*' + selector.replace(/[.#]/g, '\\$&') + '\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(css))) {
    const z = /z-index:(\d+)/.exec(m[1]);
    if (z) return Number(z[1]);
  }
  assert.fail(`${selector} に z-index を持つ規則が見つからない`);
}

test('案内の層: 固定検索バーより上、ナビの暗幕・ご意見・トップへ戻る・モーダルより下', () => {
  const bar = zOf(INDEX, '#pwa-banner');
  const ios = zOf(INDEX, '#pwa-banner-ios');
  assert.strictEqual(bar, ios, '2つの案内は同じ層');
  const cta = zOf(INDEX, '.mobile-cta-bar');
  const fab = zOf(INDEX, '#fb-fab');
  const top = zOf(INDEX, '#scroll-top');
  const modal = zOf(INDEX, '.ov');
  const nav = Number(/\.nav-overlay\{[^}]*z-index:(\d+)/.exec(NB_CSS.replace(/\n\s*/g, '\n'))[1]);
  assert.ok(bar > cta, `案内(${bar}) は固定検索バー(${cta}) より上`);
  for (const [name, z] of [['ナビの暗幕', nav], ['ご意見ボタン', fab], ['トップへ戻る', top], ['モーダル', modal]]) {
    assert.ok(bar < z, `案内(${bar}) は ${name}(${z}) より下`);
  }
});

test('案内は、全面をおおう作りではない（inset:0 や width:100vw を使わない）', () => {
  for (const sel of ['#pwa-banner', '#pwa-banner-ios']) {
    const m = new RegExp('(?:^|\\n)' + sel.replace('#', '\\#') + '\\{([^}]*)\\}').exec(INDEX);
    assert.ok(m, sel);
    assert.ok(!/inset:\s*0/.test(m[1]) && !/height:\s*100(vh|%)/.test(m[1]) && !/width:\s*100vw/.test(m[1]), `${sel} が全面をおおう指定になっている`);
    assert.ok(/position:fixed/.test(m[1]));
    assert.ok(/max-height:calc\(100vh/.test(m[1]) || sel === '#pwa-banner', `${sel}: 背の低い画面で画面の外に出ない指定（iOS）`);
  }
});

test('スマホでは、案内を固定検索バー（.mobile-cta-bar）とご意見ボタンの上に出す', () => {
  const m = /@media\(max-width:768px\)\{#pwa-banner,#pwa-banner-ios\{bottom:calc\(([^}]*)\);\}\}/.exec(INDEX);
  assert.ok(m, 'スマホ用の bottom の指定が見つからない');
  assert.match(m[1], /4\.5rem/, 'ご意見ボタンの bottom（4.5rem）の上');
  assert.match(m[1], /var\(--tap-min\)/, 'ご意見ボタンの高さ（--tap-min）の上');
  assert.match(m[1], /env\(safe-area-inset-bottom/, '切り欠き・ホームバーの領域を避ける');
});

test('ボタンは押しやすい大きさ（高さ --tap-min）で、「後で」は読みやすい色', () => {
  assert.match(INDEX, /#pwa-banner button\{[^}]*min-height:var\(--tap-min\)/);
  const ios = /#pwa-banner-ios \.dismiss\{([^}]*)\}/.exec(INDEX);
  assert.ok(ios);
  assert.match(ios[1], /min-height:var\(--tap-min\)/);
  assert.match(ios[1], /color:rgba\(247,245,241,\.(7|8|9)/, '暗幕をやめて閉じる手段がこれだけになるので、薄くしすぎない');
});

test('案内の文言は変えていない（Android の帯・iOS の手順）', () => {
  const android = /<div id="pwa-banner"[\s\S]*?<\/div>/.exec(INDEX)[0];
  for (const s of ['ホーム画面に追加して', 'アプリとして使えます', '追加する', '後で', 'NAGOYA BITES をホーム画面に追加する', 'ホーム画面追加の案内を閉じる']) {
    assert.ok(android.includes(s), `Android の帯に「${s}」`);
  }
  const ios = /<div id="pwa-banner-ios"[\s\S]*?<button class="dismiss" id="pwa-dismiss-ios"[\s\S]*?<\/div>/.exec(INDEX)[0];
  for (const s of ['アプリとしてホーム画面に追加', 'オフラインでも使える・すぐアクセスできる', '画面下の', 'をタップ', '「ホーム画面に追加', '」を選択', '後で', 'iOS でのホーム画面追加の案内を閉じる']) {
    assert.ok(ios.includes(s), `iOS の案内に「${s}」`);
  }
});

test('Android の帯の文は、文節ごとに折り返す（文の途中で割れない）', () => {
  assert.match(INDEX, /<span class="pwa-banner-text"><span>ホーム画面に追加して<\/span><span>アプリとして使えます<\/span><\/span>/);
  assert.match(INDEX, /#pwa-banner \.pwa-banner-text span\{display:inline-block;\}/);
  assert.match(INDEX, /#pwa-banner\{[^}]*flex-wrap:wrap/, '収まらない幅では、ボタンが次の行に回る');
});

test('Service Worker の登録とマニフェストの参照は変えていない', () => {
  assert.ok(INDEX.includes("navigator.serviceWorker.register('./sw.js')"));
  assert.ok(/<link rel="manifest" href="manifest\.json"/.test(INDEX));
});
