const CACHE = 'undercover-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/index.html']))
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith(self.location.origin)) return
  if (e.request.method !== 'GET') return

  // Assets compilés par Vite (JS/CSS avec hash) → cache en premier
  if (e.request.url.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
            return res
          })
      )
    )
    return
  }

  // Navigation SPA → réseau d'abord, fallback sur index.html mis en cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match('/index.html'))
  )
})
