import { BackendLLMService, RoutingStrategy } from "./llm.js";
import { db } from "../../db/index.js";
import { itemEmbeddings, items } from "../../db/schema.js";
import { eq, sql, gt, and, desc } from "drizzle-orm";

interface SearchResult {
    itemId: string;
    similarity: number;
    content: string;
}

export class EmbeddingService {
    /**
     * Generates a vector embedding for the given text using Google's text-embedding-004 via OpenRouter.
     * Dimensions: 768
     */
    static async generate(text: string, apiKeys: Record<string, string>): Promise<number[]> {
        if (!text || text.trim().length === 0) return [];

        try {
            // Use OpenRouter to call the embedding model
            // Note: OpenRouter's embedding API might differ from chat.
            // If BackendLLMService is chat-only, we might need a direct fetch here or extend LLM service.
            // For now, let's assume we use a direct fetch to standard OpenRouter embedding endpoint if available,
            // or compatible OpenAI-style embedding endpoint.

            const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKeys.openrouter}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://enricher.pro",
                    "X-Title": "EnricherPro (Embeddings)"
                },
                body: JSON.stringify({
                    model: "openai/text-embedding-3-small", // Standard, reliable embedding model
                    input: text
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Embedding API Error ${response.status}: ${err}`);
            }

            const data = await response.json();
            return data.data[0].embedding;

        } catch (e) {
            console.error("Embedding generation failed:", e);
            return []; // Return empty on failure to degrade gracefully
        }
    }

    /**
     * Stores an embedding for an item.
     * Upserts if an embedding already exists for this content? 
     * Simpler: Just insert. We assume one embedding per unique content chunk.
     * For Items, we likely embed the 'Enriched' summary.
     */
    static async store(itemId: string, content: string, apiKeys: Record<string, string>): Promise<void> {
        const vector = await this.generate(content, apiKeys);
        if (vector.length === 0) return;

        await db.insert(itemEmbeddings).values({
            itemId,
            content,
            vector
        });
    }

    /**
     * Semantic Search (The Oracle Recall)
     */
    static async search(query: string, apiKeys: Record<string, string>, limit: number = 3, threshold: number = 0.8): Promise<SearchResult[]> {
        const queryVector = await this.generate(query, apiKeys);
        if (queryVector.length === 0) return [];

        // Cosine Similarity in pgvector: 1 - (vector <=> query_vector)
        // Drizzle syntax for cosine distance is op('vector_cosine_ops')? 
        // Actually, logic is: 1 - cosine_distance. 
        // Standard pgvector: <=> is cosine distance. 
        // cosine_similarity = 1 - (embedding <=> query)

        // Raw SQL for vector comparison is often cleanest until Drizzle syntax is widespread.
        // Assuming 'vector' column.

        const vectorStr = `[${queryVector.join(',')}]`;

        const results = await db.execute(sql`
            SELECT 
                item_id, 
                content, 
                1 - (vector <=> ${vectorStr}::vector) as similarity
            FROM item_embeddings
            WHERE 1 - (vector <=> ${vectorStr}::vector) > ${threshold}
            ORDER BY similarity DESC
            LIMIT ${limit};
        `);

        return results.rows.map((r: any) => ({
            itemId: r.item_id,
            similarity: Number(r.similarity),
            content: r.content
        }));
    }
}
