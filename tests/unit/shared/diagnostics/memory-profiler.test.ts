/**
 * Memory Profiler Tests
 *
 * Covers:
 * - Snapshot capture and field correctness
 * - Snapshot comparison with delta/growth calculations
 * - Leak detection with simulated growth patterns
 * - Leak detection below threshold (no false positives)
 * - EventEmitter listener tracking and warnings
 * - Threshold configuration overrides
 * - Edge cases: empty snapshots, single snapshot, zero heap
 * - Snapshot eviction when maxSnapshots is exceeded
 * - Factory function creation
 * - Reset / clear behaviour
 */

import { EventEmitter } from 'events';
import {
  MemoryProfiler,
  createMemoryProfiler,
} from '../../../../src/shared/diagnostics/memory-profiler';
import type {
  MemorySnapshot,
  SnapshotComparison,
  LeakDetectionResult,
  ListenerTrackingResult,
  MemoryProfilerOptions,
} from '../../../../src/shared/diagnostics/memory-profiler';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { logger } = jest.requireMock('../../../../src/shared/logging/logger') as {
  logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };
};

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;

  beforeEach(() => {
    jest.clearAllMocks();
    profiler = createMemoryProfiler();
  });

  // ─── Snapshot capture ────────────────────────────────────────────────

  describe('snapshot()', () => {
    it('should capture a snapshot with all required fields', () => {
      const snap = profiler.snapshot();

      expect(snap.timestamp).toEqual(expect.any(Number));
      expect(snap.heapUsed).toEqual(expect.any(Number));
      expect(snap.heapTotal).toEqual(expect.any(Number));
      expect(snap.rss).toEqual(expect.any(Number));
      expect(snap.arrayBuffers).toEqual(expect.any(Number));
      expect(snap.external).toEqual(expect.any(Number));
    });

    it('should capture positive heap values from the running process', () => {
      const snap = profiler.snapshot();

      expect(snap.heapUsed).toBeGreaterThan(0);
      expect(snap.heapTotal).toBeGreaterThan(0);
      expect(snap.rss).toBeGreaterThan(0);
    });

    it('should increment the snapshot count on each capture', () => {
      expect(profiler.getSnapshotCount()).toBe(0);

      profiler.snapshot();
      expect(profiler.getSnapshotCount()).toBe(1);

      profiler.snapshot();
      expect(profiler.getSnapshotCount()).toBe(2);
    });

    it('should store snapshots in chronological order', () => {
      profiler.snapshot();
      profiler.snapshot();

      const snaps = profiler.getSnapshots();
      expect(snaps[1].timestamp).toBeGreaterThanOrEqual(snaps[0].timestamp);
    });

    it('should log a debug message on capture', () => {
      profiler.snapshot();

      expect(logger.debug).toHaveBeenCalledWith(
        'Memory snapshot captured',
        expect.objectContaining({
          snapshotCount: 1,
        }),
      );
    });

    it('should evict oldest snapshots when maxSnapshots is exceeded', () => {
      const small = createMemoryProfiler({ maxSnapshots: 3 });

      small.snapshot();
      small.snapshot();
      small.snapshot();
      expect(small.getSnapshotCount()).toBe(3);

      small.snapshot(); // should evict the oldest
      expect(small.getSnapshotCount()).toBe(3);

      small.snapshot();
      expect(small.getSnapshotCount()).toBe(3);
    });
  });

  // ─── Snapshot comparison ─────────────────────────────────────────────

  describe('compare()', () => {
    it('should calculate positive deltas when memory grew', () => {
      const older: MemorySnapshot = {
        timestamp: 1000,
        heapUsed: 1_000_000,
        heapTotal: 2_000_000,
        rss: 3_000_000,
        arrayBuffers: 100_000,
        external: 50_000,
      };
      const newer: MemorySnapshot = {
        timestamp: 2000,
        heapUsed: 1_500_000,
        heapTotal: 2_500_000,
        rss: 3_500_000,
        arrayBuffers: 150_000,
        external: 60_000,
      };

      const cmp = profiler.compare(older, newer);

      expect(cmp.heapUsedDelta).toBe(500_000);
      expect(cmp.heapUsedGrowth).toBeCloseTo(0.5, 5);
      expect(cmp.rssDelta).toBe(500_000);
      expect(cmp.rssGrowth).toBeCloseTo(500_000 / 3_000_000, 5);
      expect(cmp.elapsedMs).toBe(1000);
    });

    it('should calculate negative deltas when memory shrank', () => {
      const older: MemorySnapshot = {
        timestamp: 1000,
        heapUsed: 2_000_000,
        heapTotal: 4_000_000,
        rss: 5_000_000,
        arrayBuffers: 200_000,
        external: 100_000,
      };
      const newer: MemorySnapshot = {
        timestamp: 2000,
        heapUsed: 1_000_000,
        heapTotal: 3_000_000,
        rss: 4_000_000,
        arrayBuffers: 100_000,
        external: 50_000,
      };

      const cmp = profiler.compare(older, newer);

      expect(cmp.heapUsedDelta).toBe(-1_000_000);
      expect(cmp.heapUsedGrowth).toBeCloseTo(-0.5, 5);
      expect(cmp.rssDelta).toBe(-1_000_000);
    });

    it('should return zero growth when snapshots are identical', () => {
      const snap: MemorySnapshot = {
        timestamp: 1000,
        heapUsed: 1_000_000,
        heapTotal: 2_000_000,
        rss: 3_000_000,
        arrayBuffers: 100_000,
        external: 50_000,
      };

      const cmp = profiler.compare(snap, snap);

      expect(cmp.heapUsedDelta).toBe(0);
      expect(cmp.heapUsedGrowth).toBe(0);
      expect(cmp.rssDelta).toBe(0);
      expect(cmp.rssGrowth).toBe(0);
      expect(cmp.elapsedMs).toBe(0);
    });

    it('should handle zero heapUsed in older snapshot without division by zero', () => {
      const older: MemorySnapshot = {
        timestamp: 1000,
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        arrayBuffers: 0,
        external: 0,
      };
      const newer: MemorySnapshot = {
        timestamp: 2000,
        heapUsed: 1_000_000,
        heapTotal: 2_000_000,
        rss: 3_000_000,
        arrayBuffers: 100_000,
        external: 50_000,
      };

      const cmp = profiler.compare(older, newer);

      expect(cmp.heapUsedGrowth).toBe(0);
      expect(cmp.rssGrowth).toBe(0);
      expect(cmp.heapUsedDelta).toBe(1_000_000);
    });
  });

  // ─── Leak detection ──────────────────────────────────────────────────

  describe('detectLeaks()', () => {
    it('should return no leak when there are no snapshots', () => {
      const result = profiler.detectLeaks();

      expect(result.leakDetected).toBe(false);
      expect(result.snapshotCount).toBe(0);
      expect(result.overallGrowth).toBe(0);
      expect(result.consecutiveGrowthCount).toBe(0);
    });

    it('should return no leak when below minSnapshots', () => {
      profiler.snapshot();
      profiler.snapshot();

      const result = profiler.detectLeaks();

      expect(result.leakDetected).toBe(false);
      expect(result.snapshotCount).toBe(2);
      expect(result.minSnapshots).toBe(5);
    });

    it('should detect a leak when simulated growth exceeds the threshold', () => {
      // Use a profiler with low threshold and minSnapshots for controlled testing
      const leaky = createMemoryProfiler({
        growthThreshold: 0.1,
        minSnapshots: 3,
      });

      // Manually inject snapshots simulating steady heap growth (>10%)
      const baseHeap = 1_000_000;
      const snapshots = (leaky as unknown as { snapshots: MemorySnapshot[] }).snapshots;
      for (let i = 0; i < 5; i++) {
        snapshots.push({
          timestamp: Date.now() + i * 1000,
          heapUsed: baseHeap + i * 200_000, // 20% growth per step
          heapTotal: baseHeap * 2,
          rss: baseHeap * 3,
          arrayBuffers: 0,
          external: 0,
        });
      }

      const result = leaky.detectLeaks();

      expect(result.leakDetected).toBe(true);
      expect(result.overallGrowth).toBeGreaterThan(0.1);
      expect(result.consecutiveGrowthCount).toBe(4);
      expect(result.snapshotCount).toBe(5);
    });

    it('should not detect a leak when growth is below threshold', () => {
      const stable = createMemoryProfiler({
        growthThreshold: 0.5,
        minSnapshots: 3,
      });

      const baseHeap = 1_000_000;
      const snapshots = (stable as unknown as { snapshots: MemorySnapshot[] }).snapshots;
      for (let i = 0; i < 5; i++) {
        snapshots.push({
          timestamp: Date.now() + i * 1000,
          heapUsed: baseHeap + i * 10_000, // ~4% total growth, well below 50%
          heapTotal: baseHeap * 2,
          rss: baseHeap * 3,
          arrayBuffers: 0,
          external: 0,
        });
      }

      const result = stable.detectLeaks();

      expect(result.leakDetected).toBe(false);
      expect(result.overallGrowth).toBeLessThan(0.5);
    });

    it('should log a warning when a leak is detected', () => {
      const leaky = createMemoryProfiler({
        growthThreshold: 0.05,
        minSnapshots: 2,
      });

      const snapshots = (leaky as unknown as { snapshots: MemorySnapshot[] }).snapshots;
      snapshots.push(
        { timestamp: 1000, heapUsed: 1_000_000, heapTotal: 2_000_000, rss: 3_000_000, arrayBuffers: 0, external: 0 },
        { timestamp: 2000, heapUsed: 2_000_000, heapTotal: 3_000_000, rss: 4_000_000, arrayBuffers: 0, external: 0 },
      );

      leaky.detectLeaks();

      expect(logger.warn).toHaveBeenCalledWith(
        'Potential memory leak detected',
        expect.objectContaining({
          snapshotCount: 2,
        }),
      );
    });

    it('should handle stable memory (no growth) correctly', () => {
      const flat = createMemoryProfiler({
        growthThreshold: 0.1,
        minSnapshots: 3,
      });

      const snapshots = (flat as unknown as { snapshots: MemorySnapshot[] }).snapshots;
      for (let i = 0; i < 5; i++) {
        snapshots.push({
          timestamp: Date.now() + i * 1000,
          heapUsed: 1_000_000, // constant
          heapTotal: 2_000_000,
          rss: 3_000_000,
          arrayBuffers: 0,
          external: 0,
        });
      }

      const result = flat.detectLeaks();

      expect(result.leakDetected).toBe(false);
      expect(result.overallGrowth).toBe(0);
      expect(result.consecutiveGrowthCount).toBe(0);
    });

    it('should handle decreasing memory correctly', () => {
      const shrinking = createMemoryProfiler({
        growthThreshold: 0.1,
        minSnapshots: 3,
      });

      const snapshots = (shrinking as unknown as { snapshots: MemorySnapshot[] }).snapshots;
      for (let i = 0; i < 5; i++) {
        snapshots.push({
          timestamp: Date.now() + i * 1000,
          heapUsed: 2_000_000 - i * 100_000, // decreasing
          heapTotal: 3_000_000,
          rss: 4_000_000,
          arrayBuffers: 0,
          external: 0,
        });
      }

      const result = shrinking.detectLeaks();

      expect(result.leakDetected).toBe(false);
      expect(result.overallGrowth).toBeLessThan(0);
      expect(result.consecutiveGrowthCount).toBe(0);
    });

    it('should report correct threshold and minSnapshots in results', () => {
      const custom = createMemoryProfiler({
        growthThreshold: 0.25,
        minSnapshots: 8,
      });

      const result = custom.detectLeaks();

      expect(result.threshold).toBe(0.25);
      expect(result.minSnapshots).toBe(8);
    });
  });

  // ─── EventEmitter listener tracking ──────────────────────────────────

  describe('trackListeners()', () => {
    it('should report zero listeners on a fresh emitter', () => {
      const emitter = new EventEmitter();
      const result = profiler.trackListeners(emitter, 'data');

      expect(result.eventName).toBe('data');
      expect(result.listenerCount).toBe(0);
      expect(result.warning).toBe(false);
    });

    it('should count listeners accurately after adding', () => {
      const emitter = new EventEmitter();
      const noop = (): void => { /* no-op */ };

      emitter.on('data', noop);
      emitter.on('data', noop);
      emitter.on('data', noop);

      const result = profiler.trackListeners(emitter, 'data');

      expect(result.listenerCount).toBe(3);
      expect(result.warning).toBe(false);
    });

    it('should warn when listener count exceeds threshold', () => {
      const cautious = createMemoryProfiler({ listenerWarningThreshold: 2 });
      const emitter = new EventEmitter();
      emitter.setMaxListeners(20);
      const noop = (): void => { /* no-op */ };

      emitter.on('data', noop);
      emitter.on('data', noop);
      emitter.on('data', noop); // 3 > threshold of 2

      const result = cautious.trackListeners(emitter, 'data');

      expect(result.warning).toBe(true);
      expect(result.listenerCount).toBe(3);
      expect(logger.warn).toHaveBeenCalledWith(
        'High listener count detected',
        expect.objectContaining({
          eventName: 'data',
          listenerCount: 3,
          threshold: 2,
        }),
      );
    });

    it('should not warn when listener count equals the threshold', () => {
      const exact = createMemoryProfiler({ listenerWarningThreshold: 3 });
      const emitter = new EventEmitter();
      const noop = (): void => { /* no-op */ };

      emitter.on('test', noop);
      emitter.on('test', noop);
      emitter.on('test', noop);

      const result = exact.trackListeners(emitter, 'test');

      expect(result.warning).toBe(false);
      expect(result.listenerCount).toBe(3);
    });

    it('should reflect listener removal correctly', () => {
      const emitter = new EventEmitter();
      const noop = (): void => { /* no-op */ };

      emitter.on('data', noop);
      emitter.on('data', noop);
      expect(profiler.trackListeners(emitter, 'data').listenerCount).toBe(2);

      emitter.removeListener('data', noop);
      expect(profiler.trackListeners(emitter, 'data').listenerCount).toBe(1);

      emitter.removeAllListeners('data');
      expect(profiler.trackListeners(emitter, 'data').listenerCount).toBe(0);
    });

    it('should track different event names independently', () => {
      const emitter = new EventEmitter();
      const noop = (): void => { /* no-op */ };

      emitter.on('data', noop);
      emitter.on('error', noop);
      emitter.on('error', noop);

      expect(profiler.trackListeners(emitter, 'data').listenerCount).toBe(1);
      expect(profiler.trackListeners(emitter, 'error').listenerCount).toBe(2);
    });
  });

  // ─── Configuration ───────────────────────────────────────────────────

  describe('configuration', () => {
    it('should apply default options when none are provided', () => {
      const defaults = createMemoryProfiler();
      const result = defaults.detectLeaks();

      expect(result.threshold).toBe(0.1);
      expect(result.minSnapshots).toBe(5);
    });

    it('should accept custom growthThreshold', () => {
      const custom = createMemoryProfiler({ growthThreshold: 0.5 });
      const result = custom.detectLeaks();

      expect(result.threshold).toBe(0.5);
    });

    it('should accept custom minSnapshots', () => {
      const custom = createMemoryProfiler({ minSnapshots: 10 });
      const result = custom.detectLeaks();

      expect(result.minSnapshots).toBe(10);
    });

    it('should accept custom maxSnapshots and enforce eviction', () => {
      const small = createMemoryProfiler({ maxSnapshots: 2 });

      small.snapshot();
      small.snapshot();
      small.snapshot();

      expect(small.getSnapshotCount()).toBe(2);
    });

    it('should log initialisation with configured options', () => {
      createMemoryProfiler({
        growthThreshold: 0.2,
        minSnapshots: 3,
        maxSnapshots: 50,
        listenerWarningThreshold: 5,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'MemoryProfiler initialised',
        expect.objectContaining({
          growthThreshold: 0.2,
          minSnapshots: 3,
          maxSnapshots: 50,
          listenerWarningThreshold: 5,
        }),
      );
    });
  });

  // ─── Reset and state management ──────────────────────────────────────

  describe('reset()', () => {
    it('should clear all snapshots', () => {
      profiler.snapshot();
      profiler.snapshot();
      profiler.snapshot();
      expect(profiler.getSnapshotCount()).toBe(3);

      profiler.reset();

      expect(profiler.getSnapshotCount()).toBe(0);
      expect(profiler.getSnapshots()).toHaveLength(0);
    });

    it('should allow new snapshots after reset', () => {
      profiler.snapshot();
      profiler.reset();
      profiler.snapshot();

      expect(profiler.getSnapshotCount()).toBe(1);
    });

    it('should log a debug message on reset', () => {
      profiler.reset();

      expect(logger.debug).toHaveBeenCalledWith('MemoryProfiler snapshots cleared');
    });
  });

  // ─── getSnapshots ────────────────────────────────────────────────────

  describe('getSnapshots()', () => {
    it('should return an empty array when no snapshots taken', () => {
      expect(profiler.getSnapshots()).toEqual([]);
    });

    it('should return a copy that does not affect internal state', () => {
      profiler.snapshot();
      const snaps = profiler.getSnapshots();

      // Mutating the returned array should not change internal count
      (snaps as MemorySnapshot[]).push({
        timestamp: 0,
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        arrayBuffers: 0,
        external: 0,
      });

      expect(profiler.getSnapshotCount()).toBe(1);
    });
  });

  // ─── Factory function ────────────────────────────────────────────────

  describe('createMemoryProfiler()', () => {
    it('should return a MemoryProfiler instance', () => {
      const p = createMemoryProfiler();
      expect(p).toBeInstanceOf(MemoryProfiler);
    });

    it('should accept options and pass them through', () => {
      const p = createMemoryProfiler({
        growthThreshold: 0.3,
        minSnapshots: 7,
        maxSnapshots: 20,
        listenerWarningThreshold: 15,
      });

      const result = p.detectLeaks();
      expect(result.threshold).toBe(0.3);
      expect(result.minSnapshots).toBe(7);
    });

    it('should create independent instances', () => {
      const a = createMemoryProfiler();
      const b = createMemoryProfiler();

      a.snapshot();
      a.snapshot();

      expect(a.getSnapshotCount()).toBe(2);
      expect(b.getSnapshotCount()).toBe(0);
    });
  });
});
