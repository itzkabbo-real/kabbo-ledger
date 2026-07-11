import { useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useShopData } from "./hooks/useShopData";
import {
  certification,
  dashboardMetrics,
  money,
  normalizeStock,
  number,
  phoneMargin,
} from "./lib/domain";
import { firebaseReady, SHOP_ID } from "./lib/firebase";

const tabs = ["Dashboard", "Feed", "Stock", "POS", "Exchange", "Dues", "Reports"];
const initialStock = {
  category: "Used Phone",
  brand: "",
  model: "",
  storage: "",
  color: "",
  imeiSerial: "",
  quantity: 1,
  buyPrice: "",
  preparationCost: "",
  sellPrice: "",
  supplierName: "",
  warrantyDays: "",
  notes: "",
  batteryHealth: "",
  icloudFrpStatus: "clear",
  certChecksPassed: false,
};

function SyncBadge({ sync }) {
  const labels = {
    connecting: "Connecting…",
    syncing: "Syncing…",
    synced: sync.fromCache ? "Online · cached view" : "Live · synced",
    offline: "Offline · changes saved locally",
    failed: "Sync failed · retry",
  };
  return (
    <div className={`sync ${sync.state}`} title={sync.message || ""}>
      <span />
      {labels[sync.state] || sync.state}
    </div>
  );
}

function AuthScreen({ authState }) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await (registering
        ? authState.register(form.email, form.password)
        : authState.login(form.email, form.password));
    } catch (reason) {
      setError(reason.message);
    }
  };
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">K</div>
        <p className="eyebrow">Kabbo Mobile Shop · Kushtia</p>
        <h1>One shop. One live ledger.</h1>
        <p className="muted">Owner and managers share the same secure Firestore feed.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength="6"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {(error || authState.error) && <p className="error">{error || authState.error}</p>}
          <button className="primary" type="submit">
            {registering ? "Create account" : "Sign in"}
          </button>
        </form>
        <button className="link" onClick={() => setRegistering(!registering)}>
          {registering ? "Already registered? Sign in" : "New staff account? Register"}
        </button>
        {authState.user && (
          <div className="access-box">
            <p>Send this UID to the owner to activate your account:</p>
            <code>{authState.user.uid}</code>
            <button className="link" onClick={authState.logout}>Sign out and use another account</button>
          </div>
        )}
        <small>Shop: {SHOP_ID}</small>
      </section>
    </main>
  );
}

