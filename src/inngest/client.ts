import '../lib/suppress-warnings.js';
import { Inngest } from 'inngest';
import { eventSchemas } from '../lib/events.js';

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'enricher-labs',
  schemas: eventSchemas,
});
