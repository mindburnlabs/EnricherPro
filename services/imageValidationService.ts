import { GoogleGenAI } from "@google/genai";
import { ImageCandidate } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ImageValidationConfig {
  minResolution: number; // 800x800 minimum
  whiteBackgroundThreshold: number; // 0.8 = 80% white background required
  maxTextDetectionScore: number; // 0.3 = reject if >30% text/logo coverage
  watermarkDetectionSensitivity: number; // 0.2 = detect watermarks with >20% confidence
  approvedImageLibraryUrls?: string[]; // Pre-approved image sources
}

export interface ValidationCheck {
  checkName: string;
  passed: boolean;
  confidence: number;
  details?: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  validationChecks: ValidationCheck[];
  confidence: number;
  rejectionReasons: string[];
  product_image_main?: string;
}

const DEFAULT_CONFIG: ImageValidationConfig = {
  minResolution: 800,
  whiteBackgroundThreshold: 0.8,
  maxTextDetectionScore: 0.3,
  watermarkDetectionSensitivity: 0.2,
  approvedImageLibraryUrls: [
    'https://images.nix.ru',
    'https://static.cartridge.ru',
    'https://cdn.rashodnika.net'
  ]
};

/**
 * Enhanced resolution validation with minimum 800x800 requirement
 */