function Dashboard({ metrics, entries }) {
  const cards = [
    ["Today's sales", money(metrics.todaySold)],
    ["Today's purchases", money(metrics.todayBought)],
    ["Phones in stock", metrics.stockPhones],
    ["Stock value", money(metrics.stockValue)],
    ["Customer due", money(metrics.totalDue)],
    ["Gross margin", money(metrics.grossMargin)],
    ["Closing cash", money(metrics.closingCash)],
  ];
  return (
    <>
      <div className="hero">
        <div>
          <p className="eyebrow">Realtime overview</p>
          <h2>Today at Kabbo</h2>
          <p>Every confirmed manager entry appears here automatically.</p>
        </div>
        <div className="hero-total">{money(metrics.todaySold)}</div>
      </div>
      <div className="metric-grid">
        {cards.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="section-head">
          <h3>Latest activity</h3>
          <span>{entries.length} records</span>
        </div>
        <Feed entries={entries.slice(0, 6)} />
      </section>
    </>
  );
}

function Feed({ entries }) {
  if (!entries.length) return <div className="empty">No shared activity yet.</div>;
  return (
    <div className="feed-list">
      {entries.map((entry) => {
        const amount = entry.finalSellPrice ?? entry.amount ?? 0;
        return (
          <article className="feed-row" key={entry.id}>
            <div className={`type-icon ${entry.type}`}>{entry.type?.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{entry.product || entry.customerName || entry.note || entry.type}</strong>
              <p>
                {entry.type?.replaceAll("_", " ")} · {entry.date || "Pending date"}
                {entry.createdByEmail ? ` · ${entry.createdByEmail}` : ""}
              </p>
            </div>
            <b>{money(amount)}</b>
          </article>
        );
      })}
    </div>
  );
}

function Stock({ stock, canWrite, addStock }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialStock);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const visible = stock
    .map(normalizeStock)
    .filter((item) =>
      `${item.brand} ${item.model} ${item.imeiSerial}`.toLowerCase().includes(search.toLowerCase()),
    );
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const result = await addStock(form);
      setMessage(result.queued ? "Saved offline; waiting for connection." : "Stock synced.");
      setForm(initialStock);
      setOpen(false);
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">IMEI inventory</p>
          <h2>Stock</h2>
        </div>
        {canWrite && (
          <button className="primary compact" onClick={() => setOpen(!open)}>
            {open ? "Close" : "+ Add phone"}
          </button>
        )}
      </div>
      <input
        className="search"
        placeholder="Search brand, model or IMEI"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {message && <p className="notice">{message}</p>}
      {open && (
        <form className="form-grid stock-form" onSubmit={submit}>
          {[
            ["category", "Category"],
            ["brand", "Brand"],
            ["model", "Model / Device", true],
            ["storage", "Storage"],
            ["color", "Color"],
            ["imeiSerial", "IMEI / Serial"],
            ["quantity", "Quantity", true, "number"],
            ["buyPrice", "Buy price", true, "number"],
            ["preparationCost", "Preparation cost", false, "number"],
            ["sellPrice", "Asking price", false, "number"],
            ["supplierName", "Supplier"],
            ["warrantyDays", "Warranty days", false, "number"],
            ["batteryHealth", "Battery health %", false, "number"],
          ].map(([name, label, required, type]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type={type || "text"}
                min={type === "number" ? 0 : undefined}
                required={required}
                value={form[name]}
                onChange={(event) => setForm({ ...form, [name]: event.target.value })}
              />
            </label>
          ))}
          <label>
            iCloud / FRP
            <select value={form.icloudFrpStatus} onChange={(event) => setForm({ ...form, icloudFrpStatus: event.target.value })}>
              <option value="clear">Clear</option>
              <option value="locked">Locked</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="check-label">
            <input type="checkbox" checked={form.certChecksPassed} onChange={(event) => setForm({ ...form, certChecksPassed: event.target.checked })} />
            Display, camera, speaker, mic, SIM and biometrics checked
          </label>
          <label className="span-2">
            Device history / preparation notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
          <div className="estimate">
            Estimated margin:{" "}
            <strong>{money(number(form.sellPrice) - number(form.buyPrice) - number(form.preparationCost))}</strong>
          </div>
          <button className="primary" type="submit">Save to shared stock</button>
        </form>
      )}
      <div className="stock-grid">
        {visible.map((item) => (
          <article className="stock-card" key={item.id}>
            <div className="section-head">
              <span className={`cert ${certification(item)}`}>{certification(item).replace("_", " ")}</span>
              <b>{item.availableQty} available</b>
            </div>
            <h3>{item.brand} {item.model}</h3>
            <p>{[item.storage, item.color].filter(Boolean).join(" · ") || "No variant details"}</p>
            <code>{item.imeiSerial || "IMEI not added"}</code>
            <div className="price-row"><span>Cost {money(item.buyPrice + item.preparationCost)}</span><strong>{money(item.sellPrice)}</strong></div>
          </article>
        ))}
        {!visible.length && <div className="empty">No matching stock.</div>}
      </div>
    </section>
  );
}

