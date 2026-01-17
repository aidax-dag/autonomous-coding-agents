/**
 * Resource Manager Tests
 *
 * Tests for the Agent OS kernel resource manager.
 */

import {
  ResourceManager,
  createResourceManager,
  ResourceType,
  AllocationStatus,
  AllocationRequest,
} from '../../../../src/core/kernel/resource-manager';

describe('ResourceManager', () => {
  let manager: ResourceManager;

  beforeEach(() => {
    manager = createResourceManager();
  });

  describe('Resource Allocation', () => {
    it('should allocate resources', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      const result = manager.allocate(request);

      expect(result.status).toBe(AllocationStatus.ALLOCATED);
      expect(result.allocatedAmount).toBe(1000);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should deny allocation when quota exceeded', () => {
      // Set a small quota
      manager.setQuota(ResourceType.LLM_TOKENS, 100);

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 200, // More than quota
        priority: 50,
      };

      const result = manager.allocate(request);

      expect(result.status).toBe(AllocationStatus.DENIED);
      expect(result.error).toContain('Insufficient quota');
    });

    it('should commit allocated resources', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      const committed = manager.commit(request.requestId, 800);

      expect(committed).toBe(true);

      const quota = manager.getQuota(ResourceType.LLM_TOKENS);
      expect(quota?.used).toBe(800);
    });

    it('should release allocated resources', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      const released = manager.release(request.requestId);

      expect(released).toBe(true);

      const allocation = manager.getAllocation(request.requestId);
      expect(allocation?.status).toBe(AllocationStatus.RELEASED);
    });
  });

  describe('Quota Management', () => {
    it('should set and get quotas', () => {
      manager.setQuota(ResourceType.TOOL_CALLS, 5000);
      const quota = manager.getQuota(ResourceType.TOOL_CALLS);

      expect(quota?.limit).toBe(5000);
      expect(quota?.used).toBe(0);
    });

    it('should reset quotas', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      manager.commit(request.requestId);

      manager.resetQuota(ResourceType.LLM_TOKENS);
      const quota = manager.getQuota(ResourceType.LLM_TOKENS);

      expect(quota?.used).toBe(0);
    });

    it('should get all quotas', () => {
      const quotas = manager.getAllQuotas();
      expect(quotas.length).toBeGreaterThan(0);
    });
  });

  describe('Cost Management', () => {
    it('should track costs', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      manager.commit(request.requestId);

      const budget = manager.getBudgetStatus();
      expect(budget.totalCost).toBeGreaterThan(0);
    });

    it('should set budget limits', () => {
      manager.setBudget(100);
      const budget = manager.getBudgetStatus();

      expect(budget.budget).toBe(100);
    });

    it('should deny allocation when budget exceeded', () => {
      manager.setBudget(0.001); // Very small budget

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 100000, // Large allocation
        priority: 50,
      };

      const result = manager.allocate(request);
      expect(result.status).toBe(AllocationStatus.DENIED);
      expect(result.error).toBe('Budget exceeded');
    });

    it('should get cost breakdown', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      manager.commit(request.requestId);

      const breakdown = manager.getCostBreakdown();
      expect(breakdown.get(ResourceType.LLM_TOKENS)).toBeGreaterThan(0);
    });
  });

  describe('Resource Pooling', () => {
    it('should create resource pools', () => {
      const pool = manager.createPool('pool-1', 'Test Pool', {
        [ResourceType.LLM_TOKENS]: 50000,
        [ResourceType.TOOL_CALLS]: 1000,
      });

      expect(pool.id).toBe('pool-1');
      expect(pool.name).toBe('Test Pool');
      expect(pool.quotas.get(ResourceType.LLM_TOKENS)?.limit).toBe(50000);
    });

    it('should add and remove pool members', () => {
      manager.createPool('pool-1', 'Test Pool', {
        [ResourceType.LLM_TOKENS]: 50000,
      });

      expect(manager.addPoolMember('pool-1', 'task-1')).toBe(true);
      expect(manager.addPoolMember('pool-1', 'task-2')).toBe(true);

      const pool = manager.getPool('pool-1');
      expect(pool?.members.size).toBe(2);

      expect(manager.removePoolMember('pool-1', 'task-1')).toBe(true);
      expect(pool?.members.size).toBe(1);
    });

    it('should allocate from pools', () => {
      manager.createPool('pool-1', 'Test Pool', {
        [ResourceType.LLM_TOKENS]: 50000,
      });

      manager.addPoolMember('pool-1', 'task-1');

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      const result = manager.allocateFromPool('pool-1', request);
      expect(result.status).toBe(AllocationStatus.ALLOCATED);
    });

    it('should deny pool allocation for non-members in non-shared pools', () => {
      manager.createPool(
        'pool-1',
        'Private Pool',
        { [ResourceType.LLM_TOKENS]: 50000 },
        { sharedAccess: false }
      );

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1', // Not a member
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      const result = manager.allocateFromPool('pool-1', request);
      expect(result.status).toBe(AllocationStatus.DENIED);
      expect(result.error).toBe('Not a pool member');
    });
  });

  describe('Usage Tracking', () => {
    it('should track task usage', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      manager.commit(request.requestId);

      const usage = manager.getTaskUsage('task-1');
      expect(usage.length).toBeGreaterThan(0);
      expect(usage[0].allocated).toBe(1000);
    });

    it('should get usage summary', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      manager.commit(request.requestId);

      const summary = manager.getUsageSummary();
      expect(summary.totalAllocated).toBeGreaterThan(0);
      expect(summary.totalUsed).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    it('should emit allocation events', () => {
      const allocatedHandler = jest.fn();
      const deniedHandler = jest.fn();

      manager.on('resource:allocated', allocatedHandler);
      manager.on('resource:denied', deniedHandler);

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      expect(allocatedHandler).toHaveBeenCalled();
    });

    it('should emit quota exceeded events', () => {
      const quotaExceededHandler = jest.fn();
      manager.on('resource:quota_exceeded', quotaExceededHandler);

      manager.setQuota(ResourceType.LLM_TOKENS, 100);

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 200,
        priority: 50,
      };

      manager.allocate(request);
      expect(quotaExceededHandler).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should get manager statistics', () => {
      manager.createPool('pool-1', 'Test Pool', {
        [ResourceType.LLM_TOKENS]: 50000,
      });

      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);

      const stats = manager.getStats();
      expect(stats.allocations).toBe(1);
      expect(stats.pools).toBe(1);
      expect(stats.quotas).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset manager state', () => {
      const request: AllocationRequest = {
        requestId: manager.generateRequestId(),
        taskId: 'task-1',
        resourceType: ResourceType.LLM_TOKENS,
        amount: 1000,
        priority: 50,
      };

      manager.allocate(request);
      manager.createPool('pool-1', 'Test Pool', {});

      manager.reset();

      const stats = manager.getStats();
      expect(stats.allocations).toBe(0);
      expect(stats.pools).toBe(0);
    });
  });
});
