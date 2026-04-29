'use strict';
/**
 * build_features.js
 * index.html の LOCAL_STORES から最新データを読み込み、
 * 特集記事の店舗リスト・JSON-LD・sitemapを自動更新する。
 *
 * 使い方: node build.js && node build_features.js
 *
 * 各特集記事の「店舗リスト部分」だけを最新データで差し替える。
 * 記事の導入文・Tips・関連リンクなどの編集コンテンツはそのまま維持。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, 'index.html');
const FEATURES_DIR = path.join(__dirname, 'features');

// ─────────────────────────────────────────────
// 共通ヘルパー
// ─────────────────────────────────────────────

/** 名古屋市内エリアか判定（アクセス欄も含めた二重チェック） */
function isNagoyaArea(area, access) {
  if (!area) return false;
  const ngKeywords = ['名古屋','栄','錦','金山','大須','伏見','名駅','新栄',
    '千種','今池','池下','本山','覚王山','藤が丘','八事','鶴舞','御器所',
    '丸の内','熱田','神宮','瑞穂','天白','緑区','南区','中川','港区','守山',
    '大曽根','桜山','矢場町','上前津'];
  if (!ngKeywords.some(k => area.includes(k))) return false;
  // アクセス欄に他都市の鉄道名があれば偽データとして除外
  if (access) {
    const badAccess = ['東武','西武','京王','小田急','京急','京成','相鉄',
      'JR山手線','東京メトロ','都営','阪急','阪神','大阪メトロ','西鉄',
      'スカイツリー','獨協','川西能勢口','近鉄四日市'];
    if (badAccess.some(b => access.includes(b))) return false;
  }
  return true;
}

/** 居酒屋系ジャンルか */
function isIzakaya(genre) {
  return genre === '居酒屋';
}

/** おしゃれ・デート向きジャンルか（焼肉・ホルモンを明確に除外） */
function isFancyGenre(genre) {
  if (/焼肉|ホルモン|ラーメン|カラオケ|お好み焼き/.test(genre)) return false;
  return /イタリアン|フレンチ|ダイニングバー|バル|創作料理|バー・カクテル|カフェ|洋食/.test(genre);
}

/** 記念日・特別な日向きジャンルか */
function isCelebrationGenre(genre) {
  if (/焼肉|ホルモン|ラーメン|カラオケ|お好み焼き|中華/.test(genre)) return false;
  return /イタリアン|フレンチ|ダイニングバー|バル|創作料理|和食|カフェ|洋食/.test(genre);
}

/** 大箱チェーン店っぽいか（100名以上対応 = 大衆向け大箱の可能性高） */
function isMassMarket(tags) {
  return tags.includes('100名以上');
}

/** おすすめポイントが宣伝文句だけかチェック（true=使えない） */
function isPromoOnly(text) {
  if (!text || text.length < 3) return true;
  if (/チャージ|無料|0円|クーポン|割引|OFF|半額|ポイント|円～|円〜|オトク|お得|大特価|特価|プレゼント|サービス|食べ放題|飲み放題|食べ飲み放題|コース.*円|\d[\d,]{2,}円|\d{4}円/.test(text)) return true;
  if (/^[\d,円税込~～＋\s\-−★☆♪◎●◆▼▲※!！%％]+$/.test(text)) return true;
  return false;
}

/** おすすめポイントをサニタイズ（宣伝文句なら空文字を返す） */
function sanitizeRec(text) {
  if (!text) return '';
  if (isPromoOnly(text)) return '';
  return text.trim();
}

/** 価格帯から数値を推定 */
function estimatePrice(priceStr) {
  if (!priceStr) return 0;
  const nums = priceStr.match(/(\d{3,6})/g);
  if (!nums) return 0;
  return Math.max(...nums.map(Number));
}

/** 系列店チェック（店名の主要部分が同じなら系列と判断） */
function getChainKey(name) {
  // 「XXX 栄店」「XXX 名駅店」→「XXX」に正規化
  return name.replace(/\s+/g, '')
    .replace(/(栄店|名駅店|名古屋駅前店|金山店|栄東店|新栄店|栄錦店|伏見店|大須店|住吉店|錦店|2号店|3号店|本店|南口店|西口店)$/g, '')
    .replace(/[　\s]/g, '');
}

/** ジャンル多様性を確保した選別（同ジャンルは最大N件） */
function diversifyGenres(stores, maxPerGenre) {
  const genreCount = {};
  return stores.filter(s => {
    const g = s['ジャンル'] || 'その他';
    genreCount[g] = (genreCount[g] || 0) + 1;
    return genreCount[g] <= maxPerGenre;
  });
}

