
import { orchestrationService } from '../services/orchestrationService';

// Mock API Key for Firecrawl to prevent "API Key missing" error but expect auth failure or mock response
process.env.VITE_FIRECRAWL_API_KEY = 'mock-key-for-testing';


const TEST_CASES = [
    {
        name: 'Scenario 1: Ideal HP W1331X',
        input: 'Картридж HP W1331X С ЧИПОМ БЕЗ СЧЕТЧИКА laser-408/432 15K',
        expect: {
            model: 'W1331X',
            brand: 'HP',
            type: 'toner_cartridge',
            chip: true,
            counter: false,
            yield: 15000
        }
    },
    {
        name: 'Scenario 2: Kyocera Drum DK-7105',
        input: 'Драм-картридж Kyocera DK-7105 для TASKalfa 3010i/3011i/3510i/3511i, Bk, 300К',
        expect: {
            model: 'DK-7105',
            brand: 'KYOCERA',
            type: 'drum_unit',
            color: 'Black',
            yield: 300000
        }
    },
    {
        name: 'Scenario 3: Dirty Input HpN W1331X 331X',
        input: 'ХрN W1331X 331X',
        expect: {
            model: 'W1331X',
            brand: 'HP', // Inferred from model W...
            type: 'toner_cartridge' // inferred? Parser logic has defaults
        }
    },
    {
        name: 'Scenario 4: Canon 045 Compatibility',
        input: 'Картридж Canon 045 для imageCLASS MF642Cdw/MF643Cdw LBP611Cn',
        expect: {
            model: '045',
            brand: 'CANON',
            printers_contain: 'MF642' // Check logic
        }
    }
];

async function runTests() {
    console.log("=== STARTING SOTA VERIFICATION TESTS ===\n");
    let passed = 0;

    for (const test of TEST_CASES) {
        console.log(`Running: ${test.name}`);
        try {
            const result = await orchestrationService.processItem(test.input, (s) => process.stdout.write(`.`));
            console.log("\nDone.");

            const d = result.data;
            let checks = [];

            if (test.expect.model && d.model !== test.expect.model) checks.push(`FAIL: Model ${d.model} != ${test.expect.model}`);
            if (test.expect.brand && d.brand !== test.expect.brand) checks.push(`FAIL: Brand ${d.brand} != ${test.expect.brand}`);
            if (test.expect.type && d.consumable_type !== test.expect.type) checks.push(`FAIL: Type ${d.consumable_type} != ${test.expect.type}`);

            if (test.expect.chip !== undefined && d.has_chip !== test.expect.chip) checks.push(`FAIL: Chip ${d.has_chip} != ${test.expect.chip}`);
            if (test.expect.counter !== undefined && d.has_page_counter !== test.expect.counter) checks.push(`FAIL: Counter ${d.has_page_counter} != ${test.expect.counter}`);

            if (test.expect.yield && d.yield?.value !== test.expect.yield) checks.push(`FAIL: Yield ${d.yield?.value} != ${test.expect.yield}`);

            if (checks.length === 0) {
                console.log("✅ PASS\n");
                passed++;
            } else {
                console.log("❌ FAIL");
                checks.forEach(c => console.log(`  - ${c}`));
                console.log("\n");
            }

            // Log full data for debug inspection
            // console.log(JSON.stringify(d, null, 2));

        } catch (e) {
            console.log(`❌ EXCEPTION: ${e}\n`);
        }
    }

    console.log(`\nSUMMARY: ${passed}/${TEST_CASES.length} Passed.`);
}

runTests();
