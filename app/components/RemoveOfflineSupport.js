"use client";

// Intentionally disabled.
// This legacy component used to unregister every service worker, delete app
// caches, and delete the educational IndexedDB database on every app load.
// That behavior could permanently destroy unsynchronized teacher records.
// Keep this component as a no-op until a safe, versioned offline migration
// and explicit user-controlled data removal flow are implemented.
export default function RemoveOfflineSupport() {
  return null;
}
