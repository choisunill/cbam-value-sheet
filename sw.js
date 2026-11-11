// 오프라인에서도 열리도록 앱 파일을 저장해 둔다. 파일을 바꾸면 VERSION을 올린다.
const VERSION = "v27";
const FILES = ["./", "index.html", "style.css", "app.js", "sheet.js", "prices-data.js", "duty-data.js", "ko-names.js", "messages.js", "catalog.js", "catalog-data.js", "engine.js", "negotiation.js", "data.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// 네트워크 먼저, 실패하면 저장본. 글꼴 같은 외부 파일도 한 번 받으면 저장한다.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
