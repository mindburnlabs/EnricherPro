
import { ManualQueueEntry, EnrichedItem, ConsumableData, ErrorDetail } from '../types';

const STORAGE_KEY = 'enricher_manual_queue';

export class ManualQueueService {
    private queue: ManualQueueEntry[] = [];

    constructor() {
        this.loadQueue();
    }

    private loadQueue() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.queue = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load manual queue', e);
        }
    }

    private saveQueue() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error('Failed to save manual queue', e);
        }
    }

    addToQueue(entry: ManualQueueEntry) {
        // Avoid duplicates
        if (!this.queue.some(e => e.itemId === entry.itemId)) {
            this.queue.push(entry);
            this.saveQueue();
        }
    }

    removeFromQueue(itemId: string) {
        this.queue = this.queue.filter(e => e.itemId !== itemId);
        this.saveQueue();
    }

    getQueue(): ManualQueueEntry[] {
        return this.queue;
    }

    clearQueue() {
        this.queue = [];
        this.saveQueue();
    }
}

export const manualQueueService = new ManualQueueService();
