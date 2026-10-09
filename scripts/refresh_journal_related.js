#!/usr/bin/env node
/**
 * journal/2026-*.html の <div class="related"> を「直近3本の他journal + ナビリンク」に書き換える。
 * 各記事の <h1 class="art-title"> から <em> を剥いだ表示用タイトルを抽出して使う。
 * _template.html / index.html / feed.* は対象外。
 *
 * SEO-099: 関連特集CTA（下記 TOPIC_FEATURES によるジャンル一致）が特集にヒットした場合、
 * その特集に対応するエリア×ジャンル×条件ハブ（stores/area/配下・SEO-094）も候補に加える。
 * 対応関係は scripts/lib/hub_link_finder.js が journal_seo_keywords.json /
 * area_genre_pages_policy.json / area_genre_pages_manifest.json だけを根拠に決定する
 * （自己申告・推測は使わない・CLAUDE.md 制約10）。本ファイルは <div class="related"> を
 * 毎回まるごと再構築するため、追加後もそのまま冪等性を保つ。
 */
const fs = require('fs');
const path = require('path');
const { buildFeatureHubMap, detectArticleArea, findAreaHub } = require('./lib/hub_link_finder');
const { relabelForSlug, syncAll } = require('./lib/feature_counts');

const JOURNAL_DIR = path.join(__dirname, '..', 'journal');
const HUB_MAP = buildFeatureHubMap({ maxLinks: 2 });

// SEO-114: エリア×ジャンルハブの最適化用。policy/manifest は起動時に1回だけ読む。
const POLICY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'area_genre_pages_policy.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'area_genre_pages_manifest.json'), 'utf8'));

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listPosts() {
  return fs.readdirSync(JOURNAL_DIR)
    .filter(f => /^2\d{3}-\d{2}-\d{2}-.+\.html$/.test(f))
    .sort()
    .reverse(); // 新しい順
}

