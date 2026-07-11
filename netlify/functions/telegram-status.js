import { missingEnvVars } from './_firebaseAdmin.js';

// Reports only env VAR NAMES that are missing, never any secret value. The dashboard
// uses this instead of a hardcoded "not configured" message.
export default async () => {
  const missing = missingEnvVars();
  const body = missing.length
    ? { status: 'not_configured', missing }
    : { status: 'connected' };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
