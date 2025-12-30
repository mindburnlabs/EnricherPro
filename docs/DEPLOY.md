# Deployment Guide (Vercel)

## 1. Project Configuration
This project is configured as a Vite SPA with Vercel Serverless Functions (`/api`).

- **Framework Preset:** Vite
- **Root Directory:** `./`
- **Build Command:** `vite build`
- **Output Directory:** `dist`

## 2. Environment Variables
Add the following to your Vercel Project Settings:

- `DATABASE_URL`
- `FIRECRAWL_API_KEY`
- `OPENROUTER_API_KEY`
- `INNGEST_EVENT_KEY` (From Inngest Cloud)
- `INNGEST_SIGNING_KEY` (From Inngest Cloud)

## 3. Inngest Setup
1. Create an account on [Inngest Cloud](https://app.inngest.com).
2. Connect your Vercel project.
3. Inngest will automatically detect the function at `/api/inngest`.

## 4. Deploy
Push to `main` branch or run:

```bash
vercel deploy
```
