import { describe, it, expect, vi } from 'vitest';
import { GraphService } from './GraphService.js';

// Mock DB - strictly speaking we should use a test DB, but for now we mock the module
vi.mock('../../db/index.js', () => ({
    db: {
        query: {
            aliases: {
                findFirst: vi.fn(),
            },
            edges: {
                findFirst: vi.fn(),
            },
            entities: {
                findFirst: vi.fn()
            }
        },
        insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn(), returning: vi.fn(() => [{ id: 'mock-id' }]) })) })),
        transaction: vi.fn((cb) => cb({
            query: { entities: { findFirst: vi.fn() } },
            insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn(), returning: vi.fn(() => [{ id: 'mock-id' }]) })) }))
        }))
    }
}));

describe('GraphService', () => {
    it('should resolve identity from graph', async () => {
        const { db } = await import('../../db/index.js');
        (db.query.aliases.findFirst as any).mockResolvedValue({
            alias: '12A',
            confidence: 100,
            entityId: 'e-1',
            entity: {
                id: 'e-1',
                canonicalName: 'HP 12A (Q2612A)',
                type: 'consumable'
            }
        });

        const result = await GraphService.resolveIdentity('12A');
        expect(result).toEqual({ mpn: 'HP 12A (Q2612A)', confidence: 100, entityId: 'e-1' });
    });

    it('should return null on graph miss', async () => {
        const { db } = await import('../../db/index.js');
        // Reset mock to ensure no carry-over
        (db.query.aliases.findFirst as any).mockResolvedValue(null);

        const result = await GraphService.resolveIdentity('UnknownSKU');
        expect(result).toBeNull();
    });
});

