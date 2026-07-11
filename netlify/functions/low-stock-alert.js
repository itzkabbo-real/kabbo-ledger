import { getAdminDb, missingEnvVars, sendTelegramMessage } from './_firebaseAdmin.js';

const SHOP_ID = process.env.VITE_SHOP_ID || process.env.SHOP_ID || 'kabbo_mobile_kushtia';
const THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 2);

export default async () => {
  const missing = missingEnvVars();
  if (missing.length) {
    return json({ ok: false, missing }, 200);
  }

  try {
    const db = getAdminDb();
    const [stockSnap, duesSnap] = await Promise.all([
      db.collection('shops').doc(SHOP_ID).collection('stock').where('status', '==', 'in_stock').get(),
      db.collection('shops').doc(SHOP_ID).collection('dues').get(),
    ]);

    const modelCounts = {};
    stockSnap.docs.forEach((d) => {
      const data = d.data();
      const key = `${data.brand || ''} ${data.model || data.deviceName || ''}`.trim();
      modelCounts[key] = (modelCounts[key] || 0) + Number(data.quantity ?? 1);
    });
    const lowModels = Object.entries(modelCounts).filter(([, qty]) => qty <= THRESHOLD);

    const dues = duesSnap.docs
      .map((d) => d.data())
      .filter((d) => Number(d.totalDue) > 0)
      .sort((a, b) => Number(b.totalDue) - Number(a.totalDue))
      .slice(0, 5);

    const lines = [
      '<b>Kabbo Stock &amp; Due Alert</b>',
      lowModels.length
        ? `Low stock (<= ${THRESHOLD}): ${lowModels.map(([m, q]) => `${m} (${q})`).join(', ')}`
        : 'No low-stock models.',
      dues.length
        ? `Top dues: ${dues.map((d) => `${d.customerName} Tk ${d.totalDue}`).join(', ')}`
        : 'No outstanding dues.',
    ];

    const result = await sendTelegramMessage(lines.join('\n'));
    return json({ ok: true, sent: Boolean(result?.ok), low: lowModels.length, dues: dues.length }, 200);
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
  schedule: '0 4 * * *',
};
