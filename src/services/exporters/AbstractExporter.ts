import { EnrichedItem } from '../../types/domain.js';

export interface ExportResult {
  success: boolean;
  data?: string | object;
  errors?: string[];
  format: 'json' | 'xml' | 'yml';
  filename?: string;
}

export interface IMarketplaceExporter {
  name: string;
  validate(item: EnrichedItem): string[]; // Returns list of missing required fields
  export(item: EnrichedItem): Promise<ExportResult>;
}
