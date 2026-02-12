/**
 * Extracted Skills Module
 *
 * Reusable skill implementations extracted from team agents.
 *
 * @module core/skills/skills
 */

export {
  PlanningSkill,
  createPlanningSkill,
  type PlanningSkillInput,
} from './planning-skill';

export {
  CodeReviewSkill,
  createCodeReviewSkill,
  type CodeReviewSkillInput,
} from './code-review-skill';

export {
  TestGenerationSkill,
  createTestGenerationSkill,
  type TestGenerationSkillInput,
} from './test-generation-skill';

export {
  RefactoringSkill,
  createRefactoringSkill,
  type RefactoringSkillInput,
} from './refactoring-skill';

export {
  SecurityScanSkill,
  createSecurityScanSkill,
  type SecurityScanSkillInput,
  type SecurityScanSkillOutput,
  type SecurityFinding,
} from './security-scan-skill';

export {
  GitWorkflowSkill,
  createGitWorkflowSkill,
  type GitWorkflowSkillInput,
  type GitWorkflowSkillOutput,
} from './git-workflow-skill';

export {
  DocumentationSkill,
  createDocumentationSkill,
  type DocumentationSkillInput,
  type DocumentationSkillOutput,
  type GeneratedDocument,
} from './documentation-skill';

export {
  DebuggingSkill,
  createDebuggingSkill,
  type DebuggingSkillInput,
  type DebuggingSkillOutput,
  type SuggestedFix,
} from './debugging-skill';

export {
  PerformanceSkill,
  createPerformanceSkill,
  type PerformanceSkillInput,
  type PerformanceSkillOutput,
  type PerformanceFinding,
} from './performance-skill';

export {
  MigrationSkill,
  createMigrationSkill,
  type MigrationSkillInput,
  type MigrationSkillOutput,
  type MigrationChange,
} from './migration-skill';

export {
  ApiDesignSkill,
  createApiDesignSkill,
  type ApiDesignSkillInput,
  type ApiDesignSkillOutput,
  type ApiEndpoint,
} from './api-design-skill';

export {
  TddWorkflowSkill,
  createTddWorkflowSkill,
  type TddWorkflowSkillInput,
  type TddWorkflowSkillOutput,
  type TddTestCase,
} from './tdd-workflow-skill';

export {
  DatabaseSkill,
  createDatabaseSkill,
  type DatabaseSkillInput,
  type DatabaseSkillOutput,
} from './database-skill';

export {
  CicdSkill,
  createCicdSkill,
  type CicdSkillInput,
  type CicdSkillOutput,
  type PipelineStage,
} from './cicd-skill';
