/**
 * CI/CD Skill
 *
 * Generates CI/CD pipeline configurations for various platforms.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';

/**
 * A pipeline stage definition
 */
export interface PipelineStage {
  name: string;
  steps: string[];
}

/**
 * Input for CI/CD skill
 */
export interface CicdSkillInput {
  /** CI/CD platform */
  platform: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci';
  /** Project name */
  project: string;
  /** Pipeline stages to include */
  stages?: string[];
}

/**
 * Output from CI/CD skill
 */
export interface CicdSkillOutput {
  /** Generated pipeline configuration */
  config: string;
  /** Pipeline stages with their steps */
  stages: PipelineStage[];
  /** Optimization and best-practice recommendations */
  recommendations: string[];
}

/**
 * CI/CD skill — generates pipeline configurations for various platforms
 */
export class CicdSkill
  implements ISkill<CicdSkillInput, CicdSkillOutput>
{
  readonly name = 'cicd';
  readonly description = 'Generates CI/CD pipeline configurations for GitHub Actions, GitLab CI, Jenkins, and CircleCI';
  readonly tags = ['cicd', 'deployment', 'pipeline', 'automation'] as const;
  readonly version = '1.0.0';

  private readonly executor?: (
    input: CicdSkillInput,
    context: SkillContext,
  ) => Promise<CicdSkillOutput>;

  constructor(options?: {
    executor?: (
      input: CicdSkillInput,
      context: SkillContext,
    ) => Promise<CicdSkillOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: CicdSkillInput): boolean {
    const validPlatforms = ['github-actions', 'gitlab-ci', 'jenkins', 'circleci'];
    return (
      typeof input.platform === 'string' &&
      validPlatforms.includes(input.platform) &&
      typeof input.project === 'string' &&
      input.project.length > 0
    );
  }

  canHandle(input: unknown): boolean {
    const typed = input as CicdSkillInput;
    return (
      typed !== null &&
      typeof typed === 'object' &&
      typeof typed.platform === 'string' &&
      ['github-actions', 'gitlab-ci', 'jenkins', 'circleci'].includes(typed.platform) &&
      typeof typed.project === 'string' &&
      typed.project.length > 0
    );
  }

  async execute(
    input: CicdSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<CicdSkillOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: platform and project are required',
        duration: Date.now() - start,
      };
    }

    try {
      if (this.executor) {
        const output = await this.executor(input, context);
        return {
          success: true,
          output,
          duration: Date.now() - start,
        };
      }

      // Default stub output
      const stageNames = input.stages ?? ['build', 'test', 'deploy'];
      const stages: PipelineStage[] = stageNames.map((name) => ({
        name,
        steps: [`Run ${name} for ${input.project}`],
      }));

      const configMap: Record<string, string> = {
        'github-actions': `name: ${input.project}\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest`,
        'gitlab-ci': `stages:\n  - ${stageNames.join('\n  - ')}`,
        'jenkins': `pipeline {\n  agent any\n  stages {\n    stage('Build') {\n      steps { echo 'Building ${input.project}' }\n    }\n  }\n}`,
        'circleci': `version: 2.1\njobs:\n  build:\n    docker:\n      - image: cimg/node:lts`,
      };

      const output: CicdSkillOutput = {
        config: configMap[input.platform],
        stages,
        recommendations: [],
      };

      return {
        success: true,
        output,
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }
}

/**
 * Factory function
 */
export function createCicdSkill(options?: {
  executor?: (
    input: CicdSkillInput,
    context: SkillContext,
  ) => Promise<CicdSkillOutput>;
}): CicdSkill {
  return new CicdSkill(options);
}
