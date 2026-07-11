# kabbo-ledger (Kabbo Mobile Shop)

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma (SQLite) app for tracking mobile-shop inventory and sales. See `README.md` for the full command reference.

## Cursor Cloud specific instructions

- Single service: the Next.js app (dev server on port `3000` via `npm run dev`). There is no separate backend — API routes live under `src/app/api/*` and the DB is local SQLite, so no external database service is needed.
- The startup update script runs `npm install` (which triggers `prisma generate` via `postinstall`) and `prisma db push` (idempotent — creates `prisma/dev.db` if missing). Both are safe to re-run.
- The SQLite file `prisma/dev.db` is git-ignored, so a fresh VM starts with an empty database. Run `npm run db:seed` to load sample data, or `npm run db:reset` to wipe and re-seed.
- After changing `prisma/schema.prisma`, run `npm run db:push` (and restart the dev server) — the Prisma client and DB are not hot-reloaded on schema changes.
- Lint: `npm run lint`. Build: `npm run build`. Both currently pass clean.
