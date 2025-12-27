
import { GoogleGenAI, Type } from "@google/genai";
import { EnrichedItem, ConsumableData, ProcessingStep, ImageCandidate } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { firecrawlScrape, firecrawlAgent, getAgentStatus } from './firecrawlService';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const LOGISTICS_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    weight_g: { type: 'number', description: 'Weight in grams.' },
    width_mm: { type: 'number', description: 'Width in millimeters.' },
    height_mm: { type: 'number', description: 'Height in millimeters.' },
    depth_mm: { type: 'number', description: 'Depth in millimeters.' },
    mpn: { type: 'string', description: 'Manufacturer Part Number.' },
    yield_pages: { type: 'number', description: 'Page yield.' }
  },
  required: ['mpn']
};

/**
 * Step 1: Research Phase
 * Uses Search Grounding to find primary source URLs.
 */
async function researchProductContext(query: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Find technical specification pages for printer consumable: "${query}". 
    Focus on finding:
    1. nix.ru catalog page
    2. Official brand product page (HP, Canon, Brother, etc.)
    3. Major Russian retailers (cartridge.ru, rashodnika.net, onlinetrade.ru)
    
    Return URLs.`,
    config: { tools: [{ googleSearch: {} }] }
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const urls = groundingChunks
    .filter((c: any) => c.web && c.web.uri)
    .map((c: any) => c.web.uri);

  return { researchSummary: response.text, urls: Array.from(new Set(urls)) as string[] };
}

/**
 * Deep Autonomous Agent Research fallback.
 */
async function deepAgentResearch(query: string): Promise<any> {
  const prompt = `Perform a deep research for technical specifications of printer consumable: "${query}". 
  I need to confirm:
  - Exact Manufacturer Part Number (MPN)
  - Gross weight in grams (extremely important)
  - Box dimensions (W, H, D) in mm
  - Compatibility: Full list of printer models this item works with in the Russian market.
  - Page yield at 5% coverage.
  Search sites like nix.ru, official support portals, or specialized catalog sites.`;

  const schema = {
    type: 'object',
    properties: {
      brand: { type: 'string' },
      mpn: { type: 'string' },
      weight_g: { type: 'number' },
      dimensions: {
        type: 'object',
        properties: {
          w: { type: 'number' },
          h: { type: 'number' },
          d: { type: 'number' }
        }
      },
      compatible_printers: { type: 'array', items: { type: 'string' } },
      yield: { type: 'number' }
    },
    required: ['mpn', 'compatible_printers']
  };

  const initialResponse = await firecrawlAgent(prompt, schema);
  let status = initialResponse;
  
  // Polling with safety timeout (max ~120 seconds)
  let attempts = 0;
  while (status.status === 'processing' && attempts < 24) {
    await new Promise(r => setTimeout(r, 5000));
    if (!status.id) break; 
    status = await getAgentStatus(status.id);
    if (status.status === 'failed') throw new Error(`Agent research failed: ${status.error || 'Unknown error'}`);
    attempts++;
  }

  if (status.status === 'processing') throw new Error("Agent research timed out.");
  return status.data;
}

/**
 * Step 2: Synthesis Phase
 */
async function synthesizeConsumableData(context: string, query: string): Promise<{ data: ConsumableData, thinking: string }> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are a World-Class PIM Architect specializing in Printer Consumables.
    Analyze the provided research data to create a high-precision record for "${query}".
    
    STRICT RULES:
    1. MPN: Extract the most canonical manufacturer part number.
    2. COMPATIBILITY: Focus on specific printer model families (e.g., HP LaserJet Pro M102).
    3. LOGISTICS: If conflicting, prioritize official specs or NIX.ru data.
    4. RU MARKET: Ensure compatible printer models match those sold in Russia/CIS.
    
    RESEARCH DATA:
    ${context}
    
    Return JSON strictly matching the defined schema.`,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          brand: { type: Type.STRING },
          consumable_type: { type: Type.STRING, enum: ['toner_cartridge', 'drum_unit', 'consumable_set', 'ink_cartridge', 'bottle', 'other'] },
          model: { type: Type.STRING },
          short_model: { type: Type.STRING },
          model_alias_short: { type: Type.STRING, nullable: true },
          yield: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.NUMBER },
              unit: { type: Type.STRING, enum: ['pages', 'copies', 'ml'] },
              coverage_percent: { type: Type.NUMBER }
            }
          },
          color: { type: Type.STRING },
          has_chip: { type: Type.BOOLEAN },
          has_page_counter: { type: Type.BOOLEAN },
          printers_ru: { type: Type.ARRAY, items: { type: Type.STRING } },
          related_consumables: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                model: { type: Type.STRING },
                type: { type: Type.STRING },
                relationship: { type: Type.STRING }
              }
            }
          },
          packaging_from_nix: {
            type: Type.OBJECT,
            properties: {
              width_mm: { type: Type.NUMBER },
              height_mm: { type: Type.NUMBER },
              depth_mm: { type: Type.NUMBER },
              weight_g: { type: Type.NUMBER },
              raw_source_string: { type: Type.STRING }
            }
          },
          faq: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              }
            }
          }
        },
        required: ['brand', 'model', 'printers_ru', 'packaging_from_nix']
      }
    }
  });

  const raw = JSON.parse(response.text || '{}');
  const thinking = (response as any).candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.text || "";

  const images: ImageCandidate[] = [{
    url: `https://placehold.co/800x800/white/4338ca?text=${encodeURIComponent(raw.model || 'Item')}`,
    width: 800,
    height: 800,
    white_bg_score: 1.0,
    is_packaging: false,
    has_watermark: false,
    has_oem_logo: false,
    passes_rules: true,
    reject_reasons: []
  }];

  return { data: { ...raw, images }, thinking };
}

