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
import { TeamAgentLLMAdapter } from './llm/team-agent-llm';
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
  /** LLM adapter for agent executors */
  llmAdapter: TeamAgentLLMAdapter;
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
 * Create, configure, and register all team agents.
 *
 * @returns The created agents for reference by the runner
 */
export async function createAndRegisterAgents(
  config: AgentFactoryConfig,
  orchestrator: CEOOrchestrator,
): Promise<CreatedAgents> {
  const { queue, llmAdapter, maxConcurrentTasks, enableLLM, projectContext } = config;

  // Create Planning Agent
  const planning = createPlanningAgent(queue, {
    config: {
      maxConcurrentTasks: Math.ceil(maxConcurrentTasks / 3),
    },
  });

  if (enableLLM) {
    planning.setPlanGenerator(
      createPlanningLLMExecutor({ adapter: llmAdapter, projectContext }),
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
    development.setCodeExecutor(
      createDevelopmentLLMExecutor({ adapter: llmAdapter, projectContext }),
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
    qa.setQAExecutor(
      createQALLMExecutor({ adapter: llmAdapter, projectContext }),
    );
  }

  orchestrator.registerTeam(qa);

  // Start all agents
  await Promise.all([planning.start(), development.start(), qa.start()]);

  return { planning, development, qa };
}