function Pos({ stock, saveSale }) {
  const available = stock.map(normalizeStock).filter((item) => item.availableQty > 0);
  const [form, setForm] = useState({
    stockId: "",
    finalSellPrice: "",
    paidAmount: "",
    paymentMethod: "cash",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
  });
  const [message, setMessage] = useState("");
  const selected = available.find((item) => item.id === form.stockId);
  const due = Math.max(0, number(form.finalSellPrice) - number(form.paidAmount));
  const choose = (stockId) => {
    const item = available.find((row) => row.id === stockId);
    setForm({ ...form, stockId, finalSellPrice: item?.sellPrice || "", paidAmount: item?.sellPrice || "" });
  };
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const result = await saveSale(form);
      setMessage(result.queued ? "Sale saved offline; awaiting server confirmation." : "Sale synced to every device.");
      setForm({ ...form, stockId: "", finalSellPrice: "", paidAmount: "", customerName: "", customerPhone: "", customerAddress: "" });
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section className="panel">
      <p className="eyebrow">Point of sale</p>
      <h2>Complete a phone sale</h2>
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">
          Select exact stock
          <select required value={form.stockId} onChange={(event) => choose(event.target.value)}>
            <option value="">Choose available phone</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>{item.brand} {item.model} · {item.imeiSerial || "No IMEI"} · {item.availableQty} pc</option>
            ))}
          </select>
        </label>
        <label>Final sell price<input type="number" min="0" required value={form.finalSellPrice} onChange={(event) => setForm({ ...form, finalSellPrice: event.target.value })} /></label>
        <label>Paid now<input type="number" min="0" required value={form.paidAmount} onChange={(event) => setForm({ ...form, paidAmount: event.target.value })} /></label>
        <label>Payment method<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="cash">Cash</option><option value="bkash">bKash</option><option value="bank">Bank</option><option value="card">Card</option></select></label>
        <div className="estimate">Due: <strong>{money(due)}</strong></div>
        <label>Customer name<input required={due > 0} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
        <label>Customer phone<input required={due > 0} value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} /></label>
        <label className="span-2">Full address<textarea value={form.customerAddress} onChange={(event) => setForm({ ...form, customerAddress: event.target.value })} /></label>
        {selected && <div className="sale-summary span-2">Asking {money(selected.sellPrice)} · Estimated margin {money(number(form.finalSellPrice) - selected.buyPrice - selected.preparationCost)}</div>}
        {message && <p className="notice span-2">{message}</p>}
        <button className="primary span-2" type="submit">Confirm sale and sync</button>
      </form>
    </section>
  );
}

function Exchange({ stock, saveExchange }) {
  const available = stock.map(normalizeStock).filter((item) => item.availableQty > 0);
  const [form, setForm] = useState({
    newPhoneStockId: "",
    newPhoneSalePrice: "",
    oldPhoneBrand: "",
    oldPhoneModel: "",
    oldPhoneIMEI: "",
    oldPhoneCondition: "",
    oldPhoneAllowanceValue: "",
    oldPhonePreparationCost: "",
    oldPhoneExpectedResalePrice: "",
    cashFromCustomer: "",
    cashPaidToCustomer: "",
    dueAmount: "",
    customerName: "",
    customerPhone: "",
    riskGrade: "medium",
    approvalResult: "approved",
  });
  const [message, setMessage] = useState("");
  const selected = available.find((item) => item.id === form.newPhoneStockId);
  const estimatedProfit =
    number(form.newPhoneSalePrice) -
    number(selected?.buyPrice) +
    number(form.oldPhoneExpectedResalePrice) -
    number(form.oldPhoneAllowanceValue) -
    number(form.oldPhonePreparationCost);
  const choose = (id) => {
    const item = available.find((row) => row.id === id);
    setForm({ ...form, newPhoneStockId: id, newPhoneSalePrice: item?.sellPrice || "" });
  };
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      const result = await saveExchange(form);
      setMessage(
        `${result.queued ? "Exchange queued offline" : "Exchange synced"} · estimated profit ${money(result.exchangeEstimatedProfit)}`,
      );
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section className="panel">
      <p className="eyebrow">Trade-in intelligence</p>
      <h2>Phone exchange</h2>
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">
          Phone leaving stock
          <select required value={form.newPhoneStockId} onChange={(event) => choose(event.target.value)}>
            <option value="">Select phone</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.brand} {item.model} · {item.imeiSerial || "No IMEI"}
              </option>
            ))}
          </select>
        </label>
        <label>New phone sale price<input type="number" min="0" required value={form.newPhoneSalePrice} onChange={(event) => setForm({ ...form, newPhoneSalePrice: event.target.value })} /></label>
        <label>Old phone allowance<input type="number" min="0" required value={form.oldPhoneAllowanceValue} onChange={(event) => setForm({ ...form, oldPhoneAllowanceValue: event.target.value })} /></label>
        <label>Old phone brand<input required value={form.oldPhoneBrand} onChange={(event) => setForm({ ...form, oldPhoneBrand: event.target.value })} /></label>
        <label>Old phone model<input required value={form.oldPhoneModel} onChange={(event) => setForm({ ...form, oldPhoneModel: event.target.value })} /></label>
        <label>Old phone IMEI<input value={form.oldPhoneIMEI} onChange={(event) => setForm({ ...form, oldPhoneIMEI: event.target.value })} /></label>
        <label>Expected resale price<input type="number" min="0" value={form.oldPhoneExpectedResalePrice} onChange={(event) => setForm({ ...form, oldPhoneExpectedResalePrice: event.target.value })} /></label>
        <label>Old phone preparation cost<input type="number" min="0" value={form.oldPhonePreparationCost} onChange={(event) => setForm({ ...form, oldPhonePreparationCost: event.target.value })} /></label>
        <label>Condition<input value={form.oldPhoneCondition} onChange={(event) => setForm({ ...form, oldPhoneCondition: event.target.value })} /></label>
        <label>Cash received<input type="number" min="0" value={form.cashFromCustomer} onChange={(event) => setForm({ ...form, cashFromCustomer: event.target.value })} /></label>
        <label>Cash paid to customer<input type="number" min="0" value={form.cashPaidToCustomer} onChange={(event) => setForm({ ...form, cashPaidToCustomer: event.target.value })} /></label>
        <label>Due amount<input type="number" min="0" value={form.dueAmount} onChange={(event) => setForm({ ...form, dueAmount: event.target.value })} /></label>
        <label>Risk grade<select value={form.riskGrade} onChange={(event) => setForm({ ...form, riskGrade: event.target.value })}><option>low</option><option>medium</option><option>high</option></select></label>
        <label>Customer name<input required={number(form.dueAmount) > 0} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
        <label>Customer phone<input required={number(form.dueAmount) > 0} value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} /></label>
        <div className="estimate span-2">Estimated exchange profit <strong>{money(estimatedProfit)}</strong></div>
        {message && <p className="notice span-2">{message}</p>}
        <button className="primary span-2" type="submit">Complete exchange and sync</button>
      </form>
    </section>
  );
}

