# Kabbo Digital Ledger

Mobile-first, Firestore-backed shared ledger and POS for Kabbo Mobile Shop.

## What changed

The previous GitHub repository contained no application source. This rebuild establishes one canonical shop path (`shops/kabbo_mobile_kushtia`) for owner and manager data, subscribes every screen with Firestore realtime listeners, and performs related stock/sale/due writes in batches.

Core modules:

- Shared live activity feed and honest pending/offline/error status
- IMEI-level phone stock with duplicate index
- POS sales, stock decrement, customer due creation, and due collection
- Dashboard and margin/cashflow reports
- Firebase Authentication with server-enforced shop roles
- Firestore persistence and PWA app-shell caching

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill the public Firebase web app configuration.
3. Run `npm install`.
4. Run `npm run dev`.

Never place a Firebase service account, private key, Telegram token, or Netlify token in the frontend environment.

## Verification

```bash
npm test
npm run build
```

For cross-device QA, use records prefixed `KABBO_QA_DELETE_ME` and clean them after verification. Confirm:

1. Owner and manager are authenticated members of the same shop.
2. Manager adds stock; owner sees it without refreshing.
3. Owner completes a sale; manager sees the feed and stock count update.
4. Due sale and due collection update both devices.
5. Offline badge appears while disconnected and pending writes sync after reconnect.

## Deployment

Netlify uses `netlify.toml`. Configure the `VITE_FIREBASE_*` variables and `VITE_SHOP_ID`, then build. Firestore rules are deployed separately:

```bash
firebase deploy --only firestore:rules --project kabbo-mobile-shop-app
```

Rules are never made public. Only the hardcoded owner can create or change member records.
