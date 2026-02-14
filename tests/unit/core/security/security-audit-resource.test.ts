/**
 * Security Audit: Resource Limiter
 *
 * Validates security properties of the resource limiting system.
 * Tests focus on limit enforcement, boundary conditions, and
 * prevention of resource exhaustion attacks.
 *
 * @module tests/unit/core/security/security-audit-resource
 */

import {
  ResourceLimiter,
  createResourceLimiter,
} from '../../../../src/core/security/resource-limiter';
import {
  SandboxLevel,
} from '../../../../src/core/security/index';
import {
  createSandboxEscalation,
} from '../../../../src/core/security/sandbox-escalation';

describe('Security Audit: Resource Limiter', () => {
  let limiter: ResourceLimiter;

  beforeEach(() => {
    limiter = createResourceLimiter();
  });

  // ==========================================================================
  // Memory Limit Enforcement
  // ==========================================================================

  describe('memory limit enforcement', () => {
    it('should deny memory usage exceeding the configured limit', () => {
      limiter.setMemoryLimit(512);
      expect(limiter.checkMemory(513)).toBe(false);
      expect(limiter.checkMemory(1024)).toBe(false);
    });

    it('should allow memory usage at exactly the configured limit', () => {
      limiter.setMemoryLimit(512);
      expect(limiter.checkMemory(512)).toBe(true);
    });

    it('should allow memory usage below the configured limit', () => {
      limiter.setMemoryLimit(512);
      expect(limiter.checkMemory(0)).toBe(true);
      expect(limiter.checkMemory(256)).toBe(true);
      expect(limiter.checkMemory(511)).toBe(true);
    });

    it('should allow any memory usage when no limit is set', () => {
      expect(limiter.checkMemory(999999)).toBe(true);
    });

    it('should reject non-positive memory limit values', () => {
      expect(() => limiter.setMemoryLimit(0)).toThrow('positive number');
      expect(() => limiter.setMemoryLimit(-1)).toThrow('positive number');
      expect(() => limiter.setMemoryLimit(-100)).toThrow('positive number');
    });

    it('should accept very small positive memory limits', () => {
      limiter.setMemoryLimit(0.1);
      expect(limiter.checkMemory(0.1)).toBe(true);
      expect(limiter.checkMemory(0.2)).toBe(false);
    });
  });

  // ==========================================================================
  // CPU Limit Enforcement
  // ==========================================================================

  describe('CPU limit enforcement', () => {
    it('should deny CPU usage exceeding the configured limit', () => {
      limiter.setCpuLimit(80);
      expect(limiter.checkCpu(81)).toBe(false);
      expect(limiter.checkCpu(100)).toBe(false);
    });

    it('should allow CPU usage at exactly the configured limit', () => {
      limiter.setCpuLimit(80);
      expect(limiter.checkCpu(80)).toBe(true);
    });

    it('should allow CPU usage below the configured limit', () => {
      limiter.setCpuLimit(80);
      expect(limiter.checkCpu(0)).toBe(true);
      expect(limiter.checkCpu(50)).toBe(true);
      expect(limiter.checkCpu(79)).toBe(true);
    });

    it('should allow any CPU usage when no limit is set', () => {
      expect(limiter.checkCpu(100)).toBe(true);
    });

    it('should reject CPU limit values outside valid range', () => {
      expect(() => limiter.setCpuLimit(0)).toThrow('between 0');
      expect(() => limiter.setCpuLimit(-10)).toThrow('between 0');
      expect(() => limiter.setCpuLimit(101)).toThrow('between 0');
    });

    it('should accept maximum CPU limit of 100%', () => {
      limiter.setCpuLimit(100);
      expect(limiter.checkCpu(100)).toBe(true);
      expect(limiter.checkCpu(101)).toBe(false);
    });

    it('should accept minimum valid CPU limit', () => {
      limiter.setCpuLimit(0.1);
      expect(limiter.checkCpu(0.1)).toBe(true);
      expect(limiter.checkCpu(0.2)).toBe(false);
    });
  });

  // ==========================================================================
  // Timeout Enforcement
  // ==========================================================================

  describe('timeout enforcement', () => {
    it('should store timeout value correctly', () => {
      limiter.setTimeout(30000);
      expect(limiter.getLimits().timeoutMs).toBe(30000);
    });

    it('should reject non-positive timeout values', () => {
      expect(() => limiter.setTimeout(0)).toThrow('positive number');
      expect(() => limiter.setTimeout(-1)).toThrow('positive number');
      expect(() => limiter.setTimeout(-5000)).toThrow('positive number');
    });

    it('should accept very small positive timeout values', () => {
      limiter.setTimeout(1);
      expect(limiter.getLimits().timeoutMs).toBe(1);
    });

    it('should accept large timeout values', () => {
      limiter.setTimeout(600000); // 10 minutes
      expect(limiter.getLimits().timeoutMs).toBe(600000);
    });
  });

  // ==========================================================================
  // Concurrent Operation Limits per Sandbox Level
  // ==========================================================================

  describe('concurrent operation limits per sandbox level', () => {
    it('should enforce maxConcurrentOps=1 at RESTRICTED level', () => {
      const sandbox = createSandboxEscalation({ initialLevel: SandboxLevel.RESTRICTED });
      const perms = sandbox.getPermissions();
      expect(perms.maxConcurrentOps).toBe(1);
    });

    it('should enforce maxConcurrentOps=3 at MONITORED level', () => {
      const sandbox = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
      const perms = sandbox.getPermissions();
      expect(perms.maxConcurrentOps).toBe(3);
    });

    it('should enforce maxConcurrentOps=5 at STANDARD level', () => {
      const sandbox = createSandboxEscalation({ initialLevel: SandboxLevel.STANDARD });
      const perms = sandbox.getPermissions();
      expect(perms.maxConcurrentOps).toBe(5);
    });

    it('should enforce maxConcurrentOps=10 at ELEVATED level', () => {
      const sandbox = createSandboxEscalation({ initialLevel: SandboxLevel.ELEVATED });
      const perms = sandbox.getPermissions();
      expect(perms.maxConcurrentOps).toBe(10);
    });

    it('should have increasing concurrent operation limits as levels escalate', () => {
      const levels = [
        SandboxLevel.RESTRICTED,
        SandboxLevel.MONITORED,
        SandboxLevel.STANDARD,
        SandboxLevel.ELEVATED,
      ];

      const limits = levels.map(level => {
        const sandbox = createSandboxEscalation({ initialLevel: level });
        return sandbox.getPermissions().maxConcurrentOps;
      });

      for (let i = 1; i < limits.length; i++) {
        expect(limits[i]).toBeGreaterThan(limits[i - 1]);
      }
    });
  });

  // ==========================================================================
  // Execution Time Limits per Sandbox Level
  // ==========================================================================

  describe('execution time limits per sandbox level', () => {
    it('should enforce shortest maxExecutionTime at RESTRICTED level', () => {
      const sandbox = createSandboxEscalation({ initialLevel: SandboxLevel.RESTRICTED });
      const perms = sandbox.getPermissions();
      expect(perms.maxExecutionTime).toBe(30_000);
    });

    it('should have increasing maxExecutionTime as levels escalate', () => {
      const levels = [
        SandboxLevel.RESTRICTED,
        SandboxLevel.MONITORED,
        SandboxLevel.STANDARD,
        SandboxLevel.ELEVATED,
      ];

      const times = levels.map(level => {
        const sandbox = createSandboxEscalation({ initialLevel: level });
        return sandbox.getPermissions().maxExecutionTime;
      });

      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
      }
    });
  });

  // ==========================================================================
  // Resource Exhaustion Handling
  // ==========================================================================

  describe('resource exhaustion handling', () => {
    it('should correctly report limit breach at exact boundary', () => {
      limiter.setMemoryLimit(256);
      limiter.setCpuLimit(50);

      // At boundary -> allowed
      expect(limiter.checkMemory(256)).toBe(true);
      expect(limiter.checkCpu(50)).toBe(true);

      // Just over boundary -> denied
      expect(limiter.checkMemory(256.01)).toBe(false);
      expect(limiter.checkCpu(50.01)).toBe(false);
    });

    it('should allow changing limits after initial configuration', () => {
      limiter.setMemoryLimit(256);
      expect(limiter.checkMemory(300)).toBe(false);

      limiter.setMemoryLimit(512);
      expect(limiter.checkMemory(300)).toBe(true);
    });

    it('should independently track memory and CPU limits', () => {
      limiter.setMemoryLimit(512);
      limiter.setCpuLimit(80);

      // Memory over but CPU under -> memory check fails
      expect(limiter.checkMemory(600)).toBe(false);
      expect(limiter.checkCpu(50)).toBe(true);

      // Memory under but CPU over -> CPU check fails
      expect(limiter.checkMemory(400)).toBe(true);
      expect(limiter.checkCpu(90)).toBe(false);
    });
  });

  // ==========================================================================
  // Factory Function
  // ==========================================================================

  describe('factory creates clean instances', () => {
    it('should create a limiter with no preconfigured limits', () => {
      const fresh = createResourceLimiter();
      const limits = fresh.getLimits();
      expect(limits.memoryMB).toBeNull();
      expect(limits.cpuPercent).toBeNull();
      expect(limits.timeoutMs).toBeNull();
    });

    it('should create independent instances that do not share state', () => {
      const limiter1 = createResourceLimiter();
      const limiter2 = createResourceLimiter();

      limiter1.setMemoryLimit(256);
      limiter2.setMemoryLimit(1024);

      expect(limiter1.getLimits().memoryMB).toBe(256);
      expect(limiter2.getLimits().memoryMB).toBe(1024);
    });
  });
});
