/**
 * Performance Profiler Service
 *
 * Provides comprehensive performance monitoring with:
 * - Method-level timing and statistics
 * - Memory usage tracking
 * - Throughput measurement
 * - Performance histograms (p50, p95, p99)
 * - Report generation
 *
 * @module core/services/profiler
 *
 * @example Basic Usage
 * ```typescript
 * import { createProfiler, getProfiler } from './profiler';
 *
 * // Create a profiler instance
 * const profiler = createProfiler();
 *
 * // Time an async operation
 * const result = await profiler.timeAsync('api.request', async () => {
 *   return await fetch('/api/data');
 * });
 *
 * // Manual timing
 * const endTimer = profiler.startTiming('custom.operation');
 * // ... do work
 * const duration = endTimer(); // Returns duration in ms
 *
 * // Generate report
 * const report = profiler.formatReport();
 * console.log(report);
 * ```
 *
 * @example Memory Tracking
 * ```typescript
 * const profiler = createProfiler({
 *   memorySnapshotInterval: 5000, // Every 5 seconds
 *   maxMemorySnapshots: 100,
 * });
 *
 * // Get current memory stats
 * const memStats = profiler.getMemoryStats();
 * console.log(`Current heap: ${memStats.current.heapUsed}`);
 * console.log(`Peak heap: ${memStats.peak.heapUsed}`);
 * ```
 *
 * @example Function Wrappers
 * ```typescript
 * import { withProfiling, withProfilingSync } from './profiler';
 *
 * // Wrap async function
 * const fetchWithProfiling = withProfiling('api.users.fetch',
 *   async (userId: string) => await fetchUser(userId)
 * );
 *
 * // Wrap sync function
 * const parseWithProfiling = withProfilingSync('data.parse',
 *   (data: string) => JSON.parse(data)
 * );
 *
 * // Use wrapped functions
 * const user = await fetchWithProfiling('123');
 * const data = parseWithProfiling('{"name": "test"}');
 * ```
 *
 * @example Global Profiler
 * ```typescript
 * // Get the global profiler instance (singleton)
 * const profiler = getProfiler();
 *
 * // Use across your application
 * profiler.recordTiming('db.query', 45.5);
 *
 * // Get metrics
 * const dbMetrics = profiler.getMetric('db.query');
 * console.log(`Average: ${dbMetrics?.totalTime / dbMetrics?.count}ms`);
 * console.log(`P95: ${profiler.getPercentile('db.query', 95)}ms`);
 *
 * // Reset when needed
 * resetGlobalProfiler();
 * ```
 */

import { createLogger, ILogger } from './logger.js';

/**
 * Performance metric entry
 */
export interface PerformanceMetric {
  /** Name of the operation */
  name: string;
  /** Number of calls */
  count: number;
  /** Total time in milliseconds */
  totalTime: number;
  /** Minimum time in milliseconds */
  minTime: number;
  /** Maximum time in milliseconds */
  maxTime: number;
  /** Last recorded time */
  lastTime: number;
  /** Timestamps for throughput calculation */
  timestamps: number[];
  /** Error count */
  errorCount: number;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** External memory in bytes */
  external: number;
  /** RSS (Resident Set Size) in bytes */
  rss: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  /** Report timestamp */
  generatedAt: string;
  /** Total profiling duration in ms */
  profilingDuration: number;
  /** Metrics summary */
  metrics: MetricSummary[];
  /** Memory statistics */
  memory: MemoryStats;
  /** System info */
  system: SystemInfo;
}

/**
 * Metric summary for reports
 */
export interface MetricSummary {
  name: string;
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughputPerSec: number;
  errorRate: number;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  current: MemorySnapshot;
  peak: MemorySnapshot;
  average: MemorySnapshot;
  snapshots: number;
}

/**
 * System information
 */
export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  cpus: number;
  totalMemory: number;
}

/**
 * Profiler configuration
 */
