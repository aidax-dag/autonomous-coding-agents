/**
 * Platform Sandbox Factory
 *
 * Creates the appropriate OS-native sandbox based on the current platform.
 * Returns SeatbeltSandbox on macOS, LandlockSandbox on Linux,
 * or null on unsupported platforms.
 *
 * @module core/security
 */

import type { IOSSandbox, SandboxPlatform } from './interfaces/os-sandbox.interface';
import { createSeatbeltSandbox } from './seatbelt-sandbox';
import { createLandlockSandbox } from './landlock-sandbox';

/**
 * Detect the current sandbox platform.
 */
export function detectPlatform(): SandboxPlatform {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      return 'unsupported';
  }
}

/**
 * Create the appropriate OS-native sandbox for the current platform.
 * Returns null if no sandbox is available on this platform.
 */
export function createPlatformSandbox(): IOSSandbox | null {
  const platform = detectPlatform();

  switch (platform) {
    case 'macos':
      return createSeatbeltSandbox();
    case 'linux':
      return createLandlockSandbox();
    default:
      return null;
  }
}
