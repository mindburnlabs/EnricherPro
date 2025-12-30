# Setup Guide: Enricher Labs

## Prerequisites
- Node.js 20+
- Docker (optional, for local Postgres)
- Neon / Supabase account (for remote Postgres)
- Firecrawl & OpenRouter API Keys

## 1. Environment Variables
Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required keys:
- `DATABASE_URL` (Postgres connection string)
- `FIRECRAWL_API_KEY`
- `OPENROUTER_API_KEY`

## 2. Install Dependencies
```bash
npm install
```

## 3. Database Setup
We use Drizzle ORM.

```bash
# Push schema to DB
npm run db:push

# (Optional) Verify connection
npx tsx scripts/verify-db.ts
```

## 4. Inngest Dev Server
Start the orchestration server locally:

```bash
npx inngest-cli@latest dev
```

## 5. App Development
Start the Vite dev server:

```bash
npm run dev
```

Visit `http://localhost:3000`.
