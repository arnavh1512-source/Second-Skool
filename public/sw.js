// Second Skool — push service worker.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.title || 'Second Skool'
  const options = {
    body: data.body || '',
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: data.tag || undefined,
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
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus() }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
