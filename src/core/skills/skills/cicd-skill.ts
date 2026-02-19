/**
 * CI/CD Skill
 *
 * Generates CI/CD pipeline configurations for various platforms.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import { BaseSkill } from '../base-skill';

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
export class CicdSkill extends BaseSkill<CicdSkillInput, CicdSkillOutput> {
  readonly name = 'cicd';
  readonly description = 'Generates CI/CD pipeline configurations for GitHub Actions, GitLab CI, Jenkins, and CircleCI';
  readonly tags = ['cicd', 'deployment', 'pipeline', 'automation'] as const;
  protected readonly validationError = 'Invalid input: platform and project are required';

  private static readonly VALID_PLATFORMS = [
    'github-actions',
    'gitlab-ci',
    'jenkins',
    'circleci',
  ] as const;

  validate(input: CicdSkillInput): boolean {
    return (
      typeof input.platform === 'string' &&
      (CicdSkill.VALID_PLATFORMS as readonly string[]).includes(input.platform) &&
      typeof input.project === 'string' &&
      input.project.length > 0
    );
  }

  protected createFallbackOutput(input: CicdSkillInput): CicdSkillOutput {
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

    return {
      config: configMap[input.platform],
      stages,
      recommendations: [],
    };
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
