/**
 * Task Document Tests
 */

import {
  TaskPrioritySchema,
  TaskStatusSchema,
  TeamTypeSchema,
  TaskTypeSchema,
  TaskMetadataSchema,
  TaskDocumentSchema,
  CreateTaskInputSchema,
  TaskFilterSchema,
  generateTaskId,
  createTask,
  updateTaskStatus,
  hasUnmetDependencies,
  canRetry,
  incrementRetry,
} from '../../../../src/core/workspace/task-document';

// ============================================================================
// Schema Validation
// ============================================================================

describe('TaskPrioritySchema', () => {
  it('should accept valid priorities', () => {
    for (const p of ['critical', 'high', 'medium', 'low']) {
      expect(TaskPrioritySchema.parse(p)).toBe(p);
    }
  });

  it('should reject invalid priorities', () => {
    expect(() => TaskPrioritySchema.parse('urgent')).toThrow();
  });
});

describe('TaskStatusSchema', () => {
  it('should accept valid statuses', () => {
    for (const s of ['pending', 'in_progress', 'blocked', 'completed', 'failed', 'cancelled']) {
      expect(TaskStatusSchema.parse(s)).toBe(s);
    }
  });
});

describe('TeamTypeSchema', () => {
  it('should accept valid team types', () => {
    const valid = ['orchestrator', 'planning', 'development', 'qa', 'code-quality'];
    for (const t of valid) {
      expect(TeamTypeSchema.parse(t)).toBe(t);
    }
  });
});

describe('TaskTypeSchema', () => {
  it('should accept valid task types', () => {
    const valid = ['feature', 'bugfix', 'refactor', 'test', 'review', 'documentation'];
    for (const t of valid) {
      expect(TaskTypeSchema.parse(t)).toBe(t);
    }
  });
});

describe('TaskMetadataSchema', () => {
  const validMetadata = {
    id: 'task_123',
    title: 'Test Task',
    type: 'feature',
    from: 'orchestrator',
    to: 'development',
    createdAt: new Date().toISOString(),
  };

  it('should validate minimal metadata', () => {
    const result = TaskMetadataSchema.parse(validMetadata);
    expect(result.id).toBe('task_123');
    expect(result.priority).toBe('medium'); // default
    expect(result.status).toBe('pending'); // default
    expect(result.retryCount).toBe(0); // default
    expect(result.maxRetries).toBe(3); // default
    expect(result.dependencies).toEqual([]); // default
    expect(result.tags).toEqual([]); // default
  });

  it('should reject empty id', () => {
    expect(() => TaskMetadataSchema.parse({ ...validMetadata, id: '' })).toThrow();
  });

  it('should reject invalid createdAt', () => {
    expect(() => TaskMetadataSchema.parse({ ...validMetadata, createdAt: 'not a date' })).toThrow();
  });
});

describe('TaskDocumentSchema', () => {
  it('should validate document with metadata and content', () => {
    const doc = TaskDocumentSchema.parse({
      metadata: {
        id: 'task_1',
        title: 'Task',
        type: 'feature',
        from: 'orchestrator',
        to: 'development',
        createdAt: new Date().toISOString(),
      },
      content: '# Task Description',
    });
    expect(doc.content).toBe('# Task Description');
  });
});

