const CACHE = "awn-shell-v1.1.3";
const CORE = ["/", "/login", "/manifest.webmanifest"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", event => {
 const req = event.request; const url = new URL(req.url);
 if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
 if (req.mode === "navigate") { event.respondWith(fetch(req).then(res => { const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); return res; }).catch(async()=> (await caches.match(req)) || (await caches.match("/dashboard/educational-records")) || (await caches.match("/login")))); return; }
 if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname === "/manifest.webmanifest") { event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}))); }
});

self.addEventListener("message", event => { if(event.data?.type === "CACHE_URL" && typeof event.data.url === "string"){ event.waitUntil(fetch(event.data.url,{credentials:"include"}).then(response=>{if(response.ok)return caches.open(CACHE).then(cache=>cache.put(event.data.url,response));}).catch(()=>{})); }});
