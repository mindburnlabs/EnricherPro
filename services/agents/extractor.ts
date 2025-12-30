
import { geminiService } from '../geminiService';
import { RetrieverResult } from './retriever';

export interface ExtractedWithSource<T> {
    data: T;
    source: RetrieverResult;
}

export class ExtractorAgent {

    public async extract<T>(content: string, schema: any, contextStr: string = ''): Promise<T | null> {
        const systemPrompt = `
You are an Expert Field Extractor.
Extract precise data from the provided text content according to the schema.
Context: ${contextStr}

Rules:
- If data is missing, use null.
- Do not hallucinate. Using "null" is better than guessing.
- Convert units if necessary to match schema (e.g. mm, g).
- If multiple values exist, prefer the most specific/official one.
`;

        try {
            const result = await geminiService.generateJson<T>(
                `Standardize and extract data from this content:\n\n${content.slice(0, 100000)}`,
                schema,
                systemPrompt
            );
            return result;
        } catch (e) {
            console.error("ExtractorAgent failed:", e);
            return null;
        }
    }

    public async batchExtract<T>(results: RetrieverResult[], schema: any, contextStr: string): Promise<ExtractedWithSource<T>[]> {
        const promises = results.map(async (r) => {
            const data = await this.extract<T>(r.content, schema, contextStr);
            if (data) {
                return { data, source: r };
            }
            return null;
        });

        const outcomes = await Promise.all(promises);
        return outcomes.filter(o => o !== null) as ExtractedWithSource<T>[];
    }
}

export const extractorAgent = new ExtractorAgent();
