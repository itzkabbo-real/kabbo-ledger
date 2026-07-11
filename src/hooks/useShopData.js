import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, SHOP_ID } from '../firebase.js';
import { num } from '../lib/utils.js';

function subscribe(colName, orderField, setState, setError) {
  const ref = query(collection(db, 'shops', SHOP_ID, colName), orderBy(orderField, 'desc'));
  return onSnapshot(
    ref,
    (snap) => {
      setState(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => setError?.(err)
  );
}

// Every screen that calls useShopData() opens a live onSnapshot listener on the
// SAME shop-scoped collections. That is the whole fix for "manager input doesn't
// reach my feed": as soon as a manager's device writes a document, Firestore pushes
// the change to every other open listener - owner dashboard, reports, other staff -
// typically in well under a second, online or the moment connectivity returns.
export function useShopData() {
  const [stock, setStock] = useState([]);
  const [sales, setSales] = useState([]);
  const [dues, setDues] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [activity, setActivity] = useState([]);
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
    ];
    setReady(true);
    return () => unsubs.forEach((u) => u());
  }, []);

  const stockById = useMemo(() => Object.fromEntries(stock.map((s) => [s.id, s])), [stock]);

  return { stock, sales, dues, ledger, exchanges, activity, stockById, ready, error };
}

async function logActivity(actorName, action, detail) {
  await addDoc(collection(db, 'shops', SHOP_ID, 'activity'), {
    actorName,
    action,
    detail,
    createdAt: serverTimestamp(),
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

export async function recordSale(sale, actorName) {
  const dueAmount = Math.max(num(sale.sellPrice) - num(sale.paidAmount), 0);
  const saleRef = await addDoc(collection(db, 'shops', SHOP_ID, 'sales'), {
    ...sale,
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
    `Sold ${sale.productLabel || 'item'} for Tk ${num(sale.sellPrice)}${dueAmount > 0 ? ` (due Tk ${dueAmount})` : ''}`
  );
  return saleRef.id;
}

export async function upsertDue({ customerName, customerPhone, customerAddress, deltaDue }, actorName) {
  const dueRef = doc(db, 'shops', SHOP_ID, 'dues', customerPhone);
  await setDoc(
    dueRef,
    {
      customerName,
      customerPhone,
      customerAddress,
      totalDue: num(deltaDue),
      updatedAt: serverTimestamp(),
      createdBy: actorName,
    },
    { merge: true }
  );
}

export async function collectDue(customerPhone, amount, actorName) {
  const dueRef = doc(db, 'shops', SHOP_ID, 'dues', customerPhone);
  await addDoc(collection(db, 'shops', SHOP_ID, 'ledger'), {
    type: 'due_collection',
    amount: num(amount),
    customerPhone,
    createdBy: actorName,
    createdAt: serverTimestamp(),
  });
  await updateDoc(dueRef, { updatedAt: serverTimestamp() });
  await logActivity(actorName, 'due_collection', `Collected Tk ${num(amount)} from ${customerPhone}`);
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
