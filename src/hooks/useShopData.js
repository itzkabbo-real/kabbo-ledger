import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db, SHOP_ID } from "../lib/firebase";
import { normalizeStock, number, validateSale } from "../lib/domain";

const shopCollection = (name) => collection(db, "shops", SHOP_ID, name);
const cleanImei = (value) => String(value || "").replace(/\D/g, "");
const date = () => new Date().toISOString().slice(0, 10);

export function useShopData(user) {
  const [data, setData] = useState({ entries: [], stock: [], customers: [] });
  const [sync, setSync] = useState({
    state: navigator.onLine ? "connecting" : "offline",
    message: "",
    pending: false,
    fromCache: false,
  });

  useEffect(() => {
    const online = () => setSync((value) => ({ ...value, state: "connecting" }));
    const offline = () => setSync((value) => ({ ...value, state: "offline" }));
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (!user || !db) return undefined;
    const pendingBySource = {};
    const cacheBySource = {};
    const unsubscribe = ["entries", "stock", "customers"].map((name) =>
      onSnapshot(
        shopCollection(name),
        { includeMetadataChanges: true },
        (snapshot) => {
          const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
          records.sort((a, b) => {
            const left = a.createdAt?.toMillis?.() || Date.parse(a.date || 0) || 0;
            const right = b.createdAt?.toMillis?.() || Date.parse(b.date || 0) || 0;
            return right - left;
          });
          setData((value) => ({ ...value, [name]: records }));
          pendingBySource[name] = snapshot.metadata.hasPendingWrites;
          cacheBySource[name] = snapshot.metadata.fromCache;
          const pending = Object.values(pendingBySource).some(Boolean);
          const fromCache = Object.values(cacheBySource).some(Boolean);
          setSync({
            state: !navigator.onLine ? "offline" : pending ? "syncing" : "synced",
            pending,
            fromCache,
            message: "",
          });
        },
        (error) =>
          setSync({
            state: "failed",
            message: `${name}: ${error.message}`,
            pending: false,
            fromCache: false,
          }),
      ),
    );
    return () => unsubscribe.forEach((stop) => stop());
  }, [user]);

  const commit = useCallback(async (batch) => {
    setSync((value) => ({ ...value, state: navigator.onLine ? "syncing" : "offline" }));
    const pendingCommit = batch.commit();
    if (!navigator.onLine) {
      pendingCommit.catch((error) =>
        setSync({ state: "failed", message: error.message, pending: false, fromCache: true }),
      );
      return { queued: true };
    }
    await pendingCommit;
    return { queued: false };
  }, []);

  const auditFields = useCallback(
    () => ({
      shopId: SHOP_ID,
      createdBy: user.uid,
      createdByEmail: user.email || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      date: date(),
      version: 1,
    }),
    [user],
  );

  const addStock = useCallback(
    async (form) => {
      const imeiSerial = cleanImei(form.imeiSerial);
      if (!form.model?.trim()) throw new Error("Model / device name is required");
      if (number(form.quantity) < 1) throw new Error("Quantity must be at least 1");
      if (number(form.buyPrice) <= 0) throw new Error("Buy price is required");

      const batch = writeBatch(db);
      const stockRef = doc(shopCollection("stock"));
      const entryRef = doc(shopCollection("entries"));
      const batteryHealth = number(form.batteryHealth);
      const risky = form.icloudFrpStatus === "locked";
      const warning = !imeiSerial || (batteryHealth > 0 && batteryHealth < 75) || !form.certChecksPassed;
      const item = {
        ...auditFields(),
        category: form.category || "Used Phone",
        brand: form.brand?.trim() || "",
        model: form.model.trim(),
        storage: form.storage?.trim() || "",
        color: form.color?.trim() || "",
        imeiSerial,
        quantity: number(form.quantity),
        soldQuantity: 0,
        buyPrice: number(form.buyPrice),
        preparationCost: number(form.preparationCost),
        sellPrice: number(form.sellPrice),
        supplierName: form.supplierName?.trim() || "",
        warrantyDays: number(form.warrantyDays),
        notes: form.notes?.trim() || "",
        status: "in_stock",
        certChecklist: {
          imeiChecked: Boolean(imeiSerial),
          batteryHealth,
          icloudFrpStatus: form.icloudFrpStatus || "unknown",
          deviceHistoryNotes: form.notes?.trim() || "",
          warrantyDays: number(form.warrantyDays),
          finalGrade: risky ? "Risky" : warning ? "Warning" : "Certified",
          certifiedResult: risky ? "fail" : warning ? "warning" : "pass",
        },
      };
      batch.set(stockRef, item);
      batch.set(entryRef, {
        ...auditFields(),
        type: "buy",
        stockId: stockRef.id,
        amount: (item.buyPrice + item.preparationCost) * item.quantity,
        product: `${item.brand} ${item.model}`.trim(),
        imeiSerial,
      });
      if (imeiSerial) {
        batch.set(doc(db, "shops", SHOP_ID, "imeiIndex", imeiSerial), {
          stockId: stockRef.id,
          active: true,
          ...auditFields(),
        });
      }
      return commit(batch);
    },
    [auditFields, commit],
  );

  const saveSale = useCallback(
    async (form) => {
      const stockItem = data.stock.find((item) => item.id === form.stockId);
      const errors = validateSale({ ...form, stockItem });
      if (errors.length) throw new Error(errors.join(". "));
      const item = normalizeStock(stockItem);
      const due = Math.max(0, number(form.finalSellPrice) - number(form.paidAmount));
      const customerId = String(form.customerPhone || "").replace(/\D/g, "") || null;
      const batch = writeBatch(db);
      const entryRef = doc(shopCollection("entries"));

      batch.update(doc(db, "shops", SHOP_ID, "stock", item.id), {
        soldQuantity: increment(1),
        status: item.availableQty === 1 ? "sold" : "in_stock",
        updatedAt: serverTimestamp(),
        lastOperationId: entryRef.id,
      });
      batch.set(entryRef, {
        ...auditFields(),
        type: "sale",
        stockId: item.id,
        product: `${item.brand} ${item.model}`.trim(),
        imeiSerial: item.imeiSerial,
        buyPrice: item.buyPrice,
        preparationCost: item.preparationCost,
        askingPrice: item.sellPrice,
        finalSellPrice: number(form.finalSellPrice),
        paidAmount: number(form.paidAmount),
        dueAmount: due,
        paymentMethod: form.paymentMethod || "cash",
        paymentStatus: due > 0 ? "due" : "paid",
        customerId,
        customerName: form.customerName?.trim() || "",
        customerPhone: form.customerPhone?.trim() || "",
        customerAddress: form.customerAddress?.trim() || "",
      });
      if (item.imeiSerial && item.availableQty === 1) {
        batch.update(doc(db, "shops", SHOP_ID, "imeiIndex", cleanImei(item.imeiSerial)), {
          active: false,
          soldEntryId: entryRef.id,
          updatedAt: serverTimestamp(),
        });
      }
      if (due > 0 && customerId) {
        batch.set(
          doc(db, "shops", SHOP_ID, "customers", customerId),
          {
            name: form.customerName.trim(),
            phone: form.customerPhone.trim(),
            address: form.customerAddress?.trim() || "",
            dueBalance: increment(due),
            totalDueCreated: increment(due),
            updatedAt: serverTimestamp(),
            shopId: SHOP_ID,
            lastOperationId: entryRef.id,
          },
          { merge: true },
        );
      }
      const result = await commit(batch);
      return { ...result, entryId: entryRef.id };
    },
    [auditFields, commit, data.stock],
  );

  const collectDue = useCallback(
    async (customer, amount) => {
      const paid = number(amount);
      if (!paid || paid > number(customer.dueBalance)) throw new Error("Enter a valid collection amount");
      const batch = writeBatch(db);
      const entryRef = doc(shopCollection("entries"));
      batch.update(doc(db, "shops", SHOP_ID, "customers", customer.id), {
        dueBalance: increment(-paid),
        totalCollected: increment(paid),
        updatedAt: serverTimestamp(),
        lastOperationId: entryRef.id,
      });
      batch.set(entryRef, {
        ...auditFields(),
        type: "due_collection",
        amount: paid,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
      });
      return commit(batch);
    },
    [auditFields, commit],
  );

  const addExpense = useCallback(
    async ({ amount, note }) => {
      if (number(amount) <= 0 || !note?.trim()) throw new Error("Amount and description are required");
      const batch = writeBatch(db);
      batch.set(doc(shopCollection("entries")), {
        ...auditFields(),
        type: "expense",
        amount: number(amount),
        note: note.trim(),
      });
      return commit(batch);
    },
    [auditFields, commit],
  );

  const saveExchange = useCallback(
    async (form) => {
      const newPhone = data.stock.find((item) => item.id === form.newPhoneStockId);
      if (!newPhone || normalizeStock(newPhone).availableQty < 1) {
        throw new Error("Select an available new phone");
      }
      if (!form.oldPhoneModel?.trim()) throw new Error("Old phone model is required");
      const oldImei = cleanImei(form.oldPhoneIMEI);
      const item = normalizeStock(newPhone);
      if (oldImei && oldImei === cleanImei(item.imeiSerial)) {
        throw new Error("Old and new phone IMEI cannot be the same");
      }

      const allowance = number(form.oldPhoneAllowanceValue);
      const oldPrep = number(form.oldPhonePreparationCost);
      const expectedResale = number(form.oldPhoneExpectedResalePrice);
      const newSale = number(form.newPhoneSalePrice);
      const cashFrom = number(form.cashFromCustomer);
      const cashPaid = number(form.cashPaidToCustomer);
      const due = number(form.dueAmount);
      const customerId = String(form.customerPhone || "").replace(/\D/g, "");
      if (due > 0 && (!form.customerName?.trim() || customerId.length < 7)) {
        throw new Error("Customer name and a valid phone are required when exchange has due");
      }

      const entryRef = doc(shopCollection("entries"));
      const oldStockRef = doc(shopCollection("stock"));
      const batch = writeBatch(db);
      const exchangeEstimatedProfit =
        newSale - item.buyPrice + expectedResale - allowance - oldPrep;

      batch.update(doc(db, "shops", SHOP_ID, "stock", item.id), {
        soldQuantity: increment(1),
        status: item.availableQty === 1 ? "exchanged" : "in_stock",
        updatedAt: serverTimestamp(),
        lastOperationId: entryRef.id,
      });
      batch.set(oldStockRef, {
        ...auditFields(),
        category: "Used Phone",
        brand: form.oldPhoneBrand?.trim() || "",
        model: form.oldPhoneModel.trim(),
        imeiSerial: oldImei,
        quantity: 1,
        soldQuantity: 0,
        buyPrice: allowance,
        preparationCost: oldPrep,
        sellPrice: expectedResale,
        notes: form.oldPhoneCondition?.trim() || "",
        status: "in_stock",
        source: "exchange",
      });
      batch.set(entryRef, {
        ...auditFields(),
        type: "exchange",
        newPhoneStockId: item.id,
        newPhoneProduct: `${item.brand} ${item.model}`.trim(),
        newPhoneBuyCost: item.buyPrice,
        newPhoneSalePrice: newSale,
        oldPhoneStockId: oldStockRef.id,
        oldPhoneBrand: form.oldPhoneBrand?.trim() || "",
        oldPhoneModel: form.oldPhoneModel.trim(),
        oldPhoneIMEI: oldImei,
        oldPhoneCondition: form.oldPhoneCondition?.trim() || "",
        oldPhoneAllowanceValue: allowance,
        oldPhonePreparationCost: oldPrep,
        oldPhoneExpectedResalePrice: expectedResale,
        cashFromCustomer: cashFrom,
        cashPaidToCustomer: cashPaid,
        cashNet: cashFrom - cashPaid,
        dueAmount: due,
        exchangeEstimatedProfit,
        customerId: customerId || null,
        customerName: form.customerName?.trim() || "",
        customerPhone: form.customerPhone?.trim() || "",
        riskGrade: form.riskGrade || "medium",
        approvalResult: form.approvalResult || "approved",
      });
      if (item.imeiSerial && item.availableQty === 1) {
        batch.update(doc(db, "shops", SHOP_ID, "imeiIndex", cleanImei(item.imeiSerial)), {
          active: false,
          soldEntryId: entryRef.id,
          updatedAt: serverTimestamp(),
        });
      }
      if (oldImei) {
        batch.set(doc(db, "shops", SHOP_ID, "imeiIndex", oldImei), {
          stockId: oldStockRef.id,
          active: true,
          ...auditFields(),
        });
      }
      if (due > 0) {
        batch.set(
          doc(db, "shops", SHOP_ID, "customers", customerId),
          {
            name: form.customerName.trim(),
            phone: form.customerPhone.trim(),
            dueBalance: increment(due),
            totalDueCreated: increment(due),
            updatedAt: serverTimestamp(),
            shopId: SHOP_ID,
            lastOperationId: entryRef.id,
          },
          { merge: true },
        );
      }
      const result = await commit(batch);
      return { ...result, entryId: entryRef.id, exchangeEstimatedProfit };
    },
    [auditFields, commit, data.stock],
  );

  const setMember = useCallback(
    async ({ uid, role, active = true }) => {
      const cleanUid = uid?.trim();
      if (!cleanUid || !["manager", "staff", "viewer"].includes(role)) {
        throw new Error("Enter a Firebase UID and valid role");
      }
      const batch = writeBatch(db);
      batch.set(
        doc(db, "shops", SHOP_ID, "members", cleanUid),
        {
          role,
          active,
          shopId: SHOP_ID,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true },
      );
      return commit(batch);
    },
    [commit, user.uid],
  );

  return useMemo(
    () => ({
      ...data,
      sync,
      addStock,
      saveSale,
      collectDue,
      addExpense,
      saveExchange,
      setMember,
    }),
    [data, sync, addStock, saveSale, collectDue, addExpense, saveExchange, setMember],
  );
}
