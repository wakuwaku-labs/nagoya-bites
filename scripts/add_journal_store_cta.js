#!/usr/bin/env node
/**
 * add_journal_store_cta.js  (SEO-054)
 *
 * 公開済みジャーナル記事の店舗カード（.store-card）に、予約（HotPepper）と
 * 地図（Google Maps 検索）の行動導線を後追いで挿入する。
 *
 * 新規記事は scripts/generate_daily_draft.js の buildStores() が自動で持つ（テンプレート側の対応）。
 * 本スクリプトは既存記事への後追い適用のみ。
 *
 * - 予約導線は data-store-id が data/stores.json の実在ホットペッパーIDと一致した店にのみ付与する
 *   （推測URLの生成禁止・制約10。data-store-id が無い/一致しない店は予約ボタンを出さない）
 * - 地図導線は店名（+可能なら data/stores.json のエリア）からの Google Maps 検索URLで、
 *   全カードに付与する（index.html の gmap() フォールバックと同じ設計）
 * - 既存の store-link（詳細ページ/外部リンク）は維持し、排他にしない（SEO-049 の教訓）
 * - 冪等: .store-cta-row を既に持つカードはスキップ
 *
 * 使用例:
 *   node scripts/add_journal_store_cta.js journal/2026-08-*.html
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function jsEsc(s) { return String(s || '').replace(/'/g, '').replace(/</g, '').replace(/>/g, ''); }
function decodeEntities(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

let _hpMap = null;
function loadHpMap() {
  if (_hpMap) return _hpMap;
  _hpMap = new Map();
  const stores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'stores.json'), 'utf8'));
  const list = Array.isArray(stores) ? stores : (stores.stores || []);
  for (const r of list) {
    const hpId = r['ホットペッパーID'];
    if (hpId) _hpMap.set(hpId, r);
  }
  return _hpMap;
}

function gmapSearchUrl(name, area, access) {
  const base = String(name || '').trim();
  const addrMatch = String(access || '').match(/(?:愛知県)?(名古屋市[^\s（）()【】「」]+)/);
  const q = addrMatch ? `${base} ${addrMatch[1]}` : `${base} ${String(area || '').split('/')[0] || '名古屋'}`;
  return 'https://maps.google.com/search?q=' + encodeURIComponent(q);
}

// 各 store-card を非貪欲マッチで抽出する。内側の .store-meta の </div> は直後が
// <p> のため "</div>\s*</div>" に一致せず、store-info + store-card の本当の閉じでのみ止まる。
const CARD_RE = /<div class="store-card"(?: data-store-id="([^"]*)")?>([\s\S]*?)<\/div>\s*<\/div>/g;

function processHtml(html) {
  const hpMap = loadHpMap();
  let changed = 0;
  const out = html.replace(CARD_RE, (whole, storeId, inner) => {
    if (inner.includes('store-cta-row')) return whole; // 冪等: 既に適用済み
    const nameMatch = inner.match(/<h3 class="store-name">([^<]*)<\/h3>/);
    if (!nameMatch) return whole;
    const name = decodeEntities(nameMatch[1]).trim();
    if (!name) return whole;

    const existingLinkMatch = inner.match(/<a class="store-link"[^>]*>[\s\S]*?<\/a>/);
    const existingLinkHtml = existingLinkMatch ? existingLinkMatch[0] : '';

    const rec = storeId ? hpMap.get(storeId) : null;
    const reserveHtml = rec
      ? `<a class="store-link store-link-reserve" href="https://www.hotpepper.jp/str${esc(rec['ホットペッパーID'])}/" target="_blank" rel="noopener noreferrer" onclick="trackEvent('cta_reserve',{store_name:'${jsEsc(name)}'})">この店を予約する</a>`
      : '';
    const mapUrl = gmapSearchUrl(name, rec ? rec['エリア'] : '', rec ? rec['アクセス'] : '');
    const mapHtml = `<a class="store-link store-link-map" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer" onclick="trackEvent('cta_gmap_click',{store_name:'${jsEsc(name)}',location:'journal_store_card'})">地図で確認する</a>`;

    const ctaRow = `          <div class="store-cta-row">${reserveHtml}${mapHtml}${existingLinkHtml}</div>`;

    let newInner;
    if (existingLinkMatch) {
      newInner = inner.replace(existingLinkMatch[0], ctaRow);
    } else {
      newInner = inner.replace(/<\/p>/, `</p>\n${ctaRow}`);
    }
    changed++;
    const openTag = storeId ? `<div class="store-card" data-store-id="${storeId}">` : '<div class="store-card">';
    return `${openTag}${newInner}</div>\n      </div>`;
  });
  return { html: out, changed };
}

const files = process.argv.slice(2).filter(f => f && f.endsWith('.html') && !f.endsWith('_template.html'));

if (files.length === 0) {
  console.log('add_journal_store_cta: 対象ファイルなし（引数なし）');
  process.exit(0);
}

let modifiedFiles = 0, skippedFiles = 0, erroredFiles = 0, totalCards = 0;

for (const file of files) {
  try {
    if (!fs.existsSync(file)) {
      console.error(`SKIP (not found): ${file}`);
      skippedFiles++;
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('store-card')) {
      console.log(`SKIP (no store-card): ${file}`);
      skippedFiles++;
      continue;
    }
    const { html: newHtml, changed } = processHtml(html);
    if (changed === 0) {
      console.log(`SKIP (already applied or no matching cards): ${file}`);
      skippedFiles++;
      continue;
    }
    fs.writeFileSync(file, newHtml, 'utf8');
    console.log(`OK: ${file} (${changed} cards)`);
    modifiedFiles++;
    totalCards += changed;
  } catch (e) {
    console.error(`ERROR: ${file}: ${e.message}`);
    erroredFiles++;
  }
}

console.log(`add_journal_store_cta: modified=${modifiedFiles} skipped=${skippedFiles} errored=${erroredFiles} cards=${totalCards}`);
