import { EnrichedItem } from '../types/domain.js';

export const getPublishingBlockers = (item: EnrichedItem): string[] => {
  const blockers: string[] = [];
  const sku = item.data;

  if (!sku.tech_specs?.yield) blockers.push('Missing Yield');
  if (!sku.images || sku.images.length === 0) blockers.push('No Image Gallery');

  return blockers;
};
