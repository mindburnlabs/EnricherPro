/**
 * Enhanced Related Products Discovery Service
 * Implements smart relationship categorization, prioritization, and deduplication
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { PrinterCompatibility, RelatedItem, ConsumableData } from '../types';

// Enhanced relationship types with more specific categorization
export type RelationshipType = 
  | 'companion_drum'           // Drum unit for the same printer
  | 'companion_toner'          // Toner cartridge for the same printer
  | 'companion_maintenance'    // Maintenance kit for the same printer
  | 'companion_waste'          // Waste toner container for the same printer
  | 'alternative_oem'          // OEM alternative (different yield/color)
  | 'alternative_compatible'   // Compatible alternative
  | 'alternative_high_yield'   // High yield version
  | 'alternative_standard'     // Standard yield version
  | 'color_variant'           // Same model, different color
  | 'multipack'               // Multi-pack version
  | 'starter'                 // Starter cartridge version
  | 'replacement_newer'       // Newer model replacement
  | 'replacement_older'       // Older model replacement
  | 'cross_compatible';       // Cross-compatible with similar printers

export interface EnhancedRelatedItem extends RelatedItem {
  // Enhanced fields for better categorization
  relationship: RelationshipType; // Override to use specific type instead of string
  priority: number;           // 1-10 priority for display ordering
  confidence: number;         // 0-1 confidence in the relationship
  sourceCount: number;        // Number of sources confirming this relationship
  printerOverlap: number;     // Percentage of printer compatibility overlap
  yieldComparison?: 'higher' | 'lower' | 'same' | 'unknown';
  colorVariant?: string;      // Color if different from current item
  isOEM: boolean;            // Whether this is an OEM product
  estimatedPrice?: 'higher' | 'lower' | 'same' | 'unknown';
  availability: 'high' | 'medium' | 'low' | 'unknown';
  
  // Source tracking
  sources: {
    url: string;
    sourceType: 'cartridge_ru' | 'rashodnika_net' | 'oem' | 'marketplace' | 'other';
    confidence: number;
    extractedAt: string;
  }[];
}

export interface RelatedProductsResult {
  full: EnhancedRelatedItem[];           // Complete list for data storage
  display: EnhancedRelatedItem[];        // Curated list for UI display (8-12 items)
  categories: {
    companions: EnhancedRelatedItem[];   // Same printer, different consumable type
    alternatives: EnhancedRelatedItem[]; // Same type, different specifications
    colorVariants: EnhancedRelatedItem[]; // Same model, different colors
    replacements: EnhancedRelatedItem[]; // Newer/older model replacements
  };
  metadata: {
    totalFound: number;
    duplicatesRemoved: number;
    sourcesQueried: number;
    processingTimeMs: number;
    qualityScore: number; // Overall quality of the related products data
  };
}

/**
 * Determines the relationship type between two consumables
 */
export function categorizeRelationship(
  currentItem: Partial<ConsumableData>,
  relatedItem: Partial<ConsumableData>,
  printerOverlap: number
): RelationshipType {
  // Same printer compatibility, different consumable types = companions
  if (printerOverlap > 0.7) {
    if (currentItem.consumable_type !== relatedItem.consumable_type) {
      switch (relatedItem.consumable_type) {
        case 'drum_unit': return 'companion_drum';
        case 'toner_cartridge': return 'companion_toner';
        case 'other': return 'companion_maintenance'; // Map 'other' to maintenance for compatibility
        default: return 'cross_compatible';
      }
    }
    
    // Same type, different specifications = alternatives
    if (currentItem.consumable_type === relatedItem.consumable_type) {
      // Check for color variants
      if (currentItem.color !== relatedItem.color && relatedItem.color) {
        return 'color_variant';
      }
      
      // Check for yield differences
      if (currentItem.yield && relatedItem.yield) {
        if (relatedItem.yield.value > currentItem.yield.value * 1.2) {
          return 'alternative_high_yield';
        } else if (relatedItem.yield.value < currentItem.yield.value * 0.8) {
          return 'alternative_standard';
        }
      }
      
      // Check for OEM vs compatible
      const currentIsOEM = isOEMProduct(currentItem);
      const relatedIsOEM = isOEMProduct(relatedItem);
      
      if (currentIsOEM && !relatedIsOEM) {
        return 'alternative_compatible';
      } else if (!currentIsOEM && relatedIsOEM) {
        return 'alternative_oem';
      }
      
      return 'alternative_oem'; // Default for same type
    }
  }
  
  // Lower overlap but still compatible
  if (printerOverlap > 0.3) {
    return 'cross_compatible';
  }
  
  // Model number suggests replacement relationship
  if (isReplacementModel(currentItem.model, relatedItem.model)) {
    return isNewerModel(currentItem.model, relatedItem.model) 
      ? 'replacement_newer' 
      : 'replacement_older';
  }
  
  return 'cross_compatible';
}