/** 系列店を排除した重複排除 */
function dedupWithChain(stores) {
  const seen = new Set();
  const chainSeen = new Set();
  return stores.filter(s => {
    const name = (s['店名'] || '').replace(/\s+/g, '');
    if (seen.has(name)) return false;
    seen.add(name);
    const hpid = s['ホットペッパーID'];
    if (hpid && seen.has('hp:' + hpid)) return false;
    if (hpid) seen.add('hp:' + hpid);
    // 系列店チェック
    const chain = getChainKey(s['店名']);
    if (chain.length > 3 && chainSeen.has(chain)) return false;
    if (chain.length > 3) chainSeen.add(chain);
    return true;
  });
}

/** 選定理由を生成（なぜこの特集に入っているか） */
function generateReason(store, featureType) {
  const tags = (store['タグ'] || '').split(',').map(t => t.trim());
  const genre = store['ジャンル'] || '';
  const score = store['Google評価'] || '';
  const price = store['価格帯'] || '';
  const rec = sanitizeRec(store['おすすめポイント'] || '');
  const reasons = [];

  switch(featureType) {
    case 'date':
      if (tags.includes('個室')) reasons.push('個室完備で二人の時間を確保');
      if (tags.includes('隠れ家')) reasons.push('隠れ家的な雰囲気');
      if (tags.includes('誕生日・記念日')) reasons.push('記念日演出に対応');
      if (/イタリアン|フレンチ/.test(genre)) reasons.push(genre + 'の本格料理');
      if (/ダイニングバー|バル/.test(genre)) reasons.push('おしゃれな空間で食事');
      if (estimatePrice(price) >= 6000) reasons.push('特別感のある価格帯');
      break;
    case 'birthday':
      if (tags.includes('誕生日・記念日')) reasons.push('誕生日・記念日プランあり');
      if (/ケーキ|サプライズ|お祝い/.test(rec)) reasons.push('サプライズ演出に対応');
      if (tags.includes('個室')) reasons.push('個室で特別な空間');
      if (/イタリアン|フレンチ/.test(genre)) reasons.push('記念日にふさわしい料理');
      break;
    case 'girls':
      if (/カフェ|スイーツ/.test(genre)) reasons.push('SNS映えする空間');
      if (tags.includes('個室')) reasons.push('周りを気にせず楽しめる個室');
      if (/ダイニングバー|バル|イタリアン/.test(genre)) reasons.push('おしゃれな雰囲気');
      if (tags.includes('女子会')) reasons.push('女子会プランあり');
      break;
    case 'private':
      if (tags.includes('個室')) reasons.push('完全個室で周りを気にしない空間');
      if (tags.includes('接待')) reasons.push('接待にも使える格式');
      if (/和食/.test(genre)) reasons.push('落ち着いた和の空間');
      if (/イタリアン|フレンチ|ダイニング/.test(genre)) reasons.push('洗練された雰囲気');
      if (estimatePrice(price) >= 5000) reasons.push('しっかりしたコース料理');
      break;
    case 'banquet':
      const capMatch = (store['タグ']||'').match(/(\d+)〜(\d+)名/);
      const cap100 = tags.includes('100名以上');
      if (cap100) reasons.push('100名以上の大宴会に対応');
      else if (capMatch) reasons.push(capMatch[1] + '〜' + capMatch[2] + '名の宴会に対応');
      if (tags.includes('飲み放題')) reasons.push('飲み放題プランあり');
      if (tags.includes('忘年会・新年会')) reasons.push('忘年会・新年会に最適');
      if (tags.includes('歓送迎会')) reasons.push('歓送迎会にも対応');
      break;
    case 'large':
      if (tags.includes('100名以上')) reasons.push('100名以上の超大人数に対応');
      else {
        const m2 = (store['タグ']||'').match(/(\d+)〜(\d+)名/);
        if (m2 && parseInt(m2[2]) >= 70) reasons.push(m2[1]+'〜'+m2[2]+'名の大人数に対応');
      }
      if (tags.includes('飲み放題')) reasons.push('飲み放題込みのコースあり');
      if (tags.includes('貸切可')) reasons.push('貸切対応');
      break;
  }

  // おすすめポイント（店固有の特徴）を最優先で使用
  // 選定理由は補足として末尾に追加
  const reasonTag = reasons.length > 0 ? reasons[0] : '';

  if (rec && rec.length > 5) {
    // おすすめポイントが十分な長さならそれをメインに使い、選定理由を1つ補足
    if (reasonTag && !rec.includes(reasonTag)) {
      return rec + '（' + reasonTag + '）';
    }
    return rec;
  }

  // おすすめポイントがない場合のみ選定理由で構成
  if (score && parseFloat(score) >= 4.5) reasons.push('Google★' + score + 'の高評価');
  if (reasons.length === 0) return genre + 'の人気店。';
  return reasons.slice(0, 3).join('。') + '。';
}

