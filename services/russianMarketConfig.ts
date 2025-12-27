/**
 * Enhanced Russian Market Filter Configuration Service
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { RuMarketFilterConfig, RussianSourceConfig } from '../types';

/**
 * Default Russian source whitelist with enhanced configuration
 * Requirements: 3.2 - Add configuration for Russian source whitelist
 */
export const DEFAULT_RUSSIAN_SOURCES: RussianSourceConfig[] = [
  // Primary Russian compatibility sources
  {
    name: 'cartridge.ru',
    baseUrl: 'https://cartridge.ru',
    priority: 1,
    isOfficial: false,
    searchPatterns: ['cartridge.ru', 'картридж.ру', 'www.cartridge.ru']
  },
  {
    name: 'rashodnika.net',
    baseUrl: 'https://rashodnika.net',
    priority: 1,
    isOfficial: false,
    searchPatterns: ['rashodnika.net', 'расходника.нет', 'www.rashodnika.net']
  },
  
  // Secondary Russian sources
  {
    name: 'nix.ru',
    baseUrl: 'https://nix.ru',
    priority: 2,
    isOfficial: false,
    searchPatterns: ['nix.ru', 'никс.ру', 'www.nix.ru', 'max.nix.ru', 'elets.nix.ru']
  },
  {
    name: 'onlinetrade.ru',
    baseUrl: 'https://onlinetrade.ru',
    priority: 1,
    isOfficial: false,
    searchPatterns: ['onlinetrade.ru', 'онлайнтрейд.ру', 'www.onlinetrade.ru']
  },
  {
    name: 'citilink.ru',
    baseUrl: 'https://www.citilink.ru',
    priority: 1,
    isOfficial: false,
    searchPatterns: ['citilink.ru', 'ситилинк.ру', 'www.citilink.ru']
  },
  {
    name: 'dns-shop.ru',
    baseUrl: 'https://www.dns-shop.ru',
    priority: 1,
    isOfficial: false,
    searchPatterns: ['dns-shop.ru', 'днс-шоп.ру', 'www.dns-shop.ru']
  },
  
  // Official distributor sources (higher priority)
  {
    name: 'hp.com/ru',
    baseUrl: 'https://www.hp.com/ru-ru',
    priority: 3,
    isOfficial: true,
    searchPatterns: ['hp.com/ru', 'support.hp.com/ru', 'www.hp.com/ru']
  },
  {
    name: 'canon.ru',
    baseUrl: 'https://www.canon.ru',
    priority: 3,
    isOfficial: true,
    searchPatterns: ['canon.ru', 'www.canon.ru', 'support.canon.ru']
  },
  {
    name: 'epson.ru',
    baseUrl: 'https://www.epson.ru',
    priority: 3,
    isOfficial: true,
    searchPatterns: ['epson.ru', 'www.epson.ru', 'support.epson.ru']
  },
  {
    name: 'brother.ru',
    baseUrl: 'https://www.brother.ru',
    priority: 3,
    isOfficial: true,
    searchPatterns: ['brother.ru', 'www.brother.ru', 'support.brother.ru']
  },
  {
    name: 'kyocera.ru',
    baseUrl: 'https://www.kyocera.ru',
    priority: 3,
    isOfficial: true,
    searchPatterns: ['kyocera.ru', 'www.kyocera.ru', 'support.kyocera.ru']
  }
];

/**
 * Enhanced Russian Market Filter Configuration Profiles
 * Requirements: 3.1, 3.2 - Implement strict 2+ source verification
 */
export const RU_MARKET_FILTER_PROFILES = {
  // Strict profile for production use
  STRICT: {
    minSourcesForVerification: 2,
    russianSources: DEFAULT_RUSSIAN_SOURCES,
    officialDistributorBonus: 0.3,
    confidenceThreshold: 0.8
  } as RuMarketFilterConfig,
  
  // Standard profile for balanced verification
  STANDARD: {
    minSourcesForVerification: 2,
    russianSources: DEFAULT_RUSSIAN_SOURCES,
    officialDistributorBonus: 0.2,
    confidenceThreshold: 0.7
  } as RuMarketFilterConfig,
  
  // Lenient profile for development/testing
  LENIENT: {
    minSourcesForVerification: 1,
    russianSources: DEFAULT_RUSSIAN_SOURCES,
    officialDistributorBonus: 0.1,
    confidenceThreshold: 0.6
  } as RuMarketFilterConfig,
  
  // Ultra-strict profile for critical applications
  ULTRA_STRICT: {
    minSourcesForVerification: 3,
    russianSources: DEFAULT_RUSSIAN_SOURCES.filter(s => s.priority >= 2), // Only high-priority sources
    officialDistributorBonus: 0.4,
    confidenceThreshold: 0.9
  } as RuMarketFilterConfig
};

