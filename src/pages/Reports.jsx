import { profitLossByMonth, salesReportStats, stockValue, totalDue } from '../lib/calculations.js';
import { formatMoney, normalizeSale, normalizeStockItem } from '../lib/utils.js';

function toCsv(rows, headers) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports({ stock, sales, dues, ledger, stockById }) {
  const normalizedStock = stock.map(normalizeStockItem);
  const normalizedSales = sales.map(normalizeSale);
  const salesStats = salesReportStats(sales);
  const pl = profitLossByMonth(sales, ledger, stockById);
  const activeMonths = pl.filter((m) => m.sales > 0 || m.expenses > 0);

  return (
    <div className="page">
      <div className="stat-grid">
        <div className="stat-box stat-box--accent">
          <span className="stat-label">Total sales amount</span>
          <span className="stat-value">{formatMoney(salesStats.totalAmount)}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Total paid</span>
          <span className="stat-value">{formatMoney(salesStats.totalPaid)}</span>
        </div>
        <div className="stat-box stat-box--warn">
          <span className="stat-label">Total unpaid</span>
          <span className="stat-value">{formatMoney(salesStats.totalUnpaid)}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Sales count</span>
          <span className="stat-value">{salesStats.totalSales}</span>
        </div>
      </div>

      <div className="card">
        <h3>Profit &amp; Loss (monthly)</h3>
        {activeMonths.length === 0 ? (
          <p className="muted">No profit/loss data yet.</p>
        ) : (
          <ul className="list compact-list">
            {activeMonths.map((m) => (
              <li key={m.month} className="list-row">
                <span>{m.month} {m.year}</span>
                <div className="list-row-right">
                  <span className="muted small">Sales {formatMoney(m.sales)}</span>
                  <strong>{formatMoney(m.netProfit)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Business snapshot</h3>
        <p>Stock value: {formatMoney(stockValue(stock))}</p>
        <p>Total customer due: {formatMoney(totalDue(dues))}</p>
        <p>Average sale: {formatMoney(salesStats.averageSaleAmount)}</p>
        <div className="btn-row">
          <button
            className="btn btn-secondary"
            onClick={() =>
              download(
                'stock-report.csv',
                toCsv(normalizedStock, [
                  'brand', 'model', 'storage', 'color', 'imeiSerial', 'quantity',
                  'buyPrice', 'preparationCost', 'sellPrice', 'status',
                ])
              )
            }
          >
            Export Stock CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() =>
              download(
                'sales-report.csv',
                toCsv(normalizedSales, [
                  'invoiceNo', 'productLabel', 'subtotal', 'discount', 'sellPrice',
                  'paidAmount', 'dueAmount', 'paymentMethod', 'customerName', 'customerPhone',
                ])
              )
            }
          >
            Export Sales CSV
          </button>
        </div>
      </div>
    </div>
  );
}
