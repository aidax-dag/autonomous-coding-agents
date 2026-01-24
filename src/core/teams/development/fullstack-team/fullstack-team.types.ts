/**
 * Fullstack Team Types
 *
 * Type definitions for the fullstack development team.
 *
 * Feature: Team System
 */

import { DevelopmentTeamConfig } from '../development-team';
import { FrontendTeamConfig } from '../frontend-team';
import { BackendTeamConfig } from '../backend-team';

/**
 * Fullstack-specific configuration
 */
export interface FullstackTeamConfig extends Partial<DevelopmentTeamConfig> {
  /** Frontend configuration */
  frontend?: Partial<FrontendTeamConfig>;
  /** Backend configuration */
  backend?: Partial<BackendTeamConfig>;
  /** Enable full-stack integration patterns */
  enableIntegration?: boolean;
  /** Enable API client generation */
  generateApiClient?: boolean;
  /** Enable state management */
  enableStateManagement?: boolean;
  /** State management library */
  stateManagementLib?: 'redux' | 'zustand' | 'jotai' | 'none';
}

/**
 * Fullstack feature analysis
 */
export interface FullstackAnalysis {
  /** Has frontend component */
  hasFrontend: boolean;
  /** Has backend API */
  hasBackend: boolean;
  /** Has database model */
  hasDatabase: boolean;
  /** Requires authentication */
  requiresAuth: boolean;
  /** Feature layers */
  layers: ('ui' | 'api' | 'service' | 'database')[];
  /** Integration complexity */
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Fullstack statistics tracking
 */
export interface FullstackStats {
  featuresImplemented: number;
  frontendFiles: number;
  backendFiles: number;
  sharedFiles: number;
  apiEndpoints: number;
  components: number;
  models: number;
}
