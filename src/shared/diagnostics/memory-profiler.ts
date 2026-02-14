/**
 * Memory Profiler
 *
 * Provides heap memory tracking and leak detection for long-running
 * agent sessions:
 * - Periodic heap snapshots via process.memoryUsage()
 * - Snapshot comparison with growth-rate calculation
 * - Configurable leak detection thresholds
 * - EventEmitter listener count tracking
 *
 * @module shared/diagnostics/memory-profiler
 */

import { EventEmitter } from 'events';
import { logger } from '../../shared/logging/logger';

/** A single point-in-time memory snapshot. */
export interface MemorySnapshot {
  /** Snapshot capture timestamp (epoch ms). */
  timestamp: number;
  /** Heap memory currently in use (bytes). */
  heapUsed: number;
  /** Total heap allocated by V8 (bytes). */
  heapTotal: number;
  /** Resident set size (bytes). */
  rss: number;
  /** Memory used for ArrayBuffers and SharedArrayBuffers (bytes). */
  arrayBuffers: number;
  /** External C++ memory tied to JS objects (bytes). */
  external: number;
}

/** Result of comparing two snapshots. */
export interface SnapshotComparison {
  /** Absolute difference in heapUsed (bytes). */
  heapUsedDelta: number;
  /** Percentage growth of heapUsed (0..N, where 0.1 = 10%). */
  heapUsedGrowth: number;
  /** Absolute difference in rss (bytes). */
  rssDelta: number;
  /** Percentage growth of rss. */
  rssGrowth: number;
  /** Time elapsed between snapshots (ms). */
  elapsedMs: number;
}

/** Result of a leak detection analysis across all stored snapshots. */
export interface LeakDetectionResult {
  /** Whether a potential leak was detected. */
  leakDetected: boolean;
  /** Number of snapshots analysed. */
  snapshotCount: number;
  /** Overall heap growth percentage from first to last snapshot. */
  overallGrowth: number;
  /** Number of consecutive snapshots showing growth. */
  consecutiveGrowthCount: number;
  /** Configured growth threshold that triggers a leak warning. */
  threshold: number;
  /** Configured minimum snapshots required for analysis. */
  minSnapshots: number;
}

/** Result of tracking EventEmitter listener counts. */
export interface ListenerTrackingResult {
  /** Event name. */
  eventName: string;
  /** Current listener count. */
  listenerCount: number;
  /** Whether the count exceeds the warning threshold. */
  warning: boolean;
}

/** Configuration options for the memory profiler. */
export interface MemoryProfilerOptions {
  /** Growth threshold (fraction) that indicates a leak. Default 0.1 (10%). */
  growthThreshold?: number;
  /** Minimum number of snapshots before leak detection runs. Default 5. */
  minSnapshots?: number;
  /** Maximum number of snapshots retained in memory. Default 100. */
  maxSnapshots?: number;
  /** Listener count that triggers a warning. Default 10. */
  listenerWarningThreshold?: number;
}

/**
 * MemoryProfiler tracks heap memory over time and detects potential leaks
 * by analysing growth trends across multiple snapshots.
 */
export class MemoryProfiler {
  private readonly snapshots: MemorySnapshot[] = [];
  private readonly growthThreshold: number;
  private readonly minSnapshots: number;
  private readonly maxSnapshots: number;
  private readonly listenerWarningThreshold: number;

  constructor(options?: MemoryProfilerOptions) {
    this.growthThreshold = options?.growthThreshold ?? 0.1;
    this.minSnapshots = options?.minSnapshots ?? 5;
    this.maxSnapshots = options?.maxSnapshots ?? 100;
    this.listenerWarningThreshold = options?.listenerWarningThreshold ?? 10;

    logger.debug('MemoryProfiler initialised', {
      growthThreshold: this.growthThreshold,
      minSnapshots: this.minSnapshots,
      maxSnapshots: this.maxSnapshots,
      listenerWarningThreshold: this.listenerWarningThreshold,
    });
  }

  /**
   * Capture a heap memory snapshot and store it.
   * Oldest snapshots are evicted once maxSnapshots is reached.
   */
  snapshot(): MemorySnapshot {
    const mem = process.memoryUsage();
    const snap: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers,
      external: mem.external,
    };

    this.snapshots.push(snap);