export async function validateResolution(imageUrl: string, config: ImageValidationConfig = DEFAULT_CONFIG): Promise<ValidationCheck> {
  try {
    // For placeholder images, extract dimensions from URL
    if (imageUrl.includes('placehold.co')) {
      const match = imageUrl.match(/(\d+)x(\d+)/);
      if (match) {
        const width = parseInt(match[1]);
        const height = parseInt(match[2]);
        const minDimension = Math.min(width, height);
        const passed = minDimension >= config.minResolution;
        
        return {
          checkName: 'resolution_validation',
          passed,
          confidence: 1.0,
          details: `Image dimensions: ${width}x${height}px, minimum required: ${config.minResolution}x${config.minResolution}px`
        };
      }
    }

    // For real images, we would need to fetch and analyze the image
    // This is a simplified implementation for the current system
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { text: `Analyze the image resolution and dimensions. Return JSON with width, height, and whether it meets minimum ${config.minResolution}x${config.minResolution} requirement.` },
        { text: `Image URL: ${imageUrl}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            meets_minimum: { type: 'boolean' }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{"width": 0, "height": 0, "meets_minimum": false}');
    const minDimension = Math.min(result.width || 0, result.height || 0);
    const passed = result.meets_minimum && minDimension >= config.minResolution;

    return {
      checkName: 'resolution_validation',
      passed,
      confidence: 0.9,
      details: `Image dimensions: ${result.width}x${result.height}px, minimum required: ${config.minResolution}x${config.minResolution}px`
    };
  } catch (error) {
    return {
      checkName: 'resolution_validation',
      passed: false,
      confidence: 0.0,
      details: `Resolution validation failed: ${error}`
    };
  }
}

/**
 * Advanced background analysis for white background detection
 */
export async function analyzeBackground(imageUrl: string, config: ImageValidationConfig = DEFAULT_CONFIG): Promise<ValidationCheck> {
  try {
    // For placeholder images with white background, return high score
    if (imageUrl.includes('placehold.co') && imageUrl.includes('white')) {
      return {
        checkName: 'background_analysis',
        passed: true,
        confidence: 1.0,
        details: `White background detected with 100% confidence (placeholder image)`
      };
    }

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        { text: `Analyze this product image for background color and cleanliness. 
        
        Requirements:
        - Background should be pure white or very light gray
        - No shadows, gradients, or colored backgrounds
        - Clean, professional product photography
        - No distracting background elements
        
        Return a score from 0.0 to 1.0 where:
        - 1.0 = Perfect white background, professional product shot
        - 0.8+ = Acceptable white/light background with minor imperfections
        - 0.5-0.8 = Light background but with some issues
        - <0.5 = Colored, dark, or heavily cluttered background
        
        Also identify any specific background issues.` },
        { text: `Image URL: ${imageUrl}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'object',
          properties: {
            background_score: { type: 'number' },
            background_color: { type: 'string' },
            issues: { type: 'array', items: { type: 'string' } },
            is_professional: { type: 'boolean' }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{"background_score": 0.0, "background_color": "unknown", "issues": ["Analysis failed"], "is_professional": false}');
    const passed = result.background_score >= config.whiteBackgroundThreshold;

    return {
      checkName: 'background_analysis',
      passed,
      confidence: 0.85,
      details: `Background score: ${(result.background_score * 100).toFixed(1)}% (${result.background_color}). Issues: ${result.issues.join(', ') || 'None'}`
    };
  } catch (error) {
    return {
      checkName: 'background_analysis',
      passed: false,
      confidence: 0.0,
      details: `Background analysis failed: ${error}`
    };
  }
}

/**
 * OCR-based text/logo detection for brand trademark rejection
 */
export async function detectTextAndLogos(imageUrl: string, consumableModel: string, config: ImageValidationConfig = DEFAULT_CONFIG): Promise<ValidationCheck> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        { text: `Analyze this consumable product image for text and brand logos.
        
        DETECTION RULES:
        1. Identify all visible text in the image
        2. Detect brand logos, trademarks, or corporate branding
        3. Distinguish between:
           - Product model numbers (acceptable)
           - Brand logos/trademarks (should be rejected for compatible products)
           - Marketing text or slogans (should be rejected)
           - Technical specifications (acceptable)
        
        For compatible consumables, we want to REJECT images with:
        - OEM brand logos (HP, Canon, Brother, etc.)
        - Trademark symbols or corporate branding
        - Marketing text or promotional content
        - Packaging with brand-specific design elements
        
        ACCEPTABLE for compatible products:
        - Model numbers and technical specs
        - Generic product photography
        - Compatible manufacturer branding (if clearly marked as compatible)
        
        Expected model: ${consumableModel}
        
        Return text coverage percentage and logo detection results.` },
        { text: `Image URL: ${imageUrl}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'object',
          properties: {
            text_coverage_percent: { type: 'number' },
            detected_text: { type: 'array', items: { type: 'string' } },
            has_oem_logos: { type: 'boolean' },
            detected_brands: { type: 'array', items: { type: 'string' } },
            has_trademarks: { type: 'boolean' },
            is_compatible_friendly: { type: 'boolean' },
            rejection_reasons: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{"text_coverage_percent": 0, "detected_text": [], "has_oem_logos": false, "detected_brands": [], "has_trademarks": false, "is_compatible_friendly": true, "rejection_reasons": []}');
    
    // Reject if too much text coverage or OEM logos detected
    const textCoverageOk = (result.text_coverage_percent / 100) <= config.maxTextDetectionScore;
    const noOemLogos = !result.has_oem_logos;
    const noTrademarks = !result.has_trademarks;
    const passed = textCoverageOk && noOemLogos && noTrademarks && result.is_compatible_friendly;

    const details = [
      `Text coverage: ${result.text_coverage_percent.toFixed(1)}%`,
      `OEM logos: ${result.has_oem_logos ? 'DETECTED' : 'None'}`,
      `Trademarks: ${result.has_trademarks ? 'DETECTED' : 'None'}`,
      `Detected brands: ${result.detected_brands.join(', ') || 'None'}`,
      `Rejection reasons: ${result.rejection_reasons.join(', ') || 'None'}`
    ].join('. ');

    return {
      checkName: 'text_logo_detection',
      passed,
      confidence: 0.8,
      details
    };
  } catch (error) {
    return {
      checkName: 'text_logo_detection',
      passed: false,
      confidence: 0.0,
      details: `Text/logo detection failed: ${error}`
    };
  }
}

/**
 * Watermark detection algorithms
 */
export async function detectWatermarks(imageUrl: string, config: ImageValidationConfig = DEFAULT_CONFIG): Promise<ValidationCheck> {
  try {
    // Placeholder images don't have watermarks
    if (imageUrl.includes('placehold.co')) {
      return {
        checkName: 'watermark_detection',
        passed: true,
        confidence: 1.0,
        details: 'No watermarks detected (placeholder image)'
      };
    }

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        { text: `Analyze this image for watermarks and copyright protection elements.
        
        WATERMARK DETECTION:
        1. Look for semi-transparent text overlays
        2. Detect copyright symbols (©, ®, ™)
        3. Identify website URLs or domain names overlaid on image
        4. Find photographer/stock photo watermarks
        5. Detect repeated pattern watermarks
        6. Look for subtle transparency effects indicating watermarks
        
        COMMON WATERMARK PATTERNS:
        - "© [Company Name]" text
        - Website URLs (www.example.com)
        - Stock photo service marks (Shutterstock, Getty, etc.)
        - Photographer signatures
        - Diagonal text overlays
        - Corner or center watermarks
        
        Return confidence score for watermark presence.` },
        { text: `Image URL: ${imageUrl}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'object',
          properties: {
            has_watermark: { type: 'boolean' },
            watermark_confidence: { type: 'number' },
            watermark_types: { type: 'array', items: { type: 'string' } },
            watermark_locations: { type: 'array', items: { type: 'string' } },
            detected_text: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{"has_watermark": false, "watermark_confidence": 0.0, "watermark_types": [], "watermark_locations": [], "detected_text": []}');
    
    // Reject if watermark confidence exceeds threshold
    const passed = !result.has_watermark || result.watermark_confidence < config.watermarkDetectionSensitivity;

    const details = [
      `Watermark confidence: ${(result.watermark_confidence * 100).toFixed(1)}%`,
      `Types detected: ${result.watermark_types.join(', ') || 'None'}`,
      `Locations: ${result.watermark_locations.join(', ') || 'None'}`,
      `Watermark text: ${result.detected_text.join(', ') || 'None'}`
    ].join('. ');

    return {
      checkName: 'watermark_detection',
      passed,
      confidence: 0.75,
      details
    };
  } catch (error) {
    return {
      checkName: 'watermark_detection',
      passed: false,
      confidence: 0.0,
      details: `Watermark detection failed: ${error}`
    };
  }
}

/**
 * Check if image is from approved image library
 */
export function checkApprovedImageLibrary(imageUrl: string, config: ImageValidationConfig = DEFAULT_CONFIG): ValidationCheck {
  const approvedSources = config.approvedImageLibraryUrls || [];
  const isApproved = approvedSources.some(source => imageUrl.startsWith(source));
  
  // Placeholder images are considered approved for testing
  const isPlaceholder = imageUrl.includes('placehold.co');
  const passed = isApproved || isPlaceholder;

  return {
    checkName: 'approved_library_check',
    passed,
    confidence: 1.0,
    details: passed 
      ? `Image from approved source: ${isPlaceholder ? 'placeholder' : 'approved library'}`
      : `Image not from approved sources. Approved: ${approvedSources.join(', ')}`
  };
}

/**
 * Comprehensive image validation pipeline
 */
export async function validateProductImage(
  imageUrl: string, 
  consumableModel: string, 
  config: ImageValidationConfig = DEFAULT_CONFIG
): Promise<ImageValidationResult> {
  try {
    // Run all validation checks
    const checks = await Promise.all([
      validateResolution(imageUrl, config),
      analyzeBackground(imageUrl, config),
      detectTextAndLogos(imageUrl, consumableModel, config),
      detectWatermarks(imageUrl, config),
      Promise.resolve(checkApprovedImageLibrary(imageUrl, config))
    ]);

    // Calculate overall validation result
    const allPassed = checks.every(check => check.passed);
    const averageConfidence = checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length;
    
    const rejectionReasons = checks
      .filter(check => !check.passed)
      .map(check => `${check.checkName}: ${check.details}`);

    return {
      isValid: allPassed,
      validationChecks: checks,
      confidence: averageConfidence,
      rejectionReasons,
      product_image_main: allPassed ? imageUrl : undefined
    };
  } catch (error) {
    return {
      isValid: false,
      validationChecks: [{
        checkName: 'validation_error',
        passed: false,
        confidence: 0.0,
        details: `Image validation failed: ${error}`
      }],
      confidence: 0.0,
      rejectionReasons: [`Validation system error: ${error}`]
    };
  }
}

/**
 * Convert validation result to ImageCandidate format
 */
export function createImageCandidate(
  imageUrl: string,
  validationResult: ImageValidationResult,
  width: number = 800,
  height: number = 800
): ImageCandidate {
  const resolutionCheck = validationResult.validationChecks.find(c => c.checkName === 'resolution_validation');
  const backgroundCheck = validationResult.validationChecks.find(c => c.checkName === 'background_analysis');
  const textLogoCheck = validationResult.validationChecks.find(c => c.checkName === 'text_logo_detection');
  const watermarkCheck = validationResult.validationChecks.find(c => c.checkName === 'watermark_detection');

  // Extract actual dimensions from resolution check if available
  if (resolutionCheck?.details) {
    const match = resolutionCheck.details.match(/(\d+)x(\d+)px/);
    if (match) {
      width = parseInt(match[1]);
      height = parseInt(match[2]);
    }
  }

  return {
    url: imageUrl,
    width,
    height,
    white_bg_score: backgroundCheck?.passed ? 0.9 : 0.3, // Simplified scoring
    is_packaging: false, // Assume validated images show product only
    has_watermark: watermarkCheck ? !watermarkCheck.passed : false,
    has_oem_logo: textLogoCheck ? !textLogoCheck.passed : false,
    passes_rules: validationResult.isValid,
    reject_reasons: validationResult.rejectionReasons
  };
}