import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  // Base
  TeamAgentStatus,
  // Agents
  PlanningAgent,
  createPlanningAgent,
  DevelopmentAgent,
  createDevelopmentAgent,
  createFrontendAgent,
  createBackendAgent,
  QAAgent,
  createQAAgent,
  // Types
  PlanningOutput,
  DevelopmentOutput,
  QAOutput,
} from '@/core/orchestrator';
import {
  DocumentQueue,
  WorkspaceManager,
  createTask,
} from '@/core/workspace';

describe('Team Agents', () => {
  let tempDir: string;
  let workspace: WorkspaceManager;
  let queue: DocumentQueue;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-'));
    workspace = new WorkspaceManager({ baseDir: tempDir });
    queue = new DocumentQueue(workspace);
    await queue.initialize();
  });

  afterEach(async () => {
    await queue.stop();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('PlanningAgent', () => {
    let agent: PlanningAgent;

    beforeEach(() => {
      agent = createPlanningAgent(queue);
    });

    afterEach(async () => {
      await agent.stop();
    });

    it('should create with default config', () => {
      expect(agent.teamType).toBe('planning');
      expect(agent.config.name).toBe('Planning Team');
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should start and stop', async () => {
      await agent.start();
      expect(agent.status).toBe(TeamAgentStatus.IDLE);

      await agent.stop();
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should handle planning tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Implement User Authentication',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        content: 'Add feature for user login and registration',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      const plan = result.result as PlanningOutput;
      expect(plan.title).toContain('Plan:');
      expect(plan.tasks.length).toBeGreaterThan(0);
    });

    it('should handle analysis tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Analyze Code Structure',
        type: 'analysis',
        from: 'orchestrator',
        to: 'planning',
        content: 'Review the current codebase architecture',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
    });

    it('should use custom plan generator', async () => {
      const customPlan: PlanningOutput = {
        title: 'Custom Plan',
        summary: 'Custom generated plan',
        tasks: [
          {
            title: 'Custom Task',
            type: 'feature',
            targetTeam: 'development',
            description: 'Custom task description',
          },
        ],
      };

      agent.setPlanGenerator(async () => customPlan);
      await agent.start();

      const task = createTask({
        title: 'Test Task',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.result as PlanningOutput).title).toBe('Custom Plan');
    });

    it('should decompose feature requests into sub-tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Add New Feature',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        content: 'Implement a new feature for user notifications',
      });

      const result = await agent.processTask(task);
      const plan = result.result as PlanningOutput;

      // Should have design, implement, test, review tasks
      expect(plan.tasks.some((t) => t.type === 'design')).toBe(true);
      expect(plan.tasks.some((t) => t.type === 'feature')).toBe(true);
      expect(plan.tasks.some((t) => t.type === 'test')).toBe(true);
    });

    it('should decompose bug fix requests', async () => {
      await agent.start();

      const task = createTask({
        title: 'Fix Login Bug',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        content: 'Fix the bug where users cannot login',
      });

      const result = await agent.processTask(task);
      const plan = result.result as PlanningOutput;

      // Should have investigate, fix, verify tasks
      expect(plan.tasks.some((t) => t.type === 'analysis')).toBe(true);
      expect(plan.tasks.some((t) => t.type === 'bugfix')).toBe(true);
      expect(plan.tasks.some((t) => t.type === 'test')).toBe(true);
    });

    it('should track metrics', async () => {
      await agent.start();

      const task = createTask({
        title: 'Test Metrics',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
      });

      await agent.processTask(task);

      expect(agent.metrics.tasksProcessed).toBe(1);
      expect(agent.metrics.lastActiveAt).not.toBeNull();
    });
  });

  describe('DevelopmentAgent', () => {
    let agent: DevelopmentAgent;

    beforeEach(() => {
      agent = createDevelopmentAgent(queue);
    });

    afterEach(async () => {
      await agent.stop();
    });

    it('should create with default config', () => {
      expect(agent.teamType).toBe('development');
      expect(agent.getSpecialization()).toBe('fullstack');
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should create frontend agent', () => {
      const frontendAgent = createFrontendAgent(queue);
      expect(frontendAgent.teamType).toBe('frontend');
      expect(frontendAgent.getSpecialization()).toBe('frontend');
      expect(frontendAgent.getSupportedLanguages()).toContain('typescript');
      expect(frontendAgent.getSupportedLanguages()).toContain('css');
    });

    it('should create backend agent', () => {
      const backendAgent = createBackendAgent(queue);
      expect(backendAgent.teamType).toBe('backend');
      expect(backendAgent.getSpecialization()).toBe('backend');
      expect(backendAgent.getSupportedLanguages()).toContain('python');
    });

    it('should handle feature tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Implement Login',
        type: 'feature',
        from: 'planning',
        to: 'development',
        content: 'Implement user login functionality',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      const output = result.result as DevelopmentOutput;
      expect(output.summary).toContain('Implemented');
    });

    it('should handle bugfix tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Fix Auth Bug',
        type: 'bugfix',
        from: 'planning',
        to: 'development',
        content: 'Fix authentication bug',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DevelopmentOutput;
      expect(output.summary).toContain('Fixed');
    });

    it('should handle refactor tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Refactor Utils',
        type: 'refactor',
        from: 'code-quality',
        to: 'development',
        content: 'Refactor utility functions',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as DevelopmentOutput;
      expect(output.summary).toContain('Refactored');
    });

    it('should use custom code executor', async () => {
      const customOutput: DevelopmentOutput = {
        summary: 'Custom implementation complete',
        filesModified: [
          { path: 'src/custom.ts', action: 'created', description: 'Custom file' },
        ],
      };

      agent.setCodeExecutor(async () => customOutput);
      await agent.start();

      const task = createTask({
        title: 'Custom Task',
        type: 'feature',
        from: 'planning',
        to: 'development',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.result as DevelopmentOutput).summary).toBe('Custom implementation complete');
    });

    it('should report file modifications', async () => {
      await agent.start();

      const task = createTask({
        title: 'Create Feature',
        type: 'feature',
        from: 'planning',
        to: 'development',
        files: [
          { path: 'src/feature.ts', action: 'create' },
          { path: 'src/utils.ts', action: 'modify' },
        ],
      });

      const result = await agent.processTask(task);
      const output = result.result as DevelopmentOutput;

      expect(output.filesModified.length).toBe(2);
    });
  });

  describe('QAAgent', () => {
    let agent: QAAgent;

    beforeEach(() => {
      agent = createQAAgent(queue);
    });

    afterEach(async () => {
      await agent.stop();
    });

    it('should create with default config', () => {
      expect(agent.teamType).toBe('qa');
      expect(agent.config.name).toBe('QA Team');
      expect(agent.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should handle test tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Test Login Feature',
        type: 'test',
        from: 'development',
        to: 'qa',
        content: 'Test the login feature',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();

      const output = result.result as QAOutput;
      expect(output.summary).toContain('Test execution completed');
      expect(output.testResults).toBeDefined();
      expect(output.testResults?.total).toBeGreaterThan(0);
    });

    it('should handle review tasks', async () => {
      await agent.start();

      const task = createTask({
        title: 'Review Auth Code',
        type: 'review',
        from: 'development',
        to: 'qa',
        content: 'Review the authentication code',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      const output = result.result as QAOutput;
      expect(output.summary).toContain('Code review completed');
    });

    it('should provide quality score', async () => {
      await agent.start();

      const task = createTask({
        title: 'Quality Check',
        type: 'test',
        from: 'development',
        to: 'qa',
      });

      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      expect(output.qualityScore).toBeDefined();
      expect(output.qualityScore).toBeGreaterThanOrEqual(0);
      expect(output.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should provide approval decision', async () => {
      await agent.start();

      const task = createTask({
        title: 'Approval Test',
        type: 'test',
        from: 'development',
        to: 'qa',
      });

      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      expect(typeof output.approved).toBe('boolean');
      expect(output.reason).toBeDefined();
    });

    it('should use custom QA executor', async () => {
      const customOutput: QAOutput = {
        summary: 'Custom QA complete',
        qualityScore: 95,
        approved: true,
        reason: 'All checks passed',
      };

      agent.setQAExecutor(async () => customOutput);
      await agent.start();

      const task = createTask({
        title: 'Custom QA',
        type: 'test',
        from: 'development',
        to: 'qa',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.result as QAOutput).qualityScore).toBe(95);
    });

    it('should provide coverage information', async () => {
      await agent.start();

      const task = createTask({
        title: 'Coverage Test',
        type: 'test',
        from: 'development',
        to: 'qa',
      });

      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      expect(output.coverage).toBeDefined();
      expect(output.coverage?.lines).toBeGreaterThanOrEqual(0);
      expect(output.coverage?.branches).toBeGreaterThanOrEqual(0);
    });

    it('should detect security issues in review', async () => {
      await agent.start();

      const task = createTask({
        title: 'Security Review',
        type: 'review',
        from: 'development',
        to: 'qa',
        content: 'Review code for security vulnerabilities',
      });

      const result = await agent.processTask(task);
      const output = result.result as QAOutput;

      // Should have security-related findings
      expect(output.reviewFindings).toBeDefined();
      expect(output.reviewFindings?.some((f) => f.category === 'security')).toBe(true);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should pause and resume processing', async () => {
      const agent = createPlanningAgent(queue);
      await agent.start();

      await agent.pause();
      expect(agent.status).toBe(TeamAgentStatus.PAUSED);

      await agent.resume();
      expect(agent.status).toBe(TeamAgentStatus.IDLE);

      await agent.stop();
    });

    it('should report health status', async () => {
      const agent = createDevelopmentAgent(queue);
      await agent.start();

      const health = await agent.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe(TeamAgentStatus.IDLE);
      expect(health.details).toBeDefined();

      await agent.stop();
    });

    it('should track load', async () => {
      const agent = createQAAgent(queue);
      await agent.start();

      expect(agent.getLoad()).toBe(0);

      // Process a task (will complete quickly in test)
      const task = createTask({
        title: 'Load Test',
        type: 'test',
        from: 'development',
        to: 'qa',
      });
      await agent.processTask(task);

      // Load should be back to 0 after completion
      expect(agent.getLoad()).toBe(0);

      await agent.stop();
    });

    it('should emit events', async () => {
      const agent = createPlanningAgent(queue);
      const events: string[] = [];

      agent.on('status-changed', (oldStatus, newStatus) => {
        events.push(`${oldStatus}->${newStatus}`);
      });

      await agent.start();
      await agent.stop();

      expect(events.length).toBeGreaterThan(0);
    });
  });
});
