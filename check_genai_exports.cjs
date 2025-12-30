
const genai = require('@google/genai');
console.log('Exports:', Object.keys(genai));
try {
    const { GoogleGenerativeAI } = genai;
    if (GoogleGenerativeAI) console.log('Has GoogleGenerativeAI');
} catch (e) { }

try {
    const { Client } = genai;
    if (Client) console.log('Has Client');
} catch (e) { }
