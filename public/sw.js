// Second Skool — push service worker.

// Activate a new SW build immediately instead of waiting for every tab to
// close — otherwise bug fixes here (e.g. notification handling) never reach
// devices that keep the PWA open.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  // Fall back to the sending centre's name, not the platform's — the parent
  // knows their coaching centre. `data.centre` is stamped server-side.
  const title = data.title || data.centre || 'Second Skool'
  const options = {
    body: data.body || '',
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: data.tag || undefined,
    // Android decides heads-up vs. silent-to-the-shade from the Chrome "Sites"
    // channel importance, which the web can't set. What it does read: a vibrate
    // pattern and an explicit silent:false mark this as alerting rather than
    // ambient, which is the difference on some OEM skins. It cannot override a
    // channel the user has muted — that stays a device setting.
    vibrate: [200, 100, 200],
    silent: false,
    timestamp: Date.now(),
    data: { url: data.url || '/' },
  }
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options)
    // Nudge any open app window to re-pull data so the reminder shows in-app
    // immediately, not only as a system notification.
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of list) c.postMessage({ type: 'refresh' })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    // Resolve to an absolute same-origin URL so window matching works.
    const targetUrl = new URL(target, self.registration.scope).href
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

    // 1) A window already on the target screen — just focus it.
    for (const c of list) {
      if (new URL(c.url).href === targetUrl && 'focus' in c) return c.focus()
    }
    // 2) Any open window — navigate it to the target, then focus.
    for (const c of list) {
      if ('focus' in c) {
        try { if ('navigate' in c) await c.navigate(targetUrl) } catch {}
        return c.focus()
      }
    }
    // 3) Nothing open — open a fresh window at the target.
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
  })())
})
