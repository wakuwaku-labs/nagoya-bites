'use strict';
/**
 * 予約申告プロンプト（ISSUE-149）の唯一の実装。
 *
 * 予約導線（HotPepper・食べログの店舗ページ・電話）を押して戻ってきた人にだけ、
 * 画面下に「〈店名〉の予約はできましたか？」を1度だけ出し、答えを GA4 に
 * reserve_report_yes / reserve_report_no として送る。答えなくても何も起きない。
 * 名古屋バイツが自分たち側だけで持てる「予約の出口」で、店側の作業は要らない。
 * 数え方の定義は scripts/lib/reservation_exits.js、判断の経緯は docs/decisions/0009。
 *
 * ページ側の使い方: 予約導線の onclick で nbReserveExit('cta_click', {store_name, store_id, link_domain, location}) を呼ぶ。
 * trackEvent（GA）への送信もこの関数が行う。
 *
 * 埋め込み先: index.html（`node scripts/lib/reservation_ask_snippet.js --apply index.html`）、
 * gen-store-pages.js（店舗ページ）、scripts/add_feature_tracking.js（特集）。
 * ブラウザの関数をそのまま文字列化するので、テンプレートリテラルのエスケープ事故（SEO-115）が起きない。
 * ES5 で書く（古いブラウザでも構文エラーで他のスクリプトを巻き込まない）。
 */

/* eslint-disable no-var */
function nbReserveAskMain() {
  var KEY = 'nb_reserve_pending';
  var MIN_AWAY = 20 * 1000;        // これより早く戻った人にはまだ聞かない
  var MAX_AWAY = 30 * 60 * 1000;   // これより後は予約導線との対応が薄いので聞かない
  var SHOW_MS = 20 * 1000;
  function internal() { try { return localStorage.getItem('nb_internal') === '1'; } catch (e) { return false; } }
  function send(name, p) { try { if (typeof trackEvent === 'function') trackEvent(name, p); } catch (e) {} }
  window.nbReserveExit = function (name, p) {
    p = p || {};
    send(name, p);
    if (internal()) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        n: String(p.store_name || ''), i: String(p.store_id || ''),
        d: String(p.link_domain || ''), l: String(p.location || ''), t: Date.now()
      }));
    } catch (e) {}
  };
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hide(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  function show(p) {
    var el = document.createElement('div');
    el.className = 'nb-reserve-ask';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', '予約できたかの確認');
    var q = document.createElement('p');
    q.className = 'nb-reserve-ask-q';
    q.textContent = (p.n ? '「' + p.n + '」の' : '') + '予約はできましたか？';
    var note = document.createElement('p');
    note.className = 'nb-reserve-ask-note';
    note.textContent = '匿名で数えるだけです。掲載順位には使いません';
    var row = document.createElement('div');
    row.className = 'nb-reserve-ask-actions';
    var params = { store_name: p.n, store_id: p.i, link_domain: p.d, location: p.l };
    function btn(label, cls, ev) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'nb-reserve-ask-btn ' + cls;
      b.textContent = label;
      b.onclick = function () {
        send(ev, params);
        row.parentNode.removeChild(row);
        note.parentNode.removeChild(note);
        q.textContent = 'ありがとうございます';
        setTimeout(function () { hide(el); }, 1800);
      };
      return b;
    }
    row.appendChild(btn('予約した', 'is-yes', 'reserve_report_yes'));
    row.appendChild(btn('していない', 'is-no', 'reserve_report_no'));
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'nb-reserve-ask-close';
    close.setAttribute('aria-label', '閉じる');
    close.textContent = '×';
    close.onclick = function () { hide(el); };
    el.appendChild(close); el.appendChild(q); el.appendChild(note); el.appendChild(row);
    document.body.appendChild(el);
    setTimeout(function () { hide(el); }, SHOW_MS);
  }
  function check() {
    if (document.visibilityState === 'hidden' || internal()) return;
    var raw, p;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    try { p = JSON.parse(raw); } catch (e) { p = null; }
    var away = p ? Date.now() - (p.t || 0) : -1;
    if (!p || away > MAX_AWAY || away < 0) { try { sessionStorage.removeItem(KEY); } catch (e) {} return; }
    if (away < MIN_AWAY) return;
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    var asked = 'nb_reserve_asked_' + (p.i || p.n) + '_' + today();
    try { if (localStorage.getItem(asked)) return; localStorage.setItem(asked, '1'); } catch (e) {}
    show(p);
  }
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
}

const MARK_START = '<script class="nb-reserve-ask-js">';
const MARK_END = '</script>';
const RESERVE_ASK_SCRIPT = `${MARK_START}(${nbReserveAskMain.toString()})();${MARK_END}`;
const BLOCK_RE = /<script class="nb-reserve-ask-js">[\s\S]*?<\/script>/;

// 既にあれば差し替え、無ければ </body> の直前に入れる（冪等）
function applyToHtml(html) {
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, () => RESERVE_ASK_SCRIPT);
  const i = html.lastIndexOf('</body>');
  if (i < 0) throw new Error('</body> がありません');
  return html.slice(0, i) + RESERVE_ASK_SCRIPT + '\n' + html.slice(i);
}

module.exports = { RESERVE_ASK_SCRIPT, applyToHtml, BLOCK_RE };

if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter(a => !a.startsWith('--'));
  if (!args.includes('--apply') && !check || !files.length) {
    console.error('使い方: node scripts/lib/reservation_ask_snippet.js --apply|--check <html...>');
    process.exit(2);
  }
  let bad = 0;
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    const next = applyToHtml(html);
    if (next === html) continue;
    if (check) { console.error(`未反映: ${f}`); bad++; } else { fs.writeFileSync(f, next); console.log(`反映: ${f}`); }
  }
  process.exit(bad ? 1 : 0);
}
