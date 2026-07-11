import { missingEnvVars, sendTelegramMessage } from './_firebaseAdmin.js';

// Manual trigger to confirm the Telegram bot/chat are wired up, guarded by a
// secret query param so it cannot be spammed by anyone who finds the URL.
export default async (req) => {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  if (!process.env.REPORT_TEST_SECRET || secret !== process.env.REPORT_TEST_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const missing = missingEnvVars();
  if (missing.length) {
    return new Response(JSON.stringify({ ok: false, missing }), { status: 200 });
  }

  const result = await sendTelegramMessage('Kabbo Digital Ledger: test message. Telegram alerts are working.');
  return new Response(JSON.stringify({ ok: true, sent: Boolean(result?.ok) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
