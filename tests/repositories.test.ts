
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ItemsRepository } from '../src/repositories/itemsRepository';
import { EvidenceRepository } from '../src/repositories/evidenceRepository';
import { getDb } from '../src/db';
import { jobs } from '../src/db/schema';

// Mock data
const mockJobId = '00000000-0000-0000-0000-000000000000'; // We'll insert real one
const mockMpn = 'TEST-SKU-123';
const mockData = {
    mpn_identity: { mpn: mockMpn, canonical_model_name: 'TEST', variant_flags: {} },
    brand: 'TestBrand',
    model: 'TestModel',
    // ... minimal required fields for StrictConsumableData ...
} as any;

describe('Repositories Integration Test', () => {
    let createdJobId: string;

    beforeAll(async () => {
        const db = getDb();
        // Create a dummy job for FK constraint
        const [job] = await db.insert(jobs).values({
            inputRaw: 'test input',
            status: 'pending'
        }).returning();
        createdJobId = job.id;
    });

    it('should create and retrieve an item', async () => {
        const item = await ItemsRepository.createOrGet('default', createdJobId, mockMpn, mockData);
        expect(item).toBeDefined();
        expect(item.mpn).toBe(mockMpn);
        expect(item.id).toBeDefined();

        const retrieved = await ItemsRepository.getDomainItem(item.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.brand).toBe('TestBrand');
    });

    it('should add and retrieve evidence', async () => {
        // create another item
        const item = await ItemsRepository.createOrGet('default', createdJobId, 'EVIDENCE-SKU', mockData);

        await EvidenceRepository.addEvidence(
            item.id,
            'yield.value',
            'https://example.com',
            'Yield is 3000 pages',
            95
        );

        const evidenceList = await EvidenceRepository.getForField(item.id, 'yield.value');
        expect(evidenceList).toHaveLength(1);
        expect(evidenceList[0].confidence).toBe(95);
        expect(evidenceList[0].rawSnippet).toBe('Yield is 3000 pages');
    });
});
