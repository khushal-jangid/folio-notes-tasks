/**
 * =========================================================
 * FOLIO SERVICE WORKER (V6)
 * Full Background Notification Scheduling & Offline PWA
 * =========================================================
 */

const CACHE_NAME = 'folio-v7.0.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/notifications.js',
  './js/components.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/screenshot-mobile.png',
  './icons/screenshot-desktop.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
];

// In-Memory Scheduled Alarms in Service Worker
let scheduledAlarms = [];
let alarmCheckInterval = null;

// Install Event - Pre-cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Folio SW] Pre-caching offline assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Folio SW] Asset cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches & Claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Folio SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      startBackgroundAlarmChecker();
      return self.clients.claim();
    })
  );
});

// Fetch Event - Stale-while-revalidate for local assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (cachedResponse) return cachedResponse;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// ================= BACKGROUND ALARM SCHEDULING SYSTEM =================

function startBackgroundAlarmChecker() {
  if (alarmCheckInterval) clearInterval(alarmCheckInterval);
  checkBackgroundAlarms();
  alarmCheckInterval = setInterval(checkBackgroundAlarms, 10000); // Check every 10s in SW
}

function checkBackgroundAlarms() {
  if (!scheduledAlarms || scheduledAlarms.length === 0) return;

  const now = Date.now();
  const remaining = [];

  for (const alarm of scheduledAlarms) {
    if (alarm.time <= now) {
      // Fire Background Notification directly from Service Worker!
      triggerBackgroundNotification(alarm);
    } else {
      remaining.push(alarm);
    }
  }

  scheduledAlarms = remaining;
}

function triggerBackgroundNotification(alarm) {
  console.log('[Folio SW] Firing Background Notification for:', alarm.title);

  const title = `Folio Task Reminder`;
  const options = {
    body: `"${alarm.title}" is due ${alarm.dueTime ? 'at ' + alarm.dueTime : 'now'}!`,
    icon: './icons/icon.svg',
    badge: './icons/icon.svg',
    tag: `task-${alarm.id}`,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    renotify: true,
    actions: [
      { action: 'view', title: '👀 View Today' },
      { action: 'complete', title: '✓ Mark Done' }
    ],
    data: {
      url: './index.html?view=today',
      taskId: alarm.id
    }
  };

  self.registration.showNotification(title, options).catch((err) => {
    console.warn('[Folio SW] showNotification error:', err);
  });

  // Notify active clients if any window is open
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION_FIRED',
        taskId: alarm.id
      });
    });
  });
}

// Listen to messages from window to sync alarms
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SYNC_ALARMS') {
    scheduledAlarms = event.data.alarms || [];
    console.log('[Folio SW] Synced alarms count:', scheduledAlarms.length);
    startBackgroundAlarmChecker();
  } else if (event.data.type === 'TRIGGER_NOTIFICATION') {
    triggerBackgroundNotification(event.data.alarm);
  }
});

// Notification Click & Action Buttons Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const action = event.action;

  let urlToOpen = event.notification.data?.url || './index.html?view=today';
  if (action === 'complete' && taskId) {
    urlToOpen = `./index.html?action=complete-task&id=${taskId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          if (taskId && action === 'complete') {
            client.postMessage({ type: 'COMPLETE_TASK_FROM_SW', taskId });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
