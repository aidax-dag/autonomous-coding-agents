/**
 * Gauge Metric Tests
 *
 * Feature: F0.7 - Metrics Foundation
 * Tests for gauge metric implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Gauge, MetricType } from '../../../src/core/metrics/index.js';

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge({
      name: 'test_gauge',
      help: 'Test gauge metric',
    });
  });

  describe('Construction', () => {
    it('should create gauge with correct properties', () => {
      expect(gauge.name).toBe('test_gauge');
      expect(gauge.fullName).toBe('test_gauge');
      expect(gauge.type).toBe(MetricType.GAUGE);
      expect(gauge.help).toBe('Test gauge metric');
      expect(gauge.labelNames).toEqual([]);
    });

    it('should build full name with namespace and subsystem', () => {
      const g = new Gauge({
        name: 'connections_active',
        help: 'Active connections',
        namespace: 'myapp',
        subsystem: 'db',
      });

      expect(g.fullName).toBe('myapp_db_connections_active');
    });
  });

  describe('set', () => {
    it('should set gauge value', () => {
      gauge.set(42);
      expect(gauge.get()).toBe(42);
    });

    it('should overwrite previous value', () => {
      gauge.set(10);
      gauge.set(20);
      expect(gauge.get()).toBe(20);
    });

    it('should allow negative values', () => {
      gauge.set(-5);
      expect(gauge.get()).toBe(-5);
    });

    it('should allow decimal values', () => {
      gauge.set(3.14159);
      expect(gauge.get()).toBe(3.14159);
    });
  });

  describe('inc', () => {
    it('should start at 0', () => {
      expect(gauge.get()).toBe(0);
    });

    it('should increment by 1 by default', () => {
      gauge.inc();
      expect(gauge.get()).toBe(1);
    });

    it('should increment by specified value', () => {
      gauge.inc(5);
      expect(gauge.get()).toBe(5);
    });

    it('should allow negative increments', () => {
      gauge.inc(-3);
      expect(gauge.get()).toBe(-3);
    });

    it('should accumulate increments', () => {
      gauge.inc(3);
      gauge.inc(2);
      gauge.inc();
      expect(gauge.get()).toBe(6);
    });
  });

  describe('dec', () => {
    it('should decrement by 1 by default', () => {
      gauge.set(10);
      gauge.dec();
      expect(gauge.get()).toBe(9);
    });

    it('should decrement by specified value', () => {
      gauge.set(10);
      gauge.dec(3);
      expect(gauge.get()).toBe(7);
    });

    it('should allow going negative', () => {
      gauge.dec(5);
      expect(gauge.get()).toBe(-5);
    });
  });

  describe('setToCurrentTime', () => {
    it('should set gauge to current Unix timestamp', () => {
      const before = Date.now() / 1000;
      gauge.setToCurrentTime();
      const after = Date.now() / 1000;

      const value = gauge.get();
      expect(value).toBeGreaterThanOrEqual(before);
      expect(value).toBeLessThanOrEqual(after);
    });
  });

  describe('startTimer', () => {
    it('should measure elapsed time', async () => {
      const stopTimer = gauge.startTimer();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = stopTimer();

      expect(duration).toBeGreaterThan(0.04); // At least 40ms
      expect(duration).toBeLessThan(0.5); // Less than 500ms
      expect(gauge.get()).toBe(duration);
    });

    it('should return duration in seconds', async () => {
      const stopTimer = gauge.startTimer();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const duration = stopTimer();

      expect(duration).toBeLessThan(1); // Should be fraction of second
    });
  });

  describe('Labels', () => {
    let labeledGauge: Gauge;

    beforeEach(() => {
      labeledGauge = new Gauge({
        name: 'connections',
        help: 'Active connections',
        labelNames: ['pool', 'state'],
      });
    });

    it('should track values per label set', () => {
      labeledGauge.set(10, { pool: 'read', state: 'active' });
      labeledGauge.set(5, { pool: 'write', state: 'active' });
      labeledGauge.set(2, { pool: 'read', state: 'idle' });

      expect(labeledGauge.get({ pool: 'read', state: 'active' })).toBe(10);
      expect(labeledGauge.get({ pool: 'write', state: 'active' })).toBe(5);
      expect(labeledGauge.get({ pool: 'read', state: 'idle' })).toBe(2);
    });

    it('should increment with labels', () => {
      labeledGauge.inc({ pool: 'read', state: 'active' });
      labeledGauge.inc(5, { pool: 'read', state: 'active' });

      expect(labeledGauge.get({ pool: 'read', state: 'active' })).toBe(6);
    });

    it('should decrement with labels', () => {
      labeledGauge.set(10, { pool: 'read', state: 'active' });
      labeledGauge.dec({ pool: 'read', state: 'active' });

      expect(labeledGauge.get({ pool: 'read', state: 'active' })).toBe(9);
    });

    it('should reject missing required labels', () => {
      expect(() => labeledGauge.set(10, { pool: 'read' })).toThrow(
        /Missing required label "state"/
      );
    });

    it('should reject unexpected labels', () => {
      expect(() => labeledGauge.set(10, { pool: 'read', state: 'active', extra: 'value' })).toThrow(
        /Unexpected label "extra"/
      );
    });
  });

  describe('getValues', () => {
    it('should return empty array when no values', () => {
      expect(gauge.getValues()).toEqual([]);
    });

    it('should return all values', () => {
      const labeled = new Gauge({
        name: 'test',
        help: 'Test',
        labelNames: ['label'],
      });

      labeled.set(10, { label: 'a' });
      labeled.set(20, { label: 'b' });

      const values = labeled.getValues();
      expect(values).toHaveLength(2);
      expect(values.find(v => v.labels.label === 'a')?.value).toBe(10);
      expect(values.find(v => v.labels.label === 'b')?.value).toBe(20);
    });
  });

  describe('reset', () => {
    it('should reset all values', () => {
      const labeled = new Gauge({
        name: 'test',
        help: 'Test',
        labelNames: ['label'],
      });

      labeled.set(10, { label: 'a' });
      labeled.set(20, { label: 'b' });

      labeled.reset();

      expect(labeled.get({ label: 'a' })).toBe(0);
      expect(labeled.get({ label: 'b' })).toBe(0);
      expect(labeled.getValues()).toEqual([]);
    });
  });
});
