/**
 * Frontend Team Types
 *
 * Type definitions for the frontend development team.
 *
 * Feature: Team System
 */

import { DevelopmentTeamConfig } from '../development-team';

/**
 * Frontend-specific configuration
 */
export interface FrontendTeamConfig extends Partial<DevelopmentTeamConfig> {
  /** UI frameworks to use */
  uiFrameworks?: string[];
  /** CSS approach (css-modules, tailwind, styled-components, etc.) */
  cssApproach?: string;
  /** Enable accessibility (a11y) checks */
  enableA11y?: boolean;
  /** Enable responsive design */
  enableResponsive?: boolean;
  /** Component library to use */
  componentLibrary?: string;
  /** State management approach */
  stateManagement?: string;
}

/**
 * Component analysis result
 */
export interface ComponentAnalysis {
  /** Component type (page, feature, ui, shared) */
  componentType: 'page' | 'feature' | 'ui' | 'shared';
  /** Requires state management */
  requiresState: boolean;
  /** Requires API calls */
  requiresAPI: boolean;
  /** Has children components */
  hasChildren: boolean;
  /** Accessibility requirements */
  a11yRequirements: string[];
  /** Responsive breakpoints needed */
  responsiveBreakpoints: string[];
}

/**
 * Component statistics tracking
 */
export interface ComponentStats {
  totalComponents: number;
  pageComponents: number;
  featureComponents: number;
  uiComponents: number;
  sharedComponents: number;
}
