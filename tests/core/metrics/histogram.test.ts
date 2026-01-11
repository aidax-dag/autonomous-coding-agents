/**
 * Histogram Metric Tests
 *
 * Feature: F0.7 - Metrics Foundation
 * Tests for histogram metric implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  Histogram,
  MetricType,
} from '../../../src/core/metrics/index.js';

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram({
      name: 'request_duration',
      help: 'Request duration in seconds',
    });
  });

  describe('Construction', () => {
    it('should create histogram with correct properties', () => {
      expect(histogram.name).toBe('request_duration');
      expect(histogram.fullName).toBe('request_duration');
      expect(histogram.type).toBe(MetricType.HISTOGRAM);
      expect(histogram.help).toBe('Request duration in seconds');
      expect(histogram.labelNames).toEqual([]);
    });

    it('should use default buckets when not specified', () => {
      const buckets = histogram.getBuckets();
      // Default buckets plus Infinity
      expect(buckets).toContain(0.005);
      expect(buckets).toContain(0.5);
      expect(buckets).toContain(10);
      expect(buckets).toContain(Infinity);
    });

    it('should use custom buckets', () => {
      const h = new Histogram({
        name: 'custom',
        help: 'Custom histogram',
        buckets: [1, 2, 5, 10],
      });

      const buckets = h.getBuckets();
      expect(buckets).toEqual([1, 2, 5, 10, Infinity]);
    });

    it('should sort buckets', () => {
      const h = new Histogram({
        name: 'unsorted',
        help: 'Unsorted buckets',
        buckets: [5, 1, 10, 2],
      });

      const buckets = h.getBuckets();
      expect(buckets).toEqual([1, 2, 5, 10, Infinity]);
    });

    it('should not duplicate Infinity bucket', () => {
      const h = new Histogram({
        name: 'with_inf',
        help: 'With infinity',
        buckets: [1, 2, Infinity],
      });

      const buckets = h.getBuckets();
      const infCount = buckets.filter((b) => b === Infinity).length;
      expect(infCount).toBe(1);
    });
  });

  describe('observe', () => {
    it('should observe value in correct bucket', () => {
      histogram.observe(0.003); // Should go in 0.005 bucket

      const value = histogram.getHistogramValue();
      expect(value).toBeDefined();
      expect(value!.count).toBe(1);
      expect(value!.sum).toBe(0.003);
      expect(value!.buckets.get(0.005)).toBe(1);
    });

    it('should be cumulative across buckets', () => {
      histogram.observe(0.003); // In all buckets
      histogram.observe(0.5); // In 0.5 and above

      const value = histogram.getHistogramValue();
      expect(value!.buckets.get(0.005)).toBe(1);
      expect(value!.buckets.get(0.5)).toBe(2);
      expect(value!.buckets.get(10)).toBe(2);
      expect(value!.buckets.get(Infinity)).toBe(2);
    });

    it('should track sum and count', () => {
      histogram.observe(1);
      histogram.observe(2);
      histogram.observe(3);

      const value = histogram.getHistogramValue();
      expect(value!.count).toBe(3);
      expect(value!.sum).toBe(6);
    });

    it('should handle values larger than all buckets', () => {
      histogram.observe(100);

      const value = histogram.getHistogramValue();
      expect(value!.buckets.get(Infinity)).toBe(1);
      expect(value!.buckets.get(10)).toBe(0);
    });

    it('should handle negative values', () => {
      histogram.observe(-1);

      const value = histogram.getHistogramValue();
      // Negative values go in smallest bucket and all above
      expect(value!.buckets.get(0.005)).toBe(1);
      expect(value!.sum).toBe(-1);
    });
  });

  describe('startTimer', () => {
    it('should measure elapsed time', async () => {
      const stopTimer = histogram.startTimer();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = stopTimer();

      expect(duration).toBeGreaterThan(0.04);
      expect(duration).toBeLessThan(0.5);

      const value = histogram.getHistogramValue();
      expect(value!.count).toBe(1);
      expect(value!.sum).toBe(duration);
    });
  });

  describe('Labels', () => {
    let labeledHistogram: Histogram;

    beforeEach(() => {
      labeledHistogram = new Histogram({
        name: 'http_request_duration',
        help: 'HTTP request duration',
        labelNames: ['method', 'path'],
        buckets: [0.1, 0.5, 1, 5],
      });
    });

    it('should track values per label set', () => {
      labeledHistogram.observe(0.2, { method: 'GET', path: '/api' });
      labeledHistogram.observe(0.3, { method: 'POST', path: '/api' });
      labeledHistogram.observe(0.4, { method: 'GET', path: '/api' });

      const getValue = labeledHistogram.getHistogramValue({ method: 'GET', path: '/api' });
      const postValue = labeledHistogram.getHistogramValue({ method: 'POST', path: '/api' });

      expect(getValue!.count).toBe(2);
      expect(getValue!.sum).toBeCloseTo(0.6);
      expect(postValue!.count).toBe(1);
      expect(postValue!.sum).toBeCloseTo(0.3);
    });

    it('should reject missing required labels', () => {
      expect(() => labeledHistogram.observe(0.1, { method: 'GET' })).toThrow(
        /Missing required label "path"/
      );
    });

    it('should return undefined for unobserved label combinations', () => {
      expect(labeledHistogram.getHistogramValue({ method: 'DELETE', path: '/admin' })).toBeUndefined();
    });
  });

  describe('getValues', () => {
    it('should return empty array when no observations', () => {
      expect(histogram.getValues()).toEqual([]);
    });

    it('should return values for all label combinations', () => {
      const labeled = new Histogram({
        name: 'test',
        help: 'Test',
        labelNames: ['label'],
        buckets: [1],
      });

      labeled.observe(0.5, { label: 'a' });
      labeled.observe(0.5, { label: 'b' });

      const values = labeled.getValues();
      expect(values).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('should reset all values', () => {
      histogram.observe(0.1);
      histogram.observe(0.2);
      histogram.observe(0.3);

      histogram.reset();

      expect(histogram.getHistogramValue()).toBeUndefined();
      expect(histogram.getValues()).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero observations', () => {
      histogram.observe(0);

      const value = histogram.getHistogramValue();
      expect(value!.count).toBe(1);
      expect(value!.sum).toBe(0);
    });

    it('should handle very small values', () => {
      histogram.observe(0.0001);

      const value = histogram.getHistogramValue();
      expect(value!.count).toBe(1);
      expect(value!.buckets.get(0.005)).toBe(1);
    });

    it('should handle very large values', () => {
      histogram.observe(1000000);

      const value = histogram.getHistogramValue();
      expect(value!.count).toBe(1);
      expect(value!.buckets.get(Infinity)).toBe(1);
    });
  });
});
