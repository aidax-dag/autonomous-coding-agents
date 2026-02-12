/**
 * Agent Factory
 *
 * Creates and configures team agents for the OrchestratorRunner.
 * Extracted from orchestrator-runner.ts to separate agent lifecycle
 * from orchestration concerns.
 *
 * @module core/orchestrator/agent-factory
 */

import { PlanningAgent, createPlanningAgent } from './agents/planning-agent';
import {
  DevelopmentAgent,
  createDevelopmentAgent,
} from './agents/development-agent';
import { QAAgent, createQAAgent } from './agents/qa-agent';
import { TeamAgentLLMAdapter, createTeamAgentLLMAdapter } from './llm/team-agent-llm';
import type { ILLMClient } from '@/shared/llm';
import type { TeamType } from '../workspace/task-document';
import {
  createPlanningLLMExecutor,
  createDevelopmentLLMExecutor,
  createQALLMExecutor,
} from './llm';
import { DocumentQueue } from '../workspace/document-queue';
import { CEOOrchestrator } from './ceo-orchestrator';
import { createQAExecutor } from './quality';

/**
 * Configuration for agent creation
 */
export interface AgentFactoryConfig {
  /** LLM adapter for agent executors (legacy single-adapter mode) */
  llmAdapter?: TeamAgentLLMAdapter;
  /** LLM client for routing mode (creates per-agent adapters) */
  llmClient?: ILLMClient;
  /** Per-agent model overrides (e.g. { planning: 'claude-opus-4-6' }) */
  agentModelMap?: Record<string, string>;
  /** Document queue for agent communication */
  queue: DocumentQueue;
  /** Maximum concurrent tasks across all teams */
  maxConcurrentTasks: number;
  /** Enable LLM-powered agents */
  enableLLM: boolean;
  /** Project context for LLM prompts */
  projectContext: string;
  /** Use real quality tools instead of LLM mock */
  useRealQualityTools: boolean;
  /** Workspace directory for quality tools */
  workspaceDir: string;
}

/**
 * Created agents bundle
 */
export interface CreatedAgents {
  planning: PlanningAgent;
  development: DevelopmentAgent;
  qa: QAAgent;
}

/**
 * Get or create an LLM adapter for a specific agent role.
 *
 * - If llmAdapter is provided (legacy mode), returns it as-is.
 * - If llmClient is provided (routing mode), creates a per-agent adapter with agentRole.
 * - Throws if neither is provided.
 */
function getAdapterForAgent(
  config: AgentFactoryConfig,
  agentRole: TeamType,
): TeamAgentLLMAdapter {
  if (config.llmAdapter) {
    return config.llmAdapter;
  }
  if (config.llmClient) {
    return createTeamAgentLLMAdapter({
      client: config.llmClient,
      agentRole,
      model: config.agentModelMap?.[agentRole],
    });
  }
  throw new Error('AgentFactoryConfig requires either llmAdapter or llmClient');
}

/**
 * Create, configure, and register all team agents.
 *
 * @returns The created agents for reference by the runner
 */
export async function createAndRegisterAgents(
  config: AgentFactoryConfig,
  orchestrator: CEOOrchestrator,
): Promise<CreatedAgents> {
  const { queue, maxConcurrentTasks, enableLLM, projectContext } = config;

  // Create Planning Agent
  const planning = createPlanningAgent(queue, {
    config: {
      maxConcurrentTasks: Math.ceil(maxConcurrentTasks / 3),
    },
  });

  if (enableLLM) {
    const planningAdapter = getAdapterForAgent(config, 'planning');
    planning.setPlanGenerator(
      createPlanningLLMExecutor({ adapter: planningAdapter, projectContext }),
    );
  }

  orchestrator.registerTeam(planning);

  // Create Development Agent
  const development = createDevelopmentAgent(queue, {
    config: {
      maxConcurrentTasks: Math.ceil(maxConcurrentTasks / 2),
    },
  });

  if (enableLLM) {
    const developmentAdapter = getAdapterForAgent(config, 'development');
    development.setCodeExecutor(
      createDevelopmentLLMExecutor({ adapter: developmentAdapter, projectContext }),
    );
  }

  orchestrator.registerTeam(development);

  // Create QA Agent
  const qa = createQAAgent(queue, {
    config: {
      maxConcurrentTasks: Math.ceil(maxConcurrentTasks / 3),
    },
  });

  if (config.useRealQualityTools) {
    qa.setQAExecutor(createQAExecutor({ workspaceDir: config.workspaceDir }));
  } else if (enableLLM) {
    const qaAdapter = getAdapterForAgent(config, 'qa');
    qa.setQAExecutor(
      createQALLMExecutor({ adapter: qaAdapter, projectContext }),
    );
  }

  orchestrator.registerTeam(qa);

  // Start all agents
  await Promise.all([planning.start(), development.start(), qa.start()]);

  return { planning, development, qa };
}
