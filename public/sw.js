const CACHE = "awn-shell-v1.1.4";
const CORE = ["/", "/login", "/manifest.webmanifest"];
const OFFLINE_HTML = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لا يوجد اتصال</title><body style="margin:0;background:#f5f7f2;color:#202820;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center;text-align:center"><main style="padding:28px;max-width:420px"><h2 style="color:#174c35">هذه الصفحة غير متاحة دون اتصال</h2><p>لم تُحفظ هذه الصفحة على جهازك من قبل. اتصل بالإنترنت وافتحها مرة واحدة لتتمكن من استخدامها لاحقًا.</p><button onclick="location.reload()" style="border:0;border-radius:9px;background:#174c35;color:white;padding:12px 20px">إعادة المحاولة</button></main></body></html>`;
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("awn-shell-") && key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const exact = await caches.match(request, { ignoreSearch: true });
        return exact || new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    })());
  }
});
