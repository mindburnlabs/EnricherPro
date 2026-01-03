
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
        // 1. Identity
        mpn_identity: {
            type: ["object", "null"],
            properties: {
                mpn: { type: ["string", "null"] },
                series: { type: ["string", "null"] }, // e.g. "HP 12A"
                canonical_model_name: { type: ["string", "null"] },
                cross_reference_mpns: { type: "array", items: { type: "string" } }, // Equivalences
                authenticity: { type: ["string", "null"], enum: ["oem", "compatible", "remanufactured", "refill", "fake", "unknown", null] }
            },
            required: ["mpn", "series"],
            additionalProperties: false
        },
        brand: { type: ["string", "null"] },
        aliases: { type: "array", items: { type: "string" } },
        gtin: { type: "array", items: { type: "string" } },

        // 2. Taxonomy
        type_classification: {
            type: ["object", "null"],
            properties: {
                family: { type: "string", enum: ["toner", "drum", "developer", "waste_toner", "maintenance_kit", "fuser", "ink", "ribbon", "other", "unknown"] },
                subtype: { type: "string", enum: ["cartridge", "bottle", "unit", "integrated_drum", "separate_drum", "unknown"] }
            },
            required: ["family", "subtype"],
            additionalProperties: false
        },

        // 3. Compatibility (RU-Market Focus)
        compatible_printers_ru: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    model: { type: "string" },
                    canonicalName: { type: "string" },
                    is_ru_confirmed: { type: "boolean" }, // Source explicitly mentions RU market or Cyrillic
                    constraints: { type: "array", items: { type: "string" } } // "firmware_sensitive", "chip_required", "counter_reset"
                },
                required: ["model", "canonicalName", "is_ru_confirmed"],
                additionalProperties: false
            }
        },

        // 4. Tech Specs
        tech_specs: {
            type: ["object", "null"],
            properties: {
                yield: {
                    type: ["object", "null"],
                    properties: {
                        value: { type: ["number", "null"] },
                        unit: { type: "string", enum: ["pages", "copies", "ml", "g", "unknown"] },
                        standard: { type: ["string", "null"], enum: ["ISO_19752", "ISO_19798", "5_percent_coverage", "manufacturer_stated", "unknown", null] }
                    },
                    required: ["value", "unit", "standard"],
                    additionalProperties: false
                },
                color: { type: ["string", "null"] },
                is_integrated_drum: { type: "boolean" },
                chip_type: { type: ["string", "null"], enum: ["oem", "compatible", "universal", "none", "unknown", null] }
            },
            required: ["yield", "color", "chip_type"],
            additionalProperties: false
        },

        // 5. Logistics & Compliance
        logistics: {
            type: ["object", "null"],
            properties: {
                package_weight_g: { type: ["number", "null"] },
                product_weight_g: { type: ["number", "null"] },
                width_mm: { type: ["number", "null"] },
                height_mm: { type: ["number", "null"] },
                depth_mm: { type: ["number", "null"] },
                origin_country: { type: ["string", "null"] },
                box_contents: { type: "array", items: { type: "string" } },
                transport_symbols: { type: "array", items: { type: "string" } } // e.g. "fragile", "keep_dry"
            },
            required: ["package_weight_g", "width_mm"],
            additionalProperties: false
        },

        // 5.1 RU Compliance (Strict)
        compliance_ru: {
            type: ["object", "null"],
            properties: {
                tn_ved_code: { type: ["string", "null"] }, // e.g. "8443 99 900 0"
                okpd2_code: { type: ["string", "null"] },  // e.g. "28.23.25.000"
                mandatory_marking: { type: "boolean", description: "Is 'Honest Sign' (Честный ЗНАК) required?" },
                certification_type: { type: ["string", "null"], enum: ["mandatory", "voluntary", "refusal_letter", "none", "unknown", null] },
                has_sds: { type: "boolean", description: "Safety Data Sheet (Паспорт безопасности) available?" },
                refusal_letter_info: { type: ["string", "null"] } // Issuer/Date
            },
            required: ["tn_ved_code", "mandatory_marking"],
            additionalProperties: false
        },

        // 6. High-Fidelity
        marketing: {
            type: ["object", "null"],
            properties: {
                seo_title: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
                feature_bullets: { type: "array", items: { type: "string" } },
                keywords: { type: "array", items: { type: "string" } }
            }
        },
        faq: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    question: { type: "string" },
                    answer: { type: "string" }
                },
                required: ["question", "answer"],
                additionalProperties: false
            }
        },
        images: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    url: { type: "string" }
                },
                required: ["url"],
                additionalProperties: false
            }
        },

        // Evidence
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
    required: ["mpn_identity", "type_classification", "compatible_printers_ru", "tech_specs", "logistics", "_evidence"],
    additionalProperties: false
};

// Extend the schema for High-Fidelity Data (FAQ, Related, Short Model)
(ConsumableDataSchema.properties as any).short_model = { type: ["string", "null"] };
(ConsumableDataSchema.properties as any).faq = {
    type: "array",
    items: {
        type: "object",
        properties: {
            question: { type: "string" },
            answer: { type: "string" }
        },
        required: ["question", "answer"],
        additionalProperties: false
    }
};
(ConsumableDataSchema.properties as any).related_ids = {
    type: "array",
    items: {
        type: "object",
        properties: {
            id: { type: "string", description: "MPN or Short Name" },
            type: { type: "string", enum: ["drum", "toner", "maintenance", "chip", "other"] },
            reason: { type: "string" }
        },
        required: ["id", "type"],
        additionalProperties: false
    }
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
