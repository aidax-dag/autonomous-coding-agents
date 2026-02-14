/**
 * Performance Baselines
 *
 * Defines performance baselines and thresholds for benchmarking
 * core system components. Each baseline specifies an acceptable
 * range for a specific metric, enabling automated regression detection.
 *
 * @module core/benchmark
 */

/**
 * A single performance baseline definition
 */
export interface PerformanceBaseline {
  /** Unique name for this baseline (used as lookup key) */
  name: string;
  /** Category grouping */
  category: 'latency' | 'throughput' | 'resource' | 'quality';
  /** Human-readable metric description */
  metric: string;
  /** Measurement unit */
  unit: string;
  /** Expected baseline value under normal conditions */
  baseline: number;
  /** Maximum (or minimum for higher-is-better) acceptable value */
  threshold: number;
  /** Whether lower or higher values are desirable */
  direction: 'lower-is-better' | 'higher-is-better';
}

/**
 * Result of checking a measurement against its baseline
 */
export interface BaselineCheckResult {
  /** Baseline name */
  name: string;
  /** Whether the value is within the acceptable threshold */
  passed: boolean;
  /** The actual measured value */
  actual: number;
  /** The baseline expected value */
  baseline: number;
  /** The threshold boundary */
  threshold: number;
  /** Direction of improvement */
  direction: 'lower-is-better' | 'higher-is-better';
  /** How far the actual value deviates from baseline as a ratio */
  deviationRatio: number;
}

/**
 * Predefined performance baselines for the ACA system.
 *
 * Thresholds are intentionally generous to account for CI variability.
 * Baselines represent typical local-machine performance.
 */
export const PERFORMANCE_BASELINES: PerformanceBaseline[] = [
  // --- Latency baselines ---
  {
    name: 'runner-start-latency',
    category: 'latency',
    metric: 'Runner start() time',
    unit: 'ms',
    baseline: 50,
    threshold: 200,
    direction: 'lower-is-better',
  },
  {
    name: 'runner-stop-latency',
    category: 'latency',
    metric: 'Runner stop() time',
    unit: 'ms',
    baseline: 30,
    threshold: 100,
    direction: 'lower-is-better',
  },
  {
    name: 'task-submission-latency',
    category: 'latency',
    metric: 'Task submission time',
    unit: 'ms',
    baseline: 5,
    threshold: 50,
    direction: 'lower-is-better',
  },
  {
    name: 'hook-execution-overhead',
    category: 'latency',
    metric: 'Hook execution overhead per hook',
    unit: 'ms',
    baseline: 2,
    threshold: 10,
    direction: 'lower-is-better',
  },
  {
    name: 'validation-overhead',
    category: 'latency',
    metric: 'Validation check time',
    unit: 'ms',
    baseline: 10,
    threshold: 50,
    direction: 'lower-is-better',
  },

  // --- Throughput baselines ---
  {
    name: 'sequential-task-throughput',
    category: 'throughput',
    metric: 'Tasks per second (sequential)',
    unit: 'tasks/s',
    baseline: 10,
    threshold: 2,
    direction: 'higher-is-better',
  },
  {
    name: 'service-registry-init',
    category: 'throughput',
    metric: 'ServiceRegistry init time',
    unit: 'ms',
    baseline: 20,
    threshold: 100,
    direction: 'lower-is-better',
  },

  // --- Resource baselines ---
  {
    name: 'memory-per-runner',
    category: 'resource',
    metric: 'Memory per OrchestratorRunner',
    unit: 'MB',
    baseline: 5,
    threshold: 50,
    direction: 'lower-is-better',
  },
  {
    name: 'service-registry-memory',
    category: 'resource',
    metric: 'ServiceRegistry memory footprint',
    unit: 'MB',
    baseline: 2,
    threshold: 20,
    direction: 'lower-is-better',
  },

  // --- Quality baselines ---
  {
    name: 'error-recovery-rate',
    category: 'quality',
    metric: 'Error recovery success rate',
    unit: '%',
    baseline: 80,
    threshold: 50,
    direction: 'higher-is-better',
  },
];

/**
 * Look up a baseline by name.
 * Returns undefined if no baseline matches.
 */
export function getBaseline(name: string): PerformanceBaseline | undefined {
  return PERFORMANCE_BASELINES.find((b) => b.name === name);
}

/**
 * Check a measured value against a named baseline.
 *
 * For 'lower-is-better' metrics: passes when actual <= threshold.
 * For 'higher-is-better' metrics: passes when actual >= threshold.
 *
 * @throws Error if the baseline name is not found
 */
export function checkBaseline(name: string, actualValue: number): BaselineCheckResult {
  const baseline = getBaseline(name);
  if (!baseline) {
    throw new Error(`Unknown baseline: ${name}`);
  }

  const passed =
    baseline.direction === 'lower-is-better'
      ? actualValue <= baseline.threshold
      : actualValue >= baseline.threshold;

  const deviationRatio =
    baseline.baseline !== 0
      ? (actualValue - baseline.baseline) / baseline.baseline
      : 0;

  return {
    name: baseline.name,
    passed,
    actual: actualValue,
    baseline: baseline.baseline,
    threshold: baseline.threshold,
    direction: baseline.direction,
    deviationRatio,
  };
}

/**
 * Check multiple baselines at once.
 * Returns an array of results — one per entry in `measurements`.
 */
export function checkAllBaselines(
  measurements: Array<{ name: string; value: number }>,
): BaselineCheckResult[] {
  return measurements.map((m) => checkBaseline(m.name, m.value));
}
