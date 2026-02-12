/**
 * CEOOrchestrator XML Plan Execution Tests (T15)
 */

import {
  TeamAgentStatus,
  createTeamConfig,
  type ITeamAgent,
  type TeamAgentConfig,
  type TeamMetrics,
  type TaskHandler,
  type TeamCapability,
  CEOOrchestrator,
} from '../../../../src/core/orchestrator';
import type { TeamType, TaskType } from '../../../../src/core/workspace';

class MockTeamAgent implements ITeamAgent {
  readonly id: string;
  readonly teamType: TeamType;
  readonly config: TeamAgentConfig;
  private _status: TeamAgentStatus = TeamAgentStatus.STOPPED;
  private _metrics: TeamMetrics = {
    tasksProcessed: 0,
    tasksFailed: 0,
    tasksInProgress: 0,
    averageProcessingTime: 0,
    uptime: 0,
    lastActiveAt: null,
    successRate: 1,
  };
  private handlers: Map<TaskType, TaskHandler> = new Map();

  constructor(teamType: TeamType, config?: Partial<TeamAgentConfig>) {
    this.teamType = teamType;
    this.config = createTeamConfig(teamType, config);
    this.id = `${teamType}-test`;
  }

  get status(): TeamAgentStatus { return this._status; }
  get metrics(): TeamMetrics { return this._metrics; }

  async start(): Promise<void> { this._status = TeamAgentStatus.IDLE; }
  async stop(): Promise<void> { this._status = TeamAgentStatus.STOPPED; }
  async pause(): Promise<void> { this._status = TeamAgentStatus.PAUSED; }
  async resume(): Promise<void> { this._status = TeamAgentStatus.IDLE; }

  canHandle(taskType: TaskType): boolean {
    return this.config.capabilities.some((cap) => cap.taskTypes.includes(taskType));
  }

  registerHandler(taskTypes: TaskType[], handler: TaskHandler): void {
    for (const type of taskTypes) this.handlers.set(type, handler);
  }

  getCapability(taskType: TaskType): TeamCapability | undefined {
    return this.config.capabilities.find((cap) => cap.taskTypes.includes(taskType));
  }

  getLoad(): number { return 0; }

  async healthCheck(): Promise<{ healthy: boolean; status: TeamAgentStatus; details?: Record<string, unknown> }> {
    return { healthy: true, status: this._status };
  }

  async processTask(): Promise<{ success: boolean; result?: unknown; error?: string }> {
    return { success: true, result: 'ok' };
  }
}

describe('CEOOrchestrator.executeXMLPlan (T15)', () => {
  let orchestrator: CEOOrchestrator;

  beforeEach(async () => {
    orchestrator = new CEOOrchestrator({
      enableDecomposition: true,
      maxConcurrentTasks: 5,
    });

    orchestrator.registerTeam(new MockTeamAgent('planning'));
    orchestrator.registerTeam(new MockTeamAgent('development'));
    orchestrator.registerTeam(new MockTeamAgent('qa'));

    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.destroy();
  });

  it('should create tasks from valid XML plan', async () => {
    const xml = `
      <plan title="Add Auth Module">
        <step id="1" action="create" target="src/auth.ts">Create auth module</step>
        <step id="2" action="modify" target="src/index.ts">Update exports</step>
        <step id="3" action="test" target="tests/auth.test.ts">Write tests</step>
      </plan>
    `;

    const tasks = await orchestrator.executeXMLPlan(xml);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].metadata.tags).toContain('xml-plan');
    expect(tasks[0].metadata.tags).toContain('step-1');
  });

  it('should return empty array for invalid XML', async () => {
    orchestrator.on('error', () => {}); // Suppress unhandled error
    const xml = '<invalid>no plan here</invalid>';
    const tasks = await orchestrator.executeXMLPlan(xml);
    expect(tasks).toHaveLength(0);
  });

  it('should map action to correct task type', async () => {
    const xml = `
      <plan title="Test Actions">
        <step id="1" action="create" target="src/a.ts">Create</step>
        <step id="2" action="test" target="tests/a.test.ts">Test</step>
        <step id="3" action="review" target="src/a.ts">Review</step>
      </plan>
    `;

    const tasks = await orchestrator.executeXMLPlan(xml);
    expect(tasks[0].metadata.type).toBe('feature');
    expect(tasks[1].metadata.type).toBe('test');
    expect(tasks[2].metadata.type).toBe('review');
  });

  it('should include plan title in task titles', async () => {
    const xml = `
      <plan title="Auth Feature">
        <step id="1" action="create" target="src/auth.ts">Create auth</step>
      </plan>
    `;

    const tasks = await orchestrator.executeXMLPlan(xml);
    expect(tasks[0].metadata.title).toContain('Auth Feature');
  });

  it('should pass priority and tags options', async () => {
    const xml = `
      <plan title="Quick Fix">
        <step id="1" action="modify" target="src/fix.ts">Fix bug</step>
      </plan>
    `;

    const tasks = await orchestrator.executeXMLPlan(xml, {
      priority: 'critical',
      tags: ['hotfix'],
    });

    expect(tasks[0].metadata.priority).toBe('critical');
    expect(tasks[0].metadata.tags).toContain('hotfix');
    expect(tasks[0].metadata.tags).toContain('xml-plan');
  });
});
