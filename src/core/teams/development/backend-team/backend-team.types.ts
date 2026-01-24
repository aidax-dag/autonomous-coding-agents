/**
 * Backend Team Types
 *
 * Type definitions for backend team operations.
 *
 * Feature: Team System
 */

import { DevelopmentTeamConfig } from '../development-team';

/**
 * Backend-specific configuration
 */
export interface BackendTeamConfig extends Partial<DevelopmentTeamConfig> {
  /** Server framework (express, fastify, nestjs, etc.) */
  serverFramework?: string;
  /** Database type (postgres, mysql, mongodb, etc.) */
  databaseType?: string;
  /** ORM/ODM (prisma, typeorm, mongoose, etc.) */
  ormType?: string;
  /** Enable API documentation (swagger/openapi) */
  enableApiDocs?: boolean;
  /** Enable request validation */
  enableValidation?: boolean;
  /** Enable rate limiting */
  enableRateLimiting?: boolean;
  /** Enable authentication middleware */
  enableAuth?: boolean;
  /** API style (rest, graphql) */
  apiStyle?: 'rest' | 'graphql';
}

/**
 * API analysis result
 */
export interface APIAnalysis {
  /** API type (crud, custom, aggregate) */
  apiType: 'crud' | 'custom' | 'aggregate';
  /** HTTP methods needed */
  httpMethods: string[];
  /** Requires authentication */
  requiresAuth: boolean;
  /** Requires database access */
  requiresDatabase: boolean;
  /** Data validation requirements */
  validationRequirements: string[];
  /** Security considerations */
  securityConsiderations: string[];
}

/**
 * Database model analysis
 */
export interface ModelAnalysis {
  /** Entity name */
  entityName: string;
  /** Fields */
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    unique?: boolean;
  }>;
  /** Relations */
  relations: Array<{
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    target: string;
  }>;
}

/**
 * Backend API statistics
 */
export interface BackendAPIStats {
  totalEndpoints: number;
  getEndpoints: number;
  postEndpoints: number;
  putEndpoints: number;
  deleteEndpoints: number;
  totalModels: number;
  totalMigrations: number;
}
