
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.VITE_OPENROUTER_API_KEY;

if (!API_KEY) {
    console.error('No VITE_OPENROUTER_API_KEY found in environment');
    process.exit(1);
}

async function listModels() {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        const models = data.data; // List of models

        console.log(`Found ${models.length} models.`);

        // Filter for Gemini models
        const geminiModels = models.filter((m: any) => m.id.includes('gemini'));
        console.log('--- Gemini Models ---');
        geminiModels.forEach((m: any) => console.log(m.id));

        // Specifically check for the failing one
        const failing = models.find((m: any) => m.id === 'google/gemini-2.0-flash-thinking-exp:free');
        if (failing) {
            console.log('\n[!] The model "google/gemini-2.0-flash-thinking-exp:free" IS present in the list.');
        } else {
            console.log('\n[X] The model "google/gemini-2.0-flash-thinking-exp:free" is NOT in the list.');
        }

    } catch (error) {
        console.error('Request failed', error);
    }
}

listModels();
