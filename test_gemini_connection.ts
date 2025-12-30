
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("No API Key found");
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey: API_KEY });

async function test() {
    console.log("Testing Gemini Connection...");
    try {
        // Try generating content with standard model
        const response = await client.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
        });
        console.log("Generate Content Success:", response);
    } catch (e: any) {
        console.error("Generate Content Failed:", e.message, e);
    }
}

test();
