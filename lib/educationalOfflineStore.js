const DB_NAME = "awn-educational-v2";
const DB_VERSION = 1;
const SNAPSHOTS = "snapshots";
const OPERATIONS = "operations";
const META = "meta";

let opening;

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح."));
  }
  if (opening) return opening;

  opening = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        db.createObjectStore(SNAPSHOTS, { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains(OPERATIONS)) {
        const store = db.createObjectStore(OPERATIONS, { keyPath: "operationId" });
        store.createIndex("byAccount", "accountId", { unique: false });
        store.createIndex("byAccountStatus", ["accountId", "status"], { unique: false });
        store.createIndex("byCreatedAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "accountId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error || new Error("تعذر فتح قاعدة البيانات المحلية."));
    };
    request.onblocked = () => {
      opening = null;
      reject(new Error("قاعدة البيانات المحلية مشغولة في نافذة أخرى. أغلق النوافذ الأخرى وحاول مجددًا."));
    };
  });
  return opening;
}

function transact(db, stores, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    try {
      result = action(tx);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error("فشلت معاملة التخزين المحلي."));
    tx.onabort = () => reject(tx.error || new Error("أُلغيت معاملة التخزين المحلي."));
  });
}

export async function saveEducationalSnapshot(accountId, data, metadata = {}) {
  if (!accountId || !data || typeof data !== "object") throw new Error("بيانات النسخة المحلية غير مكتملة.");
  const db = await openDatabase();
  const snapshot = {
    accountId,
    data,
    savedAt: new Date().toISOString(),
    schemaVersion: DB_VERSION,
    ...metadata,
  };
  await transact(db, [SNAPSHOTS], "readwrite", tx => tx.objectStore(SNAPSHOTS).put(snapshot));
  return snapshot;
}

export async function readEducationalSnapshot(accountId) {
  if (!accountId) return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SNAPSHOTS, "readonly").objectStore(SNAPSHOTS).get(accountId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("تعذر قراءة النسخة المحلية."));
  });
}

export async function enqueueEducationalOperation({ accountId, operationId, operation, payload }) {
  if (!accountId || !operationId || !operation || !payload) throw new Error("العملية المحلية تفتقد بيانات أساسية.");
  const db = await openDatabase();
  const item = {
    accountId,
    operationId,
    operation,
    payload,
    status: "pending",
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  await transact(db, [OPERATIONS], "readwrite", tx => {
    const store = tx.objectStore(OPERATIONS);
    const get = store.get(operationId);
    get.onsuccess = () => {
      if (!get.result) store.add(item);
    };
  });
  return item;
}

export async function listEducationalOperations(accountId, status = "pending") {
  if (!accountId) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OPERATIONS, "readonly");
    const index = tx.objectStore(OPERATIONS).index("byAccountStatus");
    const request = index.getAll([accountId, status]);
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error || new Error("تعذر قراءة قائمة العمليات المحلية."));
  });
}

export async function markEducationalOperationAttempt(operationId, errorMessage = null) {
  if (!operationId) return;
  const db = await openDatabase();
  await transact(db, [OPERATIONS], "readwrite", tx => {
    const store = tx.objectStore(OPERATIONS);
    const request = store.get(operationId);
    request.onsuccess = () => {
      if (!request.result) return;
      store.put({
        ...request.result,
        attempts: (request.result.attempts || 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: errorMessage,
      });
    };
  });
}

export async function acknowledgeEducationalOperations(accountId, operationIds) {
  if (!accountId || !Array.isArray(operationIds) || !operationIds.length) return;
  const db = await openDatabase();
  await transact(db, [OPERATIONS], "readwrite", tx => {
    const store = tx.objectStore(OPERATIONS);
    for (const operationId of operationIds) {
      const request = store.get(operationId);
      request.onsuccess = () => {
        const item = request.result;
        if (item && item.accountId === accountId) store.delete(operationId);
      };
    }
  });
}

export async function saveEducationalOfflineMeta(accountId, values) {
  if (!accountId || !values || typeof values !== "object") throw new Error("بيانات اعتماد العمل دون اتصال غير مكتملة.");
  const db = await openDatabase();
  await transact(db, [META], "readwrite", tx => {
    const store = tx.objectStore(META);
    const request = store.get(accountId);
    request.onsuccess = () => store.put({ ...(request.result || {}), ...values, accountId });
  });
}

export async function readEducationalOfflineMeta(accountId) {
  if (!accountId) return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(META, "readonly").objectStore(META).get(accountId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("تعذر قراءة بيانات العمل دون اتصال."));
  });
}

// Deliberately no database deletion, queue clearing, or account-wide cleanup API.
// Pending teacher records must survive logout, expiry, account switching, and retries.

export async function updateEducationalOperationStatus(operationId, status, errorMessage = null) {
  if (!operationId) return;
  const allowed = ["pending", "syncing", "failed", "needs_review"];
  if (!allowed.includes(status)) throw new Error("حالة مزامنة غير معروفة.");
  const db = await openDatabase();
  await transact(db, [OPERATIONS], "readwrite", tx => {
    const store = tx.objectStore(OPERATIONS);
    const request = store.get(operationId);
    request.onsuccess = () => {
      if (!request.result) return;
      store.put({
        ...request.result,
        status,
        lastError: errorMessage,
        lastAttemptAt: new Date().toISOString(),
        attempts: (request.result.attempts || 0) + (status === "syncing" ? 1 : 0),
      });
    };
  });
}
