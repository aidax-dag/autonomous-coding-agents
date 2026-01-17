/**
 * Quality Dashboard
 *
 * Provides project quality scoring, trend analysis, and report generation.
 * Aggregates metrics from various sources to provide actionable insights.
 *
 * Feature: Metrics System (Phase 3.2)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { MetricsCollector, TimeRange } from './metrics-collector';

// ============================================================================
// Types
// ============================================================================

/**
 * Quality dimension scores
 */
export interface QualityDimensionScore {
  dimension: string;
  score: number; // 0-100
  weight: number;
  status: 'passing' | 'warning' | 'failing';
  threshold: number;
  trend: 'improving' | 'stable' | 'declining';
  details?: string;
}

/**
 * Overall quality score
 */
export interface QualityScore {
  projectId: string;
  timestamp: Date;
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: QualityDimensionScore[];
  passedDimensions: number;
  totalDimensions: number;
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  metricName: string;
  timeRange: TimeRange;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'declining';
  forecast?: number;
  anomalies: TrendAnomaly[];
}

/**
 * Trend anomaly
 */
export interface TrendAnomaly {
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Quality report
 */
export interface QualityReport {
  id: string;
  projectId: string;
  generatedAt: Date;
  period: TimeRange;
  currentScore: QualityScore;
  previousScore?: QualityScore;
  trends: TrendAnalysis[];
  recommendations: string[];
  highlights: ReportHighlight[];
  summary: string;
}

/**
 * Report highlight
 */
export interface ReportHighlight {
  type: 'success' | 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  metric?: string;
  value?: number;
}

/**
 * Quality dimension configuration
 */
export interface QualityDimensionConfig {
  name: string;
  metricName: string;
  weight: number;
  threshold: number;
  warningThreshold: number;
  higherIsBetter: boolean;
  aggregation: 'avg' | 'min' | 'max' | 'latest';
}

/**
 * Dashboard configuration
 */
export interface QualityDashboardConfig {
  /** Dashboard name */
  name?: string;
  /** Project ID */
  projectId?: string;
  /** Quality dimensions to track */
  dimensions?: QualityDimensionConfig[];
  /** History retention in days */
  historyDays?: number;
  /** Trend window in days */
  trendWindowDays?: number;
  /** Score thresholds for grades */
  gradeThresholds?: GradeThresholds;
}

/**
 * Grade thresholds
 */
export interface GradeThresholds {
  A: number; // Score >= this is A
  B: number;
  C: number;
  D: number;
  // Below D threshold is F
}

/**
 * Dashboard events
 */
export interface QualityDashboardEvents {
  'score:calculated': (score: QualityScore) => void;
  'trend:analyzed': (trend: TrendAnalysis) => void;
  'report:generated': (report: QualityReport) => void;
  'threshold:crossed': (dimension: string, score: number, threshold: number) => void;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  projectId: string;
  currentScore: number;
  scoreHistory: number[];
  dimensionCount: number;
  passingDimensions: number;
  reportCount: number;
  lastReportDate?: Date;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_DIMENSIONS: QualityDimensionConfig[] = [
  {
    name: 'Test Coverage',
    metricName: 'test_coverage_percent',
    weight: 0.25,
    threshold: 80,
    warningThreshold: 60,
    higherIsBetter: true,
    aggregation: 'latest',
  },
  {
    name: 'Code Quality',
    metricName: 'code_quality_score',
    weight: 0.25,
    threshold: 80,
    warningThreshold: 60,
    higherIsBetter: true,
    aggregation: 'latest',
  },
  {
    name: 'Documentation',
    metricName: 'documentation_coverage',
    weight: 0.15,
    threshold: 70,
    warningThreshold: 50,
    higherIsBetter: true,
    aggregation: 'latest',
  },
  {
    name: 'Security',
    metricName: 'security_score',
    weight: 0.20,
    threshold: 90,
    warningThreshold: 70,
    higherIsBetter: true,
    aggregation: 'min',
  },
  {
    name: 'Performance',
    metricName: 'performance_score',
    weight: 0.15,
    threshold: 70,
    warningThreshold: 50,
    higherIsBetter: true,
    aggregation: 'avg',
  },
];

export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
};

export const DEFAULT_DASHBOARD_CONFIG: Required<QualityDashboardConfig> = {
  name: 'quality-dashboard',
  projectId: 'default',
  dimensions: DEFAULT_DIMENSIONS,
  historyDays: 30,
  trendWindowDays: 7,
  gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
};

// ============================================================================
// Quality Dashboard Implementation
// ============================================================================

/**
 * Quality Dashboard
 *
 * Provides project quality scoring and reporting.
 */
export class QualityDashboard extends EventEmitter {
  private config: Required<QualityDashboardConfig>;
  private collector: MetricsCollector;
  private scoreHistory: QualityScore[];
  private reports: QualityReport[];

