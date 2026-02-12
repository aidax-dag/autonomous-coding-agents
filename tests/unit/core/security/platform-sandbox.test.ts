/**
 * Platform Sandbox Factory Unit Tests
 */

import { detectPlatform, createPlatformSandbox } from '../../../../src/core/security/platform-sandbox';

describe('detectPlatform', () => {
  it('should return a valid platform string', () => {
    const platform = detectPlatform();
    expect(['macos', 'linux', 'windows', 'unsupported']).toContain(platform);
  });

  it('should return macos on darwin', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    expect(detectPlatform()).toBe('macos');
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('should return linux on linux', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    expect(detectPlatform()).toBe('linux');
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('should return windows on win32', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    expect(detectPlatform()).toBe('windows');
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('should return unsupported on unknown platforms', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true });
    expect(detectPlatform()).toBe('unsupported');
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });
});

describe('createPlatformSandbox', () => {
  it('should return a sandbox instance on supported platforms', () => {
    const sandbox = createPlatformSandbox();
    // On macOS (CI/dev), should return SeatbeltSandbox; on Linux, LandlockSandbox
    if (process.platform === 'darwin' || process.platform === 'linux') {
      expect(sandbox).not.toBeNull();
      expect(sandbox!.isAvailable()).toBe(true);
      expect(sandbox!.getPlatform()).toBeDefined();
    }
  });

  it('should return SeatbeltSandbox on macOS', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    const sandbox = createPlatformSandbox();
    expect(sandbox).not.toBeNull();
    expect(sandbox!.getPlatform()).toBe('macos');

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('should return LandlockSandbox on Linux', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    const sandbox = createPlatformSandbox();
    expect(sandbox).not.toBeNull();
    expect(sandbox!.getPlatform()).toBe('linux');

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('should return null on unsupported platforms', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    const sandbox = createPlatformSandbox();
    expect(sandbox).toBeNull();

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });
});
