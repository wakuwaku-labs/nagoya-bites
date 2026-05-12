#!/usr/bin/env node
/**
 * ISSUE-031: ロングテール独自KW 特集記事3本を生成する
 * - features/nagoya-industry-pick-izakaya.html
 * - features/nagoya-settai-secret.html
 * - features/nagoya-reservation-difficult.html
 *
 * 素材は data/editor_picks.json から抽出。
 * 業界人視点 (insiderNote / editorReason) を全面に出すロングテール記事。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const picks = require(path.join(ROOT, 'data', 'editor_picks.json')).stores;
const findStore = (name) => {
  const s = picks.find(s => s.店名 === name);
  if (!s) throw new Error(`Store not found in editor_picks.json: ${name}`);
  return s;
};

// 各特集の構成
const features = [
  {
    slug: 'nagoya-industry-pick-izakaya',
    eyebrow: '業界人コラム',
    titleHtml: '業界人が推薦する<em>名古屋の居酒屋</em>10選',
    titleText: '業界人が推薦する名古屋の居酒屋10選',
    titleH1Suffix: '【2026年版・現役飲食人の本音セレクト】',
    metaDesc: '名古屋（栄・金山・名駅）の居酒屋を、8ブランドを運営する現役飲食店経営者が業界視点で厳選10軒。仕入れ・席数設計・原価管理まで踏み込んだ業界人ならではの解説付き。',
    ogDesc: '8ブランドを運営する現役飲食人が、仕入れ・席数・原価管理まで踏み込んで名古屋の居酒屋10軒を厳選。業界の中の人にしか書けない目利きセレクト。',
    keywords: '名古屋 居酒屋 業界人,名古屋 居酒屋 おすすめ,名古屋 居酒屋 プロ,名古屋 居酒屋 飲食人,栄 居酒屋,名駅 居酒屋,金山 居酒屋',
    leadText: 'タベログのランキングでもホットペッパーの予約数でも見えない、「業界の中の人が本当に行きたい居酒屋」を10軒だけ選びました。仕入れの構造・席数設計・原価管理——表からは見えない店の実力を、現役の飲食人視点で言語化しています。',
    introText: '居酒屋という業態は、ジャンルが広いぶん「いい店」の定義が曖昧になりやすい。だからこそ業界の中の人は、料理の見栄えや口コミ件数よりも「仕入れの読み」「席数設計」「原価管理」といった見えない要素で店を評価します。今回は editor_picks に登録された100店から、業界目線で「正しい運営をしている」と判断できる10軒を選びました。',
    selectionCriteria: [
      'editor_picks に登録された100店からの抽出',
      '現役飲食店経営者の visited / desk リサーチに基づく評価',
      '仕入れ・席数・原価管理の3点で「再現性のある運営」と判断できる店',
      '広告掲載・タイアップなし（編集独立）',
    ],
    stores: [
      '台所 宗や 金山',
      'お晩菜と炭火焼き みかん 栄 錦 伏見店',
      '大衆割烹 八べゑ 錦３丁目店',
      '炭火焼 月光浴',
      '居酒屋 マグロ専門店 ぎょぎょ丸',
      '居酒屋 炭ス すみす 名古屋駅前店',
      'コモレビ　個室で味わう肴と日本酒',
      'サカナのハチベエ 矢場町店',
      '居酒屋 串焼き ちゃんぷ 金山 熱田店',
      '大衆酒場 むに 栄住吉店',
    ],
    insiderColumn: {
      title: '業界人の視点：居酒屋を「目利き」する3つの軸',
      body: [
        '1. <strong>仕入れの読み</strong> — 旬の食材を語る居酒屋は多いが、メニューの入れ替わり精度と素材説明の解像度を見ると本物かどうかわかる。仕入れルートが安定している店は、季節ごとのメニューが「定型化」せず常に揺れている。',
        '2. <strong>席数と回転率の設計</strong> — 小箱で回転を絞り鮮度を担保する店、大箱でスケールメリットを取る店、業態によって正解が違う。屋号に対して席数が合っていない店は、長続きしない。',
        '3. <strong>原価管理と価格バランス</strong> — 「大衆価格」を名乗りながら品質を落とさない店は、仕込みの工数管理と食材選定に必ず工夫がある。安いだけで品質が落ちる店は、3ヶ月で評価が崩れる。',
      ],
    },
    faqs: [
      { q: '名古屋の居酒屋で「業界人推薦」とはどういう意味ですか？', a: '広告掲載・タイアップなしで、現役の飲食店経営者が「自分も行きたい」「同業者に紹介できる」と判断した店を指します。Google評価や口コミ件数だけでなく、仕入れの読み・席数設計・原価管理など、業界の中の人にしかわからない要素で評価しています。' },
      { q: 'editor_picks に登録された100店は全部「業界人推薦」ですか？', a: 'はい。editor_picks に登録するには、現役飲食店経営者による editorReason（掲載判断の根拠）、mediaFeatures（他媒体掲載履歴）、insiderNote（業界人視点の解釈メモ）、visitStatus（visited / interview / desk）の4要素を満たす必要があります。本特集はそのうち居酒屋業態の10軒です。' },
      { q: 'タベログ・ホットペッパーのランキングとは何が違いますか？', a: 'タベログは匿名口コミの集積、ホットペッパーは予約数とクーポン経済が中心です。NAGOYA BITES は広告ゼロで、業界の中の人による解釈層（editorReason / insiderNote）を全店に付与しています。「なぜこの店が良いのか」を業界視点で説明できる点が違いです。' },
    ],
    related: [
      { href: 'nagoya-gourmet-guide.html', text: '📖 名古屋グルメ完全ガイド', primary: true },
      { href: 'nagoya-settai-secret.html', text: '失敗しない接待10選' },
      { href: 'nagoya-reservation-difficult.html', text: '予約困難店の見極め方' },
      { href: 'editorial-policy.html', text: '編集規約' },
      { href: 'index.html', text: '特集一覧' },
      { href: '../index.html', text: '全店舗を検索' },
    ],
  },
  {
    slug: 'nagoya-settai-secret',
    eyebrow: '業界人コラム — 接待・会食',
    titleHtml: '失敗しない<em>名古屋・接待</em>の店10選',
    titleText: '失敗しない名古屋・接待の店10選',
    titleH1Suffix: '【2026年版・業界人が選ぶ会食の正解】',
    metaDesc: '名古屋で接待・会食に失敗したくない人へ。現役飲食店経営者が「ここなら大丈夫」と判断した10軒を、個室の使い勝手・煙対策・接客トーンまで業界視点で解説。',
    ogDesc: '名古屋で接待・会食に失敗しないための10軒。個室・煙対策・接客トーンを業界視点で解説。広告掲載なし、現役飲食人による本気のセレクト。',
    keywords: '名古屋 接待 失敗しない,名古屋 接待 個室,名古屋 会食 おすすめ,名駅 接待,栄 接待,名古屋 接待 焼肉,名古屋 接待 和食',
    leadText: '接待で失敗する店には共通点があります。煙が籠る、隣の声が聞こえる、料理の出る速度が読めない——。逆に「失敗しない店」は、煙対策・防音設計・接客トーンの3点で必ず安心が担保されています。本特集は、それを業界の中の人視点で確認できた10軒です。',
    introText: '接待・会食でこちらが緊張するのは、自分の好みではなく「相手にとっての快適さ」を読まなければならないから。料理の旨さは大前提として、空間と接客の安心感がなければ取引先には勧められません。今回は editor_picks から、接待利用者の高評価を持続できている10軒を選びました。',
    selectionCriteria: [
      '完全個室または半個室を確実に予約できる業態',
      '煙対策（無煙ロースター・換気設備）が機能している',
      '接客トーンが業態コンセプトと一致している',
      '取引先・上司・年配の方にも勧められる落ち着き',
    ],
    stores: [
      'サザンクラウン',
      '炉端焼き 燻銀 伏見店',
      '個室×夜カフェ  FYN フィン 栄店',
      '焼肉ホタル 栄東店',
      '鉄板焼肉3G スリージー',
      'ときわ屋 名古屋駅西口店',
      '焼肉 LAVA 29',
      'しゃぶしゃぶ雅 栄 伏見',
      '焼肉苑 万大 錦店',
      '炭ス 栄錦店',
    ],
    insiderColumn: {
      title: '業界人の視点：接待で失敗しないための3つの読み',
      body: [
        '1. <strong>煙対策と防音設計</strong> — 焼肉・炉端の接待店で煙が籠る・服に匂いがつくと、取引先の心象が落ちる。無煙ロースター導入店と、個室の防音工事ができている店は初期投資が大きいぶん、価格に上乗せされている。それを支払う価値があるシーンで使う。',
        '2. <strong>個室の「完全度」</strong> — 「個室あり」と「完全個室」は別物。襖一枚の半個室では隣の声が確実に聞こえる。商談の機密性が必要な接待では、完全個室を予約段階で必ず確認する。電話で「接待で使う」と伝えると個室の調整がきく店が多い。',
        '3. <strong>接客のトーン</strong> — 接客が騒がしすぎる店、逆に淡白すぎる店は接待に向かない。業態コンセプト（高級和食 / 鉄板焼肉 / 創作料理）と接客トーンが一致している店は、取引先のレベル感に応じて選び分けられる。',
      ],
    },
    faqs: [
      { q: '名古屋で接待・会食におすすめのエリアは？', a: '栄・伏見エリアが最も選択肢が豊富です。名駅は出張対応がしやすく、金山は名古屋・中部空港の双方からアクセス可能で送迎にも便利です。取引先の宿泊先と移動距離を基準に選ぶのが基本です。' },
      { q: '完全個室は予約時に必ず確保できますか？', a: '店によります。本特集の10軒は「完全個室を確実に予約できる」ことを掲載基準にしていますが、繁忙期は埋まりやすいため、接待利用なら2〜3週間前の予約が安全です。電話で「接待で使う」と伝えると、個室の確保や時間調整に協力してくれる店が多いです。' },
      { q: '接待で焼肉店は失礼ではないですか？', a: '取引先の年代と関係性によります。役員クラスや初回会食では和食・創作料理が無難ですが、フランクな関係の取引先や2回目以降なら焼肉も選択肢に入ります。本特集の焼肉4軒は無煙ロースター・完全個室・接客トーンの3点が揃っており、接待での失敗リスクが低い店です。' },
    ],
    related: [
      { href: 'nagoya-gourmet-guide.html', text: '📖 名古屋グルメ完全ガイド', primary: true },
      { href: 'banquet.html', text: '宴会・忘年会15選' },
      { href: 'private-room.html', text: '個室居酒屋10選' },
      { href: 'nagoya-industry-pick-izakaya.html', text: '業界人推薦の居酒屋' },
      { href: 'editorial-policy.html', text: '編集規約' },
      { href: '../index.html', text: '全店舗を検索' },
    ],
  },
  {
    slug: 'nagoya-reservation-difficult',
    eyebrow: '業界人コラム — 予約困難の理由',
    titleHtml: '名古屋・<em>予約困難店</em>の見極め方ガイド',
    titleText: '名古屋・予約困難店の見極め方ガイド',
    titleH1Suffix: '【2026年版・業界人が語る人気店の構造】',
    metaDesc: 'なぜこの店は予約困難なのか? 業界の中の人が、席数設計・回転率・SNS拡散の3要素で名古屋の予約困難店10軒を解剖。「行く価値のある店」と「単に話題な店」の見極め方つき。',
    ogDesc: '名古屋の予約困難店、その理由を業界人が解剖。席数設計・回転率・SNS拡散の3要素で10軒を解説。「行く価値のある店」の見極め方。',
    keywords: '名古屋 予約困難,名古屋 予約困難 居酒屋,名古屋 人気店 予約,名古屋 取れない店,栄 予約困難,名駅 予約困難,名古屋 行列',
    leadText: '「予約が取れない店」には3パターンあります。①席数が物理的に少ない、②SNSで話題化して一時的に集中、③固定客が回転を埋めている。①と③は本物、②は3ヶ月で落ち着くケースが多い——。本特集は、業界の中の人が「行く価値がある」と判断した予約困難店10軒の構造を解剖します。',
    introText: '予約困難店は名古屋にも数多くありますが、その「困難さ」の中身を業界視点で見ると、行く価値があるかどうかが見極められます。席数20席のカウンター店、SNSで一気に拡散した新店、地元固定客が回し続ける名店——タイプ別に「何を期待して行くべきか」が変わるからです。今回は editor_picks から、業界人として「困難でも行く価値がある」と判断した10軒を解説します。',
    selectionCriteria: [
      'Google評価4.7以上または食べログ4.8以上を継続維持',
      '席数・回転率・SNS拡散の3要素のうち少なくとも2つが希少性に寄与',
      '業界人が「行く価値がある」と判断できる運営力',
      '一時的なブームではなく、6ヶ月以上の高評価維持',
    ],
    stores: [
      '京都焼肉なおき',
      '鮨食人 五と二 栄店',
      '焼肉まる源',
      'wakamaru ワカマル 栄店',
      '焼き肉 夏恋',
      '焼肉酒場 番長',
      '隠れ家イタリアンDime ダイム',
      '居酒屋いくなら俺んち来い。　金山店',
      '焼鳥 串っ子',
      '焼肉韓国キッチン 琉球庵',
    ],
    insiderColumn: {
      title: '業界人の視点：予約困難店を「構造」で読み解く3要素',
      body: [
        '1. <strong>席数 × 回転率の物理</strong> — カウンター10席の鮨店が1日2回転=20席しか売れないなら、月の取り扱い席数は600席が上限。そこに常連客と一見客が混在すれば、一見客に空きが出るのは月数席のみ。これは「物理的予約困難」で、いつ行っても価値は安定している。',
        '2. <strong>SNS拡散による一時的需要集中</strong> — TikTok・Instagram で1投稿が拡散すると、3ヶ月は予約困難になる店がある。これは「一時的予約困難」で、半年後には落ち着くことが多い。逆に拡散が落ち着いても評価が維持される店は、本物の実力店。',
        '3. <strong>固定客の回転による埋まり</strong> — 地元の固定客が週1〜2回のペースで回している店は、新規客への席が常に少ない。これは店側にとって最も理想的な状態で、料理・接客の品質が長期的に担保されている証拠。本特集の10軒のうち、固定客型が最多。',
      ],
    },
    faqs: [
      { q: '名古屋の予約困難店、どのくらい前に予約すべきですか？', a: '店のタイプによります。物理的予約困難（カウンター10席以下）の店は1〜2ヶ月前、SNS拡散型は3週間前、固定客型は2週間前が目安です。本特集の10軒はそれぞれタイプが違うので、店ごとの個別記述を参考にしてください。' },
      { q: '予約困難店に「行く価値があるか」を見極める方法は？', a: '①店の席数（少ないほど物理的予約困難=価値安定）、②高評価維持期間（6ヶ月以上なら本物）、③メディア掲載歴（業界メディアの掲載は信頼指標）の3点を確認します。NAGOYA BITES の editor_picks では mediaFeatures に他媒体掲載歴を記録しているので、参考になります。' },
      { q: 'SNSで話題の新店、行くべきタイミングは？', a: 'オープン直後の3ヶ月以内か、ブームが落ち着いた6ヶ月後の2択がおすすめです。オープン直後は「初動の本気」が見えるタイミング、6ヶ月後は「本物の実力」が残るタイミング。間の3〜6ヶ月は予約困難なうえに店側もオペレーションが追いつかず、体験品質が安定しない場合があります。' },
    ],
    related: [
      { href: 'nagoya-gourmet-guide.html', text: '📖 名古屋グルメ完全ガイド', primary: true },
      { href: 'nagoya-industry-pick-izakaya.html', text: '業界人推薦の居酒屋' },
      { href: 'nagoya-settai-secret.html', text: '失敗しない接待10選' },
      { href: 'editorial-policy.html', text: '編集規約' },
      { href: 'index.html', text: '特集一覧' },
      { href: '../index.html', text: '全店舗を検索' },
    ],
  },
];

// 共通スタイル（nagoya-lunch-washoku.html と同一）
const STYLE = `:root{--bg:#f7f5f1;--bg2:#eeebe5;--surface:#e5e2db;--border:rgba(0,0,0,0.1);--border-h:rgba(0,0,0,0.28);--text:#1c1c1a;--muted:rgba(28,28,26,0.6);--dim:rgba(28,28,26,0.38);--gold:#7a5c10;--gold2:#96720f;--white:#0a0a08;}*{margin:0;padding:0;box-sizing:border-box;}html{scroll-behavior:smooth;}body{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;}header{position:sticky;top:0;z-index:200;padding:0 1.5rem;height:56px;display:flex;align-items:center;justify-content:space-between;background:rgba(247,245,241,.96);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}.logo{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:1.2rem;letter-spacing:.35em;color:var(--white);text-transform:uppercase;text-decoration:none;}.logo em{font-style:italic;color:var(--gold);}nav{display:flex;gap:1.5rem;align-items:center;}nav a{font-size:.68rem;letter-spacing:.16em;color:var(--muted);text-decoration:none;text-transform:uppercase;transition:color .2s;}nav a:hover,nav a.active{color:var(--text);}.breadcrumb{padding:.6rem 1.5rem;font-family:'DM Mono',monospace;font-size:.56rem;letter-spacing:.1em;color:var(--dim);max-width:800px;margin:0 auto;}.breadcrumb a{color:var(--dim);text-decoration:none;}.breadcrumb a:hover{color:var(--gold);}.breadcrumb span{margin:0 .4rem;}.art-hero{padding:3rem 1.5rem 2.5rem;max-width:800px;margin:0 auto;}.art-eyebrow{font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.28em;color:var(--gold);text-transform:uppercase;margin-bottom:1.2rem;}.art-title{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(1.9rem,4vw,3rem);line-height:1.2;color:var(--white);margin-bottom:1rem;}.art-title em{font-style:italic;color:var(--gold);}.art-meta{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.12em;color:var(--dim);margin-bottom:1.5rem;display:flex;gap:1.2rem;flex-wrap:wrap;}.art-lead{font-size:.88rem;line-height:2;color:var(--muted);max-width:680px;border-left:2px solid var(--gold);padding-left:1.2rem;}.art-body{max-width:800px;margin:0 auto;padding:0 1.5rem 4rem;}.section-label{font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.26em;color:var(--dim);text-transform:uppercase;margin:2.5rem 0 .8rem;}.art-intro{font-size:.85rem;line-height:2;color:var(--muted);margin-bottom:2rem;}.store-list{display:flex;flex-direction:column;gap:1.5rem;}.store-card{background:#fff;border:0.5px solid #D3D1C7;border-radius:6px;padding:1.4rem;display:flex;gap:1.2rem;align-items:flex-start;transition:box-shadow .2s;}.store-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.1);}.store-num{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:2.2rem;color:var(--gold);opacity:.6;line-height:1;min-width:2rem;text-align:center;}.store-info{flex:1;}.store-name{font-family:'Noto Sans JP',sans-serif;font-weight:600;font-size:1rem;color:var(--white);margin-bottom:.4rem;}.store-badge{display:inline-block;font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.12em;color:#fff;background:var(--gold);padding:.1rem .4rem;border-radius:2px;margin-left:.4rem;vertical-align:middle;}.store-meta{display:flex;gap:.6rem;flex-wrap:wrap;font-family:'DM Mono',monospace;font-size:.58rem;letter-spacing:.08em;color:var(--dim);margin-bottom:.6rem;}.store-desc{font-size:.8rem;line-height:1.8;color:var(--muted);margin-bottom:.6rem;}.insider-quote{font-size:.78rem;line-height:1.8;color:var(--muted);font-style:italic;border-left:2px solid var(--gold);padding:.2rem .8rem;margin:.4rem 0;background:rgba(122,92,16,.04);}.media-features{font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.06em;color:var(--dim);margin-top:.4rem;}.store-tags{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem;}.store-tag{font-family:'DM Mono',monospace;font-size:.54rem;letter-spacing:.08em;padding:.18rem .5rem;border:1px solid rgba(122,92,16,.3);color:var(--gold);border-radius:2px;}.tips-box{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--gold);padding:1.2rem 1.4rem;border-radius:0 4px 4px 0;margin:2rem 0;}.tips-title{font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.2em;color:var(--gold);text-transform:uppercase;margin-bottom:.6rem;}.tips-box p{font-size:.8rem;line-height:1.9;color:var(--muted);}.tips-box ul{padding-left:1.2rem;}.tips-box li{font-size:.8rem;line-height:1.9;color:var(--muted);}.column{background:#fff;border:0.5px solid #D3D1C7;border-radius:6px;padding:1.6rem;margin:2.5rem 0;}.column-title{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.2rem;color:var(--white);margin-bottom:1rem;}.column-body p{font-size:.82rem;line-height:1.9;color:var(--muted);margin-bottom:.8rem;}.column-body strong{color:var(--gold);font-weight:500;}.faq-section{max-width:800px;margin:0 auto;padding:0 1.5rem 3rem;}.faq-title{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:1.4rem;color:var(--white);margin-bottom:1.5rem;}.faq-item{border-bottom:1px solid var(--border);padding:1.2rem 0;}.faq-q{font-weight:500;font-size:.85rem;color:var(--white);margin-bottom:.6rem;}.faq-q::before{content:'Q. ';color:var(--gold);}.faq-a{font-size:.82rem;line-height:1.9;color:var(--muted);}.faq-a::before{content:'A. ';color:var(--gold);font-weight:500;}.related{background:var(--bg2);border-top:1px solid var(--border);padding:2.5rem 1.5rem;text-align:center;}.related-title{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:1.3rem;color:var(--white);margin-bottom:1.2rem;}.related-links{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;}.related-link{font-size:.78rem;color:var(--gold);text-decoration:none;border:1px solid rgba(122,92,16,.35);padding:.5rem 1.1rem;border-radius:2px;transition:background .2s;}.related-link:hover{background:rgba(122,92,16,.08);}footer{background:var(--white);color:rgba(247,245,241,.5);padding:1.8rem 1.5rem;text-align:center;font-family:'DM Mono',monospace;font-size:.56rem;letter-spacing:.14em;}footer a{color:rgba(201,169,110,.7);text-decoration:none;}@media(max-width:640px){.store-card{flex-direction:column;gap:.7rem;}.store-num{font-size:1.4rem;}nav{gap:1rem;}nav a{font-size:.6rem;}}`;

const GA_SCRIPT = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-3LCZNGZPWJ"></script>
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}(function(){var p=new URLSearchParams(location.search);if(p.get('nb_owner')==='1'){localStorage.setItem('nb_internal','1');history.replaceState(null,'',location.pathname);}if(localStorage.getItem('nb_internal')==='1'){gtag('js',new Date());gtag('config','G-3LCZNGZPWJ',{traffic_type:'internal'});}else{gtag('js',new Date());gtag('config','G-3LCZNGZPWJ');}})();function trackEvent(name,params){if(localStorage.getItem('nb_internal')==='1')return;if(typeof gtag==='function')gtag('event',name,params||{});}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(href))return;try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);
</script>`;

const renderStoreCard = (idx, store) => {
  const media = (store.mediaFeatures || []).map(m => `${m.name}${m.year?'（'+m.year+'）':''}`).join(' / ');
  const mediaHtml = media ? `<p class="media-features">📰 掲載歴: ${media}</p>` : '';
  const insiderHtml = store.insiderNote ? `<p class="insider-quote">業界人ノート: ${store.insiderNote}</p>` : '';
  const visitBadge = store.visitStatus === 'visited' ? '<span class="store-badge">編集部訪問済</span>' : store.visitStatus === 'interview' ? '<span class="store-badge">取材済</span>' : '';
  return `      <div class="store-card">
        <div class="store-num">${idx + 1}</div>
        <div class="store-info">
          <div class="store-name">${store.店名}${visitBadge}</div>
          <div class="store-meta">
            <span>${store.エリア}</span>
            <span>業界人推薦</span>
          </div>
          <p class="store-desc">${store.editorReason}</p>
          ${insiderHtml}
          ${mediaHtml}
        </div>
      </div>`;
};

const renderHTML = (feature) => {
  const today = '2026-05-08';
  const url = `https://nagoya-bites.com/features/${feature.slug}.html`;
  const storeList = feature.stores.map(name => findStore(name));
  const itemList = storeList.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.店名 }));
  const faqList = feature.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));

  const articleJson = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: feature.titleText + ' ' + feature.titleH1Suffix,
    description: feature.metaDesc,
    author: { '@type': 'Organization', name: 'NAGOYA BITES' },
    publisher: { '@type': 'Organization', name: 'NAGOYA BITES', url: 'https://nagoya-bites.com/' },
    url, datePublished: today, dateModified: today,
  });
  const itemListJson = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'ItemList', name: feature.titleText,
    numberOfItems: storeList.length, itemListElement: itemList,
  });
  const breadcrumbJson = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'NAGOYA BITES', item: 'https://nagoya-bites.com/' },
      { '@type': 'ListItem', position: 2, name: '特集記事', item: 'https://nagoya-bites.com/features/' },
      { '@type': 'ListItem', position: 3, name: feature.titleText },
    ],
  });
  const faqJson = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqList });

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<!-- Google Analytics 4 -->
${GA_SCRIPT}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${feature.titleText}【2026年版】｜NAGOYA BITES</title>
<meta name="description" content="${feature.metaDesc}">
<meta name="keywords" content="${feature.keywords}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${feature.titleText}【2026年版】｜NAGOYA BITES">
<meta property="og:description" content="${feature.ogDesc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="NAGOYA BITES">
<meta property="og:image" content="https://nagoya-bites.com/icons/icon-512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Sans+JP:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">
<script type="application/ld+json">${articleJson}</script>
<script type="application/ld+json">${itemListJson}</script>
<script type="application/ld+json">${breadcrumbJson}</script>
<script type="application/ld+json">${faqJson}</script>
<style>${STYLE}</style>
</head>
<body>
<header>
  <a class="logo" href="../index.html">Nagoya <em>Bites</em></a>
  <nav>
    <a href="../index.html">すべての店舗</a>
    <a href="index.html" class="active">特集</a>
    <a href="../journal/index.html">Journal</a>
    <a href="../about.html">About</a>
  </nav>
</header>

<nav aria-label="パンくずリスト">
  <div class="breadcrumb">
    <a href="../index.html">NAGOYA BITES</a>
    <span>›</span>
    <a href="index.html">特集記事</a>
    <span>›</span>
    ${feature.titleText}
  </div>
</nav>

<article>
  <div class="art-hero">
    <p class="art-eyebrow">Feature — ${feature.eyebrow}</p>
    <h1 class="art-title">${feature.titleHtml}<br><small style="font-size:.55em;letter-spacing:.05em;">${feature.titleH1Suffix}</small></h1>
    <div class="art-meta">
      <span>${today.replace(/-/g, '年').replace(/年(\d+)年/, '年$1月').replace(/年(\d+)$/, '日').replace('日日', '日')} 公開</span>
      <span>掲載${storeList.length}軒</span>
      <span>編集独立・広告ゼロ</span>
    </div>
    <p class="art-lead">${feature.leadText}</p>
  </div>

  <div class="art-body">
    <div class="tips-box">
      <p class="tips-title">Editor's Note — この特集の選定基準</p>
      <ul>
${feature.selectionCriteria.map(c => `        <li>${c}</li>`).join('\n')}
      </ul>
    </div>

    <p class="art-intro">${feature.introText}</p>

    <p class="section-label">01 — 厳選${storeList.length}軒</p>
    <div class="store-list">

${storeList.map((s, i) => renderStoreCard(i, s)).join('\n\n')}

    </div><!-- /store-list -->

    <div class="column">
      <h2 class="column-title">${feature.insiderColumn.title}</h2>
      <div class="column-body">
${feature.insiderColumn.body.map(p => `        <p>${p}</p>`).join('\n')}
      </div>
    </div>

  </div>
</article>

<section class="faq-section">
  <h2 class="faq-title">よくある質問</h2>
${feature.faqs.map(f => `  <div class="faq-item">
    <p class="faq-q">${f.q}</p>
    <p class="faq-a">${f.a}</p>
  </div>`).join('\n')}
</section>

<div class="related">
  <p class="related-title">関連する特集</p>
  <div class="related-links">
${feature.related.map(r => `    <a class="related-link" href="${r.href}"${r.primary ? ' style="background:rgba(122,92,16,.08);border-color:var(--gold);font-weight:500;"' : ''}>${r.text}</a>`).join('\n')}
  </div>
</div>

<footer>
  <p>© 2026 <a href="../index.html">NAGOYA BITES</a> — 名古屋の飲食人による目利きメディア</p>
</footer>
</body>
</html>
`;
};

// 生成
for (const f of features) {
  const html = renderHTML(f);
  const out = path.join(ROOT, 'features', `${f.slug}.html`);
  fs.writeFileSync(out, html);
  console.log(`✓ ${out}`);
}
console.log('Done.');
