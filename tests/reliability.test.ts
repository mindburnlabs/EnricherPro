import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/lib/reliability';

describe('Reliability Utilities', () => {
  it('should retry up to maxRetries on failure', async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('Success');

    const result = await withRetry(mockFn, {
      maxRetries: 3,
      baseDelayMs: 10, // Fast for test
      maxDelayMs: 100,
    });

    expect(result).toBe('Success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw after maxRetries exceeded', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Persistent Fail'));

    await expect(
      withRetry(mockFn, {
        maxRetries: 2,
        baseDelayMs: 10,
      }),
    ).rejects.toThrow('Persistent Fail');

    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry if shouldRetry returns false', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

    await expect(
      withRetry(mockFn, {
        maxRetries: 3,
        baseDelayMs: 10,
        shouldRetry: (err) => !err.message.includes('401'),
      }),
    ).rejects.toThrow('401 Unauthorized');

    expect(mockFn).toHaveBeenCalledTimes(1); // No retry
  });
});
