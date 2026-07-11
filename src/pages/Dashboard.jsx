import LiveFeed from '../components/LiveFeed.jsx';
import StatBox from '../components/StatBox.jsx';
import { closingCashToday, inStockCount, netProfitToday, stockValue, todaysSales, totalDue } from '../lib/calculations.js';
import { formatMoney } from '../lib/utils.js';

export default function Dashboard({ shopData, online }) {
  const { stock, sales, dues, ledger, activity, stockById } = shopData;
  const dueCollections = ledger.filter((l) => l.type === 'due_collection');

  return (
    <div className="page">
      <div className="sync-banner" data-online={online}>
        {online ? 'Online - synced live with every manager device' : 'Offline - changes will sync automatically when back online'}
      </div>

      <div className="stat-grid">
        <StatBox label="Today Sold" value={todaysSales(sales).length} />
        <StatBox label="Stock Phones" value={inStockCount(stock)} />
        <StatBox label="Stock Value" value={formatMoney(stockValue(stock))} />
        <StatBox label="Total Due" value={formatMoney(totalDue(dues))} />
        <StatBox label="Closing Cash (today)" value={formatMoney(closingCashToday(sales, dueCollections))} />
        <StatBox label="Net Profit (today)" value={formatMoney(netProfitToday(sales, stockById, []))} />
      </div>

      <LiveFeed activity={activity} />
    </div>
  );
}
