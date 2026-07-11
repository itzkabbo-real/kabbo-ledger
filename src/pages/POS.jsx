import { useMemo, useState } from 'react';
import { recordSale } from '../hooks/useShopData.js';
import { displayName, normalizeStockItem } from '../lib/utils.js';

export default function POS({ stock, actorName }) {
  const inStock = useMemo(() => stock.map(normalizeStockItem).filter((s) => s.status === 'in_stock'), [stock]);
  const [stockItemId, setStockItemId] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const selected = inStock.find((s) => s.id === stockItemId);
  const finalPrice = Math.max(Number(sellPrice) - Number(discount || 0), 0);
  const dueAmount = Math.max(finalPrice - Number(paidAmount || 0), 0);

  async function handleSell(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const sale = {
        stockItemId,
        productLabel: selected ? displayName(selected) : '',
        sellPrice: finalPrice,
        discount: Number(discount || 0),
        paidAmount: Number(paidAmount || 0),
        paymentMethod,
        customerName,
        customerPhone,
        customerAddress,
      };
      await recordSale(sale, actorName);
      setReceipt({ ...sale, dueAmount: Math.max(finalPrice - Number(paidAmount || 0), 0), soldBy: actorName });
      setStockItemId('');
      setSellPrice('');
      setDiscount('0');
      setPaidAmount('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h3>New sale</h3>
        <form className="grid-form" onSubmit={handleSell}>
          <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} required>
            <option value="">Select stock item</option>
            {inStock.map((s) => (
              <option key={s.id} value={s.id}>
                {displayName(s)} - IMEI {s.imeiSerial || 'n/a'}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Final sell price"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            required
          />
          <input type="number" placeholder="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <input
            type="number"
            placeholder="Paid amount"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            required
          />
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank</option>
          </select>
          <p className="muted">Due amount: Tk {dueAmount}</p>
          {dueAmount > 0 && (
            <>
              <input
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
              <input
                placeholder="Customer phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
              />
              <input
                placeholder="Customer full address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                required
              />
            </>
          )}
          <button className="btn btn-primary" type="submit" disabled={saving || !stockItemId}>
            {saving ? 'Recording sale...' : 'Complete sale'}
          </button>
        </form>
      </div>

      {receipt && (
        <div className="card receipt">
          <h3>Receipt</h3>
          {receipt.customerName && (
            <p>
              {receipt.customerName} &middot; {receipt.customerPhone}
              <br />
              {receipt.customerAddress}
            </p>
          )}
          <p>{receipt.productLabel}</p>
          <p>
            Price: Tk {receipt.sellPrice} &middot; Paid: Tk {receipt.paidAmount} &middot; Due: Tk {receipt.dueAmount}
          </p>
          <p className="muted small">Sold by {receipt.soldBy}. Warranty and terms apply as agreed in-store.</p>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Print invoice
          </button>
        </div>
      )}
    </div>
  );
}
