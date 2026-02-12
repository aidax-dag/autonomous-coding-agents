/**
 * Team Agents Module
 *
 * Exports all team agent implementations.
 *
 * @module core/orchestrator/agents
 */

export {
  PlanningAgent,
  createPlanningAgent,
  type PlanningOutput,
  type PlanningAgentOptions,
} from './planning-agent';

export {
  DevelopmentAgent,
  createDevelopmentAgent,
  createFrontendAgent,
  createBackendAgent,
  type DevelopmentOutput,
  type DevelopmentAgentOptions,
} from './development-agent';

export {
  QAAgent,
  createQAAgent,
  type QAOutput,
  type QAAgentOptions,
  type TestResult,
} from './qa-agent';

export {
  CodeQualityAgent,
  createCodeQualityAgent,
  type CodeQualityAgentOptions,
  type GeneratedTestCase,
  type CodeReviewFinding,
  type RefactoringSuggestion,
  type TestGenerationOutput,
  type DeepReviewOutput,
  type RefactoringOutput,
} from './code-quality-agent';

export {
  ArchitectureAgent,
  createArchitectureAgent,
  type ArchitectureOutput,
  type ArchitectureAgentOptions,
} from './architecture-agent';

export {
  SecurityAgent,
  createSecurityAgent,
  type SecurityOutput,
  type SecurityFinding,
  type SecurityAgentOptions,
} from './security-agent';

export {
  DebuggingAgent,
  createDebuggingAgent,
  type DebuggingOutput,
  type DebuggingAgentOptions,
} from './debugging-agent';

export {
  DocumentationAgent,
  createDocumentationAgent,
  type DocumentationOutput,
  type DocumentationSection,
  type DocumentationAgentOptions,
} from './documentation-agent';

export {
  ExplorationAgent,
  createExplorationAgent,
  type ExplorationOutput,
  type ExplorationAgentOptions,
} from './exploration-agent';

export {
  IntegrationAgent,
  createIntegrationAgent,
  type IntegrationOutput,
  type IntegrationConnection,
  type IntegrationAgentOptions,
} from './integration-agent';
