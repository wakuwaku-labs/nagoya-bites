'use strict';
/**
 * scripts/lib/trending_queries.js
 *
 * 「名古屋の話題の飲食店」発掘に使う検索クエリ一覧の単一の情報源。
 * scripts/fetch_trending_articles.js（手動運用のクエリ表示）と
 * scripts/trending_scout.js（自動ローテーション）の両方がここを参照する。
 * クエリを増減・修正したいときはこのファイルだけを編集すればよい。
 */

// 「第三者メディア」＝食べログでも我々でもない、中立な第三の媒体。
// 食べログ本体を直接スクレイピングせず、第三者メディアが食べログを「引用している」記事から店名を拾う。
const RECOMMENDED_QUERIES = [
  // === X / Twitter（最新性最優先） ===
  'site:x.com 名古屋 グルメ',
  'site:x.com 名古屋 行列',
  'site:x.com 名古屋 新店',
  'site:twitter.com 名古屋 飲食店',
  'site:twitter.com 名古屋 予約困難',

  // === Note / PR TIMES ===
  'site:note.com 名古屋 グルメ',
  'site:note.com 名古屋 新店',
  'site:prtimes.jp 名古屋 レストラン オープン',
  'site:prtimes.jp 名古屋 飲食 新店',

  // === 一般トレンド ===
  '名古屋 話題 飲食店 2026',
  '名古屋 新店 オープン',
  '名古屋 行列ができる店',
  '名古屋 予約 取れない',
  '名古屋 トレンド レストラン',
  '栄 話題の店',
  '名駅 新店 2026',

  // === グルメ雑誌・レビュー系 ===
  '名古屋 雑誌 掲載 レストラン',
  '名古屋 dressing 特集',
  '名古屋 マカロニ グルメ',
  '名古屋 ヒトサラ おすすめ',
  '名古屋 OZmall 特集',

  // === 名古屋ローカルメディア ===
  '名古屋 ナゴレコ 新店',
  'サブロー 名古屋 グルメ',
  '名古屋ジャーニー 特集',

  // === TV番組系 ===
  '東海テレビ グルメ 名古屋',
  'CBC 名古屋 紹介',
  'メ〜テレ 飲食店',
  'ケンミンショー 名古屋',

  // === 観光・まとめ系 ===
  '名古屋 retrip 人気',
  '名古屋 icotto おすすめ',
  '名古屋 MATCHA 訪日',
  '名古屋 tabi-labo グルメ',

  // === SNS話題系 ===
  '名古屋 TikTok 話題',
  '名古屋 インスタ映え カフェ',

  // === ニュース・PR系 ===
  '名古屋 オープン ニュース',

  // === シーン別 ===
  '名古屋 デート レストラン 雑誌',
  '名古屋 接待 おすすめ 特集'
];

// テーマ別・動的クエリテンプレート（suggest-queries で使用）
// {date_filter} には after:YYYY-MM-DD が入る
const QUERY_TEMPLATES = {
  today_one: [
    'site:x.com 名古屋 {genre} {date_filter}',
    'site:twitter.com 名古屋 {area} 新店 {date_filter}',
    'site:note.com 名古屋 {genre} {date_filter}',
    'site:prtimes.jp 名古屋 {genre} オープン {date_filter}',
    '名古屋 {area} 話題 {month}月',
    '名古屋 {genre} 行列 OR 予約困難 {date_filter}',
    '名古屋 {genre} おすすめ {month}月 {year}'
  ],
  weekly_digest: [
    'site:x.com 名古屋 グルメ 話題 {date_filter}',
    'site:note.com 名古屋 飲食 {date_filter}',
    'site:prtimes.jp 名古屋 飲食 {date_filter}',
    '名古屋 新店 {month}月 {year}',
    '名古屋 話題 飲食店 {month}月',
    '名古屋 行列 {date_filter}',
    'dressing OR macaroni 名古屋 特集 {year}'
  ],
  industry_insider: [
    '名古屋 飲食 業界 {genre}',
    '名古屋 予約 取り方 {genre}',
    '名古屋 接待 {genre} 業界人',
    'site:note.com 名古屋 飲食 業界',
    '名古屋 コース 価格 {genre} {year}',
    '名古屋 シェフ インタビュー {genre}'
  ],
  seasonal: [
    'site:x.com 名古屋 {season} {date_filter}',
    '名古屋 {season} 限定 {month}月',
    'site:note.com 名古屋 {season} {year}',
    '名古屋 {season} メニュー {year}',
    'site:prtimes.jp 名古屋 {season} {date_filter}'
  ],
  flexible: [
    'site:x.com 名古屋 グルメ {date_filter}',
    '名古屋 話題 飲食店 {month}月',
    'site:note.com 名古屋 {date_filter}',
    'site:prtimes.jp 名古屋 飲食 {date_filter}',
    '名古屋 新店 {month}月 {year}'
  ]
};

const RECOMMENDED_SITES = [
  // グルメ雑誌・レビュー系
  'https://dressing.media/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://macaro-ni.jp/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://www.hitosara.com/search/?area=nagoya',
  'https://www.ozmall.co.jp/restaurant/nagoya/',

  // トレンド紹介系
  'https://retrip.jp/articles/search/?query=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://icotto.jp/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',
  'https://matcha-jp.com/jp/search?q=%E5%90%8D%E5%8F%A4%E5%B1%8B',

  // ニュース・PR系
  'https://prtimes.jp/search?search_type=1&search_word=%E5%90%8D%E5%8F%A4%E5%B1%8B+%E9%A3%B2%E9%A3%9F',
  'https://news.livedoor.com/topics/keyword/?k=%E5%90%8D%E5%8F%A4%E5%B1%8B+%E3%82%B0%E3%83%AB%E3%83%A1',

  // TV番組公式
  'https://hicbc.com/gourmet/',

  // 観光協会系
  'https://www.nagoya-info.jp/eat/',

  // ブログ・note
  'https://note.com/search?context=note&q=%E5%90%8D%E5%8F%A4%E5%B1%8B+%E3%82%B0%E3%83%AB%E3%83%A1'
];

module.exports = { RECOMMENDED_QUERIES, QUERY_TEMPLATES, RECOMMENDED_SITES };