function Dues({ customers, collectDue, canWrite }) {
  const [amounts, setAmounts] = useState({});
  const [message, setMessage] = useState("");
  const collect = async (customer) => {
    try {
      await collectDue(customer, amounts[customer.id]);
      setAmounts({ ...amounts, [customer.id]: "" });
      setMessage("Collection synced. It counts as cashflow, not profit.");
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section className="panel">
      <p className="eyebrow">Customer balances</p>
      <h2>Dues</h2>
      {message && <p className="notice">{message}</p>}
      <div className="due-list">
        {customers.filter((customer) => number(customer.dueBalance) > 0).map((customer) => (
          <article className="due-card" key={customer.id}>
            <div><h3>{customer.name}</h3><p>{customer.phone} · {customer.address}</p></div>
            <strong>{money(customer.dueBalance)}</strong>
            {canWrite && <input type="number" min="0" max={customer.dueBalance} placeholder="Collection" value={amounts[customer.id] || ""} onChange={(event) => setAmounts({ ...amounts, [customer.id]: event.target.value })} />}
            {canWrite && <button className="secondary compact" onClick={() => collect(customer)}>Collect</button>}
          </article>
        ))}
        {!customers.some((customer) => number(customer.dueBalance) > 0) && <div className="empty">No outstanding customer dues.</div>}
      </div>
    </section>
  );
}

function Reports({ entries, stock, customers, addExpense, canWrite }) {
  const metrics = dashboardMetrics(entries, stock, customers);
  const [expense, setExpense] = useState({ amount: "", note: "" });
  const sales = entries.filter((entry) => entry.type === "sale" && !entry.deletedAt);
  const submit = async (event) => {
    event.preventDefault();
    await addExpense(expense);
    setExpense({ amount: "", note: "" });
  };
  return (
    <section className="panel">
      <p className="eyebrow">Business truth</p>
      <h2>Reports</h2>
      <div className="metric-grid compact-grid">
        <article className="metric"><span>All recorded sales</span><strong>{money(sales.reduce((sum, item) => sum + number(item.finalSellPrice), 0))}</strong></article>
        <article className="metric"><span>Phone margin</span><strong>{money(sales.reduce((sum, item) => sum + phoneMargin(item), 0))}</strong></article>
        <article className="metric"><span>Stock value</span><strong>{money(metrics.stockValue)}</strong></article>
        <article className="metric"><span>Outstanding due</span><strong>{money(metrics.totalDue)}</strong></article>
      </div>
      {canWrite && (
        <form className="expense-form" onSubmit={submit}>
          <input type="number" min="0" required placeholder="Expense amount" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} />
          <input required placeholder="Expense description" value={expense.note} onChange={(event) => setExpense({ ...expense, note: event.target.value })} />
          <button className="secondary" type="submit">Record expense</button>
        </form>
      )}
      <p className="muted">Due collections are included in cashflow only. No repair or service income is used.</p>
    </section>
  );
}