  constructor(collector: MetricsCollector, config: QualityDashboardConfig = {}) {
    super();

    this.collector = collector;
    this.config = {
      ...DEFAULT_DASHBOARD_CONFIG,
      ...config,
      dimensions: config.dimensions || DEFAULT_DIMENSIONS,
      gradeThresholds: config.gradeThresholds || DEFAULT_GRADE_THRESHOLDS,
    };

    this.scoreHistory = [];
    this.reports = [];
  }

  // ==========================================================================
  // Score Calculation
  // ==========================================================================

  /**
   * Calculate current quality score
   */
  calculateScore(): QualityScore {
    const dimensions: QualityDimensionScore[] = [];
    let weightedTotal = 0;
    let totalWeight = 0;
    let passedCount = 0;

    for (const dim of this.config.dimensions) {
      const dimScore = this.calculateDimensionScore(dim);
      dimensions.push(dimScore);

      weightedTotal += dimScore.score * dim.weight;
      totalWeight += dim.weight;

      if (dimScore.status === 'passing') {
        passedCount++;
      }
    }

    const overallScore = totalWeight > 0 ? weightedTotal / totalWeight : 0;
    const grade = this.calculateGrade(overallScore);
    const trend = this.calculateOverallTrend();

    const score: QualityScore = {
      projectId: this.config.projectId,
      timestamp: new Date(),
      overallScore,
      grade,
      dimensions,
      passedDimensions: passedCount,
      totalDimensions: dimensions.length,
      trend,
    };

    this.scoreHistory.push(score);
    this.emit('score:calculated', score);

    // Check for threshold crossings
    for (const dim of dimensions) {
      if (dim.status === 'failing') {
        this.emit('threshold:crossed', dim.dimension, dim.score, dim.threshold);
      }
    }

    return score;
  }

  /**
   * Calculate score for a specific dimension
   */
  private calculateDimensionScore(dim: QualityDimensionConfig): QualityDimensionScore {
    const result = this.collector.aggregate({
      metricName: dim.metricName,
      aggregation: dim.aggregation === 'latest' ? 'max' : dim.aggregation,
    });

    let score = result.value;

    // Normalize score to 0-100 if needed
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    let status: 'passing' | 'warning' | 'failing';
    if (dim.higherIsBetter) {
      if (score >= dim.threshold) status = 'passing';
      else if (score >= dim.warningThreshold) status = 'warning';
      else status = 'failing';
    } else {
      if (score <= dim.threshold) status = 'passing';
      else if (score <= dim.warningThreshold) status = 'warning';
      else status = 'failing';
    }

    const trend = this.calculateDimensionTrend(dim.metricName);

    return {
      dimension: dim.name,
      score,
      weight: dim.weight,
      status,
      threshold: dim.threshold,
      trend,
    };
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    const thresholds = this.config.gradeThresholds;

    if (score >= thresholds.A) return 'A';
    if (score >= thresholds.B) return 'B';
    if (score >= thresholds.C) return 'C';
    if (score >= thresholds.D) return 'D';
    return 'F';
  }

  // ==========================================================================
  // Trend Analysis
  // ==========================================================================

  /**
   * Analyze trend for a metric
   */
  analyzeTrend(metricName: string, timeRange?: TimeRange): TrendAnalysis {
    const now = new Date();
    const range = timeRange || {
      start: new Date(now.getTime() - this.config.trendWindowDays * 24 * 60 * 60 * 1000),
      end: now,
    };

    const midpoint = new Date((range.start.getTime() + range.end.getTime()) / 2);

    // Get current period
    const currentResult = this.collector.aggregate({
      metricName,
      aggregation: 'avg',
      timeRange: { start: midpoint, end: range.end },
    });

    // Get previous period
    const previousResult = this.collector.aggregate({
      metricName,
      aggregation: 'avg',
      timeRange: { start: range.start, end: midpoint },
    });

    const currentValue = currentResult.value;
    const previousValue = previousResult.value;

    let changePercent = 0;
    if (previousValue !== 0) {
      changePercent = ((currentValue - previousValue) / previousValue) * 100;
    }

    const trend = this.determineTrend(changePercent);
    const anomalies = this.detectAnomalies(metricName, range);

    const analysis: TrendAnalysis = {
      metricName,
      timeRange: range,
      currentValue,
      previousValue,
      changePercent,
      trend,
      anomalies,
    };

    this.emit('trend:analyzed', analysis);

    return analysis;
  }

