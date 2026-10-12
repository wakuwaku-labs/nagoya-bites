'use strict';
/**
 * 電話するボタンの動き（押したときに Google から番号を取って発信する）の唯一の実装（I-36 / P-273）。
 *
 * 背景: 電話番号はデータに持たない（Google Maps Platform の規約で保存できない）。ボタンを押した瞬間にだけ、
 * 店に紐付いた Google の店舗情報（placeId）から番号を取る。ページを開いたときに先に取ることはしない。
 * 以前は、番号を取れなかった理由（その端末の上限・サイト全体の上限・Google が断った・店の情報が無い・通信の失敗・
 * 閉業）がすべて「電話番号なし」の一言で、アイコンだけのボタンでは目で見える反応も無かった。ここで理由ごとに分け、
 * ボタンの近くの role="status" の行に文を出し、次の手（Googleマップで確かめる）を添える。
 *
 * ボタンを出すかどうか（紐付けが掲載の店と合うか）は別の判定: scripts/lib/phone_link.js（各店の欄「電話確認」）。
 * ここは「押された後」だけを受け持つ。
 *
 * ページ側の約束:
 *   - ボタン: onclick="nbCallStore(event,'<placeId>','<店名>',this)" と data-call-loc="modal|store_page"。
 *     文字つきのボタンは <span>電話する</span> を持つ（確認中は「確認中…」に変わる）。アイコンだけのボタンは span なし
 *   - 結果の行: ボタンと同じ親の中の <p class="nb-call-status" role="status"></p>（無ければここで作る。
 *     読み上げのため、先に空の行を置いておくほうがよい）
 *   - Google Maps の鍵: グローバルの NB_CALL_MAPS_KEY（ページ側が定義する。このファイルには書かない）
 *
 * 計測: 押した回数は今までどおり cta_call_click（予約送客。nbReserveExit 経由）。番号を取った結果は
 * call_lookup { store_name, store_id（placeId）, location, result } で別に数える。予約送客には数えない
 * （scripts/lib/reservation_exits.js の EXIT_EVENTS に入れない）。
 *   result: ok / no_number / closed / device_limit / quota / denied / not_found / error
 *
 * 閉業は、押した時点の Google の店舗情報（business_status が CLOSED_PERMANENTLY）で、発信を止めるだけに使う。
 * 掲載を外す判断には使わない（営業の確認は data/store_liveness_reviews.json の手順で一次情報を2つ確かめる）。
 *
 * 埋め込み先: index.html（`node scripts/lib/call_button_snippet.js --apply index.html`）と、gen-store-pages.js
 * （電話のボタンを出す店舗ページ）。ブラウザの関数をそのまま文字列化するので、テンプレートリテラルの
 * エスケープ事故（SEO-115）が起きない。ES5 で書く（古いブラウザでも構文エラーで他のスクリプトを巻き込まない）。
 */

