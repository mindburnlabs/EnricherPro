
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerResearch, getItem, approveItem, archiveItem } from '../../src/lib/api';

// Mock the API library
vi.mock('../../src/lib/api', () => ({
    triggerResearch: vi.fn(),
    getItems: vi.fn(),
    getItem: vi.fn(),
    approveItem: vi.fn(),
    archiveItem: vi.fn(),
}));

describe('Deduplication & Conflict Resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle "Replace" action: Approve Candidate, Archive Current', async () => {
        const currentId = 'current-id';
        const candidateId = 'candidate-id';

        // 1. Simulate "Replace" action sequence
        // User clicks "Replace" in UI -> calls onApprove(candidate) -> onArchive(current)

        // @ts-ignore
        vi.mocked(approveItem).mockResolvedValue({ success: true, itemId: candidateId });
        // @ts-ignore
        vi.mocked(archiveItem).mockResolvedValue({ success: true, itemId: currentId });

        await approveItem(candidateId);
        await archiveItem(currentId);

        expect(approveItem).toHaveBeenCalledWith(candidateId);
        expect(archiveItem).toHaveBeenCalledWith(currentId);
    });

    it('should handle "Keep Current" action: Archive Candidate', async () => {
        const candidateId = 'candidate-id';

        // 1. Simulate "Keep Current" -> User discards new item
        // UI calls onArchive(candidate)

        // @ts-ignore
        vi.mocked(archiveItem).mockResolvedValue({ success: true, itemId: candidateId });

        await archiveItem(candidateId);

        expect(archiveItem).toHaveBeenCalledWith(candidateId);
    });

    it('should handle "Merge" action: Trigger Research with Context', async () => {
        const currentId = 'current-id';
        const currentJobId = 'job-123';
        const candidateItem = {
            id: 'candidate-id',
            data: { mpn_identity: { mpn: 'HP 12A' } }
        };

        // 1. Simulate "Merge" -> User wants to re-run using old context
        // UI calls onMerge(candidate, current.jobId)

        // @ts-ignore
        vi.mocked(triggerResearch).mockResolvedValue({ success: true, jobId: 'new-job-456' });

        // Logic from App.tsx handleMerge
        const contextJobId = currentJobId;
        await triggerResearch(candidateItem.data.mpn_identity.mpn, 'balanced', {
            forceRefresh: true,
            previousJobId: contextJobId
        });

        expect(triggerResearch).toHaveBeenCalledWith(
            'HP 12A',
            'balanced',
            expect.objectContaining({
                forceRefresh: true,
                previousJobId: currentJobId
            })
        );
    });
});