  /**
   * Calculate dimension trend
   */
  private calculateDimensionTrend(metricName: string): 'improving' | 'stable' | 'declining' {
    const analysis = this.analyzeTrend(metricName);
    return analysis.trend;
  }

  /**
   * Calculate overall trend from score history
   */
  private calculateOverallTrend(): 'improving' | 'stable' | 'declining' {
    if (this.scoreHistory.length < 2) return 'stable';

    const recent = this.scoreHistory.slice(-5);
    if (recent.length < 2) return 'stable';

    const first = recent[0].overallScore;
    const last = recent[recent.length - 1].overallScore;
    const change = ((last - first) / first) * 100;

    return this.determineTrend(change);
  }

  /**
   * Determine trend direction
   */
  private determineTrend(changePercent: number): 'improving' | 'stable' | 'declining' {
    const threshold = 5; // 5% change threshold

    if (changePercent > threshold) return 'improving';
    if (changePercent < -threshold) return 'declining';
    return 'stable';
  }

  /**
   * Detect anomalies in metric values
   */
  private detectAnomalies(metricName: string, timeRange: TimeRange): TrendAnomaly[] {
    const result = this.collector.aggregate({
      metricName,
      aggregation: 'avg',
      timeRange,
    });

    const anomalies: TrendAnomaly[] = [];
    const avgValue = result.value;

    if (!result.dataPoints) return anomalies;

    // Calculate standard deviation
    const values = result.dataPoints.map(dp => dp.value);
    const stdDev = this.calculateStdDev(values, avgValue);

    // Detect points outside 2 standard deviations
    for (const dp of result.dataPoints) {
      const deviation = Math.abs(dp.value - avgValue);
      if (deviation > 2 * stdDev) {
        anomalies.push({
          timestamp: dp.timestamp,
          value: dp.value,
          expectedValue: avgValue,
          deviation: deviation / stdDev,
          severity: deviation > 3 * stdDev ? 'high' : 'medium',
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;

    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;

    return Math.sqrt(avgSquaredDiff);
  }

  // ==========================================================================
  // Report Generation
  // ==========================================================================

  /**
   * Generate quality report
   */
  generateReport(period?: TimeRange): QualityReport {
    const now = new Date();
    const reportPeriod = period || {
      start: new Date(now.getTime() - this.config.trendWindowDays * 24 * 60 * 60 * 1000),
      end: now,
    };

    const currentScore = this.calculateScore();
    const previousScore = this.scoreHistory.length > 1
      ? this.scoreHistory[this.scoreHistory.length - 2]
      : undefined;

    const trends: TrendAnalysis[] = [];
    for (const dim of this.config.dimensions) {
      trends.push(this.analyzeTrend(dim.metricName, reportPeriod));
    }

    const recommendations = this.generateRecommendations(currentScore, trends);
    const highlights = this.generateHighlights(currentScore, previousScore, trends);
    const summary = this.generateSummary(currentScore, previousScore);

    const report: QualityReport = {
      id: uuidv4(),
      projectId: this.config.projectId,
      generatedAt: new Date(),
      period: reportPeriod,
      currentScore,
      previousScore,
      trends,
      recommendations,
      highlights,
      summary,
    };

    this.reports.push(report);
    this.emit('report:generated', report);

    return report;
  }

  /**
   * Generate recommendations based on scores and trends
   */
  private generateRecommendations(score: QualityScore, trends: TrendAnalysis[]): string[] {
    const recommendations: string[] = [];

    for (const dim of score.dimensions) {
      if (dim.status === 'failing') {
        recommendations.push(`Critical: ${dim.dimension} (${dim.score.toFixed(1)}%) is below threshold (${dim.threshold}%). Immediate action required.`);
      } else if (dim.status === 'warning') {
        recommendations.push(`Warning: ${dim.dimension} (${dim.score.toFixed(1)}%) is approaching threshold. Consider improvement.`);
      }

      if (dim.trend === 'declining') {
        recommendations.push(`${dim.dimension} is declining. Review recent changes affecting this metric.`);
      }
    }

    // Check for anomalies
    for (const trend of trends) {
      if (trend.anomalies.filter(a => a.severity === 'high').length > 0) {
        recommendations.push(`Investigate anomalies detected in ${trend.metricName}.`);
      }
    }

    if (score.overallScore < 70) {
      recommendations.push('Overall quality score is below acceptable levels. Consider a focused improvement sprint.');
    }

    return recommendations;
  }

  /**
   * Generate report highlights
   */
  private generateHighlights(
    current: QualityScore,
    previous: QualityScore | undefined,
    _trends: TrendAnalysis[]
  ): ReportHighlight[] {
    const highlights: ReportHighlight[] = [];

    // Overall score change
    if (previous) {
      const change = current.overallScore - previous.overallScore;
      if (change > 5) {
        highlights.push({
          type: 'success',
          title: 'Quality Improved',
          description: `Overall score increased by ${change.toFixed(1)} points`,
          value: current.overallScore,
        });
      } else if (change < -5) {
        highlights.push({
          type: 'critical',
          title: 'Quality Declined',
          description: `Overall score decreased by ${Math.abs(change).toFixed(1)} points`,
          value: current.overallScore,
        });
      }
    }

    // Dimension highlights
    for (const dim of current.dimensions) {
      if (dim.status === 'failing') {
        highlights.push({
          type: 'critical',
          title: `${dim.dimension} Below Threshold`,
          description: `Score: ${dim.score.toFixed(1)}% (required: ${dim.threshold}%)`,
          metric: dim.dimension,
          value: dim.score,
        });
      }

      if (dim.trend === 'improving' && dim.status === 'passing') {
        highlights.push({
          type: 'success',
          title: `${dim.dimension} Improving`,
          description: 'Positive trend detected in this metric',
          metric: dim.dimension,
          value: dim.score,
        });
      }
    }

    // Grade highlight
    highlights.push({
      type: current.grade === 'A' || current.grade === 'B' ? 'success' : current.grade === 'F' ? 'critical' : 'info',
      title: `Grade: ${current.grade}`,
      description: `Overall quality score: ${current.overallScore.toFixed(1)}%`,
      value: current.overallScore,
    });

    return highlights;
  }

  /**
   * Generate report summary
   */
  private generateSummary(current: QualityScore, previous: QualityScore | undefined): string {
    const parts: string[] = [];

    parts.push(`Project quality score: ${current.overallScore.toFixed(1)}% (Grade ${current.grade}).`);
    parts.push(`${current.passedDimensions} of ${current.totalDimensions} quality dimensions passing.`);

    if (previous) {
      const change = current.overallScore - previous.overallScore;
      if (Math.abs(change) > 0.1) {
        const direction = change > 0 ? 'improved' : 'declined';
        parts.push(`Quality has ${direction} by ${Math.abs(change).toFixed(1)} points since last assessment.`);
      } else {
        parts.push('Quality has remained stable since last assessment.');
      }
    }

    const failingDims = current.dimensions.filter(d => d.status === 'failing');
    if (failingDims.length > 0) {
      parts.push(`Critical attention needed for: ${failingDims.map(d => d.dimension).join(', ')}.`);
    }

    return parts.join(' ');
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get dashboard statistics
   */
  getStats(): DashboardStats {
    const currentScore = this.scoreHistory.length > 0
      ? this.scoreHistory[this.scoreHistory.length - 1]
      : null;

    return {
      projectId: this.config.projectId,
      currentScore: currentScore?.overallScore || 0,
      scoreHistory: this.scoreHistory.map(s => s.overallScore),
      dimensionCount: this.config.dimensions.length,
      passingDimensions: currentScore?.passedDimensions || 0,
      reportCount: this.reports.length,
      lastReportDate: this.reports.length > 0
        ? this.reports[this.reports.length - 1].generatedAt
        : undefined,
    };
  }

  /**
   * Get score history
   */
  getScoreHistory(limit?: number): QualityScore[] {
    if (limit) {
      return this.scoreHistory.slice(-limit);
    }
    return [...this.scoreHistory];
  }

  /**
   * Get latest score
   */
  getLatestScore(): QualityScore | undefined {
    return this.scoreHistory[this.scoreHistory.length - 1];
  }

  /**
   * Get report by ID
   */
  getReport(id: string): QualityReport | undefined {
    return this.reports.find(r => r.id === id);
  }

  /**
   * Get latest report
   */
  getLatestReport(): QualityReport | undefined {
    return this.reports[this.reports.length - 1];
  }

  /**
   * List all reports
   */
  listReports(limit?: number): QualityReport[] {
    if (limit) {
      return this.reports.slice(-limit);
    }
    return [...this.reports];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.scoreHistory = [];
    this.reports = [];
  }

  /**
   * Get dashboard name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get project ID
   */
  get projectId(): string {
    return this.config.projectId;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a quality dashboard instance
 */
export function createQualityDashboard(
  collector: MetricsCollector,
  config: QualityDashboardConfig = {}
): QualityDashboard {
  return new QualityDashboard(collector, config);
}
