/**
 * gas_scores.js
 * 各店舗の Google評価・Instagram投稿数 を自動取得してスプレッドシートに書き込む
 *
 * 【使い方】
 * 1. Google Apps Script エディタ（script.google.com）を開く
 * 2. このファイルの内容を貼り付ける
 * 3. 下記「設定」セクションにAPIキーを入力する
 * 4. runScores() を実行する
 *
 * 【必要なAPIキー】
 * - Google Places API キー:
 *     https://console.cloud.google.com/ → 「Places API」を有効化 → 認証情報でキー取得
 * - Instagram Graph API トークン（任意）:
 *     Meta for Developers でアプリ作成 → Instagram Basic Display API → アクセストークン取得
 */

'use strict';

// ================================================================
// 設定
// ================================================================
var SERPAPI_KEY           = 'YOUR_SERPAPI_KEY';  // ← SerpAPI のキーを入れる（無料・カード不要）
var INSTAGRAM_ACCESS_TOKEN = '';                  // ← Instagramトークン（空欄でスキップ）
var SEARCH_AREA = '名古屋';                        // 検索時に店名に付加するエリア名

// スプレッドシートの列名
var COL_NAME         = '店名';
var COL_GOOGLE_SCORE = 'Google評価';
var COL_IG_COUNT     = 'Instagram投稿数';

// ================================================================
// メイン処理
// ================================================================
function runScores() {
  var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];

  var nameCol    = headers.indexOf(COL_NAME);
  var googleCol  = ensureColumn(sheet, headers, COL_GOOGLE_SCORE);
  var igCol      = ensureColumn(sheet, headers, COL_IG_COUNT);

  if (nameCol < 0) {
    SpreadsheetApp.getUi().alert('「' + COL_NAME + '」列が見つかりません');
    return;
  }

  var props    = PropertiesService.getScriptProperties();
  var startRow = parseInt(props.getProperty('scoresLastRow') || '1', 10);
  var BATCH    = 10;
  var count    = 0;
  var i;

  for (i = startRow; i < data.length; i++) {
    var name = String(data[i][nameCol] || '').trim();
    if (!name) continue;

    // すでに両方埋まっていればスキップ
    var existingGoogle = String(data[i][googleCol] || '').trim();
    var existingIg     = String(data[i][igCol]     || '').trim();
    if (existingGoogle && existingIg) continue;

    if (count >= BATCH) break;

    Logger.log('[' + i + '] ' + name);

    // Google評価を取得
    if (!existingGoogle && SERPAPI_KEY !== 'YOUR_SERPAPI_KEY') {
      var gScore = fetchGoogleRating(name);
      if (gScore !== null) {
        sheet.getRange(i + 1, googleCol + 1).setValue(gScore);
        Logger.log('  Google: ' + gScore);
      } else {
        Logger.log('  Google: 見つからず');
      }
      Utilities.sleep(200);
    }

    // Instagram投稿数を取得（トークンがある場合のみ）
    if (!existingIg && INSTAGRAM_ACCESS_TOKEN) {
      var igCount = fetchInstagramCount(name);
      if (igCount !== null) {
        sheet.getRange(i + 1, igCol + 1).setValue(igCount);
        Logger.log('  Instagram: ' + igCount);
      }
      Utilities.sleep(300);
    }

    count++;
  }

  if (i >= data.length) {
    props.deleteProperty('scoresLastRow');
    SpreadsheetApp.getUi().alert('完了: ' + count + '件処理しました');
  } else {
    props.setProperty('scoresLastRow', String(i));
    SpreadsheetApp.getUi().alert(count + '件処理しました。残りがあります。もう一度 runScores を実行してください。');
  }
}

function resetScores() {
  PropertiesService.getScriptProperties().deleteProperty('scoresLastRow');
  SpreadsheetApp.getUi().alert('進捗をリセットしました');
}

// ================================================================
// SerpAPI（Google Maps 検索）
// 無料プラン: 100件/月、クレジットカード不要
// 登録: https://serpapi.com/users/sign_up
// ================================================================
function fetchGoogleRating(storeName) {
  try {
    var query = storeName + ' ' + SEARCH_AREA;
    var url = 'https://serpapi.com/search.json'
      + '?engine=google_maps'
      + '&q=' + encodeURIComponent(query)
      + '&hl=ja'
      + '&api_key=' + SERPAPI_KEY;

    var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var json = JSON.parse(res.getContentText());

    if (json.error) {
      Logger.log('  SerpAPI エラー: ' + json.error);
      return null;
    }

    var results = json.local_results;
    if (!results || results.length === 0) return null;

    var rating = results[0].rating;
    return rating ? String(rating) : null;

  } catch (e) {
    Logger.log('  SerpAPI エラー: ' + e.message);
    return null;
  }
}

// ================================================================
// Instagram Graph API（ハッシュタグ検索）
// ================================================================
function fetchInstagramCount(storeName) {
  try {
    // ハッシュタグIDを取得
    var tag     = storeName.replace(/\s+/g, '').replace(/[^\u3040-\u30FFぁ-ん一-鿞a-zA-Z0-9]/g, '');
    var hashUrl = 'https://graph.facebook.com/v19.0/ig_hashtag_search'
      + '?user_id=me'
      + '&q='           + encodeURIComponent(tag)
      + '&access_token=' + INSTAGRAM_ACCESS_TOKEN;

    var hashRes  = UrlFetchApp.fetch(hashUrl, { muteHttpExceptions: true });
    var hashJson = JSON.parse(hashRes.getContentText());

    if (!hashJson.data || !hashJson.data[0]) return null;
    var hashId = hashJson.data[0].id;

    // ハッシュタグのメディア数を取得
    var countUrl = 'https://graph.facebook.com/v19.0/' + hashId
      + '?fields=media_count'
      + '&access_token=' + INSTAGRAM_ACCESS_TOKEN;

    var countRes  = UrlFetchApp.fetch(countUrl, { muteHttpExceptions: true });
    var countJson = JSON.parse(countRes.getContentText());

    var count = countJson.media_count;
    if (!count) return null;

    // 表示用に整形（例：12345 → "1.2万件"）
    if (count >= 10000) {
      return Math.round(count / 1000) / 10 + '万件';
    }
    return count.toLocaleString() + '件';

  } catch (e) {
    Logger.log('  Instagram エラー: ' + e.message);
    return null;
  }
}

// ================================================================
// ユーティリティ
// ================================================================
function ensureColumn(sheet, headers, colName) {
  var idx = headers.indexOf(colName);
  if (idx < 0) {
    idx = headers.length;
    sheet.getRange(1, idx + 1).setValue(colName);
    headers.push(colName); // ローカルのheadersも更新
    Logger.log('列「' + colName + '」を新規作成しました（列' + (idx + 1) + '）');
  }
  return idx;
}
