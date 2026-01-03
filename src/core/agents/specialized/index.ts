/**
 * Specialized Agents Module
 *
 * Provides concrete agent implementations built on the DI-based BaseAgent.
 *
 * @module core/agents/specialized
 */

export { CoderAgent, createCoderAgent, type CoderAgentConfig } from './coder-agent';
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