/**
 * Calculates priority for display ordering
 * Higher priority = more relevant to show first
 */
export function calculateDisplayPriority(
  relationship: RelationshipType,
  printerOverlap: number,
  confidence: number,
  sourceCount: number
): number {
  // Handle NaN and invalid values
  const safeOverlap = isNaN(printerOverlap) ? 0 : Math.max(0, Math.min(1, printerOverlap));
  const safeConfidence = isNaN(confidence) ? 0 : Math.max(0, Math.min(1, confidence));
  const safeSourceCount = isNaN(sourceCount) ? 1 : Math.max(1, sourceCount);
  
  let basePriority = 5;
  
  // Relationship type priority
  switch (relationship) {
    case 'companion_drum':
    case 'companion_toner':
      basePriority = 10; // Highest - essential companions
      break;
    case 'companion_maintenance':
    case 'companion_waste':
      basePriority = 9; // High - maintenance items
      break;
    case 'alternative_high_yield':
    case 'alternative_oem':
      basePriority = 8; // High - direct alternatives
      break;
    case 'color_variant':
      basePriority = 7; // Medium-high - color options
      break;
    case 'alternative_compatible':
    case 'alternative_standard':
      basePriority = 6; // Medium - alternatives
      break;
    case 'replacement_newer':
      basePriority = 5; // Medium - upgrades
      break;
    case 'cross_compatible':
      basePriority = 4; // Lower - cross compatibility
      break;
    case 'replacement_older':
      basePriority = 3; // Low - older models
      break;
    default:
      basePriority = 2;
  }
  
  // Adjust based on printer overlap (0-3 bonus points)
  const overlapBonus = Math.floor(safeOverlap * 3);
  
  // Adjust based on confidence (0-2 bonus points)
  const confidenceBonus = Math.floor(safeConfidence * 2);
  
  // Adjust based on source count (0-1 bonus points)
  const sourceBonus = Math.min(safeSourceCount - 1, 1);
  
  return Math.min(10, basePriority + overlapBonus + confidenceBonus + sourceBonus);
}

/**
 * Enhanced deduplication with smart merging
 */
export function deduplicateRelatedItems(items: EnhancedRelatedItem[]): EnhancedRelatedItem[] {
  const modelMap = new Map<string, EnhancedRelatedItem>();
  
  for (const item of items) {
    const normalizedModel = normalizeModel(item.model);
    
    // Skip items with empty or invalid models
    if (!normalizedModel) {
      continue;
    }
    
    // Skip items with invalid confidence values
    if (isNaN(item.confidence) || item.confidence < 0) {
      continue;
    }
    
    if (modelMap.has(normalizedModel)) {
      // Merge with existing item - keep the one with higher confidence
      const existing = modelMap.get(normalizedModel)!;
      const merged: EnhancedRelatedItem = {
        ...existing,
        // Keep higher confidence data, handling NaN values
        confidence: Math.max(
          isNaN(existing.confidence) ? 0 : existing.confidence, 
          isNaN(item.confidence) ? 0 : item.confidence
        ),
        sourceCount: existing.sourceCount + item.sourceCount,
        priority: Math.max(existing.priority, item.priority),
        // Merge sources
        sources: [...existing.sources, ...item.sources],
        // Update relationship if the new one is more specific
        relationship: getMoreSpecificRelationship(existing.relationship, item.relationship as RelationshipType)
      };
      
      modelMap.set(normalizedModel, merged);
    } else {
      modelMap.set(normalizedModel, item);
    }
  }
  
  return Array.from(modelMap.values());
}

/**
 * Enhanced deduplication that also excludes the current item
 */
export function deduplicateAndExcludeCurrentItem(
  items: EnhancedRelatedItem[], 
  currentModel: string
): EnhancedRelatedItem[] {
  const currentNormalized = normalizeModel(currentModel);
  
  // First deduplicate
  const deduplicated = deduplicateRelatedItems(items);
  
  // Then exclude current item
  return deduplicated.filter(item => {
    const itemNormalized = normalizeModel(item.model);
    return itemNormalized !== currentNormalized;
  });
}

/**
 * Creates optimized display list with smart prioritization
 */
