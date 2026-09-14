'use strict';

/**
 * 流入元（GA4 の sessionSource / sessionMedium）の SNS・生成AI 判定の唯一の情報源。
 *
 * 2026-09-14 に判明した誤分類の教訓:
 *   旧実装は `/twitter|t\.co|x\.com|instagram|facebook|line/.test(source)` の部分一致で
 *   SNS を判定しており、chatgp[t.co]m・copilo[t.co]m が X（t.co）として数えられていた。
 *   GA4 が ChatGPT 流入に medium=ai-assistant を付け始めた 2026-07 中旬から、
 *   site_metrics.json の channels.social（30日で約90）は**ほぼ全量が生成AI流入**になり、
 *   実際の SNS 流入（30日で1媒体6件未満）は観測できなくなっていた。
 *
 * 判定はドメイン単位で行う:
 *   - ホスト名が登録ドメインと完全一致、またはそのサブドメイン（l.instagram.com 等）
 *   - UTM 手入力で使われるドメインなしの素の名前（instagram / ig / x 等）は完全一致のみ
 * 部分一致は使わない（上の事故の直接原因）。
 */

const SOCIAL_DOMAINS = [
  't.co', 'x.com', 'twitter.com',
  'instagram.com',
  'facebook.com', 'fb.com', 'fb.me',
  'threads.net', 'threads.com',
  'line.me', 'line-apps.com',
  'tiktok.com',
  'youtube.com', 'youtu.be',
  'note.com',
];

const SOCIAL_BARE = [
  'x', 'twitter', 'instagram', 'ig', 'facebook', 'fb', 'threads',
  'line', 'tiktok', 'youtube', 'note',
];

const AI_DOMAINS = [
  'chatgpt.com', 'openai.com', 'perplexity.ai', 'claude.ai',
  'gemini.google.com', 'bard.google.com', 'copilot.com', 'copilot.microsoft.com',
];

const AI_BARE = ['chatgpt', 'openai', 'perplexity', 'claude', 'gemini', 'copilot'];

/** source を比較用のホスト名に正規化する（スキーム・パス・ポートを落とす） */
function normalizeHost(source) {
  let s = String(source || '').trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '');
  s = s.split(/[/?#:]/)[0];
  return s;
}

function matchesDomain(host, domains, bare) {
  if (!host) return false;
  if (bare.includes(host)) return true;
  return domains.some(d => host === d || host.endsWith('.' + d));
}

function isSocialSource(source) {
  return matchesDomain(normalizeHost(source), SOCIAL_DOMAINS, SOCIAL_BARE);
}

function isAiAssistantSource(source, medium) {
  if (String(medium || '').trim().toLowerCase() === 'ai-assistant') return true;
  return matchesDomain(normalizeHost(source), AI_DOMAINS, AI_BARE);
}

module.exports = {
  SOCIAL_DOMAINS, SOCIAL_BARE, AI_DOMAINS, AI_BARE,
  normalizeHost, isSocialSource, isAiAssistantSource,
};
