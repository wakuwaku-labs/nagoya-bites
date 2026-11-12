'use strict';
/**
 * X の投稿に付ける「店の実物写真」（文字だけの画像カードの代わり・docs/decisions/0062）。
 *
 * 決まり（破らない）:
 *   - 使うのは、記事に載せた写真のうち、出どころと配信元が data/x_post_policy.json の storePhoto にあるものだけ
 *     （既定は PR TIMES のプレスリリース。企業規約 第6条3項で報道目的の利用が許諾されている。docs/decisions/0056 と同じ線引き）。
 *   - ホットペッパー・Google の写真は X に上げない（規約が再配信・複製保存を禁止）。その日は記事のリンクカードで見せる。
 *   - 写真は加工しない（配信元が用意している縮小版を取るだけ）。クレジット（発行元）を本文に1行で書く。
 *   - リポジトリには保存しない（取ってきて、上げたら捨てる）。
 *   - 取れない・上げられないときは、写真なし（クレジットの行も外す）で投稿を続ける。
 */
const NB = require('./note_draft');

const MAX_BYTES = 5 * 1024 * 1024; // X の tweet_image の上限
const CREDIT_HEAD = '写真: ';

/** 記事の中から使ってよい写真を選ぶ（ヒーロー → 本文の順で最初の1枚）。設定が切れている・無いときは null */
function pickPhoto(html, policy) {
  const cfg = (policy && policy.storePhoto) || {};
  if (cfg.enabled !== true) return null;
  const p = NB.articlePhoto(html, { eyecatchPhoto: { sources: cfg.sources || [], hosts: cfg.hosts || [] } });
  if (!p || !p.credit) return null;
  return p;
}

/** 本文の最後に足すクレジットの行（例: 「写真: 提供 株式会社◯◯（プレスリリースより）」） */
function creditLine(photo) {
  return `${CREDIT_HEAD}${String(photo.credit).replace(/\s+/g, ' ').trim()}`;
}

/** 短い形（例: 「写真: 株式会社◯◯提供」）。長い形で 280 を超える日に使う */
function shortCreditLine(photo) {
  const who = String(photo.credit).replace(/\s+/g, ' ').trim().replace(/^提供\s*/, '').replace(/[（(]プレスリリースより[）)]$/, '').trim();
  return `${CREDIT_HEAD}${who}提供`;
}

/** 本文にクレジットを足す（長い形 → 短い形）。どちらも X の数え方で limit を超えるなら null（写真を付けない） */
function withCredit(text, photo, weightedLength, limit = 280) {
  for (const line of [creditLine(photo), shortCreditLine(photo)]) {
    const t = `${String(text).replace(/\s+$/, '')}\n\n${line}`;
    if (weightedLength(t) <= limit) return t;
  }
  return null;
}

/** PR TIMES は配信元の縮小版（幅1920・JPEG）を取る。こちらでは加工しない */
function photoUrl(src) {
  const u = new URL(src);
  if (u.hostname === 'prcdn.freetls.fastly.net' && !u.search) u.search = '?width=1920&quality=85&format=jpeg&fit=bounds';
  return u.toString();
}

/**
 * 写真を取ってくる（メモリの中だけ）。返り値: { ok:true, buf, type } か { ok:false, reason }。例外は投げない
 */
async function downloadPhoto(src, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(photoUrl(src), { headers: { 'user-agent': 'NAGOYA-BITES-editorial/1.0 (+https://nagoya-bites.com)' } });
    if (!res || res.status !== 200 || typeof res.arrayBuffer !== 'function') return { ok: false, reason: `photo_http_${res ? res.status : 'none'}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { ok: false, reason: 'photo_too_big' };
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
    if (!isJpeg && !isPng) return { ok: false, reason: 'photo_not_image' };
    return { ok: true, buf, type: isJpeg ? 'image/jpeg' : 'image/png' };
  } catch (e) {
    return { ok: false, reason: `photo_network: ${e.message || e}`.slice(0, 200) };
  }
}

module.exports = { pickPhoto, creditLine, shortCreditLine, withCredit, photoUrl, downloadPhoto, CREDIT_HEAD, MAX_BYTES };
