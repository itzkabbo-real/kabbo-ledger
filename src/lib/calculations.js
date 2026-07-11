import { normalizeStockItem, normalizeSale, num } from './utils.js';

// Phone margin = sell price - buy price - preparation cost. No repair/service income
// is ever added here - Kabbo only buys, sells and exchanges phones.
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
  // Due collection is cashflow, never profit - it just settles a receivable.
  return cashFromSales + cashFromDueCollections;
}
