// Afueni service worker. Its only job: when a money SMS is shared to the
// installed app, Android opens /money/share?text=... . We answer that here on
// the phone by moving the text after a "#", so the message never reaches our
// server or its logs. Everything else goes to the network as normal.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode !== "navigate" || url.origin !== self.location.origin || url.pathname !== "/money/share") return;
  const target = new URL("/money", url.origin);
  target.hash = url.searchParams.toString();
  event.respondWith(Response.redirect(target.href, 303));
});
