/**
 * Team Types Tests
 *
 * Tests for team type definitions and schemas.
 */

import {
  TeamType,
  TeamCapability,
  TeamStatus,
  TaskPriority,
  TaskStatus,
  TeamConfigSchema,
  TaskDocumentSchema,
  TeamMessageSchema,
  TEAM_CAPABILITIES,
  DEFAULT_TEAM_CONFIG,
} from '../../../../src/core/teams/team-types';

describe('TeamTypes', () => {
  describe('Enums', () => {
    it('should have all team types', () => {
      expect(TeamType.PLANNING).toBe('planning');
      expect(TeamType.DESIGN).toBe('design');
      expect(TeamType.FRONTEND).toBe('frontend');
      expect(TeamType.BACKEND).toBe('backend');
      expect(TeamType.QA).toBe('qa');
      expect(TeamType.CODE_QUALITY).toBe('code_quality');
    });

    it('should have all team capabilities', () => {
      expect(TeamCapability.TASK_DECOMPOSITION).toBe('task_decomposition');
      expect(TeamCapability.CODE_GENERATION).toBe('code_generation');
      expect(TeamCapability.CODE_REVIEW).toBe('code_review');
      expect(TeamCapability.TEST_GENERATION).toBe('test_generation');
    });

    it('should have all team statuses', () => {
      expect(TeamStatus.INITIALIZING).toBe('initializing');
      expect(TeamStatus.IDLE).toBe('idle');
      expect(TeamStatus.WORKING).toBe('working');
      expect(TeamStatus.BLOCKED).toBe('blocked');
      expect(TeamStatus.TERMINATED).toBe('terminated');
    });

    it('should have task priorities in order', () => {
      expect(TaskPriority.CRITICAL).toBeLessThan(TaskPriority.HIGH);
      expect(TaskPriority.HIGH).toBeLessThan(TaskPriority.NORMAL);
      expect(TaskPriority.NORMAL).toBeLessThan(TaskPriority.LOW);
      expect(TaskPriority.LOW).toBeLessThan(TaskPriority.BACKGROUND);
    });

    it('should have all task statuses', () => {
      expect(TaskStatus.PENDING).toBe('pending');
      expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
      expect(TaskStatus.COMPLETED).toBe('completed');
      expect(TaskStatus.FAILED).toBe('failed');
    });
  });

  describe('TeamConfigSchema', () => {
    it('should validate valid team config', () => {
      const config = {
        id: 'team-1',
        name: 'Test Team',
        type: TeamType.PLANNING,
        capabilities: [TeamCapability.TASK_DECOMPOSITION],
      };

      const result = TeamConfigSchema.parse(config);
      expect(result.id).toBe('team-1');
      expect(result.name).toBe('Test Team');
      expect(result.type).toBe(TeamType.PLANNING);
    });

    it('should apply defaults', () => {
      const config = {
        id: 'team-1',
        name: 'Test Team',
        type: TeamType.PLANNING,
        capabilities: [],
      };

      const result = TeamConfigSchema.parse(config);
      expect(result.maxConcurrentTasks).toBe(3);
      expect(result.taskTimeoutMs).toBe(300000);
      expect(result.autoRetry).toBe(true);
      expect(result.maxRetries).toBe(3);
    });

    it('should reject invalid config', () => {
      const config = {
        id: 'team-1',
        // Missing name and type
      };

      expect(() => TeamConfigSchema.parse(config)).toThrow();
    });
  });

  describe('TaskDocumentSchema', () => {
    it('should validate valid task document', () => {
      const task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        type: 'development',
      };

      const result = TaskDocumentSchema.parse(task);
      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Test Task');
      expect(result.priority).toBe(TaskPriority.NORMAL);
      expect(result.status).toBe(TaskStatus.PENDING);
    });

    it('should apply defaults', () => {
      const task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        type: 'development',
      };

      const result = TaskDocumentSchema.parse(task);
      expect(result.dependencies).toEqual([]);
      expect(result.subtaskIds).toEqual([]);
      expect(result.inputs).toEqual({});
      expect(result.outputs).toEqual({});
    });

    it('should handle custom priority', () => {
      const task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        type: 'development',
        priority: TaskPriority.HIGH,
      };

      const result = TaskDocumentSchema.parse(task);
      expect(result.priority).toBe(TaskPriority.HIGH);
    });
  });

  describe('TeamMessageSchema', () => {
    it('should validate valid message', () => {
      const message = {
        id: 'msg-1',
        type: 'task_assignment' as const,
        from: 'team-1',
        to: 'team-2',
        subject: 'New Task',
        body: { taskId: 'task-1' },
      };

      const result = TeamMessageSchema.parse(message);
      expect(result.id).toBe('msg-1');
      expect(result.type).toBe('task_assignment');
      expect(result.requiresAck).toBe(false);
    });

    it('should reject invalid message type', () => {
      const message = {
        id: 'msg-1',
        type: 'invalid_type',
        from: 'team-1',
        to: 'team-2',
        subject: 'Test',
        body: {},
      };

      expect(() => TeamMessageSchema.parse(message)).toThrow();
    });
  });

  describe('TEAM_CAPABILITIES', () => {
    it('should have capabilities for all team types', () => {
      for (const teamType of Object.values(TeamType)) {
        expect(TEAM_CAPABILITIES[teamType]).toBeDefined();
        expect(Array.isArray(TEAM_CAPABILITIES[teamType])).toBe(true);
      }
    });

    it('should have correct capabilities for planning team', () => {
      expect(TEAM_CAPABILITIES[TeamType.PLANNING]).toContain(
        TeamCapability.TASK_DECOMPOSITION
      );
      expect(TEAM_CAPABILITIES[TeamType.PLANNING]).toContain(TeamCapability.ESTIMATION);
    });

    it('should have correct capabilities for frontend team', () => {
      expect(TEAM_CAPABILITIES[TeamType.FRONTEND]).toContain(TeamCapability.CODE_GENERATION);
      expect(TEAM_CAPABILITIES[TeamType.FRONTEND]).toContain(TeamCapability.TEST_GENERATION);
    });
  });

  describe('DEFAULT_TEAM_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_TEAM_CONFIG.maxConcurrentTasks).toBe(3);
      expect(DEFAULT_TEAM_CONFIG.taskTimeoutMs).toBe(300000);
      expect(DEFAULT_TEAM_CONFIG.autoRetry).toBe(true);
      expect(DEFAULT_TEAM_CONFIG.maxRetries).toBe(3);
    });
  });
});
