import { describe, it, expect, beforeAll } from 'vitest';
import { ItemsRepository } from '../src/repositories/itemsRepository';
import { ClaimsRepository } from '../src/repositories/ClaimsRepository';
import { getDb } from '../src/db';
import { jobs, sourceDocuments } from '../src/db/schema';

// Mock data
const mockMpn = 'TEST-SKU-123';
const mockData = {
  mpn_identity: { mpn: mockMpn, canonical_model_name: 'TEST', variant_flags: {} },
  brand: 'TestBrand',
  model: 'TestModel',
} as any;

describe('Repositories Integration Test', () => {
  let createdJobId: string;

  beforeAll(async () => {
    const db = getDb();
    // Create a dummy job for FK constraint
    const [job] = await db
      .insert(jobs)
      .values({
        inputRaw: 'test input',
        status: 'pending',
      })
      .returning();
    createdJobId = job.id;
  });

  it('should create and retrieve an item', async () => {
    const item = await ItemsRepository.createOrGet('default', createdJobId, mockMpn, mockData);
    expect(item).toBeDefined();
    if (!item) throw new Error('Item not created');

    expect(item.mpn).toBe(mockMpn);
    expect(item.id).toBeDefined();

    const retrieved = await ItemsRepository.getDomainItem(item.id);
    expect(retrieved).toBeDefined();
    // @ts-ignore
    expect(retrieved?.brand).toBe('TestBrand');
  });

  it('should add and retrieve claims (evidence)', async () => {
    const db = getDb();
    // create another item
    const item = await ItemsRepository.createOrGet(
      'default',
      createdJobId,
      'EVIDENCE-SKU',
      mockData,
    );
    if (!item) throw new Error('Item not created');

    // Create a dummy source doc
    const [sourceDoc] = await db
      .insert(sourceDocuments)
      .values({
        jobId: createdJobId,
        url: 'https://example.com',
        domain: 'example.com',
        status: 'success',
        rawContent: 'Yield is 3000 pages',
      })
      .returning();

    // Create a Claim
    await ClaimsRepository.create({
      itemId: item.id,
      sourceDocId: sourceDoc.id,
      field: 'yield.value',
      value: '3000',
      confidence: 95,
    });

    const claimsList = await ClaimsRepository.findByItemId(item.id);
    const yieldClaims = claimsList.filter((c) => c.field === 'yield.value');

    expect(yieldClaims).toHaveLength(1);
    expect(yieldClaims[0].confidence).toBe(95);
    expect(yieldClaims[0].value).toBe('3000');
  });
});
