import { useMemo, useState } from 'react';
import { addCustomer, collectDue } from '../hooks/useShopData.js';
import { formatMoney, isValidBangladeshPhone, normalizeBangladeshPhone, normalizeDue } from '../lib/utils.js';

export default function Dues({ dues, customers, actorName }) {
  const normalized = useMemo(() => dues.map(normalizeDue).filter((d) => d.totalDue > 0), [dues]);
  const [collecting, setCollecting] = useState(null);
  const [amount, setAmount] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function handleCollect(phone) {
    if (!amount) return;
    await collectDue(phone, Number(amount), actorName);
    setCollecting(null);
    setAmount('');
  }

  async function handleAddCustomer(e) {
    e.preventDefault();
    const phone = normalizeBangladeshPhone(newCustomer.phone);
    if (!isValidBangladeshPhone(phone)) {
      setFeedback('Enter a valid Bangladeshi phone number.');
      return;
    }
    setSaving(true);
    setFeedback('');
    try {
      await addCustomer({ ...newCustomer, phone }, actorName);
      setNewCustomer({ name: '', phone: '', address: '' });
      setFeedback('Customer saved — visible on every device.');
    } catch (err) {
      setFeedback(err.message || 'Failed to save customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h3>Customers</h3>
        <p className="muted small">Manage customers like Shopstick — synced live to POS and dues.</p>
        <form className="grid-form" onSubmit={handleAddCustomer}>
          <input placeholder="Customer name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} required />
          <input placeholder="Phone (01XXXXXXXXX)" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} required />
          <input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          {feedback && <p className="muted">{feedback}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add customer'}
          </button>
        </form>
        {customers.length > 0 && (
          <ul className="list compact-list">
            {customers.slice(0, 10).map((c) => (
              <li key={c.id} className="list-row">
                <div>
                  <strong>{c.name}</strong>
                  <div className="muted small">{c.phone || c.id}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
                    <input type="number" className="inline-input" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
