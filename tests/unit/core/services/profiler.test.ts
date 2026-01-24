/**
 * Profiler Service Tests
 */

import {
  Profiler,
  createProfiler,
  getProfiler,
  resetGlobalProfiler,
  withProfiling,
  withProfilingSync,
} from '../../../../src/core/services/profiler';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = createProfiler();
  });

  afterEach(() => {
    profiler.destroy();
    resetGlobalProfiler();
  });

  describe('constructor', () => {
    it('should create profiler with default config', () => {
      expect(profiler).toBeInstanceOf(Profiler);
    });

    it('should create profiler with custom config', () => {
      const customProfiler = createProfiler({
        enabled: false,
        maxTimestamps: 500,
      });
      expect(customProfiler).toBeInstanceOf(Profiler);
      customProfiler.destroy();
    });
  });

  describe('startTiming', () => {
    it('should time an operation', async () => {
      const endTiming = profiler.startTiming('test-operation');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = endTiming();
      expect(duration).toBeGreaterThan(0);
    });

    it('should record timing in metrics', () => {
      const endTiming = profiler.startTiming('tracked-op');
      endTiming();

      const metric = profiler.getMetric('tracked-op');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
      expect(metric!.totalTime).toBeGreaterThan(0);
    });

    it('should return 0 when disabled', () => {
      const disabledProfiler = createProfiler({ enabled: false });
      const endTiming = disabledProfiler.startTiming('disabled-op');
      const duration = endTiming();
      expect(duration).toBe(0);
      disabledProfiler.destroy();
    });
  });

  describe('timeAsync', () => {
    it('should time async operations', async () => {
      const result = await profiler.timeAsync('async-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return 'result';
      });

      expect(result).toBe('result');
      const metric = profiler.getMetric('async-op');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    it('should record errors', async () => {
      await expect(
        profiler.timeAsync('error-op', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const metric = profiler.getMetric('error-op');
      expect(metric).toBeDefined();
      expect(metric!.errorCount).toBe(1);
    });
  });

  describe('timeSync', () => {
    it('should time sync operations', () => {
      const result = profiler.timeSync('sync-op', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      });

      expect(result).toBe(4950);
      const metric = profiler.getMetric('sync-op');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    it('should record sync errors', () => {
      expect(() =>
        profiler.timeSync('sync-error', () => {
          throw new Error('Sync error');
        })
      ).toThrow('Sync error');

      const metric = profiler.getMetric('sync-error');
      expect(metric).toBeDefined();
      expect(metric!.errorCount).toBe(1);
    });
  });

  describe('recordTiming', () => {
    it('should record manual timing', () => {
      profiler.recordTiming('manual-op', 100);
      profiler.recordTiming('manual-op', 200);
      profiler.recordTiming('manual-op', 150);

      const metric = profiler.getMetric('manual-op');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(3);
      expect(metric!.totalTime).toBe(450);
      expect(metric!.minTime).toBe(100);
      expect(metric!.maxTime).toBe(200);
    });
  });

  describe('getPercentile', () => {
    it('should calculate percentiles correctly', () => {
      // Record 100 timings from 1 to 100
      for (let i = 1; i <= 100; i++) {
        profiler.recordTiming('percentile-test', i);
      }

      const p50 = profiler.getPercentile('percentile-test', 50);
      const p95 = profiler.getPercentile('percentile-test', 95);
      const p99 = profiler.getPercentile('percentile-test', 99);

      expect(p50).toBe(50);
      expect(p95).toBe(95);
      expect(p99).toBe(99);
    });

    it('should return 0 for non-existent metric', () => {
      expect(profiler.getPercentile('non-existent', 50)).toBe(0);
    });
  });

  describe('getThroughput', () => {
    it('should calculate throughput', async () => {
      // Record several operations
      for (let i = 0; i < 10; i++) {
        profiler.recordTiming('throughput-test', 10);
      }

      const throughput = profiler.getThroughput('throughput-test', 60000);
      // All 10 operations happened within the window
      expect(throughput).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent metric', () => {
      expect(profiler.getThroughput('non-existent')).toBe(0);
    });
  });

  describe('memory tracking', () => {
    it('should take memory snapshot', () => {
      const snapshot = profiler.takeMemorySnapshot();

      expect(snapshot.heapUsed).toBeGreaterThan(0);
      expect(snapshot.heapTotal).toBeGreaterThan(0);
      expect(snapshot.rss).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('should get memory stats', () => {
      profiler.takeMemorySnapshot();
      profiler.takeMemorySnapshot();

      const stats = profiler.getMemoryStats();

      expect(stats.current).toBeDefined();
      expect(stats.peak).toBeDefined();
      expect(stats.average).toBeDefined();
      expect(stats.snapshots).toBeGreaterThanOrEqual(2);
    });

    it('should track peak memory', () => {
      const stats = profiler.getMemoryStats();
      expect(stats.peak.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('getAllMetrics', () => {
    it('should return all metrics', () => {
      profiler.recordTiming('op1', 100);
      profiler.recordTiming('op2', 200);
      profiler.recordTiming('op3', 300);

      const metrics = profiler.getAllMetrics();
      expect(metrics.length).toBe(3);
    });
  });

  describe('generateReport', () => {
    it('should generate performance report', () => {
      profiler.recordTiming('report-op1', 100);
      profiler.recordTiming('report-op2', 200);

      const report = profiler.generateReport();

      expect(report.generatedAt).toBeDefined();
      expect(report.profilingDuration).toBeGreaterThanOrEqual(0);
      expect(report.metrics.length).toBe(2);
      expect(report.memory).toBeDefined();
      expect(report.system).toBeDefined();
      expect(report.system.nodeVersion).toBeDefined();
    });

    it('should include metric statistics', () => {
      for (let i = 0; i < 10; i++) {
        profiler.recordTiming('stats-op', (i + 1) * 10);
      }

      const report = profiler.generateReport();
      const metric = report.metrics.find(m => m.name === 'stats-op');

      expect(metric).toBeDefined();
      expect(metric!.count).toBe(10);
      expect(metric!.avgMs).toBe(55); // (10+20+...+100)/10 = 550/10
      expect(metric!.minMs).toBe(10);
      expect(metric!.maxMs).toBe(100);
    });
  });

  describe('formatReport', () => {
    it('should format report as string', () => {
      profiler.recordTiming('format-op', 100);

      const formatted = profiler.formatReport();

      expect(formatted).toContain('PERFORMANCE REPORT');
      expect(formatted).toContain('format-op');
      expect(formatted).toContain('Memory Usage');
      expect(formatted).toContain('System Information');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      profiler.recordTiming('reset-op', 100);
      profiler.takeMemorySnapshot();

      expect(profiler.getAllMetrics().length).toBe(1);

      profiler.reset();

      expect(profiler.getAllMetrics().length).toBe(0);
    });
  });
});

describe('Global Profiler', () => {
  afterEach(() => {
    resetGlobalProfiler();
  });

  it('should return same instance', () => {
    const p1 = getProfiler();
    const p2 = getProfiler();
    expect(p1).toBe(p2);
  });

  it('should reset global profiler', () => {
    const p1 = getProfiler();
    resetGlobalProfiler();
    const p2 = getProfiler();
    expect(p1).not.toBe(p2);
  });
});

describe('withProfiling wrappers', () => {
  afterEach(() => {
    resetGlobalProfiler();
  });

  describe('withProfiling', () => {
    it('should profile async functions', async () => {
      const doWork = withProfiling('async-work', async (): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return 'done';
      });

      const result = await doWork();

      expect(result).toBe('done');

      const profiler = getProfiler();
      const metric = profiler.getMetric('async-work');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    it('should profile async functions with arguments', async () => {
      const add = withProfiling('async-add', async (a: number, b: number): Promise<number> => {
        return a + b;
      });

      const result = await add(2, 3);

      expect(result).toBe(5);

      const profiler = getProfiler();
      const metric = profiler.getMetric('async-add');
      expect(metric).toBeDefined();
    });
  });

  describe('withProfilingSync', () => {
    it('should profile sync functions', () => {
      const doSyncWork = withProfilingSync('sync-work', (): number => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      });

      const result = doSyncWork();

      expect(result).toBe(4950);

      const profiler = getProfiler();
      const metric = profiler.getMetric('sync-work');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    it('should profile sync functions with arguments', () => {
      const multiply = withProfilingSync('sync-multiply', (a: number, b: number): number => {
        return a * b;
      });

      const result = multiply(4, 5);

      expect(result).toBe(20);

      const profiler = getProfiler();
      const metric = profiler.getMetric('sync-multiply');
      expect(metric).toBeDefined();
    });
  });
});

describe('Profiler with memory tracking', () => {
  it('should automatically track memory when enabled', async () => {
    const profiler = createProfiler({
      memorySnapshotInterval: 10,
      maxMemorySnapshots: 5,
    });

    // Wait for some snapshots to be taken
    await new Promise(resolve => setTimeout(resolve, 50));

    const stats = profiler.getMemoryStats();
    expect(stats.snapshots).toBeGreaterThan(0);

    profiler.destroy();
  });
});

describe('Edge cases', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = createProfiler();
  });

  afterEach(() => {
    profiler.destroy();
  });

  it('should handle empty histogram for percentiles', () => {
    expect(profiler.getPercentile('empty', 50)).toBe(0);
  });

  it('should handle min/max for first recording', () => {
    profiler.recordTiming('first', 50);
    const metric = profiler.getMetric('first');

    expect(metric!.minTime).toBe(50);
    expect(metric!.maxTime).toBe(50);
  });

  it('should handle circular buffer overflow', () => {
    const smallProfiler = createProfiler({ maxTimestamps: 5 });

    for (let i = 0; i < 10; i++) {
      smallProfiler.recordTiming('overflow', i);
    }

    const metric = smallProfiler.getMetric('overflow');
    expect(metric!.timestamps.length).toBe(5);

    smallProfiler.destroy();
  });
});
