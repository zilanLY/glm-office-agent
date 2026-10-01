/* GLM Office Agent PWA service worker：cache-first 静态资源 */
const CACHE = 'glm-pwa-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
            return res
          })
          .catch(() => caches.match('./'))
    )
  )
})