/** 重複排除（店名の類似度で判定） */
function dedup(stores) {
  const seen = new Set();
  return stores.filter(s => {
    const name = (s['店名'] || '').replace(/\s+/g, '').replace(/　/g, '');
    // 完全一致チェック
    if (seen.has(name)) return false;
    seen.add(name);
    // ホットペッパーID重複チェック
    const hpid = s['ホットペッパーID'];
    if (hpid && seen.has('hp:' + hpid)) return false;
    if (hpid) seen.add('hp:' + hpid);
    return true;
  });
}

// ─────────────────────────────────────────────
// 特集記事の設定
// ─────────────────────────────────────────────
const FEATURE_CONFIGS = [
  {
    file: 'meieki.html',
    label: '名駅エリア',
    count: 15,
    filter: s => {
      const area = s['エリア'] || '';
      return area === '名古屋駅' || area.includes('名古屋駅') || area.includes('名駅')
        || area.includes('中村区') || area.includes('西区');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `名駅エリアの${s['ジャンル']}。`,
  },
  {
    file: 'sakae.html',
    label: '栄・錦エリア',
    count: 15,
    filter: s => {
      const area = s['エリア'] || '';
      return area === '栄' || area.includes('錦') || area.includes('栄')
        || area.includes('矢場町') || area.includes('東桜') || area.includes('新栄');
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => s['おすすめポイント'] || `栄エリアの${s['ジャンル']}。`,
  },
  {
    file: 'banquet.html',
    label: '宴会・忘年会',
    count: 15,
    filter: s => {
      const tags = s['タグ'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準:
      // 1. 30名以上対応 or 宴会系タグ or 飲み放題
      // 2. 評価4.0以上
      // 3. コース料理がある（価格帯にコース/宴会の数字がある）
      const hasBanquetCapacity = /30〜|40〜|50〜|60〜|70〜|80〜|90〜|100名/.test(tags);
      const hasBanquetTag = tags.includes('忘年会') || tags.includes('歓送迎会') || tags.includes('飲み放題');
      return (hasBanquetCapacity || hasBanquetTag) &&
             score >= 4.0 &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      // 宴会に最適な店を上位に（収容人数×評価でスコアリング）
      function banquetScore(s) {
        let sc = (parseFloat(s['Google評価']) || 0) * 10;
        const tags = s['タグ'] || '';
        if (tags.includes('飲み放題')) sc += 3;
        if (tags.includes('忘年会・新年会')) sc += 2;
        if (tags.includes('歓送迎会')) sc += 2;
        if (tags.includes('100名以上')) sc += 3;
        else if (/70〜|80〜|90〜/.test(tags)) sc += 2;
        else if (/50〜|60〜/.test(tags)) sc += 1;
        return sc;
      }
      return banquetScore(b) - banquetScore(a);
    },
    descGenerator: s => generateReason(s, 'banquet'),
    postFilter: stores => diversifyGenres(stores, 6), // 居酒屋多めOKだが上限あり
  },
  {
    file: 'private-room.html',
    label: '個室グルメ',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const genre = s['ジャンル'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      const price = estimatePrice(s['価格帯']);
      // 厳格基準:
      // 1. 個室タグ必須
      // 2. 評価4.2以上（個室は質の高い店だけ）
      // 3. 大箱チェーン除外
      // 4. 価格帯3000円以上（個室にふさわしい格）
      // 5. 居酒屋は半分まで（ジャンル多様性）
      return tags.includes('個室') &&
             score >= 4.2 &&
             price >= 3000 &&
             !isMassMarket(tags) &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      // 接待・和食・イタリアンなど格のある店を優先
      function privScore(s) {
        let sc = (parseFloat(s['Google評価']) || 0) * 10;
        const tags = s['タグ'] || '';
        const genre = s['ジャンル'] || '';
        if (tags.includes('接待')) sc += 4;
        if (/和食|イタリアン|フレンチ/.test(genre)) sc += 3;
        if (/ダイニングバー|バル|創作/.test(genre)) sc += 2;
        if (estimatePrice(s['価格帯']) >= 5000) sc += 2;
        // 居酒屋はやや減点（多様性のため）
        if (isIzakaya(genre)) sc -= 2;
        return sc;
      }
      return privScore(b) - privScore(a);
    },
    descGenerator: s => generateReason(s, 'private'),
    postFilter: stores => diversifyGenres(stores, 3), // 同ジャンル最大3件
  },
  {
    file: 'birthday.html',
    label: '誕生日・記念日',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const genre = s['ジャンル'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      const price = estimatePrice(s['価格帯']);
      const rawRec = (s['おすすめポイント'] || '');
      const rec = rawRec.toLowerCase();
      // 厳格基準:
      // 1. 記念日ジャンル（イタリアン/フレンチ/ダイニング/和食/洋食/カフェ）のみ
      // 2. 焼肉・ホルモン・ラーメン・大衆系は完全除外
      // 3. 誕生日タグ or おすすめに「誕生日/記念日/サプライズ/ケーキ」含む
      // 4. 大箱チェーン店は除外
      // 5. Google評価3.5以上
      const hasAnniversarySignal = tags.includes('誕生日・記念日') ||
        /誕生日|記念日|サプライズ|ケーキ|anniversary|お祝い/.test(rec);
      return isCelebrationGenre(genre) &&
             hasAnniversarySignal &&
             !isMassMarket(tags) &&
             score >= 3.5 &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      const sa = parseFloat(a['Google評価']) || 0;
      const sb = parseFloat(b['Google評価']) || 0;
      if (sb !== sa) return sb - sa;
      return estimatePrice(b['価格帯']) - estimatePrice(a['価格帯']);
    },
    descGenerator: s => generateReason(s, 'birthday'),
  },
  {
    file: 'date.html',
    label: 'デートディナー',
    count: 10,
    filter: s => {
      const genre = s['ジャンル'] || '';
      const tags = s['タグ'] || '';
      const price = estimatePrice(s['価格帯']);
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準:
      // 1. おしゃれジャンルのみ（焼肉・ホルモン・ラーメン等は完全除外）
      // 2. Google評価4.0以上
      // 3. 価格帯4,000円以上（安すぎる店はデートに不向き）
      // 4. 大箱チェーン店は除外
      // 5. 個室 or 隠れ家 or 記念日タグがあると加点
      return isFancyGenre(genre) &&
             score >= 4.0 &&
             price >= 4000 &&
             !isMassMarket(tags) &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      // スコアリング: 評価 + ジャンルボーナス + 特別な要素
      function dateScore(s) {
        let sc = (parseFloat(s['Google評価']) || 0) * 10;
        const tags = s['タグ'] || '';
        const rec = s['おすすめポイント'] || '';
        // 個室・隠れ家はデートに最適
        if (tags.includes('個室') || tags.includes('隠れ家')) sc += 3;
        // 記念日対応は加点
        if (tags.includes('誕生日・記念日')) sc += 2;
        // おすすめに雰囲気系ワードがあれば加点
        if (/雰囲気|おしゃれ|隠れ家|特別|デート|カップル|大人/.test(rec)) sc += 2;
        // 高級感のある価格帯は加点
        if (estimatePrice(s['価格帯']) >= 6000) sc += 1;
        return sc;
      }
      return dateScore(b) - dateScore(a);
    },
    descGenerator: s => generateReason(s, 'date'),
  },
  {
    file: 'girls-party.html',
    label: '女子会',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const genre = s['ジャンル'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準:
      // 1. 焼肉・ホルモン・ラーメン・大衆系は完全除外
      // 2. おしゃれジャンル or 女子会タグ
      // 3. 大箱チェーン店は除外
      // 4. Google評価4.0以上
      return (isFancyGenre(genre) || (tags.includes('女子会') && isCelebrationGenre(genre))) &&
             !isMassMarket(tags) &&
             score >= 4.0 &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => (parseFloat(b['Google評価']) || 0) - (parseFloat(a['Google評価']) || 0),
    descGenerator: s => generateReason(s, 'girls'),
  },
  {
    file: 'large-group.html',
    label: '大人数宴会',
    count: 10,
    filter: s => {
      const tags = s['タグ'] || '';
      const score = parseFloat(s['Google評価']) || 0;
      // 厳格基準: 70名以上対応のみ（本当の大人数）+ 評価4.0以上
      return (tags.includes('100名') || tags.includes('80〜') ||
              tags.includes('90〜') || tags.includes('70〜')) &&
             score >= 4.0 &&
             isNagoyaArea(s['エリア'], s['アクセス']);
    },
    sort: (a, b) => {
      // 収容人数が大きい店を優先
      function capScore(s) {
        let sc = (parseFloat(s['Google評価']) || 0) * 10;
        const tags = s['タグ'] || '';
        if (tags.includes('100名以上')) sc += 5;
        else if (/90〜/.test(tags)) sc += 4;
        else if (/80〜/.test(tags)) sc += 3;
        else if (/70〜/.test(tags)) sc += 2;
        if (tags.includes('飲み放題')) sc += 2;
        if (tags.includes('貸切可')) sc += 2;
        return sc;
      }
      return capScore(b) - capScore(a);
    },
    descGenerator: s => generateReason(s, 'large'),
    postFilter: stores => diversifyGenres(stores, 4),
  },
];

// ─────────────────────────────────────────────
// 店舗カード生成（写真付き）
// ─────────────────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SITE_BASE_URL = 'https://nagoya-bites.com';

/** gen-store-pages.js の toSlug と同じロジック。両方で slugs を揃えるため重複定義 */
function toStoreSlug(store) {
  if (store['ホットペッパーID']) return store['ホットペッパーID'];
  if (store['英語名']) {
    return store['英語名'].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  const ascii = (store['店名'] || '').replace(/[^\x00-\x7F]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (ascii.length >= 3) return ascii;
  return 'store-' + Buffer.from(store['店名'] || '', 'utf8').toString('hex').slice(0, 16);
}

/** 自サイト内の店舗詳細ページURL — 構造化データ・内部リンク両方で使用 */
function getInternalStoreUrl(store) {
  return `${SITE_BASE_URL}/stores/${toStoreSlug(store)}.html`;
}

/** 外部予約URL（カード内の「予約」ボタン用） */
function getStoreUrl(store) {
  const hpid = store['ホットペッパーID'];
  if (hpid) return `https://www.hotpepper.jp/str${hpid}/`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store['店名'] + ' 名古屋')}`;
}

function getPhotoUrl(store) {
  // ホットペッパーの写真URLを優先（安定してる）
  const hp = store['写真URL'] || '';
  if (hp && hp.startsWith('https://imgfp.hotp.jp')) return hp;
  if (hp && hp.startsWith('http')) return hp;
  // 料理写真（IGベースは不安定なので避ける）
  return '';
}

function generateStoreCard(store, index, config) {
  const num = String(index + 1).padStart(2, '0');
  const name = escapeHtml(store['店名']);
  const genre = escapeHtml(store['ジャンル'] || '');
  const area = escapeHtml(store['エリア'] || '');
  const score = store['Google評価'];
  const price = escapeHtml(store['価格帯'] || '');
  const desc = escapeHtml(config.descGenerator(store));
  const tags = (store['タグ'] || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3);
  const externalUrl = getStoreUrl(store);
  const internalUrl = getInternalStoreUrl(store);
  const photo = getPhotoUrl(store);

  const scoreMeta = score ? `<span class="score">★ ${escapeHtml(score)}</span>` : '';
  const priceMeta = price ? `<span>${price}</span>` : '';
  const tagsHtml = tags.map(t => `<span class="store-tag">${escapeHtml(t)}</span>`).join('');

  const photoHtml = photo
    ? `<div class="store-photo"><img src="${escapeHtml(photo)}" alt="${name}" loading="lazy" width="160" height="120"></div>`
    : '';

  return `      <div class="store-card">
        <div class="store-num">${num}</div>
        ${photoHtml}
        <div class="store-info">
          <div class="store-name"><a href="${escapeHtml(internalUrl)}">${name}</a></div>
          <div class="store-meta"><span>${area}</span><span>${genre}</span>${scoreMeta}${priceMeta}</div>
          <p class="store-desc">${desc}</p>
          <div class="store-tags">${tagsHtml}</div>
          <div class="store-actions">
            <a class="store-link store-link-internal" href="${escapeHtml(internalUrl)}">詳細ページを見る →</a>
            <a class="store-link" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener">予約はこちら →</a>
          </div>
        </div>
      </div>`;
}

function generateItemListJsonLd(stores, config) {
  const items = stores.map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: s['店名'],
    url: getInternalStoreUrl(s),
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${config.label}おすすめ${config.count}選`,
    numberOfItems: stores.length,
    itemListElement: items,
  });
}

// ─────────────────────────────────────────────
// FAQ 読み込み・差し込み処理
//   data/feature_faqs.json に特集ファイル名をキーとして Q&A 配列を定義すると、
//   各特集HTMLに以下を自動差し込み:
//     1. <!-- FAQ-LD:START/END --> マーカー (<head>内) に FAQPage JSON-LD
//     2. <!-- FAQ-HTML:START/END --> マーカーがあればそこに可視 Q&A セクション
//        マーカーがなければ最初に見つかる </article> または </main> 直前に挿入
// ─────────────────────────────────────────────
const FAQ_JSON_PATH = path.join(__dirname, 'data', 'feature_faqs.json');

function loadFeatureFAQs() {
  try {
    if (!fs.existsSync(FAQ_JSON_PATH)) return {};
    return JSON.parse(fs.readFileSync(FAQ_JSON_PATH, 'utf8'));
  } catch (e) {
    console.warn(`  ⚠ feature_faqs.json 読み込み失敗: ${e.message}`);
    return {};
  }
}

function generateFAQPageJsonLd(items) {
  if (!items || !items.length) return '';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a }
    }))
  });
}