export function createDisplayList(
  allItems: EnhancedRelatedItem[],
  maxItems: number = 10
): EnhancedRelatedItem[] {
  // First deduplicate the items
  const deduplicated = deduplicateRelatedItems(allItems);
  
  // Sort by priority (descending), then by confidence (descending), then by model for stability
  const sorted = [...deduplicated].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    // Add model comparison for stable sorting
    return a.model.localeCompare(b.model);
  });
  
  // Ensure variety in relationship types
  const display: EnhancedRelatedItem[] = [];
  const relationshipCounts = new Map<RelationshipType, number>();
  
  for (const item of sorted) {
    if (display.length >= maxItems) break;
    
    const currentCount = relationshipCounts.get(item.relationship as RelationshipType) || 0;
    const maxPerType = Math.ceil(maxItems / 4); // Allow up to 25% of one type
    
    if (currentCount < maxPerType) {
      display.push(item);
      relationshipCounts.set(item.relationship as RelationshipType, currentCount + 1);
    }
  }
  
  // Fill remaining slots with highest priority items if we have space
  for (const item of sorted) {
    if (display.length >= maxItems) break;
    if (!display.includes(item)) {
      display.push(item);
    }
  }
  
  return display.slice(0, maxItems);
}

/**
 * Simulates querying multiple compatibility databases for related consumables
 * In a real implementation, this would make actual API calls
 */
export async function queryCompatibilityDatabases(
  printers: PrinterCompatibility[],
  currentModel: string
): Promise<EnhancedRelatedItem[]> {
  const startTime = Date.now();
  const relatedItems: EnhancedRelatedItem[] = [];
  
  // Simulate database queries for each printer
  for (const printer of printers) {
    // Simulate cartridge.ru query
    const cartridgeResults = await simulateCartridgeRuQuery(printer.model);
    relatedItems.push(...cartridgeResults);
    
    // Simulate rashodnika.net query
    const rashodnikaResults = await simulateRashodnikaQuery(printer.model);
    relatedItems.push(...rashodnikaResults);
    
    // Simulate OEM source query if available
    if (printer.sources.some(s => s.sourceType === 'official')) {
      const oemResults = await simulateOEMQuery(printer.model);
      relatedItems.push(...oemResults);
    }
  }
  
  // Filter out the current item
  const filtered = relatedItems.filter(item => 
    normalizeModel(item.model) !== normalizeModel(currentModel)
  );
  
  return filtered;
}

/**
 * Main function to discover and categorize related products
 */
export async function discoverRelatedProducts(
  currentItem: ConsumableData,
  compatiblePrinters: PrinterCompatibility[]
): Promise<RelatedProductsResult> {
  const startTime = Date.now();
  
  // Step 1: Query multiple compatibility databases
  const rawResults = await queryCompatibilityDatabases(compatiblePrinters, currentItem.model || '');
  
  // Step 2: Calculate printer overlap and categorize relationships
  const enhancedItems: EnhancedRelatedItem[] = rawResults.map(item => {
    const printerOverlap = calculatePrinterOverlap(
      compatiblePrinters.map(p => p.model),
      item.printerOverlap // This would come from the database query
    );
    
    // Convert EnhancedRelatedItem to Partial<ConsumableData> for categorization
    const relatedItemData: Partial<ConsumableData> = {
      consumable_type: item.type as ConsumableData['consumable_type'],
      model: item.model,
      color: item.colorVariant || null,
      brand: null // Would be extracted from model or other sources
    };
    
    const relationship = categorizeRelationship(currentItem as ConsumableData, relatedItemData, printerOverlap);
    const priority = calculateDisplayPriority(relationship, printerOverlap, item.confidence, item.sourceCount);
    
    return {
      ...item,
      relationship,
      priority,
      printerOverlap
    };
  });
  
  // Step 3: Deduplicate and merge similar items
  const deduplicated = deduplicateRelatedItems(enhancedItems);
  
  // Step 4: Create categorized lists
  const categories = {
    companions: deduplicated.filter(item => item.relationship.startsWith('companion_')),
    alternatives: deduplicated.filter(item => item.relationship.startsWith('alternative_')),
    colorVariants: deduplicated.filter(item => item.relationship === 'color_variant'),
    replacements: deduplicated.filter(item => item.relationship.startsWith('replacement_'))
  };
  
  // Step 5: Create optimized display list
  const displayList = createDisplayList(deduplicated, 10);
  
  const processingTime = Date.now() - startTime;
  
  return {
    full: deduplicated,
    display: displayList,
    categories,
    metadata: {
      totalFound: rawResults.length,
      duplicatesRemoved: rawResults.length - deduplicated.length,
      sourcesQueried: compatiblePrinters.length * 2, // Approximate
      processingTimeMs: processingTime,
      qualityScore: calculateQualityScore(deduplicated, displayList)
    }
  };
}

// Helper functions

function normalizeModel(model: string | undefined): string {
  if (!model) return '';
  const normalized = model.toUpperCase().replace(/[-\s]/g, '').trim();
  // Return empty string for models that are only whitespace or empty after normalization
  return normalized.length === 0 ? '' : normalized;
}

