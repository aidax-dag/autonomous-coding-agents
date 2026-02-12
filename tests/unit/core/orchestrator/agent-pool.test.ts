/**
 * Agent Pool Tests
 */

import { AgentPool } from '@/core/orchestrator/agent-pool';

describe('AgentPool', () => {
  it('should acquire and release slots', async () => {
    const pool = new AgentPool({ defaultMaxPerProvider: 2 });
    await pool.acquire('provider-a');
    const stats = pool.stats();
    expect(stats.usedSlots).toBe(1);
    expect(stats.providerStats['provider-a'].used).toBe(1);

    pool.release('provider-a');
    expect(pool.stats().usedSlots).toBe(0);
  });

  it('should respect per-provider limits', async () => {
    const pool = new AgentPool({
      providerLimits: { 'provider-a': 1 },
    });

    await pool.acquire('provider-a');
    // Second acquire should wait
    let secondAcquired = false;
    const acquirePromise = pool.acquire('provider-a').then(() => {
      secondAcquired = true;
    });

    // Should not have acquired yet
    await new Promise((r) => setTimeout(r, 10));
    expect(secondAcquired).toBe(false);

    // Release first slot
    pool.release('provider-a');
    await acquirePromise;
    expect(secondAcquired).toBe(true);
  });

  it('should track multiple providers independently', async () => {
    const pool = new AgentPool({ defaultMaxPerProvider: 2 });
    await pool.acquire('provider-a');
    await pool.acquire('provider-b');
    const stats = pool.stats();
    expect(stats.providerStats['provider-a'].used).toBe(1);
    expect(stats.providerStats['provider-b'].used).toBe(1);
    expect(stats.usedSlots).toBe(2);
  });

  it('should respect global max limit', async () => {
    const pool = new AgentPool({
      defaultMaxPerProvider: 5,
      globalMax: 2,
    });

    await pool.acquire('provider-a');
    await pool.acquire('provider-a');

    let thirdAcquired = false;
    const acquirePromise = pool.acquire('provider-a').then(() => {
      thirdAcquired = true;
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(thirdAcquired).toBe(false);

    pool.release('provider-a');
    await acquirePromise;
    expect(thirdAcquired).toBe(true);
  });

  it('should handle release of non-acquired provider', () => {
    const pool = new AgentPool();
    // Should not throw
    pool.release('nonexistent');
    expect(pool.stats().usedSlots).toBe(0);
  });

  it('should report correct stats', async () => {
    const pool = new AgentPool({
      providerLimits: { 'provider-a': 3 },
      globalMax: 10,
    });
    await pool.acquire('provider-a');
    await pool.acquire('provider-a');

    const stats = pool.stats();
    expect(stats.usedSlots).toBe(2);
    expect(stats.availableSlots).toBe(stats.totalSlots - 2);
    expect(stats.providerStats['provider-a']).toEqual({ used: 2, max: 3 });
  });

  it('should auto-create provider slots with default max', async () => {
    const pool = new AgentPool({ defaultMaxPerProvider: 5 });
    await pool.acquire('new-provider');
    expect(pool.stats().providerStats['new-provider']).toEqual({ used: 1, max: 5 });
  });

  it('should create via factory', async () => {
    const { createAgentPool } = await import('@/core/orchestrator/agent-pool');
    const pool = createAgentPool({ defaultMaxPerProvider: 2 });
    expect(pool).toBeInstanceOf(AgentPool);
  });
});
