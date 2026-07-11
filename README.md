# Kabbo Digital Ledger

Live shared cloud ledger for Kabbo Mobile Shop (Kushtia).

## Production

- URL: https://kabbo-digital-ledger-kushtia.netlify.app
- Shop ID: `kabbo_mobile_kushtia`
- Firebase project: `kabbo-mobile-shop-app`

## Why manager data was not appearing in the owner feed

1. New manager accounts were created as **staff** (read-only) instead of **manager**.
2. Firestore writes from managers failed / stayed in `kabbo-pending-sync` localStorage.
3. Cloud `onSnapshot` replaced local state and dropped unsynced manager entries.
4. Sync UI reported generic offline instead of permission/sync failure.
5. This GitHub repo was empty — source lived only on a local Windows folder + Netlify CLI deploys.

## Fixes in this branch

- New shop workers default to **manager** (writable); legacy `staff` auto-upgrades to manager.
- Pending local ops are **merged** into live snapshots so manager input is not wiped.
- Honest sync status + Retry when Firestore rejects writes.
- Hardened `firestore.rules` for owner/manager write, member read.
- Netlify Telegram status no longer false-fails on missing `FIREBASE_PROJECT_ID` when project defaults exist.
- Full app source restored into git for continuous deploy.

## Local run

```bash
npm install
npm run build
npm run dev
```

## Deploy notes

1. Publish Firestore rules: `firebase deploy --only firestore:rules --project kabbo-mobile-shop-app`
2. Netlify env: `VITE_FIREBASE_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `FIREBASE_SERVICE_ACCOUNT` (or `_JSON`), optional `FIREBASE_PROJECT_ID=kabbo-mobile-shop-app`
3. Deploy: `npm run build && npx netlify deploy --prod --dir dist`

## Safety

Do not commit `.env`, service accounts, or tokens. Do not open Firestore to public read/write.
