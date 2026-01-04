import { type EventSchemas } from 'inngest';
import type { EnrichedItem, ConsumableData } from '../types/domain.js';

export type ResearchStartedEvent = {
  name: 'app/research.started';
  data: {
    jobId: string;
    inputRaw: string;
    userId?: string;
    mode?: 'fast' | 'balanced' | 'deep';
  };
};

export type ResearchStepEvent = {
  name: 'app/research.step';
  data: {
    jobId: string;
    step: 'planning' | 'search' | 'extraction' | 'verification';
    message: string;
  };
};

export type ResearchCompletedEvent = {
  name: 'app/research.completed';
  data: {
    jobId: string;
    result: ConsumableData;
  };
};

export type SKUEnrichmentStartedEvent = {
  name: 'app/sku.enrichment.started';
  data: {
    jobId: string;
    skuId: string;
    tenantId: string;
    supplierString: string;
  };
};

export type Events = {
  'app/research.started': ResearchStartedEvent;
  'app/research.step': ResearchStepEvent;
  'app/research.completed': ResearchCompletedEvent;
  'app/sku.enrichment.started': SKUEnrichmentStartedEvent;
};

// Validated Schema for Inngest
export const eventSchemas = {} as EventSchemas<Events>;