describe('CreateTaskInputSchema', () => {
  it('should validate minimal input', () => {
    const result = CreateTaskInputSchema.parse({
      title: 'My Task',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    expect(result.title).toBe('My Task');
    expect(result.priority).toBe('medium');
    expect(result.content).toBe('');
  });
});

describe('TaskFilterSchema', () => {
  it('should validate empty filter', () => {
    expect(TaskFilterSchema.parse({})).toBeDefined();
  });

  it('should validate filter with arrays', () => {
    const result = TaskFilterSchema.parse({
      status: ['pending', 'in_progress'],
      priority: ['high'],
      tags: ['urgent'],
    });
    expect(result.status).toEqual(['pending', 'in_progress']);
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe('generateTaskId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateTaskId();
    const id2 = generateTaskId();
    expect(id1).not.toBe(id2);
  });

  it('should start with task_ prefix', () => {
    expect(generateTaskId()).toMatch(/^task_/);
  });
});

describe('createTask', () => {
  it('should create task with required fields', () => {
    const task = createTask({
      title: 'Implement auth',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    expect(task.metadata.title).toBe('Implement auth');
    expect(task.metadata.type).toBe('feature');
    expect(task.metadata.status).toBe('pending');
    expect(task.metadata.id).toMatch(/^task_/);
    expect(task.metadata.createdAt).toBeDefined();
    expect(task.content).toBe('');
  });

  it('should include optional fields', () => {
    const task = createTask({
      title: 'Task',
      type: 'bugfix',
      from: 'qa',
      to: 'development',
      priority: 'critical',
      tags: ['urgent'],
      content: 'Fix the bug',
      projectId: 'proj-1',
    });
    expect(task.metadata.priority).toBe('critical');
    expect(task.metadata.tags).toEqual(['urgent']);
    expect(task.content).toBe('Fix the bug');
    expect(task.metadata.projectId).toBe('proj-1');
  });
});

describe('updateTaskStatus', () => {
  const task = createTask({
    title: 'Test',
    type: 'feature',
    from: 'orchestrator',
    to: 'development',
  });

  it('should update status and set updatedAt', () => {
    const updated = updateTaskStatus(task, 'in_progress');
    expect(updated.metadata.status).toBe('in_progress');
    expect(updated.metadata.updatedAt).toBeDefined();
  });

  it('should set completedAt for completed status', () => {
    const updated = updateTaskStatus(task, 'completed');
    expect(updated.metadata.completedAt).toBeDefined();
  });

  it('should set completedAt for failed status', () => {
    const updated = updateTaskStatus(task, 'failed');
    expect(updated.metadata.completedAt).toBeDefined();
  });

  it('should not set completedAt for in_progress', () => {
    const updated = updateTaskStatus(task, 'in_progress');
    expect(updated.metadata.completedAt).toBeUndefined();
  });

  it('should not mutate original task', () => {
    updateTaskStatus(task, 'completed');
    expect(task.metadata.status).toBe('pending');
  });
});

describe('hasUnmetDependencies', () => {
  it('should return false with no dependencies', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    expect(hasUnmetDependencies(task)).toBe(false);
  });

  it('should return true for blocked_by without completed status', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      dependencies: [{ taskId: 'other', type: 'blocked_by', status: 'pending' }],
    });
    expect(hasUnmetDependencies(task)).toBe(true);
  });

  it('should return false for completed blocked_by', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      dependencies: [{ taskId: 'other', type: 'blocked_by', status: 'completed' }],
    });
    expect(hasUnmetDependencies(task)).toBe(false);
  });

  it('should ignore non-blocked_by dependencies', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      dependencies: [{ taskId: 'other', type: 'related', status: 'pending' }],
    });
    expect(hasUnmetDependencies(task)).toBe(false);
  });
});

describe('canRetry', () => {
  it('should return true when retries available', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      maxRetries: 3,
    });
    expect(canRetry(task)).toBe(true);
  });

  it('should return false when retries exhausted', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    // Exhaust retries (default maxRetries=3)
    let t = incrementRetry(task);
    t = incrementRetry(t);
    t = incrementRetry(t);
    expect(canRetry(t)).toBe(false);
  });
});

describe('incrementRetry', () => {
  it('should increment retry count', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    const retried = incrementRetry(task);
    expect(retried.metadata.retryCount).toBe(1);
    expect(retried.metadata.updatedAt).toBeDefined();
  });

  it('should not mutate original', () => {
    const task = createTask({
      title: 'Test',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
    });
    incrementRetry(task);
    expect(task.metadata.retryCount).toBe(0);
  });
});
