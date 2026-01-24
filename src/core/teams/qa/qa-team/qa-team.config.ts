/**
 * QA Team Configuration
 *
 * Default configuration for the QA team.
 *
 * Feature: Team System
 */

import { QATeamConfig } from './qa-team.types';

/**
 * Default QA team configuration
 */
export const DEFAULT_QA_CONFIG: QATeamConfig = {
  testFrameworks: ['jest', 'vitest'],
  e2eTool: 'playwright',
  enableCoverage: true,
  coverageThreshold: 80,
  enableVisualRegression: false,
  enableA11yTesting: true,
  enablePerformanceTesting: false,
  reportFormat: 'json',
  parallelExecution: true,
  maxWorkers: 4,
};
