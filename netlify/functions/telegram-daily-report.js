import { getAdminDb, missingEnvVars, sendTelegramMessage } from './_firebaseAdmin.js';

const SHOP_ID = process.env.VITE_SHOP_ID || process.env.SHOP_ID || 'kabbo_mobile_kushtia';
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6, no DST

// Netlify functions run in UTC regardless of the shop's local time, so computing
// "today" with setHours() previously anchored to UTC midnight - up to 6 hours of
// early-morning Dhaka sales were silently dropped from the 11pm closing report.
function startOfDhakaDayUtc(now = new Date()) {
  const dhakaNow = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const dhakaMidnight = Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate());
  return new Date(dhakaMidnight - DHAKA_OFFSET_MS);
}

export default async () => {
  const missing = missingEnvVars();
  if (missing.length) {
    return json({ ok: false, missing }, 200);
  }

  try {
    const db = getAdminDb();
    const startOfDay = startOfDhakaDayUtc();

    const [salesSnap, duesSnap] = await Promise.all([
      db
        .collection('shops')
        .doc(SHOP_ID)
        .collection('sales')
        .where('createdAt', '>=', startOfDay)
        .get(),
      db.collection('shops').doc(SHOP_ID).collection('dues').get(),
    ]);

    const sales = salesSnap.docs.map((d) => d.data());
    const totalSold = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.sellPrice || 0), 0);
    const totalDue = duesSnap.docs.reduce((sum, d) => sum + Number(d.data().totalDue || 0), 0);

    const text =
      `<b>Kabbo Daily Closing</b>\n` +
      `Phones sold today: ${totalSold}\n` +
      `Revenue today: Tk ${totalRevenue}\n` +
      `Total outstanding due: Tk ${totalDue}`;

    const result = await sendTelegramMessage(text);
    return json({ ok: true, sent: Boolean(result?.ok), totalSold, totalRevenue, totalDue }, 200);
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) }, 200);
  }
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  schedule: '0 17 * * *',
};
