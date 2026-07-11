import test from "node:test";
import assert from "node:assert/strict";
import {
  certification,
  dashboardMetrics,
  dueAmount,
  normalizeStock,
  phoneMargin,
  validateSale,
} from "./domain.js";

test("normalizes legacy stock fields and excludes sold inventory", () => {
  assert.deepEqual(
    normalizeStock({ deviceName: "iPhone 13", cost: "50000", prepCost: "1000", quantity: 1 }),
    {
      deviceName: "iPhone 13",
      cost: "50000",
      prepCost: "1000",
      brand: "",
      model: "iPhone 13",
      imeiSerial: "",
      buyPrice: 50000,
      sellPrice: 0,
      preparationCost: 1000,
      quantity: 1,
      soldQuantity: 0,
      availableQty: 1,
      status: "in_stock",
    },
  );
  assert.equal(normalizeStock({ quantity: 2, status: "sold" }).availableQty, 0);
});

test("calculates phone margin and due without counting collections as profit", () => {
  assert.equal(phoneMargin({ finalSellPrice: 65000, buyPrice: 57000, preparationCost: 2000 }), 6000);
  assert.equal(dueAmount({ finalSellPrice: 65000, paidAmount: 50000 }), 15000);
  const metrics = dashboardMetrics(
    [
      { type: "sale", date: new Date().toISOString().slice(0, 10), finalSellPrice: 65000, paidAmount: 50000, buyPrice: 57000, preparationCost: 2000 },
      { type: "due_collection", date: new Date().toISOString().slice(0, 10), amount: 10000 },
    ],
    [],
    [],
  );
  assert.equal(metrics.grossMargin, 6000);
  assert.equal(metrics.closingCash, 60000);
});

test("applies certification risk rules", () => {
  assert.equal(certification({ imeiSerial: "123", certChecklist: { icloudFrpStatus: "Locked" } }), "risky");
  assert.equal(certification({ imeiSerial: "", certChecklist: { batteryHealth: 90 } }), "warning");
  assert.equal(certification({ imeiSerial: "123", certChecklist: { batteryHealth: 90, certifiedResult: "pass" } }), "certified");
});

test("requires customer identity only for due sales", () => {
  const stockItem = { quantity: 1, soldQuantity: 0, status: "in_stock" };
  assert.deepEqual(validateSale({ stockItem, finalSellPrice: 100, paidAmount: 100 }), []);
  assert.match(
    validateSale({ stockItem, finalSellPrice: 100, paidAmount: 50 }).join(" "),
    /Customer name and a valid phone/,
  );
  assert.match(
    validateSale({
      stockItem,
      finalSellPrice: 100,
      paidAmount: 50,
      customerName: "KABBO_QA_DELETE_ME",
      customerPhone: "not-a-number",
    }).join(" "),
    /valid phone/,
  );
});
