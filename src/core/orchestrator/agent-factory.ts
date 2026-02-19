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
import {
  ArchitectureAgent,
  createArchitectureAgent,
} from './agents/architecture-agent';
import { SecurityAgent, createSecurityAgent } from './agents/security-agent';
import {
  DebuggingAgent,
  createDebuggingAgent,
} from './agents/debugging-agent';
import {
  DocumentationAgent,
  createDocumentationAgent,
} from './agents/documentation-agent';
import {
  ExplorationAgent,
  createExplorationAgent,
} from './agents/exploration-agent';
import {
  IntegrationAgent,
  createIntegrationAgent,
} from './agents/integration-agent';
import {
  CodeQualityAgent,
  createCodeQualityAgent,
} from './agents/code-quality-agent';
import { TeamAgentLLMAdapter, createTeamAgentLLMAdapter } from './llm/team-agent-llm';
import type { ILLMClient } from '@/shared/llm';
import type { TeamType } from '../workspace/task-document';
import {
  createPlanningLLMExecutor,
  createDevelopmentLLMExecutor,
  createQALLMExecutor,
  createTestGenerationLLMExecutor,
  createDeepReviewLLMExecutor,
  createRefactoringLLMExecutor,
} from './llm';
import {
  createArchitectureLLMExecutor,
  createSecurityLLMExecutor,
  createDebuggingLLMExecutor,
  createDocumentationLLMExecutor,
  createExplorationAgentLLMExecutor,
  createIntegrationLLMExecutor,
} from './llm/expanded-agents-llm';
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
  /** Enable expanded agent set (architecture, security, debugging, docs, exploration, integration) */
  enableExpandedAgents?: boolean;
}

/**
 * Created agents bundle — core agents
 */
export interface CreatedAgents {
  planning: PlanningAgent;
  development: DevelopmentAgent;
  qa: QAAgent;
}

/**
 * Created agents bundle — includes expanded agents
 */
export interface CreatedExpandedAgents extends CreatedAgents {
  architecture: ArchitectureAgent;
  security: SecurityAgent;
  debugging: DebuggingAgent;
  documentation: DocumentationAgent;
  exploration: ExplorationAgent;
  integration: IntegrationAgent;
  codeQuality: CodeQualityAgent;
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
): Promise<CreatedAgents | CreatedExpandedAgents> {
  const { queue, maxConcurrentTasks, enableLLM, projectContext } = config;

  // Create Planning Agent
  const planning = createPlanningAgent(queue, {
    config: {
      maxConcurrentTasks: Math.ceil(maxConcurrentTasks / 3),
      autoStart: false,
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
      autoStart: false,
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
      autoStart: false,
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

  // Expanded agents (optional, enabled by config flag)
  if (config.enableExpandedAgents) {
    const expandedConcurrency = Math.ceil(maxConcurrentTasks / 4);

    // Architecture Agent (teamType: 'design')
    const architecture = createArchitectureAgent(queue, {
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(architecture);

    // Security Agent (teamType: 'security')
    const security = createSecurityAgent(queue, {
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(security);

    // Debugging Agent (teamType: 'issue-response')
    const debugging = createDebuggingAgent(queue, {
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(debugging);

    // Documentation Agent (teamType: 'documentation')
    const documentation = createDocumentationAgent(queue, {
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(documentation);

    // Exploration Agent (teamType: 'operations')
    const exploration = createExplorationAgent(queue, {
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(exploration);

    // Integration Agent (teamType: 'testing')
    const integration = createIntegrationAgent(queue, {
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(integration);

    // Code Quality Agent (teamType: 'code-quality')
    const codeQuality = createCodeQualityAgent(queue, {
      teamType: 'code-quality',
      config: { maxConcurrentTasks: expandedConcurrency, autoStart: false },
    });
    orchestrator.registerTeam(codeQuality);

    // Wire LLM executors for expanded agents
    if (enableLLM) {
      const archAdapter = getAdapterForAgent(config, 'design');
      architecture.setAnalyzeFunction(
        createArchitectureLLMExecutor({ adapter: archAdapter, projectContext }),
      );

      const secAdapter = getAdapterForAgent(config, 'security');
      security.setScanFunction(
        createSecurityLLMExecutor({ adapter: secAdapter, projectContext }),
      );

      const debugAdapter = getAdapterForAgent(config, 'issue-response');
      debugging.setDebugFunction(
        createDebuggingLLMExecutor({ adapter: debugAdapter, projectContext }),
      );

      const docAdapter = getAdapterForAgent(config, 'documentation');
      documentation.setGenerateFunction(
        createDocumentationLLMExecutor({ adapter: docAdapter, projectContext }),
      );

      const exploreAdapter = getAdapterForAgent(config, 'operations');
      exploration.setExploreFunction(
        createExplorationAgentLLMExecutor({ adapter: exploreAdapter, projectContext }),
      );

      const integrationAdapter = getAdapterForAgent(config, 'testing');
      integration.setVerifyFunction(
        createIntegrationLLMExecutor({ adapter: integrationAdapter, projectContext }),
      );

      const cqAdapter = getAdapterForAgent(config, 'code-quality');
      codeQuality.setTestGenerator(
        createTestGenerationLLMExecutor({ adapter: cqAdapter }),
      );
      codeQuality.setDeepReviewer(
        createDeepReviewLLMExecutor({ adapter: cqAdapter }),
      );
      codeQuality.setRefactoringAnalyzer(
        createRefactoringLLMExecutor({ adapter: cqAdapter }),
      );
    }

    // Start all agents (core + expanded)
    await Promise.all([
      planning.start(),
      development.start(),
      qa.start(),
      architecture.start(),
      security.start(),
      debugging.start(),
      documentation.start(),
      exploration.start(),
      integration.start(),
      codeQuality.start(),
    ]);

    return {
      planning,
      development,
      qa,
      architecture,
      security,
      debugging,
      documentation,
      exploration,
      integration,
      codeQuality,
    };
  }

  // Start core agents only
  await Promise.all([planning.start(), development.start(), qa.start()]);

  return { planning, development, qa };
}
