// NAGOYA BITES — Service Worker
// バージョンを上げると古いキャッシュが自動削除されます
const CACHE_NAME = 'nagoya-bites-v1';

// オフライン時でも表示できるようにキャッシュするファイル
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Sans+JP:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap'
];

// ── インストール：静的アセットをキャッシュ ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── アクティベート：古いキャッシュを削除 ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// ── フェッチ：キャッシュ優先 → ネットワーク → オフラインページ ──
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Google Spreadsheet CSV は常にネットワークから（最新データを取得）
  if (url.includes('docs.google.com/spreadsheets')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // 画像はネットワーク優先、失敗したらキャッシュから
  if (event.request.destination === 'image') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // それ以外：キャッシュ優先、なければネットワーク
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
