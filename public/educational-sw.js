const CACHE_NAME = "awn-educational-shell-v1";
const EDUCATIONAL_PATH = "/dashboard/educational-records";
const DASHBOARD_PATH = "/dashboard";
const TEACHER_ATTENDANCE_PATH = "/dashboard/teacher-attendance";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("awn-educational-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // Cache only immutable Next.js build assets. Never cache API responses,
  // authenticated data endpoints, or other application sections.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  // The educational page is the only navigational document eligible for
  // offline fallback. The page's client code enforces the 48-hour local
  // verification window before displaying locally stored educational data.
  if (request.mode === "navigate" && (url.pathname === DASHBOARD_PATH || url.pathname === EDUCATIONAL_PATH || url.pathname === TEACHER_ATTENDANCE_PATH || url.pathname === "/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok && [DASHBOARD_PATH, EDUCATIONAL_PATH, TEACHER_ATTENDANCE_PATH].includes(url.pathname)) {
          // Store a canonical URL without query parameters so links such as
          // ?tab=teacher_attendance can reuse the same authenticated page shell.
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(url.pathname, { ignoreSearch: true });
        if (cached) return cached;
        return new Response("لا تتوفر الصفحة المطلوبة دون اتصال على هذا الجهاز. افتحها مرة واحدة أثناء الاتصال بالإنترنت.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
  }
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_EDUCATIONAL_SHELL" || !event.ports?.[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const paths=[EDUCATIONAL_PATH,TEACHER_ATTENDANCE_PATH];
      const pages=await Promise.all(paths.map(async path=>{
        const response=await fetch(new Request(path,{method:"GET",credentials:"include",headers:{Accept:"text/html"},cache:"no-store"}));
        if(!response.ok||new URL(response.url).pathname!==path||!(response.headers.get("content-type")||"").includes("text/html"))throw new Error("تعذر تجهيز إحدى صفحات التعليم.");
        await cache.put(path,response.clone());return response;
      }));
      const html=(await Promise.all(pages.map(page=>page.clone().text()))).join("\n");
      const assetPaths=[...html.matchAll(/(?:src|href)=["']([^"']*_next\/static\/[^"']+)["']/g)].map(match=>match[1]);
      const uniqueAssets=[...new Set(assetPaths)].map(value=>new URL(value.replaceAll("&amp;","&"),self.location.origin).href);
      await Promise.allSettled(uniqueAssets.map(async assetUrl=>{const assetResponse=await fetch(assetUrl,{credentials:"same-origin"});if(assetResponse.ok)await cache.put(assetUrl,assetResponse);}));
      port.postMessage({ success: true });
    } catch (error) {
      port.postMessage({ success: false, error: error?.message || "تعذر تجهيز الصفحة للعمل دون إنترنت." });
    }
  })());
});
