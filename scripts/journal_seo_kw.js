'use strict';
/**
 * scripts/journal_seo_kw.js
 *
 * 日次ジャーナルの「入口（検索意図）」を担保するシーンKWレイヤー（SEO-011 / SEO-007 統合）。
 *
 * ============================================================================
 * なぜ要るのか（2026-07-27 実測）
 * ============================================================================
 * 公開済みジャーナル 73 本のタイトルを機械集計したところ:
 *   - シーンKW（接待/宴会/個室/デート/女子会 等）を含む : 9 本 (12%)
 *   - エリア語（名駅/栄/大須 等）を含む                 : 25 本 (34%)
 *   - 両方含む                                          :  2 本 ( 3%)
 * 一方 GSC のトップクエリ 25 件は全件が店名の指名検索で、Moat と宣言している
 * 「名古屋 × シーン × 業界人の目利き」の検索面はジャーナルから一切取れていない。
 *
 * 採点器（score_journal_candidates.js）には「誰かが検索する題材か」を見る次元が
 * 存在しなかったため、独自性・ブランド適合で高得点を取れる内輪向けタイトル
 * （例「夏、冷房が効きすぎる店・ちょうどいい店」）が構造的に選ばれ続けていた。
 *
 * ============================================================================
 * 設計方針（CLAUDE.md「品質ゲートを設計するときの原則」ISSUE-077 準拠）
 * ============================================================================
 * 1. 合否に効く入力は第三者が確認できるものだけにする。
 *    → KW は「自社に実在する特集記事」から取る。各 KW は必ず features/*.html の
 *      実ファイルに紐づき、`--verify` でファイル実在と <title> 内の語の一致を検証する。
 *      検索ボリュームのような外部ツール依存の未検証値は一切使わない。
 * 2. 主張させるのではなく証跡を出させる。
 *    → 「検索需要がある」と書かせるのではなく、実在する特集への内部リンク先を
 *      KW と一緒に返す。KW を使うこと自体が回遊導線の設置になる。
 * 3. エリア語の重みは実データ由来にする。
 *    → data/stores.json の実店舗件数から store_count を機械的に算出する（--build）。
 *
 * 使い方:
 *   node scripts/journal_seo_kw.js --build              # data/journal_seo_keywords.json を生成/更新
 *   node scripts/journal_seo_kw.js --verify             # 全KWの裏付け（特集の実在・語の一致）を検証
 *   node scripts/journal_seo_kw.js --check "<タイトル>" [--lead "<リード>"]
 *   node scripts/journal_seo_kw.js --suggest [--area 栄] [--genre 焼肉] [--month 12]
 *
 * 出力は常に JSON（stdout）。--verify は不整合があれば exit 1。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'features');
const STORES_PATH = path.join(ROOT, 'data', 'stores.json');
const OUT_PATH = path.join(ROOT, 'data', 'journal_seo_keywords.json');

// ============================================================
// 語彙定義（kw → 裏付けとなる実在特集）
// ここに書けるのは「features/ に実記事がある語」だけ。--verify が強制する。
// ============================================================

const SCENE_VOCAB = [
  { kw: '接待',     aliases: ['接待', '会食', 'ビジネスランチ'], feature: 'features/nagoya-settai-secret.html' },
  { kw: '個室',     aliases: ['個室'],                           feature: 'features/private-room.html' },
  { kw: '宴会',     aliases: ['宴会', '忘年会', '新年会'],       feature: 'features/banquet.html' },
  { kw: '大人数',   aliases: ['大人数', '20人'],                 feature: 'features/large-group.html' },
  { kw: 'デート',   aliases: ['デート'],                         feature: 'features/date.html' },
  { kw: '女子会',   aliases: ['女子会'],                         feature: 'features/girls-party.html' },
  { kw: '誕生日',   aliases: ['誕生日', '記念日'],               feature: 'features/birthday.html' },
  { kw: '一人飲み', aliases: ['一人飲み', 'カウンター', '立ち飲み'], feature: 'features/nagoya-solo-dining.html' },
  { kw: '顔合わせ', aliases: ['顔合わせ', '結納'],               feature: 'features/nagoya-kaoawase-washoku.html' },
  { kw: '接待ランチ', aliases: ['接待ランチ', '和食ランチ'],      feature: 'features/nagoya-settai-lunch.html' },
  { kw: '予約困難', aliases: ['予約困難', '予約が取れない'],      feature: 'features/hard-to-book.html' },
  { kw: 'コスパ',   aliases: ['コスパ'],                         feature: 'features/kospa-insider.html' },
  { kw: 'モーニング', aliases: ['モーニング', '喫茶'],            feature: 'features/nagoya-morning.html' },
  { kw: '食べ歩き', aliases: ['食べ歩き'],                       feature: 'features/osu-food-walk.html' },
  { kw: '業界人',   aliases: ['業界人', '飲食人'],               feature: 'features/industry-insiders-pick.html' }
];

// エリア語 → 実在するエリア特集。store_count は --build が data/stores.json から埋める。
const AREA_VOCAB = [
  { kw: '名駅',   aliases: ['名駅', '名古屋駅'],       feature: 'features/meieki.html',
    match: ['名古屋（名古屋駅/西区/中村区）', '名古屋駅', '名駅', '名古屋市中村区', '名古屋市西区'] },
  { kw: '栄',     aliases: ['栄', '錦'],               feature: 'features/sakae.html',
    match: ['栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄', '栄(ミナミ)/矢場町/大須/上前津', '栄', '名古屋市中区', '錦', '名古屋市中区錦', '名古屋市中区栄', '中区 栄', '丸の内', '新栄'] },
  { kw: '大須',   aliases: ['大須'],                   feature: 'features/osu-food-walk.html',
    match: ['大須'] },
  { kw: '覚王山', aliases: ['覚王山', '本山'],         feature: 'features/nagoya-kakuozan.html',
    match: ['本山・覚王山・藤が丘', '覚王山'] }
];

// ジャンル語 → 実在するジャンル特集
const GENRE_VOCAB = [
  { kw: '焼肉',   aliases: ['焼肉', 'ホルモン', '和牛'],   feature: 'features/nagoya-yakiniku.html' },
  { kw: '居酒屋', aliases: ['居酒屋'],                     feature: 'features/nagoya-izakaya.html' },
  { kw: '寿司',   aliases: ['寿司', '鮨'],                 feature: 'features/nagoya-sushi-guide.html' },
  { kw: 'ひつまぶし', aliases: ['ひつまぶし', 'うなぎ'],   feature: 'features/nagoya-hitsumabushi.html' },
  { kw: '焼き鳥', aliases: ['焼き鳥', '焼鳥'],             feature: 'features/nagoya-yakitori-guide.html' },
  { kw: 'ラーメン', aliases: ['ラーメン'],                 feature: 'features/nagoya-ramen.html' },
  { kw: '手羽先', aliases: ['手羽先'],                     feature: 'features/nagoya-tebasaki.html' },
  { kw: '味噌煮込みうどん', aliases: ['味噌煮込み'],       feature: 'features/nagoya-miso-nikomi-udon.html' },
  { kw: '韓国料理', aliases: ['韓国料理', 'サムギョプサル'], feature: 'features/nagoya-korean.html' },
  { kw: '海鮮',   aliases: ['海鮮', '刺身', '割烹'],       feature: 'features/nagoya-seafood.html' },
  { kw: 'イタリアン', aliases: ['イタリアン'],             feature: 'features/nagoya-italian-guide.html' },
  { kw: 'フレンチ', aliases: ['フレンチ', 'ビストロ'],     feature: 'features/nagoya-french-guide.html' },
  { kw: '中華',   aliases: ['中華', '餃子'],               feature: 'features/nagoya-chinese-guide.html' },
  { kw: 'バー',   aliases: ['バー', 'ワインバー', 'カクテル'], feature: 'features/nagoya-bar-guide.html' },
  { kw: 'カフェ', aliases: ['カフェ'],                     feature: 'features/nagoya-cafe.html' },
  { kw: 'スイーツ', aliases: ['スイーツ', 'かき氷', 'パフェ'], feature: 'features/nagoya-sweets.html' },
  { kw: 'とんかつ', aliases: ['とんかつ', '味噌かつ'],     feature: 'features/nagoya-tonkatsu.html' },
  { kw: 'すき焼き', aliases: ['すき焼き', 'しゃぶしゃぶ'], feature: 'features/nagoya-sukiyaki.html' },
  { kw: '鉄板焼き', aliases: ['鉄板焼き'],                 feature: 'features/nagoya-teppanyaki.html' },
  { kw: 'ステーキ', aliases: ['ステーキ'],                 feature: 'features/nagoya-steak.html' }
];

// 月 → その月に検索需要が立つシーン語（data/featured.json の monthlyScenes と同じ考え方）。
// 「その月にそのシーンの特集面を実際に出している」という運用事実に対応する。
const MONTHLY_SCENES = {
  1: ['新年会', '接待'], 2: ['デート', '個室'], 3: ['歓送迎会', '宴会'],
  4: ['歓迎会', '女子会'], 5: ['デート', '食べ歩き'], 6: ['接待', '個室'],
  7: ['ひつまぶし', '一人飲み'], 8: ['食べ歩き', 'スイーツ'], 9: ['接待', '会食'],
  10: ['デート', '記念日'], 11: ['宴会', '忘年会'], 12: ['忘年会', '大人数']
};

// ============================================================
// ユーティリティ
// ============================================================

function out(obj) { console.log(JSON.stringify(obj, null, 2)); }

function featureTitle(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const m = fs.readFileSync(abs, 'utf8').match(/<title>([^<]*)<\/title>/);
  return m ? m[1] : '';
}

function loadStores() {
  if (!fs.existsSync(STORES_PATH)) return [];
  const d = JSON.parse(fs.readFileSync(STORES_PATH, 'utf8'));
  return Array.isArray(d) ? d : (d.stores || []);
}

/** kw または alias のいずれかが text に現れるか */
function hitOf(entry, text) {
  const all = [entry.kw].concat(entry.aliases || []);
  return all.find(a => text.includes(a)) || null;
}

