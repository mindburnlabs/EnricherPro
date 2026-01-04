import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DeduplicationService } from '../src/services/backend/DeduplicationService';
import { db } from '../src/db';
import { items, jobs } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('DeduplicationService', () => {
  const jobId = uuidv4();
  const existingMpn = 'CF283A';
  const existingId = uuidv4();

  beforeAll(async () => {
    // Create Job
    await db.insert(jobs).values([{ id: jobId, inputRaw: 'dedup-test', status: 'running' }]);

    // Create baseline item
    await db.insert(items).values({
      id: existingId,
      jobId: jobId,
      status: 'published',
      currentStep: 'finalizing',
      data: { mpn_identity: { mpn: existingMpn } },
    });
  });

  afterAll(async () => {
    await db.delete(items).where(eq(items.jobId, jobId));
    await db.delete(jobs).where(eq(jobs.id, jobId));
  });

  it('should find exact match', async () => {
    const result = await DeduplicationService.findPotentialDuplicate('CF283A');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('exact');
    expect(result?.id).toBe(existingId);
  });

  it('should find fuzzy match (dash)', async () => {
    const result = await DeduplicationService.findPotentialDuplicate('CF-283A');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('exact'); // Normalized removal of dash makes it exact normalized match
    expect(result?.id).toBe(existingId);
  });

  it('should find fuzzy match (Levenshtein)', async () => {
    // "CF283X" is 1 char diff from "CF283A"
    const result = await DeduplicationService.findPotentialDuplicate('CF283X');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('fuzzy');
    expect(result?.id).toBe(existingId);
  });

  it('should NOT find match for different item', async () => {
    const result = await DeduplicationService.findPotentialDuplicate('Q2612A');
    expect(result).toBeNull();
  });
});
