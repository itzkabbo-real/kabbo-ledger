
// Lightweight pure re-implementation check (mirrors useShopData mergePendingIntoState)
function mergePendingIntoState(cloudState, pending) {
  const entries = new Map((cloudState.entries || []).map((e) => [e.id, e]));
  const customers = new Map((cloudState.customers || []).map((c) => [c.id, c]));
  let openingCashByDate = { ...(cloudState.openingCashByDate || {}) };
  for (const op of pending || []) {
    if (op.kind === "entry-set") entries.set(op.id, { ...op.data, id: op.id });
    if (op.kind === "entry-delete") entries.delete(op.id);
    if (op.kind === "customer-set") customers.set(op.id, { ...op.data, id: op.id });
    if (op.kind === "customer-delete") customers.delete(op.id);
    if (op.kind === "settings") {
      openingCashByDate = { ...openingCashByDate, ...(op.data?.openingCashByDate || {}) };
    }
  }
  return {
    entries: [...entries.values()],
    customers: [...customers.values()],
    openingCashByDate,
  };
}

const cloud = { entries: [{ id: "a", model: "cloud" }], customers: [], openingCashByDate: {} };
const pending = [
  { kind: "entry-set", id: "b", data: { id: "b", model: "manager-local" } },
  { kind: "entry-set", id: "a", data: { id: "a", model: "updated" } },
];
const merged = mergePendingIntoState(cloud, pending);
if (merged.entries.length !== 2) throw new Error("expected 2");
if (merged.entries.find((e) => e.id === "b").model !== "manager-local") throw new Error("missing b");
if (merged.entries.find((e) => e.id === "a").model !== "updated") throw new Error("missing update");
console.log("sync merge tests passed");
