/**
 * Composable Skills Module
 *
 * Provides a skill-based abstraction for reusable agent capabilities.
 *
 * Core components:
 * - ISkill: single capability interface
 * - SkillRegistry: skill discovery and management
 * - SkillPipeline: skill composition and chaining
 * - Extracted skills: planning, code-review, test-generation, refactoring,
 *   security-scan, git-workflow, documentation, debugging, performance,
 *   migration, api-design, tdd-workflow, database, cicd
 *
 * @module core/skills
 */

// ── Interfaces ─────────────────────────────────────────────
export type {
  ISkill,
  ISkillRegistry,
  ISkillPipeline,
  SkillContext,
  SkillResult,
  SkillInfo,
  PipelineStepOptions,
  PipelineStepResult,
  PipelineResult,
  PipelineValidation,
} from './interfaces/skill.interface';

// ── Registry ───────────────────────────────────────────────
export {
  SkillRegistry,
  createSkillRegistry,
  type SkillRegistryOptions,
} from './skill-registry';

// ── Pipeline ───────────────────────────────────────────────
export {
  SkillPipeline,
  createSkillPipeline,
  type SkillPipelineOptions,
} from './skill-pipeline';

// ── Extracted Skills ───────────────────────────────────────
export {
  PlanningSkill,
  createPlanningSkill,
  type PlanningSkillInput,
  CodeReviewSkill,
  createCodeReviewSkill,
  type CodeReviewSkillInput,
  TestGenerationSkill,
  createTestGenerationSkill,
  type TestGenerationSkillInput,
  RefactoringSkill,
  createRefactoringSkill,
  type RefactoringSkillInput,
  SecurityScanSkill,
  createSecurityScanSkill,
  type SecurityScanSkillInput,
  type SecurityScanSkillOutput,
  type SecurityFinding,
  GitWorkflowSkill,
  createGitWorkflowSkill,
  type GitWorkflowSkillInput,
  type GitWorkflowSkillOutput,
  DocumentationSkill,
  createDocumentationSkill,
  type DocumentationSkillInput,
  type DocumentationSkillOutput,
  type GeneratedDocument,
  DebuggingSkill,
  createDebuggingSkill,
  type DebuggingSkillInput,
  type DebuggingSkillOutput,
  type SuggestedFix,
  PerformanceSkill,
  createPerformanceSkill,
  type PerformanceSkillInput,
  type PerformanceSkillOutput,
  type PerformanceFinding,
  MigrationSkill,
  createMigrationSkill,
  type MigrationSkillInput,
  type MigrationSkillOutput,
  type MigrationChange,
  ApiDesignSkill,
  createApiDesignSkill,
  type ApiDesignSkillInput,
  type ApiDesignSkillOutput,
  type ApiEndpoint,
  TddWorkflowSkill,
  createTddWorkflowSkill,
  type TddWorkflowSkillInput,
  type TddWorkflowSkillOutput,
  type TddTestCase,
  DatabaseSkill,
  createDatabaseSkill,
  type DatabaseSkillInput,
  type DatabaseSkillOutput,
  CicdSkill,
  createCicdSkill,
  type CicdSkillInput,
  type CicdSkillOutput,
  type PipelineStage,
} from './skills';