function isOEMProduct(item: Partial<ConsumableData>): boolean {
  // Simple heuristic - in real implementation, this would check against OEM model databases
  const model = item.model || '';
  return /^(CF|CE|CC|CB|Q|W1|W2|CRG|PGI|CLI|TN|DR|LC|TK|DK|MK|T0|T1|T2|T3|MLT|CLT|SCX|106R|108R|113R)/i.test(model);
}

function isReplacementModel(currentModel: string | null, relatedModel: string | undefined): boolean {
  if (!currentModel || !relatedModel) return false;
  
  // Simple pattern matching for model series
  const currentBase = currentModel.replace(/\d+/g, '');
  const relatedBase = relatedModel.replace(/\d+/g, '');
  
  return currentBase === relatedBase && currentModel !== relatedModel;
}

function isNewerModel(currentModel: string | null, relatedModel: string | undefined): boolean {
  if (!currentModel || !relatedModel) return false;
  
  // Extract numeric parts and compare
  const currentNum = parseInt(currentModel.replace(/\D/g, '')) || 0;
  const relatedNum = parseInt(relatedModel.replace(/\D/g, '')) || 0;
  
  return relatedNum > currentNum;
}

function getMoreSpecificRelationship(existing: RelationshipType, newRel: RelationshipType): RelationshipType {
  // Prefer more specific relationship types
  const specificity: Record<string, number> = {
    'companion_drum': 10,
    'companion_toner': 10,
    'companion_maintenance': 9,
    'companion_waste': 9,
    'alternative_high_yield': 8,
    'alternative_oem': 8,
    'color_variant': 7,
    'alternative_compatible': 6,
    'alternative_standard': 6,
    'replacement_newer': 5,
    'cross_compatible': 4,
    'replacement_older': 3
  };
  
  const existingScore = specificity[existing] || 0;
  const newScore = specificity[newRel] || 0;
  
  return newScore > existingScore ? newRel : existing;
}

function calculatePrinterOverlap(currentPrinters: string[], relatedPrinterCount: number): number {
  // Simplified calculation - in real implementation, this would compare actual printer lists
  return Math.min(1, relatedPrinterCount / Math.max(1, currentPrinters.length));
}

function calculateQualityScore(full: EnhancedRelatedItem[], display: EnhancedRelatedItem[]): number {
  if (full.length === 0) return 0;
  
  const avgConfidence = full.reduce((sum, item) => sum + item.confidence, 0) / full.length;
  const avgSourceCount = full.reduce((sum, item) => sum + item.sourceCount, 0) / full.length;
  const displayRatio = display.length / Math.min(10, full.length);
  
  return (avgConfidence * 0.4 + (avgSourceCount / 3) * 0.3 + displayRatio * 0.3);
}

// Simulation functions for database queries (replace with real API calls)

async function simulateCartridgeRuQuery(printerModel: string): Promise<EnhancedRelatedItem[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock data - in real implementation, this would make HTTP requests
  return [
    {
      model: `TN-2420`,
      type: 'toner_cartridge',
      relationship: 'companion_toner',
      priority: 8,
      confidence: 0.9,
      sourceCount: 1,
      printerOverlap: 0.8,
      isOEM: true,
      availability: 'high' as const,
      sources: [{
        url: 'https://cartridge.ru/example',
        sourceType: 'cartridge_ru' as const,
        confidence: 0.9,
        extractedAt: new Date().toISOString()
      }]
    }
  ];
}

async function simulateRashodnikaQuery(printerModel: string): Promise<EnhancedRelatedItem[]> {
  await new Promise(resolve => setTimeout(resolve, 120));
  
  return [
    {
      model: `DR-2400`,
      type: 'drum_unit',
      relationship: 'companion_drum',
      priority: 9,
      confidence: 0.85,
      sourceCount: 1,
      printerOverlap: 0.8,
      isOEM: true,
      availability: 'medium' as const,
      sources: [{
        url: 'https://rashodnika.net/example',
        sourceType: 'rashodnika_net' as const,
        confidence: 0.85,
        extractedAt: new Date().toISOString()
      }]
    }
  ];
}

async function simulateOEMQuery(printerModel: string): Promise<EnhancedRelatedItem[]> {
  await new Promise(resolve => setTimeout(resolve, 150));
  
  return [
    {
      model: `TN-2410`,
      type: 'toner_cartridge',
      relationship: 'alternative_standard',
      priority: 6,
      confidence: 0.95,
      sourceCount: 1,
      printerOverlap: 0.9,
      yieldComparison: 'lower' as const,
      isOEM: true,
      availability: 'high' as const,
      sources: [{
        url: 'https://brother.com/example',
        sourceType: 'oem' as const,
        confidence: 0.95,
        extractedAt: new Date().toISOString()
      }]
    }
  ];
}