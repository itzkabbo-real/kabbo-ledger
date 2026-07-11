import { stockValue, totalDue } from '../lib/calculations.js';
import { normalizeSale, normalizeStockItem } from '../lib/utils.js';

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

export default function Reports({ stock, sales, dues }) {
  const normalizedStock = stock.map(normalizeStockItem);
  const normalizedSales = sales.map(normalizeSale);

  return (
    <div className="page">
      <div className="card">
        <h3>Reports</h3>
        <p>Stock value: {stockValue(stock)}</p>
        <p>Total due: {totalDue(dues)}</p>
        <div className="btn-row">
          <button
            className="btn btn-secondary"
            onClick={() =>
              download(
                'stock-report.csv',
                toCsv(normalizedStock, [
                  'brand',
                  'model',
                  'storage',
                  'color',
                  'imeiSerial',
                  'quantity',
                  'buyPrice',
                  'preparationCost',
                  'sellPrice',
                  'status',
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
                  'productLabel',
                  'sellPrice',
                  'paidAmount',
                  'dueAmount',
                  'paymentMethod',
                  'customerName',
                  'customerPhone',
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
