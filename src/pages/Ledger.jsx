import { useState } from 'react';
import { addLedgerEntry } from '../hooks/useShopData.js';
import { formatMoney, timeAgo } from '../lib/utils.js';

export default function Ledger({ ledger, actorName }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await addLedgerEntry({ type, amount: Number(amount), note }, actorName);
      setAmount('');
      setNote('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h3>Add ledger entry</h3>
        <form className="grid-form" onSubmit={handleAdd}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Expense</option>
            <option value="cash_in">Cash In</option>
            <option value="cash_out">Cash Out</option>
          </select>
          <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add entry'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Recent entries</h3>
        <ul className="list">
          {ledger.slice(0, 50).map((entry) => (
            <li key={entry.id} className="list-row">
              <div>
                <strong>{entry.type.replace('_', ' ')}</strong>
                <div className="muted small">
                  {entry.note || entry.customerPhone || ''} &middot; {entry.createdBy} &middot; {timeAgo(entry.createdAt)}
                </div>
              </div>
              <span>{formatMoney(entry.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
