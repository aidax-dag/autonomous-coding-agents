/**
 * Counter Metric Tests
 *
 * Feature: F0.7 - Metrics Foundation
 * Tests for counter metric implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Counter, MetricType } from '../../../src/core/metrics/index.js';

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter({
      name: 'test_counter',
      help: 'Test counter metric',
    });
  });

  describe('Construction', () => {
    it('should create counter with correct properties', () => {
      expect(counter.name).toBe('test_counter');
      expect(counter.fullName).toBe('test_counter');
      expect(counter.type).toBe(MetricType.COUNTER);
      expect(counter.help).toBe('Test counter metric');
      expect(counter.labelNames).toEqual([]);
    });

    it('should build full name with namespace and subsystem', () => {
      const c = new Counter({
        name: 'requests_total',
        help: 'Total requests',
        namespace: 'myapp',
        subsystem: 'http',
      });

      expect(c.fullName).toBe('myapp_http_requests_total');
    });

    it('should reject invalid metric names', () => {
      expect(() => new Counter({
        name: '123invalid',
        help: 'Invalid name',
      })).toThrow(/Invalid metric name/);
    });

    it('should reject invalid label names', () => {
      expect(() => new Counter({
        name: 'valid_name',
        help: 'Valid',
        labelNames: ['invalid-label'],
      })).toThrow(/Invalid label name/);
    });

    it('should reject reserved label names', () => {
      expect(() => new Counter({
        name: 'valid_name',
        help: 'Valid',
        labelNames: ['__reserved'],
      })).toThrow(/reserved/);
    });
  });

  describe('Increment', () => {
    it('should start at 0', () => {
      expect(counter.get()).toBe(0);
    });

    it('should increment by 1 by default', () => {
      counter.inc();
      expect(counter.get()).toBe(1);
    });

    it('should increment by specified value', () => {
      counter.inc(5);
      expect(counter.get()).toBe(5);
    });

    it('should accumulate increments', () => {
      counter.inc(3);
      counter.inc(2);
      counter.inc();
      expect(counter.get()).toBe(6);
    });

    it('should reject negative increments', () => {
      expect(() => counter.inc(-1)).toThrow(/positive values/);
    });

    it('should allow zero increment', () => {
      counter.inc(0);
      expect(counter.get()).toBe(0);
    });
  });

  describe('Labels', () => {
    let labeledCounter: Counter;

    beforeEach(() => {
      labeledCounter = new Counter({
        name: 'http_requests_total',
        help: 'Total HTTP requests',
        labelNames: ['method', 'status'],
      });
    });

    it('should track values per label set', () => {
      labeledCounter.inc({ method: 'GET', status: '200' });
      labeledCounter.inc({ method: 'POST', status: '200' });
      labeledCounter.inc({ method: 'GET', status: '200' });
      labeledCounter.inc({ method: 'GET', status: '404' });

      expect(labeledCounter.get({ method: 'GET', status: '200' })).toBe(2);
      expect(labeledCounter.get({ method: 'POST', status: '200' })).toBe(1);
      expect(labeledCounter.get({ method: 'GET', status: '404' })).toBe(1);
    });

    it('should increment with labels and value', () => {
      labeledCounter.inc(5, { method: 'GET', status: '200' });
      expect(labeledCounter.get({ method: 'GET', status: '200' })).toBe(5);
    });

    it('should reject missing required labels', () => {
      expect(() => labeledCounter.inc({ method: 'GET' })).toThrow(
        /Missing required label "status"/
      );
    });

    it('should reject unexpected labels', () => {
      expect(() => labeledCounter.inc({ method: 'GET', status: '200', extra: 'value' })).toThrow(
        /Unexpected label "extra"/
      );
    });

    it('should return 0 for unset label combinations', () => {
      expect(labeledCounter.get({ method: 'DELETE', status: '500' })).toBe(0);
    });
  });

  describe('getValues', () => {
    it('should return empty array when no values', () => {
      expect(counter.getValues()).toEqual([]);
    });

    it('should return all values', () => {
      const labeled = new Counter({
        name: 'test',
        help: 'Test',
        labelNames: ['label'],
      });

      labeled.inc(3, { label: 'a' });
      labeled.inc(5, { label: 'b' });

      const values = labeled.getValues();
      expect(values).toHaveLength(2);
      expect(values.find(v => v.labels.label === 'a')?.value).toBe(3);
      expect(values.find(v => v.labels.label === 'b')?.value).toBe(5);
    });

    it('should include timestamp', () => {
      counter.inc();
      const values = counter.getValues();
      expect(values[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('reset', () => {
    it('should reset all values', () => {
      const labeled = new Counter({
        name: 'test',
        help: 'Test',
        labelNames: ['label'],
      });

      labeled.inc(3, { label: 'a' });
      labeled.inc(5, { label: 'b' });

      labeled.reset();

      expect(labeled.get({ label: 'a' })).toBe(0);
      expect(labeled.get({ label: 'b' })).toBe(0);
      expect(labeled.getValues()).toEqual([]);
    });
  });
});
