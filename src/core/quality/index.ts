/**
 * Quality Module
 *
 * Provides completion detection, quality gates, and validation for autonomous projects.
 * Includes real quality measurement implementations for test coverage, code quality,
 * documentation, security, and performance.
 *
 * @module core/quality
 */

export {
  // Enums
  CompletionStatus,
  QualityGateLevel,
  QualityDimension,
  CompletionDetectorEvent,

  // Interfaces
  type QualityCheckResult,
  type CompletionResult,
  type ValidationResult,
  type ValidationDetail,
  type QualityGate,
  type QualityGateDimension,
  type Specification,
  type QualityRequirements,
  type PerformanceThresholds,
  type CompletionDetectorConfig,
  type ICompletionDetector,

  // Schemas and Defaults
  CompletionDetectorConfigSchema,
  DEFAULT_COMPLETION_DETECTOR_CONFIG,
  QUALITY_GATES,

  // Classes
  CompletionDetector,

  // Factory
  createCompletionDetector,
} from './completion-detector.js';

// Re-export quality checks module
export * from './checks/index.js';