export const processItem = async (
  inputRaw: string, 
  onProgress: (step: ProcessingStep) => void
): Promise<EnrichedItem> => {
  try {
    onProgress('searching');
    const { researchSummary, urls } = await researchProductContext(inputRaw);
    
    let combinedContent = `[RESEARCH OVERVIEW]\n${researchSummary}\n\n`;
    const evidenceSources: any[] = [];
    
    const nixUrl = urls.find(u => u.includes('nix.ru'));
    if (nixUrl) {
      onProgress('scraping_nix');
      const nixRes = await firecrawlScrape(
        nixUrl, 
        "Extract technical logistics data for this printer part.",
        LOGISTICS_EXTRACT_SCHEMA
      );
      
      if (nixRes.success) {
        combinedContent += `\n[SOURCE: NIX.RU]\nDATA: ${JSON.stringify(nixRes.data.json || nixRes.data.markdown)}`;
        evidenceSources.push({
          url: nixUrl,
          source_type: 'nix_ru',
          claims: ['logistics', 'mpn'],
          evidence_snippets_by_claim: { logistics: JSON.stringify(nixRes.data.json || {}) },
          extracted_at: new Date().toISOString()
        });
      }
    } else {
        // Fallback to Autonomous Agent research for deep verification
        try {
            onProgress('searching'); 
            const agentData = await deepAgentResearch(inputRaw);
            combinedContent += `\n[AUTONOMOUS AGENT RESEARCH]\n${JSON.stringify(agentData)}`;
            evidenceSources.push({
                url: 'https://firecrawl.dev/v2/agent',
                source_type: 'official',
                claims: ['autonomous_research', 'compatibility'],
                evidence_snippets_by_claim: { research: JSON.stringify(agentData) },
                extracted_at: new Date().toISOString()
            });
        } catch (e) {
            console.warn("Agent research failed or timed out", e);
        }
    }

    onProgress('analyzing');
    const { data, thinking } = await synthesizeConsumableData(combinedContent, inputRaw);

    onProgress('finalizing');
    const errors: string[] = [];
    if (!data.packaging_from_nix?.weight_g) errors.push("Logistics data missing from primary sources.");
    if (data.printers_ru.length === 0) errors.push("No compatible printer models found.");

    return {
      id: uuidv4(),
      input_raw: inputRaw,
      data,
      evidence: { 
        sources: evidenceSources, 
        grounding_metadata: urls.map(u => ({ title: 'Research Source', uri: u })) 
      },
      status: errors.length > 0 ? 'needs_review' : 'ok',
      validation_errors: errors,
      thinking_process: thinking,
      created_at: Date.now(),
      updated_at: Date.now()
    };
  } catch (err) {
    console.error("Enrichment Process Failed:", err);
    throw err;
  }
};

export const analyzeConsumableImage = async (base64Image: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
      { text: "Examine this image. It is a printer consumable packaging or label. Identify the BRAND and the MANUFACTURER PART NUMBER (MPN). Return only 'BRAND MPN' text." }
    ]
  });
  return response.text?.trim() || "Unknown Item";
};
