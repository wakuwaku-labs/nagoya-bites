#!/usr/bin/env node
'use strict';
/**
 * 特集の店カードに、閉業・一時休業の注記を出す／消す（基本方針 段階1 S1-4・ADR 0069・冪等・通信なし）。
 *
 * 店カードのリンク先の店（stores/<ホットペッパーID>.html）が、Google で「閉業」「一時休業」と表示されている店のとき、
 * カードの最後に「Google では「閉業」と表示されています（◯月◯日確認）。営業しているかは、お店に確認してください。」を足す。
 * 掲載データに無くなったホットペッパーIDの店には「いまの掲載データに無い店です」と出す（閉業とは書かない）。
 * 状態が戻った店・人の確認で営業中とされた店の注記は消す。店は外さない（外す決まりは変えない）。
 * 判定は scripts/lib/operating_notice.js（店舗ページと同じ）。カード内のリンクが 1 つの店を指すときだけ決める。
 *
 *   node scripts/sync_feature_closure_notes.js            # 書き込む
 *   node scripts/sync_feature_closure_notes.js --check    # 出す／消す注記があれば exit 1（書き込まない）
 * build.yml が sync_feature_scores.js の後に日次で回す。戻し方: この1行を build.yml から外し、注記の行を消す。
 */
const fs = require('fs');
const path = require('path');
const { cardRange } = require('./sync_feature_scores');
const { buildNoticeIndex } = require('./lib/operating_notice');
const { loadStores } = require('./lib/load_stores');

const ROOT = path.resolve(__dirname, '..');
const FEATURES = path.join(ROOT, 'features');
const NOTE_RE = /[ \t]*<p class="nb-note closure-note"[^>]*>[^<]*<\/p>\n?/g;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 1ページ分。notices は ホットペッパーID → { kind, text }。返り値の added / removed は店の ID の配列 */
function syncNotes(html, notices, knownIds) {
  const removed = [];
  let out = html.replace(NOTE_RE, (m) => { removed.push('-'); return ''; });
  const added = [];
  const cards = [];
  const CARD_CLASSES = ['store-card', 'store', 'shop-card', 'type-card'];
  const re = /class="(?:store-card|store|shop-card|type-card)"/g;
  let m;
  while ((m = re.exec(out))) {
    const r = cardRange(out, m.index + 1, CARD_CLASSES);
    if (r && !cards.some((c) => c.start === r.start)) cards.push(r);
  }
  cards.sort((a, b) => b.start - a.start);
  for (const c of cards) {
    const ids = new Set(Array.from(out.slice(c.start, c.end).matchAll(/stores\/([A-Za-z0-9_-]+)\.html/g), (x) => x[1]));
    if (ids.size !== 1) continue;
    const id = [...ids][0];
    let n = notices.get(id);
    // 掲載データに無くなったホットペッパーIDの店（ホットペッパーの掲載終了などで外れた店）。閉業とは断定しない
    if (!n && knownIds && /^J\d+$/.test(id) && !knownIds.has(id)) {
      n = { kind: 'unlisted', text: 'いまの掲載データに無い店です。営業しているかは、お店に確認してください。' };
    }
    if (!n) continue;
    const note = `          <p class="nb-note closure-note" data-closure="${n.kind}">${esc(n.text)}</p>\n`;
    // カードの最後の </div> の行の前に置く（取り除く正規表現と対になる形）
    let pos = c.end;
    while (pos > 0 && /[ \t]/.test(out[pos - 1])) pos--;
    out = out.slice(0, pos) + note + out.slice(pos);
    added.push(id);
  }
  return { html: out, added, removedCount: removed.length };
}

function main() {
  const check = process.argv.includes('--check');
  const stores = loadStores();
  const idx = buildNoticeIndex(stores);
  const notices = new Map([...idx.entries()].filter(([k]) => /^J\d+$/.test(k)));
  const knownIds = new Set(stores.map((s) => s['ホットペッパーID']).filter(Boolean));
  let changed = 0, addedTotal = 0;
  for (const f of fs.readdirSync(FEATURES).filter((x) => x.endsWith('.html')).sort()) {
    const p = path.join(FEATURES, f);
    const html = fs.readFileSync(p, 'utf8');
    const r = syncNotes(html, notices, knownIds);
    if (r.html === html) { addedTotal += r.added.length; continue; }
    changed++;
    addedTotal += r.added.length;
    console.log(`${f}: 注記 +${r.added.length}（${r.added.join('・')}）/ 入れ直し前の注記 ${r.removedCount}`);
    if (!check) fs.writeFileSync(p, r.html);
  }
  console.log(`特集の閉業・休業の注記（S1-4）: 注記つきの店カード ${addedTotal}・書き換えた記事 ${changed}${check ? '（書き込みなし）' : ''}`);
  if (check && changed) process.exit(1);
}

if (require.main === module) main();
module.exports = { syncNotes };
