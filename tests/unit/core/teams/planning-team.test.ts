/**
 * Planning Team Tests
 *
 * Tests for the PlanningTeam class.
 */

import {
  PlanningTeam,
  createPlanningTeam,
  DEFAULT_PLANNING_CONFIG,
} from '../../../../src/core/teams/planning/planning-team';
import { createTask } from '../../../../src/core/teams/base-team';
import {
  TeamType,
  TeamStatus,
} from '../../../../src/core/teams/team-types';

describe('PlanningTeam', () => {
  let team: PlanningTeam;

  beforeEach(async () => {
    team = createPlanningTeam({
      id: 'planning-test',
      name: 'Test Planning Team',
      maxConcurrentTasks: 3,
      taskTimeoutMs: 10000,
    });
    await team.initialize();
  });

  afterEach(async () => {
    if (team.getStatus() !== TeamStatus.TERMINATED) {
      await team.stop();
    }
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_PLANNING_CONFIG.maxSubtaskDepth).toBe(3);
      expect(DEFAULT_PLANNING_CONFIG.minSubtasks).toBe(2);
      expect(DEFAULT_PLANNING_CONFIG.maxSubtasks).toBe(10);
      expect(DEFAULT_PLANNING_CONFIG.enableEstimation).toBe(true);
    });

    it('should have correct team type', () => {
      expect(team.type).toBe(TeamType.PLANNING);
    });

    it('should have planning capabilities', () => {
      expect(team.hasCapability('task_decomposition')).toBe(true);
      expect(team.hasCapability('estimation')).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize with idle status', () => {
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should have correct name', () => {
      expect(team.name).toBe('Test Planning Team');
    });
  });

  describe('Task Processing - Generic Tasks', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should decompose generic task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Build Login System', 'Create user authentication with email/password', {
          type: 'generic',
        })
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();

      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
      expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it('should generate execution order', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Build API', 'Create REST API endpoints', { type: 'generic' })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.outputs.executionOrder).toBeDefined();
      expect(result.outputs.executionOrder.length).toBeGreaterThan(0);
    });
  });

  describe('Task Processing - Feature Tasks', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should decompose feature task into phases', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('User Dashboard', 'Create a dashboard showing user analytics', {
          type: 'feature',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];

      // Feature tasks should have design, implementation, testing phases
      const subtaskTypes = result.subtasks.map((t: { type: string }) => t.type);
      expect(subtaskTypes).toContain('design');
      expect(subtaskTypes).toContain('development');
      expect(subtaskTypes).toContain('qa');
    });

    it('should set dependencies between phases', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Feature', 'A feature', { type: 'feature' })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = completedHandler.mock.calls[0][1];

      // Implementation should depend on design
      const implTask = result.subtasks.find(
        (t: { type: string }) => t.type === 'development'
      );
      expect(implTask?.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Task Processing - PRD Tasks', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should process PRD with requirements', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Project PRD', 'Product requirements document', {
          type: 'prd',
          inputs: {
            prd: {
              title: 'User Authentication System',
              description: 'Complete auth system',
              objectives: ['Secure login', 'Password reset'],
              requirements: [
                {
                  id: 'req-1',
                  title: 'User Login',
                  description: 'Users can log in with email/password',
                  priority: 'must_have',
                  category: 'functional',
                  acceptanceCriteria: ['Login form works', 'Session created'],
                },
              ],
              constraints: ['Must use OAuth 2.0'],
              successCriteria: ['All tests pass'],
            },
          },
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
      expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it('should fall back to description when no PRD provided', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('PRD Task', 'Build a complete system', { type: 'prd' })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });
  });

  describe('Effort Estimation', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should estimate effort for subtasks', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Complex System', 'Build a complex distributed system', {
          type: 'feature',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = completedHandler.mock.calls[0][1];
      expect(result.outputs.estimatedEffort).toBeGreaterThan(0);

      // Each subtask should have estimated effort
      for (const subtask of result.subtasks) {
        expect(subtask.estimatedEffort).toBeDefined();
        expect(subtask.estimatedEffort).toBeGreaterThanOrEqual(0);
      }
    });

    it('should increase effort for complex tasks', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      // Submit a complex task
      await team.submitTask(
        createTask(
          'Complex Integration',
          'Build a complex distributed security system with integration and scalable performance',
          { type: 'feature' }
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = completedHandler.mock.calls[0][1];
      const totalEffort = result.outputs.estimatedEffort;

      // Should have higher effort due to complexity indicators
      expect(totalEffort).toBeGreaterThan(5);
    });
  });

  describe('Artifacts', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should create execution plan artifact', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Project', 'Build a project', { type: 'feature' })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = completedHandler.mock.calls[0][1];
      expect(result.artifacts.length).toBeGreaterThan(0);

      const planArtifact = result.artifacts.find(
        (a: { name: string }) => a.name.includes('execution-plan')
      );
      expect(planArtifact).toBeDefined();
      expect(planArtifact?.type).toBe('document');
      expect(planArtifact?.mimeType).toBe('text/markdown');
    });
  });

  describe('Critical Path', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should identify critical path', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Multi-phase Project', 'A project with multiple phases', {
          type: 'feature',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = completedHandler.mock.calls[0][1];
      expect(result.outputs.decomposition.criticalPath).toBeDefined();
      expect(result.outputs.decomposition.criticalPath.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should track task statistics', async () => {
      await team.submitTask(createTask('Task 1', 'First task', { type: 'generic' }));
      await team.submitTask(createTask('Task 2', 'Second task', { type: 'generic' }));

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const stats = team.getStats();
      // Note: tasksReceived includes both original tasks and generated subtasks
      expect(stats.tasksReceived).toBeGreaterThanOrEqual(2);
      expect(stats.tasksCompleted).toBeGreaterThanOrEqual(2);
      expect(stats.totalTokensUsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Factory Function', () => {
    it('should create team with defaults', () => {
      const newTeam = createPlanningTeam();
      expect(newTeam).toBeInstanceOf(PlanningTeam);
      expect(newTeam.type).toBe(TeamType.PLANNING);
    });

    it('should accept custom config', () => {
      const newTeam = createPlanningTeam({
        name: 'Custom Planning',
        enableEstimation: false,
      });
      expect(newTeam.name).toBe('Custom Planning');
    });
  });
});