/* eslint-disable no-var */
function nbCallMain() {
  var TAP_LIMIT = 20;               // この端末で、1日に番号を確かめられる回数
  var LOOKUP_TIMEOUT_MS = 12000;    // Google から返事が無いまま、これを過ぎたら通信の失敗として扱う
  var MAP_HINT = 'Googleマップで確かめられます';
  var CHECKING = '電話番号を確かめています…';
  var UNAVAILABLE = 'いまは電話番号を確かめられません';
  var REASON_TEXT = {
    no_number: 'この店の電話番号は Google に登録がありません',
    closed: 'Google の店舗情報では閉業となっています',
    device_limit: '本日はこれ以上確かめられません',
    quota: UNAVAILABLE,
    denied: UNAVAILABLE,
    not_found: UNAVAILABLE,
    error: UNAVAILABLE
  };
  var mapsPromise = null;
  // 同一ページを表示している間だけの一時記憶（保存しない。閉じれば消える。二重タップの無駄打ち防止）
  var phoneMem = {};

  function send(name, params) {
    try { if (typeof trackEvent === 'function') trackEvent(name, params); } catch (e) {}
  }

  function loadMaps() {
    if (mapsPromise) return mapsPromise;
    mapsPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.maps && window.google.maps.places) { resolve(); return; }
      window.__nbMapsReady = resolve;
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + NB_CALL_MAPS_KEY + '&libraries=places&callback=__nbMapsReady&loading=async';
      s.async = true;
      s.onerror = function () { mapsPromise = null; reject(new Error('maps-js-load-failed')); };
      document.head.appendChild(s);
    });
    return mapsPromise;
  }

  // ブラウザ単位の簡易レート制限（暴発・誤連打での枠消費を防ぐ。1日 TAP_LIMIT 回まで）
  function tapAllowed() {
    try {
      var key = 'nb_call_taps_' + new Date().toISOString().slice(0, 10);
      var n = parseInt(localStorage.getItem(key) || '0', 10);
      if (n >= TAP_LIMIT) return false;
      localStorage.setItem(key, String(n + 1));
      return true;
    } catch (e) { return true; }
  }

  function statusLine(btn) {
    var host = btn.parentNode;
    if (!host) return null;
    var el = host.querySelector('.nb-call-status');
    if (!el) {
      el = document.createElement('p');
      el.className = 'nb-call-status';
      el.setAttribute('role', 'status');
      host.appendChild(el);
    }
    return el;
  }
  function say(btn, text) {
    var el = statusLine(btn);
    if (el) el.textContent = text;
  }
  function setLabel(btn, text) {
    var span = btn.querySelector('span');
    if (span) span.textContent = text;
  }

  // Google の応答を、計測の result と発信先に分ける
  function classify(place, status) {
    var S = google.maps.places.PlacesServiceStatus;
    if (status === S.OK) {
      if (place && place.business_status === 'CLOSED_PERMANENTLY') return { result: 'closed' };
      var tel = place && place.international_phone_number ? String(place.international_phone_number).replace(/[^\d+]/g, '') : '';
      return tel ? { result: 'ok', tel: tel } : { result: 'no_number' };
    }
    if (status === S.OVER_QUERY_LIMIT) return { result: 'quota' };
    if (status === S.REQUEST_DENIED) return { result: 'denied' };
    if (status === S.NOT_FOUND || status === S.ZERO_RESULTS) return { result: 'not_found' };
    return { result: 'error' };
  }

  function finish(btn, ctx, out) {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    setLabel(btn, '電話する');
    send('call_lookup', { store_name: ctx.name, store_id: ctx.placeId, location: ctx.loc, result: out.result });
    if (out.result === 'ok') {
      phoneMem[ctx.placeId] = out.tel;
      say(btn, '');
      location.href = 'tel:' + out.tel;
      return;
    }
    say(btn, (REASON_TEXT[out.result] || UNAVAILABLE) + '。' + MAP_HINT + '。');
  }

  window.nbCallStore = function (ev, placeId, storeName, btn) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (!placeId || !btn || btn.disabled) return;
    var ctx = { placeId: placeId, name: storeName || '', loc: btn.getAttribute('data-call-loc') || '' };
    var exit = { store_name: ctx.name, store_id: placeId, link_domain: 'tel', location: ctx.loc };
    if (typeof nbReserveExit === 'function') nbReserveExit('cta_call_click', exit);
    else send('cta_call_click', { store_name: ctx.name });
    say(btn, '');
    if (phoneMem[placeId]) { finish(btn, ctx, { result: 'ok', tel: phoneMem[placeId] }); return; }
    if (!tapAllowed()) { finish(btn, ctx, { result: 'device_limit' }); return; }
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    setLabel(btn, '確認中…');
    say(btn, CHECKING);
    var done = false;
    function settle(out) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      finish(btn, ctx, out);
    }
    var timer = setTimeout(function () { settle({ result: 'error' }); }, LOOKUP_TIMEOUT_MS);
    loadMaps().then(function () {
      var svc = new google.maps.places.PlacesService(document.createElement('div'));
      svc.getDetails({ placeId: placeId, fields: ['international_phone_number', 'business_status'] }, function (place, status) {
        settle(classify(place, status));
      });
    }).catch(function () { settle({ result: 'error' }); });
  };
}

const MARK_START = '<script class="nb-call-js">';
const MARK_END = '</script>';
const CALL_SCRIPT = `${MARK_START}(${nbCallMain.toString()})();${MARK_END}`;
// 行頭のものだけを自分のブロックとみなす（コメントや文字列の中にマーカーの文字が出ても、広い範囲を巻き込まない）
const BLOCK_RE = /^<script class="nb-call-js">[\s\S]*?<\/script>/m;

// 既にあれば差し替え、無ければ </body> の直前に入れる（冪等）
function applyToHtml(html) {
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, () => CALL_SCRIPT);
  const i = html.lastIndexOf('</body>');
  if (i < 0) throw new Error('</body> がありません');
  return html.slice(0, i) + CALL_SCRIPT + '\n' + html.slice(i);
}

module.exports = { nbCallMain, CALL_SCRIPT, applyToHtml, BLOCK_RE };

if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!args.includes('--apply') && !check || !files.length) {
    console.error('使い方: node scripts/lib/call_button_snippet.js --apply|--check <html...>');
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
