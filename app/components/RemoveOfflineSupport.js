"use client";
import { useEffect } from "react";

export default function RemoveOfflineSupport() {
  useEffect(() => {
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(registration => registration.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(key => key.startsWith("awn-shell-")).map(key => caches.delete(key)));
        }
        if ("indexedDB" in window) {
          indexedDB.deleteDatabase("awn-educational-v1");
        }
      } catch (error) {
        console.warn("Offline data cleanup did not fully complete", error);
      }
    })();
  }, []);
  return null;
}
