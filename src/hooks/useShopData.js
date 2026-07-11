import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, SHOP_ID } from '../firebase.js';
import { formatInvoiceNo, normalizeBangladeshPhone, num } from '../lib/utils.js';

function subscribe(colName, orderField, setState, setError) {
  const ref = query(collection(db, 'shops', SHOP_ID, colName), orderBy(orderField, 'desc'));
  return onSnapshot(
    ref,
    (snap) => {
      setError?.(null);
      setState(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => setError?.({ code: err.code, message: err.message || 'Sync failed' })
  );
}

export function useShopData() {
  const [stock, setStock] = useState([]);
  const [sales, setSales] = useState([]);
  const [dues, setDues] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [activity, setActivity] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubs = [
      subscribe('stock', 'updatedAt', setStock, setError),
      subscribe('sales', 'createdAt', setSales, setError),
      subscribe('dues', 'updatedAt', setDues, setError),
      subscribe('ledger', 'createdAt', setLedger, setError),
      subscribe('exchanges', 'createdAt', setExchanges, setError),
      subscribe('activity', 'createdAt', setActivity, setError),
      subscribe('customers', 'updatedAt', setCustomers, setError),
      subscribe('purchases', 'createdAt', setPurchases, setError),
      subscribe('suppliers', 'updatedAt', setSuppliers, setError),
    ];
    setReady(true);
    return () => unsubs.forEach((u) => u());
  }, []);

  const stockById = useMemo(() => Object.fromEntries(stock.map((s) => [s.id, s])), [stock]);
  const customersByPhone = useMemo(
    () => Object.fromEntries(customers.map((c) => [normalizeBangladeshPhone(c.phone), c])),
    [customers]
  );

  return {
    stock,
    sales,
    dues,
    ledger,
    exchanges,
    activity,
    customers,
    purchases,
    suppliers,
    stockById,
    customersByPhone,
    ready,
    error,
  };
}

async function logActivity(actorName, action, detail) {
  await addDoc(collection(db, 'shops', SHOP_ID, 'activity'), {
    actorName,
    action,
    detail,
    createdAt: serverTimestamp(),
  });
}

async function nextInvoiceSeq() {
  const counterRef = doc(db, 'shops', SHOP_ID, 'counters', 'sales');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = snap.exists() ? num(snap.data().seq) + 1 : 1;
    tx.set(counterRef, { seq: next, updatedAt: serverTimestamp() }, { merge: true });
    return next;
  });
}

export async function addStockItem(item, actorName) {
  const ref = await addDoc(collection(db, 'shops', SHOP_ID, 'stock'), {
    ...item,
    status: item.status || 'in_stock',
    shopId: SHOP_ID,
    createdBy: actorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    version: 1,
  });
  await logActivity(actorName, 'stock_add', `Added ${item.brand || ''} ${item.model || ''}`.trim());
  return ref.id;
}

