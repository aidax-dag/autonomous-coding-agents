/**
 * Tests for Performance Baselines
 */

import {
  type PerformanceBaseline,
  type BaselineCheckResult,
  PERFORMANCE_BASELINES,
  getBaseline,
  checkBaseline,
  checkAllBaselines,
} from '@/core/benchmark';

describe('PerformanceBaselines', () => {
  describe('PERFORMANCE_BASELINES', () => {
    it('should contain at least 10 baselines', () => {
      expect(PERFORMANCE_BASELINES.length).toBeGreaterThanOrEqual(10);
    });

    it('should have unique names', () => {
      const names = PERFORMANCE_BASELINES.map((b) => b.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have all required fields on every baseline', () => {
      for (const baseline of PERFORMANCE_BASELINES) {
        expect(baseline.name).toBeDefined();
        expect(baseline.category).toBeDefined();
        expect(baseline.metric).toBeDefined();
        expect(baseline.unit).toBeDefined();
        expect(typeof baseline.baseline).toBe('number');
        expect(typeof baseline.threshold).toBe('number');
        expect(['lower-is-better', 'higher-is-better']).toContain(baseline.direction);
      }
    });

    it('should contain latency category baselines', () => {
      const latencyBaselines = PERFORMANCE_BASELINES.filter((b) => b.category === 'latency');
      expect(latencyBaselines.length).toBeGreaterThanOrEqual(1);
    });

    it('should contain throughput category baselines', () => {
      const throughputBaselines = PERFORMANCE_BASELINES.filter((b) => b.category === 'throughput');
      expect(throughputBaselines.length).toBeGreaterThanOrEqual(1);
    });

    it('should contain resource category baselines', () => {
      const resourceBaselines = PERFORMANCE_BASELINES.filter((b) => b.category === 'resource');
      expect(resourceBaselines.length).toBeGreaterThanOrEqual(1);
    });

    it('should contain quality category baselines', () => {
      const qualityBaselines = PERFORMANCE_BASELINES.filter((b) => b.category === 'quality');
      expect(qualityBaselines.length).toBeGreaterThanOrEqual(1);
    });

    it('should have threshold >= baseline for lower-is-better metrics', () => {
      const lowerBetter = PERFORMANCE_BASELINES.filter((b) => b.direction === 'lower-is-better');
      for (const b of lowerBetter) {
        expect(b.threshold).toBeGreaterThanOrEqual(b.baseline);
      }
    });

    it('should have threshold <= baseline for higher-is-better metrics', () => {
      const higherBetter = PERFORMANCE_BASELINES.filter((b) => b.direction === 'higher-is-better');
      for (const b of higherBetter) {
        expect(b.threshold).toBeLessThanOrEqual(b.baseline);
      }
    });
  });

  describe('getBaseline', () => {
    it('should return a baseline by name', () => {
      const baseline = getBaseline('runner-start-latency');
      expect(baseline).toBeDefined();
      expect(baseline!.name).toBe('runner-start-latency');
      expect(baseline!.category).toBe('latency');
    });

    it('should return undefined for unknown name', () => {
      const result = getBaseline('non-existent-baseline');
      expect(result).toBeUndefined();
    });
  });

  describe('checkBaseline', () => {
    it('should pass for lower-is-better value within threshold', () => {
      const result = checkBaseline('runner-start-latency', 100);
      expect(result.passed).toBe(true);
      expect(result.actual).toBe(100);
      expect(result.name).toBe('runner-start-latency');
    });

    it('should pass for lower-is-better value exactly at threshold', () => {
      const result = checkBaseline('runner-start-latency', 200);
      expect(result.passed).toBe(true);
    });

    it('should fail for lower-is-better value exceeding threshold', () => {
      const result = checkBaseline('runner-start-latency', 300);
      expect(result.passed).toBe(false);
      expect(result.actual).toBe(300);
      expect(result.threshold).toBe(200);
    });

    it('should pass for higher-is-better value above threshold', () => {
      const result = checkBaseline('sequential-task-throughput', 15);
      expect(result.passed).toBe(true);
      expect(result.actual).toBe(15);
    });

    it('should pass for higher-is-better value exactly at threshold', () => {
      const result = checkBaseline('sequential-task-throughput', 2);
      expect(result.passed).toBe(true);
    });

    it('should fail for higher-is-better value below threshold', () => {
      const result = checkBaseline('sequential-task-throughput', 1);
      expect(result.passed).toBe(false);
    });

    it('should include correct direction in result', () => {
      const latencyResult = checkBaseline('runner-start-latency', 50);
      expect(latencyResult.direction).toBe('lower-is-better');

      const throughputResult = checkBaseline('sequential-task-throughput', 10);
      expect(throughputResult.direction).toBe('higher-is-better');
    });

    it('should calculate deviation ratio from baseline', () => {
      // baseline=50, actual=100 → deviation = (100-50)/50 = 1.0
      const result = checkBaseline('runner-start-latency', 100);
      expect(result.deviationRatio).toBe(1.0);
    });

    it('should calculate zero deviation when actual equals baseline', () => {
      const result = checkBaseline('runner-start-latency', 50);
      expect(result.deviationRatio).toBe(0);
    });

    it('should calculate negative deviation when actual is below baseline', () => {
      const result = checkBaseline('runner-start-latency', 25);
      expect(result.deviationRatio).toBe(-0.5);
    });

    it('should throw for unknown baseline name', () => {
      expect(() => checkBaseline('unknown-metric', 42)).toThrow('Unknown baseline: unknown-metric');
    });
  });

  describe('checkAllBaselines', () => {
    it('should check multiple baselines at once', () => {
      const results = checkAllBaselines([
        { name: 'runner-start-latency', value: 50 },
        { name: 'runner-stop-latency', value: 30 },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });

    it('should return mixed pass/fail results', () => {
      const results = checkAllBaselines([
        { name: 'runner-start-latency', value: 50 },   // pass
        { name: 'runner-start-latency', value: 999 },  // fail
      ]);

      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });

    it('should return empty array for empty input', () => {
      const results = checkAllBaselines([]);
      expect(results).toEqual([]);
    });

    it('should throw if any baseline name is invalid', () => {
      expect(() =>
        checkAllBaselines([
          { name: 'runner-start-latency', value: 50 },
          { name: 'non-existent', value: 10 },
        ]),
      ).toThrow('Unknown baseline');
    });
  });
});