    // Evict oldest when over limit
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    }

    logger.debug('Memory snapshot captured', {
      heapUsedMB: (snap.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (snap.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (snap.rss / 1024 / 1024).toFixed(2),
      snapshotCount: this.snapshots.length,
    });

    return snap;
  }

  /**
   * Compare two snapshots and calculate deltas/growth.
   * Returns null if either snapshot is missing.
   */
  compare(older: MemorySnapshot, newer: MemorySnapshot): SnapshotComparison {
    const heapUsedDelta = newer.heapUsed - older.heapUsed;
    const heapUsedGrowth = older.heapUsed === 0 ? 0 : heapUsedDelta / older.heapUsed;

    const rssDelta = newer.rss - older.rss;
    const rssGrowth = older.rss === 0 ? 0 : rssDelta / older.rss;

    const elapsedMs = newer.timestamp - older.timestamp;

    return {
      heapUsedDelta,
      heapUsedGrowth,
      rssDelta,
      rssGrowth,
      elapsedMs,
    };
  }

  /**
   * Analyse stored snapshots for potential memory leaks.
   *
   * A leak is flagged when:
   * 1. At least `minSnapshots` snapshots have been captured.
   * 2. Overall heap growth (first to last) exceeds `growthThreshold`.
   * 3. A majority of consecutive snapshot pairs show positive growth.
   */
  detectLeaks(): LeakDetectionResult {
    const count = this.snapshots.length;

    if (count < this.minSnapshots) {
      logger.debug('Not enough snapshots for leak detection', {
        have: count,
        need: this.minSnapshots,
      });
      return {
        leakDetected: false,
        snapshotCount: count,
        overallGrowth: 0,
        consecutiveGrowthCount: 0,
        threshold: this.growthThreshold,
        minSnapshots: this.minSnapshots,
      };
    }

    const first = this.snapshots[0];
    const last = this.snapshots[count - 1];
    const overallGrowth = first.heapUsed === 0 ? 0 : (last.heapUsed - first.heapUsed) / first.heapUsed;

    // Count consecutive pairs showing positive heap growth
    let consecutiveGrowthCount = 0;
    for (let i = 1; i < count; i++) {
      if (this.snapshots[i].heapUsed > this.snapshots[i - 1].heapUsed) {
        consecutiveGrowthCount++;
      }
    }

    const leakDetected = overallGrowth > this.growthThreshold;

    if (leakDetected) {
      logger.warn('Potential memory leak detected', {
        overallGrowth: (overallGrowth * 100).toFixed(2) + '%',
        threshold: (this.growthThreshold * 100).toFixed(2) + '%',
        consecutiveGrowthCount,
        snapshotCount: count,
        firstHeapMB: (first.heapUsed / 1024 / 1024).toFixed(2),
        lastHeapMB: (last.heapUsed / 1024 / 1024).toFixed(2),
      });
    }

    return {
      leakDetected,
      snapshotCount: count,
      overallGrowth,
      consecutiveGrowthCount,
      threshold: this.growthThreshold,
      minSnapshots: this.minSnapshots,
    };
  }

  /**
   * Track the listener count for a given event on an EventEmitter.
   * Warns if the count exceeds the configured threshold.
   */
  trackListeners(emitter: EventEmitter, eventName: string): ListenerTrackingResult {
    const count = emitter.listenerCount(eventName);
    const warning = count > this.listenerWarningThreshold;

    if (warning) {
      logger.warn('High listener count detected', {
        eventName,
        listenerCount: count,
        threshold: this.listenerWarningThreshold,
      });
    }

    return {
      eventName,
      listenerCount: count,
      warning,
    };
  }

  /**
   * Return all stored snapshots (copy).
   */
  getSnapshots(): ReadonlyArray<MemorySnapshot> {
    return [...this.snapshots];
  }

  /**
   * Return the number of stored snapshots.
   */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  /**
   * Clear all stored snapshots.
   */
  reset(): void {
    this.snapshots.length = 0;
    logger.debug('MemoryProfiler snapshots cleared');
  }
}

/**
 * Factory function matching the project's createXxx pattern.
 */
export function createMemoryProfiler(options?: MemoryProfilerOptions): MemoryProfiler {
  return new MemoryProfiler(options);
}
