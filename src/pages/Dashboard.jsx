import LiveFeed from '../components/LiveFeed.jsx';
import StatBox from '../components/StatBox.jsx';
import {
  closingCashToday,
  dashboardStats,
  inStockCount,
  lowStockItems,
  monthlySalesSeries,
  netProfitToday,
  stockValue,
  totalDue,
} from '../lib/calculations.js';
import { formatMoney, normalizeSale, timeAgo } from '../lib/utils.js';

export default function Dashboard({ shopData }) {
  const { stock, sales, dues, ledger, activity, stockById, purchases } = shopData;
  const dueCollections = ledger.filter((l) => l.type === 'due_collection');
  const stats = dashboardStats(sales, purchases, ledger, stockById);
  const monthly = monthlySalesSeries(sales);
  const maxMonth = Math.max(...monthly, 1);
  const lowStock = lowStockItems(stock);
  const recentSales = sales.slice(0, 5).map(normalizeSale);

  return (
    <div className="page">
      <div className="stat-grid stat-grid--shopstick">
        <StatBox label="Total Sales (30d)" value={formatMoney(stats.totalSales)} accent />
        <StatBox label="Profit (30d)" value={formatMoney(stats.salesProfit)} />
        <StatBox label="Invoice Due" value={formatMoney(stats.invoiceDue)} warn={stats.invoiceDue > 0} />
        <StatBox label="Total Purchase" value={formatMoney(stats.totalPurchase)} />
        <StatBox label="Stock Phones" value={inStockCount(stock)} />
        <StatBox label="Stock Value" value={formatMoney(stockValue(stock))} />
        <StatBox label="Total Due" value={formatMoney(totalDue(dues))} warn={totalDue(dues) > 0} />
        <StatBox label="Closing Cash (today)" value={formatMoney(closingCashToday(sales, dueCollections))} />
        <StatBox label="Net Profit (today)" value={formatMoney(netProfitToday(sales, stockById, ledger))} />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Sales this year</h3>
          <span className="muted small">{new Date().getFullYear()}</span>
        </div>
        <div className="bar-chart">
          {monthly.map((value, idx) => (
            <div key={idx} className="bar-chart-col" title={`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][idx]}: Tk ${value}`}>
              <div className="bar-chart-bar" style={{ height: `${Math.max((value / maxMonth) * 100, value > 0 ? 8 : 0)}%` }} />
              <span className="bar-chart-label">{['J','F','M','A','M','J','J','A','S','O','N','D'][idx]}</span>
            </div>
          ))}
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card card--warn">
          <h3>Low stock alert</h3>
          <ul className="list compact-list">
            {lowStock.slice(0, 5).map((item) => (
              <li key={item.id} className="list-row">
                <span>{item.brand} {item.model}</span>
                <span className="muted small">Qty {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Recent sales</h3>
        {recentSales.length === 0 ? (
          <p className="muted">No sales yet.</p>
        ) : (
          <ul className="list compact-list">
            {recentSales.map((sale) => (
              <li key={sale.id} className="list-row">
                <div>
                  <strong>{sale.invoiceNo || sale.productLabel}</strong>
                  <div className="muted small">
                    {sale.customerName || 'Walk-in'} &middot; {timeAgo(sale.createdAt)}
                  </div>
                </div>
                <div className="list-row-right">
                  <span>{formatMoney(sale.grandTotal ?? sale.sellPrice)}</span>
                  {sale.dueAmount > 0 && <span className="status-pill status-pill--due">Due</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LiveFeed activity={activity} />
    </div>
  );
}
