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
