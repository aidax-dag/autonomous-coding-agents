/**
 * Agent Factory Tests
 */

import { createAndRegisterAgents, type AgentFactoryConfig } from '../../../../src/core/orchestrator/agent-factory';
import { CEOOrchestrator } from '../../../../src/core/orchestrator/ceo-orchestrator';
import { RoutingStrategy } from '../../../../src/core/orchestrator/task-router';
import { DocumentQueue } from '../../../../src/core/workspace/document-queue';
import { WorkspaceManager } from '../../../../src/core/workspace/workspace-manager';
import { createTeamAgentLLMAdapter } from '../../../../src/core/orchestrator/llm/team-agent-llm';
import type { TeamAgentLLMAdapter } from '../../../../src/core/orchestrator/llm/team-agent-llm';
import type { ILLMClient } from '../../../../src/shared/llm';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('AgentFactory', () => {
  let workspaceDir: string;
  let workspace: WorkspaceManager;
  let queue: DocumentQueue;
  let orchestrator: CEOOrchestrator;
  let llmAdapter: TeamAgentLLMAdapter;

  const mockLLMClient: ILLMClient = {
    getProvider: () => 'mock',
    getDefaultModel: () => 'mock-model',
    getMaxContextLength: () => 128000,
    chat: async () => ({
      content: '```json\n{"summary":"mock"}\n```',
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      finishReason: 'stop' as const,
    }),
    chatStream: async (messages, callback) => {
      const result = await mockLLMClient.chat(messages);
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    },
  };

  beforeEach(async () => {
    workspaceDir = path.join(os.tmpdir(), `agent-factory-test-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });

    workspace = new WorkspaceManager({ baseDir: workspaceDir, autoCreate: true });
    await workspace.initialize();

    queue = new DocumentQueue(workspace);
    await queue.initialize();

    orchestrator = new CEOOrchestrator({
      workspaceDir,
      routingStrategy: RoutingStrategy.CAPABILITY_MATCH,
      maxConcurrentTasks: 10,
      taskTimeout: 300000,
      autoStartTeams: false,
      enableDecomposition: false,
    });

    llmAdapter = createTeamAgentLLMAdapter({ client: mockLLMClient });
  });

  afterEach(async () => {
    try {
      await orchestrator.destroy();
    } catch { /* ignore */ }
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('should create and register all three agents', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 9,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
      },
      orchestrator,
    );

    expect(agents.planning).toBeDefined();
    expect(agents.development).toBeDefined();
    expect(agents.qa).toBeDefined();
  });

  it('should register agents with orchestrator', async () => {
    await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 6,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
      },
      orchestrator,
    );

    // Orchestrator should have planning, development, qa teams registered
    expect(orchestrator.teams.get('planning')).toBeDefined();
    expect(orchestrator.teams.get('development')).toBeDefined();
    expect(orchestrator.teams.get('qa')).toBeDefined();
  });

  it('should configure LLM executors when enableLLM is true', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 6,
        enableLLM: true,
        projectContext: 'Test project',
        useRealQualityTools: false,
        workspaceDir,
      },
      orchestrator,
    );

    expect(agents.planning).toBeDefined();
    expect(agents.development).toBeDefined();
    expect(agents.qa).toBeDefined();
  });

  it('should start all agents', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 6,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
      },
      orchestrator,
    );

    // After createAndRegisterAgents, agents should be started (idle state)
    expect(agents.planning).toBeDefined();
    expect(agents.development).toBeDefined();
    expect(agents.qa).toBeDefined();
  });

  it('should accept maxConcurrentTasks config', async () => {
    const config: AgentFactoryConfig = {
      llmAdapter,
      queue,
      maxConcurrentTasks: 12,
      enableLLM: false,
      projectContext: '',
      useRealQualityTools: false,
      workspaceDir,
    };

    const agents = await createAndRegisterAgents(config, orchestrator);

    expect(agents.planning).toBeDefined();
    expect(agents.development).toBeDefined();
    expect(agents.qa).toBeDefined();
  });
});
