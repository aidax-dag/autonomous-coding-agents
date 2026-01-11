/**
 * Context Manager Tests
 *
 * Feature: F0.4 - Logger Refactor
 * Tests for AsyncLocalStorage-based context propagation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ContextManager,
  getContextManager,
  resetContextManager,
  ContextPropagation,
} from '../../../src/core/logging/context-manager.js';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  afterEach(() => {
    contextManager.dispose();
  });

  describe('getContext', () => {
    it('should return empty object when no context is set', () => {
      const context = contextManager.getContext();
      expect(context).toEqual({});
    });

    it('should return current context after setContext', () => {
      contextManager.setContext({ requestId: 'req-123' });
      const context = contextManager.getContext();
      expect(context.requestId).toBe('req-123');
    });
  });

  describe('setContext', () => {
    it('should set context for current scope', () => {
      contextManager.setContext({ agentId: 'agent-1' });
      expect(contextManager.getContext().agentId).toBe('agent-1');
    });

    it('should merge context when called multiple times', () => {
      contextManager.setContext({ requestId: 'req-1' });
      contextManager.setContext({ agentId: 'agent-1' });

      const context = contextManager.getContext();
      expect(context.requestId).toBe('req-1');
      expect(context.agentId).toBe('agent-1');
    });
  });

  describe('runWithContext', () => {
    it('should provide context within function scope', () => {
      const result = contextManager.runWithContext(
        { taskId: 'task-1' },
        () => {
          return contextManager.getContext();
        }
      );

      expect(result.taskId).toBe('task-1');
    });

    it('should merge with existing context', () => {
      contextManager.setContext({ requestId: 'req-1' });

      const result = contextManager.runWithContext(
        { taskId: 'task-1' },
        () => contextManager.getContext()
      );

      expect(result.requestId).toBe('req-1');
      expect(result.taskId).toBe('task-1');
    });

    it('should isolate context between runs', () => {
      const context1 = contextManager.runWithContext(
        { taskId: 'task-1' },
        () => contextManager.getContext()
      );

      const context2 = contextManager.runWithContext(
        { taskId: 'task-2' },
        () => contextManager.getContext()
      );

      expect(context1.taskId).toBe('task-1');
      expect(context2.taskId).toBe('task-2');
    });

    it('should support nested contexts', () => {
      const result = contextManager.runWithContext(
        { requestId: 'req-1' },
        () => {
          return contextManager.runWithContext(
            { taskId: 'task-1' },
            () => contextManager.getContext()
          );
        }
      );

      expect(result.requestId).toBe('req-1');
      expect(result.taskId).toBe('task-1');
    });
  });

  describe('runWithContextAsync', () => {
    it('should provide context in async functions', async () => {
      const result = await contextManager.runWithContextAsync(
        { taskId: 'async-task' },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return contextManager.getContext();
        }
      );

      expect(result.taskId).toBe('async-task');
    });

    it('should maintain context across await points', async () => {
      const result = await contextManager.runWithContextAsync(
        { workflowId: 'wf-1' },
        async () => {
          const before = contextManager.getContext();
          await new Promise((resolve) => setTimeout(resolve, 5));
          const after = contextManager.getContext();
          return { before, after };
        }
      );

      expect(result.before.workflowId).toBe('wf-1');
      expect(result.after.workflowId).toBe('wf-1');
    });

    it('should support parallel async operations', async () => {
      const results = await Promise.all([
        contextManager.runWithContextAsync(
          { taskId: 'task-1' },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return contextManager.getContext();
          }
        ),
        contextManager.runWithContextAsync(
          { taskId: 'task-2' },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return contextManager.getContext();
          }
        ),
      ]);

      expect(results[0].taskId).toBe('task-1');
      expect(results[1].taskId).toBe('task-2');
    });
  });

  describe('mergeContext', () => {
    it('should merge new fields into existing context', () => {
      contextManager.setContext({ requestId: 'req-1' });
      contextManager.mergeContext({ agentId: 'agent-1' });

      const context = contextManager.getContext();
      expect(context.requestId).toBe('req-1');
      expect(context.agentId).toBe('agent-1');
    });

    it('should override existing fields', () => {
      contextManager.setContext({ requestId: 'req-1' });
      contextManager.mergeContext({ requestId: 'req-2' });

      expect(contextManager.getContext().requestId).toBe('req-2');
    });
  });

  describe('clearContext', () => {
    it('should clear all context', () => {
      contextManager.setContext({
        requestId: 'req-1',
        agentId: 'agent-1',
      });

      contextManager.clearContext();

      expect(contextManager.getContext()).toEqual({});
    });
  });

  describe('ID generation', () => {
    it('should create unique request IDs', () => {
      const id1 = contextManager.createRequestId();
      const id2 = contextManager.createRequestId();

      expect(id1).toMatch(/^req_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^req_[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });

    it('should create unique trace IDs', () => {
      const id1 = contextManager.createTraceId();
      const id2 = contextManager.createTraceId();

      expect(id1).toMatch(/^[a-f0-9]{32}$/);
      expect(id2).toMatch(/^[a-f0-9]{32}$/);
      expect(id1).not.toBe(id2);
    });

    it('should create unique span IDs', () => {
      const id1 = contextManager.createSpanId();
      const id2 = contextManager.createSpanId();

      expect(id1).toMatch(/^[a-f0-9]{16}$/);
      expect(id2).toMatch(/^[a-f0-9]{16}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('dispose', () => {
    it('should throw error after disposal', () => {
      contextManager.dispose();

      expect(() => contextManager.getContext()).toThrow(
        'ContextManager has been disposed'
      );
      expect(() => contextManager.setContext({})).toThrow(
        'ContextManager has been disposed'
      );
    });
  });
});

describe('Global Context Manager', () => {
  afterEach(() => {
    resetContextManager();
  });

  it('should return singleton instance', () => {
    const cm1 = getContextManager();
    const cm2 = getContextManager();
    expect(cm1).toBe(cm2);
  });

  it('should create new instance after reset', () => {
    const cm1 = getContextManager();
    resetContextManager();
    const cm2 = getContextManager();
    expect(cm1).not.toBe(cm2);
  });
});

describe('ContextPropagation', () => {
  afterEach(() => {
    resetContextManager();
  });

  describe('wrap', () => {
    it('should wrap function with context', () => {
      const context = { requestId: 'req-wrap' };
      const fn = () => getContextManager().getContext();
      const wrapped = ContextPropagation.wrap(context, fn);

      const result = wrapped();
      expect(result.requestId).toBe('req-wrap');
    });

    it('should preserve function arguments', () => {
      const context = { taskId: 'task-1' };
      const fn = (a: unknown, b: unknown) => (a as number) + (b as number);
      const wrapped = ContextPropagation.wrap(context, fn);

      expect(wrapped(2, 3)).toBe(5);
    });
  });

  describe('wrapAsync', () => {
    it('should wrap async function with context', async () => {
      const context = { requestId: 'req-async' };
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getContextManager().getContext();
      };
      const wrapped = ContextPropagation.wrapAsync(context, fn);

      const result = await wrapped();
      expect(result.requestId).toBe('req-async');
    });
  });

  describe('forAgent', () => {
    it('should create agent context with spanId', () => {
      const context = ContextPropagation.forAgent('orchestrator', 'agent-123');

      expect(context.agentType).toBe('orchestrator');
      expect(context.agentId).toBe('agent-123');
      expect(context.spanId).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('forTask', () => {
    it('should create task context with optional type', () => {
      const context = ContextPropagation.forTask('task-456', 'analysis');

      expect(context.taskId).toBe('task-456');
      expect(context.operation).toBe('analysis');
      expect(context.spanId).toBeDefined();
    });
  });

  describe('forWorkflow', () => {
    it('should create workflow context', () => {
      const context = ContextPropagation.forWorkflow('wf-1', 'exec-1');

      expect(context.workflowId).toBe('wf-1');
      expect(context.executionId).toBe('exec-1');
      expect(context.spanId).toBeDefined();
    });
  });

  describe('forTool', () => {
    it('should create tool context', () => {
      const context = ContextPropagation.forTool('code_search');

      expect(context.toolName).toBe('code_search');
      expect(context.spanId).toBeDefined();
    });
  });

  describe('forHook', () => {
    it('should create hook context', () => {
      const context = ContextPropagation.forHook('pre_execute');

      expect(context.hookName).toBe('pre_execute');
      expect(context.spanId).toBeDefined();
    });
  });

  describe('forRequest', () => {
    it('should create request context with trace and span', () => {
      const context = ContextPropagation.forRequest('req-789', 'POST', '/api/tasks');

      expect(context.requestId).toBe('req-789');
      expect(context.operation).toBe('POST /api/tasks');
      expect(context.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(context.spanId).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});
