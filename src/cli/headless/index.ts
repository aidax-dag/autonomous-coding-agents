/**
 * Headless CI/CD Mode — Barrel Export
 *
 * Feature: F-10 - Headless CI/CD Mode
 */

export { HeadlessRunner, createHeadlessRunner } from './headless-runner';
export type { HeadlessRunnerOptions } from './headless-runner';
export { OutputFormatter, createOutputFormatter } from './output-formatter';
export type { OutputFormat } from './output-formatter';
export { CIDetector, createCIDetector } from './ci-detector';
export {
  EXIT_CODES,
  type HeadlessConfig,
  type HeadlessResult,
  type HeadlessOutput,
  type HeadlessTaskResult,
  type HeadlessError,
  type HeadlessMetrics,
  type CIEnvironment,
} from './types';