export async function updateStockItem(stockId, patch, actorName) {
  await updateDoc(doc(db, 'shops', SHOP_ID, 'stock', stockId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  await logActivity(actorName, 'stock_update', `Updated stock item ${stockId}`);
}

export async function addCustomer(customer, actorName) {
  const phone = normalizeBangladeshPhone(customer.phone);
  const ref = doc(db, 'shops', SHOP_ID, 'customers', phone);
  await setDoc(
    ref,
    {
      name: customer.name,
      phone,
      address: customer.address || '',
      status: 'active',
      createdBy: actorName,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  await logActivity(actorName, 'customer_add', `Added customer ${customer.name}`);
  return phone;
}

export async function addSupplier(supplier, actorName) {
  const ref = await addDoc(collection(db, 'shops', SHOP_ID, 'suppliers'), {
    name: supplier.name,
    phone: normalizeBangladeshPhone(supplier.phone || ''),
    address: supplier.address || '',
    status: 'active',
    createdBy: actorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logActivity(actorName, 'supplier_add', `Added supplier ${supplier.name}`);
  return ref.id;
}

export async function recordPurchase(purchase, actorName) {
  const totalCost = num(purchase.totalCost) || num(purchase.unitCost) * num(purchase.quantity, 1);
  const paidAmount = num(purchase.paidAmount);
  const dueAmount = Math.max(totalCost - paidAmount, 0);
  const ref = await addDoc(collection(db, 'shops', SHOP_ID, 'purchases'), {
    ...purchase,
    totalCost,
    paidAmount,
    dueAmount,
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'shops', SHOP_ID, 'ledger'), {
    type: 'purchase',
    amount: totalCost,
    note: purchase.productLabel || purchase.supplierName || 'Purchase',
    supplierName: purchase.supplierName,
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });
  await logActivity(actorName, 'purchase', `Purchase ${purchase.productLabel || 'item'} for Tk ${totalCost}`);
  return ref.id;
}

export async function recordSale(sale, actorName) {
  const subtotal = num(sale.subtotal ?? sale.sellPrice);
  const discount = num(sale.discount);
  const grandTotal = Math.max(subtotal - discount, 0);
  const paidAmount = num(sale.paidAmount);
  const dueAmount = Math.max(grandTotal - paidAmount, 0);
  const invoiceSeq = await nextInvoiceSeq();
  const invoiceNo = formatInvoiceNo(invoiceSeq);

  const saleRef = await addDoc(collection(db, 'shops', SHOP_ID, 'sales'), {
    ...sale,
    invoiceNo,
    subtotal,
    discount,
    sellPrice: grandTotal,
    grandTotal,
    paidAmount,
    dueAmount,
    paymentStatus: dueAmount > 0 ? 'due' : 'paid',
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });

  if (sale.stockItemId) {
    await updateDoc(doc(db, 'shops', SHOP_ID, 'stock', sale.stockItemId), {
      status: 'sold',
      updatedAt: serverTimestamp(),
    });
  }

  if (sale.customerPhone) {
    await addCustomer(
      {
        name: sale.customerName,
        phone: sale.customerPhone,
        address: sale.customerAddress,
      },
      actorName
    );
  }

  if (dueAmount > 0 && sale.customerPhone) {
    await upsertDue(
      {
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        customerAddress: sale.customerAddress,
        deltaDue: dueAmount,
      },
      actorName
    );
  }

  await logActivity(
    actorName,
    'sale',
    `${invoiceNo}: ${sale.productLabel || 'item'} Tk ${grandTotal}${dueAmount > 0 ? ` (due Tk ${dueAmount})` : ''}`
  );
  return { id: saleRef.id, invoiceNo, grandTotal, dueAmount };
}

export async function upsertDue({ customerName, customerPhone, customerAddress, deltaDue }, actorName) {
  const phone = normalizeBangladeshPhone(customerPhone);
  const dueRef = doc(db, 'shops', SHOP_ID, 'dues', phone);
  const existing = await getDoc(dueRef);
  const currentDue = existing.exists() ? num(existing.data().totalDue) : 0;
  await setDoc(
    dueRef,
    {
      customerName,
      customerPhone: phone,
      customerAddress,
      totalDue: currentDue + num(deltaDue),
      updatedAt: serverTimestamp(),
      createdBy: actorName,
    },
    { merge: true }
  );
}

export async function collectDue(customerPhone, amount, actorName) {
  const phone = normalizeBangladeshPhone(customerPhone);
  const dueRef = doc(db, 'shops', SHOP_ID, 'dues', phone);
  const existing = await getDoc(dueRef);
  const currentDue = existing.exists() ? num(existing.data().totalDue) : 0;
  const collected = Math.min(num(amount), currentDue);
  const remaining = Math.max(currentDue - collected, 0);

  await addDoc(collection(db, 'shops', SHOP_ID, 'ledger'), {
    type: 'due_collection',
    amount: collected,
    customerPhone: phone,
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });
  await updateDoc(dueRef, {
    totalDue: remaining,
    updatedAt: serverTimestamp(),
  });
  await logActivity(actorName, 'due_collection', `Collected Tk ${collected} from ${phone}`);
}

export async function addLedgerEntry(entry, actorName) {
  await addDoc(collection(db, 'shops', SHOP_ID, 'ledger'), {
    ...entry,
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });
  await logActivity(actorName, 'ledger', `${entry.type || 'entry'}: Tk ${num(entry.amount)}`);
}

export async function addExchange(exchange, actorName) {
  const ref = await addDoc(collection(db, 'shops', SHOP_ID, 'exchanges'), {
    ...exchange,
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });

  if (exchange.newPhoneStockId) {
    await updateDoc(doc(db, 'shops', SHOP_ID, 'stock', exchange.newPhoneStockId), {
      status: 'exchanged',
      updatedAt: serverTimestamp(),
    });
  }

  if (num(exchange.dueAmount) > 0 && exchange.customerPhone) {
    await upsertDue(
      {
        customerName: exchange.customerName,
        customerPhone: exchange.customerPhone,
        customerAddress: exchange.customerAddress,
        deltaDue: exchange.dueAmount,
      },
      actorName
    );
  }

  await logActivity(actorName, 'exchange', `Exchange for ${exchange.customerName || 'customer'}`);
  return ref.id;
}
