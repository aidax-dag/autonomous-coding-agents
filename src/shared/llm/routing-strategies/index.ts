/**
 * Routing Strategies
 *
 * Barrel export for all routing strategy implementations.
 *
 * @module shared/llm/routing-strategies
 */

export {
  ComplexityBasedStrategy,
  createComplexityBasedStrategy,
  type ComplexityThresholds,
} from './complexity-based';

export {
  CostOptimizedStrategy,
  createCostOptimizedStrategy,
  type CostThresholds,
} from './cost-optimized';

export {
  CapabilityBasedStrategy,
  createCapabilityBasedStrategy,
} from './capability-based';

export {
  CompositeStrategy,
  createCompositeStrategy,
  type WeightedStrategy,
} from './composite';