export interface ProfilerConfig {
  /** Enable profiling */
  enabled?: boolean;
  /** Maximum timestamps to keep per metric (for memory efficiency) */
  maxTimestamps?: number;
  /** Memory snapshot interval in ms (0 = disabled) */
  memorySnapshotInterval?: number;
  /** Maximum memory snapshots to retain */
  maxMemorySnapshots?: number;
}

/**
 * Default profiler configuration
 */
const DEFAULT_PROFILER_CONFIG: Required<ProfilerConfig> = {
  enabled: true,
  maxTimestamps: 1000,
  memorySnapshotInterval: 0,
  maxMemorySnapshots: 100,
};

/**
 * Histogram data for percentile calculations
 */
interface Histogram {
  values: number[];
  maxSize: number;
}

/**
 * Performance Profiler Service
 */
export class Profiler {
  private readonly config: Required<ProfilerConfig>;
  private readonly logger: ILogger;
  private readonly metrics: Map<string, PerformanceMetric> = new Map();
  private readonly histograms: Map<string, Histogram> = new Map();
  private readonly memorySnapshots: MemorySnapshot[] = [];
  private readonly startTime: number;
  private memoryTimer: NodeJS.Timeout | null = null;
  private peakMemory: MemorySnapshot | null = null;

  constructor(config?: ProfilerConfig) {
    this.config = { ...DEFAULT_PROFILER_CONFIG, ...config };
    this.logger = createLogger('Profiler');
    this.startTime = Date.now();

    if (this.config.memorySnapshotInterval > 0) {
      this.startMemoryTracking();
    }
  }

