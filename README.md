# Kabbo Digital Ledger

Mobile-first ledger / POS for a used-phone shop, rebuilt so every device — owner,
managers, staff — shares **one live feed** instead of isolated per-browser storage.

## Root cause of "manager input never reaches my feed"

The previous build (see `docs/history/` reports carried over from the prior work)
was **localStorage-only**: every phone, sale, due and ledger entry lived only inside
the browser that created it. There was no server in the loop, so:

- A manager's phone and the owner's phone/laptop had two completely separate data sets.
- Nothing could sync "live" because there was nothing to sync *through* — localStorage
  never leaves the device it was written on.
- The Telegram daily-report function couldn't read a manager's local data either
  (a server cannot read another device's browser storage), so scheduled reports were
  unreliable for the same underlying reason.
- Firestore existed in the project (env vars, `firebase.json`, an admin SDK dependency)
  but the client app never subscribed to it for live UI updates — at best it was a
  write-behind backup, not the source of truth.

## The fix implemented here

Firestore is now the **single source of truth**, and every screen subscribes to it
with real-time listeners (`onSnapshot`):

- `src/hooks/useShopData.js` opens live listeners on `stock`, `sales`, `dues`,
  `ledger`, `exchanges` and `activity` under `shops/{shopId}/...`. Any write from any
  signed-in device — manager, staff, owner — appears on every other open screen
  automatically, typically in well under a second.
- All writes (`addStockItem`, `recordSale`, `collectDue`, `addLedgerEntry`,
  `addExchange`) go through that same module, and every one of them also appends an
  `activity` entry so the dashboard has a genuine live feed of "who did what, when".
- `src/firebase.js` turns on Firestore's `persistentLocalCache` with
  `persistentMultipleTabManager`. This makes the app properly offline-first: writes
  made offline are queued in IndexedDB and automatically flushed to Firestore (and to
  every other listener) the moment connectivity returns — no more "offline" banner
  that quietly discards work or never reconciles.
- `firestore.rules` scopes every read/write to signed-in members of that shop and
  hardcodes an owner fallback so a missing/corrupted `members/{uid}` doc can never
  demote the real owner to Staff (a previously reported bug) or let anyone
  self-promote to owner/manager. **Rules that are too strict are the #1 cause of
  "sync silently does nothing"** — a denied write never throws in a way most people
  notice, it just never reaches the server. Because the shop id ships in the public
  client bundle, joining is gated by an explicit `invites/{email}` doc — the owner or
  a manager sends an invite from Settings, and only that email can self-provision a
  `staff` membership; nobody can join just by knowing the shop id.
- The Netlify functions (`telegram-daily-report`, `low-stock-alert`, `telegram-status`)
  now read live Firestore data with `firebase-admin`, so the 11pm/10am reports and the
  Settings status panel reflect what actually happened in the shop that day, not stale
  or absent local data.
- The service worker (`public/service-worker.js`) caches only the static app shell and
  hashed assets. It explicitly never intercepts Firestore/Firebase network calls, so
  the real-time sync channel is never accidentally cached or blocked — a common way
  PWA service workers break "live" apps.

## Tech stack

- React 18 + Vite 5
- Firebase (Auth + Firestore) via `firebase` client SDK
- Netlify Functions (`firebase-admin`) for scheduled Telegram reports
- Deploys to Netlify as a static SPA + serverless functions

## Data model (Firestore)

```
shops/{shopId}
  members/{uid}        role: owner | manager | staff
  stock/{id}            phone inventory (IMEI, buy/prep/sell price, status)
  sales/{id}             POS sales (paid/due split, customer snapshot)
  dues/{customerPhone}   running due balance per customer
  ledger/{id}            expenses, cash in/out, due collections (cashflow, not profit)
  exchanges/{id}         phone-for-phone exchange deals
  activity/{id}          append-only feed powering the live dashboard
```

Backward-compatible field names (`deviceName`, `amount`, `cost`, `prepCost`, `due`,
`dueAmount`, ...) are normalized in `src/lib/utils.js` instead of migrated/deleted, so
older documents keep rendering correctly.

## Local development

```bash
cp .env.example .env      # fill in your Firebase web app config
npm install
npm run dev                # http://localhost:5173
```

## Deploy

1. **Firestore rules**: open `firestore.rules`, replace `OWNER_UID_PLACEHOLDER` and
   `owner_email_placeholder@example.com` with the real owner's Firebase Auth UID and
   email, then:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project <your-project-id>
   ```
2. **Netlify env vars** (Site settings → Environment variables): all `VITE_FIREBASE_*`
   keys, `VITE_SHOP_ID`, plus server-only `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
   `FIREBASE_SERVICE_ACCOUNT` (the full service-account JSON as one string),
   `REPORT_TEST_SECRET`, optional `LOW_STOCK_THRESHOLD`.
3. **Build & deploy**:
   ```bash
   npm run build
   npx netlify deploy --prod --dir dist
   ```

## Verifying the live-sync fix

1. Sign in as a manager on device/browser A, add a stock item or complete a sale.
2. Sign in as the owner on device/browser B (or another tab). The dashboard's
   **Live activity feed** and stat boxes update within a second — no refresh needed.
3. Turn off networking on device A, add another item (it saves locally with an
   "Offline" banner), then reconnect. The item appears on device B automatically once
   Firestore flushes the queued write.
4. Settings → Telegram alerts shows "Connected" once the Netlify env vars above are
   set, and reports go out on the schedules in `netlify.toml`.

## What still needs manual/business verification

- Real end-to-end QA against the live Firebase project (this workspace has no
  credentials for `kabbo-mobile-shop-app` and does not read/expose any secret).
- Visual/UX parity check against the previous production build before cutover.
- Mobile viewport pass on real Android/iOS devices.
