/**
 * Agent Pool
 *
 * Semaphore-based slot management for provider-level concurrency control.
 *
 * @module core/orchestrator/agent-pool
 */

import type { IAgentPool, PoolStats } from './interfaces/parallel.interface';

/**
 * Agent Pool Configuration
 */
export interface AgentPoolConfig {
  /** Default max concurrent slots per provider */
  defaultMaxPerProvider?: number;
  /** Provider-specific limits */
  providerLimits?: Record<string, number>;
  /** Global max concurrent slots */
  globalMax?: number;
}

/**
 * Agent Pool
 *
 * Manages concurrent execution slots with per-provider semaphores.
 */
export class AgentPool implements IAgentPool {
  private providerSlots: Map<string, { used: number; max: number }> = new Map();
  private globalUsed = 0;
  private globalMax: number;
  private defaultMax: number;
  private waitQueue: Map<string, Array<() => void>> = new Map();

  constructor(config?: AgentPoolConfig) {
    this.defaultMax = config?.defaultMaxPerProvider ?? 3;
    this.globalMax = config?.globalMax ?? 10;

    if (config?.providerLimits) {
      for (const [provider, limit] of Object.entries(config.providerLimits)) {
        this.providerSlots.set(provider, { used: 0, max: limit });
      }
    }
  }

  async acquire(provider: string): Promise<void> {
    const slot = this.getOrCreateSlot(provider);

    if (slot.used < slot.max && this.globalUsed < this.globalMax) {
      slot.used++;
      this.globalUsed++;
      return;
    }

    // Wait for a slot to free up
    return new Promise<void>((resolve) => {
      const queue = this.waitQueue.get(provider) ?? [];
      queue.push(() => {
        slot.used++;
        this.globalUsed++;
        resolve();
      });
      this.waitQueue.set(provider, queue);
    });
  }

  release(provider: string): void {
    const slot = this.providerSlots.get(provider);
    if (!slot || slot.used <= 0) return;

    slot.used--;
    this.globalUsed--;

    // Check if someone is waiting
    const queue = this.waitQueue.get(provider);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      next();
    }
  }

  stats(): PoolStats {
    let totalSlots = 0;
    let usedSlots = 0;
    const providerStats: Record<string, { used: number; max: number }> = {};

    for (const [provider, slot] of this.providerSlots) {
      totalSlots += slot.max;
      usedSlots += slot.used;
      providerStats[provider] = { ...slot };
    }

    return {
      totalSlots: Math.max(totalSlots, this.globalMax),
      usedSlots,
      availableSlots: Math.max(totalSlots, this.globalMax) - usedSlots,
      providerStats,
    };
  }

  private getOrCreateSlot(provider: string): { used: number; max: number } {
    let slot = this.providerSlots.get(provider);
    if (!slot) {
      slot = { used: 0, max: this.defaultMax };
      this.providerSlots.set(provider, slot);
    }
    return slot;
  }
}

/**
 * Create an agent pool
 */
export function createAgentPool(config?: AgentPoolConfig): AgentPool {
  return new AgentPool(config);
}
