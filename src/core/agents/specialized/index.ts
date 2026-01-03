/**
 * Specialized Agents Module
 *
 * Provides concrete agent implementations built on the DI-based BaseAgent.
 *
 * @module core/agents/specialized
 */

export { CoderAgent, createCoderAgent, type CoderAgentConfig } from './coder-agent';
export {
  ArchitectAgent,
  createArchitectAgent,
  DocumentAnalysisPayloadSchema,
  ArchitectureDesignPayloadSchema,
  TechStackPayloadSchema,
  APIDesignPayloadSchema,
  ModuleBreakdownResponseSchema,
  ArchitectureResponseSchema,
  TechStackResponseSchema,
  APISpecResponseSchema,
  AnalysisDepth,
  ArchitectureStyle,
  type ArchitectAgentConfig,
  type DocumentAnalysisPayload,
  type ArchitectureDesignPayload,
  type TechStackPayload,
  type APIDesignPayload,
  type ModuleBreakdownResponse,
  type ArchitectureResponse,
  type TechStackResponse,
  type APISpecResponse,
} from './architect-agent';
export {
  ReviewerAgent,
  createReviewerAgent,
  ReviewPayloadSchema,
  CodeReviewResponseSchema,
  ReviewDecision,
  CommentSeverity,
  type ReviewerAgentConfig,
  type ReviewPayload,
  type CodeReviewResponse,
  type IGitHubClient,
  type ICIChecker,
  type PullRequestInfo,
} from './reviewer-agent';
export {
  TesterAgent,
  createTesterAgent,
  TestExecutionPayloadSchema,
  TestGenerationPayloadSchema,
  TestAnalysisPayloadSchema,
  GeneratedTestResponseSchema,
  TestAnalysisResponseSchema,
  CoverageStatus,
  IssueSeverity,
  type TesterAgentConfig,
  type TestExecutionPayload,
  type TestGenerationPayload,
  type TestAnalysisPayload,
  type GeneratedTestResponse,
  type TestAnalysisResponse,
  type ITestRunner,
  type TestRunResult,
  type FailedTest,
  type CoverageResult,
} from './tester-agent';
