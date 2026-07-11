// Normalization helpers so old-shaped documents (deviceName, amount, cost, prepCost,
// due, dueAmount ...) keep rendering correctly next to new-shaped ones. We add fields
// instead of migrating/deleting old data, so nothing already synced is ever destroyed.

export const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeStockItem(raw = {}) {
  return {
    id: raw.id,
    brand: raw.brand || '',
    model: raw.model || raw.deviceName || raw.name || '',
    storage: raw.storage || '',
    color: raw.color || '',
    imeiSerial: raw.imeiSerial || raw.imei || raw.serial || '',
    quantity: num(raw.quantity, raw.qty !== undefined ? num(raw.qty) : 1),
    buyPrice: num(raw.buyPrice ?? raw.cost),
    preparationCost: num(raw.preparationCost ?? raw.prepCost),
    sellPrice: num(raw.sellPrice ?? raw.askingPrice ?? raw.price),
    supplierName: raw.supplierName || raw.supplier || '',
    warrantyDays: num(raw.warrantyDays, 0),
    status: raw.status || 'in_stock',
    certChecklist: raw.certChecklist || null,
    notes: raw.notes || raw.deviceHistoryNotes || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    createdBy: raw.createdBy || raw.createdByName || 'Unknown',
    shopId: raw.shopId || '',
  };
}

export function normalizeSale(raw = {}) {
  const sellPrice = num(raw.finalSellPrice ?? raw.sellPrice ?? raw.amount ?? raw.price);
  const paidAmount = num(raw.paidAmount ?? (raw.paymentStatus === 'paid' ? sellPrice : 0));
  const dueAmount = num(raw.dueAmount ?? raw.due ?? Math.max(sellPrice - paidAmount, 0));
  return {
    id: raw.id,
    stockItemId: raw.stockItemId || '',
    productLabel: raw.productLabel || raw.deviceName || raw.name || '',
    sellPrice,
    discount: num(raw.discount),
    paidAmount,
    dueAmount,
    paymentMethod: raw.paymentMethod || 'cash',
    paymentStatus: dueAmount > 0 ? 'due' : 'paid',
    customerName: raw.customerName || '',
    customerPhone: raw.customerPhone || '',
    customerAddress: raw.customerAddress || '',
    createdAt: raw.createdAt || null,
    createdBy: raw.createdBy || raw.createdByName || 'Unknown',
  };
}

export function normalizeDue(raw = {}) {
  return {
    id: raw.id,
    customerName: raw.customerName || raw.name || '',
    customerPhone: raw.customerPhone || raw.phone || '',
    customerAddress: raw.customerAddress || raw.address || '',
    totalDue: num(raw.totalDue ?? raw.dueAmount ?? raw.due),
    updatedAt: raw.updatedAt || null,
    createdBy: raw.createdBy || raw.createdByName || 'Unknown',
  };
}

export function displayName(item) {
  const it = normalizeStockItem(item);
  return [it.brand, it.model, it.storage, it.color].filter(Boolean).join(' ');
}

export function formatMoney(value) {
  return `Tk ${num(value).toLocaleString('en-BD')}`;
}

export function timeAgo(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
