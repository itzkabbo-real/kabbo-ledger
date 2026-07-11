export const money = (value) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const number = (value) => Math.max(0, Number(value) || 0);

export function normalizeStock(item = {}) {
  const quantity = number(item.quantity ?? 1);
  const soldQuantity = number(item.soldQuantity);
  const status = item.status || "in_stock";
  return {
    ...item,
    brand: item.brand || "",
    model: item.model || item.deviceName || item.name || "Unknown device",
    imeiSerial: item.imeiSerial || item.imei || "",
    buyPrice: number(item.buyPrice ?? item.cost),
    sellPrice: number(item.sellPrice ?? item.askingPrice ?? item.price),
    preparationCost: number(item.preparationCost ?? item.prepCost),
    quantity,
    soldQuantity,
    availableQty:
      ["sold", "exchanged", "deleted"].includes(status)
        ? 0
        : Math.max(0, quantity - soldQuantity),
    status,
  };
}

export function certification(item = {}) {
  const cert = item.certChecklist || {};
  if (String(cert.icloudFrpStatus || "").toLowerCase() === "locked") return "risky";
  if (!item.imeiSerial || number(cert.batteryHealth) < 75) return "warning";
  if (cert.certifiedResult === "pass") return "certified";
  return "not_checked";
}

export function phoneMargin(sale = {}) {
  return (
    number(sale.finalSellPrice ?? sale.sellPrice ?? sale.amount) -
    number(sale.buyPrice ?? sale.cost) -
    number(sale.preparationCost ?? sale.prepCost)
  );
}

export function dueAmount(sale = {}) {
  return Math.max(
    0,
    number(sale.finalSellPrice ?? sale.sellPrice ?? sale.amount) -
      number(sale.paidAmount),
  );
}

export function dashboardMetrics(entries = [], stock = [], customers = []) {
  const today = new Date().toISOString().slice(0, 10);
  const activeStock = stock.map(normalizeStock).filter((item) => item.availableQty > 0);
  const todays = entries.filter((entry) => entry.date === today && !entry.deletedAt);
  const sales = todays.filter((entry) => entry.type === "sale");
  const expenses = todays.filter((entry) => entry.type === "expense");
  const exchanges = todays.filter((entry) => entry.type === "exchange");
  const dueCollections = todays.filter((entry) => entry.type === "due_collection");

  return {
    todaySold: sales.reduce((sum, entry) => sum + number(entry.finalSellPrice ?? entry.amount), 0),
    todayBought: todays
      .filter((entry) => entry.type === "buy")
      .reduce((sum, entry) => sum + number(entry.amount), 0),
    stockPhones: activeStock.reduce((sum, item) => sum + item.availableQty, 0),
    stockValue: activeStock.reduce(
      (sum, item) => sum + (item.buyPrice + item.preparationCost) * item.availableQty,
      0,
    ),
    totalDue: customers.reduce((sum, customer) => sum + number(customer.dueBalance), 0),
    grossMargin:
      sales.reduce((sum, sale) => sum + phoneMargin(sale), 0) +
      exchanges.reduce((sum, entry) => sum + number(entry.exchangeEstimatedProfit), 0),
    closingCash:
      sales.reduce((sum, sale) => sum + number(sale.paidAmount), 0) +
      dueCollections.reduce((sum, entry) => sum + number(entry.amount), 0) -
      expenses.reduce((sum, entry) => sum + number(entry.amount), 0),
  };
}

export function validateSale({ stockItem, finalSellPrice, paidAmount, customerName, customerPhone }) {
  const errors = [];
  const normalizedPhone = String(customerPhone || "").replace(/\D/g, "");
  if (!stockItem || normalizeStock(stockItem).availableQty < 1) errors.push("Select available stock");
  if (number(finalSellPrice) <= 0) errors.push("Final sell price is required");
  if (number(paidAmount) > number(finalSellPrice)) errors.push("Paid amount cannot exceed price");
  if (
    number(finalSellPrice) > number(paidAmount) &&
    (!customerName?.trim() || normalizedPhone.length < 7)
  ) {
    errors.push("Customer name and a valid phone are required for a due sale");
  }
  return errors;
}
