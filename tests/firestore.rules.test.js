import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const PROJECT_ID = "demo-kabbo";
const SHOP_ID = "kabbo_mobile_kushtia";
const MANAGER_UID = "manager-test";
let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "shops", SHOP_ID, "members", MANAGER_UID), {
      role: "manager",
      active: true,
    });
  });
});

after(async () => {
  await environment?.cleanup();
});

test("rejects unauthenticated shop reads", async () => {
  const firestore = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(firestore, "shops", SHOP_ID, "stock", "phone-1")));
});

test("manager cannot grant roles", async () => {
  const firestore = environment.authenticatedContext(MANAGER_UID, {
    email: "manager@example.com",
  }).firestore();
  await assertFails(
    setDoc(doc(firestore, "shops", SHOP_ID, "members", "attacker"), {
      role: "owner",
      active: true,
    }),
  );
});

test("customer balance cannot change without an immutable operation", async () => {
  const firestore = environment.authenticatedContext(MANAGER_UID, {
    email: "manager@example.com",
  }).firestore();
  await assertFails(
    setDoc(doc(firestore, "shops", SHOP_ID, "customers", "01700000000"), {
      shopId: SHOP_ID,
      dueBalance: 5000,
      lastOperationId: "missing-operation",
    }),
  );
});

test("allows a due customer created in the same batch as its sale", async () => {
  const firestore = environment.authenticatedContext(MANAGER_UID, {
    email: "manager@example.com",
  }).firestore();
  const entryRef = doc(collection(firestore, "shops", SHOP_ID, "entries"));
  const customerRef = doc(firestore, "shops", SHOP_ID, "customers", "01700000000");
  const batch = writeBatch(firestore);
  batch.set(entryRef, {
    type: "sale",
    shopId: SHOP_ID,
    createdBy: MANAGER_UID,
    customerId: customerRef.id,
    dueAmount: 5000,
  });
  batch.set(customerRef, {
    shopId: SHOP_ID,
    name: "KABBO_QA_DELETE_ME",
    phone: "01700000000",
    dueBalance: 5000,
    totalDueCreated: 5000,
    lastOperationId: entryRef.id,
  });
  await assertSucceeds(batch.commit());
});

test("protects stock economics while allowing ledger-linked sale decrement", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "shops", SHOP_ID, "stock", "phone-1"), {
      shopId: SHOP_ID,
      createdBy: MANAGER_UID,
      quantity: 1,
      soldQuantity: 0,
      status: "in_stock",
      buyPrice: 10000,
    });
  });
  const firestore = environment.authenticatedContext(MANAGER_UID, {
    email: "manager@example.com",
  }).firestore();
  const stockRef = doc(firestore, "shops", SHOP_ID, "stock", "phone-1");
  await assertFails(updateDoc(stockRef, { buyPrice: 1 }));

  const entryRef = doc(collection(firestore, "shops", SHOP_ID, "entries"));
  const batch = writeBatch(firestore);
  batch.set(entryRef, {
    type: "sale",
    shopId: SHOP_ID,
    createdBy: MANAGER_UID,
    stockId: stockRef.id,
  });
  batch.update(stockRef, {
    soldQuantity: increment(1),
    status: "sold",
    updatedAt: new Date(),
    lastOperationId: entryRef.id,
  });
  await assertSucceeds(batch.commit());
  assert.equal((await getDoc(stockRef)).data().soldQuantity, 1);
});
