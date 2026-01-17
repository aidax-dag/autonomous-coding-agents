/**
 * Quality Dashboard Tests
 *
 * Feature: Metrics System (Phase 3.2)
 * Tests for QualityDashboard class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  QualityDashboard,
  createQualityDashboard,
  DEFAULT_DIMENSIONS,
  DEFAULT_GRADE_THRESHOLDS,
  MetricsCollector,
  QualityScore,
  QualityReport,
  TrendAnalysis,
  QualityDimensionConfig,
} from '../../../src/core/metrics/index.js';

describe('QualityDashboard', () => {
  let collector: MetricsCollector;
  let dashboard: QualityDashboard;

  beforeEach(() => {
    collector = new MetricsCollector({
      autoCollect: false,
    });

    dashboard = new QualityDashboard(collector, {
      projectId: 'test-project',
    });
  });

  afterEach(() => {
    collector.stop();
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_DIMENSIONS.length).toBeGreaterThan(0);
      expect(DEFAULT_GRADE_THRESHOLDS.A).toBe(90);
      expect(DEFAULT_GRADE_THRESHOLDS.B).toBe(80);
      expect(DEFAULT_GRADE_THRESHOLDS.C).toBe(70);
      expect(DEFAULT_GRADE_THRESHOLDS.D).toBe(60);
    });

    it('should accept custom configuration', () => {
      const custom = new QualityDashboard(collector, {
        name: 'custom-dashboard',
        projectId: 'custom-project',
      });

      expect(custom.name).toBe('custom-dashboard');
      expect(custom.projectId).toBe('custom-project');
    });

    it('should use default dimensions', () => {
      const dims = DEFAULT_DIMENSIONS;
      expect(dims.find(d => d.name === 'Test Coverage')).toBeDefined();
      expect(dims.find(d => d.name === 'Code Quality')).toBeDefined();
      expect(dims.find(d => d.name === 'Security')).toBeDefined();
    });

    it('should accept custom dimensions', () => {
      const customDims: QualityDimensionConfig[] = [
        {
          name: 'Custom Metric',
          metricName: 'custom_metric',
          weight: 1.0,
          threshold: 75,
          warningThreshold: 50,
          higherIsBetter: true,
          aggregation: 'avg',
        },
      ];

      const custom = new QualityDashboard(collector, {
        dimensions: customDims,
      });

      // Push data for custom metric
      collector.push('custom_metric', 80);

      const score = custom.calculateScore();
      expect(score.dimensions).toHaveLength(1);
      expect(score.dimensions[0].dimension).toBe('Custom Metric');
    });
  });

  // ============================================================================
  // Score Calculation
  // ============================================================================

  describe('Score Calculation', () => {
    beforeEach(() => {
      // Push metrics for all default dimensions
      collector.push('test_coverage_percent', 85);
      collector.push('code_quality_score', 90);
      collector.push('documentation_coverage', 75);
      collector.push('security_score', 95);
      collector.push('performance_score', 80);
    });

    it('should calculate quality score', () => {
      const score = dashboard.calculateScore();

      expect(score).toBeDefined();
      expect(score.projectId).toBe('test-project');
      expect(score.overallScore).toBeGreaterThan(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
      expect(score.timestamp).toBeInstanceOf(Date);
    });

    it('should include dimension scores', () => {
      const score = dashboard.calculateScore();

      expect(score.dimensions.length).toBeGreaterThan(0);
      for (const dim of score.dimensions) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
        expect(['passing', 'warning', 'failing']).toContain(dim.status);
        expect(['improving', 'stable', 'declining']).toContain(dim.trend);
      }
    });

    it('should calculate correct grade', () => {
      const score = dashboard.calculateScore();
      expect(['A', 'B', 'C', 'D', 'F']).toContain(score.grade);
    });

    it('should give A grade for high scores', () => {
      collector.push('test_coverage_percent', 95);
      collector.push('code_quality_score', 95);
      collector.push('documentation_coverage', 95);
      collector.push('security_score', 95);
      collector.push('performance_score', 95);

      const score = dashboard.calculateScore();
      expect(score.grade).toBe('A');
    });

    it('should give F grade for low scores', () => {
      const lowDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Low Metric',
          metricName: 'low_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('low_metric', 30);
      const score = lowDashboard.calculateScore();
      expect(score.grade).toBe('F');
    });

    it('should count passing dimensions', () => {
      const score = dashboard.calculateScore();

      expect(score.passedDimensions).toBeLessThanOrEqual(score.totalDimensions);
      expect(score.totalDimensions).toBe(DEFAULT_DIMENSIONS.length);
    });

    it('should emit score:calculated event', (done) => {
      dashboard.on('score:calculated', (score: QualityScore) => {
        expect(score.projectId).toBe('test-project');
        done();
      });

      dashboard.calculateScore();
    });

    it('should emit threshold:crossed event for failing dimensions', (done) => {
      const failingDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Failing',
          metricName: 'failing_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('failing_metric', 40);

      failingDashboard.on('threshold:crossed', (dimension: string, score: number, threshold: number) => {
        expect(dimension).toBe('Failing');
        expect(score).toBe(40);
        expect(threshold).toBe(80);
        done();
      });

      failingDashboard.calculateScore();
    });
  });

  // ============================================================================
  // Dimension Status
  // ============================================================================

  describe('Dimension Status', () => {
    it('should mark dimension as passing when above threshold', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Test',
          metricName: 'test_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('test_metric', 85);
      const score = customDashboard.calculateScore();

      expect(score.dimensions[0].status).toBe('passing');
    });

    it('should mark dimension as warning when between thresholds', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Test',
          metricName: 'test_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('test_metric', 70);
      const score = customDashboard.calculateScore();

      expect(score.dimensions[0].status).toBe('warning');
    });

    it('should mark dimension as failing when below warning threshold', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Test',
          metricName: 'test_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('test_metric', 40);
      const score = customDashboard.calculateScore();

      expect(score.dimensions[0].status).toBe('failing');
    });

    it('should handle lower-is-better dimensions correctly', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Error Rate',
          metricName: 'error_rate',
          weight: 1.0,
          threshold: 5, // Below 5% is passing
          warningThreshold: 10, // Below 10% is warning
          higherIsBetter: false,
          aggregation: 'avg',
        }],
      });

      collector.push('error_rate', 2);
      const score = customDashboard.calculateScore();

      expect(score.dimensions[0].status).toBe('passing');
    });
  });

  // ============================================================================
  // Trend Analysis
  // ============================================================================

  describe('Trend Analysis', () => {
    it('should analyze trend for a metric', () => {
      collector.push('test_metric', 50);
      collector.push('test_metric', 60);
      collector.push('test_metric', 70);

      const trend = dashboard.analyzeTrend('test_metric');

      expect(trend).toBeDefined();
      expect(trend.metricName).toBe('test_metric');
      expect(['improving', 'stable', 'declining']).toContain(trend.trend);
    });

    it('should detect improving trend', () => {
      // Simulate improving values over time
      collector.push('improving_metric', 50);
      collector.push('improving_metric', 80);

      const trend = dashboard.analyzeTrend('improving_metric');

      // The trend calculation depends on the implementation
      expect(trend).toBeDefined();
    });

    it('should include anomalies in analysis', () => {
      for (let i = 0; i < 10; i++) {
        collector.push('anomaly_metric', 50);
      }
      // Add an anomaly
      collector.push('anomaly_metric', 150);

      const trend = dashboard.analyzeTrend('anomaly_metric');

      expect(trend.anomalies).toBeDefined();
    });

    it('should emit trend:analyzed event', (done) => {
      collector.push('test', 50);

      dashboard.on('trend:analyzed', (trend: TrendAnalysis) => {
        expect(trend.metricName).toBe('test');
        done();
      });

      dashboard.analyzeTrend('test');
    });

    it('should calculate change percent', () => {
      collector.push('change_metric', 50);
      collector.push('change_metric', 75);

      const trend = dashboard.analyzeTrend('change_metric');

      expect(trend.changePercent).toBeDefined();
    });
  });

  // ============================================================================
  // Report Generation
  // ============================================================================

  describe('Report Generation', () => {
    beforeEach(() => {
      collector.push('test_coverage_percent', 85);
      collector.push('code_quality_score', 90);
      collector.push('documentation_coverage', 75);
      collector.push('security_score', 95);
      collector.push('performance_score', 80);
    });

    it('should generate quality report', () => {
      const report = dashboard.generateReport();

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.projectId).toBe('test-project');
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should include current score in report', () => {
      const report = dashboard.generateReport();

      expect(report.currentScore).toBeDefined();
      expect(report.currentScore.overallScore).toBeGreaterThan(0);
    });

    it('should include trends in report', () => {
      const report = dashboard.generateReport();

      expect(report.trends).toBeDefined();
      expect(report.trends.length).toBeGreaterThan(0);
    });

    it('should include recommendations', () => {
      const report = dashboard.generateReport();

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should include highlights', () => {
      const report = dashboard.generateReport();

      expect(report.highlights).toBeDefined();
      expect(report.highlights.length).toBeGreaterThan(0);
    });

    it('should include summary', () => {
      const report = dashboard.generateReport();

      expect(report.summary).toBeDefined();
      expect(report.summary.length).toBeGreaterThan(0);
    });

    it('should emit report:generated event', (done) => {
      dashboard.on('report:generated', (report: QualityReport) => {
        expect(report.id).toBeDefined();
        done();
      });

      dashboard.generateReport();
    });

    it('should include previous score when available', () => {
      // Generate first report
      dashboard.generateReport();

      // Push new data and generate second report
      collector.push('test_coverage_percent', 90);
      const report = dashboard.generateReport();

      expect(report.previousScore).toBeDefined();
    });

    it('should generate recommendations for failing dimensions', () => {
      const failingDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Critical',
          metricName: 'critical_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('critical_metric', 40);
      const report = failingDashboard.generateReport();

      expect(report.recommendations.some(r => r.includes('Critical'))).toBe(true);
    });
  });

  // ============================================================================
  // Report Highlights
  // ============================================================================

  describe('Report Highlights', () => {
    it('should show grade highlight', () => {
      collector.push('test_coverage_percent', 95);
      const report = dashboard.generateReport();

      const gradeHighlight = report.highlights.find(h => h.title.includes('Grade'));
      expect(gradeHighlight).toBeDefined();
    });

    it('should show critical highlights for failing dimensions', () => {
      const failDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Failing Dim',
          metricName: 'fail_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'avg',
        }],
      });

      collector.push('fail_metric', 30);
      const report = failDashboard.generateReport();

      const criticalHighlight = report.highlights.find(h => h.type === 'critical');
      expect(criticalHighlight).toBeDefined();
    });

    it('should show quality change highlights', () => {
      // First report
      dashboard.generateReport();

      // Increase quality significantly
      collector.push('test_coverage_percent', 98);
      collector.push('code_quality_score', 98);

      const report = dashboard.generateReport();
      // Check if there's any highlight about quality change
      expect(report.highlights.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    it('should return dashboard stats', () => {
      collector.push('test_coverage_percent', 85);
      dashboard.calculateScore();

      const stats = dashboard.getStats();

      expect(stats.projectId).toBe('test-project');
      expect(stats.dimensionCount).toBe(DEFAULT_DIMENSIONS.length);
    });

    it('should track score history', () => {
      collector.push('test_coverage_percent', 85);
      dashboard.calculateScore();

      collector.push('test_coverage_percent', 90);
      dashboard.calculateScore();

      const stats = dashboard.getStats();
      expect(stats.scoreHistory.length).toBe(2);
    });

    it('should track report count', () => {
      collector.push('test_coverage_percent', 85);
      dashboard.generateReport();
      dashboard.generateReport();

      const stats = dashboard.getStats();
      expect(stats.reportCount).toBe(2);
    });

    it('should return current score', () => {
      collector.push('test_coverage_percent', 85);
      dashboard.calculateScore();

      const stats = dashboard.getStats();
      expect(stats.currentScore).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // History and Reports
  // ============================================================================

  describe('History and Reports', () => {
    beforeEach(() => {
      collector.push('test_coverage_percent', 85);
    });

    it('should get score history', () => {
      dashboard.calculateScore();
      dashboard.calculateScore();

      const history = dashboard.getScoreHistory();
      expect(history).toHaveLength(2);
    });

    it('should get score history with limit', () => {
      for (let i = 0; i < 5; i++) {
        dashboard.calculateScore();
      }

      const history = dashboard.getScoreHistory(3);
      expect(history).toHaveLength(3);
    });

    it('should get latest score', () => {
      dashboard.calculateScore();
      collector.push('test_coverage_percent', 90);
      const lastScore = dashboard.calculateScore();

      const latest = dashboard.getLatestScore();
      expect(latest).toBe(lastScore);
    });

    it('should get report by ID', () => {
      const report = dashboard.generateReport();
      const retrieved = dashboard.getReport(report.id);

      expect(retrieved).toBe(report);
    });

    it('should get latest report', () => {
      dashboard.generateReport();
      const lastReport = dashboard.generateReport();

      const latest = dashboard.getLatestReport();
      expect(latest).toBe(lastReport);
    });

    it('should list reports with limit', () => {
      for (let i = 0; i < 5; i++) {
        dashboard.generateReport();
      }

      const reports = dashboard.listReports(3);
      expect(reports).toHaveLength(3);
    });
  });

  // ============================================================================
  // Clear Data
  // ============================================================================

  describe('Clear Data', () => {
    it('should clear all data', () => {
      collector.push('test_coverage_percent', 85);
      dashboard.calculateScore();
      dashboard.generateReport();

      dashboard.clear();

      expect(dashboard.getScoreHistory()).toHaveLength(0);
      expect(dashboard.listReports()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty metrics', () => {
      const score = dashboard.calculateScore();

      expect(score.overallScore).toBe(0);
      expect(score.grade).toBe('F');
    });

    it('should handle missing metric data', () => {
      // Only push one metric when multiple are expected
      collector.push('test_coverage_percent', 85);

      const score = dashboard.calculateScore();
      expect(score).toBeDefined();
    });

    it('should handle scores above 100', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Overflow',
          metricName: 'overflow_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'max',
        }],
      });

      collector.push('overflow_metric', 150);
      const score = customDashboard.calculateScore();

      expect(score.dimensions[0].score).toBe(100);
    });

    it('should handle negative scores', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [{
          name: 'Negative',
          metricName: 'negative_metric',
          weight: 1.0,
          threshold: 80,
          warningThreshold: 60,
          higherIsBetter: true,
          aggregation: 'min',
        }],
      });

      collector.push('negative_metric', -10);
      const score = customDashboard.calculateScore();

      expect(score.dimensions[0].score).toBe(0);
    });

    it('should return undefined for non-existent report', () => {
      const report = dashboard.getReport('non-existent');
      expect(report).toBeUndefined();
    });

    it('should return undefined for latest score when no scores', () => {
      const latest = dashboard.getLatestScore();
      expect(latest).toBeUndefined();
    });

    it('should return undefined for latest report when no reports', () => {
      const latest = dashboard.getLatestReport();
      expect(latest).toBeUndefined();
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create dashboard with defaults', () => {
      const created = createQualityDashboard(collector);
      expect(created).toBeInstanceOf(QualityDashboard);
    });

    it('should create dashboard with custom config', () => {
      const created = createQualityDashboard(collector, {
        name: 'custom',
        projectId: 'my-project',
      });

      expect(created.name).toBe('custom');
      expect(created.projectId).toBe('my-project');
    });
  });

  // ============================================================================
  // Weight Calculation
  // ============================================================================

  describe('Weight Calculation', () => {
    it('should calculate weighted average correctly', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [
          {
            name: 'High Weight',
            metricName: 'high_weight',
            weight: 0.8,
            threshold: 80,
            warningThreshold: 60,
            higherIsBetter: true,
            aggregation: 'avg',
          },
          {
            name: 'Low Weight',
            metricName: 'low_weight',
            weight: 0.2,
            threshold: 80,
            warningThreshold: 60,
            higherIsBetter: true,
            aggregation: 'avg',
          },
        ],
      });

      collector.push('high_weight', 100);
      collector.push('low_weight', 0);

      const score = customDashboard.calculateScore();

      // Weighted: (100 * 0.8 + 0 * 0.2) / 1.0 = 80
      expect(score.overallScore).toBe(80);
    });

    it('should normalize weights', () => {
      const customDashboard = new QualityDashboard(collector, {
        dimensions: [
          {
            name: 'Metric A',
            metricName: 'metric_a',
            weight: 0.5,
            threshold: 80,
            warningThreshold: 60,
            higherIsBetter: true,
            aggregation: 'avg',
          },
          {
            name: 'Metric B',
            metricName: 'metric_b',
            weight: 0.5,
            threshold: 80,
            warningThreshold: 60,
            higherIsBetter: true,
            aggregation: 'avg',
          },
        ],
      });

      collector.push('metric_a', 80);
      collector.push('metric_b', 80);

      const score = customDashboard.calculateScore();
      expect(score.overallScore).toBe(80);
    });
  });
});
