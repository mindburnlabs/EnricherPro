
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3003';
const TEST_MPNS = [
    'CF217A', // HP 17A
    'TN-1050', // Brother
    'Q2612A', // HP 12A
    'TK-1110', // Kyocera - likely to trigger NIX.ru
    'CE285A', // HP 85A
];

async function runBatch() {
    console.log(`Starting Batch Simulation for ${TEST_MPNS.length} items...`);
    const results = [];

    for (const mpn of TEST_MPNS) {
        console.log(`> Triggering research for: ${mpn}`);
        try {
            const start = Date.now();
            const res = await fetch(`${BASE_URL}/api/start-research`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: mpn, mode: 'fast' }) // Use fast mode for test speed
            });

            const data = await res.json();
            const duration = Date.now() - start;

            if (res.ok && (data as any).success) {
                console.log(`  [OK] ${mpn} - Job ID: ${(data as any).jobId} (${duration}ms)`);
                results.push({ mpn, status: 'success', jobId: (data as any).jobId });
            } else {
                console.error(`  [FAIL] ${mpn} - Status: ${res.status} - ${(data as any).error || 'Unknown error'}`);
                results.push({ mpn, status: 'failed', error: (data as any).error });
            }
        } catch (e) {
            console.error(`  [ERROR] ${mpn} - Network/Script Error:`, e);
            results.push({ mpn, status: 'error', error: String(e) });
        }

        // Small delay to prevent immediate rate limit if aggressive (though we want to test load, so keep it small)
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n--- Batch Summary ---');
    const success = results.filter(r => r.status === 'success').length;
    console.log(`Success: ${success}/${TEST_MPNS.length}`);
    console.log(`Failures: ${TEST_MPNS.length - success}`);

    if (success === TEST_MPNS.length) {
        console.log("✅ Batch Simulation PASSED");
        process.exit(0);
    } else {
        console.log("❌ Batch Simulation FAILED");
        process.exit(1);
    }
}

runBatch();
