import { getAdminDb, shopId } from "./_firebaseAdmin.js";

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "missing telegram env" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.ok, body };
}

export async function handler() {
  const msg = `Kabbo Ledger telegram-test OK\nShop: ${shopId()}\nTime: ${new Date().toISOString()}`;
  const sent = await sendTelegram(msg);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, sent: !!sent.ok }),
  };
}
