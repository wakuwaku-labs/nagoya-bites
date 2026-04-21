var HOTPEPPER_KEY = 'c4b06501b849309a';
var SHEET_NAME = '店舗データ';
var BATCH_SIZE = 10;

function runTagging() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = headers.indexOf('店名');
  var tagCol = headers.indexOf('タグ');

  if (tagCol < 0) {
    tagCol = headers.length;
    sheet.getRange(1, tagCol + 1).setValue('タグ');
  }

  var props = PropertiesService.getScriptProperties();
  var startRow = parseInt(props.getProperty('lastRow') || '1', 10);
  var count = 0;
  var i;

  for (i = startRow; i < data.length; i++) {
    var name = String(data[i][nameCol] || '').trim();
    if (!name) continue;
    var tag = String(data[i][tagCol] || '').trim();
    if (tag && tag !== '要確認' && tag !== '手動確認') continue;
    if (count >= BATCH_SIZE) break;

    var result = getTagsFromHotpepper(name);
    sheet.getRange(i + 1, tagCol + 1).setValue(result || '手動確認');
    count++;
    Utilities.sleep(300);
  }

  if (i >= data.length) {
    props.deleteProperty('lastRow');
    SpreadsheetApp.getUi().alert('全件完了: ' + count + '件処理しました');
  } else {
    props.setProperty('lastRow', String(i));
    SpreadsheetApp.getUi().alert(count + '件処理しました。残りがあります。もう一度runTaggingを実行してください');
  }
}

function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty('lastRow');
  SpreadsheetApp.getUi().alert('リセットしました');
}

function getTagsFromHotpepper(name) {
  try {
    var url = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=' + HOTPEPPER_KEY + '&name=' + encodeURIComponent(name) + '&count=1&format=json';
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var json = JSON.parse(res.getContentText());
    var shops = json.results && json.results.shop;
    if (!shops || shops.length === 0) return null;

    var shop = shops[0];
    var tags = [];
    var memo = [shop.other_memo || '', shop.shop_detail_memo || '', shop.catch || '', shop.access || ''].join(' ');

    if (shop.private_room === '1') tags.push('個室');
    if (memo.indexOf('半個室') >= 0) tags.push('半個室');
    if (memo.indexOf('カウンター') >= 0) tags.push('カウンター');
    if (shop.tatami === '1' || shop.horigotatsu === '1') tags.push('座敷');
    if (shop.open_air === '1' || memo.indexOf('テラス') >= 0) tags.push('テラス席');
    if (memo.indexOf('隠れ家') >= 0) tags.push('隠れ家');
    if (shop.charter && (shop.charter.code === 'charter1' || shop.charter.code === 'charter3')) tags.push('貸切可');

    if (shop.private_room === '1') tags.push('デート');
    if (memo.indexOf('女子会') >= 0) tags.push('女子会');
    if (memo.indexOf('接待') >= 0) tags.push('接待');
    if (memo.indexOf('誕生日') >= 0 || memo.indexOf('記念日') >= 0) tags.push('誕生日・記念日');
    if (shop.free_drink === '1' || shop.course === '1' || memo.indexOf('歓送迎') >= 0) {
      tags.push('歓送迎会');
      tags.push('忘年会・新年会');
    }
    if (shop.child === '1') tags.push('家族・子連れ');

    var cap = parseInt(shop.party_capacity, 10) || 0;
    if (memo.indexOf('カウンター') >= 0 || memo.indexOf('おひとり') >= 0 || memo.indexOf('一人') >= 0) tags.push('1人OK');
    if      (cap >= 100) tags.push('100名以上');
    else if (cap >= 90)  tags.push('90〜100名');
    else if (cap >= 80)  tags.push('80〜90名');
    else if (cap >= 70)  tags.push('70〜80名');
    else if (cap >= 60)  tags.push('60〜70名');
    else if (cap >= 50)  tags.push('50〜60名');
    else if (cap >= 40)  tags.push('40〜50名');
    else if (cap >= 30)  tags.push('30〜40名');
    else if (cap >= 20)  tags.push('20〜30名');
    else if (cap >= 10)  tags.push('10〜20名');
    else if (cap >= 5)   tags.push('5〜10名');
    else if (cap >= 2)   tags.push('2〜4名');
    if (shop.charter && (shop.charter.code === 'charter1' || shop.charter.code === 'charter3')) tags.push('貸切');

    if (shop.lunch === '1') tags.push('ランチ');
    if (shop.midnight_meal === '1') tags.push('深夜');

    var bNum = parseInt(((shop.budget && shop.budget.average) || '').replace(/[^0-9]/g, ''), 10);
    if (bNum > 0) {
      if (bNum < 1000) tags.push('〜1000円');
      else if (bNum < 2000) tags.push('1000〜2000円');
      else if (bNum < 3000) tags.push('2000〜3000円');
      else if (bNum < 5000) tags.push('3000〜5000円');
      else tags.push('5000円以上');
    }

    tags = tags.filter(function(t, idx) { return tags.indexOf(t) === idx; });
    return tags.length > 0 ? tags.join(',') : null;
  } catch(e) {
    return null;
  }
}
