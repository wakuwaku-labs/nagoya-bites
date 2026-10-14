'use strict';
/**
 * 失効した Google Places の写真 URL（lh3.googleusercontent.com/place-photos/...）を、
 * 公開ページの HTML から取り除く／同じ店の生きた写真に差し替える変換の部品（P-29）。
 * ネットワークにも data にも触れない純関数だけを置く（scripts/repair_expired_place_photos.js が通信と書き込みを担当）。
 *
 * 方針（CLAUDE.md の写真ルール）:
 *  - 差し替えは「同じ店」の生きた写真だけ（resolve が返したもの）。他店の写真を借りない・画素を加工しない。
 *  - 無ければ写真を外す（取り繕わない）。og:image は既存の既定（icons/icon-512.png）へ。
 *  - 失効したかどうかは呼び出し側が HTTP で確かめた dead 集合だけで決める（制約10）。
 */

const PLACE_RE = /https:\/\/lh3\.googleusercontent\.com\/place-photos\/[A-Za-z0-9_\-=%.\/?&;]*/g;
const DEFAULT_OG = 'https://nagoya-bites.com/icons/icon-512.png';
const FALLBACK_FIGURE = '/assets/store-figures/_fallback.svg';
const HERO_EXPIRED_MARK = 'NB-HERO-EXPIRED';

const unesc = (s) => String(s || '').replace(/&amp;/g, '&');
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** HTML に含まれる Places 写真 URL（&amp; を戻したもの）を重複なく返す */
function findPlaceUrls(html) {
  const out = new Set();
  for (const m of String(html).match(PLACE_RE) || []) out.add(unesc(m).replace(/;$/, ''));
  return [...out];
}

/** 店名の厳密な同一判定用（全角半角・空白・記号のゆれだけ畳む。あいまい一致はしない） */
function normName(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s　・･\-ー\/／()（）【】「」『』&＆]/g, '');
}

/**
 * ページ種別ごとに HTML を直す。
 * @param {string} html
 * @param {{kind:'features'|'journal'|'stores', dead:Set<string>, resolve:(name:string, opts?:object)=>(string|null)}} ctx
 * @returns {{html:string, changes:string[]}}
 */
