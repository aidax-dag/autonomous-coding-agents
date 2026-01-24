/**
 * Backend Team Configuration
 *
 * Default configuration for backend team.
 *
 * Feature: Team System
 */

import { BackendTeamConfig } from './backend-team.types';

/**
 * Default backend team configuration
 */
export const DEFAULT_BACKEND_CONFIG: BackendTeamConfig = {
  serverFramework: 'express',
  databaseType: 'postgres',
  ormType: 'prisma',
  enableApiDocs: true,
  enableValidation: true,
  enableRateLimiting: true,
  enableAuth: true,
  apiStyle: 'rest',
  languages: ['typescript', 'javascript'],
  frameworks: ['express', 'node'],
  generateTests: true,
  coverageTarget: 80,
  generateDocs: true,
  enableLinting: true,
};