function extractTitle(html) {
  const m = html.match(/<h1 class="art-title">([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function shortLabel(title) {
  // 表示用ラベル: 「— 」以降を落として頭の主張だけ残す（長すぎる時の保険）
  const dash = title.indexOf(' — ');
  const base = dash > 0 ? title.slice(0, dash) : title;
  return base.length > 38 ? base.slice(0, 36) + '…' : base;
}

// 回遊強化: journal タイトルから関連特集(features/)を1本マッチさせる。
// 先頭から順に最初に一致したものを採用。確信が持てない場合は付けない（汎用ハブのみ）。
const { TOPIC_FEATURES } = require('./lib/journal_topics');

function matchTopicFeature(title) {
  if (!title) return null;
  for (const [re, slug, label, group] of TOPIC_FEATURES) {
    // SEO-147: 「N選」はリンク先の特集の確かめられる掲載数に合わせる
    if (re.test(title)) return { slug, label: relabelForSlug(label, slug), group: group || slug };
  }
  return null;
}

// 記事タイトルに一致する TOPIC_FEATURES の slug を全件返す
function matchAllTopicSlugs(title) {
  if (!title) return new Set();
  const slugs = new Set();
  for (const [re, slug, , group] of TOPIC_FEATURES) {
    if (re.test(title)) slugs.add(group || slug);
  }
  return slugs;
}

function hasOwnHubs(slug) {
  const feature = `features/${slug}.html`;
  return HUB_MAP.has(feature) || POLICY.genres.some(g => g.feature === feature);
}

function hubSlugFor(topic) {
  return hasOwnHubs(topic.slug) ? topic.slug : (topic.group || topic.slug);
}

function buildRelatedHtml(currentFile, posts, postsMeta) {
  // 同トピック優先: 現記事の TOPIC slugs と1つでも重なる他記事を前に並べる
  // （重なりがゼロなら直近順のまま・退行なし）
  const currentTopics = (postsMeta[currentFile] && postsMeta[currentFile].topics) || new Set();
  const candidates = posts.filter(f => f !== currentFile);
  let topicFirst, rest;
  if (currentTopics.size > 0) {
    topicFirst = candidates.filter(f => {
      const t = postsMeta[f] && postsMeta[f].topics;
      if (!t || t.size === 0) return false;
      for (const s of currentTopics) { if (t.has(s)) return true; }
      return false;
    });
    rest = candidates.filter(f => !topicFirst.includes(f));
  } else {
    topicFirst = [];
    rest = candidates;
  }
  const others = [...topicFirst, ...rest].slice(0, 3);
  const lines = [];
  lines.push('<div class="related">');
  lines.push('  <p class="related-title">関連記事</p>');
  lines.push('  <div class="related-links">');
  for (const f of others) {
    const meta = postsMeta[f];
    if (!meta) continue;
    lines.push(`    <a class="related-link" href="${f}">${shortLabel(meta.title)}</a>`);
  }
  lines.push('    <a class="related-link is-primary" href="index.html">Journal 一覧</a>');
  // タイトルにジャン/シーンが含まれれば、対応する特集へのトピックリンクを1本追加（回遊強化）
  const topic = matchTopicFeature(postsMeta[currentFile] && postsMeta[currentFile].title);
  if (topic) {
    lines.push(`    <a class="related-link is-primary" href="../features/${topic.slug}.html">${topic.label}</a>`);
    // SEO-114: 記事エリアを検出し、エリア×ジャンルの最適ハブを優先して出す。
    // エリアが特定できたがハブが無い場合も含め「エリア外のハブを無言で並べない」原則に従う。
    const articleTitle = postsMeta[currentFile] && postsMeta[currentFile].title;
    const areaSlug = detectArticleArea(currentFile, articleTitle, POLICY);
    // SEO-102: 特集にジャンルのハブが無ければ、話題のまとまりの代表の特集のハブを使う
    const hubSlug = hubSlugFor(topic);
    let hubsAdded = false;
    if (areaSlug) {
      const areaHub = findAreaHub(areaSlug, hubSlug, POLICY, MANIFEST);
      if (areaHub) {
        if (areaHub.type === 'area_genre') {
          const href = `../${areaHub.url}`;
          lines.push(
            `    <a class="related-link" href="${href}" onclick="trackEvent('internal_link_click',{link_url:'${href}',block:'journal_hub'})">${escapeHtml(areaHub.label)}</a>`
          );
          hubsAdded = true;
        } else if (areaHub.type === 'area_feature') {
          const featureSlug = areaHub.url.replace(/^features\//, '').replace(/\.html$/, '');
          if (featureSlug !== topic.slug) {
            // エリア特集ラベルを TOPIC_FEATURES から引く（語彙を一箇所に集約）
            const entry = TOPIC_FEATURES.find(([, s]) => s === featureSlug);
            const areaFeatureLabel = entry ? relabelForSlug(entry[2], featureSlug) : featureSlug;
            const href = `../${areaHub.url}`;
            lines.push(
              `    <a class="related-link" href="${href}" onclick="trackEvent('internal_link_click',{link_url:'${href}',block:'journal_hub'})">${escapeHtml(areaFeatureLabel)}</a>`
            );
            hubsAdded = true;
          }
        }
      }
      // エリアは特定できたが対応ハブが無い場合 → hubsAdded=false → 下の従来ハブにフォールバック
    }
    if (!hubsAdded) {
      // SEO-099: エリア不明 or エリア対応ハブ無しの場合のみ従来の特集単位ハブを使う
      const hubLinks = HUB_MAP.get(`features/${hubSlug}.html`) || [];
      for (const h of hubLinks) {
        const href = `../${h.url}`;
        lines.push(
          `    <a class="related-link" href="${href}" onclick="trackEvent('internal_link_click',{link_url:'${href}',block:'journal_hub'})">${escapeHtml(h.label)}</a>`
        );
      }
    }
  }
  lines.push('    <a class="related-link" href="../features/index.html">特集をもっと見る</a>');
  lines.push('    <a class="related-link" href="../index.html">全店舗を検索</a>');
  lines.push('  </div>');
  lines.push('</div>');
  return lines.join('\n');
}

// 旧テンプレートは related-wrap クラスを使う（2026-05 初期の5記事）。
// これらは既に手動キュレーション済みリンクを持つため対象外と判断し、件数と理由をログに残す。
const RE_OLD_FORMAT = /<div class="related-wrap">/;

function refreshFile(file, posts, postsMeta) {
  const fp = path.join(JOURNAL_DIR, file);
  let html = fs.readFileSync(fp, 'utf8');
  const re = /<div class="related">\s*<p class="related-title">[^<]*<\/p>\s*<div class="related-links">[\s\S]*?<\/div>\s*<\/div>/;
  if (!re.test(html)) {
    const reason = RE_OLD_FORMAT.test(html)
      ? '旧 related-wrap 形式（既存リンクあり・手動キュレーション保持・対象外）'
      : 'related block not found';
    return { file, changed: false, reason };
  }
  const next = buildRelatedHtml(file, posts, postsMeta);
  const updated = html.replace(re, next);
  if (updated === html) return { file, changed: false, reason: 'no diff' };
  fs.writeFileSync(fp, updated);
  return { file, changed: true };
}

function main() {
  const posts = listPosts();
  const postsMeta = {};
  for (const f of posts) {
    const html = fs.readFileSync(path.join(JOURNAL_DIR, f), 'utf8');
    const title = extractTitle(html);
    if (title) postsMeta[f] = { title, topics: matchAllTopicSlugs(title) };
  }
  console.log(`Found ${posts.length} posts`);
  let changed = 0;
  let skippedOld = 0;
  for (const f of posts) {
    const r = refreshFile(f, posts, postsMeta);
    if (r.changed) {
      changed++;
    } else {
      if (r.reason && r.reason.includes('旧 related-wrap')) skippedOld++;
      else console.log(`SKIP ${f}: ${r.reason}`);
    }
  }
  if (skippedOld > 0) {
    console.log(`SKIP（対象外）${skippedOld}件: 旧 related-wrap 形式。既存の手動キュレーション済みリンクを保持します。`);
  }
  console.log(`Updated ${changed}/${posts.length} files`);
  // SEO-147: 本文の「合わせて読む」なども含め、特集へのリンク文の「N選」をリンク先の掲載数にそろえる。
  // 掲載店の入れ替えで特集の件数が変わった日も、次の日次ジャーナルで追いつく（冪等・失敗しても関連リンクの更新は残す）
  try {
    const synced = syncAll({ target: 'journal', write: true });
    console.log(`特集へのリンク文の件数をそろえた: ${synced.changed.length} 本`);
  } catch (e) {
    console.log(`⚠️ 特集へのリンク文の件数をそろえられなかった: ${e.message}`);
  }
}

if (require.main === module) main();
module.exports = { TOPIC_FEATURES, matchTopicFeature, matchAllTopicSlugs, hasOwnHubs, hubSlugFor, buildRelatedHtml };
