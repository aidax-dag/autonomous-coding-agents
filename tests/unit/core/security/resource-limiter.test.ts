/**
 * Tests for Resource Limiter
 */

import {
  ResourceLimiter,
  createResourceLimiter,
} from '@/core/security/resource-limiter';

describe('ResourceLimiter', () => {
  let limiter: ResourceLimiter;

  beforeEach(() => {
    limiter = new ResourceLimiter();
  });

  describe('default state', () => {
    it('should have no limits set by default', () => {
      const limits = limiter.getLimits();
      expect(limits.memoryMB).toBeNull();
      expect(limits.cpuPercent).toBeNull();
      expect(limits.timeoutMs).toBeNull();
    });
  });

  describe('setMemoryLimit', () => {
    it('should set a memory limit', () => {
      limiter.setMemoryLimit(512);
      expect(limiter.getLimits().memoryMB).toBe(512);
    });

    it('should throw on non-positive value', () => {
      expect(() => limiter.setMemoryLimit(0)).toThrow('positive number');
      expect(() => limiter.setMemoryLimit(-1)).toThrow('positive number');
    });
  });

  describe('setCpuLimit', () => {
    it('should set a CPU limit', () => {
      limiter.setCpuLimit(80);
      expect(limiter.getLimits().cpuPercent).toBe(80);
    });

    it('should accept 100%', () => {
      limiter.setCpuLimit(100);
      expect(limiter.getLimits().cpuPercent).toBe(100);
    });

    it('should throw on out-of-range values', () => {
      expect(() => limiter.setCpuLimit(0)).toThrow('between 0');
      expect(() => limiter.setCpuLimit(-10)).toThrow('between 0');
      expect(() => limiter.setCpuLimit(101)).toThrow('between 0');
    });
  });

  describe('setTimeout', () => {
    it('should set a timeout', () => {
      limiter.setTimeout(30000);
      expect(limiter.getLimits().timeoutMs).toBe(30000);
    });

    it('should throw on non-positive value', () => {
      expect(() => limiter.setTimeout(0)).toThrow('positive number');
      expect(() => limiter.setTimeout(-100)).toThrow('positive number');
    });
  });

  describe('getLimits', () => {
    it('should return all configured limits', () => {
      limiter.setMemoryLimit(256);
      limiter.setCpuLimit(50);
      limiter.setTimeout(60000);

      const limits = limiter.getLimits();
      expect(limits).toEqual({
        memoryMB: 256,
        cpuPercent: 50,
        timeoutMs: 60000,
      });
    });
  });

  describe('checkMemory', () => {
    it('should return true when no limit is set', () => {
      expect(limiter.checkMemory(9999)).toBe(true);
    });

    it('should return true when within limit', () => {
      limiter.setMemoryLimit(512);
      expect(limiter.checkMemory(256)).toBe(true);
      expect(limiter.checkMemory(512)).toBe(true);
    });

    it('should return false when exceeding limit', () => {
      limiter.setMemoryLimit(512);
      expect(limiter.checkMemory(513)).toBe(false);
    });
  });

  describe('checkCpu', () => {
    it('should return true when no limit is set', () => {
      expect(limiter.checkCpu(100)).toBe(true);
    });

    it('should return true when within limit', () => {
      limiter.setCpuLimit(80);
      expect(limiter.checkCpu(50)).toBe(true);
      expect(limiter.checkCpu(80)).toBe(true);
    });

    it('should return false when exceeding limit', () => {
      limiter.setCpuLimit(80);
      expect(limiter.checkCpu(81)).toBe(false);
    });
  });

  describe('factory', () => {
    it('should create a ResourceLimiter via factory', () => {
      const rl = createResourceLimiter();
      expect(rl).toBeInstanceOf(ResourceLimiter);
      expect(rl.getLimits()).toEqual({
        memoryMB: null,
        cpuPercent: null,
        timeoutMs: null,
      });
    });
  });
});