/**
 * Get Russian market filter configuration based on environment or profile
 * Requirements: 3.2 - Add configuration for Russian source whitelist
 */
export function getRussianMarketFilterConfig(profile: keyof typeof RU_MARKET_FILTER_PROFILES = 'STANDARD'): RuMarketFilterConfig {
  const config = RU_MARKET_FILTER_PROFILES[profile];
  
  if (!config) {
    console.warn(`Unknown Russian market filter profile: ${profile}. Using STANDARD profile.`);
    return RU_MARKET_FILTER_PROFILES.STANDARD;
  }
  
  return config;
}

/**
 * Create custom Russian market filter configuration
 * Requirements: 3.2 - Add configuration for Russian source whitelist
 */
export function createCustomRussianMarketConfig(
  minSources: number = 2,
  additionalSources: RussianSourceConfig[] = [],
  officialBonus: number = 0.2,
  confidenceThreshold: number = 0.7
): RuMarketFilterConfig {
  return {
    minSourcesForVerification: minSources,
    russianSources: [...DEFAULT_RUSSIAN_SOURCES, ...additionalSources],
    officialDistributorBonus: officialBonus,
    confidenceThreshold: confidenceThreshold
  };
}

/**
 * Validate Russian market filter configuration
 * Requirements: 3.1, 3.2 - Ensure configuration meets requirements
 */
export function validateRussianMarketConfig(config: RuMarketFilterConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate minimum sources requirement
  if (config.minSourcesForVerification < 1) {
    errors.push('minSourcesForVerification must be at least 1');
  }
  
  if (config.minSourcesForVerification > 5) {
    errors.push('minSourcesForVerification should not exceed 5 (too restrictive)');
  }
  
  // Validate Russian sources
  if (!config.russianSources || config.russianSources.length === 0) {
    errors.push('russianSources array cannot be empty');
  }
  
  // Validate each Russian source
  config.russianSources.forEach((source, index) => {
    if (!source.name || source.name.trim() === '') {
      errors.push(`Russian source at index ${index} must have a name`);
    }
    
    if (!source.baseUrl || !source.baseUrl.startsWith('http')) {
      errors.push(`Russian source '${source.name}' must have a valid baseUrl`);
    }
    
    if (!source.searchPatterns || source.searchPatterns.length === 0) {
      errors.push(`Russian source '${source.name}' must have at least one search pattern`);
    }
    
    if (source.priority < 1 || source.priority > 5) {
      errors.push(`Russian source '${source.name}' priority must be between 1 and 5`);
    }
  });
  
  // Validate bonus and threshold values
  if (config.officialDistributorBonus < 0 || config.officialDistributorBonus > 1) {
    errors.push('officialDistributorBonus must be between 0 and 1');
  }
  
  if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
    errors.push('confidenceThreshold must be between 0 and 1');
  }
  
  // Check for sufficient high-priority sources
  const highPrioritySources = config.russianSources.filter(s => s.priority >= 2);
  if (highPrioritySources.length < 2) {
    errors.push('Configuration should have at least 2 high-priority sources (priority >= 2)');
  }
  
  // Check for official sources
  const officialSources = config.russianSources.filter(s => s.isOfficial);
  if (officialSources.length === 0 && config.officialDistributorBonus > 0) {
    errors.push('Configuration has officialDistributorBonus > 0 but no official sources defined');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get recommended configuration based on use case
 * Requirements: 3.1, 3.2, 3.3 - Enhance printer eligibility scoring algorithm
 */
export function getRecommendedConfig(useCase: 'production' | 'development' | 'testing' | 'critical'): RuMarketFilterConfig {
  switch (useCase) {
    case 'production':
      return getRussianMarketFilterConfig('STANDARD');
    case 'development':
      return getRussianMarketFilterConfig('LENIENT');
    case 'testing':
      return getRussianMarketFilterConfig('LENIENT');
    case 'critical':
      return getRussianMarketFilterConfig('ULTRA_STRICT');
    default:
      return getRussianMarketFilterConfig('STANDARD');
  }
}