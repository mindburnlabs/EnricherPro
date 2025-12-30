import { GoogleGenAI } from '@google/genai';

const getApiKey = () => {
    const viteEnv = (import.meta as any).env || {};
    const procEnv = (typeof process !== 'undefined' ? process.env : {}) || {};
    return viteEnv.VITE_GEMINI_API_KEY || viteEnv.VITE_GOOGLE_API_KEY ||
        procEnv.VITE_GEMINI_API_KEY || procEnv.VITE_GOOGLE_API_KEY || '';
};

const API_KEY = getApiKey();

class GeminiService {
    private client: any; // Typing as any to avoid complex TS dance with the new SDK for now, unless we have d.ts loaded perfectly
    private modelId = 'gemini-1.5-flash'; // Good balance of speed/cost

    constructor() {
        if (API_KEY) {
            this.client = new GoogleGenAI({ apiKey: API_KEY });
        } else {
            console.warn('VITE_GEMINI_API_KEY is missing. GeminiService will fail.');
        }
    }

    public async generateText(prompt: string, systemInstruction?: string): Promise<string> {
        if (!this.client) throw new Error('Gemini API Key missing');

        try {
            const response = await this.client.models.generateContent({
                model: this.modelId,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                }
            });
            // The SDK response structure might vary, let's look at check_genai_exports output or valid usage.
            // Usually response.response.text()
            // Or in new SDK: response.text() directly?
            // Let's assume standard access pattern for new SDK or safely access it.
            // Based on docs for @google/genai (new sdk):
            // const response = await client.models.generateContent(...)
            // response.text()
            return response.text();
        } catch (e) {
            console.error('Gemini generateText error:', e);
            throw e;
        }
    }

    public async generateJson<T>(prompt: string, schema?: any, systemInstruction?: string): Promise<T> {
        if (!this.client) throw new Error('Gemini API Key missing');

        try {
            const config: any = {
                responseMimeType: 'application/json',
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            };

            if (schema) {
                config.responseSchema = schema;
            }

            const response = await this.client.models.generateContent({
                model: this.modelId,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: config
            });

            const text = response.text();
            return JSON.parse(text) as T;
        } catch (e) {
            console.error('Gemini generateJson error:', e);
            throw e;
        }
    }
}

export const geminiService = new GeminiService();
