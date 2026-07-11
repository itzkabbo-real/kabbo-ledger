import { useMemo, useState } from 'react';
import { collectDue } from '../hooks/useShopData.js';
import { formatMoney, normalizeDue } from '../lib/utils.js';

export default function Dues({ dues, actorName }) {
  const normalized = useMemo(() => dues.map(normalizeDue).filter((d) => d.totalDue > 0), [dues]);
  const [collecting, setCollecting] = useState(null);
  const [amount, setAmount] = useState('');

  async function handleCollect(phone) {
    if (!amount) return;
    await collectDue(phone, Number(amount), actorName);
    setCollecting(null);
    setAmount('');
  }

  return (
    <div className="page">
      <div className="card">
        <h3>Outstanding dues ({formatMoney(normalized.reduce((s, d) => s + d.totalDue, 0))})</h3>
        <ul className="list">
          {normalized.map((due) => (
            <li key={due.id} className="list-row">
              <div>
                <strong>{due.customerName}</strong>
                <div className="muted small">{due.customerPhone}</div>
              </div>
              <div className="list-row-right">
                <span>{formatMoney(due.totalDue)}</span>
                {collecting === due.id ? (
                  <>
                    <input
                      type="number"
                      className="inline-input"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => handleCollect(due.customerPhone)}>
                      Confirm
                    </button>
                  </>
                ) : (
                  <button className="btn btn-secondary btn-sm" onClick={() => setCollecting(due.id)}>
                    Collect
                  </button>
                )}
              </div>
            </li>
          ))}
          {normalized.length === 0 && <p className="muted">No outstanding dues.</p>}
        </ul>
      </div>
    </div>
  );
}