  /**
   * Start timing an operation
   * Returns a function to call when the operation completes
   */
  startTiming(name: string): () => number {
    if (!this.config.enabled) {
      return () => 0;
    }

    const startTime = process.hrtime.bigint();
    const startTimestamp = Date.now();

    return () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      this.recordTiming(name, durationMs, startTimestamp);
      return durationMs;
    };
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }

    const endTiming = this.startTiming(name);

    try {
      const result = await operation();
      endTiming();
      return result;
    } catch (error) {
      endTiming();
      this.recordError(name);
      throw error;
    }
  }

  /**
   * Time a sync operation
   */
  timeSync<T>(name: string, operation: () => T): T {
    if (!this.config.enabled) {
      return operation();
    }

    const endTiming = this.startTiming(name);

    try {
      const result = operation();
      endTiming();
      return result;
    } catch (error) {
      endTiming();
      this.recordError(name);
      throw error;
    }
  }

  /**
   * Record a timing manually
   */
  recordTiming(name: string, durationMs: number, timestamp?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const now = timestamp ?? Date.now();
    let metric = this.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: -Infinity,
        lastTime: 0,
        timestamps: [],
        errorCount: 0,
      };
      this.metrics.set(name, metric);
      this.histograms.set(name, { values: [], maxSize: this.config.maxTimestamps });
    }

    metric.count++;
    metric.totalTime += durationMs;
    metric.minTime = Math.min(metric.minTime, durationMs);
    metric.maxTime = Math.max(metric.maxTime, durationMs);
    metric.lastTime = durationMs;

    // Track timestamps for throughput (with circular buffer)
    metric.timestamps.push(now);
    if (metric.timestamps.length > this.config.maxTimestamps) {
      metric.timestamps.shift();
    }

    // Track values for histogram
    const histogram = this.histograms.get(name)!;
    histogram.values.push(durationMs);
    if (histogram.values.length > histogram.maxSize) {
      histogram.values.shift();
    }
  }

  /**
   * Record an error for a metric
   */
  recordError(name: string): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.errorCount++;
    }
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): PerformanceMetric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Calculate percentile from histogram
   */
  getPercentile(name: string, percentile: number): number {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.values.length === 0) {
      return 0;
    }

    const sorted = [...histogram.values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate throughput (operations per second)
   */
  getThroughput(name: string, windowMs: number = 60000): number {
    const metric = this.metrics.get(name);
    if (!metric || metric.timestamps.length === 0) {
      return 0;
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    const recentTimestamps = metric.timestamps.filter(t => t >= cutoff);

    if (recentTimestamps.length === 0) {
      return 0;
    }

    // Calculate operations per second
    const windowSeconds = windowMs / 1000;
    return recentTimestamps.length / windowSeconds;
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      timestamp: Date.now(),
    };

    this.memorySnapshots.push(snapshot);
    if (this.memorySnapshots.length > this.config.maxMemorySnapshots) {
      this.memorySnapshots.shift();
    }

    // Track peak memory
    if (!this.peakMemory || snapshot.heapUsed > this.peakMemory.heapUsed) {
      this.peakMemory = snapshot;
    }

    return snapshot;
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats {
    const current = this.takeMemorySnapshot();

    let avgHeapUsed = 0;
    let avgHeapTotal = 0;
    let avgExternal = 0;
    let avgRss = 0;

    if (this.memorySnapshots.length > 0) {
      for (const snapshot of this.memorySnapshots) {
        avgHeapUsed += snapshot.heapUsed;
        avgHeapTotal += snapshot.heapTotal;
        avgExternal += snapshot.external;
        avgRss += snapshot.rss;
      }
      const count = this.memorySnapshots.length;
      avgHeapUsed /= count;
      avgHeapTotal /= count;
      avgExternal /= count;
      avgRss /= count;
    }

    return {
      current,
      peak: this.peakMemory ?? current,
      average: {
        heapUsed: avgHeapUsed,
        heapTotal: avgHeapTotal,
        external: avgExternal,
        rss: avgRss,
        timestamp: Date.now(),
      },
      snapshots: this.memorySnapshots.length,
    };
  }

  /**
   * Generate a performance report
   */
  generateReport(): PerformanceReport {
    const now = Date.now();
    const metrics: MetricSummary[] = [];

    for (const [name, metric] of this.metrics) {
      metrics.push({
        name,
        count: metric.count,
        totalMs: Math.round(metric.totalTime * 100) / 100,
        avgMs: Math.round((metric.totalTime / metric.count) * 100) / 100,
        minMs: metric.minTime === Infinity ? 0 : Math.round(metric.minTime * 100) / 100,
        maxMs: metric.maxTime === -Infinity ? 0 : Math.round(metric.maxTime * 100) / 100,
        p50Ms: Math.round(this.getPercentile(name, 50) * 100) / 100,
        p95Ms: Math.round(this.getPercentile(name, 95) * 100) / 100,
        p99Ms: Math.round(this.getPercentile(name, 99) * 100) / 100,
        throughputPerSec: Math.round(this.getThroughput(name) * 100) / 100,
        errorRate: metric.count > 0 ? Math.round((metric.errorCount / metric.count) * 10000) / 100 : 0,
      });
    }

    // Sort by total time descending
    metrics.sort((a, b) => b.totalMs - a.totalMs);

    const os = require('os');

    return {
      generatedAt: new Date().toISOString(),
      profilingDuration: now - this.startTime,
      metrics,
      memory: this.getMemoryStats(),
      system: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
      },
    };
  }

  /**
   * Format report as string
   */
  formatReport(report?: PerformanceReport): string {
    const r = report ?? this.generateReport();
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('PERFORMANCE REPORT');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${r.generatedAt}`);
    lines.push(`Profiling Duration: ${this.formatDuration(r.profilingDuration)}`);
    lines.push('');

    // System Info
    lines.push('System Information:');
    lines.push(`  Node.js: ${r.system.nodeVersion}`);
    lines.push(`  Platform: ${r.system.platform} (${r.system.arch})`);
    lines.push(`  CPUs: ${r.system.cpus}`);
    lines.push(`  Total Memory: ${this.formatBytes(r.system.totalMemory)}`);
    lines.push('');

    // Memory Stats
    lines.push('Memory Usage:');
    lines.push(`  Current Heap: ${this.formatBytes(r.memory.current.heapUsed)} / ${this.formatBytes(r.memory.current.heapTotal)}`);
    lines.push(`  Peak Heap: ${this.formatBytes(r.memory.peak.heapUsed)}`);
    lines.push(`  Average Heap: ${this.formatBytes(r.memory.average.heapUsed)}`);
    lines.push(`  RSS: ${this.formatBytes(r.memory.current.rss)}`);
    lines.push('');

    // Metrics Table
    if (r.metrics.length > 0) {
      lines.push('Performance Metrics:');
      lines.push('-'.repeat(80));
      lines.push(
        this.padRight('Operation', 30) +
        this.padLeft('Count', 10) +
        this.padLeft('Avg (ms)', 12) +
        this.padLeft('P95 (ms)', 12) +
        this.padLeft('Max (ms)', 12)
      );
      lines.push('-'.repeat(80));

      for (const metric of r.metrics) {
        lines.push(
          this.padRight(this.truncate(metric.name, 28), 30) +
          this.padLeft(metric.count.toString(), 10) +
          this.padLeft(metric.avgMs.toFixed(2), 12) +
          this.padLeft(metric.p95Ms.toFixed(2), 12) +
          this.padLeft(metric.maxMs.toFixed(2), 12)
        );
      }
      lines.push('-'.repeat(80));
    } else {
      lines.push('No metrics recorded.');
    }

    lines.push('');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Log the performance report
   */
  logReport(): void {
    const report = this.formatReport();
    this.logger.info('Performance Report:\n' + report);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.histograms.clear();
    this.memorySnapshots.length = 0;
    this.peakMemory = null;
  }

  /**
   * Destroy the profiler
   */
  destroy(): void {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    this.reset();
  }

  /**
   * Start automatic memory tracking
   */
  private startMemoryTracking(): void {
    this.memoryTimer = setInterval(() => {
      this.takeMemorySnapshot();
    }, this.config.memorySnapshotInterval);

    // Don't keep process alive for memory tracking
    this.memoryTimer.unref();
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format duration to human readable
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(2)}m`;
    } else {
      return `${(ms / 3600000).toFixed(2)}h`;
    }
  }

  /**
   * Pad string to the right
   */
  private padRight(str: string, length: number): string {
    return str.padEnd(length);
  }

  /**
   * Pad string to the left
   */
  private padLeft(str: string, length: number): string {
    return str.padStart(length);
  }

  /**
   * Truncate string
   */
  private truncate(str: string, maxLength: number): string {
    return str.length > maxLength ? str.slice(0, maxLength - 2) + '..' : str;
  }
}