function generateFAQHtmlBlock(items) {
  if (!items || !items.length) return '';
  const itemsHtml = items.map(({ q, a }) =>
    `    <div class="faq-item">
      <div class="faq-q">${escapeHtml(q)}</div>
      <div class="faq-a">${escapeHtml(a)}</div>
    </div>`
  ).join('\n');
  return `  <section class="faq-section" aria-label="よくある質問">
    <h2>よくある質問</h2>
${itemsHtml}
  </section>`;
}

/** 特集HTMLに FAQ JSON-LD と可視セクションを差し込む */
function injectFAQ(html, featureFile, faqMap) {
  const items = faqMap[featureFile];
  if (!items || !items.length) return html;

  // 1. JSON-LD（<head>内）
  const ldRe = /<!--\s*FAQ-LD:START\s*-->[\s\S]*?<!--\s*FAQ-LD:END\s*-->/;
  const jsonLd = generateFAQPageJsonLd(items);
  const ldReplacement = `<!-- FAQ-LD:START -->\n<script type="application/ld+json">\n${jsonLd}\n</script>\n<!-- FAQ-LD:END -->`;
  if (html.match(ldRe)) {
    html = html.replace(ldRe, ldReplacement);
  } else {
    html = html.replace('</head>', ldReplacement + '\n</head>');
  }

  // 2. 可視 FAQ セクション
  const htmlRe = /<!--\s*FAQ-HTML:START\s*-->[\s\S]*?<!--\s*FAQ-HTML:END\s*-->/;
  const faqBlock = generateFAQHtmlBlock(items);
  const htmlReplacement = `<!-- FAQ-HTML:START -->\n${faqBlock}\n<!-- FAQ-HTML:END -->`;
  if (html.match(htmlRe)) {
    html = html.replace(htmlRe, htmlReplacement);
  } else {
    // マーカーなし → </article> 直前、なければ </main> 直前に挿入（冪等化のためマーカー付きで入れる）
    const injectBeforeMain = htmlReplacement + '\n';
    if (html.includes('</article>')) {
      html = html.replace('</article>', injectBeforeMain + '</article>');
    } else if (html.includes('</main>')) {
      html = html.replace('</main>', injectBeforeMain + '</main>');
    }
  }
  return html;
}

