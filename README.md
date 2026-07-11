# kabbo-ledger

**Kabbo Mobile Shop** — a simple inventory and sales ledger web app for a mobile phone shop. Track products (phones and accessories), record sales, and view a dashboard of revenue, inventory value, and low-stock alerts.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Prisma](https://www.prisma.io/) ORM with a local [SQLite](https://www.sqlite.org/) database (no external DB service required)

## Prerequisites

- Node.js 20+ (developed on Node 22)
- npm

## Setup

```bash
npm install          # installs deps and runs `prisma generate` via postinstall
npm run db:push      # creates the SQLite database from the Prisma schema
npm run db:seed      # (optional) load sample products and a sale
```

The SQLite database lives at `prisma/dev.db` and is created from `DATABASE_URL` in `.env` (`file:./dev.db`).

## Run (development)

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint (next lint) |
| `npm run db:push` | Sync the SQLite schema from `prisma/schema.prisma` |
| `npm run db:seed` | Seed sample data |
| `npm run db:reset` | Reset the database and re-seed |

## Project structure

```
prisma/schema.prisma     # Product + Sale data models (SQLite)
prisma/seed.ts           # Sample data
src/app/page.tsx         # Dashboard
src/app/products/        # Products list + add form
src/app/sales/           # Sales ledger + record-sale form
src/app/api/products/    # Products REST API (GET/POST)
src/app/api/sales/       # Sales REST API (GET/POST, decrements stock)
src/components/          # Nav + client forms
src/lib/prisma.ts        # Prisma client singleton
```
