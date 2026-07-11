import { getAdminDb, shopId } from "./_firebaseAdmin.js";

export const config = { schedule: "0 17 * * *" };

function todayBD() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

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
    const day = todayBD();
    const snap = await db.collection("shops").doc(sid).collection("entries").get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !e.isDeleted && e.date === day);
    const sells = rows.filter((e) => e.type === "sell");
    const buys = rows.filter((e) => e.type === "buy");
    const expenses = rows.filter((e) => e.type === "expense");
    const exchanges = rows.filter((e) => e.type === "exchange");
    const sellTotal = sells.reduce((s, e) => s + (Number(e.finalSellPrice || e.sellPrice || e.paidAmount) || 0), 0);
    const buyTotal = buys.reduce((s, e) => s + ((Number(e.buyPrice) || 0) + (Number(e.preparationCost) || 0)) * (Number(e.quantity) || 1), 0);
    const expenseTotal = expenses.reduce((s, e) => s + (Number(e.expenseAmount) || 0), 0);
    const text = [
      `Kabbo Daily Report ${day}`,
      `Shop: ${sid}`,
      `Buys: ${buys.length} | Sells: ${sells.length} | Exchange: ${exchanges.length} | Expense: ${expenses.length}`,
      `Sell total: ৳${Math.round(sellTotal).toLocaleString("en-IN")}`,
      `Buy total: ৳${Math.round(buyTotal).toLocaleString("en-IN")}`,
      `Expense: ৳${Math.round(expenseTotal).toLocaleString("en-IN")}`,
    ].join("\n");
    const sent = await sendTelegram(text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, sent: !!sent.ok, day, count: rows.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}
