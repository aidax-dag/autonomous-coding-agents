/**
 * Network Isolation
 *
 * Controls network access for sandboxed environments.
 * Manages an allowed hosts list and isolation state.
 *
 * @module core/security
 */

import type { INetworkIsolation } from './interfaces/os-sandbox.interface';

// ============================================================================
// Implementation
// ============================================================================

/**
 * NetworkIsolation
 *
 * Manages network access control through an isolation flag and
 * an allowlist of hosts. When isolated, only allowed hosts can
 * be accessed. When not isolated, all hosts are accessible.
 */
export class NetworkIsolation implements INetworkIsolation {
  private isolated: boolean;
  private readonly allowedHosts = new Set<string>();

  constructor(isolated = false) {
    this.isolated = isolated;
  }

  /**
   * Check whether network isolation is currently active.
   */
  isIsolated(): boolean {
    return this.isolated;
  }

  /**
   * Enable or disable network isolation.
   */
  setIsolated(isolated: boolean): void {
    this.isolated = isolated;
  }

  /**
   * Add a host to the allowed list.
   */
  addAllowedHost(host: string): void {
    if (!host) {
      throw new Error('Host cannot be empty');
    }
    this.allowedHosts.add(host.toLowerCase());
  }

  /**
   * Remove a host from the allowed list.
   * @returns true if the host was found and removed
   */
  removeAllowedHost(host: string): boolean {
    return this.allowedHosts.delete(host.toLowerCase());
  }

  /**
   * Get all hosts in the allowed list.
   */
  getAllowedHosts(): string[] {
    return Array.from(this.allowedHosts);
  }

  /**
   * Check whether access to a given host is permitted.
   *
   * - If not isolated: always returns true
   * - If isolated: returns true only if the host is in the allowed list
   */
  checkAccess(host: string): boolean {
    if (!this.isolated) {
      return true;
    }
    return this.allowedHosts.has(host.toLowerCase());
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a NetworkIsolation instance
 *
 * @param isolated - Whether isolation is active from the start (default: false)
 */
export function createNetworkIsolation(isolated = false): NetworkIsolation {
  return new NetworkIsolation(isolated);
}
