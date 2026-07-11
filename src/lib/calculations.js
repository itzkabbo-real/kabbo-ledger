import { normalizeSale, normalizeStockItem, num } from './utils.js';

export function phoneMargin(sale, stockItem) {
  const s = normalizeSale(sale);
  const item = stockItem ? normalizeStockItem(stockItem) : null;
  const buyPrice = num(item?.buyPrice);
  const prepCost = num(item?.preparationCost);
  return s.sellPrice - buyPrice - prepCost;
}

export function exchangeProfit(exchange = {}) {
  const newPhoneMargin = num(exchange.newPhoneSalePrice) - num(exchange.newPhoneBuyCost);
  const oldPhoneEstimatedMargin =
    num(exchange.oldPhoneExpectedResalePrice) -
    num(exchange.oldPhoneAllowanceValue) -
    num(exchange.oldPhonePreparationCost);
  return {
    newPhoneMargin,
    oldPhoneEstimatedMargin,
    cashNet: num(exchange.cashFromCustomer) - num(exchange.cashPaidToCustomer),
    exchangeEstimatedProfit: newPhoneMargin + oldPhoneEstimatedMargin,
  };
}

export function stockValue(stockItems = []) {
  return stockItems
    .filter((i) => normalizeStockItem(i).status === 'in_stock')
    .reduce((sum, raw) => {
      const item = normalizeStockItem(raw);
      return sum + (item.buyPrice + item.preparationCost) * Math.max(item.quantity, 0);
    }, 0);
}

export function inStockCount(stockItems = []) {
  return stockItems.filter((i) => normalizeStockItem(i).status === 'in_stock').length;
}

export function totalDue(dues = []) {
  return dues.reduce((sum, d) => sum + num(d.totalDue), 0);
}

export function todaysSales(sales = []) {
  const today = new Date().toDateString();
  return sales.filter((s) => {
    const ts = s.createdAt?.toDate ? s.createdAt.toDate() : s.createdAt ? new Date(s.createdAt) : null;
    return ts && ts.toDateString() === today;
  });
}

export function netProfitToday(sales = [], stockById = {}, expenses = []) {
  const today = todaysSales(sales);
  const salesProfit = today.reduce((sum, sale) => sum + phoneMargin(sale, stockById[sale.stockItemId]), 0);
  const todayExpenses = (expenses || []).reduce((sum, e) => sum + num(e.amount), 0);
  return salesProfit - todayExpenses;
}

export function closingCashToday(sales = [], dueCollections = []) {
  const today = todaysSales(sales);
  const cashFromSales = today.reduce((sum, s) => sum + num(normalizeSale(s).paidAmount), 0);
  const cashFromDueCollections = (dueCollections || []).reduce((sum, c) => sum + num(c.amount), 0);
  return cashFromSales + cashFromDueCollections;
}

// Shopstick dashboard/stats parity helpers
export function periodSales(sales = [], days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return sales.filter((s) => {
    const ts = s.createdAt?.toDate ? s.createdAt.toDate() : s.createdAt ? new Date(s.createdAt) : null;
    return ts && ts.getTime() >= cutoff;
  });
}

export function dashboardStats(sales = [], purchases = [], ledger = [], stockById = {}) {
  const period = periodSales(sales, 30);
  const totalSales = period.reduce((sum, s) => sum + num(normalizeSale(s).grandTotal ?? normalizeSale(s).sellPrice), 0);
  const totalPurchase = purchases.reduce((sum, p) => sum + num(p.totalCost), 0);
  const salesProfit = period.reduce((sum, sale) => sum + phoneMargin(sale, stockById[sale.stockItemId]), 0);
  const invoiceDue = period.reduce((sum, s) => sum + num(normalizeSale(s).dueAmount), 0);
  const expenses = ledger
    .filter((l) => l.type === 'expense' || l.type === 'cash_out' || l.type === 'purchase')
    .reduce((sum, l) => sum + num(l.amount), 0);

  return {
    totalSales,
    totalPurchase,
    salesProfit,
    invoiceDue,
    totalExpenses: expenses,
    netProfit: salesProfit - expenses,
    salesCount: period.length,
  };
}

export function monthlySalesSeries(sales = [], year = new Date().getFullYear()) {
  const months = Array(12).fill(0);
  sales.forEach((raw) => {
    const s = normalizeSale(raw);
    const ts = raw.createdAt?.toDate ? raw.createdAt.toDate() : raw.createdAt ? new Date(raw.createdAt) : null;
    if (!ts || ts.getFullYear() !== year) return;
    months[ts.getMonth()] += num(s.grandTotal ?? s.sellPrice);
  });
  return months;
}

export function lowStockItems(stock = [], threshold = 1) {
  return stock
    .map(normalizeStockItem)
    .filter((s) => s.status === 'in_stock' && s.quantity <= threshold);
}

export function salesReportStats(sales = []) {
  const normalized = sales.map(normalizeSale);
  const totalAmount = normalized.reduce((sum, s) => sum + num(s.grandTotal ?? s.sellPrice), 0);
  const totalPaid = normalized.reduce((sum, s) => sum + num(s.paidAmount), 0);
  const totalUnpaid = normalized.reduce((sum, s) => sum + num(s.dueAmount), 0);
  return {
    totalAmount,
    totalPaid,
    totalUnpaid,
    totalSales: normalized.length,
    averageSaleAmount: normalized.length ? totalAmount / normalized.length : 0,
  };
}

export function profitLossByMonth(sales = [], ledger = [], stockById = {}, year = new Date().getFullYear()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month, idx) => {
    const monthSales = sales.filter((raw) => {
      const ts = raw.createdAt?.toDate ? raw.createdAt.toDate() : raw.createdAt ? new Date(raw.createdAt) : null;
      return ts && ts.getFullYear() === year && ts.getMonth() === idx;
    });
    const salesTotal = monthSales.reduce((sum, s) => sum + num(normalizeSale(s).grandTotal ?? normalizeSale(s).sellPrice), 0);
    const grossProfit = monthSales.reduce((sum, sale) => sum + phoneMargin(sale, stockById[sale.stockItemId]), 0);
    const expenses = ledger
      .filter((l) => {
        const ts = l.createdAt?.toDate ? l.createdAt.toDate() : l.createdAt ? new Date(l.createdAt) : null;
        return (
          ts &&
          ts.getFullYear() === year &&
          ts.getMonth() === idx &&
          (l.type === 'expense' || l.type === 'cash_out' || l.type === 'purchase')
        );
      })
      .reduce((sum, l) => sum + num(l.amount), 0);
    return { month, year, sales: salesTotal, grossProfit, expenses, netProfit: grossProfit - expenses };
  });
}
