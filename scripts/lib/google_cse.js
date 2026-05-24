'use strict';

/**
 * scripts/lib/google_cse.js
 *
 * ISSUE-045 自動化: Google Custom Search JSON API ラッパー。
 *
 * 必要な環境変数（CI で GitHub Secrets に設定）:
 *   GOOGLE_CSE_KEY  Google Cloud API キー（Custom Search API 有効化）
 *   GOOGLE_CSE_CX   検索エンジン ID（programmablesearchengine.google.com で作成）
 *
 * セットアップ: docs/editorreason-automation-setup.md
 *
 * 無料枠: 100 クエリ/日。$5/1000 クエリ（有料）。
 *
 * 使い方:
 *   const { search } = require('./lib/google_cse');
 *   const items = await search('店名 業界人', { num: 5 });
 *   // items = [{title, link, snippet, displayLink}, ...]
 */

const https = require('https');

const API_KEY = process.env.GOOGLE_CSE_KEY || '';
const CX = process.env.GOOGLE_CSE_CX || '';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message} | body[0..200]: ${data.slice(0,200)}`)); }
      });
    }).on('error', reject);
  });
}

/**
 * 1 クエリで Google CSE を叩く。
 * @param {string} query
 * @param {object} opts {num: 1-10, hl?: 'ja', lr?: 'lang_ja', siteSearch?: string}
 * @returns {Promise<Array<{title,link,snippet,displayLink}>>}
 */
async function search(query, opts = {}) {
  if (!API_KEY || !CX) {
    throw new Error('GOOGLE_CSE_KEY / GOOGLE_CSE_CX 未設定。docs/editorreason-automation-setup.md 参照');
  }
  const num = Math.min(10, Math.max(1, opts.num || 5));
  const params = new URLSearchParams({
    key: API_KEY,
    cx: CX,
    q: query,
    num: String(num),
    hl: opts.hl || 'ja',
    lr: opts.lr || 'lang_ja'
  });
  if (opts.siteSearch) params.set('siteSearch', opts.siteSearch);
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const res = await fetchJson(url);
  if (res.error) throw new Error(`CSE API error: ${res.error.message || JSON.stringify(res.error)}`);
  const items = res.items || [];
  return items.map(it => ({
    title: it.title || '',
    link: it.link || '',
    snippet: it.snippet || '',
    displayLink: it.displayLink || ''
  }));
}

/**
 * 1 店舗向けに「業界視点の手がかり」を集める複数クエリ。
 * @param {object} store {name, area, genre}
 * @param {object} opts {perQuery: 3}
 * @returns {Promise<Array<{query, items}>>}
 */
async function discoverIndustryEvidence(store, opts = {}) {
  const perQuery = opts.perQuery || 3;
  const name = store.name || store['店名'];
  const area = store.area || store['エリア'] || '';
  const genre = store.genre || store['ジャンル'] || '';
  // 業界視点が出やすいクエリ（ナゴレコ・名古屋情報通・WEB大人の名古屋など現地メディア優先）
  const queries = [
    `${name} ${area} 名古屋`,
    `${name} 店主 こだわり`,
    `${name} 業界人`,
    `${name} ナゴレコ`,
    `${name} ${genre} 名古屋 おすすめ`
  ];
  const out = [];
  for (const q of queries) {
    try {
      const items = await search(q, { num: perQuery });
      out.push({ query: q, items });
    } catch (e) {
      out.push({ query: q, items: [], error: e.message });
    }
    // CSE のレート対策（1 RPS 程度）
    await new Promise(r => setTimeout(r, 350));
  }
  return out;
}

function isConfigured() {
  return !!(API_KEY && CX);
}

module.exports = { search, discoverIndustryEvidence, isConfigured };
