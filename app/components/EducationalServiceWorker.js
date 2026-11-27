"use client";

import { useEffect } from "react";

export default function EducationalServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/educational-sw.js", { scope: "/" }).catch(error => {
      console.error("Educational service worker registration failed:", error);
    });
  }, []);
  return null;
}
