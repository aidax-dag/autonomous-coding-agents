/**
 * Brownfield Analyzer Module
 *
 * @module core/brownfield
 */

export type {
  IBrownfieldAnalyzer,
  BrownfieldAnalysis,
  BrownfieldOptions,
  CodebaseMetrics,
  TechDebtItem,
  CodePattern,
  DependencyAnalysis,
} from './interfaces/brownfield.interface';

export {
  BrownfieldAnalyzer,
  createBrownfieldAnalyzer,
  type BrownfieldAnalyzerConfig,
  type AnalysisExecutor,
} from './brownfield-analyzer';

export {
  DEFAULT_MAX_FILES,
  MAX_REPORTED_FILES,
  MAX_REPORTED_PATTERN_LOCATIONS,
  LARGE_FILE_LOC_THRESHOLD,
  EXCESSIVE_FILE_LENGTH,
  DEEP_NESTING_LEVEL,
  TEST_COVERAGE_THRESHOLD,
  BASE_CONFIDENCE,
  CONFIDENCE_PER_OCCURRENCE,
  MAX_CONFIDENCE,
  HEALTH_DEDUCTION_CRITICAL,
  HEALTH_DEDUCTION_HIGH,
  HEALTH_DEDUCTION_MEDIUM,
  HEALTH_DEDUCTION_LOW_COVERAGE,
} from './constants';
