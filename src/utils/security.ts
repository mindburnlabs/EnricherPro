import { logger } from './logger.js';

export const SecurityUtils = {
  /**
   * maskedLog: Logs a message with sensitive keys masked.
   */
  maskedLog: (msg: string, keys: string[]) => {
    let masked = msg;
    keys.forEach((key) => {
      if (key && key.length > 5) {
        masked = masked.replace(key, `${key.substring(0, 4)}...***`);
      }
    });
    return masked;
  },

  /**
   * validateApiKey: Checks if an API key is present and seemingly valid.
   */
  validateApiKey: (key: string | undefined, provider: string): boolean => {
    if (!key || key.trim() === '') {
      logger.warn(`Security Alert: Missing API Key for ${provider}`);
      return false;
    }
    if (key.length < 10) {
      logger.warn(`Security Alert: Suspiciously short API Key for ${provider}`);
      return false;
    }
    return true;
  },
};
