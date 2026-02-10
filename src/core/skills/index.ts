/**
 * Composable Skills Module
 *
 * Provides a skill-based abstraction for reusable agent capabilities.
 *
 * Core components:
 * - ISkill: single capability interface
 * - SkillRegistry: skill discovery and management
 * - SkillPipeline: skill composition and chaining
 * - Extracted skills: planning, code-review, test-generation, refactoring
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
} from './skills';
