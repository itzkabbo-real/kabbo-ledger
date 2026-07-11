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
    invoiceNo: raw.invoiceNo || '',
    stockItemId: raw.stockItemId || '',
    productLabel: raw.productLabel || raw.deviceName || raw.name || '',
    subtotal: num(raw.subtotal ?? raw.sellPrice ?? raw.amount ?? raw.price),
    sellPrice,
    discount: num(raw.discount),
    grandTotal: num(raw.grandTotal ?? sellPrice),
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

export function formatFirestoreError(err) {
  if (!err) return '';
  if (err.code === 'permission-denied') {
    return 'Permission denied — your account cannot write to the shop yet. Open Settings or ask the owner to set your role to Manager, then sign out and back in.';
  }
  return err.message || 'Something went wrong';
}

export function inviteKeyFromInput(input = '') {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  if (isValidBangladeshPhone(trimmed)) return phoneToAuthEmail(trimmed);
  return trimmed;
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

// Shopstick uses +88 phone + password. Firebase Auth needs an email, so we map
// phone numbers to a stable internal email the owner sets up once in Firebase.
const PHONE_AUTH_DOMAIN = 'kabbomobile.shop';

export function normalizeBangladeshPhone(input = '') {
  const digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('0')) return `+88${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+88${digits.startsWith('0') ? digits : `0${digits}`}`;
  return input.startsWith('+') ? input : `+${digits}`;
}

export function isValidBangladeshPhone(input = '') {
  const phone = normalizeBangladeshPhone(input);
  return /^\+8801[3-9]\d{8}$/.test(phone);
}

export function phoneToAuthEmail(phone = '') {
  const normalized = normalizeBangladeshPhone(phone);
  const digits = normalized.replace(/\D/g, '');
  return `phone.${digits}@${PHONE_AUTH_DOMAIN}`;
}

export function authEmailToPhone(email = '') {
  const match = String(email).match(/^phone\.(\d+)@/);
  if (!match) return '';
  const digits = match[1];
  if (digits.startsWith('880')) return `0${digits.slice(2)}`;
  return digits;
}

export function normalizeCustomer(raw = {}) {
  return {
    id: raw.id,
    name: raw.name || raw.customerName || '',
    phone: normalizeBangladeshPhone(raw.phone || raw.customerPhone || ''),
    address: raw.address || raw.customerAddress || '',
    status: raw.status || 'active',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    createdBy: raw.createdBy || 'Unknown',
  };
}

export function normalizePurchase(raw = {}) {
  return {
    id: raw.id,
    supplierName: raw.supplierName || raw.supplier || '',
    supplierPhone: raw.supplierPhone || '',
    productLabel: raw.productLabel || raw.name || '',
    quantity: num(raw.quantity, 1),
    unitCost: num(raw.unitCost ?? raw.buyPrice),
    totalCost: num(raw.totalCost ?? raw.amount),
    paidAmount: num(raw.paidAmount),
    dueAmount: num(raw.dueAmount),
    notes: raw.notes || '',
    createdAt: raw.createdAt || null,
    createdBy: raw.createdBy || 'Unknown',
  };
}

export function formatInvoiceNo(seq, date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = String(seq).padStart(4, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INV-${y}${m}${d}-${suffix}-${rand}`;
}
