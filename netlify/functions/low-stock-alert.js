import { getAdminDb, shopId } from "./_firebaseAdmin.js";

export const config = { schedule: "0 4 * * *" };

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok };
}

export async function handler() {
  try {
    const db = getAdminDb();
    const sid = shopId();
    const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 2);
    const [entriesSnap, customersSnap] = await Promise.all([
      db.collection("shops").doc(sid).collection("entries").get(),
      db.collection("shops").doc(sid).collection("customers").get(),
    ]);
    const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !e.isDeleted);
    // Simple model qty from buys-sells
    const qty = new Map();
    for (const e of entries) {
      if (!["buy", "sell"].includes(e.type)) continue;
      const key = `${e.brand || ""} ${e.model || ""} ${e.storage || ""}`.trim() || "Unknown";
      const n = Number(e.quantity) || 1;
      qty.set(key, (qty.get(key) || 0) + (e.type === "buy" ? n : -n));
    }
    const low = [...qty.entries()].filter(([, q]) => q > 0 && q <= threshold);
    const dues = customersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((c) => {
        const total = Number(c.total) || 0;
        const paid = Number(c.paid) || 0;
        const due = Math.max(0, Number(c.dueBalance ?? c.dueAmount ?? c.due ?? total - paid) || 0);
        return { name: c.name || "Customer", due };
      })
      .filter((c) => c.due > 0)
      .sort((a, b) => b.due - a.due)
      .slice(0, 5);

    const text = [
      "Kabbo Low Stock + Due Alert",
      `Shop: ${sid}`,
      `Low stock (≤${threshold}): ${low.length}`,
      ...low.slice(0, 8).map(([k, q]) => `• ${k}: ${q}`),
      `Top dues: ${dues.length}`,
      ...dues.map((d) => `• ${d.name}: ৳${Math.round(d.due).toLocaleString("en-IN")}`),
    ].join("\n");
    const sent = await sendTelegram(text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, sent: !!sent.ok, low: low.length, dues: dues.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}
