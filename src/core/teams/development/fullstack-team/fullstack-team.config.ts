/**
 * Fullstack Team Configuration
 *
 * Default configuration for the fullstack development team.
 *
 * Feature: Team System
 */

import { FullstackTeamConfig } from './fullstack-team.types';

/**
 * Default configuration for fullstack teams
 */
export const DEFAULT_FULLSTACK_CONFIG: FullstackTeamConfig = {
  frontend: {
    uiFrameworks: ['react'],
    cssApproach: 'tailwind',
    enableA11y: true,
    enableResponsive: true,
  },
  backend: {
    serverFramework: 'express',
    databaseType: 'postgres',
    enableApiDocs: true,
    enableValidation: true,
    apiStyle: 'rest',
  },
  enableIntegration: true,
  generateApiClient: true,
  enableStateManagement: true,
  stateManagementLib: 'zustand',
  languages: ['typescript', 'javascript', 'css', 'html'],
  frameworks: ['react', 'next.js', 'express', 'node'],
  generateTests: true,
  coverageTarget: 80,
  generateDocs: true,
  enableLinting: true,
};