function Settings({ user, setMember }) {
  const [member, setMemberForm] = useState({ uid: "", role: "manager", active: true });
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    try {
      await setMember(member);
      setMessage(`${member.role} access saved.`);
      setMemberForm({ ...member, uid: "" });
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <section className="panel">
      <p className="eyebrow">Owner controls</p>
      <h2>Team access</h2>
      <p className="muted">New users register first, then send the owner their Firebase UID. Only the owner can activate roles.</p>
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">User UID<input required value={member.uid} onChange={(event) => setMemberForm({ ...member, uid: event.target.value })} /></label>
        <label>Role<select value={member.role} onChange={(event) => setMemberForm({ ...member, role: event.target.value })}><option value="manager">Manager</option><option value="staff">Staff</option><option value="viewer">Viewer</option></select></label>
        <label>Access<select value={String(member.active)} onChange={(event) => setMemberForm({ ...member, active: event.target.value === "true" })}><option value="true">Active</option><option value="false">Disabled</option></select></label>
        {message && <p className="notice span-2">{message}</p>}
        <button className="primary span-2" type="submit">Save member access</button>
      </form>
      <div className="access-box"><span>Your UID</span><code>{user.uid}</code></div>
    </section>
  );
}

function App() {
  const authState = useAuth();
  const [active, setActive] = useState("Dashboard");

  if (!firebaseReady) {
    return <main className="auth-shell"><section className="auth-card"><h1>Firebase setup required</h1><p>Add the VITE_FIREBASE_* variables and VITE_SHOP_ID in Netlify, then redeploy. No local-only fallback is used because it would split the manager and owner feeds.</p></section></main>;
  }
  if (authState.loading) return <div className="loader">Connecting to Kabbo…</div>;
  if (!authState.user || !authState.role) return <AuthScreen authState={authState} />;

  return <AuthenticatedApp authState={authState} active={active} setActive={setActive} />;
}

function AuthenticatedApp({ authState, active, setActive }) {
  const shop = useShopData(authState.user);
  const metrics = useMemo(() => dashboardMetrics(shop.entries, shop.stock, shop.customers), [shop.entries, shop.stock, shop.customers]);
  const canWrite = ["owner", "manager", "staff"].includes(authState.role);
  const visibleTabs = authState.role === "owner" ? [...tabs, "Settings"] : tabs;
  return (
    <div className="app-shell">
      <header>
        <div className="brand"><div className="brand-mark small">K</div><div><strong>Kabbo Ledger</strong><span>{authState.role} · {SHOP_ID}</span></div></div>
        <div className="header-actions"><SyncBadge sync={shop.sync} /><button className="link" onClick={authState.logout}>Sign out</button></div>
      </header>
      {shop.sync.state === "failed" && <div className="sync-error">{shop.sync.message}</div>}
      <main className="content">
        {active === "Dashboard" && <Dashboard metrics={metrics} entries={shop.entries} />}
        {active === "Feed" && <section className="panel"><p className="eyebrow">Shared live stream</p><h2>Shop feed</h2><Feed entries={shop.entries} /></section>}
        {active === "Stock" && <Stock stock={shop.stock} canWrite={canWrite} addStock={shop.addStock} />}
        {active === "POS" && (canWrite ? <Pos stock={shop.stock} saveSale={shop.saveSale} /> : <div className="empty">Viewer accounts cannot create sales.</div>)}
        {active === "Exchange" && (canWrite ? <Exchange stock={shop.stock} saveExchange={shop.saveExchange} /> : <div className="empty">Viewer accounts cannot create exchanges.</div>)}
        {active === "Dues" && <Dues customers={shop.customers} collectDue={shop.collectDue} canWrite={canWrite} />}
        {active === "Reports" && <Reports entries={shop.entries} stock={shop.stock} customers={shop.customers} addExpense={shop.addExpense} canWrite={canWrite} />}
        {active === "Settings" && authState.role === "owner" && <Settings user={authState.user} setMember={shop.setMember} />}
      </main>
      <nav>
        {visibleTabs.map((tab) => <button className={active === tab ? "active" : ""} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}
      </nav>
    </div>
  );
}

export default App;
