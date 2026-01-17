/**
 * Quality Module
 *
 * Provides quality measurement integration for Agent OS.
 * Bridges QAAgent with real quality tools.
 *
 * @module core/orchestrator/quality
 */

export {
  QualityExecutor,
  createQualityExecutor,
  createQAExecutor,
  type QualityExecutorConfig,
} from './quality-executor';
