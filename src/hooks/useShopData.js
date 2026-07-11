import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase.js";
import { SHOP_ID } from "../lib/firebaseConfig.js";

const CACHE_KEY = "kabbo-ledger-v5-prod";
const LEGACY_KEYS = ["kabbo-ledger-v4", "kabbo-ledger-v3"];
const PENDING_KEY = "kabbo-pending-sync";

function normalizeState(raw) {
  return {
    entries: Array.isArray(raw?.entries) ? raw.entries : [],
    openingCashByDate: raw?.openingCashByDate || {},
    customers: Array.isArray(raw?.customers) ? raw.customers : [],
  };
}

function loadLocal() {
  try {
    for (const key of [CACHE_KEY, ...LEGACY_KEYS]) {
      const raw = localStorage.getItem(key);
      if (raw) return normalizeState(JSON.parse(raw));
    }
  } catch {
    /* ignore */
  }
  return { entries: [], openingCashByDate: {}, customers: [] };
}

function saveLocal(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    /* ignore */
  }
}

function loadPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(ops) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(ops));
  } catch {
    /* ignore */
  }
}

function stripLocal(data) {
  const next = { ...data };
  delete next._localOnly;
  return next;
}

function nowIso() {
  return new Date().toISOString();
}

/** Apply pending ops on top of a cloud snapshot so failed writes are not wiped. */
export function mergePendingIntoState(cloudState, pending) {
  const entries = new Map(
    (cloudState.entries || []).map((e) => [e.id, e])
  );
  const customers = new Map(
    (cloudState.customers || []).map((c) => [c.id, c])
  );
  let openingCashByDate = { ...(cloudState.openingCashByDate || {}) };

  for (const op of pending || []) {
    if (op.kind === "entry-set") entries.set(op.id, { ...op.data, id: op.id });
    if (op.kind === "entry-delete") entries.delete(op.id);
    if (op.kind === "customer-set")
      customers.set(op.id, { ...op.data, id: op.id });
    if (op.kind === "customer-delete") customers.delete(op.id);
    if (op.kind === "settings") {
      openingCashByDate = {
        ...openingCashByDate,
        ...(op.data?.openingCashByDate || {}),
      };
    }
  }

  return {
    entries: [...entries.values()].sort((a, b) =>
      String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
    ),
    customers: [...customers.values()],
    openingCashByDate,
  };
}

export async function flushPendingOps(ops) {
  if (!db || !ops.length) return [];
  const batch = writeBatch(db);
  let n = 0;
  const rest = [];
  for (const op of ops) {
    if (n >= 400) {
      rest.push(op);
      continue;
    }
    if (op.kind === "entry-set") {
      batch.set(doc(db, "shops", SHOP_ID, "entries", op.id), stripLocal(op.data), {
        merge: true,
      });
      n += 1;
    } else if (op.kind === "entry-delete") {
      batch.delete(doc(db, "shops", SHOP_ID, "entries", op.id));
      n += 1;
    } else if (op.kind === "customer-set") {
      batch.set(
        doc(db, "shops", SHOP_ID, "customers", op.id),
        stripLocal(op.data),
        { merge: true }
      );
      n += 1;
    } else if (op.kind === "customer-delete") {
      batch.delete(doc(db, "shops", SHOP_ID, "customers", op.id));
      n += 1;
    } else if (op.kind === "settings") {
      batch.set(doc(db, "shops", SHOP_ID, "settings", "main"), op.data, {
        merge: true,
      });
      n += 1;
    }
  }
  if (n > 0) await batch.commit();
  return rest;
}

export function diffStates(prev, next) {
  const ops = [];
  const prevEntries = new Map((prev.entries || []).map((e) => [e.id, e]));
  const nextEntries = new Map((next.entries || []).map((e) => [e.id, e]));
  for (const [id, row] of nextEntries) {
    const old = prevEntries.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(row)) {
      ops.push({
        kind: "entry-set",
        id,
        data: { ...row, updatedAt: nowIso() },
      });
    }
  }
  for (const [id] of prevEntries) {
    if (!nextEntries.has(id)) ops.push({ kind: "entry-delete", id });
  }

  const prevCustomers = new Map((prev.customers || []).map((c) => [c.id, c]));
  const nextCustomers = new Map((next.customers || []).map((c) => [c.id, c]));
  for (const [id, row] of nextCustomers) {
    const old = prevCustomers.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(row)) {
      ops.push({ kind: "customer-set", id, data: row });
    }
  }
  for (const [id] of prevCustomers) {
    if (!nextCustomers.has(id)) ops.push({ kind: "customer-delete", id });
  }

  if (
    JSON.stringify(prev.openingCashByDate || {}) !==
    JSON.stringify(next.openingCashByDate || {})
  ) {
    ops.push({
      kind: "settings",
      data: { openingCashByDate: next.openingCashByDate || {} },
    });
  }
  return ops;
}

