/**
 * Agent Factory - Routing Integration Tests
 *
 * Tests the per-agent adapter creation and backward compatibility:
 * - llmClient mode (routing)
 * - llmAdapter mode (legacy)
 * - agentModelMap overrides
 */

import { createAndRegisterAgents, AgentFactoryConfig } from '../../../../src/core/orchestrator/agent-factory';
import { createTeamAgentLLMAdapter } from '../../../../src/core/orchestrator/llm/team-agent-llm';
import { CEOOrchestrator } from '../../../../src/core/orchestrator/ceo-orchestrator';
import { DocumentQueue } from '../../../../src/core/workspace/document-queue';
import { WorkspaceManager } from '../../../../src/core/workspace/workspace-manager';
import type { ILLMClient, LLMCompletionResult } from '../../../../src/shared/llm/base-client';

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Helpers
// ============================================================================

function makeCompletionResult(content: string): LLMCompletionResult {
  return {
    content,
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

function makeMockClient(): ILLMClient {
  return {
    getProvider: jest.fn().mockReturnValue('test'),
    getDefaultModel: jest.fn().mockReturnValue('test-model'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"result": "ok"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(4096),
  };
}

let tmpDir: string;
let workspace: WorkspaceManager;
let queue: DocumentQueue;
let orchestrator: CEOOrchestrator;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'af-routing-'));
  workspace = new WorkspaceManager({ baseDir: tmpDir, autoCreate: true });
  await workspace.initialize();
  queue = new DocumentQueue(workspace);
  await queue.initialize();
  orchestrator = new CEOOrchestrator({
    workspaceDir: tmpDir,
    autoStartTeams: false,
    enableDecomposition: false,
  });
});

afterEach(async () => {
  await orchestrator.destroy();
  await queue.stop();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// Tests
// ============================================================================

describe('AgentFactory routing', () => {
  describe('llmClient mode (routing)', () => {
    it('should create agents using llmClient without llmAdapter', async () => {
      const client = makeMockClient();

      const agents = await createAndRegisterAgents(
        {
          llmClient: client,
          queue,
          maxConcurrentTasks: 6,
          enableLLM: true,
          projectContext: 'test',
          useRealQualityTools: false,
          workspaceDir: tmpDir,
        },
        orchestrator,
      );

      expect(agents.planning).toBeDefined();
      expect(agents.development).toBeDefined();
      expect(agents.qa).toBeDefined();
    });

    it('should register all agents with orchestrator', async () => {
      const client = makeMockClient();

      await createAndRegisterAgents(
        {
          llmClient: client,
          queue,
          maxConcurrentTasks: 6,
          enableLLM: true,
          projectContext: 'test',
          useRealQualityTools: false,
          workspaceDir: tmpDir,
        },
        orchestrator,
      );

      expect(orchestrator.teams.getAll().length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('llmAdapter mode (legacy)', () => {
    it('should work with llmAdapter for backward compatibility', async () => {
      const client = makeMockClient();
      const adapter = createTeamAgentLLMAdapter({ client });

      const agents = await createAndRegisterAgents(
        {
          llmAdapter: adapter,
          queue,
          maxConcurrentTasks: 6,
          enableLLM: true,
          projectContext: 'test',
          useRealQualityTools: false,
          workspaceDir: tmpDir,
        },
        orchestrator,
      );

      expect(agents.planning).toBeDefined();
      expect(agents.development).toBeDefined();
      expect(agents.qa).toBeDefined();
    });
  });

  describe('agentModelMap overrides', () => {
    it('should pass model overrides to per-agent adapters', async () => {
      const client = makeMockClient();

      const agents = await createAndRegisterAgents(
        {
          llmClient: client,
          agentModelMap: {
            planning: 'claude-opus-4-6',
            development: 'claude-sonnet-4-5-20250929',
            qa: 'claude-haiku-4-5-20251001',
          },
          queue,
          maxConcurrentTasks: 6,
          enableLLM: true,
          projectContext: 'test',
          useRealQualityTools: false,
          workspaceDir: tmpDir,
        },
        orchestrator,
      );

      expect(agents.planning).toBeDefined();
      expect(agents.development).toBeDefined();
      expect(agents.qa).toBeDefined();
    });
  });

  describe('enableLLM=false', () => {
    it('should create agents without LLM executors when disabled', async () => {
      const client = makeMockClient();

      const agents = await createAndRegisterAgents(
        {
          llmClient: client,
          queue,
          maxConcurrentTasks: 6,
          enableLLM: false,
          projectContext: 'test',
          useRealQualityTools: false,
          workspaceDir: tmpDir,
        },
        orchestrator,
      );

      expect(agents.planning).toBeDefined();
      expect(agents.development).toBeDefined();
      expect(agents.qa).toBeDefined();
    });
  });

  describe('error cases', () => {
    it('should throw when neither llmAdapter nor llmClient is provided and enableLLM is true', async () => {
      await expect(
        createAndRegisterAgents(
          {
            queue,
            maxConcurrentTasks: 6,
            enableLLM: true,
            projectContext: 'test',
            useRealQualityTools: false,
            workspaceDir: tmpDir,
          } as AgentFactoryConfig,
          orchestrator,
        ),
      ).rejects.toThrow('AgentFactoryConfig requires either llmAdapter or llmClient');
    });
  });

  describe('useRealQualityTools', () => {
    it('should use quality executor when useRealQualityTools is true', async () => {
      const client = makeMockClient();

      const agents = await createAndRegisterAgents(
        {
          llmClient: client,
          queue,
          maxConcurrentTasks: 6,
          enableLLM: true,
          projectContext: 'test',
          useRealQualityTools: true,
          workspaceDir: tmpDir,
        },
        orchestrator,
      );

      expect(agents.qa).toBeDefined();
    });
  });
});
