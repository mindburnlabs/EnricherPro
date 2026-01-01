
export const ComplexityAnalysisSchema = {
    type: "object",
    properties: {
        mode: {
            type: "string",
            enum: ["fast", "balanced", "deep"],
            description: "The research mode determined by complexity."
        },
        reason: {
            type: "string",
            description: "Explanation for why this mode was chosen."
        }
    },
    required: ["mode", "reason"],
    additionalProperties: false
};

export const AgentPlanSchema = {
    type: "object",
    properties: {
        type: {
            type: "string",
            enum: ["single_sku", "list", "unknown"],
            description: "Type of the user request."
        },
        mpn: {
            type: ["string", "null"],
            description: "Manufacturer Part Number if identified."
        },
        canonical_name: {
            type: ["string", "null"],
            description: "Cleaned product name."
        },
        strategies: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: ["query", "domain_crawl", "firecrawl_agent", "deep_crawl"] },
                    queries: {
                        type: "array",
                        items: { type: "string" }
                    },
                    target_domain: { type: ["string", "null"] },
                    target_url: { type: ["string", "null"] },
                    schema: {
                        type: ["object", "null"],
                        additionalProperties: true
                    },
                    actions: {
                        type: ["array", "null"],
                        items: { type: "object", additionalProperties: true }
                    },
                    location: {
                        type: ["object", "null"],
                        properties: {
                            country: { type: "string" },
                            languages: { type: "array", items: { type: "string" } }
                        },
                        additionalProperties: false,
                        required: []
                    }
                },
                required: ["name", "type", "queries"],
                additionalProperties: false
            }
        },
        suggestedBudget: {
            type: ["object", "null"],
            properties: {
                mode: { type: "string", enum: ["fast", "balanced", "deep"] },
                concurrency: { type: "number" },
                depth: { type: "number" }
            },
            required: ["mode", "concurrency", "depth"],
            additionalProperties: false
        }
    },
    required: ["type", "mpn", "canonical_name", "strategies", "suggestedBudget"],
    additionalProperties: false
};

export const ProgressAnalysisSchema = {
    type: "object",
    properties: {
        thoughts: { type: "string", description: "Reasoning for the action." },
        action: {
            type: "string",
            enum: ["continue", "stop"],
            description: "Decision to continue research or stop."
        },
        new_tasks: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    type: { type: "string", enum: ["query", "enrichment", "domain_crawl", "firecrawl_agent"] },
                    value: { type: "string" },
                    meta: {
                        type: ["object", "null"],
                        additionalProperties: true
                    },
                    goal: { type: ["string", "null"] }
                },
                required: ["type", "value"],
                additionalProperties: false
            }
        }
    },
    required: ["thoughts", "action", "new_tasks"],
    additionalProperties: false
};

export const ExpansionSchema = {
    type: "object",
    properties: {
        queries: {
            type: "array",
            items: { type: "string" },
            description: "List of new, optimized search queries."
        }
    },
    required: ["queries"],
    additionalProperties: false
};

// --- SOTA: Strict Schemas for Extraction & Logistics ---

export const ExtractionSchema = {
    type: "object",
    properties: {
        claims: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    field: { type: "string" },
                    value: {
                        type: ["string", "number", "boolean", "object", "null"],
                        // Strict mode requires explicit types, but 'value' is polymorphic.
                        // OpenRouter/OpenAI strict mode DOES NOT support 'any' or mixed types easily without anyOf.
                        // We will coerce to string or use specific value fields to be safe.
                        // Actually, for strict mode, it's safer to use 'anyOf' with defined primitives.
                        anyOf: [
                            { type: "string" },
                            { type: "number" },
                            { type: "boolean" }
                        ]
                    },
                    confidence: { type: "number" },
                    rawSnippet: { type: "string" }
                },
                required: ["field", "value", "confidence", "rawSnippet"],
                additionalProperties: false
            }
        }
    },
    required: ["claims"],
    additionalProperties: false
};

export const LogisticsSchema = {
    type: "object",
    properties: {
        logistics: {
            type: ["object", "null"],
            properties: {
                weight: { type: ["string", "null"] },
                dimensions: { type: ["string", "null"] }
            },
            required: ["weight", "dimensions"],
            additionalProperties: false
        },
        compatibility: {
            type: "array",
            items: { type: "string" }
        },
        specs: {
            type: ["object", "null"],
            properties: {
                yield: { type: ["string", "null"] },
                color: { type: ["string", "null"] }
            },
            required: ["yield", "color"],
            additionalProperties: false
        }
    },
    required: ["logistics", "compatibility", "specs"],
    additionalProperties: false
};

// Simplified strict schema for Synthesis Merge (ConsumableData)
// We avoid deeply nested recursive structures or overly complex unions to ensure stability.
export const ConsumableDataSchema = {
    type: "object",
    properties: {
        brand: { type: ["string", "null"] },
        mpn_identity: {
            type: ["object", "null"],
            properties: {
                mpn: { type: ["string", "null"] },
                series: { type: ["string", "null"] }
            },
            required: ["mpn", "series"],
            additionalProperties: false
        },
        aliases: {
            type: "array",
            items: { type: "string" }
        },
        compatible_printers_ru: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    model: { type: "string" },
                    canonicalName: { type: "string" }
                },
                required: ["model", "canonicalName"],
                additionalProperties: false
            }
        },
        logistics: {
            type: ["object", "null"],
            properties: {
                weight_g: { type: ["number", "null"] },
                width_mm: { type: ["number", "null"] },
                height_mm: { type: ["number", "null"] },
                depth_mm: { type: ["number", "null"] }
            },
            required: ["weight_g", "width_mm", "height_mm", "depth_mm"],
            additionalProperties: false
        },
        _evidence: {
            type: "object",
            additionalProperties: {
                type: "object",
                properties: {
                    value: {
                        anyOf: [
                            { type: "string" },
                            { type: "number" },
                            { type: "boolean" },
                            { type: "object", additionalProperties: true }
                        ]
                    },
                    raw_snippet: { type: "string" },
                    source_url: { type: "string" },
                    confidence: { type: "number" }
                },
                required: ["value", "raw_snippet", "source_url", "confidence"],
                additionalProperties: false
            }
        }
    },
    required: ["brand", "mpn_identity", "aliases", "compatible_printers_ru", "logistics", "_evidence"],
    additionalProperties: false
};

// --- SOTA: Strict Meta-Schema for EnrichmentAgent (Schema-of-a-Schema) ---
// Simplified JSON Schema definition for Firecrawl extraction
export const FirecrawlSchemaSchema = {
    type: "object",
    properties: {
        type: { type: "string", enum: ["object"] },
        properties: {
            type: "object",
            additionalProperties: {
                type: "object",
                properties: {
                    type: { type: "string", enum: ["string", "number", "boolean", "array", "object"] },
                    description: { type: "string" },
                    items: { type: "object", additionalProperties: true }
                },
                required: ["type"],
                additionalProperties: false
            }
        },
        required: {
            type: "array",
            items: { type: "string" }
        }
    },
    required: ["type", "properties", "required"],
    additionalProperties: false
};

export const FallbackResultSchema = {
    type: "object",
    properties: {
        results: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    snippet: { type: "string" }
                },
                required: ["title", "url", "snippet"],
                additionalProperties: false
            }
        }
    },
    required: ["results"],
    additionalProperties: false
};
