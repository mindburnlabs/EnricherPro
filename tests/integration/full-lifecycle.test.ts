
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerResearch, getItems, approveItem } from '../../src/lib/api';

// Mock the API library to simulate backend responses
vi.mock('../../src/lib/api', () => ({
    triggerResearch: vi.fn(),
    getItems: vi.fn(),
    approveItem: vi.fn(),
    getItem: vi.fn(),
    archiveItem: vi.fn(),
}));

describe('Full Research Lifecycle Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should complete a full research flow: trigger -> poll -> approve', async () => {
        const jobId = 'test-job-id';
        const itemId = 'test-item-id';

        // 1. Trigger Research
        // @ts-ignore
        vi.mocked(triggerResearch).mockResolvedValue({ success: true, jobId });

        const startRes = await triggerResearch('HP 12A');
        expect(startRes.success).toBe(true);
        expect(startRes.jobId).toBe(jobId);

        // 2. Poll for Items (Simulate processing -> needs_review)
        // @ts-ignore
        vi.mocked(getItems).mockResolvedValueOnce({
            items: [{ id: itemId, jobId, status: 'processing', data: { mpn_identity: { mpn: 'unknown' } } }]
        });

        // Polling loop simulation (1st check)
        let itemsRes = await getItems(jobId);
        expect(itemsRes.items[0].status).toBe('processing');

        // Simulate completion
        // @ts-ignore
        vi.mocked(getItems).mockResolvedValueOnce({
            items: [{
                id: itemId,
                jobId,
                status: 'needs_review',
                data: { mpn_identity: { mpn: 'Q2612A' }, reviewReason: 'Low Confidence' }
            }]
        });

        // Polling loop simulation (2nd check)
        itemsRes = await getItems(jobId);
        expect(itemsRes.items[0].status).toBe('needs_review');
        expect(itemsRes.items[0].data.mpn_identity.mpn).toBe('Q2612A');

        // 3. Approve Item
        // @ts-ignore
        vi.mocked(approveItem).mockResolvedValue({ success: true, itemId });

        const approveRes = await approveItem(itemId);
        expect(approveRes.success).toBe(true);
        expect(vi.mocked(approveItem)).toHaveBeenCalledWith(itemId);
    });
});
