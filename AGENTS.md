\# AGENTS.md — Kabbo Digital Ledger

## Project

Kabbo Digital Ledger is a mobile-first ledger/POS for Kabbo Mobile Shop.

## Production

- Live URL: https://kabbo-digital-ledger-kushtia.netlify.app
- Shop ID: kabbo_mobile_kushtia
- Firebase project: kabbo-mobile-shop-app
- Owner UID: Etx7842cBTNxw2D92fUOIGOnMI52
- Owner email: aryanshaykat331@gmail.com

## Business Rules

- Kabbo does phone buy, sell, and exchange.
- Kabbo does NOT do repair/service income.
- Never add repair/service income.
- Use Preparation Cost only as resale preparation cost.
- Use Device History / Preparation Notes, not Repair History.

## Safety

- Do not read, print, copy, edit, commit, or expose .env, .env.netlify, .secrets, tokens, private keys, or service account JSON.
- Do not import seed data.
- Do not loosen Firestore to public read/write.
- Do not delete real data.
- Test data must use prefix KABBO_QA_DELETE_ME and must be cleaned.

## Commands

- Build: npm run build
- Sync merge test: node scripts/test-sync-merge.mjs
- Deploy only after approval: npx netlify deploy --prod --dir dist

## Live sync invariant

Manager and owner must share `shops/kabbo_mobile_kushtia` via Firestore onSnapshot.
localStorage is cache/offline queue only — never the source of truth when online.