function repairHtml(html, ctx) {
  const { kind, dead } = ctx;
  const resolve = ctx.resolve || (() => null);
  const changes = [];
  const isDead = (u) => dead.has(unesc(u).replace(/;$/, ''));
  let out = html;
  let heroReplacement = null; // 記事・店舗ページの顔を差し替えたとき、og:image もそれに揃える

  // 1. features: <div class="store-photo"><img ...></div>
  out = out.replace(/([ \t]*)<div class="store-photo"><img src="([^"]+)" alt="([^"]*)"([^>]*)><\/div>[ \t]*\n?/g,
    (all, ind, src, alt, rest) => {
      if (!isDead(src)) return all;
      const r = resolve(unesc(alt), { exact: true });
      if (r) { changes.push(`store-photo 差し替え: ${alt}`); return `${ind}<div class="store-photo"><img src="${r}" alt="${alt}"${rest}></div>\n`; }
      changes.push(`store-photo 削除: ${alt}`);
      return '';
    });

  // 2. features: <img class="shop-card-photo" ...>
  out = out.replace(/([ \t]*)<img class="shop-card-photo" src="([^"]+)" alt="([^"]*)"([^>]*)>[ \t]*\n?/g,
    (all, ind, src, alt, rest) => {
      if (!isDead(src)) return all;
      const r = resolve(unesc(alt), { exact: true });
      if (r) { changes.push(`shop-card-photo 差し替え: ${alt}`); return `${ind}<img class="shop-card-photo" src="${r}" alt="${alt}"${rest}>\n`; }
      changes.push(`shop-card-photo 削除: ${alt}`);
      return '';
    });

  // 3. features: 特集の顔 <div class="art-hero-image"><img ...></div>
  out = out.replace(/([ \t]*)<div class="art-hero-image">\s*<img src="([^"]+)" alt="([^"]*)"([^>]*)>\s*<\/div>[ \t]*\n?/g,
    (all, ind, src, alt, rest) => {
      if (!isDead(src)) return all;
      const name = unesc(alt).split(/\s+[—–-]\s+/)[0];
      const r = resolve(name, { exact: true });
      if (r) { changes.push(`art-hero-image 差し替え: ${name}`); return `${ind}<div class="art-hero-image">\n  <img src="${r}" alt="${alt}"${rest}>\n</div>\n`; }
      changes.push(`art-hero-image 削除: ${name}`);
      return '';
    });

  // 4. journal: ヒーロー figure
  if (kind === 'journal') {
    out = out.replace(/([ \t]*)<figure class="art-hero-img"([^>]*)>([\s\S]*?)<\/figure>[ \t]*\n?/g, (all, ind, attrs, inner) => {
      const im = inner.match(/<img src="([^"]+)" alt="([^"]*)"([^>]*)>/);
      if (!im || !isDead(im[1])) return all;
      const store = (attrs.match(/data-hero-store="([^"]*)"/) || [])[1] || '';
      const r = store ? resolve(unesc(store), { journal: true, html }) : null;
      if (r) {
        heroReplacement = r.url;
        const label = esc(r.label || unesc(store));
        const link = r.pageUrl || 'https://www.hotpepper.jp';
        changes.push(`ヒーロー差し替え(HotPepper): ${store}`);
        return `${ind}<figure class="art-hero-img" data-hero-source="hotpepper" data-hero-store="${store}">\n` +
          `  <img src="${r.url}" alt="${im[2]}"${im[3]}>\n` +
          `  <figcaption class="art-img-credit">写真: <a href="${link}" target="_blank" rel="noopener">${label}（ホットペッパーグルメ掲載の店舗写真）</a> / <a href="https://www.hotpepper.jp" target="_blank" rel="noopener">HotPepper</a></figcaption>\n` +
          `</figure>\n`;
      }
      changes.push(`ヒーロー削除(失効): ${store || im[2].slice(0, 30)}`);
      return `${ind}<!-- ${HERO_EXPIRED_MARK}: Google 側で写真 URL が失効したため外した。他店の写真は借りない -->\n`;
    });
    // 本文写真
    out = out.replace(/([ \t]*)<figure class="art-body-img"([^>]*)>([\s\S]*?)<\/figure>[ \t]*\n?/g, (all, ind, attrs, inner) => {
      const im = inner.match(/<img[^>]*src="([^"]+)"/);
      if (!im || !isDead(im[1])) return all;
      changes.push('本文写真削除(失効)');
      return '';
    });
  }

  // 5. stores（孤児ページ）: <img class="hero-img">
  out = out.replace(/<img class="hero-img" src="([^"]+)" alt="([^"]*)"([^>]*)>/g, (all, src, alt, rest) => {
    if (!isDead(src)) return all;
    const r = resolve(unesc(alt), { exact: true });
    if (r) { heroReplacement = r; changes.push(`hero-img 差し替え: ${alt}`); return `<img class="hero-img" src="${r}" alt="${alt}"${rest}>`; }
    changes.push(`hero-img 既定図へ: ${alt}`);
    return `<img class="hero-img" src="${FALLBACK_FIGURE}" alt="${alt}"${rest}>`;
  });

  // 6. og:image / twitter:image
  const sizeMetas = (url) => {
    if (/_480\.jpg/.test(url)) return [480, 320];
    if (/_238\.jpg/.test(url)) return [238, 158];
    if (/icon-512\.png/.test(url)) return [512, 512];
    return null;
  };
  let ogChanged = false;
  out = out.replace(/<meta (property="og:image"|name="twitter:image") content="([^"]+)">/g, (all, key, url) => {
    if (!isDead(url)) return all;
    const to = heroReplacement || DEFAULT_OG;
    if (/og:image/.test(key)) ogChanged = true;
    changes.push(`meta画像 ${heroReplacement ? '差し替え後の写真へ' : '既定画像へ'}`);
    return `<meta ${key} content="${to}">`;
  });
  // og:image が書き換わったとき、幅と高さを合わせる（寸法が分からない写真ではメタを外す）
  if (ogChanged) {
    const to = heroReplacement || DEFAULT_OG;
    const sz = sizeMetas(to);
    out = out.replace(/<meta property="og:image:width" content="[^"]*">\n?/g, '').replace(/<meta property="og:image:height" content="[^"]*">\n?/g, '');
    if (sz) {
      out = out.replace(/(<meta property="og:image" content="[^"]+">\n)/, `$1<meta property="og:image:width" content="${sz[0]}">\n<meta property="og:image:height" content="${sz[1]}">\n`);
    }
  }

  // 7. JSON-LD "image"（失効 URL の行を外す。最後のプロパティだった場合は直前のカンマも外す）
  const ldImg = '"image":\\s*"(https:\\/\\/lh3\\.googleusercontent\\.com\\/place-photos\\/[^"]+)"';
  out = out.replace(new RegExp(',(\\s*)' + ldImg + '(?=\\s*[}\\]])', 'g'), (all, ws, u) => {
    if (!isDead(u)) return all;
    changes.push('JSON-LD image 削除');
    return heroReplacement ? `,${ws}"image": "${heroReplacement}"` : '';
  });
  out = out.replace(new RegExp('\\n[ \\t]*' + ldImg + ',', 'g'), (all, u) => {
    if (!isDead(u)) return all;
    changes.push('JSON-LD image 削除');
    return heroReplacement ? `\n    "image": "${heroReplacement}",` : '';
  });

  return { html: out, changes };
}

/** JSON-LD ブロックが JSON として読めるか（直した後の確認用） */
function jsonLdValid(html) {
  const bad = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { bad.push(e.message); }
  }
  return bad;
}

/** sitemap-images.xml から失効 URL の <image:image> ブロックを外す */
function repairSitemapImages(xml, dead) {
  let n = 0;
  const out = xml.replace(/[ \t]*<image:image>\s*<image:loc>([^<]+)<\/image:loc>[\s\S]*?<\/image:image>[ \t]*\n?/g, (all, u) => {
    if (!dead.has(unesc(u).trim())) return all;
    n++;
    return '';
  });
  return { xml: out, removed: n };
}

module.exports = { PLACE_RE, DEFAULT_OG, FALLBACK_FIGURE, HERO_EXPIRED_MARK, findPlaceUrls, normName, repairHtml, jsonLdValid, repairSitemapImages, reEsc };
