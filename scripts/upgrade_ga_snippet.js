#!/usr/bin/env node
/**
 * GA snippet を旧版（trackEvent のみ）から新版（outbound_click 付き）へ一括更新する。
 *
 * 対象:
 *   - index.html（既に手動更新済みの場合はスキップ）
 *   - features/*.html
 *   - stores/*.html
 *   - about.html, contact.html, faq.html, manual_tagging.html
 *
 * 置換条件: 既に outbound_click のリスナーを含むファイルはスキップ（冪等）。
 */

const fs = require('fs');
const path = require('path');

const GA_ID = 'G-3LCZNGZPWJ';
const OUTBOUND_LISTENER_MARKER = "trackEvent('outbound_click'";

// 既存の旧 snippet（末尾の </script> 手前に outbound_click リスナーが無いパターン）を
// 新 snippet に置き換える正規表現。
// 旧: function trackEvent...}\n</script>
// 新: function trackEvent...}\nOUTBOUND_LISTENER\n</script>
const OUTBOUND_LISTENER = `document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href')||'';if(!/^https?:\\/\\//i.test(href))return;try{var h=new URL(href,location.href).hostname;if(h===location.hostname)return;trackEvent('outbound_click',{link_url:href,link_domain:h,link_text:(a.innerText||a.textContent||'').trim().slice(0,80)});}catch(err){}},true);`;

const ROOT = path.resolve(__dirname, '..');

function collectTargets() {
  const targets = [];
  // index.html + 直下の静的ページ
  ['index.html', 'about.html', 'contact.html', 'faq.html', 'manual_tagging.html'].forEach(f => {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) targets.push(p);
  });
  // features/
  const featuresDir = path.join(ROOT, 'features');
  if (fs.existsSync(featuresDir)) {
    fs.readdirSync(featuresDir)
      .filter(f => f.endsWith('.html'))
      .forEach(f => targets.push(path.join(featuresDir, f)));
  }
  // stores/
  const storesDir = path.join(ROOT, 'stores');
  if (fs.existsSync(storesDir)) {
    fs.readdirSync(storesDir)
      .filter(f => f.endsWith('.html'))
      .forEach(f => targets.push(path.join(storesDir, f)));
  }
  return targets;
}

function upgradeFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  // 既に outbound_click リスナーが含まれていればスキップ
  if (original.includes(OUTBOUND_LISTENER_MARKER)) {
    return { status: 'skip_already_upgraded', file: filePath };
  }

  // GA ID が無いファイルはそもそも対象外
  if (!original.includes(GA_ID)) {
    return { status: 'skip_no_ga', file: filePath };
  }

  // 置換対象: 旧 snippet 末尾パターン
  // "function trackEvent(name,params){if(typeof gtag==='function')gtag('event',name,params||{});}"
  // の直後の改行 + </script> を、リスナー追加版に置き換える
  const oldPattern = /(function trackEvent\(name,params\)\{if\(typeof gtag==='function'\)gtag\('event',name,params\|\|\{\}\);\})(\s*<\/script>)/;
  if (!oldPattern.test(original)) {
    return { status: 'skip_no_match', file: filePath };
  }

  const updated = original.replace(oldPattern, `$1\n${OUTBOUND_LISTENER}$2`);
  fs.writeFileSync(filePath, updated, 'utf8');
  return { status: 'upgraded', file: filePath };
}

function main() {
  const targets = collectTargets();
  console.log(`対象ファイル: ${targets.length}件`);

  const results = { upgraded: 0, skip_already_upgraded: 0, skip_no_ga: 0, skip_no_match: 0 };
  const skippedNoMatch = [];

  for (const t of targets) {
    const r = upgradeFile(t);
    results[r.status]++;
    if (r.status === 'skip_no_match') skippedNoMatch.push(r.file);
  }

  console.log('');
  console.log('=== 結果 ===');
  console.log(`  ✅ 新snippetへ更新: ${results.upgraded}件`);
  console.log(`  ⏭  既に更新済み:   ${results.skip_already_upgraded}件`);
  console.log(`  ⚠️  GAタグ未設置:  ${results.skip_no_ga}件`);
  console.log(`  ⚠️  パターン不一致: ${results.skip_no_match}件`);

  if (skippedNoMatch.length > 0) {
    console.log('');
    console.log('パターン不一致ファイル:');
    skippedNoMatch.slice(0, 10).forEach(f => console.log(`  - ${path.relative(ROOT, f)}`));
    if (skippedNoMatch.length > 10) console.log(`  ... 他 ${skippedNoMatch.length - 10}件`);
  }
}

main();
