/**
 * Performance Profiler
 *
 * Lightweight profiler for measuring execution times and generating
 * performance reports with statistical summaries. Integrates with
 * PerformanceBaseline for automated pass/fail evaluation.
 *
 * @module core/benchmark
 */

import { type PerformanceBaseline, getBaseline } from './performance-baselines';
import { P95_PERCENTILE } from './constants';

/**
 * Statistical summary for a named measurement
 */
export interface MeasurementStats {
  /** Minimum observed value */
  min: number;
  /** Maximum observed value */
  max: number;
  /** Arithmetic mean */
  avg: number;
  /** 95th percentile */
  p95: number;
  /** Number of samples */
  count: number;
}

/**
 * A single entry in the performance report
 */
export interface ReportEntry {
  /** Measurement name */
  name: string;
  /** Statistical summary */
  stats: MeasurementStats;
  /** Associated baseline (if one exists) */
  baseline?: PerformanceBaseline;
  /** Pass/fail/no-baseline status */
  status: 'pass' | 'fail' | 'no-baseline';
}

/**
 * Full performance report
 */
export interface PerformanceReport {
  /** ISO timestamp of report generation */
  timestamp: string;
  /** Individual measurement entries */
  measurements: ReportEntry[];
  /** Aggregate summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    noBaseline: number;
  };
}

/**
 * Performance Profiler
 *
 * Records timing marks and durations, computes statistics,
 * and generates reports comparing measurements against baselines.
 */
export class PerformanceProfiler {
  private marks: Map<string, number[]> = new Map();
  private durations: Map<string, number[]> = new Map();

  /**
   * Record a timestamp mark.
   * Multiple marks with the same name are stored in order.
   */
  mark(name: string): void {
    const list = this.marks.get(name) ?? [];
    list.push(performance.now());
    this.marks.set(name, list);
  }

  /**
   * Measure elapsed time between two marks.
   * Uses the most recent mark for each name.
   * Stores the result under `name` in durations.
   *
   * @returns Duration in milliseconds
   * @throws Error if either mark is missing
   */
  measure(name: string, startMark: string, endMark: string): number {
    const starts = this.marks.get(startMark);
    const ends = this.marks.get(endMark);

    if (!starts || starts.length === 0) {
      throw new Error(`Start mark '${startMark}' not found`);
    }
    if (!ends || ends.length === 0) {
      throw new Error(`End mark '${endMark}' not found`);
    }

    const duration = ends[ends.length - 1] - starts[starts.length - 1];
    this.recordDuration(name, duration);
    return duration;
  }

  /**
   * Start a timer and return a stop function.
   * Calling the stop function records the elapsed duration
   * and returns it in milliseconds.
   */
  startTimer(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordDuration(name, duration);
      return duration;
    };
  }

  /**
   * Manually record a duration value for a named measurement.
   * Useful when timing is managed externally.
   */
  recordDuration(name: string, duration: number): void {
    const list = this.durations.get(name) ?? [];
    list.push(duration);
    this.durations.set(name, list);
  }

  /**
   * Get statistical summary for a named measurement.
   *
   * @throws Error if no durations have been recorded for the name
   */
  getStats(name: string): MeasurementStats {
    const values = this.durations.get(name);
    if (!values || values.length === 0) {
      throw new Error(`No measurements recorded for '${name}'`);
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sorted.reduce((sum, v) => sum + v, 0) / count;
    const p95Index = Math.ceil(count * P95_PERCENTILE) - 1;
    const p95 = sorted[Math.min(p95Index, count - 1)];

    return { min, max, avg, p95, count };
  }

  /**
   * Get stats for all recorded measurements.
   */
  getAllStats(): Map<string, MeasurementStats> {
    const result = new Map<string, MeasurementStats>();
    for (const name of this.durations.keys()) {
      result.set(name, this.getStats(name));
    }
    return result;
  }

  /**
   * Clear all recorded marks and durations.
   */
  reset(): void {
    this.marks.clear();
    this.durations.clear();
  }

  /**
   * Generate a full performance report.
   *
   * Compares each measurement against its corresponding baseline
   * (matched by name). Measurements without a baseline are reported
   * with status 'no-baseline'.
   */
  toReport(): PerformanceReport {
    const measurements: ReportEntry[] = [];
    let passed = 0;
    let failed = 0;
    let noBaseline = 0;

    for (const [name, values] of this.durations.entries()) {
      if (values.length === 0) continue;

      const stats = this.getStats(name);
      const baseline = getBaseline(name);

      let status: ReportEntry['status'];
      if (!baseline) {
        status = 'no-baseline';
        noBaseline++;
      } else {
        // Use avg for the baseline comparison
        const compareValue = stats.avg;
        const withinThreshold =
          baseline.direction === 'lower-is-better'
            ? compareValue <= baseline.threshold
            : compareValue >= baseline.threshold;
        status = withinThreshold ? 'pass' : 'fail';
        if (withinThreshold) passed++;
        else failed++;
      }

      measurements.push({ name, stats, baseline, status });
    }

    return {
      timestamp: new Date().toISOString(),
      measurements,
      summary: {
        total: measurements.length,
        passed,
        failed,
        noBaseline,
      },
    };
  }
}
