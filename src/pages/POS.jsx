import { useMemo, useState } from 'react';
import { recordSale } from '../hooks/useShopData.js';
import { displayName, formatFirestoreError, formatMoney, normalizeStockItem } from '../lib/utils.js';

export default function POS({ stock, customers, actorName }) {
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
  const [error, setError] = useState('');

  const selected = inStock.find((s) => s.id === stockItemId);
  const subtotal = Number(sellPrice) || 0;
  const discountAmount = Number(discount || 0);
  const grandTotal = Math.max(subtotal - discountAmount, 0);
  const dueAmount = Math.max(grandTotal - Number(paidAmount || 0), 0);

  function pickCustomer(phone) {
    const customer = customers.find((c) => c.phone === phone || c.id === phone);
    if (!customer) return;
    setCustomerName(customer.name || '');
    setCustomerPhone(customer.phone || customer.id || '');
    setCustomerAddress(customer.address || '');
  }

  async function handleSell(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const sale = {
        stockItemId,
        productLabel: selected ? displayName(selected) : '',
        subtotal,
        discount: discountAmount,
        sellPrice: grandTotal,
        paidAmount: Number(paidAmount || 0),
        paymentMethod,
        customerName,
        customerPhone,
        customerAddress,
      };
      const result = await recordSale(sale, actorName);
      setReceipt({
        ...sale,
        invoiceNo: result.invoiceNo,
        grandTotal: result.grandTotal,
        dueAmount: result.dueAmount,
        soldBy: actorName,
      });
      setStockItemId('');
      setSellPrice('');
      setDiscount('0');
      setPaidAmount('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
    } catch (err) {
      setError(formatFirestoreError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h3>Smart Billing &amp; POS</h3>
        <p className="muted small">Shopstick-style invoice with live stock sync.</p>
        <form className="grid-form" onSubmit={handleSell}>
          <select value={stockItemId} onChange={(e) => {
            setStockItemId(e.target.value);
            const item = inStock.find((s) => s.id === e.target.value);
            if (item && !sellPrice) setSellPrice(String(item.sellPrice || ''));
          }} required>
            <option value="">Select stock item</option>
            {inStock.map((s) => (
              <option key={s.id} value={s.id}>
                {displayName(s)} — IMEI {s.imeiSerial || 'n/a'}
              </option>
            ))}
          </select>

          {customers.length > 0 && (
            <select value={customerPhone} onChange={(e) => pickCustomer(e.target.value)}>
              <option value="">Select existing customer (optional)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.phone || c.id}>
                  {c.name} — {c.phone || c.id}
                </option>
              ))}
            </select>
          )}

          <input type="number" placeholder="Subtotal / sell price" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required />
          <input type="number" placeholder="Discount (flat)" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          <div className="pos-summary">
            <span>Grand total</span>
            <strong>{formatMoney(grandTotal)}</strong>
          </div>
          <input type="number" placeholder="Paid amount" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} required />
          <div className="pos-summary" data-warn={dueAmount > 0}>
            <span>Due amount</span>
            <strong>{formatMoney(dueAmount)}</strong>
          </div>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank</option>
          </select>
          {dueAmount > 0 && (
            <>
              <input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              <input placeholder="Customer phone (01XXXXXXXXX)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
              <input placeholder="Customer full address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} required />
            </>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving || !stockItemId}>
            {saving ? 'Recording sale...' : 'Complete sale'}
          </button>
        </form>
      </div>

      {receipt && (
        <div className="card receipt">
          <h3>Invoice</h3>
          <p className="invoice-no">{receipt.invoiceNo}</p>
          {receipt.customerName && (
            <p>
              {receipt.customerName} &middot; {receipt.customerPhone}
              <br />
              {receipt.customerAddress}
            </p>
          )}
          <p>{receipt.productLabel}</p>
          <div className="invoice-lines">
            <div><span>Subtotal</span><span>{formatMoney(receipt.subtotal)}</span></div>
            <div><span>Discount</span><span>- {formatMoney(receipt.discount)}</span></div>
            <div className="invoice-total"><span>Grand total</span><span>{formatMoney(receipt.grandTotal)}</span></div>
            <div><span>Paid</span><span>{formatMoney(receipt.paidAmount)}</span></div>
            <div><span>Due</span><span>{formatMoney(receipt.dueAmount)}</span></div>
          </div>
          <p className="muted small">Sold by {receipt.soldBy}. Payment: {receipt.paymentMethod}.</p>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Print invoice
          </button>
        </div>
      )}
    </div>
  );
}
