import { missingTelegramEnv } from "./_firebaseAdmin.js";

export async function handler() {
  const missing = missingTelegramEnv();
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      ok: true,
      connected: missing.length === 0,
      missing,
    }),
  };
}
