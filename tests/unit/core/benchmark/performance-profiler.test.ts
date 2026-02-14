/**
 * Tests for Performance Profiler
 */

import {
  PerformanceProfiler,
  type MeasurementStats,
  type PerformanceReport,
} from '@/core/benchmark';

describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
  });

  describe('mark and measure', () => {
    it('should record marks and measure duration between them', () => {
      profiler.mark('start');
      // Small busy-wait to ensure measurable time
      const end = performance.now() + 2;
      while (performance.now() < end) { /* spin */ }
      profiler.mark('end');

      const duration = profiler.measure('test-duration', 'start', 'end');
      expect(duration).toBeGreaterThan(0);
    });

    it('should throw when start mark is missing', () => {
      profiler.mark('end');
      expect(() => profiler.measure('test', 'missing-start', 'end')).toThrow(
        "Start mark 'missing-start' not found",
      );
    });

    it('should throw when end mark is missing', () => {
      profiler.mark('start');
      expect(() => profiler.measure('test', 'start', 'missing-end')).toThrow(
        "End mark 'missing-end' not found",
      );
    });

    it('should use the most recent mark when multiple exist', () => {
      profiler.mark('point');
      const first = performance.now();
      // Wait a bit
      const end = performance.now() + 5;
      while (performance.now() < end) { /* spin */ }
      profiler.mark('point');

      // Both marks named 'point' — measure uses last of each
      const duration = profiler.measure('zero-gap', 'point', 'point');
      // Duration between latest mark and itself should be 0
      expect(duration).toBe(0);
    });

    it('should store measured duration in durations map', () => {
      profiler.mark('a');
      profiler.mark('b');
      profiler.measure('my-measure', 'a', 'b');

      // Should be retrievable via getStats
      const stats = profiler.getStats('my-measure');
      expect(stats.count).toBe(1);
    });
  });

  describe('startTimer', () => {
    it('should return a stop function that returns duration', () => {
      const stop = profiler.startTimer('op');
      const end = performance.now() + 2;
      while (performance.now() < end) { /* spin */ }
      const duration = stop();

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });

    it('should record the duration automatically', () => {
      const stop = profiler.startTimer('auto-record');
      stop();

      const stats = profiler.getStats('auto-record');
      expect(stats.count).toBe(1);
      expect(stats.min).toBeGreaterThanOrEqual(0);
    });

    it('should support multiple timers with the same name', () => {
      for (let i = 0; i < 5; i++) {
        const stop = profiler.startTimer('multi');
        stop();
      }

      const stats = profiler.getStats('multi');
      expect(stats.count).toBe(5);
    });

    it('should support concurrent timers with different names', () => {
      const stopA = profiler.startTimer('timer-a');
      const stopB = profiler.startTimer('timer-b');

      stopB();
      stopA();

      expect(profiler.getStats('timer-a').count).toBe(1);
      expect(profiler.getStats('timer-b').count).toBe(1);
    });
  });

  describe('recordDuration', () => {
    it('should manually record a duration', () => {
      profiler.recordDuration('manual', 42);
      const stats = profiler.getStats('manual');
      expect(stats.avg).toBe(42);
      expect(stats.count).toBe(1);
    });

    it('should accumulate multiple durations', () => {
      profiler.recordDuration('multi', 10);
      profiler.recordDuration('multi', 20);
      profiler.recordDuration('multi', 30);

      const stats = profiler.getStats('multi');
      expect(stats.count).toBe(3);
      expect(stats.avg).toBe(20);
    });
  });

  describe('getStats', () => {
    it('should calculate min, max, avg correctly', () => {
      const values = [10, 20, 30, 40, 50];
      for (const v of values) {
        profiler.recordDuration('test', v);
      }

      const stats = profiler.getStats('test');
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.avg).toBe(30);
      expect(stats.count).toBe(5);
    });

    it('should calculate p95 correctly for sorted data', () => {
      // 20 values: 1..20. P95 index = ceil(20*0.95)-1 = 18 → value 19
      for (let i = 1; i <= 20; i++) {
        profiler.recordDuration('p95-test', i);
      }

      const stats = profiler.getStats('p95-test');
      expect(stats.p95).toBe(19);
    });

    it('should calculate p95 for a single measurement', () => {
      profiler.recordDuration('single', 42);
      const stats = profiler.getStats('single');
      expect(stats.p95).toBe(42);
      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.avg).toBe(42);
    });

    it('should calculate p95 for two measurements', () => {
      profiler.recordDuration('two', 10);
      profiler.recordDuration('two', 20);
      const stats = profiler.getStats('two');
      // p95 index = ceil(2*0.95)-1 = 1 → value 20
      expect(stats.p95).toBe(20);
    });

    it('should throw for non-existent measurement', () => {
      expect(() => profiler.getStats('nope')).toThrow(
        "No measurements recorded for 'nope'",
      );
    });

    it('should sort values internally regardless of insertion order', () => {
      profiler.recordDuration('unsorted', 50);
      profiler.recordDuration('unsorted', 10);
      profiler.recordDuration('unsorted', 30);

      const stats = profiler.getStats('unsorted');
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all measurements', () => {
      profiler.recordDuration('a', 10);
      profiler.recordDuration('b', 20);
      profiler.recordDuration('c', 30);

      const allStats = profiler.getAllStats();
      expect(allStats.size).toBe(3);
      expect(allStats.has('a')).toBe(true);
      expect(allStats.has('b')).toBe(true);
      expect(allStats.has('c')).toBe(true);
    });

    it('should return empty map when no measurements exist', () => {
      const allStats = profiler.getAllStats();
      expect(allStats.size).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all marks and durations', () => {
      profiler.mark('some-mark');
      profiler.recordDuration('some-dur', 100);

      profiler.reset();

      expect(profiler.getAllStats().size).toBe(0);
      expect(() => profiler.getStats('some-dur')).toThrow();
    });

    it('should allow new measurements after reset', () => {
      profiler.recordDuration('before', 10);
      profiler.reset();
      profiler.recordDuration('after', 20);

      expect(profiler.getStats('after').avg).toBe(20);
      expect(() => profiler.getStats('before')).toThrow();
    });
  });

  describe('toReport', () => {
    it('should generate a report with timestamp', () => {
      profiler.recordDuration('runner-start-latency', 50);
      const report = profiler.toReport();

      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp).getTime()).not.toBeNaN();
    });

    it('should include measurement entries with stats', () => {
      profiler.recordDuration('runner-start-latency', 50);
      const report = profiler.toReport();

      expect(report.measurements).toHaveLength(1);
      expect(report.measurements[0].name).toBe('runner-start-latency');
      expect(report.measurements[0].stats.avg).toBe(50);
    });

    it('should mark entries with matching baselines as pass', () => {
      profiler.recordDuration('runner-start-latency', 50); // threshold=200
      const report = profiler.toReport();

      expect(report.measurements[0].status).toBe('pass');
      expect(report.measurements[0].baseline).toBeDefined();
      expect(report.summary.passed).toBe(1);
    });

    it('should mark entries exceeding lower-is-better threshold as fail', () => {
      profiler.recordDuration('runner-start-latency', 999); // threshold=200
      const report = profiler.toReport();

      expect(report.measurements[0].status).toBe('fail');
      expect(report.summary.failed).toBe(1);
    });

    it('should mark entries below higher-is-better threshold as fail', () => {
      profiler.recordDuration('sequential-task-throughput', 0.5); // threshold=2
      const report = profiler.toReport();

      expect(report.measurements[0].status).toBe('fail');
      expect(report.summary.failed).toBe(1);
    });

    it('should mark entries without baselines as no-baseline', () => {
      profiler.recordDuration('custom-metric', 42);
      const report = profiler.toReport();

      expect(report.measurements[0].status).toBe('no-baseline');
      expect(report.measurements[0].baseline).toBeUndefined();
      expect(report.summary.noBaseline).toBe(1);
    });

    it('should aggregate summary correctly with mixed statuses', () => {
      profiler.recordDuration('runner-start-latency', 50);   // pass
      profiler.recordDuration('runner-stop-latency', 999);    // fail
      profiler.recordDuration('custom-metric', 42);           // no-baseline

      const report = profiler.toReport();

      expect(report.summary.total).toBe(3);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.noBaseline).toBe(1);
    });

    it('should generate empty report when no measurements exist', () => {
      const report = profiler.toReport();

      expect(report.measurements).toEqual([]);
      expect(report.summary.total).toBe(0);
      expect(report.summary.passed).toBe(0);
      expect(report.summary.failed).toBe(0);
      expect(report.summary.noBaseline).toBe(0);
    });

    it('should use average value for baseline comparison', () => {
      // Record values with avg well below threshold
      profiler.recordDuration('runner-start-latency', 10);
      profiler.recordDuration('runner-start-latency', 20);
      profiler.recordDuration('runner-start-latency', 30);

      const report = profiler.toReport();
      // avg = 20, threshold = 200 → pass
      expect(report.measurements[0].status).toBe('pass');
      expect(report.measurements[0].stats.avg).toBe(20);
    });
  });
});
