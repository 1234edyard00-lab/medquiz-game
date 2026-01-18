// Настройки кэширования
const CACHE_NAME = 'medquiz-v1.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // Добавьте сюда другие ресурсы, если они появятся
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Все файлы закэшированы');
        return self.skipWaiting();
      })
      .catch(err => {
        console.log('[Service Worker] Ошибка кэширования:', err);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация');
  
  // Удаляем старые кэши
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Активирован');
      return self.clients.claim();
    })
  );
});

// Перехват сетевых запросов
self.addEventListener('fetch', event => {
  // Пропускаем запросы к Telegram API и внешним ресурсам
  if (event.request.url.includes('telegram') || 
      event.request.url.startsWith('chrome-extension://') ||
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если файл есть в кэше, возвращаем его
        if (response) {
          console.log('[Service Worker] Возвращаем из кэша:', event.request.url);
          return response;
        }
        
        // Если нет в кэше, делаем сетевой запрос
        return fetch(event.request)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ для кэширования
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Кэшируем новый ресурс
                cache.put(event.request, responseToCache);
                console.log('[Service Worker] Закэширован новый ресурс:', event.request.url);
              });
            
            return response;
          })
          .catch(() => {
            // Если нет сети и нет в кэше, можно вернуть fallback
            console.log('[Service Worker] Нет сети и нет в кэше:', event.request.url);
            
            // Для HTML-страницы возвращаем главную страницу
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // Можно вернуть кастомный fallback
            return new Response('Оффлайн-режим', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Фоновая синхронизация (если поддерживается)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-game-data') {
    console.log('[Service Worker] Фоновая синхронизация');
    event.waitUntil(syncGameData());
  }
});

// Периодическая синхронизация (если поддерживается)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    console.log('[Service Worker] Периодическая синхронизация');
    event.waitUntil(updateContent());
  }
});

// Push-уведомления
self.addEventListener('push', event => {
  console.log('[Service Worker] Push-уведомление получено');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'MedQuiz';
  const options = {
    body: data.body || 'Новое уведомление от MedQuiz',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Нажатие на уведомление');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Если есть открытое окно, фокусируем его
        for (let client of windowClients) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Если нет открытого окна, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});

// Вспомогательные функции
async function syncGameData() {
  // Здесь можно синхронизировать результаты игры с сервером
  console.log('[Service Worker] Синхронизация данных игры');
  return Promise.resolve();
}

async function updateContent() {
  // Здесь можно обновлять контент в фоне
  console.log('[Service Worker] Обновление контента');
  return Promise.resolve();
}

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
  console.log('[Service Worker] Сообщение получено:', event.data);
  
  if (event.data.type === 'CACHE_NEW_RESOURCE') {
    caches.open(CACHE_NAME)
      .then(cache => cache.add(event.data.url))
      .then(() => {
        console.log('[Service Worker] Ресурс закэширован:', event.data.url);
      });
  }
});