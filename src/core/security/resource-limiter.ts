/**
 * Resource Limiter
 *
 * Enforces memory, CPU, and timeout limits for sandboxed processes.
 *
 * @module core/security
 */

import type { IResourceLimiter } from './interfaces/os-sandbox.interface';

// ============================================================================
// Implementation
// ============================================================================

/**
 * ResourceLimiter
 *
 * Tracks resource limits and provides check methods to determine
 * whether current resource usage is within configured bounds.
 */
export class ResourceLimiter implements IResourceLimiter {
  private memoryMB: number | null = null;
  private cpuPercent: number | null = null;
  private timeoutMs: number | null = null;

  /**
   * Set the maximum memory limit in megabytes.
   * @throws if mb is not a positive number
   */
  setMemoryLimit(mb: number): void {
    if (mb <= 0) {
      throw new Error('Memory limit must be a positive number');
    }
    this.memoryMB = mb;
  }

  /**
   * Set the maximum CPU usage limit as a percentage (0-100).
   * @throws if percent is not in the valid range
   */
  setCpuLimit(percent: number): void {
    if (percent <= 0 || percent > 100) {
      throw new Error('CPU limit must be between 0 (exclusive) and 100 (inclusive)');
    }
    this.cpuPercent = percent;
  }

  /**
   * Set the execution timeout in milliseconds.
   * @throws if ms is not a positive number
   */
  setTimeout(ms: number): void {
    if (ms <= 0) {
      throw new Error('Timeout must be a positive number');
    }
    this.timeoutMs = ms;
  }

  /**
   * Get all currently configured limits.
   */
  getLimits(): { memoryMB: number | null; cpuPercent: number | null; timeoutMs: number | null } {
    return {
      memoryMB: this.memoryMB,
      cpuPercent: this.cpuPercent,
      timeoutMs: this.timeoutMs,
    };
  }

  /**
   * Check whether current memory usage is within the configured limit.
   *
   * @param currentMB - Current memory usage in megabytes
   * @returns true if within limit (or no limit is set)
   */
  checkMemory(currentMB: number): boolean {
    if (this.memoryMB === null) {
      return true;
    }
    return currentMB <= this.memoryMB;
  }

  /**
   * Check whether current CPU usage is within the configured limit.
   *
   * @param currentPercent - Current CPU usage as a percentage
   * @returns true if within limit (or no limit is set)
   */
  checkCpu(currentPercent: number): boolean {
    if (this.cpuPercent === null) {
      return true;
    }
    return currentPercent <= this.cpuPercent;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ResourceLimiter instance
 */
export function createResourceLimiter(): ResourceLimiter {
  return new ResourceLimiter();
}
