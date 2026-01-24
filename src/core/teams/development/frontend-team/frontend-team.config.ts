/**
 * Frontend Team Configuration
 *
 * Default configuration for the frontend development team.
 *
 * Feature: Team System
 */

import { FrontendTeamConfig } from './frontend-team.types';

/**
 * Default configuration for frontend teams
 */
export const DEFAULT_FRONTEND_CONFIG: FrontendTeamConfig = {
  uiFrameworks: ['react'],
  cssApproach: 'tailwind',
  enableA11y: true,
  enableResponsive: true,
  languages: ['typescript', 'javascript', 'css', 'html'],
  frameworks: ['react', 'next.js'],
  generateTests: true,
  coverageTarget: 80,
  generateDocs: true,
  enableLinting: true,
};
