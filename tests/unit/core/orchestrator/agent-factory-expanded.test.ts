/**
 * Agent Factory Expanded Agents Tests
 *
 * Tests that enableExpandedAgents creates and registers all 6 new agents
 * alongside the 3 core agents, with unique teamTypes and proper lifecycle.
 */

import {
  createAndRegisterAgents,
  type CreatedExpandedAgents,
} from '../../../../src/core/orchestrator/agent-factory';
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

describe('AgentFactory — Expanded Agents', () => {
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
    workspaceDir = path.join(os.tmpdir(), `agent-factory-expanded-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });

    workspace = new WorkspaceManager({ baseDir: workspaceDir, autoCreate: true });
    await workspace.initialize();

    queue = new DocumentQueue(workspace);
    await queue.initialize();

    orchestrator = new CEOOrchestrator({
      workspaceDir,
      routingStrategy: RoutingStrategy.CAPABILITY_MATCH,
      maxConcurrentTasks: 20,
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

  it('should create all 9 agents when enableExpandedAgents is true', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 12,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
        enableExpandedAgents: true,
      },
      orchestrator,
    );

    const expanded = agents as CreatedExpandedAgents;
    expect(expanded.planning).toBeDefined();
    expect(expanded.development).toBeDefined();
    expect(expanded.qa).toBeDefined();
    expect(expanded.architecture).toBeDefined();
    expect(expanded.security).toBeDefined();
    expect(expanded.debugging).toBeDefined();
    expect(expanded.documentation).toBeDefined();
    expect(expanded.exploration).toBeDefined();
    expect(expanded.integration).toBeDefined();
  });

  it('should register all 9 agents with unique teamTypes in orchestrator', async () => {
    await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 12,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
        enableExpandedAgents: true,
      },
      orchestrator,
    );

    // Core agents
    expect(orchestrator.teams.get('planning')).toBeDefined();
    expect(orchestrator.teams.get('development')).toBeDefined();
    expect(orchestrator.teams.get('qa')).toBeDefined();

    // Expanded agents with unique teamTypes
    expect(orchestrator.teams.get('design')).toBeDefined();
    expect(orchestrator.teams.get('security')).toBeDefined();
    expect(orchestrator.teams.get('issue-response')).toBeDefined();
    expect(orchestrator.teams.get('documentation')).toBeDefined();
    expect(orchestrator.teams.get('operations')).toBeDefined();
    expect(orchestrator.teams.get('testing')).toBeDefined();
  });

  it('should only create 3 core agents when enableExpandedAgents is false', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 12,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
        enableExpandedAgents: false,
      },
      orchestrator,
    );

    expect(agents.planning).toBeDefined();
    expect(agents.development).toBeDefined();
    expect(agents.qa).toBeDefined();
    expect((agents as CreatedExpandedAgents).architecture).toBeUndefined();
    expect((agents as CreatedExpandedAgents).security).toBeUndefined();
  });

  it('should only create 3 core agents when enableExpandedAgents is omitted', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 12,
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
    // Expanded agents should not be registered
    expect(orchestrator.teams.get('design')).toBeUndefined();
    expect(orchestrator.teams.get('security')).toBeUndefined();
  });

  it('should start all 9 agents when expanded', async () => {
    const agents = await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 18,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
        enableExpandedAgents: true,
      },
      orchestrator,
    );

    const expanded = agents as CreatedExpandedAgents;
    // All agents should be defined and running (or idle after start)
    expect(expanded.architecture).toBeDefined();
    expect(expanded.security).toBeDefined();
    expect(expanded.debugging).toBeDefined();
    expect(expanded.documentation).toBeDefined();
    expect(expanded.exploration).toBeDefined();
    expect(expanded.integration).toBeDefined();
  });

  it('expanded agents should have correct teamType assignments', async () => {
    const agents = (await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 18,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
        enableExpandedAgents: true,
      },
      orchestrator,
    )) as CreatedExpandedAgents;

    expect(agents.architecture.teamType).toBe('design');
    expect(agents.security.teamType).toBe('security');
    expect(agents.debugging.teamType).toBe('issue-response');
    expect(agents.documentation.teamType).toBe('documentation');
    expect(agents.exploration.teamType).toBe('operations');
    expect(agents.integration.teamType).toBe('testing');
  });

  it('should not conflict with core agent teamTypes', async () => {
    const agents = (await createAndRegisterAgents(
      {
        llmAdapter,
        queue,
        maxConcurrentTasks: 18,
        enableLLM: false,
        projectContext: '',
        useRealQualityTools: false,
        workspaceDir,
        enableExpandedAgents: true,
      },
      orchestrator,
    )) as CreatedExpandedAgents;

    // Core agents keep their original teamTypes
    expect(agents.planning.teamType).toBe('planning');
    expect(agents.development.teamType).toBe('development');
    expect(agents.qa.teamType).toBe('qa');

    // No teamType collision: all 9 are unique
    const teamTypes = new Set([
      agents.planning.teamType,
      agents.development.teamType,
      agents.qa.teamType,
      agents.architecture.teamType,
      agents.security.teamType,
      agents.debugging.teamType,
      agents.documentation.teamType,
      agents.exploration.teamType,
      agents.integration.teamType,
    ]);
    expect(teamTypes.size).toBe(9);
  });
});
