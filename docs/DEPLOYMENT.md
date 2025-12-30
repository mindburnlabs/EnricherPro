# Deployment Guide

## Release Process
Deployments are automated via Vercel Git Integration. Pushing to `main` triggers a production deployment.

### Gated Checks
We utilize a strict checking script `npm run check:all` which enforces:
1. `npm run lint`: Static analysis and type checking.
2. `npm run test`: Unit verification.
3. `npm run build`: Production build asset generation.

**If any step fails, the deployment is aborted.**

## Rollback Strategy
If a bad deployment reaches production:
1. Log in to Vercel Dashboard.
2. Go to **Deployments** tab.
3. Find the last known good deployment (GREEN status).
4. Click the "..." menu and select **Instant Rollback**.
5. Vercel will immediately revert traffic to that immutable deployment alias.

## Emergency Stop
To halt processing without code changes:
1. Set `NEXT_PUBLIC_MAINTENANCE_MODE=true` (or `VITE_APP_MAINTENANCE_MODE=true`) in Vercel Environment Variables.
2. Redeploy (or use Vercel "Redeploy" button on existing commit).
3. The app should respect this flag and disable new inputs (requires app logic support, currently mostly manual kill via API key revocation if needed).
