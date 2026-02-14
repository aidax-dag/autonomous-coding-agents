/**
 * Headless CI/CD Mode Types
 *
 * Type definitions for API-only agent execution in CI pipelines.
 * Supports GitHub Actions, GitLab CI, Jenkins, and CircleCI.
 *
 * Feature: F-10 - Headless CI/CD Mode
 */

export interface HeadlessConfig {
  goal: string;
  projectPath: string;
  outputFormat: 'json' | 'jsonl' | 'minimal';
  timeout: number; // ms
  exitOnError: boolean;
  enabledFeatures: string[];
  environment: Record<string, string>;
}

export interface HeadlessResult {
  success: boolean;
  exitCode: number;
  goal: string;
  startedAt: string;
  completedAt: string;
  duration: number; // ms
  output: HeadlessOutput;
  errors: HeadlessError[];
}

export interface HeadlessOutput {
  tasks: HeadlessTaskResult[];
  summary: string;
  metrics: HeadlessMetrics;
}

export interface HeadlessTaskResult {
  id: string;
  team: string;
  status: 'completed' | 'failed' | 'skipped';
  description: string;
  duration: number;
  artifacts?: string[];
}

export interface HeadlessError {
  code: string;
  message: string;
  fatal: boolean;
  timestamp: string;
}

export interface HeadlessMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  totalDuration: number;
  tokensUsed?: number;
  estimatedCost?: number;
}

export interface CIEnvironment {
  provider: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci' | 'unknown';
  runId?: string;
  branch?: string;
  commit?: string;
  prNumber?: number;
  repository?: string;
}

export const EXIT_CODES = {
  SUCCESS: 0,
  GOAL_FAILED: 1,
  TIMEOUT: 2,
  CONFIG_ERROR: 3,
  RUNTIME_ERROR: 4,
} as const;
