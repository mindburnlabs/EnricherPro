# Operations & Maintenance Guide

## Deployment

### Vercel (Production)
The system is designed to run on Vercel Serverless Functions.

1.  **Push to Git**: `git push origin main`
2.  **Vercel Build**: Automatic trigger.
3.  **Environment Variables**:
    - `POSTGRES_URL`: Neon Connection String
    - `FIRECRAWL_API_KEY`: For browsing/logistics
    - `OPENROUTER_API_KEY`: For LLM agents
    - `INNGEST_EVENT_KEY`: For durable background jobs
    - `INNGEST_SIGNING_KEY`: For verifying warnings

### Docker (Optional)
A `Dockerfile` can be added if containerization is needed. Currently not configured.

## Monitoring

### Health Checks
- **Liveness**: `GET /api/status` (Simple ping)
- **Deep Check**: `GET /api/health/deep` (DB + API connectivity)

### Alerts
- Monitor for `503 Service Unavailable` on `/api/health/deep`.
- Monitor for `failed` count in `items` table > 10%.

## Troubleshooting

### Common Issues

**1. "MPN missing" Error in Quality Gate**
- **Cause**: LLM failed to extract MPN or product page was ambiguous.
- **Fix**: Check source URL. If page is valid, retry job. If page is bad, item is correctly rejected.

**2. Rate Limits (429)**
- **Cause**: Too many `start-research` calls from same IP.
- **Fix**: Wait 60s or whitelist IP in `src/lib/rateLimit.ts` (requires redeploy).

**3. Database Connection Errors**
- **Cause**: Serverless cold start or pool exhaustion.
- **Fix**: Check Vercel/Neon dashboard. System auto-retries on next request usually.

## Recovery

To retry a failed job, you can currently re-submit the same input. The `DeduplicationService` might match the old item. To force a fresh retry, append a random char to input (temporary workaround) or implement a `retry` button in UI (planned Phase 6).
