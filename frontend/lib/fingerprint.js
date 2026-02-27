import FingerprintJS from '@fingerprintjs/fingerprintjs';
import logger from './logger';

let fpPromise = null;

/**
 * Gets the device fingerprint using FingerprintJS
 * Returns a consistent hash-based visitor ID across the same browser
 * @returns {Promise<string>} The device fingerprint
 */
export async function getDeviceFingerprint() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}

/**
 * Gets device fingerprint with timeout fallback
 * If fingerprinting takes too long, returns empty string to allow graceful degradation
 * @param {number} timeoutMs - Timeout in milliseconds (default: 3000)
 * @returns {Promise<string>} The device fingerprint or empty string on timeout
 */
export async function getDeviceFingerprintWithTimeout(timeoutMs = 3000) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fingerprint timeout')), timeoutMs)
    );
    return await Promise.race([getDeviceFingerprint(), timeoutPromise]);
  } catch (error) {
    logger.warn('Failed to get device fingerprint:', error);
    return '';
  }
}