// ─────────────────────────────────────────────
// CSS追加: 写真表示用スタイル
// ─────────────────────────────────────────────
const PHOTO_CSS = `
.store-photo{flex-shrink:0;width:160px;height:120px;border-radius:4px;overflow:hidden;background:var(--bg2);}
.store-photo img{width:100%;height:100%;object-fit:cover;}
@media(max-width:640px){.store-photo{width:100%;height:180px;}}
.store-actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.4rem;}
.store-link-internal{background:transparent;border:1px solid rgba(122,92,16,.4);color:var(--gold,#7a5c10);}
.store-link-internal:hover{background:rgba(122,92,16,.08);}
.store-name a{color:inherit;text-decoration:none;}
.store-name a:hover{color:var(--gold,#7a5c10);}
.faq-section{margin:2.4rem 0;padding:1.6rem;background:rgba(122,92,16,.04);border-left:3px solid var(--gold,#7a5c10);border-radius:0 4px 4px 0;}
.faq-section h2{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.4rem;margin-bottom:1.2rem;color:var(--text,#1c1c1a);}
.faq-section .faq-item{margin-bottom:1.2rem;padding-bottom:1.2rem;border-bottom:1px solid rgba(0,0,0,.08);}
.faq-section .faq-item:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}
.faq-section .faq-q{font-weight:500;margin-bottom:.5rem;color:var(--text,#1c1c1a);}
.faq-section .faq-q::before{content:'Q. ';color:var(--gold,#7a5c10);font-weight:600;}
.faq-section .faq-a{font-size:.92rem;line-height:1.8;color:rgba(28,28,26,.78);}
.faq-section .faq-a::before{content:'A. ';color:var(--gold,#7a5c10);font-weight:600;}`;

