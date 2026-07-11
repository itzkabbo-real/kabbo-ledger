import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function readServiceAccount() {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }
}

export function getAdminDb() {
  const sa = readServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    sa?.project_id ||
    "kabbo-mobile-shop-app";

  if (!getApps().length) {
    if (sa) {
      initializeApp({ credential: cert(sa), projectId });
    } else {
      // Fall back to application default if present
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}

export function shopId() {
  return process.env.VITE_SHOP_ID || process.env.SHOP_ID || "kabbo_mobile_kushtia";
}

export function missingTelegramEnv() {
  const missing = [];
  if (!process.env.TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
  if (!process.env.TELEGRAM_CHAT_ID) missing.push("TELEGRAM_CHAT_ID");
  const hasSa =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  // FIREBASE_PROJECT_ID defaults to kabbo-mobile-shop-app — do not false-fail.
  if (!hasSa) missing.push("FIREBASE_SERVICE_ACCOUNT");
  return missing;
}