// ============================================================
// --verify : 全KWの裏付けを検証する（第三者が確認できることの担保）
// ============================================================

function cmdVerify() {
  const problems = [];
  const checked = [];

  const groups = [['scene', SCENE_VOCAB], ['area', AREA_VOCAB], ['genre', GENRE_VOCAB]];
  for (const [type, vocab] of groups) {
    for (const e of vocab) {
      const title = featureTitle(e.feature);
      if (title === null) {
        problems.push({ type, kw: e.kw, problem: 'feature_missing', feature: e.feature });
        continue;
      }
      // 特集タイトルに kw か alias が現れることを要求する（＝その語で書かれた実記事が在る証跡）
      const hit = hitOf(e, title);
      if (!hit) {
        problems.push({ type, kw: e.kw, problem: 'kw_not_in_feature_title', feature: e.feature, feature_title: title });
        continue;
      }
      checked.push({ type, kw: e.kw, feature: e.feature, matched_by: hit });
    }
  }

  const ok = problems.length === 0;
  out({ ok, checked: checked.length, problems });
  if (!ok) process.exit(1);
}

// ============================================================
// --build : data/journal_seo_keywords.json を生成
// ============================================================

function cmdBuild() {
  const stores = loadStores();
  const areas = AREA_VOCAB.map(a => {
    const count = stores.filter(s => (a.match || []).includes(s['エリア'])).length;
    return { kw: a.kw, aliases: a.aliases, feature: a.feature, store_count: count };
  }).sort((x, y) => y.store_count - x.store_count);

  const payload = {
    description:
      '日次ジャーナルの入口（検索意図）を担保するシーンKWマスタ。SEO-011（+SEO-007統合）。' +
      '各KWは features/ の実在記事に紐づき、scripts/journal_seo_kw.js --verify で' +
      '「特集ファイルが実在し、そのタイトルにその語が実際に使われている」ことを検証できる。' +
      '.claude/commands/journal-today.md は自己改変ブロックで編集できないため、' +
      'KW運用のルールはこのデータファイルと scripts/journal_seo_kw.js を単一の情報源とする。',
    updated: new Date().toISOString().slice(0, 10),
    related_issue: 'SEO-011 (SEO-007 統合)',
    evidence: {
      measured_on: '2026-07-27',
      published_titles_analyzed: 73,
      with_scene_kw: 9,
      with_area_kw: 25,
      with_both: 2,
      note:
        'GSC トップクエリ25件は全件が店名の指名検索で、シーンKWの検索面はジャーナルから' +
        '一切取れていなかった。採点器に「誰かが検索する題材か」を見る次元が無かったことが原因。'
    },
    rules: {
      title: 'タイトルに「エリア語」と「シーン語（またはジャンル語）」を最低1組ずつ入れる。語の詰め込み・煽りは不可。',
      internal_link: '使ったKWに紐づく特集へ本文から内部リンクを1本張る（KW利用がそのまま回遊導線になる）。',
      sns: 'docs/daily-posts/ の Note/Instagram/X 原稿の冒頭にも同じKW組を使い、入口の検索意図を揃える。',
      forbidden: '実在しない店・未検証店をKWに合わせて創作しない（架空店ブロック優先）。KWのためにタイトルの日本語を壊さない。'
    },
    areas,
    scenes: SCENE_VOCAB.map(s => ({ kw: s.kw, aliases: s.aliases, feature: s.feature })),
    genres: GENRE_VOCAB.map(g => ({ kw: g.kw, aliases: g.aliases, feature: g.feature })),
    monthly_scenes: MONTHLY_SCENES
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  out({
    ok: true,
    written: path.relative(ROOT, OUT_PATH),
    areas: areas.length,
    scenes: payload.scenes.length,
    genres: payload.genres.length,
    total_stores_scanned: stores.length
  });
}

// ============================================================
// --check : タイトル/リードの検索意図カバレッジを判定
// score_journal_candidates.js の search_intent 次元がこの関数を使う。
// ============================================================

function checkText(title, lead) {
  const t = String(title || '');
  const l = String(lead || '');
  const both = t + '\n' + l;

  const areaHit = AREA_VOCAB.map(e => ({ e, hit: hitOf(e, t) })).find(x => x.hit) || null;
  const sceneHit = SCENE_VOCAB.map(e => ({ e, hit: hitOf(e, t) })).find(x => x.hit) || null;
  const genreHit = GENRE_VOCAB.map(e => ({ e, hit: hitOf(e, t) })).find(x => x.hit) || null;

  // タイトルで取れなかった分をリード込みで拾う（部分点の根拠）
  const areaInLead = !areaHit && AREA_VOCAB.map(e => ({ e, hit: hitOf(e, both) })).find(x => x.hit) || null;
  const sceneInLead = !sceneHit && SCENE_VOCAB.map(e => ({ e, hit: hitOf(e, both) })).find(x => x.hit) || null;

  const linkTargets = [];
  [areaHit, sceneHit, genreHit].forEach(x => { if (x) linkTargets.push({ kw: x.e.kw, feature: x.e.feature }); });

  return {
    title_len: t.length,
    area: areaHit ? { kw: areaHit.e.kw, matched: areaHit.hit, feature: areaHit.e.feature } : null,
    scene: sceneHit ? { kw: sceneHit.e.kw, matched: sceneHit.hit, feature: sceneHit.e.feature } : null,
    genre: genreHit ? { kw: genreHit.e.kw, matched: genreHit.hit, feature: genreHit.e.feature } : null,
    area_in_lead_only: areaInLead ? areaInLead.e.kw : null,
    scene_in_lead_only: sceneInLead ? sceneInLead.e.kw : null,
    link_targets: linkTargets
  };
}

/**
 * search_intent スコア（0-10）。全て機械判定で、自己申告値は一切使わない。
 *   タイトルにエリア語        +4
 *   タイトルにシーン語        +4
 *   タイトルにジャンル語      +2（シーン語の代替として機能する）
 *   タイトルに無くリードにある場合は各 +1（部分点＝正直な中間解に逃げ道を用意する）
 * 上限 10。
 */
function scoreSearchIntent(title, lead) {
  const c = checkText(title, lead);
  let score = 0;
  const reasons = [];

  if (c.area) { score += 4; reasons.push(`タイトルにエリア語「${c.area.matched}」+4`); }
  else if (c.area_in_lead_only) { score += 1; reasons.push(`エリア語がリードのみ「${c.area_in_lead_only}」+1`); }
  else { reasons.push('エリア語なし → +0'); }

  if (c.scene) { score += 4; reasons.push(`タイトルにシーン語「${c.scene.matched}」+4`); }
  else if (c.scene_in_lead_only) { score += 1; reasons.push(`シーン語がリードのみ「${c.scene_in_lead_only}」+1`); }
  else { reasons.push('シーン語なし → +0'); }

  if (c.genre) { score += 2; reasons.push(`タイトルにジャンル語「${c.genre.matched}」+2`); }
  else { reasons.push('ジャンル語なし → +0'); }

  return { score: Math.min(10, score), reasons, coverage: c };
}

function cmdCheck(title, lead) {
  const r = scoreSearchIntent(title, lead);
  out({ ok: true, title, score: r.score, max: 10, reasons: r.reasons, coverage: r.coverage });
}

// ============================================================
// --suggest : 今日のKW組を提案
// ============================================================

function cmdSuggest(opts) {
  const stores = loadStores();
  const month = opts.month ? parseInt(opts.month, 10) : (new Date().getMonth() + 1);
  const monthScenes = MONTHLY_SCENES[month] || [];

  const areas = AREA_VOCAB.map(a => ({
    kw: a.kw, feature: a.feature,
    store_count: stores.filter(s => (a.match || []).includes(s['エリア'])).length
  })).sort((x, y) => y.store_count - x.store_count);

  const pickedArea = opts.area
    ? (areas.find(a => a.kw === opts.area || (AREA_VOCAB.find(v => v.kw === a.kw).aliases || []).includes(opts.area)) || areas[0])
    : areas[0];

  const genre = opts.genre
    ? GENRE_VOCAB.find(g => g.kw === opts.genre || (g.aliases || []).includes(opts.genre))
    : null;

  // 当月シーンを優先し、無ければ汎用の強シーンを並べる
  const sceneOrder = SCENE_VOCAB.slice().sort((a, b) => {
    const am = monthScenes.some(s => [a.kw].concat(a.aliases || []).includes(s)) ? 0 : 1;
    const bm = monthScenes.some(s => [b.kw].concat(b.aliases || []).includes(s)) ? 0 : 1;
    return am - bm;
  });

  const combos = sceneOrder.slice(0, 4).map(s => ({
    title_kw: [pickedArea.kw, s.kw].concat(genre ? [genre.kw] : []),
    example_title_shape: `${pickedArea.kw}の${genre ? genre.kw : '店'}、${s.kw}で使うなら——<業界人視点の切り口>`,
    internal_links: [{ kw: pickedArea.kw, feature: pickedArea.feature }, { kw: s.kw, feature: s.feature }]
      .concat(genre ? [{ kw: genre.kw, feature: genre.feature }] : []),
    in_season: monthScenes.some(x => [s.kw].concat(s.aliases || []).includes(x))
  }));

  out({
    ok: true, month, monthly_scenes: monthScenes,
    area: pickedArea, genre: genre ? { kw: genre.kw, feature: genre.feature } : null,
    combos
  });
}

// ============================================================
// CLI
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };

  if (args.includes('--verify')) return cmdVerify();
  if (args.includes('--build')) return cmdBuild();
  if (args.includes('--check')) {
    const title = flag('--check');
    if (title === undefined) { out({ ok: false, error: '--check requires a title' }); process.exit(1); }
    return cmdCheck(title, flag('--lead') || '');
  }
  if (args.includes('--suggest')) {
    return cmdSuggest({ area: flag('--area'), genre: flag('--genre'), month: flag('--month') });
  }

  out({ ok: false, error: 'no subcommand', usage: ['--build', '--verify', '--check "<title>" [--lead "<lead>"]', '--suggest [--area X] [--genre Y] [--month M]'] });
  process.exit(1);
}

if (require.main === module) main();

module.exports = { scoreSearchIntent, checkText };