function ensurePhotoCSS(html) {
  if (html.includes('.store-photo')) return html;
  // </style> の直前に挿入
  return html.replace('</style>', PHOTO_CSS + '\n</style>');
}

// ─────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────
function readStores() {
  const html = fs.readFileSync(HTML, 'utf8');
  const match = html.match(/var LOCAL_STORES = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('LOCAL_STORES が見つかりません');
  return JSON.parse(match[1]);
}

function updateFeatureArticle(stores, config, faqMap) {
  const filePath = path.join(FEATURES_DIR, config.file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⏭ ${config.file}: ファイルなし（スキップ）`);
    return null;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // 1. フィルタ・重複排除・ソート
  let filtered = dedupWithChain(stores.filter(config.filter)).sort(config.sort);
  if (config.postFilter) filtered = config.postFilter(filtered);
  filtered = filtered.slice(0, config.count);
  if (filtered.length === 0) {
    console.log(`  ⚠ ${config.file}: 該当店舗0件（スキップ）`);
    return null;
  }

  // 2. 写真CSS追加
  html = ensurePhotoCSS(html);

  // 3. 店舗カードHTML生成
  const cardsHtml = filtered.map((s, i) => generateStoreCard(s, i, config)).join('\n\n');

  // 4. store-list を差し替え（汎用: store-listの開始タグから、最後のstore-cardの閉じタグまで）
  const storeListStart = html.indexOf('<div class="store-list">');
  if (storeListStart === -1) {
    console.log(`    ⚠ store-list が見つかりません`);
    return null;
  }
  // store-list 開始タグの次の行から、最後の store-card 閉じdivの後の </div>（= store-list閉じ）まで
  // store-list の閉じタグを探す: store-list開始後、store-card を全部含んだ最初の </div>\n    </div> or </div>\n  </div>
  const afterStart = storeListStart + '<div class="store-list">'.length;
  // store-list内の最後の </div> を見つける: 次の section-label, tips-box, related, </article>, </div>\n</article> のいずれかの前
  const endMarkers = ['<div class="tips-box" style', '<div class="related">', '</article>', '<div class="tips-box">'];
  let storeListEnd = -1;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, afterStart);
    if (idx !== -1 && (storeListEnd === -1 || idx < storeListEnd)) {
      storeListEnd = idx;
    }
  }
  if (storeListEnd === -1) storeListEnd = html.length;
  // storeListEndの手前にある </div> の位置を見つける（store-listの閉じタグ）
  const beforeEnd = html.lastIndexOf('</div>', storeListEnd);
  if (beforeEnd > afterStart) {
    // store-list 開始タグ + 中身 + 閉じタグ を差し替え
    const closingDiv = html.lastIndexOf('</div>', beforeEnd - 1);
    // シンプルに: store-list開始から endMarker直前の空白まで丸ごと差し替え
    const replaceEnd = storeListEnd;
    const prefix = html.substring(0, storeListStart);
    const suffix = html.substring(replaceEnd);
    html = prefix + `<div class="store-list">\n\n${cardsHtml}\n\n    </div>\n  </div>\n\n` + suffix;
  }

  // 5. ItemList JSON-LD を差し替え
  const itemListRe = /<script type="application\/ld\+json">\s*\{[^}]*"@type"\s*:\s*"ItemList"[\s\S]*?<\/script>/;
  if (html.match(itemListRe)) {
    html = html.replace(itemListRe,
      `<script type="application/ld+json">\n${generateItemListJsonLd(filtered, config)}\n</script>`
    );
  }

  // 6. FAQ 差し込み(data/feature_faqs.json に定義があれば)
  html = injectFAQ(html, config.file, faqMap || {});

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ✅ ${config.file}: ${filtered.length}件更新`);
  return filtered.length;
}

function updateFeaturesIndex(results) {
  const indexPath = path.join(FEATURES_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, 'utf8');
  for (const [file, count] of Object.entries(results)) {
    if (count === null) continue;
    const cardRe = new RegExp(
      `(href="${file}"[\\s\\S]*?<span class="card-count">)\\d+店掲載(<\\/span>)`,
    );
    html = html.replace(cardRe, `$1${count}店掲載$2`);
  }
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('  ✅ features/index.html: 店舗数を更新');
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** 店舗HTMLの og:image を正規表現抽出(parseエラー安全) */
function extractOgImage(html) {
  const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

/** journal HTML から公開日を抽出(YYYY-MM-DD) */
function extractJournalDate(filename, html) {
  const fnMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (fnMatch) return fnMatch[1];
  const metaMatch = html.match(/<meta\s+(?:property|name)=["'](?:article:published_time|date)["']\s+content=["']([^"']+)["']/i);
  if (metaMatch) return metaMatch[1].slice(0, 10);
  return '';
}

/** journal HTML からタイトルを抽出 */
function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/);
  if (!m) return '';
  return m[1].replace(/\s*[｜|]\s*.*$/, '').trim();
}

function updateSitemap(stores) {
  const today = new Date().toISOString().slice(0, 10);
  const baseUrl = 'https://nagoya-bites.com';

  // ──────────────────────────────────────────
  // 1. メイン sitemap.xml (URLリスト)
  // ──────────────────────────────────────────
  const urls = [
    { loc: `${baseUrl}/`, priority: '1.0', freq: 'weekly' },
    { loc: `${baseUrl}/about.html`, priority: '0.7', freq: 'monthly' },
    { loc: `${baseUrl}/contact.html`, priority: '0.6', freq: 'monthly' },
    { loc: `${baseUrl}/faq.html`, priority: '0.7', freq: 'monthly' },
  ];

  urls.push({ loc: `${baseUrl}/features/`, priority: '0.9', freq: 'weekly' });
  const featureFiles = fs.readdirSync(FEATURES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const f of featureFiles) {
    urls.push({ loc: `${baseUrl}/features/${f}`, priority: '0.8', freq: 'monthly' });
  }

  const journalDir = path.join(__dirname, 'journal');
  let journalFiles = [];
  if (fs.existsSync(journalDir)) {
    urls.push({ loc: `${baseUrl}/journal/`, priority: '0.9', freq: 'daily' });
    journalFiles = fs.readdirSync(journalDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html' && f !== '_template.html')
      .sort();
    for (const f of journalFiles) {
      urls.push({ loc: `${baseUrl}/journal/${f}`, priority: '0.7', freq: 'monthly' });
    }
  }

  const storesDir = path.join(__dirname, 'stores');
  let storeFiles = [];
  if (fs.existsSync(storesDir)) {
    storeFiles = fs.readdirSync(storesDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .sort();
    for (const f of storeFiles) {
      urls.push({ loc: `${baseUrl}/stores/${f}`, priority: '0.6', freq: 'monthly' });
    }
  }

  const mainSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), mainSitemap, 'utf8');

  // ──────────────────────────────────────────
  // 2. sitemap-images.xml — 店舗+特集の og:image を添付
  // ──────────────────────────────────────────
  const imageEntries = [];
  for (const f of storeFiles) {
    try {
      const html = fs.readFileSync(path.join(storesDir, f), 'utf8');
      const img = extractOgImage(html);
      if (img && /^https?:\/\//.test(img)) {
        imageEntries.push({ loc: `${baseUrl}/stores/${f}`, image: img });
      }
    } catch (e) { /* skip */ }
  }
  for (const f of featureFiles) {
    try {
      const html = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8');
      const img = extractOgImage(html);
      if (img && /^https?:\/\//.test(img)) {
        imageEntries.push({ loc: `${baseUrl}/features/${f}`, image: img });
      }
    } catch (e) { /* skip */ }
  }
  const imagesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${imageEntries.map(e => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <image:image>
      <image:loc>${escapeXml(e.image)}</image:loc>
    </image:image>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap-images.xml'), imagesSitemap, 'utf8');

  // ──────────────────────────────────────────
  // 3. sitemap-news.xml — 直近48時間以内の journal 記事のみ
  // ──────────────────────────────────────────
  const now = Date.now();
  const newsEntries = [];
  for (const f of journalFiles) {
    try {
      const html = fs.readFileSync(path.join(journalDir, f), 'utf8');
      const date = extractJournalDate(f, html);
      if (!date) continue;
      const t = Date.parse(date + 'T00:00:00+09:00');
      if (!Number.isFinite(t)) continue;
      if (now - t > 48 * 3600 * 1000) continue; // 48時間を超える記事は除外
      newsEntries.push({
        loc: `${baseUrl}/journal/${f}`,
        pubDate: date,
        title: extractTitle(html) || f.replace(/\.html$/, '')
      });
    } catch (e) { /* skip */ }
  }
  const newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsEntries.map(e => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>NAGOYA BITES</news:name>
        <news:language>ja</news:language>
      </news:publication>
      <news:publication_date>${e.pubDate}</news:publication_date>
      <news:title>${escapeXml(e.title)}</news:title>
    </news:news>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap-news.xml'), newsSitemap, 'utf8');

  // ──────────────────────────────────────────
  // 4. sitemap-index.xml — 3つのsitemapを束ねる
  // ──────────────────────────────────────────
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-images.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-news.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>
`;
  fs.writeFileSync(path.join(__dirname, 'sitemap-index.xml'), indexXml, 'utf8');

  console.log(`  ✅ sitemap.xml: 合計 ${urls.length}ページ(特集${featureFiles.length + 1}, journal${journalFiles.length}, 店舗${storeFiles.length})`);
  console.log(`  ✅ sitemap-images.xml: ${imageEntries.length}画像`);
  console.log(`  ✅ sitemap-news.xml: ${newsEntries.length}件(直近48h)`);
  console.log(`  ✅ sitemap-index.xml: 3 sub-sitemap`);
}

// ─────────────────────────────────────────────
function main() {
  console.log('特集記事を自動更新中...');
  console.log('');

  const stores = readStores();
  console.log(`データ読み込み: ${stores.length}件`);
  console.log('');

  const faqMap = loadFeatureFAQs();
  if (Object.keys(faqMap).length) {
    console.log(`FAQ定義ロード: ${Object.keys(faqMap).length}特集`);
  }

  const results = {};
  for (const config of FEATURE_CONFIGS) {
    results[config.file] = updateFeatureArticle(stores, config, faqMap);
  }

  // FEATURE_CONFIGS に載っていないが faqMap にある特集（mothers-day, gw-2026 等）に
  // FAQ だけを単発で差し込む
  const configFiles = new Set(FEATURE_CONFIGS.map(c => c.file));
  for (const featureFile of Object.keys(faqMap)) {
    if (configFiles.has(featureFile)) continue;
    const fp = path.join(__dirname, 'features', featureFile);
    if (!fs.existsSync(fp)) continue;
    let html = fs.readFileSync(fp, 'utf8');
    const updated = injectFAQ(html, featureFile, faqMap);
    if (updated !== html) {
      fs.writeFileSync(fp, updated, 'utf8');
      console.log(`  ✅ ${featureFile}: FAQ のみ差し込み (${faqMap[featureFile].length}件)`);
    }
  }

  console.log('');
  updateFeaturesIndex(results);
  updateSitemap(stores);

  console.log('');
  console.log('完了!');
}

main();
