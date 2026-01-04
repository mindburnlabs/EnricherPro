import dotenv from 'dotenv';
dotenv.config();

import { BackendLLMService } from './src/services/backend/llm.js';
import { ModelProfile } from './src/config/models.js';

// Mock Fetch to verify internals without wasting credits/calls,
// or use real calls for one-off verification.
// For this verification, we want to see if the REQUEST BODY is correct.
// We will spy on the global fetch if possible, or just run a real call to a free model.

async function verifySotaFeatures() {
  console.log('🚀 Starting SOTA Feature Verification...');

  const originalFetch = global.fetch;
  let lastRequestBody: any = null;

  // @ts-ignore
  global.fetch = async (url, options) => {
    if (url.toString().includes('openrouter')) {
      lastRequestBody = JSON.parse((options?.body as string) || '{}');
      console.log('📦 Intercepted Request Body:', JSON.stringify(lastRequestBody, null, 2));
    }
    // Mock response
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ mode: 'fast', reason: 'Test' }) } }],
      }),
      { status: 200, statusText: 'OK' },
    );
  };

  try {
    // Test 1: Fallbacks & Routing
    console.log('\n🧪 Test 1: Fallbacks & Provider Routing');
    await BackendLLMService.complete({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{ role: 'user', content: 'hi' }],
      models: ['google/gemini-2.0-pro-exp-02-05:free'],
      provider: { sort: 'latency', allow_fallbacks: true },
      apiKeys: { openrouter: 'sk-test' },
    });

    if (lastRequestBody.models?.length === 2) console.log('✅ Fallbacks array present');
    else console.error('❌ Fallbacks missing');

    if (lastRequestBody.provider?.sort === 'latency') console.log('✅ Provider sort present');
    else console.error('❌ Provider sort missing');

    // Test 2: Strict Structured Outputs & Plugins
    console.log('\n🧪 Test 2: Strict JSON & Plugins');
    await BackendLLMService.complete({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{ role: 'user', content: 'analyze' }],
      jsonSchema: { type: 'object', properties: { foo: { type: 'string' } } },
      plugins: [{ id: 'response-healing' }],
      apiKeys: { openrouter: 'sk-test' },
    });

    if (lastRequestBody.response_format?.type === 'json_schema')
      console.log('✅ JSON Schema Strict mode set');
    else console.error('❌ JSON Schema missing');

    if (lastRequestBody.plugins?.find((p: any) => p.id === 'response-healing'))
      console.log('✅ Response Healing plugin present');
    else console.error('❌ Plugin missing');

    // Test 3: Broadcast
    console.log('\n🧪 Test 3: Broadcast Metadata');
    await BackendLLMService.complete({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{ role: 'user', content: 'hi' }],
      sessionId: 'sess_123',
      userId: 'user_456',
      apiKeys: { openrouter: 'sk-test' },
    });

    if (lastRequestBody.session_id === 'sess_123') console.log('✅ Session ID present');
    else console.error('❌ Session ID missing');

    if (lastRequestBody.user === 'user_456') console.log('✅ User ID present');
    else console.error('❌ User ID missing');
  } catch (e) {
    console.error('Test Failed:', e);
  } finally {
    global.fetch = originalFetch;
  }
}

verifySotaFeatures();
