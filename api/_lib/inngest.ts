import { Inngest } from 'inngest';

// Minimal client for API context - isolated from src/ to prevent Vercel bundle issues
export const inngest = new Inngest({
  id: 'enricher-labs',
});
