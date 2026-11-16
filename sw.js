/* Offline-Cache.
   Die Seite selbst wird zuerst frisch aus dem Netz geholt (max. 2,5 s Wartezeit, sonst Cache),
   damit Updates sofort ankommen und die App im Studio trotzdem schnell startet.
   Alle übrigen Dateien kommen sofort aus dem Cache und werden im Hintergrund aktualisiert. */
const CACHE = "logbuch-v2";
const FILES = ["./", "index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
function page(r, c) {
  const cached = () => c.match(r, {ignoreSearch: true}).then(h => h || c.match("index.html"));
  return new Promise(resolve => {
    let done = false;
    const finish = x => { if (!done && x) { done = true; clearTimeout(timer); resolve(x); } };
    const timer = setTimeout(() => cached().then(finish), 2500);
    fetch(r.url, {cache: "no-cache"})
      .then(res => { if (res && res.ok) { c.put(r.url, res.clone()); finish(res); } else cached().then(h => finish(h || res)); })
      .catch(() => cached().then(h => finish(h || Response.error())));
  });
}
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  const isPage = r.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html");
  e.respondWith(caches.open(CACHE).then(c => {
    if (isPage) return page(r, c);
    return c.match(r, {ignoreSearch: true}).then(hit => {
      const net = fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
      if (hit) e.waitUntil(net);
      return hit || net;
    });
  }));
});
