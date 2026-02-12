# F011 -- SkillRegistry

> Composable skill system with registry-based discovery, pipeline chaining, and four extracted agent skills.

## 1. Purpose

The Skills module provides a skill-based abstraction for reusable agent capabilities. Instead of embedding capability logic directly inside agent classes, individual capabilities are extracted into composable `ISkill` implementations that can be discovered by tag or capability, registered/unregistered at runtime, and chained together in pipelines with conditional execution, fallbacks, and output transforms.

## 2. Interface

**Source**: `src/core/skills/interfaces/skill.interface.ts`

### Core Types

```typescript
interface SkillContext {
  workspaceDir: string;
  projectContext?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

interface SkillResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

interface ISkill<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly version: string;
  execute(input: TInput, context: SkillContext): Promise<SkillResult<TOutput>>;
  validate?(input: TInput): boolean;
  canHandle?(input: TInput, context: SkillContext): boolean;
}
```

### Registry Interface

```typescript
interface ISkillRegistry {
  register(skill: ISkill): void;
  unregister(name: string): boolean;
  get(name: string): ISkill | undefined;
  findByTag(tag: string): ISkill[];
  findByCapability(input: unknown, context: SkillContext): ISkill[];
  list(): SkillInfo[];
  count(): number;
  clear(): void;
}
```

### Pipeline Interface

```typescript
interface ISkillPipeline {
  readonly name: string;
  readonly stepCount: number;
  addStep(skillName: string, options?: PipelineStepOptions): ISkillPipeline;
  execute(input: unknown, context: SkillContext): Promise<PipelineResult>;
  validate(): PipelineValidation;
}

interface PipelineStepOptions {
  transform?: (output: unknown) => unknown;
  condition?: (previousOutput: unknown) => boolean;
  fallback?: string;
  timeout?: number;
}
```

## 3. Implementation

### SkillRegistry (`src/core/skills/skill-registry.ts`)

- **Class**: `SkillRegistry implements ISkillRegistry`
- **Storage**: In-memory `Map<string, ISkill>`
- **Config**: `SkillRegistryOptions { allowOverwrite?: boolean }`
- **Key behaviors**:
  - Throws on duplicate registration unless `allowOverwrite` is enabled.
  - Throws on skills with empty name.
  - `findByTag()` iterates all skills and filters by tag inclusion.
  - `findByCapability()` calls each skill's optional `canHandle()` method.
- **Factory**: `createSkillRegistry(options?)`

### SkillPipeline (`src/core/skills/skill-pipeline.ts`)

- **Class**: `SkillPipeline implements ISkillPipeline`
- **Config**: `SkillPipelineOptions { name, registry, stopOnFailure? }`
- **Key behaviors**:
  - Executes steps sequentially, passing output from one step as input to the next.
  - Supports conditional step skipping via `condition` predicate.
  - Supports output transformation between steps via `transform` function.
  - On step failure, attempts the configured `fallback` skill before reporting failure.
  - When `stopOnFailure` is true (default), halts pipeline on first failure.
  - Per-step timeout via `Promise.race` against a timeout promise.
  - `validate()` checks that all referenced skill names and fallbacks exist in the registry.
- **Factory**: `createSkillPipeline(options)`

### Extracted Skills (`src/core/skills/skills/`)

Four concrete skills extracted from team agent logic:

| Skill | Class | Tags | Input |
|-------|-------|------|-------|
| Planning | `PlanningSkill` | `planning` | `{ goal: string }` |
| Code Review | `CodeReviewSkill` | `review`, `security` | `{ files: string[] }` |
| Test Generation | `TestGenerationSkill` | `testing` | `{ sourceFiles: string[] }` |
| Refactoring | `RefactoringSkill` | `refactoring` | `{ files: string[] }` |

Each skill follows the pattern: default stub executor for testing, optional custom executor injection, input validation, and factory function.

## 4. Dependencies

- **Depends on**: No external module dependencies. Self-contained interfaces.
- **Depended on by**: DeepWorker (can use skills as step executors), orchestrator agents, SkillPipeline (consumes SkillRegistry).

## 5. Testing

- **Test file locations**:
  - `tests/unit/core/skills/skill-registry.test.ts`
  - `tests/unit/core/skills/skill-pipeline.test.ts`
  - `tests/unit/core/skills/skills.test.ts`
- **Test count**: 47 tests across 3 files
  - SkillRegistry: 11 tests (register, retrieve, duplicate, overwrite, unregister, findByTag, findByCapability, list, clear, factory)
  - SkillPipeline: 13 tests (sequential execution, stopOnFailure, continue-on-failure, conditional skip, transform, fallback, missing skill, execution errors, validation, empty pipeline, fallback validation, stepCount, factory)
  - Extracted Skills: 23 tests (6 PlanningSkill, 6 CodeReviewSkill, 5 TestGenerationSkill, 6 RefactoringSkill -- metadata, validation, default execution, custom executor, error handling, factory)
