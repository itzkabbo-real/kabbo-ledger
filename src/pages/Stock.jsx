import { useMemo, useState } from 'react';
import { addStockItem } from '../hooks/useShopData.js';
import { displayName, formatFirestoreError, formatMoney, normalizeStockItem } from '../lib/utils.js';

const emptyForm = {
  brand: '',
  model: '',
  storage: '',
  color: '',
  imeiSerial: '',
  quantity: 1,
  buyPrice: '',
  preparationCost: '',
  sellPrice: '',
  supplierName: '',
  warrantyDays: '',
  notes: '',
};

export default function Stock({ stock, actorName }) {
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const normalized = useMemo(() => stock.map(normalizeStockItem), [stock]);
  const duplicateImei = useMemo(() => {
    if (!form.imeiSerial) return false;
    return normalized.some((s) => s.imeiSerial && s.imeiSerial === form.imeiSerial && s.status === 'in_stock');
  }, [form.imeiSerial, normalized]);

  const filtered = normalized.filter((s) => {
    const q = search.toLowerCase();
    return !q || displayName(s).toLowerCase().includes(q) || s.imeiSerial.toLowerCase().includes(q);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (duplicateImei) return;
    setSaving(true);
    setFeedback('');
    try {
      await addStockItem(
        {
          ...form,
          quantity: Number(form.quantity) || 1,
          buyPrice: Number(form.buyPrice) || 0,
          preparationCost: Number(form.preparationCost) || 0,
          sellPrice: Number(form.sellPrice) || 0,
          warrantyDays: Number(form.warrantyDays) || 0,
        },
        actorName
      );
      setForm(emptyForm);
      setFeedback('Saved - visible to every device now.');
    } catch (err) {
      setFeedback(formatFirestoreError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h3>Add stock</h3>
        <form className="grid-form" onSubmit={handleSubmit}>
          <input placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
          <input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
          <input placeholder="Storage" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
          <input placeholder="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          <input
            placeholder="IMEI / Serial"
            value={form.imeiSerial}
            onChange={(e) => setForm({ ...form, imeiSerial: e.target.value })}
          />
          <input
            type="number"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <input
            type="number"
            placeholder="Buy Price"
            value={form.buyPrice}
            onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Preparation Cost"
            value={form.preparationCost}
            onChange={(e) => setForm({ ...form, preparationCost: e.target.value })}
          />
          <input
            type="number"
            placeholder="Expected Sell Price"
            value={form.sellPrice}
            onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
          />
          <input
            placeholder="Supplier"
            value={form.supplierName}
            onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
          />
          <input
            type="number"
            placeholder="Warranty Days"
            value={form.warrantyDays}
            onChange={(e) => setForm({ ...form, warrantyDays: e.target.value })}
          />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {duplicateImei && <p className="error-text">This IMEI is already in stock.</p>}
          {feedback && <p className="muted">{feedback}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving || duplicateImei}>
            {saving ? 'Saving...' : 'Save to shop stock'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Stock ({filtered.filter((s) => s.status === 'in_stock').length} in stock)</h3>
        <input className="search-input" placeholder="Search brand, model, IMEI" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ul className="list">
          {filtered.map((item) => (
            <li key={item.id} className="list-row">
              <div>
                <strong>{displayName(item)}</strong>
                <div className="muted small">IMEI: {item.imeiSerial || '-'} &middot; Qty: {item.quantity}</div>
              </div>
              <div className="list-row-right">
                <span className={`status-pill status-pill--${item.status}`}>{item.status.replace('_', ' ')}</span>
                <span>{formatMoney(item.sellPrice)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
