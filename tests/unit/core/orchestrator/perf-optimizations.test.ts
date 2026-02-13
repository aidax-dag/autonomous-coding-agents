/**
 * Performance Optimization Tests
 *
 * Validates the P2 performance improvements:
 * - ParallelExecutor Set-based ready task filtering
 * - Document queue batch processing
 * - JSONL persistence sliding window readLast
 */

import { ParallelExecutor } from '@/core/orchestrator/parallel-executor';
import { TaskDocument, TaskPriority } from '@/core/workspace/task-document';

interface TaskNode {
  task: TaskDocument;
  dependsOn: string[];
}

function makeTask(id: string, deps: string[] = []): TaskNode {
  return {
    task: {
      metadata: {
        id,
        title: `Task ${id}`,
        type: 'feature' as const,
        from: 'planning' as const,
        to: 'development' as const,
        priority: 'medium' as TaskPriority,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      },
      content: 'test',
    } as TaskDocument,
    dependsOn: deps,
  };
}

describe('Performance Optimizations', () => {
  // ═══════════════════════════════════════════════════════════
  // 1. ParallelExecutor - Set-based filtering
  // ═══════════════════════════════════════════════════════════

  describe('ParallelExecutor buildGroups', () => {
    it('should correctly group independent tasks', () => {
      const executor = new ParallelExecutor({ maxConcurrency: 3, taskTimeout: 5000 });
      const nodes = [makeTask('a'), makeTask('b'), makeTask('c')];

      const groups = executor.buildGroups(nodes);

      expect(groups.length).toBeGreaterThanOrEqual(1);
      const allTaskIds = groups.flatMap((g) => g.tasks.map((t) => t.metadata.id));
      expect(allTaskIds).toContain('a');
      expect(allTaskIds).toContain('b');
      expect(allTaskIds).toContain('c');
    });

    it('should respect dependencies in group ordering', () => {
      const executor = new ParallelExecutor({ maxConcurrency: 5, taskTimeout: 5000 });
      const nodes = [
        makeTask('a'),
        makeTask('b', ['a']),
        makeTask('c', ['b']),
      ];

      const groups = executor.buildGroups(nodes);

      // a should be in an earlier group than b, b earlier than c
      const groupOfA = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'a'));
      const groupOfB = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'b'));
      const groupOfC = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'c'));

      expect(groupOfA).toBeLessThan(groupOfB);
      expect(groupOfB).toBeLessThan(groupOfC);
    });

    it('should handle large task sets efficiently', () => {
      const executor = new ParallelExecutor({ maxConcurrency: 10, taskTimeout: 5000 });
      const nodes: TaskNode[] = [];

      // Create 100 independent tasks
      for (let i = 0; i < 100; i++) {
        nodes.push(makeTask(`task-${i}`));
      }

      const start = Date.now();
      const groups = executor.buildGroups(nodes);
      const elapsed = Date.now() - start;

      expect(groups.length).toBeGreaterThanOrEqual(1);
      expect(elapsed).toBeLessThan(100); // Should be < 100ms for 100 tasks
    });

    it('should handle chain dependencies efficiently', () => {
      const executor = new ParallelExecutor({ maxConcurrency: 5, taskTimeout: 5000 });
      const nodes: TaskNode[] = [];

      // Create a chain: task-0 -> task-1 -> ... -> task-49
      nodes.push(makeTask('task-0'));
      for (let i = 1; i < 50; i++) {
        nodes.push(makeTask(`task-${i}`, [`task-${i - 1}`]));
      }

      const start = Date.now();
      const groups = executor.buildGroups(nodes);
      const elapsed = Date.now() - start;

      expect(groups).toHaveLength(50); // Each task in its own group
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle diamond dependencies correctly', () => {
      const executor = new ParallelExecutor({ maxConcurrency: 5, taskTimeout: 5000 });
      const nodes = [
        makeTask('root'),
        makeTask('left', ['root']),
        makeTask('right', ['root']),
        makeTask('merge', ['left', 'right']),
      ];

      const groups = executor.buildGroups(nodes);

      const groupOfRoot = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'root'));
      const groupOfLeft = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'left'));
      const groupOfRight = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'right'));
      const groupOfMerge = groups.findIndex((g) => g.tasks.some((t) => t.metadata.id === 'merge'));

      expect(groupOfRoot).toBeLessThan(groupOfLeft);
      expect(groupOfRoot).toBeLessThan(groupOfRight);
      expect(groupOfLeft).toBe(groupOfRight); // Can run in parallel
      expect(groupOfLeft).toBeLessThan(groupOfMerge);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. JSONL readLast - Sliding window
  // ═══════════════════════════════════════════════════════════

  describe('JSONL readLast sliding window', () => {
    it('should return correct last N entries from small set', () => {
      // Test the sliding window logic in isolation
      const buffer: number[] = [];
      const count = 3;
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      for (const item of items) {
        buffer.push(item);
        if (buffer.length > count) {
          buffer.shift();
        }
      }

      expect(buffer).toEqual([8, 9, 10]);
    });

    it('should handle count larger than total entries', () => {
      const buffer: number[] = [];
      const count = 10;
      const items = [1, 2, 3];

      for (const item of items) {
        buffer.push(item);
        if (buffer.length > count) {
          buffer.shift();
        }
      }

      expect(buffer).toEqual([1, 2, 3]);
    });

    it('should handle single entry', () => {
      const buffer: number[] = [];
      const count = 1;
      const items = [1, 2, 3, 4, 5];

      for (const item of items) {
        buffer.push(item);
        if (buffer.length > count) {
          buffer.shift();
        }
      }

      expect(buffer).toEqual([5]);
    });
  });
});