// ============================================================================
// Global Profiler Instance
// ============================================================================

let globalProfiler: Profiler | null = null;

/**
 * Get or create the global profiler instance
 */
export function getProfiler(config?: ProfilerConfig): Profiler {
  if (!globalProfiler) {
    globalProfiler = new Profiler(config);
  }
  return globalProfiler;
}

/**
 * Create a new profiler instance
 */
export function createProfiler(config?: ProfilerConfig): Profiler {
  return new Profiler(config);
}

/**
 * Reset the global profiler
 */
export function resetGlobalProfiler(): void {
  if (globalProfiler) {
    globalProfiler.destroy();
    globalProfiler = null;
  }
}

// ============================================================================
// Higher-Order Function Wrappers (Alternative to Decorators)
// ============================================================================

/**
 * Wrap an async function with profiling
 *
 * @example
 * ```typescript
 * const profiledFetch = withProfiling('api.fetch', async (url: string) => {
 *   return fetch(url);
 * });
 * ```
 */
export function withProfiling<TArgs extends unknown[], TReturn>(
  name: string,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const profiler = getProfiler();
    return profiler.timeAsync(name, () => fn(...args));
  };
}

/**
 * Wrap a sync function with profiling
 */
export function withProfilingSync<TArgs extends unknown[], TReturn>(
  name: string,
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    const profiler = getProfiler();
    return profiler.timeSync(name, () => fn(...args));
  };
}
