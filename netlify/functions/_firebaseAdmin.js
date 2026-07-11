import { initializeApp, getApps } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Every Netlify function that needs Firestore shares this so the daily/low-stock
// reports read the SAME live collections the app writes to - no more localStorage-only
// data that a server can never see once the shop closes.
export function getAdminDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT');
  }
  const serviceAccount = JSON.parse(raw);
  if (!getApps().length) {
    initializeApp({ credential: credential.cert(serviceAccount) });
  }
  return getFirestore();
}

export function missingEnvVars() {
  const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const hasServiceAccount = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const missing = required.filter((key) => !process.env[key]);
  if (!hasServiceAccount) missing.push('FIREBASE_SERVICE_ACCOUNT');
  if (!process.env.VITE_FIREBASE_PROJECT_ID && !process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  return missing;
}

export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}
