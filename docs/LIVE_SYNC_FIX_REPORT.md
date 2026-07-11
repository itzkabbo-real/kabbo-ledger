# Live Sync Fix Report — Kabbo Digital Ledger

## Problems found

| Layer | Problem | Effect |
| --- | --- | --- |
| Auth | `resolveShopRole` assigned new users `staff` when an owner already existed | Managers could use the UI locally but were not treated as writers |
| Sync | `onSnapshot` replaced state from cloud and ignored `kabbo-pending-sync` | Manager entries vanished from UI / never reached owner |
| Sync | Listener errors labeled as Offline | Hid permission-denied failures |
| Backend | `telegram-status` required `FIREBASE_PROJECT_ID` even when project id is known | False “not connected” |
| Repo | GitHub `kabbo-ledger` was empty | No durable source of truth for the live Netlify app |
| Rules | Needed explicit owner/manager write + member bootstrap | Without published rules matching the client, writes fail |

## Fixes

- `src/hooks/useAuth.js` — default/migrate to `manager`
- `src/hooks/useShopData.js` — merge pending ops, clearer sync-failed + retry
- `firestore.rules` — authenticated shop members read; owner/manager write
- Netlify functions restored under `netlify/functions/`
- App source reconstructed from production bundle + wired to fixed hooks

## Owner actions required after merge

1. Deploy Firestore rules to `kabbo-mobile-shop-app`
2. Redeploy Netlify from this repo
3. Ask manager to log out/in once (role upgrade staff→manager)
4. Confirm Settings shows Sync: Synced on both phones after one POS/stock save
