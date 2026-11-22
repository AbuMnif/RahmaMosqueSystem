"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DB = "awn-educational-v1";
const STORE = "records";
function dbGet(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, "readonly");
      const get = tx.objectStore(STORE).get(key);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    };
  });
}
function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}
export default function DataPreloader() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (pathname !== "/dashboard" || !navigator.onLine) return;
    let alive = true;
    let timer;
    (async () => {
      try {
        const response = await fetch("/api/educational-records", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        const snapshot = result?.data;
        if (!result.success || !snapshot?.profile?.id) return;
        const key = `snapshot:${snapshot.profile.id}`;
        const previous = await dbGet(key);
        await dbSet(key, snapshot);
        if (!alive) return;
        if (!previous) {
          setMessage("تم تجهيز بياناتك للعمل دون اتصال بالإنترنت.");
          timer = setTimeout(() => alive && setMessage(""), 4200);
        }
      } catch { /* يعمل التطبيق دون إزعاج المستخدم عند تعذر التحميل */ }
    })();
    return () => { alive = false; clearTimeout(timer); };
  }, [pathname]);
  return message ? <div role="status" className="awn-preload-toast">{message}</div> : null;
}