/**
 * Live shared shop state.
 * FIXES vs previous live build:
 * 1) Cloud snapshots merge pending local ops (manager writes no longer vanish).
 * 2) Listener permission errors → sync-failed (not fake offline).
 * 3) Flush errors keep queue and surface sync-failed for retry.
 */
export function useShopData(user) {
  const [state, setStateRaw] = useState(loadLocal);
  const [syncStatus, setSyncStatus] = useState("loading");
  const [syncError, setSyncError] = useState("");
  const stateRef = useRef(state);
  const hydratedRef = useRef(false);
  const flushingRef = useRef(false);
  const cloudRef = useRef({
    entries: [],
    customers: [],
    openingCashByDate: {},
  });
  const seededRef = useRef(false);

  const flush = useCallback(async () => {
    if (!db || flushingRef.current) return;
    flushingRef.current = true;
    try {
      let queue = loadPending();
      while (queue.length) {
        const remaining = await flushPendingOps(queue);
        savePending(remaining);
        if (remaining.length === queue.length) break;
        queue = remaining;
      }
      if (navigator.onLine) {
        setSyncStatus(loadPending().length ? "syncing" : "synced");
        if (!loadPending().length) setSyncError("");
      }
    } catch (err) {
      console.warn("sync flush failed:", err?.code || err);
      setSyncStatus("sync-failed");
      setSyncError(err?.code || err?.message || "Sync failed");
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!db || !user) {
      setSyncStatus("loading");
      return undefined;
    }

    let cancelled = false;
    const unsubs = [];

    const publish = () => {
      if (cancelled) return;
      const merged = mergePendingIntoState(cloudRef.current, loadPending());
      setStateRaw(merged);
      saveLocal(merged);
      stateRef.current = merged;
      hydratedRef.current = true;
      if (!navigator.onLine) setSyncStatus("offline");
      else if (loadPending().length) setSyncStatus("syncing");
      else setSyncStatus("synced");
    };

    async function seedIfCloudEmpty(snap) {
      if (seededRef.current || snap.size > 0) return;
      const local = loadLocal();
      if (!local.entries.length && !local.customers.length) return;
      seededRef.current = true;
      const batch = writeBatch(db);
      let n = 0;
      for (const row of local.entries) {
        batch.set(doc(db, "shops", SHOP_ID, "entries", row.id), stripLocal(row), {
          merge: true,
        });
        n += 1;
      }
      for (const row of local.customers) {
        batch.set(
          doc(db, "shops", SHOP_ID, "customers", row.id),
          stripLocal(row),
          { merge: true }
        );
        n += 1;
      }
      if (Object.keys(local.openingCashByDate || {}).length) {
        batch.set(
          doc(db, "shops", SHOP_ID, "settings", "main"),
          { openingCashByDate: local.openingCashByDate },
          { merge: true }
        );
        n += 1;
      }
      if (n) await batch.commit();
    }

    const onListenError = (err) => {
      console.warn("firestore listen error:", err?.code || err);
      setSyncStatus("sync-failed");
      setSyncError(err?.code || err?.message || "Listen failed");
    };

    unsubs.push(
      onSnapshot(
        collection(db, "shops", SHOP_ID, "entries"),
        async (snap) => {
          try {
            await seedIfCloudEmpty(snap);
          } catch (err) {
            console.warn("seed failed:", err?.code || err);
            setSyncStatus("sync-failed");
            setSyncError(err?.code || err?.message || "Seed failed");
          }
          cloudRef.current.entries = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          publish();
        },
        onListenError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, "shops", SHOP_ID, "customers"),
        (snap) => {
          cloudRef.current.customers = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          publish();
        },
        onListenError
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, "shops", SHOP_ID, "settings", "main"),
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          cloudRef.current.openingCashByDate = data.openingCashByDate || {};
          publish();
        },
        onListenError
      )
    );

    flush();

    const onOnline = () => {
      setSyncStatus("syncing");
      flush();
    };
    const onOffline = () => setSyncStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user, flush]);

  const setState = useCallback(
    (updater) => {
      setStateRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveLocal(next);
        if (db && user && hydratedRef.current) {
          const ops = diffStates(prev, next);
          if (ops.length) {
            if (navigator.onLine) {
              const queued = loadPending();
              setSyncStatus("syncing");
              flushPendingOps([...queued, ...ops])
                .then((remaining) => {
                  savePending(remaining);
                  setSyncStatus(remaining.length ? "sync-failed" : "synced");
                  if (remaining.length) {
                    setSyncError("Some changes could not sync — retry when online");
                  } else {
                    setSyncError("");
                  }
                })
                .catch((err) => {
                  savePending([...loadPending(), ...ops]);
                  setSyncStatus("sync-failed");
                  setSyncError(err?.code || err?.message || "Sync failed");
                });
            } else {
              savePending([...loadPending(), ...ops]);
              setSyncStatus("offline");
            }
          }
        }
        stateRef.current = next;
        return next;
      });
    },
    [user]
  );

  return { state, setState, syncStatus, syncError, retrySync: flush };
}
